"""Interview lifecycle: start, complete, trigger evaluation."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import evaluator, interviewer
from app.database.session import get_session
from app.models.db import Candidate, CandidateStatus, Interview
from app.services import state as state_svc

router = APIRouter()


class CompleteIn(BaseModel):
    transcript: str = "Candidate answered well."


@router.get("/{candidate_id}/webrtc-token")
async def webrtc_token(
    candidate_id: UUID, session: AsyncSession = Depends(get_session)
) -> dict:
    """Agent 4 ticket booth: mint an ephemeral WebRTC token and lock the candidate
    into INTERVIEWING. Requires the candidate to be in OUTREACH_SENT."""
    return await interviewer.generate_webrtc_token(candidate_id, session)


@router.post("/{candidate_id}/complete")
async def complete(
    candidate_id: UUID,
    background: BackgroundTasks,
    response: Response,
    body: CompleteIn | None = None,
    wait: bool = False,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Signalled by the frontend when the WebRTC call ends. Advances the candidate
    from INTERVIEWING to INTERVIEW_COMPLETED, then hands off to Agent 5 (Evaluator).

    Default (wait=false): schedule the evaluation as a BackgroundTask and return 202.
    wait=true: run the evaluation inline and return 200 with the real decision
    (handy for tests / synchronous callers)."""
    c = await session.get(Candidate, candidate_id)
    if c is None:
        raise HTTPException(404, "Candidate not found")
    if c.status != CandidateStatus.INTERVIEWING:
        raise HTTPException(409, f"Cannot complete interview from status {c.status.value}")
    c.status = CandidateStatus.INTERVIEW_COMPLETED
    await session.commit()

    transcript = body.transcript if body else CompleteIn().transcript

    # Agent 5 — the AI filter sets the next status (PENDING_RECRUITER or back to POOL).
    if wait:
        result = await evaluator.evaluate_interview(candidate_id, session, transcript)
        return {"status": "evaluated", **result}

    background.add_task(evaluator.evaluate_interview_bg, candidate_id, transcript)
    response.status_code = 202
    return {
        "status": "queued",
        "candidate_id": str(candidate_id),
        "new_status": c.status.value,
    }


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
    await state_svc.transition(session, c.id, CandidateStatus.INTERVIEW_SCHEDULED)
    return {"interview_id": str(iv.id)}
