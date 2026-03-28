"""Google Meet integration endpoints — lightweight session context for side panel."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meet", tags=["meet"])


class MeetContextRequest(BaseModel):
    session_id: str
    meeting_id: str
    participant_name: str | None = None


@router.post("/context")
async def set_meet_context(body: MeetContextRequest):
    """Store meeting context for a session."""
    supabase = get_supabase()

    try:
        # Update session metadata with Meet context
        session_result = (
            supabase.table("sessions")
            .select("metadata")
            .eq("id", body.session_id)
            .single()
            .execute()
        )
        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        metadata = session_result.data.get("metadata") or {}
        if isinstance(metadata, str):
            import json
            try:
                metadata = json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                metadata = {}

        metadata["meet_meeting_id"] = body.meeting_id
        metadata["meet_participant"] = body.participant_name

        supabase.table("sessions").update({
            "metadata": metadata,
        }).eq("id", body.session_id).execute()

        return {"status": "ok", "session_id": body.session_id}

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to set Meet context: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to set meeting context")


@router.get("/sessions/{session_id}/compact")
async def compact_session_data(session_id: str):
    """Return compact session data optimized for the Meet side panel."""
    supabase = get_supabase()

    try:
        # Get session
        session = (
            supabase.table("sessions")
            .select("id, title, status, metadata")
            .eq("id", session_id)
            .single()
            .execute()
        )
        if not session.data:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get card count
        cards = (
            supabase.table("session_cards")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )

        # Get slide count
        chunks = (
            supabase.table("content_chunks")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )

        return {
            "session": session.data,
            "card_count": cards.count or 0,
            "slide_count": chunks.count or 0,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to get compact session data: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to get session data")
