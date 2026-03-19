from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.db.supabase import get_supabase

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

DEMO_USER_ID = "00000000-0000-0000-0000-000000000000"


class SessionCreate(BaseModel):
    title: str


class SessionResponse(BaseModel):
    id: str
    title: str
    status: str = "draft"
    user_id: str = ""
    created_at: str | None = None
    updated_at: str | None = None


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> SessionResponse:
    """Create a new presentation session."""
    user_id = x_user_id or DEMO_USER_ID
    supabase = get_supabase()
    result = (
        supabase.table("sessions")
        .insert({"title": body.title, "user_id": user_id, "status": "draft"})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")
    return SessionResponse(**result.data[0])


@router.get("")
async def list_sessions(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """List all sessions for a user."""
    user_id = x_user_id or DEMO_USER_ID
    supabase = get_supabase()
    result = (
        supabase.table("sessions")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str) -> SessionResponse:
    """Get a single session by ID."""
    supabase = get_supabase()
    result = (
        supabase.table("sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(**result.data)


@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str) -> None:
    """Delete a session by ID."""
    supabase = get_supabase()
    supabase.table("sessions").delete().eq("id", session_id).execute()
