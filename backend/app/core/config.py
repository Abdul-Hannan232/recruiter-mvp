"""Centralised runtime configuration. Loaded once at import time."""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # Database (Supabase Postgres + pgvector)
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/recruitment"
    SUPABASE_URL: str | None = None
    SUPABASE_KEY: str | None = None
    # Supabase access tokens are signed ES256 (JWKS at {SUPABASE_URL}/auth/v1/.well-known/jwks.json)
    # and carry aud="authenticated". Override only if the project changes its audience.
    SUPABASE_JWT_AUD: str = "authenticated"

    # OpenAI — reserved for the WebRTC realtime voice agent ONLY (Agent 4).
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_REALTIME_MODEL: str = "gpt-4o-realtime-preview"

    # DeepSeek — all text/extraction/drafting chat tasks (Agents 1, 3, 5).
    # OpenAI-compatible API, so it is driven through the openai SDK with a custom base_url.
    # Explicit V4 model IDs (the deepseek-chat/deepseek-reasoner aliases retire 2026-07-24):
    #   flash -> fast/cheap extraction + drafting (Agents 1, 3)
    #   pro   -> stronger reasoning for evaluation (Agent 5)
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com"
    DEEPSEEK_FLASH_MODEL: str = "deepseek-v4-flash"
    DEEPSEEK_PRO_MODEL: str = "deepseek-v4-pro"

    # Gemini (embeddings)
    GEMINI_API_KEY: str = ""
    GEMINI_EMBED_MODEL: str = "gemini-embedding-001"

    # Pipeline gates. Calibrated for gemini-embedding-001's compressed cosine space
    # (unrelated text sits ~0.5 distance; strong matches ~0.30). similarity = 1 - d/2.
    MATCH_THRESHOLD: float = 0.825
    # Agent 2 batch matcher: max pgvector cosine DISTANCE for a pool candidate to be
    # locked to a job. Lower = stricter. Distance is in [0, 2]; strictly < this passes.
    MATCH_DISTANCE_THRESHOLD: float = 0.35
    EMBED_DIM: int = 768  # Gemini gemini-embedding-001

    # Auth
    JWT_SECRET: str = "change-me"
    JWT_ALG: str = "HS256"
    JWT_TTL_MIN: int = 60

    # Outreach email (Agent 3). When SMTP_HOST/USER/PASSWORD are all set the email is
    # sent live; otherwise the module runs in render-only mode (drafts + logs, no send).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_STARTTLS: bool = True
    # Base URL the tokenized interview-room link points back to. Must match the running
    # frontend origin so the emailed link actually opens the app (Vite dev = 5173).
    DASHBOARD_BASE_URL: str = "http://localhost:5173"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
