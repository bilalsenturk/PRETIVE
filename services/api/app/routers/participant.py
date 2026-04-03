"""Participant (read-only) endpoints for audience members.

No authentication required — participants access sessions via shared links."""

import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["participant"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ParticipantSessionResponse(BaseModel):
    id: str
    title: str
    status: str
    document_count: int


class ParticipantCardResponse(BaseModel):
    cards: list[dict]
    dynamic_slide: dict | None = None


class ParticipantStatusResponse(BaseModel):
    status: str
    current_heading: str | None = None
    last_match_at: str | None = None


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


def _parse_metadata(session: dict) -> dict:
    """Safely parse session metadata from string or dict."""
    metadata = session.get("metadata") or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except (json.JSONDecodeError, TypeError):
            metadata = {}
    return metadata


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{session_id}/participant", response_model=ParticipantSessionResponse)
async def get_participant_session(session_id: str) -> ParticipantSessionResponse:
    """Return session overview for a participant: title, status, document count."""
    logger.info("Participant view for session=%s", session_id)
    session = _get_session_or_404(session_id)

    # Count documents for this session
    try:
        supabase = get_supabase()
        docs_result = (
            supabase.table("documents")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )
        document_count = docs_result.count if docs_result.count else 0
    except Exception as exc:
        logger.exception("Failed to count documents for session %s: %s", session_id, exc)
        document_count = 0

    return ParticipantSessionResponse(
        id=session["id"],
        title=session["title"],
        status=session["status"],
        document_count=document_count,
    )


@router.get("/{session_id}/participant/cards", response_model=ParticipantCardResponse)
async def get_participant_cards(session_id: str) -> ParticipantCardResponse:
    """Return current active cards for the participant view.

    Reads the session metadata.current_cards list of card IDs and fetches
    those cards from session_cards.
    """
    logger.info("Participant cards for session=%s", session_id)
    session = _get_session_or_404(session_id)

    metadata = _parse_metadata(session)
    current_card_ids = metadata.get("current_cards", [])

    # Fetch cards if any active
    cards = []
    if current_card_ids:
        try:
            supabase = get_supabase()
            cards_result = (
                supabase.table("session_cards")
                .select("*")
                .in_("id", current_card_ids)
                .execute()
            )
            cards = cards_result.data or []
        except Exception as exc:
            logger.exception("Failed to fetch participant cards for session %s: %s", session_id, exc)
            # Non-fatal: continue with empty cards

    # Include dynamic slide if available (filtered: only revealed items)
    dynamic_slide = None
    dynamic_slides = metadata.get("dynamic_slides")
    if dynamic_slides and dynamic_slides.get("topics"):
        topics = dynamic_slides["topics"]
        idx = dynamic_slides.get("current_topic_index", 0)
        if idx < len(topics):
            topic = topics[idx]
            filtered_items = [
                {"text": item["text"], "revealed": True}
                for item in topic.get("items", [])
                if item.get("revealed")  # Only send revealed items to audience
            ]
            dynamic_slide = {
                "current_topic_index": idx,
                "total_topics": len(topics),
                "topic": {
                    "title": topic.get("title"),
                    "items": filtered_items,
                    "status": topic.get("status"),
                },
            }

    return ParticipantCardResponse(cards=cards, dynamic_slide=dynamic_slide)


@router.get("/{session_id}/participant/status", response_model=ParticipantStatusResponse)
async def get_participant_status(session_id: str) -> ParticipantStatusResponse:
    """Return current session status, heading, and last match time for participants."""
    logger.info("Participant status for session=%s", session_id)
    session = _get_session_or_404(session_id)

    metadata = _parse_metadata(session)

    return ParticipantStatusResponse(
        status=session["status"],
        current_heading=metadata.get("current_heading"),
        last_match_at=metadata.get("last_match_at"),
    )
