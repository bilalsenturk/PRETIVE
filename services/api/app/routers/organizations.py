"""Organization management endpoints."""
import logging
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/organizations", tags=["organizations"])

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"


def _resolve_user_id(x_user_id: Optional[str]) -> str:
    return x_user_id or DEMO_USER_ID


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100)
    website: Optional[str] = Field(None, max_length=500)
    industry: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    industry: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)


class InviteRequest(BaseModel):
    email: str = Field(..., max_length=255)
    role: str = Field(default="member", max_length=50)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("")
async def create_organization(
    body: OrganizationCreate,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """Create a new organization."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    org_data = body.model_dump()
    org_data["owner_id"] = user_id

    result = supabase.table("organizations").insert(org_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create organization")

    org = result.data[0]

    # Auto-add creator as owner member
    supabase.table("organization_members").insert({
        "organization_id": org["id"],
        "user_id": user_id,
        "role": "owner",
    }).execute()

    return org


@router.get("")
async def list_organizations(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """List organizations the current user belongs to."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    memberships = (
        supabase.table("organization_members")
        .select("organization_id, role")
        .eq("user_id", user_id)
        .execute()
    )

    if not memberships.data:
        return []

    org_ids = [m["organization_id"] for m in memberships.data]
    orgs = supabase.table("organizations").select("*").in_("id", org_ids).execute()

    # Attach the user's role to each org
    role_map = {m["organization_id"]: m["role"] for m in memberships.data}
    for org in orgs.data:
        org["my_role"] = role_map.get(org["id"])

    return orgs.data


@router.get("/{org_id}")
async def get_organization(
    org_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """Get organization detail."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    # Verify membership
    membership = (
        supabase.table("organization_members")
        .select("role")
        .eq("organization_id", org_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    result = supabase.table("organizations").select("*").eq("id", org_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    org = result.data[0]
    org["my_role"] = membership.data[0]["role"]
    return org


@router.patch("/{org_id}")
async def update_organization(
    org_id: str,
    body: OrganizationUpdate,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """Update organization (owner/admin only)."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    # Check permission
    membership = (
        supabase.table("organization_members")
        .select("role")
        .eq("organization_id", org_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not membership.data or membership.data[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can update the organization")

    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = "now()"

    result = supabase.table("organizations").update(update_data).eq("id", org_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    return result.data[0]


@router.get("/{org_id}/members")
async def list_members(
    org_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """List organization members with their profiles."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    # Verify membership
    membership = (
        supabase.table("organization_members")
        .select("role")
        .eq("organization_id", org_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    members = (
        supabase.table("organization_members")
        .select("user_id, role, joined_at, profiles(id, full_name, avatar_url, job_title)")
        .eq("organization_id", org_id)
        .execute()
    )

    return members.data


@router.post("/{org_id}/invite")
async def invite_member(
    org_id: str,
    body: InviteRequest,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """Invite a user by email to the organization."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    # Check permission (owner or admin)
    membership = (
        supabase.table("organization_members")
        .select("role")
        .eq("organization_id", org_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not membership.data or membership.data[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can invite members")

    invitation = {
        "organization_id": org_id,
        "email": body.email,
        "role": body.role,
        "invited_by": user_id,
    }

    result = supabase.table("organization_invitations").insert(invitation).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    return result.data[0]


@router.delete("/{org_id}/members/{member_user_id}")
async def remove_member(
    org_id: str,
    member_user_id: str,
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
):
    """Remove a member from the organization."""
    user_id = _resolve_user_id(x_user_id)
    supabase = get_supabase()

    # Check permission
    membership = (
        supabase.table("organization_members")
        .select("role")
        .eq("organization_id", org_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not membership.data or membership.data[0]["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can remove members")

    # Prevent removing the owner
    target = (
        supabase.table("organization_members")
        .select("role")
        .eq("organization_id", org_id)
        .eq("user_id", member_user_id)
        .execute()
    )
    if target.data and target.data[0]["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the organization owner")

    supabase.table("organization_members").delete().eq("organization_id", org_id).eq("user_id", member_user_id).execute()

    return {"detail": "Member removed"}
