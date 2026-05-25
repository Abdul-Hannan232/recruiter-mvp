"""Interview lifecycle: start, end, trigger evaluation."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import evaluator
from app.database.session import get_session
from app.models.db import Candidate, CandidateState, Interview
from app.services import state as state_svc

router = APIRouter()


class TranscriptIn(BaseModel):
    transcript: str
    code_submissions: list[dict] | None = None


@router.post("/{candidate_id}/start", status_code=201)
async def start(candidate_id: UUID, session: AsyncSession = Depends(get_session)) -> dict:
    c = await session.get(Candidate, candidate_id)
    if c is None:
        raise HTTPException(404, "Candidate not found")
    if c.state != CandidateState.CONTACTED:
        raise HTTPException(409, f"Cannot start interview from state {c.state}")
    iv = Interview(candidate_id=c.id)
    session.add(iv)
    await session.commit()
    await state_svc.transition(session, c.id, CandidateState.INTERVIEWING)
    return {"interview_id": str(iv.id)}


@router.post("/{candidate_id}/end")
async def end(
    candidate_id: UUID,
    body: TranscriptIn,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> dict:
    c = await session.get(Candidate, candidate_id)
    if c is None or c.interview is None:
        raise HTTPException(404, "Interview not found")
    c.interview.transcript = body.transcript
    c.interview.code_submissions = body.code_submissions
    c.interview.ended_at = datetime.now(timezone.utc)
    await session.commit()
    await state_svc.transition(session, c.id, CandidateState.INTERVIEWED)

    # Agent 5 — fire-and-forget post-interview evaluation.
    background.add_task(evaluator.run, c.id)
    return {"status": "queued"}
