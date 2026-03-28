"""Zoom integration — OAuth, meeting context, webhook handling."""

import logging
import hashlib
import hmac
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

_ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize"
_ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
_ZOOM_API_BASE = "https://api.zoom.us/v2"


def build_zoom_auth_url(user_id: str) -> str:
    """Generate Zoom OAuth consent URL."""
    if not settings.ZOOM_CLIENT_ID:
        raise RuntimeError("Zoom OAuth not configured")

    params = {
        "response_type": "code",
        "client_id": settings.ZOOM_CLIENT_ID,
        "redirect_uri": settings.ZOOM_REDIRECT_URI,
        "state": user_id,
    }
    return f"{_ZOOM_AUTH_URL}?{urlencode(params)}"


def exchange_zoom_code(code: str, user_id: str) -> dict:
    """Exchange Zoom authorization code for tokens."""
    if not settings.ZOOM_CLIENT_ID or not settings.ZOOM_CLIENT_SECRET:
        raise RuntimeError("Zoom OAuth not configured")

    with httpx.Client() as client:
        response = client.post(
            _ZOOM_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.ZOOM_REDIRECT_URI,
            },
            auth=(settings.ZOOM_CLIENT_ID, settings.ZOOM_CLIENT_SECRET),
        )
        response.raise_for_status()
        tokens = response.json()

    supabase = get_supabase()

    token_data = {
        "user_id": user_id,
        "provider": "zoom",
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token", ""),
        "token_expires_at": datetime.now(timezone.utc).isoformat(),
        "scopes": tokens.get("scope", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("user_integrations").upsert(
        token_data, on_conflict="user_id,provider"
    ).execute()

    logger.info("Zoom connected for user %s", user_id)
    return {"connected": True, "provider": "zoom"}


def refresh_zoom_token(user_id: str) -> str:
    """Refresh Zoom access token if expired."""
    supabase = get_supabase()

    result = (
        supabase.table("user_integrations")
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", "zoom")
        .execute()
    )

    if not result.data:
        raise ValueError("Zoom not connected")

    integration = result.data[0]
    refresh_token = integration.get("refresh_token")

    if not refresh_token:
        raise ValueError("No refresh token available")

    with httpx.Client() as client:
        response = client.post(
            _ZOOM_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            auth=(settings.ZOOM_CLIENT_ID, settings.ZOOM_CLIENT_SECRET),
        )
        response.raise_for_status()
        tokens = response.json()

    supabase.table("user_integrations").update({
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token", refresh_token),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", user_id).eq("provider", "zoom").execute()

    return tokens["access_token"]


def get_meeting_context(user_id: str, meeting_id: str) -> dict:
    """Get meeting details via Zoom API."""
    supabase = get_supabase()

    result = (
        supabase.table("user_integrations")
        .select("access_token")
        .eq("user_id", user_id)
        .eq("provider", "zoom")
        .execute()
    )

    if not result.data:
        raise ValueError("Zoom not connected")

    access_token = result.data[0]["access_token"]

    with httpx.Client() as client:
        response = client.get(
            f"{_ZOOM_API_BASE}/meetings/{meeting_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if response.status_code == 401:
            # Try refresh
            access_token = refresh_zoom_token(user_id)
            response = client.get(
                f"{_ZOOM_API_BASE}/meetings/{meeting_id}",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        response.raise_for_status()

    meeting = response.json()
    return {
        "meeting_id": meeting.get("id"),
        "topic": meeting.get("topic"),
        "start_time": meeting.get("start_time"),
        "duration": meeting.get("duration"),
        "host_email": meeting.get("host_email"),
    }


def verify_webhook_signature(payload: bytes, signature: str, timestamp: str) -> bool:
    """Verify Zoom webhook signature."""
    if not settings.ZOOM_VERIFICATION_TOKEN:
        return False

    message = f"v0:{timestamp}:{payload.decode()}"
    expected = "v0=" + hmac.new(
        settings.ZOOM_VERIFICATION_TOKEN.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, signature)
