"""Embedding generation service.

Uses OpenAI text-embedding-3-small when an OPENAI_API_KEY is available.
Falls back to mock random embeddings otherwise.
"""

import logging
import random

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1536

_embedding_client: OpenAI | None = None


def _get_embedding_client() -> OpenAI | None:
    """Return a cached OpenAI client for embeddings, or None if no key."""
    global _embedding_client
    if not settings.OPENAI_API_KEY:
        return None
    if _embedding_client is None:
        _embedding_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _embedding_client


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts.

    If OPENAI_API_KEY is configured, uses OpenAI text-embedding-3-small.
    Otherwise returns mock random 1536-dimensional vectors with a warning.

    Args:
        texts: List of text strings to embed.

    Returns:
        List of embedding vectors (each a list of 1536 floats).
    """
    if not texts:
        return []

    client = _get_embedding_client()

    if client is None:
        logger.warning(
            "OPENAI_API_KEY not set. Returning mock embeddings for %d texts. "
            "Set OPENAI_API_KEY for real embeddings.",
            len(texts),
        )
        return _mock_embeddings(len(texts))

    logger.info("Generating embeddings for %d texts via OpenAI", len(texts))
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [item.embedding for item in response.data]


def _mock_embeddings(count: int) -> list[list[float]]:
    """Generate mock random embeddings for development/testing."""
    return [
        [random.uniform(-1.0, 1.0) for _ in range(EMBEDDING_DIM)]
        for _ in range(count)
    ]


def is_embedding_available() -> bool:
    """Check whether real embedding generation is available."""
    return bool(settings.OPENAI_API_KEY)
