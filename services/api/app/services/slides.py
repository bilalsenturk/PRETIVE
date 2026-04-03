"""
Dynamic Slides Service

Generates progressive slide structures from narrative graphs.
Manages slide position tracking during live sessions.
"""

import json
import logging
from datetime import datetime, timezone

from app.db.supabase import get_supabase
from app.services.llm import chat_completion_json

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Generate dynamic slides from narrative graph
# ---------------------------------------------------------------------------

def generate_dynamic_slides(graph: dict, session_id: str) -> dict:
    """
    Convert a narrative graph into a dynamic slides structure.
    Each topic becomes a slide with progressive bullet items.
    Uses LLM to extract 3-7 key points per topic from source chunks.
    """
    topics = graph.get("topics", [])
    if not topics:
        logger.warning("No topics in narrative graph for session %s", session_id)
        return {"current_topic_index": 0, "current_item_index": -1, "topics": []}

    supabase = get_supabase()

    # Fetch all chunks for this session
    chunks_result = (
        supabase.table("content_chunks")
        .select("id, content, heading, chunk_index")
        .eq("session_id", session_id)
        .order("chunk_index")
        .execute()
    )
    chunks_by_id = {c["id"]: c for c in (chunks_result.data or [])}

    slide_topics = []

    for topic in topics:
        topic_id = topic.get("id", f"topic-{len(slide_topics)}")
        title = topic.get("title", "Untitled")
        summary = topic.get("summary", "")
        chunk_ids = topic.get("chunk_ids", [])
        children = topic.get("children", [])

        # Gather content from chunks
        topic_content_parts = []
        valid_chunk_ids = []
        for cid in chunk_ids:
            chunk = chunks_by_id.get(cid)
            if chunk:
                topic_content_parts.append(chunk.get("content", ""))
                valid_chunk_ids.append(cid)

        # Also include children chunk content
        for child in children:
            for cid in child.get("chunk_ids", []):
                chunk = chunks_by_id.get(cid)
                if chunk:
                    topic_content_parts.append(chunk.get("content", ""))
                    if cid not in valid_chunk_ids:
                        valid_chunk_ids.append(cid)

        combined_content = "\n".join(topic_content_parts)[:4000]

        if not combined_content.strip():
            # No content for this topic — create a title-only slide
            slide_topics.append({
                "id": topic_id,
                "title": title,
                "items": [],
                "status": "pending",
            })
            continue

        # LLM: extract key points
        try:
            items = _extract_items_via_llm(title, summary, combined_content, valid_chunk_ids)
        except Exception as exc:
            logger.exception("Failed to extract items for topic '%s': %s", title, exc)
            # Fallback: use topic summary as single item
            items = [{"text": summary, "revealed": False, "chunk_ids": valid_chunk_ids[:1]}]

        slide_topics.append({
            "id": topic_id,
            "title": title,
            "items": items,
            "status": "pending",
        })

    # Set first topic as active
    if slide_topics:
        slide_topics[0]["status"] = "active"

    result = {
        "current_topic_index": 0,
        "current_item_index": -1,
        "topics": slide_topics,
    }

    total_items = sum(len(t["items"]) for t in slide_topics)
    logger.info(
        "Generated dynamic slides for session %s: %d topics, %d total items",
        session_id, len(slide_topics), total_items,
    )
    return result


def _extract_items_via_llm(
    title: str, summary: str, content: str, chunk_ids: list[str]
) -> list[dict]:
    """Use LLM to extract 3-7 key bullet points from topic content."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a presentation structuring assistant. Given a topic title, "
                "summary, and source content, extract 3-7 key bullet points that a "
                "presenter would cover when teaching this topic. Each bullet should be "
                "a single concise sentence (max 15 words). Return JSON:\n"
                '{"items": ["bullet 1", "bullet 2", ...]}'
            ),
        },
        {
            "role": "user",
            "content": json.dumps({
                "title": title,
                "summary": summary,
                "content": content[:3000],
            }),
        },
    ]

    result = chat_completion_json(messages)
    raw_items = result.get("items", [])

    # Build item list with chunk_id distribution
    items = []
    for i, text in enumerate(raw_items[:7]):
        if not isinstance(text, str) or not text.strip():
            continue
        # Assign chunk_ids round-robin style
        assigned_chunks = []
        if chunk_ids:
            assigned_chunks = [chunk_ids[i % len(chunk_ids)]]
        items.append({
            "text": text.strip(),
            "revealed": False,
            "chunk_ids": assigned_chunks,
        })

    return items if items else [{"text": summary or title, "revealed": False, "chunk_ids": chunk_ids[:1]}]


# ---------------------------------------------------------------------------
# 2. Update slide position based on matched chunks (automatic reveal)
# ---------------------------------------------------------------------------

def update_slide_position(session_id: str, matched_chunk_ids: list[str]) -> dict | None:
    """
    Given matched chunk IDs from the live matching pipeline,
    check if any correspond to items in the current dynamic slide.
    If so, reveal those items (and all items before them).
    Returns updated dynamic_slides dict, or None if no slides exist.
    """
    if not matched_chunk_ids:
        return None

    supabase = get_supabase()
    session = supabase.table("sessions").select("metadata").eq("id", session_id).single().execute()
    metadata = (session.data or {}).get("metadata") or {}
    if isinstance(metadata, str):
        metadata = json.loads(metadata) if metadata else {}

    slides = metadata.get("dynamic_slides")
    if not slides or not slides.get("topics"):
        return None

    topics = slides["topics"]
    current_idx = slides.get("current_topic_index", 0)

    if current_idx >= len(topics):
        return None

    current_topic = topics[current_idx]
    changed = False

    # Check current topic items for chunk matches
    matched_item_index = -1
    for i, item in enumerate(current_topic.get("items", [])):
        item_chunks = item.get("chunk_ids", [])
        if any(cid in matched_chunk_ids for cid in item_chunks):
            matched_item_index = max(matched_item_index, i)

    if matched_item_index >= 0:
        # Reveal all items up to and including the matched one
        for i in range(matched_item_index + 1):
            if not current_topic["items"][i].get("revealed"):
                current_topic["items"][i]["revealed"] = True
                changed = True
        slides["current_item_index"] = max(
            slides.get("current_item_index", -1), matched_item_index
        )

    # Check if match is in a different (later) topic
    if matched_item_index < 0:
        for t_idx in range(current_idx + 1, len(topics)):
            topic = topics[t_idx]
            for item in topic.get("items", []):
                if any(cid in matched_chunk_ids for cid in item.get("chunk_ids", [])):
                    # Speaker jumped to a later topic — auto-advance
                    _complete_topic(topics[current_idx])
                    for skip_idx in range(current_idx + 1, t_idx):
                        _complete_topic(topics[skip_idx])
                    topics[t_idx]["status"] = "active"
                    slides["current_topic_index"] = t_idx
                    slides["current_item_index"] = -1
                    changed = True
                    break
            if changed:
                break

    if changed:
        metadata["dynamic_slides"] = slides
        supabase.table("sessions").update({"metadata": metadata}).eq("id", session_id).execute()
        logger.info("Slide position updated for session %s: topic=%d, item=%d",
                     session_id, slides["current_topic_index"], slides.get("current_item_index", -1))

    return slides


# ---------------------------------------------------------------------------
# 3. Manual slide advance (next_item, next_topic, goto_topic)
# ---------------------------------------------------------------------------

def advance_slide(session_id: str, action: str, topic_index: int | None = None) -> dict:
    """
    Manually advance the dynamic slide state.
    Actions: next_item, next_topic, goto_topic
    Returns updated dynamic_slides dict.
    """
    supabase = get_supabase()
    session = supabase.table("sessions").select("metadata").eq("id", session_id).single().execute()
    metadata = (session.data or {}).get("metadata") or {}
    if isinstance(metadata, str):
        metadata = json.loads(metadata) if metadata else {}

    slides = metadata.get("dynamic_slides")
    if not slides or not slides.get("topics"):
        return {"error": "No dynamic slides found"}

    topics = slides["topics"]
    current_idx = slides.get("current_topic_index", 0)

    if action == "next_item":
        if current_idx < len(topics):
            topic = topics[current_idx]
            items = topic.get("items", [])
            next_item = slides.get("current_item_index", -1) + 1
            if next_item < len(items):
                items[next_item]["revealed"] = True
                slides["current_item_index"] = next_item
                logger.info("Advanced to item %d in topic %d for session %s",
                           next_item, current_idx, session_id)
            else:
                # All items revealed — auto-advance to next topic
                return advance_slide(session_id, "next_topic")

    elif action == "next_topic":
        if current_idx < len(topics):
            _complete_topic(topics[current_idx])
        next_topic_idx = current_idx + 1
        if next_topic_idx < len(topics):
            topics[next_topic_idx]["status"] = "active"
            slides["current_topic_index"] = next_topic_idx
            slides["current_item_index"] = -1
            logger.info("Advanced to topic %d for session %s", next_topic_idx, session_id)
        else:
            logger.info("All topics completed for session %s", session_id)

    elif action == "goto_topic" and topic_index is not None:
        if 0 <= topic_index < len(topics):
            # Complete current topic
            if current_idx < len(topics):
                _complete_topic(topics[current_idx])
            topics[topic_index]["status"] = "active"
            # Reset items to unrevealed
            for item in topics[topic_index].get("items", []):
                item["revealed"] = False
            slides["current_topic_index"] = topic_index
            slides["current_item_index"] = -1
            logger.info("Jumped to topic %d for session %s", topic_index, session_id)

    metadata["dynamic_slides"] = slides
    supabase.table("sessions").update({"metadata": metadata}).eq("id", session_id).execute()
    return slides


def _complete_topic(topic: dict) -> None:
    """Mark a topic and all its items as completed/revealed."""
    topic["status"] = "completed"
    for item in topic.get("items", []):
        item["revealed"] = True
