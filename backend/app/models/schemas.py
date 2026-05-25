"""Pydantic v2 request/response schemas. Single source of truth for API I/O."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.db import CandidateState


class JobCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=20)


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    description: str
    created_at: datetime


class CandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    job_id: UUID
    full_name: str
    email: EmailStr
    match_score: float | None
    state: CandidateState
    created_at: datetime


class UploadResult(BaseModel):
    candidate_id: UUID
    state: CandidateState
    match_score: float | None = None
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
