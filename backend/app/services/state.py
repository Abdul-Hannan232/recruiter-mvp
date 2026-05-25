"""Candidate state transitions. Centralised so the funnel is auditable."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import Candidate, CandidateState


_ALLOWED: dict[CandidateState, set[CandidateState]] = {
    CandidateState.UPLOADED: {CandidateState.VECTORIZED, CandidateState.REJECTED},
    CandidateState.VECTORIZED: {CandidateState.MATCHED, CandidateState.REJECTED},
    CandidateState.MATCHED: {CandidateState.CONTACTED, CandidateState.REJECTED},
    CandidateState.CONTACTED: {CandidateState.INTERVIEWING, CandidateState.REJECTED},
    CandidateState.INTERVIEWING: {CandidateState.INTERVIEWED, CandidateState.REJECTED},
    CandidateState.INTERVIEWED: {CandidateState.EVALUATED},
    CandidateState.EVALUATED: set(),
    CandidateState.REJECTED: set(),
}


class IllegalTransition(RuntimeError):
    pass


async def transition(
    session: AsyncSession,
    candidate_id: UUID,
    target: CandidateState,
) -> Candidate:
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None:
        raise IllegalTransition(f"Candidate {candidate_id} not found")
    if target not in _ALLOWED[candidate.state]:
        raise IllegalTransition(f"{candidate.state} -> {target} not permitted")
    candidate.state = target
    await session.commit()
    await session.refresh(candidate)
    return candidate


async def get_candidate(session: AsyncSession, candidate_id: UUID) -> Candidate | None:
    return await session.get(Candidate, candidate_id)


async def list_candidates_for_job(session: AsyncSession, job_id: UUID) -> list[Candidate]:
    res = await session.execute(select(Candidate).where(Candidate.job_id == job_id))
    return list(res.scalars().all())
