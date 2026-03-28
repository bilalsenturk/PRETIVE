"""Semantic Prompter — LLM-powered transition sentences, key reminders, and structure hints.

Enhances the live match response with intelligent presentation guidance:
- Transition sentences when topic changes are detected
- Key reminders from upcoming content
- Structure preservation hints (pacing/coverage)
"""

import logging
from app.services.llm import chat_completion_json, is_llm_available

logger = logging.getLogger(__name__)

# Session-level cache: tracks the last topic we generated guidance for
_last_prompted_topic: dict[str, str | None] = {}


_SYSTEM_PROMPT = """You are Pretive's Semantic Prompter — an AI assistant helping a live presenter.

Your job is to generate:
1. A natural transition sentence from the current topic to the next topic
2. Key reminders (important points) from upcoming content
3. A structure hint about pacing

Respond in JSON format:
{
  "transition_sentence": "A natural, conversational sentence to bridge from the current topic to the next. null if not applicable.",
  "key_reminders": [
    {"point": "A key point to remember", "source_topic": "Topic name"}
  ],
  "structure_hint": {
    "type": "on_track | ahead | behind",
    "message": "Brief pacing guidance"
  }
}

Rules:
- Transition sentences should be natural and professional, not robotic
- Maximum 3 key reminders from the next 1-2 upcoming topics
- Structure hint should consider elapsed time vs remaining topics
- If there is no next topic, set transition_sentence to null
- Keep all text concise (under 30 words each)
- Respond ONLY with valid JSON, no markdown"""


def _compute_structure_type(
    elapsed_seconds: int,
    total_topics: int,
    covered_count: int,
) -> str:
    """Determine pacing status based on elapsed time and coverage."""
    if total_topics == 0:
        return "on_track"

    progress_ratio = covered_count / total_topics
    # Assume ~30 min average session
    expected_progress = min(elapsed_seconds / (30 * 60), 1.0)

    if progress_ratio > expected_progress + 0.15:
        return "ahead"
    elif progress_ratio < expected_progress - 0.15:
        return "behind"
    return "on_track"


def generate_prompter_guidance(
    current_topic: str | None,
    next_topic: str | None,
    covered_topics: list[str],
    uncovered_topics: list[str],
    elapsed_seconds: int,
    total_topics: int,
    context_chunks: list[dict],
    session_id: str = "",
) -> dict:
    """Generate semantic prompter guidance using LLM.

    Only fires when a topic change is detected (compared to last call
    for the same session). Returns empty dict when topic hasn't changed.

    Args:
        current_topic: Currently discussed topic heading.
        next_topic: Next uncovered topic heading.
        covered_topics: List of already-covered topic names.
        uncovered_topics: List of uncovered topic names.
        elapsed_seconds: Seconds since session start.
        total_topics: Total number of topics in the session.
        context_chunks: Content chunks for next topic context.
        session_id: Used for caching to avoid duplicate LLM calls.

    Returns:
        Dict with transition_sentence, key_reminders, structure_hint.
        Empty dict if topic hasn't changed or LLM is unavailable.
    """
    if not is_llm_available():
        logger.debug("LLM not available — skipping prompter")
        return {}

    # Check if topic has changed since last prompt
    last_topic = _last_prompted_topic.get(session_id)
    if current_topic == last_topic and current_topic is not None:
        # Topic hasn't changed — return structure hint only (no LLM call)
        structure_type = _compute_structure_type(
            elapsed_seconds, total_topics, len(covered_topics)
        )
        return {
            "transition_sentence": None,
            "key_reminders": [],
            "structure_hint": {
                "type": structure_type,
                "message": _structure_message(
                    structure_type, len(uncovered_topics), elapsed_seconds
                ),
            },
        }

    # Update cache
    _last_prompted_topic[session_id] = current_topic

    # Build context for LLM
    next_content_preview = ""
    if context_chunks:
        next_content_preview = " ".join(
            c.get("content", "")[:200] for c in context_chunks[:3]
        )[:500]

    user_message = (
        f"Current topic: {current_topic or 'Unknown'}\n"
        f"Next topic: {next_topic or 'None remaining'}\n"
        f"Covered topics ({len(covered_topics)}): {', '.join(covered_topics[:10]) or 'None'}\n"
        f"Uncovered topics ({len(uncovered_topics)}): {', '.join(uncovered_topics[:10]) or 'None'}\n"
        f"Elapsed time: {elapsed_seconds // 60} minutes {elapsed_seconds % 60} seconds\n"
        f"Total topics: {total_topics}\n"
        f"Next topic preview: {next_content_preview or 'N/A'}"
    )

    try:
        result = chat_completion_json(
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )

        # Validate and normalize the response
        return _normalize_response(result, elapsed_seconds, total_topics, covered_topics, uncovered_topics)

    except Exception as exc:
        logger.warning("Prompter LLM call failed: %s", exc)
        # Return a basic structure hint as fallback
        structure_type = _compute_structure_type(
            elapsed_seconds, total_topics, len(covered_topics)
        )
        return {
            "transition_sentence": None,
            "key_reminders": [],
            "structure_hint": {
                "type": structure_type,
                "message": _structure_message(
                    structure_type, len(uncovered_topics), elapsed_seconds
                ),
            },
        }


def _normalize_response(
    raw: dict,
    elapsed_seconds: int,
    total_topics: int,
    covered_topics: list[str],
    uncovered_topics: list[str],
) -> dict:
    """Validate and normalize the LLM response."""
    transition = raw.get("transition_sentence")
    if isinstance(transition, str) and len(transition.strip()) == 0:
        transition = None

    reminders = raw.get("key_reminders", [])
    if not isinstance(reminders, list):
        reminders = []
    # Limit to 3 reminders and validate structure
    valid_reminders = []
    for r in reminders[:3]:
        if isinstance(r, dict) and "point" in r:
            valid_reminders.append({
                "point": str(r["point"])[:200],
                "source_topic": str(r.get("source_topic", ""))[:100],
            })

    hint = raw.get("structure_hint", {})
    if not isinstance(hint, dict) or "type" not in hint:
        structure_type = _compute_structure_type(
            elapsed_seconds, total_topics, len(covered_topics)
        )
        hint = {
            "type": structure_type,
            "message": _structure_message(
                structure_type, len(uncovered_topics), elapsed_seconds
            ),
        }
    else:
        # Validate type value
        if hint["type"] not in ("on_track", "ahead", "behind"):
            hint["type"] = "on_track"
        hint["message"] = str(hint.get("message", ""))[:200]

    return {
        "transition_sentence": transition,
        "key_reminders": valid_reminders,
        "structure_hint": hint,
    }


def _structure_message(
    structure_type: str, uncovered_count: int, elapsed_seconds: int
) -> str:
    """Generate a human-readable structure hint message."""
    minutes = elapsed_seconds // 60
    if structure_type == "ahead":
        return f"Good pace — {uncovered_count} topics remaining at {minutes} min. You can slow down if needed."
    elif structure_type == "behind":
        return f"{uncovered_count} topics still to cover at {minutes} min. Consider picking up the pace."
    else:
        return f"On track — {uncovered_count} topics remaining at {minutes} min."


def clear_session_cache(session_id: str) -> None:
    """Clear the prompter cache for a session (called on session stop)."""
    _last_prompted_topic.pop(session_id, None)
