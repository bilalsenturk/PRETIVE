"""Google Drive integration — OAuth, file listing, download."""

import io
import logging
from datetime import datetime, timezone, timedelta

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from app.config import settings
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
_SUPPORTED_MIMES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


def _get_flow() -> Flow:
    """Create Google OAuth flow."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise RuntimeError("Google OAuth not configured")

    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=_SCOPES)
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


def build_auth_url(user_id: str) -> str:
    """Generate Google OAuth consent URL."""
    flow = _get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=user_id,
    )
    return auth_url


def exchange_code(code: str, user_id: str) -> dict:
    """Exchange authorization code for tokens and store in DB."""
    flow = _get_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials

    supabase = get_supabase()

    token_data = {
        "user_id": user_id,
        "provider": "google",
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token or "",
        "token_expires_at": credentials.expiry.isoformat() if credentials.expiry else None,
        "scopes": " ".join(credentials.scopes or _SCOPES),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    supabase.table("user_integrations").upsert(
        token_data, on_conflict="user_id,provider"
    ).execute()

    logger.info("Google Drive connected for user %s", user_id)
    return {"connected": True, "provider": "google"}


def _get_credentials(user_id: str) -> Credentials:
    """Get valid credentials for user, refreshing if needed."""
    supabase = get_supabase()

    result = (
        supabase.table("user_integrations")
        .select("*")
        .eq("user_id", user_id)
        .eq("provider", "google")
        .execute()
    )

    if not result.data:
        raise ValueError("Google Drive not connected. Please connect first.")

    integration = result.data[0]

    creds = Credentials(
        token=integration["access_token"],
        refresh_token=integration.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=_SCOPES,
    )

    # Check if token is expired and refresh
    expires_at = integration.get("token_expires_at")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp_dt < datetime.now(timezone.utc) + timedelta(minutes=5):
                creds.refresh(None)  # Uses refresh token
                # Update stored token
                supabase.table("user_integrations").update({
                    "access_token": creds.token,
                    "token_expires_at": creds.expiry.isoformat() if creds.expiry else None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("user_id", user_id).eq("provider", "google").execute()
        except Exception as exc:
            logger.warning("Token refresh failed for user %s: %s", user_id, exc)

    return creds


def list_drive_files(user_id: str, page_token: str | None = None) -> dict:
    """List PDF/PPTX/DOCX files from user's Google Drive."""
    creds = _get_credentials(user_id)
    service = build("drive", "v3", credentials=creds)

    mime_filter = " or ".join(f"mimeType='{m}'" for m in _SUPPORTED_MIMES.keys())
    query = f"({mime_filter}) and trashed=false"

    result = service.files().list(
        q=query,
        pageSize=20,
        pageToken=page_token,
        fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink)",
        orderBy="modifiedTime desc",
    ).execute()

    files = []
    for f in result.get("files", []):
        files.append({
            "id": f["id"],
            "name": f["name"],
            "mime_type": f["mimeType"],
            "file_type": _SUPPORTED_MIMES.get(f["mimeType"], "unknown"),
            "size": int(f.get("size", 0)),
            "modified_at": f.get("modifiedTime"),
            "icon_url": f.get("iconLink"),
        })

    return {
        "files": files,
        "next_page_token": result.get("nextPageToken"),
    }


def download_drive_file(user_id: str, file_id: str) -> tuple[bytes, str, str]:
    """Download a file from Google Drive. Returns (bytes, filename, file_type)."""
    creds = _get_credentials(user_id)
    service = build("drive", "v3", credentials=creds)

    # Get file metadata
    file_meta = service.files().get(
        fileId=file_id, fields="name, mimeType, size"
    ).execute()

    file_name = file_meta["name"]
    mime_type = file_meta["mimeType"]
    file_type = _SUPPORTED_MIMES.get(mime_type)

    if not file_type:
        raise ValueError(f"Unsupported file type: {mime_type}")

    # Check size (50MB limit)
    size = int(file_meta.get("size", 0))
    if size > 50 * 1024 * 1024:
        raise ValueError(f"File too large: {size} bytes (max 50MB)")

    # Download file content
    request = service.files().get_media(fileId=file_id)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)

    done = False
    while not done:
        _, done = downloader.next_chunk()

    file_bytes = buffer.getvalue()
    logger.info("Downloaded %s (%d bytes) from Drive for user", file_name, len(file_bytes))

    return file_bytes, file_name, file_type


def disconnect(user_id: str) -> None:
    """Remove Google integration for a user."""
    supabase = get_supabase()
    supabase.table("user_integrations").delete().eq(
        "user_id", user_id
    ).eq("provider", "google").execute()
    logger.info("Google Drive disconnected for user %s", user_id)


def get_integration_status(user_id: str) -> dict:
    """Check which integrations are connected for a user."""
    supabase = get_supabase()

    result = (
        supabase.table("user_integrations")
        .select("provider, created_at")
        .eq("user_id", user_id)
        .execute()
    )

    connected = {}
    for row in (result.data or []):
        connected[row["provider"]] = {
            "connected": True,
            "connected_at": row["created_at"],
        }

    return {
        "google": connected.get("google", {"connected": False}),
        "zoom": connected.get("zoom", {"connected": False}),
        "microsoft": connected.get("microsoft", {"connected": False}),
    }
