"""SQLAlchemy ORM models. Embeddings stored as pgvector columns."""
from datetime import datetime
from enum import Enum as PyEnum
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.database.session import Base


class CandidateState(str, PyEnum):
    """Sequential funnel stages. A candidate moves forward only on agent success."""

    UPLOADED = "uploaded"
    VECTORIZED = "vectorized"
    MATCHED = "matched"
    REJECTED = "rejected"
    CONTACTED = "contacted"
    INTERVIEWING = "interviewing"
    INTERVIEWED = "interviewed"
    EVALUATED = "evaluated"


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBED_DIM))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    job_id: Mapped[UUID] = mapped_column(ForeignKey("job_descriptions.id", ondelete="CASCADE"))
    full_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), index=True)
    resume_text: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.EMBED_DIM))
    match_score: Mapped[float | None] = mapped_column(Float)
    state: Mapped[CandidateState] = mapped_column(
        Enum(CandidateState, name="candidate_state"),
        default=CandidateState.UPLOADED,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job: Mapped[JobDescription] = relationship(back_populates="candidates")
    interview: Mapped["Interview | None"] = relationship(back_populates="candidate", uselist=False)


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    candidate_id: Mapped[UUID] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), unique=True
    )
    transcript: Mapped[str | None] = mapped_column(Text)
    code_submissions: Mapped[list[dict] | None] = mapped_column(JSONB)
    final_score: Mapped[float | None] = mapped_column(Float)
    rubric: Mapped[dict | None] = mapped_column(JSONB)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    candidate: Mapped[Candidate] = relationship(back_populates="interview")
