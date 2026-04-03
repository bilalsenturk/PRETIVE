"""Hardened live session endpoints for real-time presentation tracking.

Includes input validation, rate limiting, event logging, and proper error handling."""

import json
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db.supabase import get_supabase
from app.services.matching import find_matching_chunks, get_cards_for_position
from app.services.suggestions import get_suggestions
from app.services.verification import verify_claim
from app.services.prompter import generate_prompter_guidance, clear_session_cache
from app.services.orchestration import build_card_queue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["live"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class MatchRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class PositionInfo(BaseModel):
    heading: str | None = None
    chunk_index: int | None = None


class MatchResponse(BaseModel):
    chunks: list[dict]
    cards: list[dict]
    position: dict
    verification: dict = {}
    suggestions: list[dict] = []
    prompter: dict = {}


class LiveStatusResponse(BaseModel):
    session_id: str
    status: str
    last_position: PositionInfo | None = None


class LiveActionResponse(BaseModel):
    session_id: str
    status: str


# ---------------------------------------------------------------------------
# Simple in-memory rate limiter (per-session, 200ms apart)
# ---------------------------------------------------------------------------

_last_match_time: dict[str, float] = {}
_RATE_LIMIT_SECONDS = 0.2  # 200ms


def _check_rate_limit(session_id: str) -> None:
    """Reject match requests that arrive faster than 200ms apart per session."""
    now = time.monotonic()
    last = _last_match_time.get(session_id)
    if last is not None and (now - last) < _RATE_LIMIT_SECONDS:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Wait at least 200ms between match requests.",
        )
    _last_match_time[session_id] = now


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_session_or_404(session_id: str) -> dict:
    """Fetch a session by ID or raise 404."""
    supabase = get_supabase()
    try:
        result = (
            supabase.table("sessions")
            .select("*")
            .eq("id", session_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return result.data


def _log_event(session_id: str, event_type: str, payload: dict | None = None) -> None:
    """Insert a row into session_events for auditing / debugging."""
    try:
        supabase = get_supabase()
        supabase.table("session_events").insert({
            "session_id": session_id,
            "event_type": event_type,
            "payload": payload or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception:
        logger.exception("Failed to log event %s for session %s", event_type, session_id)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/{session_id}/live/start", response_model=LiveActionResponse)
async def start_live_session(session_id: str) -> LiveActionResponse:
    """Transition a session to 'live' status."""
    logger.info("Starting live session: %s", session_id)
    session = _get_session_or_404(session_id)

    if session["status"] not in ("ready", "completed"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start live session from status '{session['status']}'. "
                   "Session must be 'ready' or 'completed'.",
        )

    try:
        supabase = get_supabase()
        supabase.table("sessions").update({"status": "live"}).eq("id", session_id).execute()
    except Exception as exc:
        logger.exception("Failed to start live session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update session status")

    _log_event(session_id, "live_started")
    logger.info("Session %s is now live", session_id)

    return LiveActionResponse(session_id=session_id, status="live")


@router.post("/{session_id}/live/stop", response_model=LiveActionResponse)
async def stop_live_session(session_id: str) -> LiveActionResponse:
    """Transition a session to 'completed' status."""
    logger.info("Stopping live session: %s", session_id)
    session = _get_session_or_404(session_id)

    if session["status"] != "live":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot stop session that is not live (current: '{session['status']}').",
        )

    try:
        supabase = get_supabase()
        supabase.table("sessions").update({"status": "completed"}).eq("id", session_id).execute()
    except Exception as exc:
        logger.exception("Failed to stop live session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update session status")

    _log_event(session_id, "live_stopped")
    clear_session_cache(session_id)
    logger.info("Session %s completed", session_id)

    return LiveActionResponse(session_id=session_id, status="completed")


@router.post("/{session_id}/live/match", response_model=MatchResponse)
async def match_transcript(session_id: str, body: MatchRequest) -> MatchResponse:
    """Match spoken transcript text to content chunks and return relevant cards.

    Validates text length (1-5000 chars), enforces 200ms rate limit per session,
    performs real pgvector search, and logs all match events.
    """
    logger.info("Match request: session=%s, text_length=%d", session_id, len(body.text))

    # Rate limit check
    _check_rate_limit(session_id)

    # Verify session exists
    _get_session_or_404(session_id)

    _match_start = time.time()
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text must not be empty after trimming")

    try:
        # Find matching content chunks (real pgvector search)
        chunks = find_matching_chunks(text, session_id)
    except Exception as exc:
        logger.exception("Matching failed for session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Content matching failed")

    # Derive position from the best-matching chunk
    position: dict = {}
    if chunks:
        best = chunks[0]
        position = {
            "heading": best.get("heading"),
            "chunk_index": best.get("chunk_index"),
        }

    # Get cards related to matched chunks
    try:
        chunk_ids = [c["id"] for c in chunks if "id" in c]
        cards = get_cards_for_position(session_id, chunk_ids)
    except Exception as exc:
        logger.exception("Card lookup failed for session %s: %s", session_id, exc)
        cards = []

    # Run verification on the transcript
    verification: dict = {}
    try:
        verification = await verify_claim(text, session_id, chunks)
    except Exception as exc:
        logger.exception("Verification failed for session %s: %s", session_id, exc)
        verification = {"status": "error", "confidence": 0.0, "claim": None, "evidence": None}

    # Calculate elapsed time from live_start event
    elapsed: float = 0.0
    try:
        supabase = get_supabase()
        start_event = (
            supabase.table("session_events")
            .select("created_at")
            .eq("session_id", session_id)
            .eq("event_type", "live_started")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if start_event.data:
            start_dt = datetime.fromisoformat(
                start_event.data[0]["created_at"].replace("Z", "+00:00")
            )
            elapsed = (datetime.now(timezone.utc) - start_dt).total_seconds()
    except Exception as exc:
        logger.exception("Failed to compute elapsed time for session %s: %s", session_id, exc)

    # Get suggestions
    suggestions: list[dict] = []
    try:
        suggestions = get_suggestions(
            session_id,
            position.get("chunk_index"),
            int(elapsed),
        )
    except Exception as exc:
        logger.exception("Suggestions failed for session %s: %s", session_id, exc)

    # Generate semantic prompter guidance (transition sentences, reminders, pacing)
    prompter: dict = {}
    try:
        # Build topic coverage data from suggestions service data
        supabase_p = get_supabase()
        chunks_data = (
            supabase_p.table("content_chunks")
            .select("id, chunk_index, heading, content")
            .eq("session_id", session_id)
            .order("chunk_index")
            .execute()
        )
        all_chunks = chunks_data.data or []

        events_data = (
            supabase_p.table("session_events")
            .select("payload")
            .eq("session_id", session_id)
            .eq("event_type", "match")
            .execute()
        )
        covered_ids = set()
        for ev in (events_data.data or []):
            p = ev.get("payload") or {}
            for cid in p.get("matched_chunk_ids", []):
                covered_ids.add(cid)

        # Build topic lists
        all_topics_ordered: list[str] = []
        topic_set: set[str] = set()
        covered_topics_list: list[str] = []
        covered_topic_set: set[str] = set()
        for ch in all_chunks:
            h = ch.get("heading") or "Untitled"
            if h not in topic_set:
                all_topics_ordered.append(h)
                topic_set.add(h)
            if ch["id"] in covered_ids and h not in covered_topic_set:
                covered_topics_list.append(h)
                covered_topic_set.add(h)

        uncovered_topics_list = [t for t in all_topics_ordered if t not in covered_topic_set]

        # Find next uncovered topic and its chunks for context
        current_heading = position.get("heading")
        next_topic = uncovered_topics_list[0] if uncovered_topics_list else None
        if next_topic == current_heading and len(uncovered_topics_list) > 1:
            next_topic = uncovered_topics_list[1]

        next_chunks = [c for c in all_chunks if c.get("heading") == next_topic][:3]

        prompter = generate_prompter_guidance(
            current_topic=current_heading,
            next_topic=next_topic,
            covered_topics=covered_topics_list,
            uncovered_topics=uncovered_topics_list,
            elapsed_seconds=int(elapsed),
            total_topics=len(all_topics_ordered),
            context_chunks=next_chunks,
            session_id=session_id,
        )
    except Exception as exc:
        logger.exception("Prompter failed for session %s: %s", session_id, exc)

    # Update session's current state for participant view
    try:
        supabase = get_supabase()
        session_result = (
            supabase.table("sessions")
            .select("metadata")
            .eq("id", session_id)
            .single()
            .execute()
        )
        existing_metadata = (session_result.data or {}).get("metadata") or {}
        if isinstance(existing_metadata, str):
            try:
                existing_metadata = json.loads(existing_metadata)
            except (json.JSONDecodeError, TypeError):
                existing_metadata = {}

        existing_metadata.update({
            "current_heading": position.get("heading"),
            "current_cards": [c["id"] for c in cards if "id" in c],
            "last_match_at": datetime.now(timezone.utc).isoformat(),
        })

        supabase.table("sessions").update({
            "metadata": existing_metadata,
        }).eq("id", session_id).execute()
    except Exception as exc:
        logger.exception("Failed to update session metadata for %s: %s", session_id, exc)

    # Update dynamic slide position based on matched chunks
    try:
        from app.services.slides import update_slide_position
        chunk_ids_matched = [c["id"] for c in chunks if "id" in c]
        if chunk_ids_matched:
            update_slide_position(session_id, chunk_ids_matched)
    except Exception as exc:
        logger.exception("Slide position update failed for %s: %s", session_id, exc)

    # Log event with match details
    _log_event(session_id, "match", {
        "text_length": len(text),
        "chunks_matched": len(chunks),
        "cards_returned": len(cards),
        "matched_chunk_ids": [c["id"] for c in chunks if "id" in c],
        "response_ms": round((time.time() - _match_start) * 1000, 2),
        "heading": position.get("heading"),
        "chunk_index": position.get("chunk_index"),
    })

    # Log verification result
    if verification.get("status") not in (None, "no_claim"):
        _log_event(session_id, "verification", {
            "claim": verification.get("claim"),
            "status": verification.get("status"),
            "confidence": verification.get("confidence"),
        })

    logger.info(
        "Match result: session=%s, chunks=%d, cards=%d, verification=%s, suggestions=%d, prompter=%s",
        session_id, len(chunks), len(cards), verification.get("status"), len(suggestions),
        bool(prompter.get("transition_sentence")),
    )

    return MatchResponse(
        chunks=chunks,
        cards=cards,
        position=position,
        verification=verification,
        suggestions=suggestions,
        prompter=prompter,
    )


@router.get("/{session_id}/live/slides")
async def get_session_slides(session_id: str):
    """Get all slides/chunks for the slide progress strip."""
    _get_session_or_404(session_id)
    supabase = get_supabase()

    result = (
        supabase.table("content_chunks")
        .select("id, chunk_index, heading, chunk_type, metadata")
        .eq("session_id", session_id)
        .order("chunk_index")
        .execute()
    )

    slides = []
    for chunk in (result.data or []):
        meta = chunk.get("metadata") or {}
        slides.append({
            "id": chunk["id"],
            "index": chunk["chunk_index"],
            "heading": chunk.get("heading") or f"Section {chunk['chunk_index'] + 1}",
            "type": chunk.get("chunk_type", "section"),
            "slide_number": meta.get("slide_number", chunk["chunk_index"] + 1),
            "has_notes": bool(meta.get("speaker_notes")),
        })

    return {"slides": slides, "total": len(slides)}


class SlideNavigateRequest(BaseModel):
    slide_index: int = Field(..., ge=0)


@router.post("/{session_id}/live/navigate")
async def navigate_to_slide(session_id: str, body: SlideNavigateRequest):
    """Navigate to a specific slide manually."""
    session = _get_session_or_404(session_id)
    supabase = get_supabase()

    # Get the specific chunk
    result = (
        supabase.table("content_chunks")
        .select("*")
        .eq("session_id", session_id)
        .eq("chunk_index", body.slide_index)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail=f"Slide {body.slide_index} not found")

    chunk = result.data[0]
    chunk_ids = [chunk["id"]]

    # Get cards for this slide
    cards = get_cards_for_position(session_id, chunk_ids)

    position = {"heading": chunk.get("heading"), "chunk_index": chunk["chunk_index"]}

    # Update session metadata
    supabase.table("sessions").update({
        "metadata": {
            "current_heading": position.get("heading"),
            "current_chunk_index": body.slide_index,
            "current_cards": [c["id"] for c in cards],
            "last_navigate_at": datetime.now(timezone.utc).isoformat(),
            "navigation_trigger": "manual",
        }
    }).eq("id", session_id).execute()

    # Log event
    _log_event(session_id, "slide_navigation", {
        "heading": position.get("heading"),
        "chunk_index": body.slide_index,
        "trigger": "manual",
        "cards_returned": len(cards),
    })

    return {"chunks": [chunk], "cards": cards, "position": position}


class OrchestrateRequest(BaseModel):
    shown_card_ids: list[str] = []
    dismissed_card_ids: list[str] = []
    current_chunk_index: int | None = None
    elapsed_seconds: int = 0


@router.post("/{session_id}/live/orchestrate")
async def orchestrate_cards(session_id: str, body: OrchestrateRequest):
    """Return a prioritized card queue for intelligent screen orchestration."""
    _get_session_or_404(session_id)
    supabase = get_supabase()

    # Fetch all session cards
    result = (
        supabase.table("session_cards")
        .select("*")
        .eq("session_id", session_id)
        .order("display_order")
        .execute()
    )
    all_cards = result.data or []

    queue = build_card_queue(
        all_session_cards=all_cards,
        active_card_ids=body.shown_card_ids[:3],
        dismissed_card_ids=body.dismissed_card_ids,
        current_chunk_index=body.current_chunk_index,
        elapsed_seconds=body.elapsed_seconds,
        shown_card_ids=body.shown_card_ids,
    )

    return queue


@router.get("/{session_id}/live/status", response_model=LiveStatusResponse)
async def get_live_status(session_id: str) -> LiveStatusResponse:
    """Return current session status and last known position."""
    logger.info("Getting live status for session=%s", session_id)
    session = _get_session_or_404(session_id)

    # Retrieve the most recent match event to determine last position
    last_position: PositionInfo | None = None
    try:
        supabase = get_supabase()
        events_result = (
            supabase.table("session_events")
            .select("payload")
            .eq("session_id", session_id)
            .eq("event_type", "match")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if events_result.data:
            payload = events_result.data[0].get("payload", {})
            if payload.get("heading") or payload.get("chunk_index") is not None:
                last_position = PositionInfo(
                    heading=payload.get("heading"),
                    chunk_index=payload.get("chunk_index"),
                )
    except Exception:
        logger.exception("Failed to fetch last position for session %s", session_id)

    return LiveStatusResponse(
        session_id=session_id,
        status=session["status"],
        last_position=last_position,
    )
