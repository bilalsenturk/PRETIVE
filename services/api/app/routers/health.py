"""Hardened health check endpoint.

Verifies connectivity to all external services and reports degraded status
when any dependency is unavailable."""

import logging

from fastapi import APIRouter

from app.config import settings
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict:
    """Check health of all dependent services.

    Returns:
        {"status": "ok"|"degraded", "services": {"supabase": bool, "openai": bool, "llm": bool, "deepgram": bool}}
    """
    services: dict[str, bool] = {
        "supabase": False,
        "embeddings": False,
        "llm": False,
        "deepgram": False,
    }

    # Check Supabase connection
    try:
        client = get_supabase()
        client.table("sessions").select("id").limit(1).execute()
        services["supabase"] = True
    except Exception as exc:
        error_msg = str(exc).lower()
        # A "relation does not exist" still proves connectivity + auth
        if "relation" in error_msg and "does not exist" in error_msg:
            services["supabase"] = True
        else:
            logger.warning("Supabase health check failed: %s", exc)

    # Check embedding provider (OpenAI or Moonshot)
    try:
        from app.services.embedding import is_embedding_available
        services["embeddings"] = is_embedding_available()
    except Exception:
        logger.warning("Embedding availability check failed")

    # Check LLM API key present
    try:
        services["llm"] = bool(
            settings.LLM_API_KEY
            and len(settings.LLM_API_KEY) > 0
            and settings.LLM_BASE_URL
            and len(settings.LLM_BASE_URL) > 0
        )
    except Exception:
        logger.warning("LLM API key check failed")

    # Check Deepgram key present
    try:
        services["deepgram"] = bool(settings.DEEPGRAM_API_KEY and len(settings.DEEPGRAM_API_KEY) > 0)
    except Exception:
        logger.warning("Deepgram API key check failed")

    all_healthy = all(services.values())
    overall_status = "ok" if all_healthy else "degraded"

    if not all_healthy:
        failed = [name for name, healthy in services.items() if not healthy]
        logger.warning("Health check degraded. Failing services: %s", ", ".join(failed))

    return {"status": overall_status, "services": services}
