"""SQLAlchemy ORM models. Embeddings stored as pgvector columns."""
from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.database.session import Base


class CandidateStatus(str, PyEnum):
    """Recruitment lifecycle. A candidate advances only on agent/recruiter success."""

    POOL = "pool"
    MATCHED = "matched"
    OUTREACH_SENT = "outreach_sent"
    INTERVIEWING = "interviewing"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_COMPLETED = "interview_completed"
    # Stage-1 AI filter passed; queued for the human recruiter (stage-2 interview).
    PENDING_RECRUITER = "pending_recruiter"
    HIRED = "hired"
    REJECTED = "rejected"


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(200))
    requirements_text: Mapped[str] = mapped_column(Text)
    jd_embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBED_DIM))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
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
    status: Mapped[CandidateStatus] = mapped_column(
        Enum(CandidateStatus, name="candidate_status"),
        default=CandidateStatus.POOL,
    )
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
