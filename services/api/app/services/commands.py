"""Voice command detection and execution.

Detects commands in transcript text and generates dynamic content
(charts, tables, summaries, timelines, lists) using LLM.
"""

import re
import logging

from app.services.llm import chat_completion_json, is_llm_available
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

# Command patterns (Turkish + English)
_COMMAND_PATTERNS = [
    {
        "type": "generate_chart",
        "patterns": [
            r"grafik\s*(göster|hazırla|oluştur|çiz)",
            r"chart\s*(göster|hazırla|show|create)",
            r"(bar|line|pie)\s*(chart|grafik)",
            r"bunu?\s*grafik\s*olarak",
        ],
    },
    {
        "type": "generate_table",
        "patterns": [
            r"tablo\s*(göster|hazırla|oluştur)",
            r"karşılaştırma\s*(yap|göster|tablosu)",
            r"table\s*(göster|hazırla|show)",
        ],
    },
    {
        "type": "generate_summary",
        "patterns": [
            r"(özetle|özet\s*göster|toparlayalım|özetleyelim)",
            r"(summarize|summary|sum\s*up)",
            r"şimdiye\s*kadar\s*(ne|neler)",
        ],
    },
    {
        "type": "generate_timeline",
        "patterns": [
            r"(timeline|zaman\s*çizelgesi)\s*(göster|hazırla|oluştur)?",
            r"kronoloji\s*(göster|hazırla)?",
            r"tarih\s*sırasıyla",
        ],
    },
    {
        "type": "generate_list",
        "patterns": [
            r"madde\s*madde\s*(yaz|göster|listele)",
            r"(listele|liste\s*göster|liste\s*hazırla)",
            r"(bullet\s*point|maddeler\s*halinde)",
        ],
    },
    {
        "type": "next_item",
        "patterns": [
            r"(sonraki|sıradaki)\s*(madde|nokta|item|point)",
            r"(next\s*item|next\s*point|next\s*bullet)",
            r"devam\s*(et|edelim)",
        ],
    },
    {
        "type": "next_topic",
        "patterns": [
            r"(sonraki|sıradaki)\s*(konu|bölüm|slide)",
            r"(bu\s*konuyu?\s*kapat|geçelim)",
            r"(next\s*topic|next\s*slide)",
        ],
    },
]


def detect_command(transcript_text: str) -> dict | None:
    """Detect a voice command in transcript text.

    Returns:
        Dict with 'type' and 'match' keys, or None if no command detected.
    """
    text = transcript_text.lower().strip()

    for cmd in _COMMAND_PATTERNS:
        for pattern in cmd["patterns"]:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                logger.info("Command detected: %s (matched: '%s')", cmd["type"], match.group())
                return {"type": cmd["type"], "match": match.group()}

    return None


_CHART_PROMPT = """You are a data visualization assistant. Based on the context below, generate chart data.

Context (recent presentation transcript):
{context}

Current topic: {topic}

Generate a chart that visualizes the key data points mentioned. Return JSON:
{{
  "chart_type": "bar" | "line" | "pie" | "doughnut",
  "title": "Chart title",
  "labels": ["Label1", "Label2", ...],
  "datasets": [
    {{
      "label": "Dataset name",
      "data": [10, 20, 30, ...]
    }}
  ]
}}

Rules:
- Extract real numbers/data from the context if available
- If no specific data, create reasonable illustrative data based on the topic
- Keep labels short (max 3 words each)
- Max 8 data points
- Choose the chart type that best fits the data
- Return ONLY valid JSON"""

_TABLE_PROMPT = """You are a content structuring assistant. Based on the context below, generate a comparison/data table.

Context (recent presentation transcript):
{context}

Current topic: {topic}

Generate a structured table. Return JSON:
{{
  "title": "Table title",
  "headers": ["Column1", "Column2", "Column3"],
  "rows": [
    ["Value1", "Value2", "Value3"],
    ["Value1", "Value2", "Value3"]
  ]
}}

Rules:
- Extract real data from the context
- 3-5 columns, 3-8 rows
- Keep cell values concise
- Return ONLY valid JSON"""

_SUMMARY_PROMPT = """You are a summarization assistant. Summarize what has been discussed so far.

Context (recent presentation transcript):
{context}

Current topic: {topic}

Return JSON:
{{
  "summary": "2-3 sentence summary of key points discussed",
  "key_points": ["Point 1", "Point 2", "Point 3"]
}}

Rules:
- Focus on the main arguments and data
- Max 5 key points
- Each key point is 1 sentence
- Return ONLY valid JSON"""

_TIMELINE_PROMPT = """You are a timeline generator. Based on the context, create a chronological timeline.

Context (recent presentation transcript):
{context}

Current topic: {topic}

Return JSON:
{{
  "events": [
    {{"date": "2020", "title": "Event title", "description": "Brief description"}},
    {{"date": "2021", "title": "Event title", "description": "Brief description"}}
  ]
}}

Rules:
- Extract dates/periods from context
- If no specific dates, use logical ordering
- 3-8 events
- Keep descriptions under 20 words
- Return ONLY valid JSON"""

_LIST_PROMPT = """You are a content organizer. Based on the context, create a structured list of key points.

Context (recent presentation transcript):
{context}

Current topic: {topic}

Return JSON:
{{
  "items": ["Point 1", "Point 2", "Point 3"],
  "ordered": true
}}

Rules:
- Extract the main points from the transcript
- 3-8 items
- Each item is 1-2 sentences
- Set ordered=true if sequence matters
- Return ONLY valid JSON"""

_PROMPTS = {
    "generate_chart": _CHART_PROMPT,
    "generate_table": _TABLE_PROMPT,
    "generate_summary": _SUMMARY_PROMPT,
    "generate_timeline": _TIMELINE_PROMPT,
    "generate_list": _LIST_PROMPT,
}

_CONTENT_TYPES = {
    "generate_chart": "chart",
    "generate_table": "table",
    "generate_summary": "summary",
    "generate_timeline": "timeline",
    "generate_list": "list",
}


def execute_command(
    command_type: str,
    context_text: str,
    current_topic: str | None,
    session_id: str,
) -> dict:
    """Execute a voice command and return generated content.

    Returns:
        Dict with content_type, content (data), and title.
    """
    if not is_llm_available():
        return {"content_type": "summary", "content": {"summary": "LLM not available"}, "title": "Error"}

    # Handle next_item via slides service (no LLM needed)
    if command_type == "next_item":
        from app.services.slides import advance_slide
        try:
            slides = advance_slide(session_id, "next_item")
            current_idx = slides.get("current_topic_index", 0)
            topics = slides.get("topics", [])
            title = topics[current_idx]["title"] if current_idx < len(topics) else "Item advanced"
            return {"content_type": "slide_advance", "content": slides, "title": title}
        except Exception as exc:
            logger.exception("next_item failed: %s", exc)
            return {"content_type": "summary", "content": {"summary": "Could not advance item"}, "title": "Error"}

    # Handle next_topic separately (no LLM needed)
    if command_type == "next_topic":
        # Also advance dynamic slides
        from app.services.slides import advance_slide
        try:
            advance_slide(session_id, "next_topic")
        except Exception:
            pass  # Non-fatal — original next_topic logic continues
        return _handle_next_topic(session_id, current_topic)

    prompt_template = _PROMPTS.get(command_type)
    if not prompt_template:
        return {"content_type": "summary", "content": {"summary": f"Unknown command: {command_type}"}, "title": "Error"}

    prompt = prompt_template.format(
        context=context_text[:3000],
        topic=current_topic or "General",
    )

    try:
        result = chat_completion_json(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": "Generate the content now."},
            ],
        )

        content_type = _CONTENT_TYPES.get(command_type, "summary")
        title = result.get("title", current_topic or "Generated Content")

        logger.info("Command executed: %s → %s", command_type, content_type)

        return {
            "content_type": content_type,
            "content": result,
            "title": title,
        }

    except Exception as exc:
        logger.exception("Command execution failed: %s", exc)
        return {
            "content_type": "summary",
            "content": {"summary": "Failed to generate content. Please try again."},
            "title": "Error",
        }


def _handle_next_topic(session_id: str, current_topic: str | None) -> dict:
    """Move to the next topic in the session."""
    supabase = get_supabase()

    chunks = (
        supabase.table("content_chunks")
        .select("heading, chunk_index")
        .eq("session_id", session_id)
        .order("chunk_index")
        .execute()
    )

    topics = []
    seen = set()
    for c in (chunks.data or []):
        h = c.get("heading") or "Untitled"
        if h not in seen:
            topics.append({"heading": h, "chunk_index": c["chunk_index"]})
            seen.add(h)

    # Find current position and move to next
    next_topic = None
    found_current = current_topic is None
    for t in topics:
        if found_current:
            next_topic = t
            break
        if t["heading"] == current_topic:
            found_current = True

    if next_topic:
        return {
            "content_type": "summary",
            "content": {
                "summary": f"Moving to: {next_topic['heading']}",
                "key_points": [],
            },
            "title": next_topic["heading"],
            "next_heading": next_topic["heading"],
            "next_chunk_index": next_topic["chunk_index"],
        }

    return {
        "content_type": "summary",
        "content": {"summary": "All topics covered.", "key_points": []},
        "title": "Complete",
    }
