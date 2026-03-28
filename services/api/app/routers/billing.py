"""Billing endpoints — Stripe Checkout, Portal, subscriptions, webhooks."""

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.billing import (
    create_checkout_session,
    create_portal_session,
    get_subscription_status,
    handle_webhook_event,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutRequest(BaseModel):
    plan: str  # "pro" | "team" | "enterprise"
    success_url: str
    cancel_url: str


class PortalRequest(BaseModel):
    return_url: str


def _get_user_id(request: Request) -> str:
    user_id = request.headers.get("x-user-id", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing x-user-id header")
    return user_id


@router.post("/checkout")
async def create_checkout(body: CheckoutRequest, request: Request):
    """Create a Stripe Checkout Session. Returns {url: str}."""
    user_id = _get_user_id(request)
    email = request.headers.get("x-user-email", "")

    try:
        url = create_checkout_session(
            user_id=user_id,
            email=email,
            plan=body.plan,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
        )
        return {"url": url}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Failed to create checkout session: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


@router.post("/portal")
async def create_portal(body: PortalRequest, request: Request):
    """Create a Stripe Customer Portal Session. Returns {url: str}."""
    user_id = _get_user_id(request)

    try:
        url = create_portal_session(user_id=user_id, return_url=body.return_url)
        return {"url": url}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Failed to create portal session: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create portal session")


@router.get("/subscription")
async def get_subscription(request: Request):
    """Get current user's subscription status."""
    user_id = _get_user_id(request)

    try:
        return get_subscription_status(user_id)
    except Exception as exc:
        logger.exception("Failed to get subscription: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to get subscription status")


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events. Uses raw body + signature header."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        handle_webhook_event(payload, sig_header)
        return {"status": "ok"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    except Exception as exc:
        logger.exception("Webhook processing failed: %s", exc)
        raise HTTPException(status_code=500, detail="Webhook processing failed")
