"""Interview lifecycle: start, complete, trigger evaluation."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import evaluator, interviewer
from app.database.session import get_session
from app.models.db import Candidate, CandidateStatus, Interview
from app.services import state as state_svc

router = APIRouter()


class CompleteIn(BaseModel):
    transcript: str = "Candidate answered well."


@router.get("/webrtc-token")
async def webrtc_token_by_room(
    room_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    """Phase 4 entry point. Candidate-facing + unauthenticated — the room_id UUID
    (minted in Phase 3, delivered in the outreach email) IS the unguessable secret.
    Validates the candidate is SHORTLISTED, grounds the session in their resume + JD,
    mints the ephemeral token, and locks them into INTERVIEWING."""
    return await interviewer.generate_webrtc_token_by_room(room_id, session)


@router.get("/{candidate_id}/webrtc-token")
async def webrtc_token(
    candidate_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    """Legacy candidate_id-keyed ticket booth (kept for back-compat)."""
    return await interviewer.generate_webrtc_token(candidate_id, session)


@router.post("/{candidate_id}/complete")
async def complete(
    candidate_id: UUID,
    background: BackgroundTasks,
    body: CompleteIn | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Signalled by the frontend when the WebRTC call ends. Persists the transcript,
    moves the candidate to INTERVIEW_COMPLETED, then schedules Agent 5 to evaluate
    SILENTLY in the background.

    SECURITY: the candidate must never see the evaluation, so this returns ONLY a
    generic success message — scores/recommendation are written to the DB for the
    recruiter and are never part of this (or any candidate-facing) response."""
    c = await session.get(Candidate, candidate_id)
    if c is None:
        raise HTTPException(404, "Candidate not found")
    if c.status != CandidateStatus.INTERVIEWING:
        raise HTTPException(409, f"Cannot complete interview from status {c.status.value}")

    transcript = body.transcript if body else CompleteIn().transcript

    # Upsert the Interview row (the room flow never created one) and persist the raw
    # transcript so Agent 5 can read it straight from the DB. Single commit.
    iv = (
        await session.execute(select(Interview).where(Interview.candidate_id == candidate_id))
    ).scalar_one_or_none()
    if iv is None:
        iv = Interview(candidate_id=candidate_id, job_id=c.job_id)
        session.add(iv)
    iv.transcript_text = transcript
    iv.is_completed = True
    c.status = CandidateStatus.INTERVIEW_COMPLETED
    await session.commit()

    # Decoupled from the candidate's request: Agent 5 runs AFTER this returns.
    background.add_task(evaluator.evaluate_interview_bg, candidate_id)

    return {"status": "success", "message": "Interview completed."}


@router.post("/{candidate_id}/start", status_code=201)
async def start(candidate_id: UUID, session: AsyncSession = Depends(get_session)) -> dict:
    c = await session.get(Candidate, candidate_id)
    if c is None:
        raise HTTPException(404, "Candidate not found")
    if c.status != CandidateStatus.OUTREACH_SENT:
        raise HTTPException(409, f"Cannot start interview from status {c.status}")
    iv = Interview(
        candidate_id=c.id, job_id=c.job_id, scheduled_time=datetime.now(timezone.utc)
    )
    session.add(iv)
    await session.commit()
    await state_svc.transition(session, c.id, CandidateStatus.INTERVIEWING)
    return {"interview_id": str(iv.id)}
