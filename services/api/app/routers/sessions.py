from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.db.supabase import get_supabase

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class SessionCreate(BaseModel):
    title: str


class SessionResponse(BaseModel):
    id: str
    title: str
    user_id: str
    created_at: str | None = None
    updated_at: str | None = None


@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    body: SessionCreate,
    x_user_id: str = Header(..., alias="x-user-id"),
) -> SessionResponse:
    """Create a new presentation session."""
    supabase = get_supabase()
    result = (
        supabase.table("sessions")
        .insert({"title": body.title, "user_id": x_user_id})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")
    return SessionResponse(**result.data[0])


@router.get("", response_model=list[SessionResponse])
async def list_sessions(
    x_user_id: str = Header(..., alias="x-user-id"),
) -> list[SessionResponse]:
    """List all sessions for a user."""
    supabase = get_supabase()
    result = (
        supabase.table("sessions")
        .select("*")
        .eq("user_id", x_user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [SessionResponse(**row) for row in result.data]


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
