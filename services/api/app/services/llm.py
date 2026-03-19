"""Simple LLM client wrapper using the OpenAI SDK.

Supports Kimi K2.5 via OpenRouter, Moonshot, or direct OpenAI.
Falls back gracefully when no API key is configured.
"""

import json
import logging

from openai import OpenAI

from app.config import settings

logger = logging.getLogger(__name__)

_client: OpenAI | None = None


def _get_client() -> OpenAI | None:
    """Return a cached OpenAI-compatible client, or None if no key is set."""
    global _client
    if not settings.LLM_API_KEY:
        return None
    if _client is None:
        _client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
        )
    return _client


def chat_completion(
    messages: list[dict],
    model: str | None = None,
    response_format: dict | None = None,
) -> str:
    """Send a chat completion request and return the assistant message content.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.
        model: Override the default model from settings.
        response_format: Optional response format (e.g. {"type": "json_object"}).

    Returns:
        The assistant's response text.

    Raises:
        RuntimeError: If no LLM API key is configured.
    """
    client = _get_client()
    if client is None:
        raise RuntimeError("No LLM_API_KEY configured. Cannot call LLM.")

    resolved_model = model or settings.LLM_MODEL

    kwargs: dict = {
        "model": resolved_model,
        "messages": messages,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format

    logger.info("LLM request: model=%s, messages=%d", resolved_model, len(messages))
    response = client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    logger.info("LLM response: %d chars", len(content))
    return content


def chat_completion_json(
    messages: list[dict],
    model: str | None = None,
) -> dict:
    """Convenience wrapper that requests JSON output and parses it.

    Returns:
        Parsed JSON dict from the LLM response.
    """
    raw = chat_completion(
        messages=messages,
        model=model,
        response_format={"type": "json_object"},
    )
    return json.loads(raw)


def is_llm_available() -> bool:
    """Check whether an LLM API key is configured."""
    return bool(settings.LLM_API_KEY)
