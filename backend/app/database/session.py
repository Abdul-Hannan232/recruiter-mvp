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
        # Phase 11: location tracking. Nullable so existing rows aren't violated.
        await conn.execute(
            text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS city varchar(100)")
        )
        await conn.execute(
            text("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS city varchar(100)")
        )
        await conn.execute(
            text(
                "ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS "
                "is_active boolean NOT NULL DEFAULT true"
            )
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
        # Real FK so deleting a recruiter's auth.users row cascades their jobs away
        # (the column was originally added bare, which left orphans). Idempotent guard;
        # NOT VALID so a pre-existing orphan can't crash startup — it still cascades and
        # is enforced for all new writes.
        await conn.execute(
            text(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT 1 FROM pg_constraint "
                "WHERE conname='job_descriptions_recruiter_id_fkey') THEN "
                "ALTER TABLE job_descriptions ADD CONSTRAINT job_descriptions_recruiter_id_fkey "
                "FOREIGN KEY (recruiter_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID; "
                "END IF; END $$;"
            )
        )
        # Recruiter snapshot on the candidate (Agent 5 stamps it at grade time) so a
        # graded candidate stays attributable even if their job is later deleted.
        await conn.execute(
            text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS recruiter_id_snapshot uuid")
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_candidates_recruiter_id_snapshot "
                "ON candidates (recruiter_id_snapshot)"
            )
        )
        # interviews.job_id: make nullable (a None job_id must not roll back /complete)
        # and switch the FK to ON DELETE SET NULL (deleting a job must NOT cascade-delete
        # the transcript). Idempotent: only recreate the FK if it isn't already SET NULL.
        await conn.execute(text("ALTER TABLE interviews ALTER COLUMN job_id DROP NOT NULL"))
        await conn.execute(
            text(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t "
                "ON t.oid=c.conrelid WHERE t.relname='interviews' "
                "AND c.conname='interviews_job_id_fkey' AND c.confdeltype='n') THEN "
                "ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_job_id_fkey; "
                "ALTER TABLE interviews ADD CONSTRAINT interviews_job_id_fkey "
                "FOREIGN KEY (job_id) REFERENCES job_descriptions(id) ON DELETE SET NULL; "
                "END IF; END $$;"
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
