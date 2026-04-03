"""Voice command and display sync endpoints for the live presentation copilot."""

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db.supabase import get_supabase
from app.services.commands import detect_command, execute_command
from app.services.summarizer import generate_live_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["commands"])


# ── Voice Commands ──────────────────────────────────────


class CommandRequest(BaseModel):
    command_type: str
    context_text: str = ""
    current_topic: str | None = None


@router.post("/{session_id}/live/command")
async def run_command(session_id: str, body: CommandRequest):
    """Execute a voice command and return generated content."""
    logger.info("Command: session=%s, type=%s", session_id, body.command_type)

    result = execute_command(
        command_type=body.command_type,
        context_text=body.context_text,
        current_topic=body.current_topic,
        session_id=session_id,
    )

    # Auto-update display with the generated content
    try:
        supabase = get_supabase()
        session_result = (
            supabase.table("sessions")
            .select("metadata")
            .eq("id", session_id)
            .single()
            .execute()
        )
        metadata = (session_result.data or {}).get("metadata") or {}
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                metadata = {}

        metadata["display_content"] = {
            "type": result["content_type"],
            "data": result["content"],
            "title": result["title"],
        }
        metadata["last_command_at"] = datetime.now(timezone.utc).isoformat()

        # Handle next_topic navigation
        if result.get("next_heading"):
            metadata["current_heading"] = result["next_heading"]
        if result.get("next_chunk_index") is not None:
            metadata["current_slide"] = result["next_chunk_index"]

        supabase.table("sessions").update({"metadata": metadata}).eq("id", session_id).execute()
    except Exception as exc:
        logger.exception("Failed to update display after command: %s", exc)

    return result


class SlideAdvanceRequest(BaseModel):
    action: str  # "next_item" | "next_topic" | "goto_topic"
    topic_index: int | None = None


@router.post("/{session_id}/live/slide-advance")
async def slide_advance(session_id: str, body: SlideAdvanceRequest):
    """Manually advance the dynamic slide state."""
    from app.services.slides import advance_slide

    if body.action not in ("next_item", "next_topic", "goto_topic"):
        raise HTTPException(status_code=400, detail="Invalid action. Use: next_item, next_topic, goto_topic")

    try:
        result = advance_slide(session_id, body.action, body.topic_index)
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return {"status": "ok", "dynamic_slides": result}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Slide advance failed for %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Failed to advance slide")


class DetectRequest(BaseModel):
    text: str


@router.post("/{session_id}/live/detect-command")
async def detect_voice_command(session_id: str, body: DetectRequest):
    """Check if transcript text contains a voice command."""
    result = detect_command(body.text)
    if result:
        return {"detected": True, **result}
    return {"detected": False}


# ── Display Sync ──────────────────────────────────────


class DisplayUpdateRequest(BaseModel):
    display_content: dict | None = None
    active_cards: list[str] | None = None
    current_heading: str | None = None
    current_slide: int | None = None
    total_slides: int | None = None
    live_summary: str | None = None
    theme: str | None = None


@router.post("/{session_id}/live/display")
async def update_display(session_id: str, body: DisplayUpdateRequest):
    """Update presenter display state (called by control panel)."""
    supabase = get_supabase()

    try:
        session_result = (
            supabase.table("sessions")
            .select("metadata")
            .eq("id", session_id)
            .single()
            .execute()
        )
        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        metadata = session_result.data.get("metadata") or {}
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                metadata = {}

        # Update only provided fields
        update = body.model_dump(exclude_none=True)
        metadata.update(update)
        metadata["display_updated_at"] = datetime.now(timezone.utc).isoformat()

        supabase.table("sessions").update({"metadata": metadata}).eq("id", session_id).execute()

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Display update failed: %s", exc)
        raise HTTPException(status_code=500, detail="Display update failed")


@router.get("/{session_id}/live/display")
async def get_display(session_id: str):
    """Get current display state (polled by presenter display)."""
    supabase = get_supabase()

    try:
        session_result = (
            supabase.table("sessions")
            .select("status, metadata")
            .eq("id", session_id)
            .single()
            .execute()
        )
        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        metadata = session_result.data.get("metadata") or {}
        if isinstance(metadata, str):
            try:
                metadata = json.loads(metadata)
            except (json.JSONDecodeError, TypeError):
                metadata = {}

        # Get total slides count
        chunks = (
            supabase.table("content_chunks")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )

        # Extract dynamic slides — always include all_topics (briefing), current topic when live/ready
        dynamic_slides = metadata.get("dynamic_slides")
        dynamic_slide_view = None
        if dynamic_slides and dynamic_slides.get("topics"):
            topics = dynamic_slides["topics"]
            idx = dynamic_slides.get("current_topic_index", 0)
            session_status = session_result.data.get("status", "draft")

            all_topics = [
                {"id": t.get("id"), "title": t.get("title"), "status": t.get("status"), "item_count": len(t.get("items", []))}
                for t in topics
            ]

            current_topic = None
            if idx < len(topics) and session_status in ("live", "ready"):
                topic = topics[idx]
                current_topic = {
                    "id": topic.get("id"),
                    "title": topic.get("title"),
                    "items": topic.get("items", []),
                    "status": topic.get("status"),
                }

            dynamic_slide_view = {
                "current_topic_index": idx,
                "current_item_index": dynamic_slides.get("current_item_index", -1),
                "total_topics": len(topics),
                "topic": current_topic,
                "all_topics": all_topics,
            }

        return {
            "status": session_result.data.get("status", "draft"),
            "display_content": metadata.get("display_content"),
            "active_cards": metadata.get("current_cards", []),
            "current_heading": metadata.get("current_heading"),
            "current_slide": metadata.get("current_slide"),
            "total_slides": chunks.count or 0,
            "live_summary": metadata.get("live_summary"),
            "theme": metadata.get("theme", "dark"),
            "dynamic_slide": dynamic_slide_view,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Display fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Display fetch failed")


# ── Live Summary ──────────────────────────────────────


class SummarizeRequest(BaseModel):
    recent_transcripts: list[str]
    current_topic: str | None = None


@router.post("/{session_id}/live/summarize")
async def live_summarize(session_id: str, body: SummarizeRequest):
    """Generate a rolling summary and update display."""
    result = generate_live_summary(body.recent_transcripts, body.current_topic)

    # Update session metadata with summary
    if result.get("summary"):
        try:
            supabase = get_supabase()
            session_result = (
                supabase.table("sessions")
                .select("metadata")
                .eq("id", session_id)
                .single()
                .execute()
            )
            metadata = (session_result.data or {}).get("metadata") or {}
            if isinstance(metadata, str):
                try:
                    metadata = json.loads(metadata)
                except (json.JSONDecodeError, TypeError):
                    metadata = {}

            metadata["live_summary"] = result["summary"]
            supabase.table("sessions").update({"metadata": metadata}).eq("id", session_id).execute()
        except Exception as exc:
            logger.warning("Failed to update live summary: %s", exc)

    return result
