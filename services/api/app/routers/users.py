"""User profile management endpoints."""
import logging
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
