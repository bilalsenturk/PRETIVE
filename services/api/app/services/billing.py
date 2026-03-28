"""Stripe billing service — checkout, portal, subscriptions, webhooks."""

import logging
from datetime import datetime, timezone

import stripe

from app.config import settings
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

# Plan name mapping from Stripe price IDs
_PRICE_TO_PLAN: dict[str, str] = {}


def _init_stripe() -> None:
    """Initialize Stripe with API key."""
    if not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    # Build reverse lookup
    if settings.STRIPE_PRICE_PRO_MONTHLY:
        _PRICE_TO_PLAN[settings.STRIPE_PRICE_PRO_MONTHLY] = "pro"
    if settings.STRIPE_PRICE_TEAM_MONTHLY:
        _PRICE_TO_PLAN[settings.STRIPE_PRICE_TEAM_MONTHLY] = "team"
    if settings.STRIPE_PRICE_ENTERPRISE_MONTHLY:
        _PRICE_TO_PLAN[settings.STRIPE_PRICE_ENTERPRISE_MONTHLY] = "enterprise"


def get_or_create_customer(user_id: str, email: str = "") -> str:
    """Get existing Stripe customer ID or create a new one."""
    _init_stripe()
    supabase = get_supabase()

    # Check for existing subscription record
    result = (
        supabase.table("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user_id)
        .execute()
    )
    if result.data and result.data[0].get("stripe_customer_id"):
        return result.data[0]["stripe_customer_id"]

    # Create new Stripe customer
    customer = stripe.Customer.create(
        metadata={"user_id": user_id},
        email=email or None,
    )

    # Store in DB
    supabase.table("subscriptions").upsert({
        "user_id": user_id,
        "stripe_customer_id": customer.id,
        "plan": "free",
        "status": "inactive",
    }).execute()

    logger.info("Created Stripe customer %s for user %s", customer.id, user_id)
    return customer.id


def create_checkout_session(
    user_id: str,
    email: str,
    plan: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Stripe Checkout Session and return the URL."""
    _init_stripe()

    price_map = {
        "pro": settings.STRIPE_PRICE_PRO_MONTHLY,
        "team": settings.STRIPE_PRICE_TEAM_MONTHLY,
        "enterprise": settings.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    }
    price_id = price_map.get(plan)
    if not price_id:
        raise ValueError(f"Unknown plan: {plan}")

    customer_id = get_or_create_customer(user_id, email)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url + "?checkout=success",
        cancel_url=cancel_url + "?checkout=canceled",
        metadata={"user_id": user_id, "plan": plan},
    )

    logger.info("Created checkout session %s for user %s, plan %s", session.id, user_id, plan)
    return session.url


def create_portal_session(user_id: str, return_url: str) -> str:
    """Create a Stripe Customer Portal session."""
    _init_stripe()

    customer_id = get_or_create_customer(user_id)

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )

    return session.url


def get_subscription_status(user_id: str) -> dict:
    """Get current subscription details for a user."""
    supabase = get_supabase()

    result = (
        supabase.table("subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        return {
            "plan": "free",
            "status": "inactive",
            "seat_count": 1,
            "current_period_end": None,
            "cancel_at_period_end": False,
        }

    sub = result.data[0]
    return {
        "plan": sub.get("plan", "free"),
        "status": sub.get("status", "inactive"),
        "seat_count": sub.get("seat_count", 1),
        "current_period_start": sub.get("current_period_start"),
        "current_period_end": sub.get("current_period_end"),
        "cancel_at_period_end": sub.get("cancel_at_period_end", False),
        "stripe_subscription_id": sub.get("stripe_subscription_id"),
    }


def handle_webhook_event(payload: bytes, sig_header: str) -> None:
    """Verify and process Stripe webhook events."""
    _init_stripe()

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        logger.warning("Invalid Stripe webhook signature")
        raise ValueError("Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]
    logger.info("Processing Stripe webhook: %s", event_type)

    supabase = get_supabase()

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(supabase, data)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(supabase, data)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(supabase, data)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(supabase, data)
    else:
        logger.debug("Unhandled webhook event type: %s", event_type)


def _handle_checkout_completed(supabase, session_data: dict) -> None:
    """Handle successful checkout — create/update subscription."""
    customer_id = session_data.get("customer")
    subscription_id = session_data.get("subscription")
    metadata = session_data.get("metadata", {})
    user_id = metadata.get("user_id")
    plan = metadata.get("plan", "pro")

    if not customer_id or not user_id:
        logger.warning("Checkout completed but missing customer/user_id")
        return

    supabase.table("subscriptions").upsert({
        "user_id": user_id,
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": subscription_id,
        "plan": plan,
        "status": "active",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    logger.info("Subscription activated for user %s: plan=%s", user_id, plan)


def _handle_subscription_updated(supabase, sub_data: dict) -> None:
    """Handle subscription changes (plan change, renewal, etc.)."""
    customer_id = sub_data.get("customer")
    if not customer_id:
        return

    # Determine plan from price
    items = sub_data.get("items", {}).get("data", [])
    price_id = items[0]["price"]["id"] if items else None
    plan = _PRICE_TO_PLAN.get(price_id, "pro") if price_id else "pro"

    status_map = {
        "active": "active",
        "past_due": "past_due",
        "canceled": "canceled",
        "trialing": "trialing",
        "incomplete": "inactive",
        "incomplete_expired": "inactive",
        "unpaid": "past_due",
    }
    status = status_map.get(sub_data.get("status", ""), "inactive")

    update_data = {
        "plan": plan,
        "status": status,
        "stripe_subscription_id": sub_data.get("id"),
        "cancel_at_period_end": sub_data.get("cancel_at_period_end", False),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Period dates
    if sub_data.get("current_period_start"):
        update_data["current_period_start"] = datetime.fromtimestamp(
            sub_data["current_period_start"], tz=timezone.utc
        ).isoformat()
    if sub_data.get("current_period_end"):
        update_data["current_period_end"] = datetime.fromtimestamp(
            sub_data["current_period_end"], tz=timezone.utc
        ).isoformat()

    # Seat count from quantity
    if items and items[0].get("quantity"):
        update_data["seat_count"] = items[0]["quantity"]

    supabase.table("subscriptions").update(update_data).eq(
        "stripe_customer_id", customer_id
    ).execute()

    logger.info("Subscription updated for customer %s: plan=%s, status=%s", customer_id, plan, status)


def _handle_subscription_deleted(supabase, sub_data: dict) -> None:
    """Handle subscription cancellation."""
    customer_id = sub_data.get("customer")
    if not customer_id:
        return

    supabase.table("subscriptions").update({
        "status": "canceled",
        "cancel_at_period_end": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("stripe_customer_id", customer_id).execute()

    logger.info("Subscription canceled for customer %s", customer_id)


def _handle_payment_failed(supabase, invoice_data: dict) -> None:
    """Handle failed payment — mark as past_due."""
    customer_id = invoice_data.get("customer")
    if not customer_id:
        return

    supabase.table("subscriptions").update({
        "status": "past_due",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("stripe_customer_id", customer_id).execute()

    logger.info("Payment failed for customer %s — marked past_due", customer_id)
