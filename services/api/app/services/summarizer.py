"""Live summary service — generates rolling summaries of recent transcript."""

import logging

from app.services.llm import chat_completion_json, is_llm_available

logger = logging.getLogger(__name__)


def generate_live_summary(recent_transcripts: list[str], current_topic: str | None) -> dict:
    """Generate a brief summary of the last few minutes of transcript.

    Args:
        recent_transcripts: List of recent transcript texts.
        current_topic: Current topic heading.

    Returns:
        Dict with summary and key_points.
    """
    if not is_llm_available() or not recent_transcripts:
        return {"summary": "", "key_points": []}

    combined = " ".join(recent_transcripts)[:2000]

    try:
        result = chat_completion_json(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a live presentation summarizer. Create a brief, clear summary "
                        "of what was just discussed. Return JSON:\n"
                        '{"summary": "1-2 sentence summary", "key_points": ["point1", "point2"]}\n'
                        "Rules:\n"
                        "- Summary should be 1-2 sentences max\n"
                        "- Max 3 key points\n"
                        "- Focus on facts and conclusions, not filler\n"
                        "- Return ONLY valid JSON"
                    ),
                },
                {
                    "role": "user",
                    "content": f"Topic: {current_topic or 'General'}\n\nTranscript:\n{combined}",
                },
            ],
        )

        return {
            "summary": result.get("summary", ""),
            "key_points": result.get("key_points", [])[:3],
        }

    except Exception as exc:
        logger.warning("Live summary generation failed: %s", exc)
        return {"summary": "", "key_points": []}
