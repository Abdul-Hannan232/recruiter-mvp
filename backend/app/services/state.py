"""Candidate status transitions. Centralised so the funnel is auditable."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import Candidate, CandidateStatus


_ALLOWED: dict[CandidateStatus, set[CandidateStatus]] = {
    CandidateStatus.POOL: {CandidateStatus.MATCHED, CandidateStatus.REJECTED},
    CandidateStatus.MATCHED: {CandidateStatus.OUTREACH_SENT, CandidateStatus.REJECTED},
    CandidateStatus.OUTREACH_SENT: {CandidateStatus.INTERVIEW_SCHEDULED, CandidateStatus.REJECTED},
    CandidateStatus.INTERVIEW_SCHEDULED: {CandidateStatus.HIRED, CandidateStatus.REJECTED},
    CandidateStatus.HIRED: set(),
    CandidateStatus.REJECTED: set(),
}


class IllegalTransition(RuntimeError):
    pass


async def transition(
    session: AsyncSession,
    candidate_id: UUID,
    target: CandidateStatus,
) -> Candidate:
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None:
        raise IllegalTransition(f"Candidate {candidate_id} not found")
    if target not in _ALLOWED[candidate.status]:
        raise IllegalTransition(f"{candidate.status} -> {target} not permitted")
    candidate.status = target
    await session.commit()
    await session.refresh(candidate)
    return candidate


async def get_candidate(session: AsyncSession, candidate_id: UUID) -> Candidate | None:
    return await session.get(Candidate, candidate_id)


async def list_candidates_for_job(session: AsyncSession, job_id: UUID) -> list[Candidate]:
    res = await session.execute(select(Candidate).where(Candidate.job_id == job_id))
    return list(res.scalars().all())
