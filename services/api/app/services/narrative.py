"""Narrative engine: builds topic graphs and generates session cards from content chunks.

Uses the LLM (via OpenAI-compatible endpoint). No mock/fallback generation.
"""

import json
import logging
import uuid

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError

from app.db.supabase import get_supabase
from app.services.llm import chat_completion_json

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic models for graph validation
# ---------------------------------------------------------------------------


class TopicNode(BaseModel):
    id: str
    title: str
    summary: str
    chunk_ids: list[str] = []
    children: list["TopicNode"] = []


class NarrativeGraph(BaseModel):
    topics: list[TopicNode]


# ---------------------------------------------------------------------------
# Narrative graph
# ---------------------------------------------------------------------------

_GRAPH_SYSTEM_PROMPT = """You are a knowledge-structuring assistant. Given a set of text chunks from uploaded documents, create a structured topic tree.

Return a JSON object with this exact schema:
{
  "topics": [
    {
      "id": "<unique-id>",
      "title": "<topic title>",
      "summary": "<brief summary of the topic>",
      "chunk_ids": ["<chunk_id_1>", "<chunk_id_2>"],
      "children": [
        {
          "id": "<unique-id>",
          "title": "<subtopic title>",
          "summary": "<brief summary>",
          "chunk_ids": ["<chunk_id>"],
          "children": []
        }
      ]
    }
  ]
}

Rules:
- Identify 3-8 main topics from the content.
- Each topic can have 0-5 children (subtopics).
- Reference the chunk IDs that belong to each topic in chunk_ids.
- Keep summaries concise (1-2 sentences).
- Use unique string IDs for topics and subtopics."""


def build_narrative_graph(session_id: str) -> dict:
    """Read all content_chunks for a session and build a narrative topic graph.

    Args:
        session_id: The session to build the graph for.

    Returns:
        A validated NarrativeGraph as a dict.

    Raises:
        HTTPException: If the graph generation fails.
        ValueError: If session_id is empty.
    """
    if not session_id or not session_id.strip():
        raise ValueError("session_id is required")

    supabase = get_supabase()

    result = (
        supabase.table("content_chunks")
        .select("*")
        .eq("session_id", session_id)
        .order("chunk_index")
        .execute()
    )
    chunks = result.data or []

    if not chunks:
        logger.warning("No content chunks found for session %s", session_id)
        return {"topics": []}

    return _build_graph_with_llm(chunks)


def _build_graph_with_llm(chunks: list[dict]) -> dict:
    """Use the LLM to create a structured topic tree from chunks.

    Raises:
        HTTPException: If LLM call or validation fails.
    """
    # Prepare chunk text for the prompt, including chunk IDs
    chunk_texts = []
    for c in chunks:
        chunk_id = c.get("id", "")
        heading = c.get("heading") or "Untitled"
        chunk_texts.append(f"[Chunk ID: {chunk_id}] [{heading}]\n{c['content']}")

    combined = "\n\n---\n\n".join(chunk_texts)

    # Truncate if extremely long (keep first ~60k chars to stay within context)
    original_len = len(combined)
    if original_len > 60000:
        combined = combined[:60000] + "\n\n[...truncated]"
        logger.warning(
            "Content truncated from %d to 60000 chars for narrative graph",
            original_len,
        )

    messages = [
        {"role": "system", "content": _GRAPH_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Here are the document chunks:\n\n{combined}\n\nCreate the structured topic tree JSON.",
        },
    ]

    try:
        graph_raw = chat_completion_json(messages)
    except Exception as exc:
        logger.exception("LLM narrative graph generation failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Narrative graph generation failed",
        ) from exc

    # Ensure the expected top-level key exists
    if "topics" not in graph_raw:
        graph_raw = {"topics": [graph_raw] if isinstance(graph_raw, dict) else []}

    # Validate with pydantic
    try:
        validated = NarrativeGraph(**graph_raw)
        logger.info("LLM narrative graph: %d topics", len(validated.topics))
        return validated.model_dump()
    except ValidationError as exc:
        logger.exception("Narrative graph validation failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Narrative graph generation failed: invalid graph structure",
        ) from exc


# ---------------------------------------------------------------------------
# Session cards
# ---------------------------------------------------------------------------

_CARDS_SYSTEM_PROMPT = """You are a presentation card generator. Given a topic from a knowledge graph, generate presentation cards.

For each topic, create these card types:
1. "summary" - A concise overview of the topic (2-3 sentences)
2. "concept" - Key terms and definitions related to the topic
3. "comparison" - If the topic can be compared/contrasted with something, create a comparison card (otherwise skip)
4. "context_bridge" - How this topic connects to other topics in the presentation

Return a JSON object:
{
  "cards": [
    {
      "card_type": "summary|concept|comparison|context_bridge",
      "title": "<card title>",
      "content": "<card content as markdown>",
      "chunk_ids": ["<chunk_id_1>", "<chunk_id_2>"]
    }
  ]
}

Each card MUST include a chunk_ids array referencing the source chunk IDs.
Keep card content concise and presentation-ready. Use bullet points where appropriate."""


def generate_session_cards(session_id: str, graph: dict) -> list[dict]:
    """Generate session cards from a narrative graph using the LLM.

    Args:
        session_id: The session these cards belong to.
        graph: The narrative graph from build_narrative_graph().

    Returns:
        List of saved card dicts.

    Raises:
        HTTPException: If card generation or saving fails.
        ValueError: If session_id is empty.
    """
    if not session_id or not session_id.strip():
        raise ValueError("session_id is required")

    topics = graph.get("topics", [])
    if not topics:
        logger.warning("Empty graph for session %s, no cards to generate", session_id)
        return []

    all_cards: list[dict] = []
    display_order = 0

    for topic in topics:
        topic_json = json.dumps(topic, indent=2)
        messages = [
            {"role": "system", "content": _CARDS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Generate presentation cards for this topic:\n\n{topic_json}"
                ),
            },
        ]

        try:
            result = chat_completion_json(messages)
            cards_data = result.get("cards", [])
        except Exception as exc:
            logger.exception(
                "LLM card generation failed for topic '%s': %s",
                topic.get("title"),
                exc,
            )
            raise HTTPException(
                status_code=500,
                detail=f"Card generation failed for topic '{topic.get('title', 'unknown')}'",
            ) from exc

        # Extract chunk_ids from the topic for fallback linking
        topic_chunk_ids = topic.get("chunk_ids", [])

        for card in cards_data:
            # Use chunk_ids from the card if provided, otherwise from the topic
            card_chunk_ids = card.get("chunk_ids", topic_chunk_ids)
            # Take the first chunk_id for the DB column
            chunk_id = card_chunk_ids[0] if card_chunk_ids else None

            all_cards.append(
                {
                    "session_id": session_id,
                    "card_type": card.get("card_type", "summary"),
                    "title": card.get("title", topic.get("title", "Untitled")),
                    "content": {"text": card.get("content", "")},
                    "chunk_id": chunk_id,
                    "display_order": display_order,
                }
            )
            display_order += 1

    # Save cards to session_cards table
    if not all_cards:
        logger.warning("No cards generated for session %s", session_id)
        return []

    supabase = get_supabase()
    try:
        result = supabase.table("session_cards").insert(all_cards).execute()
        saved = result.data or []
        logger.info("Saved %d cards for session %s", len(saved), session_id)
        return saved
    except Exception as exc:
        logger.exception("Failed to save cards for session %s: %s", session_id, exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to save session cards to database",
        ) from exc
