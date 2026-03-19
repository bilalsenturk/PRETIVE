import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from app.db.supabase import get_supabase
from app.services.ingestion import parse_document

router = APIRouter(prefix="/api/sessions/{session_id}/documents", tags=["documents"])


class DocumentResponse(BaseModel):
    id: str
    session_id: str
    file_name: str
    file_type: str
    storage_path: str
    status: str
    created_at: str | None = None


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    session_id: str,
    file: UploadFile,
) -> DocumentResponse:
    """Upload a document, store it in Supabase Storage, and trigger parsing."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    suffix = Path(file.filename).suffix.lower()
    allowed = {".pdf", ".pptx", ".docx"}
    if suffix not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(allowed)}",
        )

    supabase = get_supabase()
    file_bytes = await file.read()
    storage_path = f"{session_id}/{uuid.uuid4().hex}{suffix}"

    # Upload to Supabase Storage
    supabase.storage.from_("documents").upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": file.content_type or "application/octet-stream"},
    )

    # Insert document record
    doc_record = {
        "session_id": session_id,
        "file_name": file.filename,
        "file_type": suffix.lstrip("."),
        "storage_path": storage_path,
        "status": "processing",
    }
    result = supabase.table("documents").insert(doc_record).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create document record")

    document = result.data[0]

    # Parse document and store chunks
    try:
        chunks = parse_document(file_bytes, suffix.lstrip("."))
        chunk_records = [
            {
                "document_id": document["id"],
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "heading": chunk.get("heading"),
                "chunk_type": chunk["chunk_type"],
            }
            for chunk in chunks
        ]
        if chunk_records:
            supabase.table("chunks").insert(chunk_records).execute()

        supabase.table("documents").update({"status": "ready"}).eq(
            "id", document["id"]
        ).execute()
        document["status"] = "ready"
    except Exception:
        supabase.table("documents").update({"status": "error"}).eq(
            "id", document["id"]
        ).execute()
        document["status"] = "error"

    return DocumentResponse(**document)


@router.get("", response_model=list[DocumentResponse])
async def list_documents(session_id: str) -> list[DocumentResponse]:
    """List all documents for a session."""
    supabase = get_supabase()
    result = (
        supabase.table("documents")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [DocumentResponse(**row) for row in result.data]
