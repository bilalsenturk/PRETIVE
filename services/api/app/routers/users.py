"""User profile management endpoints."""
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["users"])

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

def _resolve_user_id(x_user_id: Optional[str]) -> str:
    return x_user_id or DEMO_USER_ID

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    bio: Optional[str] = Field(None, max_length=1000)
    job_title: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    timezone: Optional[str] = Field(None, max_length=100)
    language: Optional[str] = Field(None, max_length=10)
    theme: Optional[str] = Field(None, max_length=20)
    notification_email: Optional[bool] = None
    notification_session_end: Optional[bool] = None

@router.get("/me")
async def get_profile(x_user_id: Optional[str] = Header(default=None, alias="x-user-id")):
    """Get current user's profile."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    result = supabase.table("profiles").select("*").eq("id", user_id).execute()

    if not result.data:
        # Auto-create profile for demo/new users
        profile = {"id": user_id, "full_name": "", "bio": "", "job_title": "", "company": "", "phone": "", "timezone": "UTC", "language": "en", "theme": "light", "notification_email": True, "notification_session_end": True}
        try:
            supabase.table("profiles").insert(profile).execute()
        except Exception:
            pass  # May fail due to FK constraint in demo mode
        return profile

    return result.data[0]

@router.patch("/me")
async def update_profile(body: ProfileUpdate, x_user_id: Optional[str] = Header(default=None, alias="x-user-id")):
    """Update current user's profile."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = "now()"

    result = supabase.table("profiles").update(update_data).eq("id", user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return result.data[0]

@router.post("/me/avatar")
async def upload_avatar(file: UploadFile = File(...), x_user_id: Optional[str] = Header(default=None, alias="x-user-id")):
    """Upload user avatar."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB max
        raise HTTPException(status_code=400, detail="Avatar must be under 5MB")

    path = f"avatars/{user_id}/{file.filename}"
    try:
        supabase.storage.from_("avatars").upload(path, content, {"content-type": file.content_type or "image/jpeg"})
    except Exception:
        supabase.storage.from_("avatars").update(path, content, {"content-type": file.content_type or "image/jpeg"})

    public_url = supabase.storage.from_("avatars").get_public_url(path)
    supabase.table("profiles").update({"avatar_url": public_url}).eq("id", user_id).execute()

    return {"avatar_url": public_url}


@router.delete("/me")
async def delete_account(x_user_id: Optional[str] = Header(default=None, alias="x-user-id")):
    """Delete user account and all associated data (GDPR right to erasure).

    Cascade deletes handle: sessions, documents, chunks, cards, events,
    questions, profiles, organization memberships, integrations, subscriptions.
    """
    user_id = _resolve_user_id(x_user_id)
    if user_id == DEMO_USER_ID:
        raise HTTPException(status_code=400, detail="Cannot delete demo account")

    supabase = get_supabase()

    try:
        # Delete profile (cascade handles related data)
        supabase.table("profiles").delete().eq("id", user_id).execute()

        # Delete sessions (cascade handles documents, chunks, cards, events)
        supabase.table("sessions").delete().eq("user_id", user_id).execute()

        # Delete organization memberships
        supabase.table("organization_members").delete().eq("user_id", user_id).execute()

        # Delete integrations
        supabase.table("user_integrations").delete().eq("user_id", user_id).execute()

        # Delete subscriptions
        supabase.table("subscriptions").delete().eq("user_id", user_id).execute()

        # Delete owned organizations
        supabase.table("organizations").delete().eq("owner_id", user_id).execute()

        # Delete avatar from storage
        try:
            supabase.storage.from_("avatars").remove([f"avatars/{user_id}/"])
        except Exception:
            pass  # Storage cleanup is best-effort

        logger.info("Account deleted for user %s (GDPR erasure)", user_id)
        return {"deleted": True, "user_id": user_id}

    except Exception as exc:
        logger.exception("Failed to delete account for user %s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Account deletion failed")


@router.get("/me/export")
async def export_user_data(x_user_id: Optional[str] = Header(default=None, alias="x-user-id")):
    """Export all user data in JSON format (GDPR right to data portability).

    Returns a structured JSON object containing all personal data.
    """
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    try:
        # Profile
        profile = supabase.table("profiles").select("*").eq("id", user_id).execute()

        # Sessions with cards and events
        sessions = supabase.table("sessions").select("*").eq("user_id", user_id).execute()

        session_details = []
        for session in (sessions.data or []):
            sid = session["id"]

            # Documents
            docs = supabase.table("documents").select("id, file_name, file_type, file_size, status, created_at").eq("session_id", sid).execute()

            # Cards
            cards = supabase.table("session_cards").select("id, card_type, title, content, display_order").eq("session_id", sid).execute()

            # Events
            events = supabase.table("session_events").select("event_type, payload, created_at").eq("session_id", sid).order("created_at").execute()

            # Questions
            questions = supabase.table("session_questions").select("text, participant_name, status, answer, created_at").eq("session_id", sid).execute()

            session_details.append({
                "session": session,
                "documents": docs.data or [],
                "cards": cards.data or [],
                "events": events.data or [],
                "questions": questions.data or [],
            })

        # Organization memberships
        memberships = supabase.table("organization_members").select("*, organizations(name, slug)").eq("user_id", user_id).execute()

        # Integrations (tokens redacted)
        integrations = supabase.table("user_integrations").select("provider, scopes, created_at").eq("user_id", user_id).execute()

        # Subscription
        subscription = supabase.table("subscriptions").select("plan, status, seat_count, current_period_start, current_period_end, created_at").eq("user_id", user_id).execute()

        export_data = {
            "export_date": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "profile": profile.data[0] if profile.data else None,
            "sessions": session_details,
            "organizations": memberships.data or [],
            "integrations": integrations.data or [],
            "subscription": subscription.data[0] if subscription.data else None,
            "data_processing_info": {
                "purpose": "AI-powered live presentation assistance",
                "legal_basis": "Consent and legitimate interest",
                "retention": "Data retained until account deletion",
                "ai_processing": "Speech transcripts processed by LLM for content matching, fact verification, and card generation. Raw audio is never stored.",
                "third_parties": [
                    "Supabase (database hosting, EU region)",
                    "OpenAI-compatible LLM provider (content generation)",
                    "Deepgram (speech-to-text)",
                    "Stripe (payment processing, if subscribed)",
                ],
            },
        }

        logger.info("Data export generated for user %s (GDPR portability)", user_id)
        return export_data

    except Exception as exc:
        logger.exception("Failed to export data for user %s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Data export failed")
