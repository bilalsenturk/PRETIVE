"""
Pretive API configuration — validated at startup, no fallbacks.
"""

import logging
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Resolve .env paths: works from services/api/ AND from project root
_api_dir = Path(__file__).resolve().parent.parent  # services/api/
_project_root = _api_dir.parent.parent  # project root


class Settings(BaseSettings):
    """All fields without defaults are REQUIRED — startup will fail if missing."""

    # ── Supabase ──────────────────────────────────────────────
    NEXT_PUBLIC_SUPABASE_URL: str = Field(..., min_length=1)
    NEXT_PUBLIC_SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = Field(..., min_length=1)

    # ── Embeddings (uses LLM provider or OpenAI) ──────────────
    OPENAI_API_KEY: str = ""  # Optional — if empty, LLM provider is used for embeddings
    EMBEDDING_MODEL: str = "moonshot-v1-128k-embedding-query"

    # ── LLM (Moonshot / Kimi K2.5) ───────────────────────────
    LLM_BASE_URL: str = Field(..., min_length=1)
    LLM_API_KEY: str = Field(..., min_length=1)
    LLM_MODEL: str = Field(..., min_length=1)

    # ── Deepgram ──────────────────────────────────────────────
    DEEPGRAM_API_KEY: str = Field(..., min_length=1)

    # ── Application ───────────────────────────────────────────
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3333"
    LOG_LEVEL: str = "INFO"
    MAX_FILE_SIZE_MB: int = 50

    # ── Convenience properties ────────────────────────────────
    @property
    def SUPABASE_URL(self) -> str:
        return self.NEXT_PUBLIC_SUPABASE_URL

    @property
    def SUPABASE_KEY(self) -> str:
        return self.SUPABASE_SERVICE_ROLE_KEY

    # ── Validators ────────────────────────────────────────────
    @field_validator(
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "LLM_BASE_URL",
        "LLM_API_KEY",
        "LLM_MODEL",
        "DEEPGRAM_API_KEY",
        mode="before",
    )
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip()
        return v

    # ── Startup validation ────────────────────────────────────
    def validate_at_startup(self) -> None:
        """Log every configured service so operators can verify at a glance."""
        logger.info("── Pretive configuration ──")
        logger.info("Supabase URL       : %s", self.SUPABASE_URL)
        if self.OPENAI_API_KEY:
            logger.info("OpenAI API key     : %s…", self.OPENAI_API_KEY[:8])
        else:
            logger.info("Embedding provider : %s (via LLM)", self.EMBEDDING_MODEL)
        logger.info("LLM base URL       : %s", self.LLM_BASE_URL)
        logger.info("LLM model          : %s", self.LLM_MODEL)
        logger.info("LLM API key        : %s…", self.LLM_API_KEY[:8])
        logger.info("Deepgram API key   : %s…", self.DEEPGRAM_API_KEY[:8])
        logger.info("Allowed origins    : %s", self.ALLOWED_ORIGINS)
        logger.info("Log level          : %s", self.LOG_LEVEL)
        logger.info("Max file size (MB) : %d", self.MAX_FILE_SIZE_MB)
        logger.info("── All required keys present ──")

    model_config = SettingsConfigDict(
        env_file=(
            str(_api_dir / ".env"),
            str(_project_root / ".env"),
        ),
        extra="ignore",
    )


settings = Settings()
