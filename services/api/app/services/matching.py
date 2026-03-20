"""Match spoken text to content chunks using pgvector similarity search.

Primary: pgvector cosine similarity (requires embeddings).
Fallback: text-based keyword search with WARNING log.
"""

import logging
from functools import lru_cache

from app.db.supabase import get_supabase
from app.services.embedding import generate_embeddings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=100)
def _cached_embedding(text: str) -> tuple[float, ...]:
    """Generate and cache an embedding for a query text.

    Returns a tuple (hashable for lru_cache) of floats.
    """
    embeddings = generate_embeddings([text])
    if not embeddings or not embeddings[0]:
        raise ValueError("Failed to generate embedding for query text")
    return tuple(embeddings[0])


def find_matching_chunks(text: str, session_id: str, top_k: int = 3) -> list[dict]:
    """Find the most relevant content chunks for the given speech text.

    Primary: pgvector cosine similarity search.
    Fallback: keyword-based text search (with WARNING).

    Args:
        text: The query text to match against.
        session_id: The session to search within.
        top_k: Number of top results to return.

    Returns:
        List of matching chunk dicts.

    Raises:
        ValueError: If text or session_id is empty.
    """
    if not text or not text.strip():
        raise ValueError("text is required for matching")
    if not session_id or not session_id.strip():
        raise ValueError("session_id is required for matching")
    if top_k < 1:
        raise ValueError("top_k must be at least 1")

    supabase = get_supabase()

    # Primary: vector search
    try:
        embedding = list(_cached_embedding(text))
        result = supabase.rpc(
            "match_chunks",
            {
                "query_embedding": embedding,
                "match_session_id": session_id,
                "match_count": top_k,
            },
        ).execute()
        if result.data:
            logger.info(
                "Vector search matched %d chunks for session %s",
                len(result.data),
                session_id,
            )
            return result.data
    except Exception as exc:
        logger.warning(
            "Vector search failed for session %s: %s. Falling back to text search.",
            session_id,
            exc,
        )

    # Fallback: text-based keyword search
    logger.warning(
        "Using text-based fallback matching for session %s", session_id
    )
    words = text.lower().split()
    keywords = [w for w in words if len(w) > 2][:5]  # min length 2

    if not keywords:
        logger.warning("No usable keywords extracted from query text")
        return []

    result = (
        supabase.table("content_chunks")
        .select("*")
        .eq("session_id", session_id)
        .or_(",".join(f"content.ilike.%{kw}%" for kw in keywords))
        .limit(top_k)
        .execute()
    )
    matched = result.data or []
    logger.info(
        "Text search matched %d chunks for session %s", len(matched), session_id
    )
    return matched


def get_cards_for_position(session_id: str, chunk_ids: list[str]) -> list[dict]:
    """Get session cards related to the matched content.

    Strategy:
    1. Try chunk-specific cards first (chunk_id IN chunk_ids).
    2. Fallback: get ALL session cards sorted by display_order, limit 4.
    3. Never return empty if session has cards.

    Args:
        session_id: The session to get cards from.
        chunk_ids: List of chunk IDs to match against.

    Returns:
        List of card dicts.

    Raises:
        ValueError: If session_id is empty.
    """
    if not session_id or not session_id.strip():
        raise ValueError("session_id is required")

    supabase = get_supabase()

    # First try chunk-specific cards
    if chunk_ids:
        try:
            result = (
                supabase.table("session_cards")
                .select("*")
                .eq("session_id", session_id)
                .in_("chunk_id", chunk_ids)
                .execute()
            )
            if result.data:
                logger.info(
                    "Found %d chunk-specific cards for session %s",
                    len(result.data),
                    session_id,
                )
                return result.data
        except Exception as exc:
            logger.warning(
                "Chunk-specific card lookup failed for session %s: %s",
                session_id,
                exc,
            )

    # Fallback: return session cards sorted by display_order
    result = (
        supabase.table("session_cards")
        .select("*")
        .eq("session_id", session_id)
        .order("display_order")
        .limit(4)
        .execute()
    )
    cards = result.data or []
    if cards:
        logger.info(
            "Returning %d fallback cards for session %s", len(cards), session_id
        )
    else:
        logger.warning("No cards found at all for session %s", session_id)
    return cards
