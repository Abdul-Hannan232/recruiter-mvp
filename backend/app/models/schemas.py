"""Pydantic v2 request/response schemas. Single source of truth for API I/O."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.db import CandidateStatus, UserRole


class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    requirements_text: str = Field(min_length=20)
    city: str = Field(min_length=1, max_length=100)


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    requirements_text: str
    city: str | None
    is_active: bool
    created_at: datetime


class MatchSummary(BaseModel):
    """Returned by the Agent 2 batch matcher trigger."""

    total_evaluated: int
    matched_and_locked: int


class CandidateCreate(BaseModel):
    """Talent Pool intake. No job_id — candidates are ingested job-agnostically.

    full_name and email are extracted from the resume by Agent 1, not supplied
    by the caller.
    """

    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    original_resume_text: str = Field(min_length=1)


class CandidateUpdate(BaseModel):
    """Partial update for state transitions and scoring. All fields optional."""

    status: CandidateStatus | None = None
    ai_evaluation_score: float | None = None


class ScheduleInterviewIn(BaseModel):
    """Recruiter HITL: book the final human interview for an AI-vetted candidate."""

    scheduled_time: datetime
    meeting_link: str | None = Field(default=None, max_length=500)


class CandidateProfileUpdate(BaseModel):
    """Candidate self-service profile edit. Keeps the DB row in sync with the auth-layer
    metadata so Agent 2's geo-gate never drifts from the JWT. Both fields optional."""

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    city: str | None = Field(default=None, min_length=1, max_length=100)


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID | None
    role: UserRole
    job_id: UUID | None
    full_name: str
    email: EmailStr
    city: str | None
    ai_evaluation_score: float | None
    evaluation_summary: str | None
    score_penalty: float
    interview_room_id: UUID | None
    status: CandidateStatus
    created_at: datetime


class UploadResult(BaseModel):
    """Returned to the frontend after a successful Talent Pool upload."""

    candidate_id: UUID
    full_name: str
    email: str
    status: CandidateStatus


class EphemeralTokenResponse(BaseModel):
    """Subset of OpenAI's session payload that the browser needs."""

    session_id: str
    client_secret: str
    expires_at: int
    model: str


class EvaluationResult(BaseModel):
    candidate_id: UUID
    final_score: float
    rubric: dict
