"""Hardened session management router with input validation, permission checks,
and comprehensive logging."""

import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.db.supabase import get_supabase
from app.services.embedding import generate_embeddings, is_embedding_available
from app.services.ingestion import parse_document
from app.services.llm import chat_completion
from app.services.narrative import build_narrative_graph, generate_session_cards

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

DEMO_USER_ID = "demo-user-001"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SessionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class SessionResponse(BaseModel):
    id: str
    title: str
    status: str
    created_at: str
    updated_at: str


class PrepareResponse(BaseModel):
    session_id: str
    status: str
    documents_parsed: int
    total_chunks: int
    topics_count: int
    cards_generated: int
    errors: list[str] = []


class AnalyticsResponse(BaseModel):
    session_id: str
    duration_seconds: int
    total_events: int
    match_events: int
    match_hit_rate: float
    total_chunks: int
    matched_chunk_ids: list[str]
    coverage_rate: float
    total_cards: int
    cards_shown: int
    avg_response_ms: float
    topics_covered: list[str]


class SummaryResponse(BaseModel):
    summary: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_user_id(x_user_id: Optional[str]) -> str:
    """Return the provided user ID or the demo bypass."""
    return x_user_id or DEMO_USER_ID


def _get_session_for_user(session_id: str, user_id: str) -> dict:
    """Fetch a session and verify it belongs to the given user.

    Raises 404 if not found, 403 if owned by another user.
    """
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

    session = result.data
    if session.get("user_id") != user_id:
        logger.warning(
            "Permission denied: user %s tried to access session %s owned by %s",
            user_id, session_id, session.get("user_id"),
        )
        raise HTTPException(status_code=403, detail="You do not have permission to access this session")

    return session


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> SessionResponse:
    """Create a new presentation session."""
    user_id = _resolve_user_id(x_user_id)
    logger.info("Creating session title=%r for user=%s", body.title, user_id)

    try:
        supabase = get_supabase()
        result = (
            supabase.table("sessions")
            .insert({"title": body.title, "user_id": user_id, "status": "draft"})
            .execute()
        )
    except Exception as exc:
        logger.exception("DB error creating session: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create session")

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")

    session = result.data[0]
    logger.info("Session created id=%s for user=%s", session["id"], user_id)
    return SessionResponse(
        id=session["id"],
        title=session["title"],
        status=session["status"],
        created_at=session.get("created_at", ""),
        updated_at=session.get("updated_at", session.get("created_at", "")),
    )


@router.get("")
async def list_sessions(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """List all sessions for the authenticated user (filtered by user_id)."""
    user_id = _resolve_user_id(x_user_id)
    logger.info("Listing sessions for user=%s", user_id)

    try:
        supabase = get_supabase()
        result = (
            supabase.table("sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        logger.exception("DB error listing sessions: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to list sessions")

    return result.data or []


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> SessionResponse:
    """Get a single session by ID. Verifies ownership."""
    user_id = _resolve_user_id(x_user_id)
    logger.info("Getting session=%s for user=%s", session_id, user_id)

    session = _get_session_for_user(session_id, user_id)
    return SessionResponse(
        id=session["id"],
        title=session["title"],
        status=session["status"],
        created_at=session.get("created_at", ""),
        updated_at=session.get("updated_at", session.get("created_at", "")),
    )


@router.delete("/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> None:
    """Delete a session by ID. Verifies ownership before deletion."""
    user_id = _resolve_user_id(x_user_id)
    logger.info("Deleting session=%s for user=%s", session_id, user_id)

    # Verify ownership first
    _get_session_for_user(session_id, user_id)

    try:
        supabase = get_supabase()
        supabase.table("sessions").delete().eq("id", session_id).execute()
    except Exception as exc:
        logger.exception("DB error deleting session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Failed to delete session")

    logger.info("Session deleted id=%s by user=%s", session_id, user_id)


@router.get("/{session_id}/cards")
async def list_session_cards(
    session_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """List all generated cards for a session. Verifies ownership."""
    user_id = _resolve_user_id(x_user_id)
    _get_session_for_user(session_id, user_id)

    try:
        supabase = get_supabase()
        result = (
            supabase.table("session_cards")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
    except Exception as exc:
        logger.exception("DB error listing cards for session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Failed to list session cards")

    return result.data or []


@router.post("/{session_id}/prepare", response_model=PrepareResponse)
async def prepare_session(
    session_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> PrepareResponse:
    """Run the narrative engine: parse docs, build graph, generate cards.

    Pipeline:
    1. Verify session exists, belongs to user, and is in 'draft' or 'parsed' status.
    2. Set status to 'preparing'.
    3. Parse any unparsed documents (with per-document error handling).
    4. Build narrative graph (real LLM).
    5. Generate cards (real LLM).
    6. Set status to 'ready' on success, 'error' on failure.
    """
    user_id = _resolve_user_id(x_user_id)
    logger.info("Preparing session=%s for user=%s", session_id, user_id)

    session = _get_session_for_user(session_id, user_id)

    # Only allow preparation from specific statuses
    allowed_statuses = ("draft", "parsed")
    if session["status"] not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot prepare session with status '{session['status']}'. "
                   f"Allowed statuses: {', '.join(allowed_statuses)}.",
        )

    supabase = get_supabase()

    # Set status to preparing
    try:
        supabase.table("sessions").update({"status": "preparing"}).eq(
            "id", session_id
        ).execute()
    except Exception as exc:
        logger.exception("Failed to set session %s to preparing: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update session status")

    documents_parsed = 0
    total_chunks = 0
    topics_count = 0
    cards_generated = 0
    errors: list[str] = []

    try:
        # Get all documents for this session
        docs_result = (
            supabase.table("documents")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        documents = docs_result.data or []

        if not documents:
            raise HTTPException(
                status_code=400,
                detail="No documents found for this session. Upload documents first.",
            )

        # Parse each unparsed document
        for doc in documents:
            if doc["status"] in ("processing", "error"):
                try:
                    # Download file from storage
                    file_bytes = supabase.storage.from_("documents").download(
                        doc["storage_path"]
                    )

                    # Parse into chunks
                    chunks = parse_document(file_bytes, doc["file_type"])
                    logger.info(
                        "Parsed document %s (%s): %d chunks",
                        doc["id"], doc.get("file_name", "unknown"), len(chunks),
                    )

                    # Save to content_chunks
                    chunk_records = [
                        {
                            "document_id": doc["id"],
                            "session_id": session_id,
                            "chunk_index": chunk["chunk_index"],
                            "content": chunk["content"],
                            "heading": chunk.get("heading"),
                            "chunk_type": chunk["chunk_type"],
                        }
                        for chunk in chunks
                    ]

                    if chunk_records:
                        insert_result = (
                            supabase.table("content_chunks")
                            .insert(chunk_records)
                            .execute()
                        )

                        # Generate embeddings (real OpenAI)
                        if is_embedding_available() and insert_result.data:
                            texts = [c["content"] for c in chunk_records]
                            embeddings = generate_embeddings(texts)
                            for row, emb in zip(insert_result.data, embeddings):
                                supabase.table("content_chunks").update(
                                    {"embedding": emb}
                                ).eq("id", row["id"]).execute()

                    # Update document status
                    supabase.table("documents").update({"status": "parsed"}).eq(
                        "id", doc["id"]
                    ).execute()
                    documents_parsed += 1

                except Exception as exc:
                    error_msg = f"Document {doc['id']} ({doc.get('file_name', 'unknown')}): {str(exc)}"
                    errors.append(error_msg)
                    logger.exception(
                        "Failed to parse document %s: %s", doc["id"], exc
                    )
                    supabase.table("documents").update({"status": "error"}).eq(
                        "id", doc["id"]
                    ).execute()
            elif doc["status"] == "parsed":
                documents_parsed += 1

        # Count total chunks for this session
        chunks_result = (
            supabase.table("content_chunks")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )
        total_chunks = chunks_result.count if chunks_result.count else 0

        if total_chunks == 0:
            raise HTTPException(
                status_code=400,
                detail="No content chunks could be extracted from the documents.",
            )

        # Build narrative graph (real LLM, no mock)
        logger.info("Building narrative graph for session %s", session_id)
        graph = build_narrative_graph(session_id)
        topics_count = len(graph.get("topics", []))
        logger.info("Narrative graph built: %d topics for session %s", topics_count, session_id)

        # Generate session cards (real LLM, no mock)
        logger.info("Generating session cards for session %s", session_id)
        cards = generate_session_cards(session_id, graph)
        cards_generated = len(cards)
        logger.info("Generated %d cards for session %s", cards_generated, session_id)

        # Update session status to ready
        supabase.table("sessions").update({"status": "ready"}).eq(
            "id", session_id
        ).execute()

        logger.info(
            "Session %s prepared: docs=%d, chunks=%d, topics=%d, cards=%d, errors=%d",
            session_id, documents_parsed, total_chunks, topics_count, cards_generated, len(errors),
        )

        return PrepareResponse(
            session_id=session_id,
            status="ready",
            documents_parsed=documents_parsed,
            total_chunks=total_chunks,
            topics_count=topics_count,
            cards_generated=cards_generated,
            errors=errors,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 400 errors)
        supabase.table("sessions").update({"status": "error"}).eq(
            "id", session_id
        ).execute()
        raise
    except Exception as exc:
        logger.exception("Session preparation failed for %s: %s", session_id, exc)
        supabase.table("sessions").update({"status": "error"}).eq(
            "id", session_id
        ).execute()
        raise HTTPException(
            status_code=500, detail=f"Session preparation failed: {str(exc)}"
        )


@router.get("/{session_id}/analytics", response_model=AnalyticsResponse)
async def get_session_analytics(
    session_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> AnalyticsResponse:
    """Compute analytics for a session from session_events."""
    user_id = _resolve_user_id(x_user_id)
    logger.info("Computing analytics for session=%s user=%s", session_id, user_id)

    _get_session_for_user(session_id, user_id)

    supabase = get_supabase()

    try:
        # Fetch all session events
        events_result = (
            supabase.table("session_events")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        events = events_result.data or []

        # Fetch total chunks for the session
        chunks_result = (
            supabase.table("content_chunks")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )
        total_chunks = chunks_result.count if chunks_result.count else 0

        # Fetch session cards
        cards_result = (
            supabase.table("session_cards")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        all_cards = cards_result.data or []
        total_cards = len(all_cards)

        # Compute duration from live_start / live_stop events
        duration_seconds = 0
        live_start_time = None
        for event in events:
            if event.get("event_type") == "live_start":
                live_start_time = event.get("created_at")
            elif event.get("event_type") == "live_stop" and live_start_time:
                try:
                    start_dt = datetime.fromisoformat(live_start_time.replace("Z", "+00:00"))
                    stop_dt = datetime.fromisoformat(event["created_at"].replace("Z", "+00:00"))
                    duration_seconds = int((stop_dt - start_dt).total_seconds())
                except (ValueError, TypeError):
                    pass

        # Compute match metrics
        total_events = len(events)
        match_events_list = [e for e in events if e.get("event_type") == "match"]
        match_events = len(match_events_list)
        match_hit_rate = round(match_events / total_events, 2) if total_events > 0 else 0.0

        # Extract matched chunk IDs and cards shown from match payloads
        matched_chunk_ids_set: set[str] = set()
        cards_shown_ids: set[str] = set()
        response_times: list[float] = []

        for event in match_events_list:
            payload = event.get("payload") or {}
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except (json.JSONDecodeError, TypeError):
                    payload = {}

            # Collect matched chunk IDs
            chunk_ids = payload.get("matched_chunk_ids", [])
            if isinstance(chunk_ids, list):
                matched_chunk_ids_set.update(str(cid) for cid in chunk_ids)

            # Collect card IDs shown
            card_ids = payload.get("card_ids", [])
            if isinstance(card_ids, list):
                cards_shown_ids.update(str(cid) for cid in card_ids)

            # Collect response time
            resp_ms = payload.get("response_ms")
            if resp_ms is not None:
                try:
                    response_times.append(float(resp_ms))
                except (ValueError, TypeError):
                    pass

        matched_chunk_ids = sorted(matched_chunk_ids_set)
        coverage_rate = round(len(matched_chunk_ids) / total_chunks, 2) if total_chunks > 0 else 0.0
        cards_shown = len(cards_shown_ids)
        avg_response_ms = round(sum(response_times) / len(response_times), 1) if response_times else 0.0

        # Extract topics from cards
        topics_covered: list[str] = []
        seen_topics: set[str] = set()
        for card in all_cards:
            title = card.get("title", "")
            if title and title not in seen_topics:
                seen_topics.add(title)
                topics_covered.append(title)

        return AnalyticsResponse(
            session_id=session_id,
            duration_seconds=duration_seconds,
            total_events=total_events,
            match_events=match_events,
            match_hit_rate=match_hit_rate,
            total_chunks=total_chunks,
            matched_chunk_ids=matched_chunk_ids,
            coverage_rate=coverage_rate,
            total_cards=total_cards,
            cards_shown=cards_shown,
            avg_response_ms=avg_response_ms,
            topics_covered=topics_covered,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to compute analytics for session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Failed to compute session analytics")


@router.post("/{session_id}/summary", response_model=SummaryResponse)
async def generate_session_summary(
    session_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> SummaryResponse:
    """Generate an LLM summary for a session and save it to the sessions table."""
    user_id = _resolve_user_id(x_user_id)
    logger.info("Generating summary for session=%s user=%s", session_id, user_id)

    session = _get_session_for_user(session_id, user_id)

    supabase = get_supabase()

    try:
        # Fetch match events
        events_result = (
            supabase.table("session_events")
            .select("*")
            .eq("session_id", session_id)
            .eq("event_type", "match")
            .order("created_at")
            .execute()
        )
        match_events = events_result.data or []

        # Fetch session cards
        cards_result = (
            supabase.table("session_cards")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        cards = cards_result.data or []

        # Build context for LLM
        events_summary = []
        for event in match_events:
            payload = event.get("payload") or {}
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except (json.JSONDecodeError, TypeError):
                    payload = {}
            events_summary.append({
                "timestamp": event.get("created_at"),
                "text_length": payload.get("text_length", 0),
                "chunks_matched": payload.get("chunks_matched", 0),
                "cards_returned": payload.get("cards_returned", 0),
            })

        cards_summary = []
        for card in cards:
            content = card.get("content", "")
            if isinstance(content, dict):
                content = content.get("text", content.get("summary", str(content)))
            cards_summary.append({
                "title": card.get("title", ""),
                "type": card.get("card_type", ""),
                "content": str(content)[:500],
            })

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a presentation coach. Given the session events and "
                    "cards from a live presentation session, write a concise summary "
                    "(3-5 paragraphs) covering: what topics were presented, how well "
                    "the presenter covered the material, engagement patterns, and "
                    "suggestions for improvement. Be constructive and specific."
                ),
            },
            {
                "role": "user",
                "content": json.dumps({
                    "session_title": session.get("title", ""),
                    "total_match_events": len(match_events),
                    "match_events_sample": events_summary[:20],
                    "cards": cards_summary,
                }),
            },
        ]

        summary_text = chat_completion(
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )

        # Save summary to sessions table via metadata jsonb
        existing_metadata = session.get("metadata") or {}
        if isinstance(existing_metadata, str):
            try:
                existing_metadata = json.loads(existing_metadata)
            except (json.JSONDecodeError, TypeError):
                existing_metadata = {}

        existing_metadata["summary"] = summary_text

        supabase.table("sessions").update(
            {"metadata": existing_metadata}
        ).eq("id", session_id).execute()

        logger.info("Summary generated and saved for session %s", session_id)
        return SummaryResponse(summary=summary_text)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to generate summary for session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to generate session summary: {str(exc)}")
