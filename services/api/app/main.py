"""
Pretive API — FastAPI application entry-point.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db.supabase import check_connection
from app.routers import demo, documents, health, live, organizations, participant, sessions, users

# ── Structured logging ────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup / shutdown lifecycle."""
    logger.info("====================================")
    logger.info("  Pretive API — starting up")
    logger.info("====================================")

    # 1. Validate configuration
    settings.validate_at_startup()

    # 2. Test Supabase connectivity
    check_connection()
    logger.info("Supabase connection verified")

    logger.info("Pretive API ready — listening on port 8000")
    yield
    logger.info("Pretive API — shutting down")


# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="Pretive API",
    version="0.2.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # MVP: allow all origins. Tighten for production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handler ─────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ── Routers ───────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(sessions.router)
app.include_router(documents.router)
app.include_router(live.router)
app.include_router(participant.router)
app.include_router(demo.router)
app.include_router(users.router)
app.include_router(organizations.router)
