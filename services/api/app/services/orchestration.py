"""Screen Intelligence — Card orchestration, scoring, and queue management.

Pure computation service (no LLM calls). Scores cards based on relevance,
freshness, type priority, and time decay. Manages a display queue with
auto-advance support.
"""

import logging
import time

logger = logging.getLogger(__name__)

# Card type priority bonuses
_TYPE_BONUS = {
    "context_bridge": 0.10,
    "fact_check": 0.10,
    "comparison": 0.05,
    "concept": 0.03,
    "summary": 0.0,
}

_FRESHNESS_BONUS = 0.20
_MAX_ACTIVE_CARDS = 3
_MIN_DISPLAY_SECONDS = 15
_MAX_DISPLAY_SECONDS = 45
_CONTENT_CHARS_PER_SECOND = 10  # reading speed factor


def score_cards(
    cards: list[dict],
    current_chunk_index: int | None,
    elapsed_seconds: int,
    shown_card_ids: list[str],
    shown_timestamps: dict[str, float] | None = None,
) -> list[dict]:
    """Score and rank cards for display priority.

    Args:
        cards: List of card dicts from the session.
        current_chunk_index: Currently active chunk index.
        elapsed_seconds: Seconds since session start.
        shown_card_ids: IDs of cards already shown to the presenter.
        shown_timestamps: Optional dict of card_id -> timestamp when shown.

    Returns:
        Cards sorted by score descending, each with _score and _display_duration added.
    """
    if not cards:
        return []

    now = time.time()
    scored = []

    for card in cards:
        score = 0.5  # base score

        # 1. Relevance: distance from current position
        if current_chunk_index is not None:
            card_chunk_id = card.get("chunk_id")
            card_order = card.get("display_order", 0)
            # Use display_order as a proxy for position if chunk_index isn't available
            distance = abs(card_order - current_chunk_index)
            relevance = max(0, 1.0 - (distance * 0.1))
            score += relevance * 0.3

        # 2. Freshness: bonus for unseen cards
        card_id = card.get("id", "")
        if card_id not in shown_card_ids:
            score += _FRESHNESS_BONUS

        # 3. Type priority
        card_type = card.get("card_type", "summary")
        score += _TYPE_BONUS.get(card_type, 0.0)

        # 4. Time decay: cards shown long ago get partial re-eligibility
        if shown_timestamps and card_id in shown_timestamps:
            age = now - shown_timestamps[card_id]
            if age > 120:  # 2 minutes ago
                score += 0.05  # small re-display bonus

        # Calculate display duration based on content length
        content = card.get("content", "")
        if isinstance(content, dict):
            content_text = content.get("text", "") or content.get("summary", "")
        elif isinstance(content, str):
            content_text = content
        else:
            content_text = ""
        content_len = len(str(content_text))
        display_duration = max(
            _MIN_DISPLAY_SECONDS,
            min(_MAX_DISPLAY_SECONDS, content_len // _CONTENT_CHARS_PER_SECOND),
        )

        scored.append({
            **card,
            "_score": round(score, 3),
            "_display_duration": display_duration,
        })

    scored.sort(key=lambda c: c["_score"], reverse=True)
    return scored


def build_card_queue(
    all_session_cards: list[dict],
    active_card_ids: list[str],
    dismissed_card_ids: list[str],
    current_chunk_index: int | None = None,
    elapsed_seconds: int = 0,
    shown_card_ids: list[str] | None = None,
) -> dict:
    """Build a prioritized card queue from all session cards.

    Args:
        all_session_cards: All cards for the session.
        active_card_ids: Currently displayed card IDs.
        dismissed_card_ids: IDs of cards dismissed by the presenter.
        current_chunk_index: Current position in the presentation.
        elapsed_seconds: Seconds since session start.
        shown_card_ids: IDs of all cards shown so far.

    Returns:
        Dict with active (max 3), queued, and dismissed_count.
    """
    if not all_session_cards:
        return {"active": [], "queued": [], "dismissed_count": 0}

    # Filter out dismissed cards
    eligible = [
        c for c in all_session_cards
        if c.get("id", "") not in dismissed_card_ids
    ]

    # Score all eligible cards
    scored = score_cards(
        eligible,
        current_chunk_index,
        elapsed_seconds,
        shown_card_ids or [],
    )

    # Split into active and queued
    active = []
    queued = []

    for card in scored:
        card_id = card.get("id", "")
        if card_id in active_card_ids and len(active) < _MAX_ACTIVE_CARDS:
            active.append(card)
        elif len(active) < _MAX_ACTIVE_CARDS and card_id not in active_card_ids:
            active.append(card)
        else:
            queued.append(card)

    return {
        "active": active[:_MAX_ACTIVE_CARDS],
        "queued": queued,
        "dismissed_count": len(dismissed_card_ids),
    }
