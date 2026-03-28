"""Integrations router — Google Drive, Zoom, and other external service connections."""

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.google_drive import (
    build_auth_url,
    exchange_code,
    list_drive_files,
    download_drive_file,
    disconnect,
    get_integration_status,
)
from app.services.ingestion import parse_document
from app.services.embedding import generate_embeddings
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


def _get_user_id(request: Request) -> str:
    user_id = request.headers.get("x-user-id", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing x-user-id header")
    return user_id


# ── Google Drive ──────────────────────────────────────────


@router.get("/google/auth-url")
async def google_auth_url(request: Request):
    """Return Google OAuth consent URL."""
    user_id = _get_user_id(request)
    try:
        url = build_auth_url(user_id)
        return {"url": url}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class GoogleCallbackRequest(BaseModel):
    code: str
    user_id: str


@router.post("/google/callback")
async def google_callback(body: GoogleCallbackRequest):
    """Exchange Google auth code for tokens."""
    try:
        result = exchange_code(body.code, body.user_id)
        return result
    except Exception as exc:
        logger.exception("Google OAuth callback failed: %s", exc)
        raise HTTPException(status_code=400, detail="OAuth callback failed")


@router.get("/google/files")
async def list_google_files(request: Request, page_token: str | None = None):
    """List PDF/PPTX/DOCX files from user's Google Drive."""
    user_id = _get_user_id(request)
    try:
        return list_drive_files(user_id, page_token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.exception("Failed to list Drive files: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to list files")


class GoogleImportRequest(BaseModel):
    file_id: str
    session_id: str


@router.post("/google/import")
async def import_google_file(body: GoogleImportRequest, request: Request):
    """Download file from Google Drive and import into session."""
    user_id = _get_user_id(request)

    try:
        # 1. Download from Drive
        file_bytes, file_name, file_type = download_drive_file(user_id, body.file_id)

        # 2. Parse document into chunks
        chunks = parse_document(file_bytes, file_type, file_name)

        if not chunks:
            raise HTTPException(status_code=400, detail="No content extracted from document")

        supabase = get_supabase()

        # 3. Store file in Supabase Storage
        storage_path = f"documents/{body.session_id}/{file_name}"
        try:
            supabase.storage.from_("documents").upload(
                storage_path, file_bytes
            )
        except Exception:
            # File may already exist — try to get URL anyway
            pass
        file_url = supabase.storage.from_("documents").get_public_url(storage_path)

        # 4. Create document record
        doc_result = supabase.table("documents").insert({
            "session_id": body.session_id,
            "file_name": file_name,
            "file_url": file_url,
            "file_type": file_type,
            "file_size": len(file_bytes),
            "status": "parsed",
        }).execute()

        document_id = doc_result.data[0]["id"]

        # 5. Insert chunks
        chunk_rows = []
        for i, chunk in enumerate(chunks):
            chunk_rows.append({
                "document_id": document_id,
                "session_id": body.session_id,
                "chunk_index": chunk.get("chunk_index", i),
                "content": chunk.get("content", ""),
                "heading": chunk.get("heading"),
                "chunk_type": chunk.get("chunk_type", "section"),
                "metadata": chunk.get("metadata", {}),
            })

        if chunk_rows:
            supabase.table("content_chunks").insert(chunk_rows).execute()

        # 6. Generate embeddings
        try:
            texts = [c["content"] for c in chunk_rows if c["content"]]
            if texts:
                embeddings = generate_embeddings(texts)
                for j, emb in enumerate(embeddings):
                    if emb and j < len(chunk_rows):
                        supabase.table("content_chunks").update({
                            "embedding": emb,
                        }).eq("document_id", document_id).eq(
                            "chunk_index", chunk_rows[j]["chunk_index"]
                        ).execute()
        except Exception as emb_exc:
            logger.warning("Embedding generation failed for imported doc: %s", emb_exc)

        logger.info(
            "Imported %s from Drive: %d chunks for session %s",
            file_name, len(chunks), body.session_id,
        )

        return {
            "document_id": document_id,
            "file_name": file_name,
            "chunk_count": len(chunks),
            "source": "google_drive",
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Google Drive import failed: %s", exc)
        raise HTTPException(status_code=500, detail="Import failed")


@router.delete("/google")
async def disconnect_google(request: Request):
    """Remove Google integration for the current user."""
    user_id = _get_user_id(request)
    disconnect(user_id)
    return {"disconnected": True}


# ── General ──────────────────────────────────────────────


@router.get("/status")
async def integration_status(request: Request):
    """Return connected integrations for the current user."""
    user_id = _get_user_id(request)
    try:
        return get_integration_status(user_id)
    except Exception as exc:
        logger.exception("Failed to get integration status: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to get integration status")
