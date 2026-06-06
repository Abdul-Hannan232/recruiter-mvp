"""SQLAlchemy ORM models. Embeddings stored as pgvector columns."""
from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Table,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.database.session import Base


class CandidateStatus(str, PyEnum):
    """Recruitment lifecycle. A candidate advances only on agent/recruiter success.

    The internal AI pipeline (Agents 2 & 5) tracks granular states (MATCHED,
    OUTREACH_SENT, …). SHORTLISTED and INTERVIEWED are HITL/dashboard-facing states
    the human recruiter interacts with — added without disturbing the AI funnel.
    """

    POOL = "pool"
    MATCHED = "matched"
    # HITL: Agent 3 has reached out; awaiting the recruiter's manual decision.
    SHORTLISTED = "shortlisted"
    OUTREACH_SENT = "outreach_sent"
    INTERVIEWING = "interviewing"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    # HITL: dashboard-facing "interview done" label.
    INTERVIEWED = "interviewed"
    INTERVIEW_COMPLETED = "interview_completed"
    # Stage-1 AI filter passed; queued for the human recruiter (stage-2 interview).
    PENDING_RECRUITER = "pending_recruiter"
    HIRED = "hired"
    REJECTED = "rejected"


class UserRole(str, PyEnum):
    """RBAC discriminator. Identity itself is owned by Supabase Auth (auth.users);
    this role decides what a given authenticated user may do in the recruitment app."""

    CANDIDATE = "candidate"
    RECRUITER = "recruiter"


# Non-managed stub of Supabase's auth.users. We do NOT own or create this table —
# it exists only so SQLAlchemy can resolve our cross-schema foreign keys at DDL/ORM
# time. init_db() filters the `auth` schema out of create_all so it is never emitted.
auth_users = Table(
    "users",
    Base.metadata,
    Column("id", Uuid, primary_key=True),
    schema="auth",
)


class Recruiter(Base):
    """A human recruiter (HITL operator). Backed 1:1 by a Supabase Auth identity.

    We never store credentials here — Supabase Auth owns the password/session. This
    row is the app-side profile + RBAC anchor that RLS policies join against to grant
    talent-pool-wide read access.
    """

    __tablename__ = "recruiters"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    # FK to Supabase-managed auth.users.id. Identity lifecycle is owned by Auth, so
    # deleting the auth user cascades the recruiter profile away.
    # Explicit Uuid type: the FK target (auth.users) lives outside our metadata, so
    # SQLAlchemy cannot infer the column type from it.
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("auth.users.id", ondelete="CASCADE"), unique=True, index=True
    )
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.RECRUITER
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    # Multi-tenancy owner: the recruiter's Supabase identity (== Principal.user_id).
    # Every tenant-scoped query filters on this so Recruiter A never sees B's pipeline.
    recruiter_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("auth.users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    requirements_text: Mapped[str] = mapped_column(Text)
    jd_embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBED_DIM))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    # Optional 1:1 link to a Supabase Auth identity. NULL at intake: candidates are
    # ingested job-agnostically by a recruiter uploading a resume, before the person
    # ever holds an account. The link is established later when the candidate claims
    # their profile. ondelete=SET NULL keeps the pool record if the auth user is gone.
    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("auth.users.id", ondelete="SET NULL"), unique=True, nullable=True, index=True
    )
    # RBAC discriminator; mirrors the row's table so RLS/JWT claims can branch on role.
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.CANDIDATE
    )
    # Talent Pool architecture: a candidate is ingested job-agnostically. job_id is
    # assigned later when a recruiter matches the pool against a JD, and is cleared
    # (not cascaded) if that JD is deleted — the candidate remains in the pool.
    job_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True
    )
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), index=True)
    original_resume_text: Mapped[str] = mapped_column(Text)
    resume_embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBED_DIM))
    ai_evaluation_score: Mapped[float | None] = mapped_column(Float)
    # Agent 5's full evaluation as a raw JSON string (recruiter-only; never shown to
    # the candidate). Holds scores, strengths/weaknesses, code_review, recommendation.
    evaluation_summary: Mapped[str | None] = mapped_column(Text)
    status: Mapped[CandidateStatus] = mapped_column(
        Enum(CandidateStatus, name="candidate_status"),
        default=CandidateStatus.POOL,
    )
    # Tokenized interview room. Generated at shortlist/outreach time; embeds in the
    # invite link and binds this candidate to their target job_id for the session.
    interview_room_id: Mapped[UUID | None] = mapped_column(
        Uuid, unique=True, nullable=True, index=True
    )
    # Persistent relational penalty applied on recruiter REJECT. Added to cosine
    # distance during matching to depress re-ranking — the 768-d embedding is never
    # mutated. 0.0 = no penalty.
    score_penalty: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job: Mapped["JobDescription | None"] = relationship(back_populates="candidates")
    interview: Mapped["Interview | None"] = relationship(back_populates="candidate", uselist=False)


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    candidate_id: Mapped[UUID] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), unique=True
    )
    job_id: Mapped[UUID] = mapped_column(ForeignKey("job_descriptions.id", ondelete="CASCADE"))
    scheduled_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    transcript_text: Mapped[str | None] = mapped_column(Text)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)

    candidate: Mapped[Candidate] = relationship(back_populates="interview")


class CodeSubmission(Base):
    """Durable, append-only record of code a candidate submits during the live
    interview (Single-Write pattern). Persisted by the backend BEFORE the snapshot is
    forwarded to the OpenAI session, so Agent 5 always has the real artifact to grade.

    Keyed by candidate_id (the reliable identifier in the room flow; the legacy
    Interview row isn't created by the room path). Each submit is one atomic INSERT.
    """

    __tablename__ = "code_submissions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    candidate_id: Mapped[UUID] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    language: Mapped[str] = mapped_column(String(50))
    code_text: Mapped[str] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
