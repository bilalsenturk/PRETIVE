"""Fact-check claims in transcript text against document content chunks.

Uses the LLM to extract verifiable claims (numbers, statistics, dates, names)
and compare them against the matched document context.
"""

import logging

from app.services.llm import chat_completion_json

logger = logging.getLogger(__name__)

_VERIFY_SYSTEM_PROMPT = """\
You are a fact-checking assistant. Analyze the transcript segment below and:
1. Determine if it contains a verifiable factual claim (a number, statistic, \
date, name, or other concrete assertion).
2. If a claim exists, compare it against the provided document context and \
classify it as "verified", "contradicted", or "unverifiable".
3. If no factual claim is found, set status to "no_claim".

Return a JSON object with exactly these keys:
- "claim": the extracted claim as a string, or null if no claim found
- "status": one of "verified", "contradicted", "unverifiable", "no_claim"
- "evidence": supporting or contradicting text from the document context, \
or null
- "confidence": a float between 0.0 and 1.0 indicating your confidence
"""


async def verify_claim(
    transcript_text: str,
    session_id: str,
    context_chunks: list[dict],
) -> dict:
    """Check if the transcript contains verifiable claims and verify against
    document content.

    Args:
        transcript_text: The spoken text to analyze.
        session_id: Current session ID (for logging context).
        context_chunks: Matched document chunks to verify against.

    Returns:
        {
            "claim": str | None,
            "status": "verified" | "contradicted" | "unverifiable" | "no_claim",
            "evidence": str | None,
            "confidence": float  # 0.0-1.0
        }
    """
    if not transcript_text or not transcript_text.strip():
        logger.debug("Empty transcript text — returning no_claim")
        return _no_claim_result()

    # Build document context from chunks
    context_parts: list[str] = []
    for chunk in context_chunks:
        heading = chunk.get("heading", "")
        content = chunk.get("content", "")
        if heading:
            context_parts.append(f"[{heading}]\n{content}")
        else:
            context_parts.append(content)

    document_context = "\n\n---\n\n".join(context_parts) if context_parts else ""

    if not document_context:
        logger.info(
            "No document context for session %s — claims will be unverifiable",
            session_id,
        )

    user_message = (
        f"Transcript segment:\n\"{transcript_text}\"\n\n"
        f"Document context:\n{document_context or '(no document context available)'}"
    )

    messages = [
        {"role": "system", "content": _VERIFY_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    try:
        result = chat_completion_json(messages)
    except Exception as exc:
        logger.error(
            "LLM verification failed for session %s: %s", session_id, exc
        )
        return _no_claim_result()

    # Normalize and validate the response
    return _normalize_result(result, session_id)


def _no_claim_result() -> dict:
    """Return the default no-claim result."""
    return {
        "claim": None,
        "status": "no_claim",
        "evidence": None,
        "confidence": 0.0,
    }


def _normalize_result(raw: dict, session_id: str) -> dict:
    """Validate and normalize the LLM response into the expected schema."""
    valid_statuses = {"verified", "contradicted", "unverifiable", "no_claim"}

    status = raw.get("status", "no_claim")
    if status not in valid_statuses:
        logger.warning(
            "LLM returned unexpected status '%s' for session %s — "
            "falling back to 'unverifiable'",
            status,
            session_id,
        )
        status = "unverifiable"

    confidence = raw.get("confidence", 0.0)
    try:
        confidence = float(confidence)
        confidence = max(0.0, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = 0.0

    claim = raw.get("claim")
    evidence = raw.get("evidence")

    # If status is no_claim, clear claim and evidence
    if status == "no_claim":
        claim = None
        evidence = None

    return {
        "claim": claim,
        "status": status,
        "evidence": evidence,
        "confidence": confidence,
    }
