"""Smart suggestions based on narrative graph coverage.

Analyzes session progress (which topics have been covered, which are skipped)
and generates actionable suggestions for the presenter.
"""

import logging

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}
_MAX_SUGGESTIONS = 3
_TIME_WARNING_THRESHOLD = 15 * 60  # 15 minutes in seconds
_UNCOVERED_THRESHOLD = 2  # min uncovered topics to trigger time warning


def get_suggestions(
    session_id: str,
    current_chunk_index: int | None,
    elapsed_seconds: int,
) -> list[dict]:
    """Generate smart suggestions based on narrative graph coverage.

    Args:
        session_id: The active session ID.
        current_chunk_index: Index of the chunk currently being discussed,
            or None if unknown.
        elapsed_seconds: Seconds elapsed since session start.

    Returns:
        List of suggestion dicts (max 3), each with:
            {
                "type": "skipped_topic" | "transition" | "time_warning" | "coverage",
                "title": str,
                "message": str,
                "priority": "low" | "medium" | "high"
            }
    """
    if not session_id or not session_id.strip():
        raise ValueError("session_id is required")

    supabase = get_supabase()

    # ── Fetch all content chunks for the session ────────────────
    chunks_result = (
        supabase.table("content_chunks")
        .select("id, chunk_index, heading, content")
        .eq("session_id", session_id)
        .order("chunk_index")
        .execute()
    )
    chunks = chunks_result.data or []

    if not chunks:
        logger.info("No content chunks for session %s — no suggestions", session_id)
        return []

    # ── Fetch match events to find covered chunks ───────────────
    events_result = (
        supabase.table("session_events")
        .select("chunk_id")
        .eq("session_id", session_id)
        .eq("event_type", "match")
        .execute()
    )
    events = events_result.data or []
    covered_chunk_ids = {e["chunk_id"] for e in events if e.get("chunk_id")}

    # ── Build topic map (heading → chunk indices) ───────────────
    all_topics: list[str] = []
    topic_indices: dict[str, list[int]] = {}
    for chunk in chunks:
        heading = chunk.get("heading") or "Untitled"
        if heading not in topic_indices:
            all_topics.append(heading)
            topic_indices[heading] = []
        topic_indices[heading].append(chunk.get("chunk_index", 0))

    # Determine which topics have been covered
    covered_topics: set[str] = set()
    for chunk in chunks:
        if chunk["id"] in covered_chunk_ids:
            heading = chunk.get("heading") or "Untitled"
            covered_topics.add(heading)

    uncovered_topics = [t for t in all_topics if t not in covered_topics]

    # ── Generate suggestions ────────────────────────────────────
    suggestions: list[dict] = []

    # 1. Skipped topics — topics before the current position that were missed
    if current_chunk_index is not None:
        for topic in all_topics:
            indices = topic_indices[topic]
            max_index = max(indices)
            if max_index < current_chunk_index and topic not in covered_topics:
                suggestions.append({
                    "type": "skipped_topic",
                    "title": f"Skipped: {topic}",
                    "message": (
                        f"You moved past \"{topic}\" without covering it. "
                        "Consider circling back if it's important."
                    ),
                    "priority": "medium",
                })

    # 2. Time warning — running long with uncovered material
    if (
        elapsed_seconds > _TIME_WARNING_THRESHOLD
        and len(uncovered_topics) > _UNCOVERED_THRESHOLD
    ):
        minutes = elapsed_seconds // 60
        suggestions.append({
            "type": "time_warning",
            "title": "Running long",
            "message": (
                f"{minutes} minutes elapsed with {len(uncovered_topics)} "
                "topics still uncovered. Consider picking up the pace."
            ),
            "priority": "high",
        })

    # 3. Transition hint — suggest what to cover next
    if uncovered_topics and current_chunk_index is not None:
        # Find the next uncovered topic after the current position
        next_topic = None
        for topic in all_topics:
            if topic in covered_topics:
                continue
            indices = topic_indices[topic]
            min_index = min(indices)
            if min_index > current_chunk_index:
                next_topic = topic
                break

        if next_topic:
            suggestions.append({
                "type": "transition",
                "title": f"Up next: {next_topic}",
                "message": (
                    f"Good moment to transition into \"{next_topic}\"."
                ),
                "priority": "low",
            })

    # 4. Full coverage congratulation
    if not uncovered_topics and len(all_topics) > 0:
        suggestions.append({
            "type": "coverage",
            "title": "Full coverage",
            "message": (
                f"All {len(all_topics)} topics covered. "
                "Great job hitting every point!"
            ),
            "priority": "low",
        })

    # Sort by priority and return top N
    suggestions.sort(key=lambda s: _PRIORITY_ORDER.get(s["priority"], 9))
    return suggestions[:_MAX_SUGGESTIONS]
