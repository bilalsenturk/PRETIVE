import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.db.supabase import get_supabase
from app.services.embedding import generate_embeddings, is_embedding_available
from app.services.ingestion import parse_document
from app.services.narrative import build_narrative_graph, generate_session_cards

logger = logging.getLogger(__name__)

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


class PrepareResponse(BaseModel):
    session_id: str
    status: str
    documents_parsed: int
    total_chunks: int
    topics_count: int
    cards_generated: int


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


@router.get("/{session_id}/cards")
async def list_session_cards(session_id: str):
    """List all generated cards for a session."""
    supabase = get_supabase()
    result = (
        supabase.table("session_cards")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str) -> None:
    """Delete a session by ID."""
    supabase = get_supabase()
    supabase.table("sessions").delete().eq("id", session_id).execute()


@router.post("/{session_id}/prepare", response_model=PrepareResponse)
async def prepare_session(session_id: str) -> PrepareResponse:
    """Run the narrative engine: parse docs, build graph, generate cards.

    This endpoint orchestrates the full preparation pipeline:
    1. Update session status to 'preparing'
    2. Parse any unparsed documents into content_chunks
    3. Build a narrative graph from all chunks
    4. Generate session cards from the graph
    5. Update session status to 'ready'
    """
    supabase = get_supabase()

    # Verify session exists
    session_result = (
        supabase.table("sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # Update status to preparing
    supabase.table("sessions").update({"status": "preparing"}).eq(
        "id", session_id
    ).execute()

    documents_parsed = 0
    total_chunks = 0
    topics_count = 0
    cards_generated = 0

    try:
        # Get all documents for this session
        docs_result = (
            supabase.table("documents")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        documents = docs_result.data or []

        if not documents:
            raise HTTPException(
                status_code=400,
                detail="No documents found for this session. Upload documents first.",
            )

        # Parse each unparsed document
        for doc in documents:
            if doc["status"] in ("processing", "error"):
                try:
                    # Download file from storage
                    file_bytes = supabase.storage.from_("documents").download(
                        doc["storage_path"]
                    )

                    # Parse into chunks
                    chunks = parse_document(file_bytes, doc["file_type"])
                    logger.info(
                        "Parsed document %s: %d chunks", doc["id"], len(chunks)
                    )

                    # Save to content_chunks
                    chunk_records = [
                        {
                            "document_id": doc["id"],
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
                            supabase.table("content_chunks")
                            .insert(chunk_records)
                            .execute()
                        )

                        # Generate embeddings if available
                        if is_embedding_available() and insert_result.data:
                            texts = [c["content"] for c in chunk_records]
                            embeddings = generate_embeddings(texts)
                            for row, emb in zip(insert_result.data, embeddings):
                                supabase.table("content_chunks").update(
                                    {"embedding": emb}
                                ).eq("id", row["id"]).execute()

                    # Update document status
                    supabase.table("documents").update({"status": "parsed"}).eq(
                        "id", doc["id"]
                    ).execute()
                    documents_parsed += 1

                except Exception as exc:
                    logger.exception(
                        "Failed to parse document %s: %s", doc["id"], exc
                    )
                    supabase.table("documents").update({"status": "error"}).eq(
                        "id", doc["id"]
                    ).execute()
            elif doc["status"] == "parsed":
                documents_parsed += 1

        # Count total chunks for this session
        chunks_result = (
            supabase.table("content_chunks")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .execute()
        )
        total_chunks = chunks_result.count if chunks_result.count else 0

        if total_chunks == 0:
            raise HTTPException(
                status_code=400,
                detail="No content chunks could be extracted from the documents.",
            )

        # Build narrative graph
        logger.info("Building narrative graph for session %s", session_id)
        graph = build_narrative_graph(session_id)
        topics_count = len(graph.get("topics", []))

        # Generate session cards
        logger.info("Generating session cards for session %s", session_id)
        cards = generate_session_cards(session_id, graph)
        cards_generated = len(cards)

        # Update session status to ready
        supabase.table("sessions").update({"status": "ready"}).eq(
            "id", session_id
        ).execute()

        return PrepareResponse(
            session_id=session_id,
            status="ready",
            documents_parsed=documents_parsed,
            total_chunks=total_chunks,
            topics_count=topics_count,
            cards_generated=cards_generated,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 400 errors)
        supabase.table("sessions").update({"status": "error"}).eq(
            "id", session_id
        ).execute()
        raise
    except Exception as exc:
        logger.exception("Session preparation failed for %s: %s", session_id, exc)
        supabase.table("sessions").update({"status": "error"}).eq(
            "id", session_id
        ).execute()
        raise HTTPException(
            status_code=500, detail=f"Session preparation failed: {str(exc)}"
        )
