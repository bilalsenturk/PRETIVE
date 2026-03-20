"""Hardened live session endpoints for real-time presentation tracking.

Includes input validation, rate limiting, event logging, and proper error handling."""

import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db.supabase import get_supabase
from app.services.matching import find_matching_chunks, get_cards_for_position

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

    # Log event with match details
    _log_event(session_id, "match", {
        "text_length": len(text),
        "chunks_matched": len(chunks),
        "cards_returned": len(cards),
        "heading": position.get("heading"),
        "chunk_index": position.get("chunk_index"),
    })

    logger.info(
        "Match result: session=%s, chunks=%d, cards=%d",
        session_id, len(chunks), len(cards),
    )

    return MatchResponse(chunks=chunks, cards=cards, position=position)


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
