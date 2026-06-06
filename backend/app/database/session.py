"""SQLAlchemy engine + session factory. Ensures pgvector extension on boot."""
from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _async_url(url: str) -> str:
    # Allow either sync or async-style URL in env.
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql+psycopg_async://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg_async://", 1)
    return url


engine = create_async_engine(_async_url(settings.DATABASE_URL), pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


async def init_db() -> None:
    """Ensure pgvector + create tables on first boot."""
    from app.models.db import CandidateStatus  # noqa: F401  (register mappers)

    # Create only our own (public-schema) tables. The auth.users stub in metadata
    # exists solely to resolve cross-schema FKs and is owned by Supabase, so it must
    # never be emitted by create_all.
    owned_tables = [t for t in Base.metadata.sorted_tables if t.schema is None]

    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all, tables=owned_tables)

        # create_all only CREATEs missing tables — it never ADDs columns to a table
        # that already exists. New columns introduced after first boot are reconciled
        # here, idempotently (ADD COLUMN IF NOT EXISTS). Keep in sync with db.Candidate.
        await conn.execute(
            text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS interview_room_id uuid")
        )
        await conn.execute(
            text(
                "ALTER TABLE candidates ADD COLUMN IF NOT EXISTS "
                "score_penalty double precision NOT NULL DEFAULT 0"
            )
        )
        await conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_candidates_interview_room_id "
                "ON candidates (interview_room_id)"
            )
        )
        await conn.execute(
            text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS evaluation_summary text")
        )
        await conn.execute(
            text("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS recruiter_id uuid")
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_job_descriptions_recruiter_id "
                "ON job_descriptions (recruiter_id)"
            )
        )

    # create_all never ALTERs an existing enum type, so statuses added after the
    # type was first created must be appended explicitly. Idempotent + self-healing:
    # every boot reconciles the DB enum with the Python CandidateStatus members.
    # ADD VALUE is run in AUTOCOMMIT (it cannot share a txn that later uses the value).
    autocommit_engine = engine.execution_options(isolation_level="AUTOCOMMIT")
    async with autocommit_engine.connect() as conn:
        for status in CandidateStatus:
            # status.name is the DB label (uppercase) and is trusted (our own enum).
            await conn.execute(
                text(f"ALTER TYPE candidate_status ADD VALUE IF NOT EXISTS '{status.name}'")
            )


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
