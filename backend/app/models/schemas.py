"""Pydantic v2 request/response schemas. Single source of truth for API I/O."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.db import CandidateStatus


class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    requirements_text: str = Field(min_length=20)


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    requirements_text: str
    created_at: datetime


class CandidateCreate(BaseModel):
    """Initial resume upload. Resume text is supplied after file extraction."""

    job_id: UUID
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    original_resume_text: str = Field(min_length=1)


class CandidateUpdate(BaseModel):
    """Partial update for state transitions and scoring. All fields optional."""

    status: CandidateStatus | None = None
    ai_evaluation_score: float | None = None


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    job_id: UUID
    full_name: str
    email: EmailStr
    ai_evaluation_score: float | None
    status: CandidateStatus
    created_at: datetime


class UploadResult(BaseModel):
    candidate_id: UUID
    status: CandidateStatus
    ai_evaluation_score: float | None = None
    advanced: bool


class EphemeralTokenResponse(BaseModel):
    """Subset of OpenAI's session payload that the browser needs."""

    session_id: str
    client_secret: str
    expires_at: int
    model: str


class CodeInjectionPayload(BaseModel):
    """Sent from React over WS during the live interview."""

    candidate_id: UUID
    language: str
    code: str
    cursor_line: int | None = None
    note: str | None = None


class EvaluationResult(BaseModel):
    candidate_id: UUID
    final_score: float
    rubric: dict
