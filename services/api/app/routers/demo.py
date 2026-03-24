"""Demo seeder — creates a complete ready-to-go demo session in one call.

Allows 1-click demo without waiting for PDF upload and LLM processing.
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
# Demo content
# ---------------------------------------------------------------------------

DEMO_CHUNKS = [
    "Pretive, canlı eğitim ve sunum kalitesini eş zamanlı olarak iyileştiren AI-native bir EdTech girişimidir. Temel hedefi, anlatım kalitesini oturum sırasında yükseltmektir.",
    "Problem: Eğitmenler canlı oturum sırasında akışı, ekranı, zamanı ve dinleyici dikkatini aynı anda yönetmekte zorlanıyor. İçerik hazırlığı 4-8 saat sürüyor.",
    "Çözüm: Semantik Prompter sistemi, yüklenen dokümanlardan anlatı grafiği çıkarır. Konuşmacının sesinden bağlam yakalar ve doğru anda doğru bilgiyi sunar.",
    "Pazar: Global EdTech pazarı 2024'te 163 milyar dolar, 2030'da 348 milyar dolara çıkması bekleniyor. CAGR %13.3.",
    "Teknik Mimari: Ses tanıma (Deepgram), anlam eşleme (pgvector), karar motoru ve ekran zekası olmak üzere 11 bileşenden oluşur.",
    "Hedef gecikme 400-850ms arasıdır. Speech-to-text 120ms, embedding 50ms, vector search 30ms, LLM karar 200-500ms.",
    "Fiyatlandırma: Pro plan 19€/ay, Team plan 24€/koltuk/ay, Enterprise 45+€/koltuk/ay. SaaS modeli.",
    "Ekip: Bilal Şentürk (CEO) - IIENSTITU kurucusu, 300K+ canlı yayın deneyimi. Sezin Gök (CPO) - ürün yönetimi ve eğitim teknolojileri.",
    "Yatırım: Pre-seed turunda 350K€ aranıyor. Kullanım: %40 mühendislik, %25 ürün, %20 pazarlama, %15 operasyon.",
    "Rekabet: Microsoft Copilot, Gamma, Otter.ai gibi rakipler var ancak hiçbiri canlı anlatım sırasında eş zamanlı destek sunmuyor.",
]

DEMO_CARDS = [
    {
        "type": "summary",
        "title": "Pretive Nedir?",
        "content": {"text": "AI-native EdTech girişimi. Canlı eğitim ve sunum kalitesini eş zamanlı iyileştirir. Temel fark: dosya değil, performans üretir."},
    },
    {
        "type": "concept",
        "title": "Semantik Prompter",
        "content": {"text": "Yüklenen dokümanlardan anlatı grafiği çıkarır. Konuşmacının sesinden bağlam yakalayarak doğru anda doğru bilgiyi sunar."},
    },
    {
        "type": "comparison",
        "title": "Rakip Karşılaştırma",
        "content": {"text": "Microsoft Copilot: slayt üretir ama canlı desteklemez. Gamma: içerik üretir ama anlık değil. Pretive: canlı anlatımda eş zamanlı çalışır."},
    },
    {
        "type": "summary",
        "title": "Pazar Fırsatı",
        "content": {"text": "$163B (2024) → $348B (2030). CAGR %13.3. Hedef segment: online eğitim platformları ve kurumsal L&D."},
    },
    {
        "type": "concept",
        "title": "Teknik Pipeline",
        "content": {"text": "Mikrofon → Deepgram STT (120ms) → Embedding (50ms) → pgvector search (30ms) → LLM karar (200-500ms). Toplam: 400-850ms."},
    },
    {
        "type": "summary",
        "title": "İş Modeli",
        "content": {"text": "SaaS — Pro 19€/ay, Team 24€/koltuk/ay, Enterprise 45+€. Y3 hedef ARR: 8.85M€."},
    },
    {
        "type": "context_bridge",
        "title": "IIENSTITU Deneyimi",
        "content": {"text": "Kurucu Bilal Şentürk, IIENSTITU ile 300K+ canlı yayın gerçekleştirdi. Bu operasyonel deneyim Pretive'in temelini oluşturuyor."},
    },
    {
        "type": "concept",
        "title": "Yatırım Turu",
        "content": {"text": "Pre-seed: 350K€. Dağılım: Mühendislik %40, Ürün %25, Pazarlama %20, Operasyon %15. Seed tetikleme: 500 aktif kullanıcı."},
    },
]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/seed", response_model=DemoSeedResponse, status_code=201)
async def seed_demo(
    x_user_id: Optional[str] = Header(default=None, alias="x-user-id"),
) -> DemoSeedResponse:
    """Create a complete demo session with document, chunks, and cards.

    This bypasses the normal PDF upload + LLM pipeline so users can
    experience the product instantly.
    """
    user_id = x_user_id or DEMO_USER_ID
    logger.info("Seeding demo session for user=%s", user_id)

    supabase = get_supabase()

    try:
        # 1. Create session
        session_result = (
            supabase.table("sessions")
            .insert({
                "title": "Pretive Demo Session",
                "status": "ready",
                "user_id": user_id,
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
                "file_name": "pretive-is-plani.pdf",
                "file_type": "pdf",
                "status": "parsed",
            })
            .execute()
        )
        if not doc_result.data:
            raise HTTPException(status_code=500, detail="Failed to create demo document")

        doc_id = doc_result.data[0]["id"]
        logger.info("Demo document created id=%s", doc_id)

        # 3. Insert content chunks
        chunk_records = [
            {
                "document_id": doc_id,
                "session_id": session_id,
                "chunk_index": i,
                "content": text,
                "chunk_type": "text",
            }
            for i, text in enumerate(DEMO_CHUNKS)
        ]
        supabase.table("content_chunks").insert(chunk_records).execute()
        logger.info("Inserted %d demo chunks for session %s", len(chunk_records), session_id)

        # 4. Insert session cards
        card_records = [
            {
                "session_id": session_id,
                "card_type": card["type"],
                "title": card["title"],
                "content": json.dumps(card["content"], ensure_ascii=False),
            }
            for card in DEMO_CARDS
        ]
        supabase.table("session_cards").insert(card_records).execute()
        logger.info("Inserted %d demo cards for session %s", len(card_records), session_id)

        logger.info("Demo session seeding complete: session_id=%s", session_id)
        return DemoSeedResponse(
            session_id=session_id,
            message="Demo session created",
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to seed demo session: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to seed demo: {str(exc)}")
