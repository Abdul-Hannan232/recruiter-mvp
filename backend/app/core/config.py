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

    # OpenAI (chat + realtime interview)
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_REALTIME_MODEL: str = "gpt-4o-realtime-preview"

    # Gemini (embeddings)
    GEMINI_API_KEY: str = ""
    GEMINI_EMBED_MODEL: str = "text-embedding-004"

    # Pipeline gates (Agent 2 hard threshold)
    MATCH_THRESHOLD: float = 0.72
    # Agent 2 batch matcher: max pgvector cosine DISTANCE for a pool candidate to be
    # locked to a job. Lower = stricter. Distance is in [0, 2]; strictly < this passes.
    MATCH_DISTANCE_THRESHOLD: float = 0.6
    EMBED_DIM: int = 768  # Gemini text-embedding-004

    # Auth
    JWT_SECRET: str = "change-me"
    JWT_ALG: str = "HS256"
    JWT_TTL_MIN: int = 60


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
