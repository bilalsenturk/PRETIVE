"""Narrative engine: builds topic graphs and generates session cards from content chunks.

Uses the LLM (Kimi K2.5 via OpenRouter / OpenAI) when available.
Falls back to mock/heuristic generation when no API key is configured.
"""

import json
import logging
import uuid
from collections import defaultdict

from app.db.supabase import get_supabase
from app.services.llm import chat_completion_json, is_llm_available

logger = logging.getLogger(__name__)

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
      "subtopics": [
        {
          "id": "<unique-id>",
          "title": "<subtopic title>",
          "summary": "<brief summary>",
          "key_concepts": [
            {"term": "<concept name>", "definition": "<short definition>"}
          ]
        }
      ],
      "key_concepts": [
        {"term": "<concept name>", "definition": "<short definition>"}
      ],
      "connections": ["<id of related topic>"]
    }
  ]
}

Rules:
- Identify 3-8 main topics from the content.
- Each topic can have 0-5 subtopics.
- Extract key concepts (terms + definitions) at both topic and subtopic level.
- Identify connections between related topics.
- Keep summaries concise (1-2 sentences).
- Use unique string IDs for topics and subtopics."""


def build_narrative_graph(session_id: str) -> dict:
    """Read all content_chunks for a session and build a narrative topic graph.

    Args:
        session_id: The session to build the graph for.

    Returns:
        A structured JSON dict with topics, subtopics, key concepts, and connections.
    """
    supabase = get_supabase()

    # Fetch all content chunks for this session
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

    if is_llm_available():
        return _build_graph_with_llm(chunks)
    else:
        logger.info("No LLM_API_KEY set. Building mock narrative graph from headings.")
        return _build_mock_graph(chunks)


def _build_graph_with_llm(chunks: list[dict]) -> dict:
    """Use the LLM to create a structured topic tree from chunks."""
    # Prepare chunk text for the prompt
    chunk_texts = []
    for c in chunks:
        heading = c.get("heading") or "Untitled"
        chunk_texts.append(f"[{heading}]\n{c['content']}")

    combined = "\n\n---\n\n".join(chunk_texts)

    # Truncate if extremely long (keep first ~60k chars to stay within context)
    if len(combined) > 60000:
        combined = combined[:60000] + "\n\n[...truncated]"

    messages = [
        {"role": "system", "content": _GRAPH_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Here are the document chunks:\n\n{combined}\n\nCreate the structured topic tree JSON.",
        },
    ]

    try:
        graph = chat_completion_json(messages)
        # Ensure the expected top-level key exists
        if "topics" not in graph:
            graph = {"topics": [graph] if isinstance(graph, dict) else []}
        logger.info("LLM narrative graph: %d topics", len(graph.get("topics", [])))
        return graph
    except Exception as exc:
        logger.exception("LLM graph generation failed: %s. Falling back to mock.", exc)
        return _build_mock_graph(chunks)


def _build_mock_graph(chunks: list[dict]) -> dict:
    """Generate a simple topic graph from chunk headings (no LLM needed)."""
    # Group chunks by heading
    groups: dict[str, list[dict]] = defaultdict(list)
    for c in chunks:
        heading = c.get("heading") or "General"
        groups[heading].append(c)

    topics = []
    topic_ids = []
    for heading, group_chunks in groups.items():
        topic_id = uuid.uuid4().hex[:8]
        topic_ids.append(topic_id)

        # Extract simple key concepts from first few words of each chunk
        key_concepts = []
        for gc in group_chunks[:3]:
            first_line = gc["content"].split("\n")[0][:100]
            key_concepts.append({"term": first_line[:50], "definition": first_line})

        summary = group_chunks[0]["content"][:200] + "..."
        topics.append(
            {
                "id": topic_id,
                "title": heading,
                "summary": summary,
                "subtopics": [],
                "key_concepts": key_concepts,
                "connections": [],
            }
        )

    # Add basic connections (sequential topics are connected)
    for i, topic in enumerate(topics):
        if i > 0:
            topic["connections"].append(topics[i - 1]["id"])
        if i < len(topics) - 1:
            topic["connections"].append(topics[i + 1]["id"])

    return {"topics": topics}


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
      "content": "<card content as markdown>"
    }
  ]
}

Keep card content concise and presentation-ready. Use bullet points where appropriate."""


def generate_session_cards(session_id: str, graph: dict) -> list[dict]:
    """Generate session cards from a narrative graph.

    For each topic node, creates summary, concept, comparison, and context_bridge cards.

    Args:
        session_id: The session these cards belong to.
        graph: The narrative graph from build_narrative_graph().

    Returns:
        List of created card dicts.
    """
    topics = graph.get("topics", [])
    if not topics:
        logger.warning("Empty graph for session %s, no cards to generate", session_id)
        return []

    if is_llm_available():
        cards = _generate_cards_with_llm(session_id, graph)
    else:
        logger.info("No LLM_API_KEY set. Generating cards from chunk text directly.")
        cards = _generate_mock_cards(session_id, graph)

    # Save cards to session_cards table
    supabase = get_supabase()
    if cards:
        try:
            result = supabase.table("session_cards").insert(cards).execute()
            saved = result.data or []
            logger.info("Saved %d cards for session %s", len(saved), session_id)
            return saved
        except Exception as exc:
            logger.exception("Failed to save cards for session %s: %s", session_id, exc)
            return cards  # Return unsaved cards so caller knows what was generated

    return []


def _generate_cards_with_llm(session_id: str, graph: dict) -> list[dict]:
    """Use the LLM to generate rich card content from the narrative graph."""
    all_cards: list[dict] = []

    for topic in graph.get("topics", []):
        topic_json = json.dumps(topic, indent=2)
        messages = [
            {"role": "system", "content": _CARDS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Generate presentation cards for this topic:\n\n{topic_json}\n\n"
                    f"Connected topics context: {json.dumps(topic.get('connections', []))}"
                ),
            },
        ]

        try:
            result = chat_completion_json(messages)
            cards_data = result.get("cards", [])

            for card in cards_data:
                all_cards.append(
                    {
                        "session_id": session_id,
                                                "card_type": card.get("card_type", "summary"),
                        "title": card.get("title", topic.get("title", "Untitled")),
                        "content": {"text": card.get("content", "")},
                    }
                )
        except Exception as exc:
            logger.warning(
                "LLM card generation failed for topic '%s': %s. Using fallback.",
                topic.get("title"),
                exc,
            )
            all_cards.extend(_mock_cards_for_topic(session_id, topic))

    return all_cards


def _generate_mock_cards(session_id: str, graph: dict) -> list[dict]:
    """Generate cards directly from graph data without LLM."""
    all_cards: list[dict] = []
    for topic in graph.get("topics", []):
        all_cards.extend(_mock_cards_for_topic(session_id, topic))
    return all_cards


def _mock_cards_for_topic(session_id: str, topic: dict) -> list[dict]:
    """Create mock cards for a single topic node."""
    topic_id = topic.get("id", "")
    title = topic.get("title", "Untitled")
    summary = topic.get("summary", "")
    key_concepts = topic.get("key_concepts", [])
    connections = topic.get("connections", [])

    cards: list[dict] = []

    # Summary card
    cards.append(
        {
            "session_id": session_id,
            "topic_id": topic_id,
            "card_type": "summary",
            "title": f"Overview: {title}",
            "content": {"text": summary},
        }
    )

    # Concept card
    if key_concepts:
        concept_lines = [
            f"- **{kc.get('term', '')}**: {kc.get('definition', '')}"
            for kc in key_concepts
        ]
        cards.append(
            {
                "session_id": session_id,
                "topic_id": topic_id,
                "card_type": "concept",
                "title": f"Key Concepts: {title}",
                "content": {"text": "\n".join(concept_lines)},
            }
        )

    # Subtopic concepts
    for subtopic in topic.get("subtopics", []):
        sub_concepts = subtopic.get("key_concepts", [])
        if sub_concepts:
            sub_lines = [
                f"- **{kc.get('term', '')}**: {kc.get('definition', '')}"
                for kc in sub_concepts
            ]
            cards.append(
                {
                    "session_id": session_id,
                    "card_type": "concept",
                    "title": f"Concepts: {subtopic.get('title', '')}",
                    "content": {"text": "\n".join(sub_lines)},
                }
            )

    # Context bridge card (if there are connections)
    if connections:
        cards.append(
            {
                "session_id": session_id,
                "topic_id": topic_id,
                "card_type": "context_bridge",
                "title": f"Connections: {title}",
                "content": {"text": f"This topic connects to: {', '.join(connections)}"},
            }
        )

    return cards
