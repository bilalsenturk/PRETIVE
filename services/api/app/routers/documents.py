import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from app.db.supabase import get_supabase
from app.services.embedding import generate_embeddings, is_embedding_available
from app.services.ingestion import parse_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions/{session_id}/documents", tags=["documents"])


class DocumentResponse(BaseModel):
    id: str
    session_id: str
    file_name: str
    file_type: str
    storage_path: str
    status: str
    chunk_count: int = 0
    created_at: str | None = None


@router.post("", response_model=DocumentResponse, status_code=201)
async def upload_document(
    session_id: str,
    file: UploadFile,
) -> DocumentResponse:
    """Upload a document, store it in Supabase Storage, parse into chunks,
    optionally generate embeddings, and return the document with chunk count."""
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
    chunk_count = 0

    try:
        # Parse document into chunks
        chunks = parse_document(file_bytes, suffix.lstrip("."))
        logger.info(
            "Parsed document %s: %d chunks", document["id"], len(chunks),
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

        if chunk_records:
            insert_result = (
                supabase.table("content_chunks").insert(chunk_records).execute()
            )
            chunk_count = len(insert_result.data) if insert_result.data else 0

        # Generate embeddings if OpenAI key is available
        if chunk_records and is_embedding_available():
            logger.info("Generating embeddings for %d chunks", len(chunk_records))
            texts = [c["content"] for c in chunk_records]
            embeddings = generate_embeddings(texts)

            # Update each chunk with its embedding
            if insert_result.data:
                for chunk_row, embedding in zip(insert_result.data, embeddings):
                    supabase.table("content_chunks").update(
                        {"embedding": embedding}
                    ).eq("id", chunk_row["id"]).execute()

                logger.info("Embeddings saved for document %s", document["id"])
        elif chunk_records:
            logger.info(
                "Skipping embeddings for document %s (no OPENAI_API_KEY)",
                document["id"],
            )

        # Update document status to parsed
        supabase.table("documents").update({"status": "parsed"}).eq(
            "id", document["id"]
        ).execute()
        document["status"] = "parsed"

    except Exception as exc:
        logger.exception("Failed to process document %s: %s", document["id"], exc)
        supabase.table("documents").update({"status": "error"}).eq(
            "id", document["id"]
        ).execute()
        document["status"] = "error"

    return DocumentResponse(**document, chunk_count=chunk_count)


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

    documents: list[DocumentResponse] = []
    for row in result.data:
        # Get chunk count for each document
        count_result = (
            supabase.table("content_chunks")
            .select("id", count="exact")
            .eq("document_id", row["id"])
            .execute()
        )
        chunk_count = count_result.count if count_result.count else 0
        documents.append(DocumentResponse(**row, chunk_count=chunk_count))

    return documents
