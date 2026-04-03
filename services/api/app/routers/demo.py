"""Demo seeder — creates a complete ready-to-go demo session in one call.

Allows 1-click demo without waiting for document upload and LLM processing.
Includes chunks with headings, pre-built narrative graph, dynamic slides,
and session cards so all features work out of the box.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class DemoSeedResponse(BaseModel):
    session_id: str
    message: str


# ---------------------------------------------------------------------------
# Demo content — "How to Give a Great Online Training Session"
# ---------------------------------------------------------------------------

DEMO_TITLE = "How to Give a Great Online Training Session"
DEMO_DOC_NAME = "online-training-best-practices.pdf"

DEMO_CHUNKS = [
    {
        "heading": "Introduction",
        "content": "Online training has become the primary delivery method for professional education. Over 70% of companies now use online learning as part of their training programs. The shift to remote work has made live online sessions a critical skill for educators and trainers. This session covers the key principles of effective online training delivery.",
    },
    {
        "heading": "Preparation and Structure",
        "content": "Effective online training starts with preparation. Define your learning objectives before designing content. Structure your session into clear segments of 10-15 minutes each. Prepare your slides, notes, and supporting materials. Test your technology setup at least 30 minutes before the session. Have a backup plan for technical failures.",
    },
    {
        "heading": "Opening and Engagement",
        "content": "The first 3 minutes determine whether your audience stays engaged. Start with a compelling question or a surprising statistic. Introduce yourself briefly and state the session objectives. Set expectations for interaction: when to ask questions, how to use chat, and what the audience will learn by the end.",
    },
    {
        "heading": "Content Delivery Techniques",
        "content": "Use the 10-2-1 rule: 10 minutes of content, 2 minutes of discussion, 1 minute of summary. Vary your delivery pace to maintain attention. Use concrete examples and real-world scenarios instead of abstract concepts. Share your screen only when necessary — your face builds trust. Use visual aids sparingly but effectively.",
    },
    {
        "heading": "Managing Questions and Interaction",
        "content": "Designate specific Q&A windows rather than accepting questions at any time. Repeat the question before answering so everyone understands the context. If a question is off-topic, acknowledge it and offer to follow up after the session. Use polls and quick exercises to check understanding without disrupting flow.",
    },
    {
        "heading": "Timing and Pacing",
        "content": "Most presenters underestimate how long their content takes. Plan for 80% of your available time — leave 20% buffer for questions and technical issues. Use a visible timer. If you are running behind, cut examples rather than rushing through core concepts. Never go over time; it signals disrespect for your audience.",
    },
    {
        "heading": "Handling Technical Issues",
        "content": "Technical problems are inevitable in online training. Prepare a troubleshooting checklist. If your internet drops, have a phone hotspot ready. If screen sharing fails, describe what the audience should see. Stay calm — your reaction to problems sets the tone. The audience remembers your recovery, not the problem.",
    },
    {
        "heading": "Closing and Follow-up",
        "content": "End with a clear summary of key takeaways. Provide actionable next steps the audience can implement immediately. Share resources and links in the chat. Ask for feedback while the experience is fresh. Send a follow-up email within 24 hours with session recording, notes, and additional resources.",
    },
    {
        "heading": "Measuring Effectiveness",
        "content": "Track three metrics after every session: completion rate, participant satisfaction score, and knowledge retention. Use post-session surveys with no more than 5 questions. Compare your metrics across sessions to identify patterns. Review session recordings to spot areas for improvement in your delivery.",
    },
    {
        "heading": "Continuous Improvement",
        "content": "The best online trainers review every session. Watch your own recordings. Ask a colleague to observe and give honest feedback. Experiment with one new technique per session. Build a personal library of examples, analogies, and exercises that work for your audience. Teaching is a skill that improves with deliberate practice.",
    },
]

DEMO_CARDS = [
    {
        "type": "summary",
        "title": "Session Overview",
        "content": {"text": "This session covers 10 key principles for effective online training: preparation, engagement, delivery, Q&A management, timing, technical resilience, closing, measurement, and continuous improvement."},
        "chunk_index": 0,
    },
    {
        "type": "concept",
        "title": "The 10-2-1 Rule",
        "content": {"text": "10 minutes of content delivery, 2 minutes of audience discussion, 1 minute of summary. This rhythm prevents cognitive overload and keeps the audience engaged throughout."},
        "chunk_index": 3,
    },
    {
        "type": "concept",
        "title": "The 80/20 Time Rule",
        "content": {"text": "Plan content for 80% of available time. Reserve 20% as buffer for questions, technical issues, and natural conversation. Never exceed the scheduled end time."},
        "chunk_index": 5,
    },
    {
        "type": "comparison",
        "title": "Scripted vs. Guided Delivery",
        "content": {"text": "Scripted: every word planned, less natural, hard to adapt. Guided: key points with flexible delivery, more natural, adapts to audience. Best approach: guided delivery with scripted opening and closing."},
        "chunk_index": 3,
    },
    {
        "type": "concept",
        "title": "First 3 Minutes",
        "content": {"text": "The opening 3 minutes determine engagement for the entire session. Use a compelling question, surprising statistic, or relatable scenario. Avoid long introductions."},
        "chunk_index": 2,
    },
    {
        "type": "context_bridge",
        "title": "From Delivery to Measurement",
        "content": {"text": "Great delivery is only half the equation. Without measuring completion rates, satisfaction, and retention, you cannot improve systematically. Connect each session to measurable outcomes."},
        "chunk_index": 8,
    },
    {
        "type": "summary",
        "title": "Q&A Best Practices",
        "content": {"text": "Designate Q&A windows. Repeat questions before answering. Park off-topic questions. Use polls to check understanding. Never let Q&A derail your narrative thread."},
        "chunk_index": 4,
    },
    {
        "type": "concept",
        "title": "Recovery Over Prevention",
        "content": {"text": "Technical issues are inevitable. What matters is your response. Stay calm, have backups ready, describe what the audience should see. The audience remembers your recovery, not the problem."},
        "chunk_index": 6,
    },
]

DEMO_NARRATIVE_GRAPH = {
    "topics": [
        {
            "id": "topic-intro",
            "title": "Introduction",
            "summary": "Why online training delivery matters and what this session covers.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-prep",
            "title": "Preparation and Structure",
            "summary": "How to prepare effectively before a live session.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-opening",
            "title": "Opening and Engagement",
            "summary": "Making the first 3 minutes count.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-delivery",
            "title": "Content Delivery Techniques",
            "summary": "The 10-2-1 rule and practical delivery methods.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-qa",
            "title": "Managing Questions",
            "summary": "Handling Q&A without breaking flow.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-timing",
            "title": "Timing and Pacing",
            "summary": "The 80/20 rule and staying on schedule.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-tech",
            "title": "Handling Technical Issues",
            "summary": "Staying resilient when technology fails.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-closing",
            "title": "Closing and Follow-up",
            "summary": "Ending strong and maintaining engagement after the session.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-metrics",
            "title": "Measuring Effectiveness",
            "summary": "Three key metrics to track after every session.",
            "chunk_ids": [],
            "children": [],
        },
        {
            "id": "topic-improve",
            "title": "Continuous Improvement",
            "summary": "How the best trainers keep getting better.",
            "chunk_ids": [],
            "children": [],
        },
    ]
}

DEMO_DYNAMIC_SLIDES = {
    "current_topic_index": 0,
    "current_item_index": -1,
    "topics": [
        {
            "id": "topic-intro",
            "title": "Introduction",
            "items": [
                {"text": "Over 70% of companies now use online learning", "revealed": False, "chunk_ids": []},
                {"text": "Remote work made live sessions a critical skill", "revealed": False, "chunk_ids": []},
                {"text": "This session covers 10 key principles", "revealed": False, "chunk_ids": []},
            ],
            "status": "active",
        },
        {
            "id": "topic-prep",
            "title": "Preparation and Structure",
            "items": [
                {"text": "Define learning objectives first", "revealed": False, "chunk_ids": []},
                {"text": "Structure into 10-15 minute segments", "revealed": False, "chunk_ids": []},
                {"text": "Test technology 30 minutes before", "revealed": False, "chunk_ids": []},
                {"text": "Always have a backup plan", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
        {
            "id": "topic-opening",
            "title": "Opening and Engagement",
            "items": [
                {"text": "First 3 minutes determine engagement", "revealed": False, "chunk_ids": []},
                {"text": "Start with a question or surprising statistic", "revealed": False, "chunk_ids": []},
                {"text": "Set expectations for interaction", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
        {
            "id": "topic-delivery",
            "title": "Content Delivery Techniques",
            "items": [
                {"text": "Use the 10-2-1 rule for rhythm", "revealed": False, "chunk_ids": []},
                {"text": "Vary your delivery pace", "revealed": False, "chunk_ids": []},
                {"text": "Use concrete examples, not abstractions", "revealed": False, "chunk_ids": []},
                {"text": "Show your face — it builds trust", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
        {
            "id": "topic-qa",
            "title": "Managing Questions",
            "items": [
                {"text": "Designate specific Q&A windows", "revealed": False, "chunk_ids": []},
                {"text": "Repeat the question before answering", "revealed": False, "chunk_ids": []},
                {"text": "Park off-topic questions for follow-up", "revealed": False, "chunk_ids": []},
                {"text": "Use polls to check understanding", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
        {
            "id": "topic-timing",
            "title": "Timing and Pacing",
            "items": [
                {"text": "Plan for 80% of available time", "revealed": False, "chunk_ids": []},
                {"text": "Cut examples before rushing core concepts", "revealed": False, "chunk_ids": []},
                {"text": "Never go over time", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
        {
            "id": "topic-tech",
            "title": "Handling Technical Issues",
            "items": [
                {"text": "Problems are inevitable — prepare a checklist", "revealed": False, "chunk_ids": []},
                {"text": "Have a phone hotspot as backup", "revealed": False, "chunk_ids": []},
                {"text": "Stay calm — your reaction sets the tone", "revealed": False, "chunk_ids": []},
                {"text": "The audience remembers recovery, not the problem", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
        {
            "id": "topic-closing",
            "title": "Closing and Follow-up",
            "items": [
                {"text": "Summarize key takeaways clearly", "revealed": False, "chunk_ids": []},
                {"text": "Provide actionable next steps", "revealed": False, "chunk_ids": []},
                {"text": "Send follow-up email within 24 hours", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
        {
            "id": "topic-metrics",
            "title": "Measuring Effectiveness",
            "items": [
                {"text": "Track completion rate", "revealed": False, "chunk_ids": []},
                {"text": "Track participant satisfaction", "revealed": False, "chunk_ids": []},
                {"text": "Track knowledge retention", "revealed": False, "chunk_ids": []},
                {"text": "Compare metrics across sessions", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
        {
            "id": "topic-improve",
            "title": "Continuous Improvement",
            "items": [
                {"text": "Watch your own recordings", "revealed": False, "chunk_ids": []},
                {"text": "Ask a colleague for honest feedback", "revealed": False, "chunk_ids": []},
                {"text": "Experiment with one new technique per session", "revealed": False, "chunk_ids": []},
            ],
            "status": "pending",
        },
    ],
}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/seed", response_model=DemoSeedResponse, status_code=201)
async def seed_demo(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> DemoSeedResponse:
    """Create a complete demo session with document, chunks, cards,
    narrative graph, and dynamic slides — ready for immediate use.
    """
    user_id = x_user_id or DEMO_USER_ID
    logger.info("Seeding demo session for user=%s", user_id)

    supabase = get_supabase()

    try:
        # 1. Create session with metadata (narrative graph + dynamic slides)
        metadata = {
            "narrative_graph": DEMO_NARRATIVE_GRAPH,
            "dynamic_slides": DEMO_DYNAMIC_SLIDES,
        }

        session_result = (
            supabase.table("sessions")
            .insert({
                "title": DEMO_TITLE,
                "status": "ready",
                "user_id": user_id,
                "metadata": metadata,
            })
            .execute()
        )
        if not session_result.data:
            raise HTTPException(status_code=500, detail="Failed to create demo session")

        session = session_result.data[0]
        session_id = session["id"]
        logger.info("Demo session created id=%s", session_id)

        # 2. Create document record
        doc_result = (
            supabase.table("documents")
            .insert({
                "session_id": session_id,
                "file_name": DEMO_DOC_NAME,
                "file_type": "pdf",
                "status": "parsed",
            })
            .execute()
        )
        if not doc_result.data:
            raise HTTPException(status_code=500, detail="Failed to create demo document")

        doc_id = doc_result.data[0]["id"]

        # 3. Insert content chunks with headings
        chunk_records = []
        chunk_id_map = {}  # index -> id (will be filled after insert)

        for i, chunk in enumerate(DEMO_CHUNKS):
            chunk_records.append({
                "document_id": doc_id,
                "session_id": session_id,
                "chunk_index": i,
                "heading": chunk["heading"],
                "content": chunk["content"],
                "chunk_type": "text",
            })

        chunks_result = supabase.table("content_chunks").insert(chunk_records).execute()
        inserted_chunks = chunks_result.data or []

        # Map chunk index to actual UUID
        for c in inserted_chunks:
            chunk_id_map[c["chunk_index"]] = c["id"]

        logger.info("Inserted %d demo chunks", len(inserted_chunks))

        # 4. Update narrative graph and dynamic slides with real chunk IDs
        for i, topic in enumerate(DEMO_NARRATIVE_GRAPH["topics"]):
            if i in chunk_id_map:
                topic["chunk_ids"] = [chunk_id_map[i]]

        for i, topic in enumerate(DEMO_DYNAMIC_SLIDES["topics"]):
            if i in chunk_id_map:
                cid = chunk_id_map[i]
                for item in topic.get("items", []):
                    item["chunk_ids"] = [cid]

        # Save updated metadata with real chunk IDs
        supabase.table("sessions").update({
            "metadata": {
                "narrative_graph": DEMO_NARRATIVE_GRAPH,
                "dynamic_slides": DEMO_DYNAMIC_SLIDES,
            }
        }).eq("id", session_id).execute()

        # 5. Insert session cards with chunk references
        card_records = []
        for card in DEMO_CARDS:
            ci = card.get("chunk_index", 0)
            card_records.append({
                "session_id": session_id,
                "card_type": card["type"],
                "title": card["title"],
                "content": json.dumps(card["content"]),
                "chunk_id": chunk_id_map.get(ci),
                "display_order": len(card_records),
            })

        supabase.table("session_cards").insert(card_records).execute()
        logger.info("Inserted %d demo cards", len(card_records))

        # 6. Try to generate embeddings for matching (non-fatal if fails)
        try:
            from app.services.embedding import generate_embeddings
            texts = [c["content"] for c in DEMO_CHUNKS]
            embeddings = generate_embeddings(texts)
            if embeddings and len(embeddings) == len(inserted_chunks):
                for chunk_data, embedding in zip(inserted_chunks, embeddings):
                    supabase.table("content_chunks").update({
                        "embedding": list(embedding)
                    }).eq("id", chunk_data["id"]).execute()
                logger.info("Generated embeddings for %d demo chunks", len(embeddings))
        except Exception as emb_err:
            logger.warning("Embedding generation skipped for demo: %s", emb_err)

        logger.info("Demo session seeding complete: session_id=%s", session_id)
        return DemoSeedResponse(
            session_id=session_id,
            message="Demo session created — ready to present",
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to seed demo session: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to seed demo: {str(exc)}")
