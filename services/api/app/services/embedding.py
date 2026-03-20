"""Embedding generation service.

Uses Moonshot (via LLM_BASE_URL) or OpenAI for embeddings. No mock data.
"""

import logging
import time

from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1536
_MAX_BATCH_SIZE = 50
_MAX_CHAR_LENGTH = 32000  # ~8000 tokens approximation

_embedding_client: OpenAI | None = None


def _get_embedding_client() -> OpenAI:
    """Return a cached OpenAI-compatible client for embeddings.

    Uses OpenAI if OPENAI_API_KEY is set, otherwise uses LLM provider (Moonshot).

    Raises:
        RuntimeError: If no API key is configured.
    """
    global _embedding_client
    if _embedding_client is None:
        if settings.OPENAI_API_KEY:
            logger.info("Embedding client: OpenAI")
            _embedding_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        elif settings.LLM_API_KEY and settings.LLM_BASE_URL:
            logger.info("Embedding client: %s", settings.LLM_BASE_URL)
            _embedding_client = OpenAI(
                api_key=settings.LLM_API_KEY,
                base_url=settings.LLM_BASE_URL,
            )
        else:
            raise RuntimeError(
                "No embedding provider configured. Set OPENAI_API_KEY or LLM_API_KEY + LLM_BASE_URL."
            )
    return _embedding_client


def _get_embedding_model() -> str:
    """Return the embedding model to use."""
    if settings.OPENAI_API_KEY:
        return "text-embedding-3-small"
    return settings.EMBEDDING_MODEL


def _truncate_text(text: str) -> str:
    """Truncate text to approximate 8000 token limit."""
    if len(text) > _MAX_CHAR_LENGTH:
        return text[:_MAX_CHAR_LENGTH]
    return text


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
def _call_embeddings_api(client: OpenAI, model: str, batch: list[str]) -> list[list[float]]:
    """Call embeddings API with retry logic."""
    response = client.embeddings.create(
        model=model,
        input=batch,
    )
    return [item.embedding for item in response.data]


def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts.

    Uses OpenAI text-embedding-3-small or Moonshot embedding model.

    Args:
        texts: List of text strings to embed.

    Returns:
        List of embedding vectors.

    Raises:
        RuntimeError: If no embedding provider is configured.
        ValueError: If texts is not a list of strings.
        Exception: If the API call fails after retries.
    """
    if not texts:
        return []

    if not isinstance(texts, list) or not all(isinstance(t, str) for t in texts):
        raise ValueError("texts must be a list of strings")

    client = _get_embedding_client()
    model = _get_embedding_model()

    # Truncate long texts
    truncated_texts = []
    for t in texts:
        truncated = _truncate_text(t)
        if len(truncated) < len(t):
            logger.warning(
                "Text truncated from %d to %d chars for embedding",
                len(t),
                len(truncated),
            )
        truncated_texts.append(truncated)

    total_chars = sum(len(t) for t in truncated_texts)
    logger.info(
        "Generating embeddings for %d texts (%d total chars) via %s",
        len(truncated_texts),
        total_chars,
        model,
    )

    all_embeddings: list[list[float]] = []
    start_time = time.time()

    # Process in batches
    for i in range(0, len(truncated_texts), _MAX_BATCH_SIZE):
        batch = truncated_texts[i : i + _MAX_BATCH_SIZE]
        batch_embeddings = _call_embeddings_api(client, model, batch)
        all_embeddings.extend(batch_embeddings)

    elapsed = time.time() - start_time
    logger.info(
        "Embeddings generated: %d vectors in %.2fs via %s",
        len(all_embeddings),
        elapsed,
        model,
    )

    return all_embeddings


def is_embedding_available() -> bool:
    """Check whether real embedding generation is available."""
    return bool(settings.OPENAI_API_KEY) or bool(settings.LLM_API_KEY and settings.LLM_BASE_URL)
