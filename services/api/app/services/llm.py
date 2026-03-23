"""LLM client wrapper using the OpenAI SDK.

Supports any OpenAI-compatible endpoint (OpenRouter, Moonshot, direct OpenAI).
No fallback — requires a valid LLM_API_KEY.
"""

import json
import logging
import time

from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential, RetryError

from app.config import settings

logger = logging.getLogger(__name__)

_client: OpenAI | None = None
_REQUEST_TIMEOUT = 30


def _get_client() -> OpenAI:
    """Return a cached OpenAI-compatible client.

    Raises:
        RuntimeError: If LLM_API_KEY is not configured.
    """
    global _client
    if not settings.LLM_API_KEY:
        raise RuntimeError("LLM_API_KEY not configured. Cannot call LLM.")
    if _client is None:
        _client = OpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
            timeout=_REQUEST_TIMEOUT,
        )
    return _client


def _retry_error_callback(retry_state):
    """Return a clear error message instead of raising raw RetryError."""
    last_exc = retry_state.outcome.exception()
    logger.error(
        "LLM call failed after %d attempts. Last error: %s",
        retry_state.attempt_number,
        str(last_exc),
    )
    raise RuntimeError(
        f"LLM call failed after {retry_state.attempt_number} attempts: {last_exc}"
    ) from last_exc


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(min=2, max=60),
    retry_error_callback=_retry_error_callback,
)
def chat_completion(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    response_format: dict | None = None,
) -> str:
    """Send a chat completion request and return the assistant message content.

    Args:
        messages: List of message dicts with 'role' and 'content' keys.
        model: Override the default model from settings.
        temperature: Sampling temperature (0.0-2.0).
        max_tokens: Maximum tokens in the response.
        response_format: Optional response format (e.g. {"type": "json_object"}).

    Returns:
        The assistant's response text.

    Raises:
        RuntimeError: If no LLM API key is configured.
        ValueError: If the LLM returns an empty response.
    """
    if not messages:
        raise ValueError("messages list cannot be empty")

    client = _get_client()
    resolved_model = model or settings.LLM_MODEL

    kwargs: dict = {
        "model": resolved_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format

    logger.info(
        "LLM request: model=%s, messages=%d, temperature=%.1f, max_tokens=%d",
        resolved_model,
        len(messages),
        temperature,
        max_tokens,
    )

    start_time = time.time()
    response = client.chat.completions.create(**kwargs)
    elapsed = time.time() - start_time

    content = response.choices[0].message.content or ""

    # Log token usage if available
    usage = response.usage
    if usage:
        logger.info(
            "LLM response: model=%s, prompt_tokens=%d, completion_tokens=%d, "
            "total_tokens=%d, time=%.2fs",
            resolved_model,
            usage.prompt_tokens,
            usage.completion_tokens,
            usage.total_tokens,
            elapsed,
        )
    else:
        logger.info(
            "LLM response: model=%s, %d chars, time=%.2fs",
            resolved_model,
            len(content),
            elapsed,
        )

    if not content.strip():
        raise ValueError("LLM returned empty response")

    return content


def chat_completion_json(
    messages: list[dict],
    model: str | None = None,
) -> dict:
    """Convenience wrapper that requests JSON output and parses it.

    Returns:
        Parsed JSON dict from the LLM response.

    Raises:
        RuntimeError: If no LLM API key is configured.
        ValueError: If the LLM response cannot be parsed as JSON.
    """
    raw = chat_completion(
        messages=messages,
        model=model,
        response_format={"type": "json_object"},
    )

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("LLM JSON parse failure. Raw response: %s", raw[:2000])
        raise ValueError(
            f"LLM returned invalid JSON: {exc}. Raw response (truncated): {raw[:500]}"
        ) from exc

    if not isinstance(parsed, dict):
        logger.error("LLM returned non-dict JSON: %s", type(parsed).__name__)
        raise ValueError(
            f"LLM returned {type(parsed).__name__} instead of dict"
        )

    return parsed


def is_llm_available() -> bool:
    """Check whether an LLM API key is configured."""
    return bool(settings.LLM_API_KEY)
