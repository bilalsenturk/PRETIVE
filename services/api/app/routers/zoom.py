"""Zoom integration endpoints — OAuth, webhooks, meeting context."""

import logging
import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.zoom import (
    build_zoom_auth_url,
    exchange_zoom_code,
    get_meeting_context,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/zoom", tags=["zoom"])


def _get_user_id(request: Request) -> str:
    user_id = request.headers.get("x-user-id", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing x-user-id header")
    return user_id


@router.get("/auth-url")
async def zoom_auth_url(request: Request):
    """Generate Zoom OAuth URL."""
    user_id = _get_user_id(request)
    try:
        url = build_zoom_auth_url(user_id)
        return {"url": url}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class ZoomCallbackRequest(BaseModel):
    code: str
    user_id: str


@router.post("/callback")
async def zoom_callback(body: ZoomCallbackRequest):
    """Exchange Zoom auth code for tokens."""
    try:
        result = exchange_zoom_code(body.code, body.user_id)
        return result
    except Exception as exc:
        logger.exception("Zoom OAuth callback failed: %s", exc)
        raise HTTPException(status_code=400, detail="OAuth callback failed")


@router.post("/webhook")
async def zoom_webhook(request: Request):
    """Handle Zoom webhook events and validation challenges."""
    payload = await request.body()

    try:
        body = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Handle Zoom's URL validation challenge
    if body.get("event") == "endpoint.url_validation":
        plain_token = body.get("payload", {}).get("plainToken", "")
        import hashlib
        import hmac
        from app.config import settings

        hash_obj = hmac.new(
            settings.ZOOM_VERIFICATION_TOKEN.encode(),
            plain_token.encode(),
            hashlib.sha256,
        )
        return {
            "plainToken": plain_token,
            "encryptedToken": hash_obj.hexdigest(),
        }

    # Log other webhook events
    event_type = body.get("event", "unknown")
    logger.info("Zoom webhook received: %s", event_type)

    return {"status": "ok"}


@router.get("/meeting/{meeting_id}/context")
async def meeting_context(meeting_id: str, request: Request):
    """Get meeting details for the overlay panel."""
    user_id = _get_user_id(request)
    try:
        return get_meeting_context(user_id, meeting_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Failed to get meeting context: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to get meeting context")
