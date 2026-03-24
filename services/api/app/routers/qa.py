"""Q&A module — participants ask questions, AI suggests answers from content."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.db.supabase import get_supabase
from app.services.matching import find_matching_chunks
from datetime import datetime, timezone

router = APIRouter(prefix="/api/sessions", tags=["qa"])


class QuestionCreate(BaseModel):
    text: str = Field(..., min_length=3, max_length=500)
    participant_name: str = Field(default="Anonymous", max_length=100)


class QuestionVote(BaseModel):
    direction: str = Field(..., pattern="^(up|down)$")


# POST /{session_id}/qa/questions — submit a question
@router.post("/{session_id}/qa/questions")
async def submit_question(session_id: str, body: QuestionCreate):
    supabase = get_supabase()

    # Find relevant content chunks for AI answer
    chunks = find_matching_chunks(body.text, session_id, top_k=2)
    ai_context = " ".join([c.get("content", "")[:200] for c in chunks])

    question = {
        "session_id": session_id,
        "text": body.text,
        "participant_name": body.participant_name,
        "status": "pending",  # pending, answered, dismissed
        "upvotes": 0,
        "ai_context": ai_context[:500] if ai_context else None,
        "answer": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    result = supabase.table("session_questions").insert(question).execute()
    return result.data[0] if result.data else question


# GET /{session_id}/qa/questions — list questions
@router.get("/{session_id}/qa/questions")
async def list_questions(session_id: str, status: str = None):
    supabase = get_supabase()
    query = supabase.table("session_questions").select("*").eq("session_id", session_id)
    if status:
        query = query.eq("status", status)
    result = query.order("upvotes", desc=True).order("created_at", desc=True).execute()
    return result.data or []


# POST /{session_id}/qa/questions/{question_id}/vote — upvote
@router.post("/{session_id}/qa/questions/{question_id}/vote")
async def vote_question(session_id: str, question_id: str, body: QuestionVote):
    supabase = get_supabase()
    # Get current
    result = supabase.table("session_questions").select("upvotes").eq("id", question_id).execute()
    if not result.data:
        raise HTTPException(404, "Question not found")
    current = result.data[0]["upvotes"]
    new_votes = current + (1 if body.direction == "up" else -1)
    supabase.table("session_questions").update({"upvotes": max(0, new_votes)}).eq("id", question_id).execute()
    return {"upvotes": max(0, new_votes)}


# PATCH /{session_id}/qa/questions/{question_id}/answer — presenter answers
@router.patch("/{session_id}/qa/questions/{question_id}/answer")
async def answer_question(session_id: str, question_id: str, body: dict):
    supabase = get_supabase()
    supabase.table("session_questions").update({
        "answer": body.get("answer", ""),
        "status": "answered",
    }).eq("id", question_id).execute()
    return {"status": "answered"}


# PATCH /{session_id}/qa/questions/{question_id}/dismiss
@router.patch("/{session_id}/qa/questions/{question_id}/dismiss")
async def dismiss_question(session_id: str, question_id: str):
    supabase = get_supabase()
    supabase.table("session_questions").update({"status": "dismissed"}).eq("id", question_id).execute()
    return {"status": "dismissed"}
