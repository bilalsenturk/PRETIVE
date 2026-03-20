"""PDF report generation for completed presentation sessions.

Uses reportlab to build a branded A4 document with session stats,
topic coverage, AI summary, and card details.
"""

import io
import logging
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

# ── Brand colours ───────────────────────────────────────────────
_RED = colors.HexColor("#D94228")
_INK = colors.HexColor("#111111")
_PAPER = colors.HexColor("#FFFDF9")
_LIGHT_GREY = colors.HexColor("#EEEEEE")
_WHITE = colors.white


def generate_report(session_id: str) -> bytes:
    """Generate a PDF report for a completed session.

    Args:
        session_id: The session to generate a report for.

    Returns:
        PDF file contents as bytes.

    Raises:
        ValueError: If the session is not found.
    """
    logger.info("Generating PDF report for session=%s", session_id)

    supabase = get_supabase()

    # ── Fetch data ──────────────────────────────────────────────
    session = _fetch_session(supabase, session_id)
    documents = _fetch_documents(supabase, session_id)
    chunks = _fetch_chunks(supabase, session_id)
    cards = _fetch_cards(supabase, session_id)
    match_events = _fetch_match_events(supabase, session_id)

    # ── Compute analytics ───────────────────────────────────────
    all_topics = _extract_topics(chunks)
    covered_chunk_ids = {e["chunk_id"] for e in match_events if e.get("chunk_id")}
    covered_topics = set()
    for chunk in chunks:
        if chunk["id"] in covered_chunk_ids:
            covered_topics.add(chunk.get("heading") or "Untitled")

    total_topics = len(all_topics)
    covered_count = len(covered_topics)
    coverage_pct = (
        round(covered_count / total_topics * 100) if total_topics else 0
    )
    match_rate = (
        round(len(covered_chunk_ids) / len(chunks) * 100) if chunks else 0
    )

    # Duration
    metadata = session.get("metadata") or {}
    duration_sec = metadata.get("duration_seconds", 0)
    duration_str = _format_duration(duration_sec)

    # Session info
    session_title = session.get("title") or "Untitled Session"
    session_status = session.get("status") or "unknown"
    ai_summary = metadata.get("ai_summary") or metadata.get("summary", "")
    report_date = datetime.now(timezone.utc).strftime("%B %d, %Y")

    # ── Build PDF ───────────────────────────────────────────────
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
    )

    styles = _build_styles()
    story: list = []

    # Header
    story.append(Paragraph("PRETIVE", styles["brand"]))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph("Session Report", styles["subtitle"]))
    story.append(Paragraph(report_date, styles["date"]))
    story.append(Spacer(1, 8 * mm))

    # Session title + status
    story.append(Paragraph(session_title, styles["heading1"]))
    story.append(Paragraph(f"Status: {session_status.title()}", styles["body"]))
    story.append(Spacer(1, 6 * mm))

    # Stats table
    stats_data = [
        ["Duration", "Match Rate", "Coverage", "Cards Shown"],
        [duration_str, f"{match_rate}%", f"{coverage_pct}%", str(len(cards))],
    ]
    stats_table = Table(stats_data, colWidths=[3.8 * cm] * 4)
    stats_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), _RED),
        ("TEXTCOLOR", (0, 0), (-1, 0), _WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, 1), 12),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, _LIGHT_GREY),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 8 * mm))

    # AI Summary
    if ai_summary:
        story.append(Paragraph("AI Summary", styles["heading2"]))
        story.append(Paragraph(ai_summary, styles["body"]))
        story.append(Spacer(1, 6 * mm))

    # Topics covered
    if all_topics:
        story.append(Paragraph("Topics", styles["heading2"]))
        for topic in all_topics:
            check = "\u2713" if topic in covered_topics else "\u2717"
            color = "#2E7D32" if topic in covered_topics else "#999999"
            story.append(Paragraph(
                f'<font color="{color}">{check}</font>  {topic}',
                styles["body"],
            ))
        story.append(Spacer(1, 6 * mm))

    # Cards
    if cards:
        story.append(Paragraph("Cards", styles["heading2"]))
        story.append(Spacer(1, 2 * mm))
        for card in cards:
            card_type = (card.get("card_type") or "info").upper()
            card_title = card.get("title") or "Untitled Card"
            card_content = card.get("content") or ""

            # Card type badge + title
            badge = (
                f'<font color="#FFFFFF" backColor="{_RED.hexval()}" '
                f'size="8">&nbsp;{card_type}&nbsp;</font>'
            )
            story.append(Paragraph(
                f"{badge}  <b>{card_title}</b>",
                styles["body"],
            ))
            if card_content:
                story.append(Paragraph(card_content, styles["card_body"]))
            story.append(Spacer(1, 4 * mm))

    # Build with footer
    doc.build(story, onFirstPage=_draw_footer, onLaterPages=_draw_footer)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    logger.info(
        "PDF report generated for session %s — %d bytes",
        session_id,
        len(pdf_bytes),
    )
    return pdf_bytes


# ── Data fetchers ───────────────────────────────────────────────


def _fetch_session(supabase, session_id: str) -> dict:
    result = (
        supabase.table("sessions")
        .select("*")
        .eq("id", session_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise ValueError(f"Session not found: {session_id}")
    return result.data[0]


def _fetch_documents(supabase, session_id: str) -> list[dict]:
    result = (
        supabase.table("documents")
        .select("*")
        .eq("session_id", session_id)
        .execute()
    )
    return result.data or []


def _fetch_chunks(supabase, session_id: str) -> list[dict]:
    result = (
        supabase.table("content_chunks")
        .select("id, chunk_index, heading")
        .eq("session_id", session_id)
        .order("chunk_index")
        .execute()
    )
    return result.data or []


def _fetch_cards(supabase, session_id: str) -> list[dict]:
    result = (
        supabase.table("session_cards")
        .select("*")
        .eq("session_id", session_id)
        .order("display_order")
        .execute()
    )
    return result.data or []


def _fetch_match_events(supabase, session_id: str) -> list[dict]:
    result = (
        supabase.table("session_events")
        .select("chunk_id")
        .eq("session_id", session_id)
        .eq("event_type", "match")
        .execute()
    )
    return result.data or []


# ── Helpers ─────────────────────────────────────────────────────


def _extract_topics(chunks: list[dict]) -> list[str]:
    """Extract unique headings from chunks, preserving order."""
    seen: set[str] = set()
    topics: list[str] = []
    for chunk in chunks:
        heading = chunk.get("heading") or "Untitled"
        if heading not in seen:
            seen.add(heading)
            topics.append(heading)
    return topics


def _format_duration(seconds: int) -> str:
    """Format seconds into a human-readable duration string."""
    if not seconds or seconds < 0:
        return "N/A"
    minutes, secs = divmod(int(seconds), 60)
    if minutes >= 60:
        hours, minutes = divmod(minutes, 60)
        return f"{hours}h {minutes}m"
    return f"{minutes}m {secs}s"


def _build_styles() -> dict:
    """Create paragraph styles for the report."""
    base = getSampleStyleSheet()
    return {
        "brand": ParagraphStyle(
            "Brand",
            parent=base["Title"],
            fontSize=24,
            textColor=_RED,
            fontName="Helvetica-Bold",
            spaceAfter=0,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontSize=14,
            textColor=_INK,
            fontName="Helvetica",
        ),
        "date": ParagraphStyle(
            "Date",
            parent=base["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#666666"),
        ),
        "heading1": ParagraphStyle(
            "Heading1",
            parent=base["Heading1"],
            fontSize=16,
            textColor=_INK,
            fontName="Helvetica-Bold",
            spaceAfter=4,
        ),
        "heading2": ParagraphStyle(
            "Heading2",
            parent=base["Heading2"],
            fontSize=13,
            textColor=_RED,
            fontName="Helvetica-Bold",
            spaceBefore=4,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=10,
            textColor=_INK,
            fontName="Helvetica",
            leading=14,
        ),
        "card_body": ParagraphStyle(
            "CardBody",
            parent=base["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#444444"),
            fontName="Helvetica",
            leftIndent=12,
            leading=12,
        ),
    }


def _draw_footer(canvas, doc):
    """Draw footer on every page: branding + page number."""
    canvas.saveState()
    width, _ = A4

    # Footer text
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#999999"))
    canvas.drawString(2 * cm, 1.2 * cm, "Generated by Pretive AI")
    canvas.drawRightString(
        width - 2 * cm, 1.2 * cm, f"Page {doc.page}"
    )

    # Footer line
    canvas.setStrokeColor(_LIGHT_GREY)
    canvas.setLineWidth(0.5)
    canvas.line(2 * cm, 1.5 * cm, width - 2 * cm, 1.5 * cm)

    canvas.restoreState()
