"""Match spoken text to content chunks using pgvector similarity search."""

import logging
from app.db.supabase import get_supabase
from app.services.embedding import generate_embeddings, is_embedding_available

logger = logging.getLogger(__name__)


def find_matching_chunks(text: str, session_id: str, top_k: int = 3) -> list[dict]:
    """Find the most relevant content chunks for the given speech text.

    Uses pgvector cosine similarity when embeddings are available,
    falls back to text-based search otherwise.
    """
    supabase = get_supabase()

    if is_embedding_available():
        # Generate embedding for the speech text
        embeddings = generate_embeddings([text])
        if embeddings and embeddings[0]:
            embedding = embeddings[0]
            # Use Supabase RPC for vector similarity search
            result = supabase.rpc(
                "match_chunks",
                {
                    "query_embedding": embedding,
                    "match_session_id": session_id,
                    "match_count": top_k,
                }
            ).execute()
            if result.data:
                return result.data

    # Fallback: simple text search using ilike
    logger.info("Using text-based fallback matching for session %s", session_id)
    words = text.lower().split()
    keywords = [w for w in words if len(w) > 3][:5]  # top 5 meaningful words

    if not keywords:
        return []

    # Search chunks that contain any keyword
    result = (
        supabase.table("content_chunks")
        .select("*")
        .eq("session_id", session_id)
        .or_(",".join(f"content.ilike.%{kw}%" for kw in keywords))
        .limit(top_k)
        .execute()
    )
    return result.data or []


def get_cards_for_position(session_id: str, chunk_ids: list[str]) -> list[dict]:
    """Get session cards related to the given content chunks."""
    supabase = get_supabase()

    if not chunk_ids:
        return []

    # Get cards for this session, ordered by relevance
    result = (
        supabase.table("session_cards")
        .select("*")
        .eq("session_id", session_id)
        .in_("chunk_id", chunk_ids)
        .execute()
    )
    cards = result.data or []

    # If no chunk-specific cards, return general session cards
    if not cards:
        result = (
            supabase.table("session_cards")
            .select("*")
            .eq("session_id", session_id)
            .limit(4)
            .execute()
        )
        cards = result.data or []

    return cards
