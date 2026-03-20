"""
Thread-safe Supabase singleton — fails hard if misconfigured.
"""

import logging
import threading

from supabase import Client, create_client

from app.config import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_supabase_client: Client | None = None


def get_supabase() -> Client:
    """Return (or create) the singleton Supabase client. Thread-safe."""
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    with _lock:
        # Double-checked locking
        if _supabase_client is not None:
            return _supabase_client

        url = settings.SUPABASE_URL
        key = settings.SUPABASE_KEY

        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_KEY must be set — "
                "cannot create Supabase client"
            )

        logger.info("Creating Supabase client for %s", url)
        try:
            client = create_client(url, key)
        except Exception as exc:
            raise RuntimeError(
                f"Failed to create Supabase client: {exc}"
            ) from exc

        _supabase_client = client
        logger.info("Supabase client created successfully")
        return _supabase_client


def check_connection() -> None:
    """Verify the database is reachable by running a lightweight query.

    Raises RuntimeError if the connection fails.
    """
    client = get_supabase()
    try:
        # A minimal query — the table doesn't need to exist; we just need
        # Supabase to respond without a network / auth error.
        client.table("_health_check").select("*").limit(1).execute()
        logger.info("Supabase health-check query succeeded")
    except Exception as exc:
        error_msg = str(exc).lower()
        # These errors prove connectivity + auth — table just doesn't exist
        if any(keyword in error_msg for keyword in [
            "relation", "does not exist", "could not find", "pgrst205",
            "not found", "schema cache",
        ]):
            logger.info("Supabase connection verified (health-check table absent, but DB reachable)")
            return
        raise RuntimeError(
            f"Supabase connection check failed: {exc}"
        ) from exc
