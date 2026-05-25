"""Interview lifecycle: start, end, trigger evaluation."""
import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import evaluator
from app.database.session import get_session
from app.models.db import Candidate, CandidateStatus, Interview
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
    if c.status != CandidateStatus.OUTREACH_SENT:
        raise HTTPException(409, f"Cannot start interview from status {c.status}")
    iv = Interview(
        candidate_id=c.id, job_id=c.job_id, scheduled_time=datetime.now(timezone.utc)
    )
    session.add(iv)
    await session.commit()
    await state_svc.transition(session, c.id, CandidateStatus.INTERVIEW_SCHEDULED)
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
    # The Interview schema carries only transcript_text, so any code submissions
    # are appended inline for the evaluator to reason over.
    transcript = body.transcript
    if body.code_submissions:
        transcript += "\n\n[CODE SUBMISSIONS]\n" + json.dumps(body.code_submissions, indent=2)
    c.interview.transcript_text = transcript
    c.interview.is_completed = True
    await session.commit()

    # Agent 5 — fire-and-forget post-interview evaluation (it sets the terminal status).
    background.add_task(evaluator.run, c.id)
    return {"status": "queued"}
