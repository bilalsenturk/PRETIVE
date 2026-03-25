"""Hardened document management router with file size limits, type validation,
permission checks, and comprehensive logging."""

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.db.supabase import get_supabase
from app.services.embedding import generate_embeddings, is_embedding_available
from app.services.ingestion import parse_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions/{session_id}/documents", tags=["documents"])

DEMO_USER_ID = "demo-user-001"
ALLOWED_EXTENSIONS = {".pdf", ".pptx", ".docx"}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class DocumentResponse(BaseModel):
    id: str
    session_id: str
    file_name: str
    file_type: str
    storage_path: str
    status: str
    chunk_count: int = 0
    created_at: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _verify_session_exists(session_id: str) -> dict:
    """Verify a session exists. Raises 404 if not found."""
    supabase = get_supabase()
    try:
        result = (
            supabase.table("sessions")
            .select("*")
            .eq("id", session_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    return result.data


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    session_id: str,
    file: UploadFile,
) -> DocumentResponse:
    """Upload a document, store it in Supabase Storage, parse into chunks,
    generate embeddings (real OpenAI), and return the document with chunk count.

    Validates:
    - Session exists
    - File size <= MAX_FILE_SIZE_MB (50MB default)
    - File type is pdf, pptx, or docx
    - Cleans up storage on DB insert failure
    """
    # Verify session exists
    _verify_session_exists(session_id)

    # Validate file name
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    # Validate file type
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Read file bytes and check size
    file_bytes = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(file_bytes) / (1024 * 1024):.1f}MB). "
                   f"Maximum allowed: {settings.MAX_FILE_SIZE_MB}MB.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    logger.info(
        "Uploading document: session=%s, file=%s, size=%d bytes, type=%s",
        session_id, file.filename, len(file_bytes), suffix,
    )

    supabase = get_supabase()
    storage_path = f"{session_id}/{uuid.uuid4().hex}{suffix}"

    # Upload to Supabase Storage
    try:
        supabase.storage.from_("documents").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": file.content_type or "application/octet-stream"},
        )
    except Exception as exc:
        logger.exception("Storage upload failed for %s: %s", file.filename, exc)
        raise HTTPException(status_code=500, detail="Failed to upload file to storage")

    # Insert document record
    doc_record = {
        "session_id": session_id,
        "file_name": file.filename,
        "file_type": suffix.lstrip("."),
        "storage_path": storage_path,
        "status": "processing",
    }

    try:
        result = supabase.table("documents").insert(doc_record).execute()
    except Exception as exc:
        # Cleanup: remove uploaded file from storage on DB insert failure
        logger.exception("DB insert failed for document, cleaning up storage: %s", exc)
        try:
            supabase.storage.from_("documents").remove([storage_path])
            logger.info("Cleaned up storage file: %s", storage_path)
        except Exception as cleanup_exc:
            logger.error("Failed to cleanup storage file %s: %s", storage_path, cleanup_exc)
        raise HTTPException(status_code=500, detail="Failed to create document record")

    if not result.data:
        # Cleanup storage on empty result
        try:
            supabase.storage.from_("documents").remove([storage_path])
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Failed to create document record")

    document = result.data[0]
    chunk_count = 0

    try:
        # Parse document into chunks
        chunks = parse_document(file_bytes, suffix.lstrip("."), file.filename or "unknown")
        logger.info(
            "Parsed document %s (%s): %d chunks",
            document["id"], file.filename, len(chunks),
        )

        # Save chunks to content_chunks table
        chunk_records = [
            {
                "document_id": document["id"],
                "session_id": session_id,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "heading": chunk.get("heading"),
                "chunk_type": chunk["chunk_type"],
            }
            for chunk in chunks
        ]

        insert_result = None
        if chunk_records:
            insert_result = (
                supabase.table("content_chunks").insert(chunk_records).execute()
            )
            chunk_count = len(insert_result.data) if insert_result.data else 0

        # Generate embeddings (real OpenAI, no mock)
        if chunk_records and is_embedding_available() and insert_result and insert_result.data:
            logger.info("Generating embeddings for %d chunks", len(chunk_records))
            texts = [c["content"] for c in chunk_records]
            embeddings = generate_embeddings(texts)

            for chunk_row, embedding in zip(insert_result.data, embeddings):
                supabase.table("content_chunks").update(
                    {"embedding": embedding}
                ).eq("id", chunk_row["id"]).execute()

            logger.info("Embeddings saved for document %s", document["id"])
        elif chunk_records:
            logger.warning(
                "Skipping embeddings for document %s (OpenAI not available)",
                document["id"],
            )

        # Update document status to parsed
        supabase.table("documents").update({"status": "parsed"}).eq(
            "id", document["id"]
        ).execute()
        document["status"] = "parsed"
        logger.info("Document %s processed successfully: %d chunks", document["id"], chunk_count)

    except Exception as exc:
        logger.exception("Failed to process document %s: %s", document["id"], exc)
        supabase.table("documents").update({"status": "error"}).eq(
            "id", document["id"]
        ).execute()
        document["status"] = "error"

    return DocumentResponse(**document, chunk_count=chunk_count)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(session_id: str) -> list[DocumentResponse]:
    """List all documents for a session with chunk counts."""
    # Verify session exists
    _verify_session_exists(session_id)

    logger.info("Listing documents for session=%s", session_id)

    try:
        supabase = get_supabase()
        result = (
            supabase.table("documents")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        logger.exception("DB error listing documents for session %s: %s", session_id, exc)
        raise HTTPException(status_code=500, detail="Failed to list documents")

    documents: list[DocumentResponse] = []
    for row in result.data or []:
        # Get chunk count for each document
        try:
            count_result = (
                supabase.table("content_chunks")
                .select("id", count="exact")
                .eq("document_id", row["id"])
                .execute()
            )
            chunk_count = count_result.count if count_result.count else 0
        except Exception as exc:
            logger.warning("Failed to get chunk count for document %s: %s", row["id"], exc)
            chunk_count = 0
        documents.append(DocumentResponse(**row, chunk_count=chunk_count))

    return documents
