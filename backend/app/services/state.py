"""Candidate status transitions. Centralised so the funnel is auditable."""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import Candidate, CandidateStatus


_ALLOWED: dict[CandidateStatus, set[CandidateStatus]] = {
    CandidateStatus.POOL: {CandidateStatus.MATCHED, CandidateStatus.REJECTED},
    # Agent 3 shortlists a matched candidate (outreach sent) -> SHORTLISTED for HITL.
    CandidateStatus.MATCHED: {
        CandidateStatus.SHORTLISTED,
        CandidateStatus.OUTREACH_SENT,
        CandidateStatus.REJECTED,
    },
    # HITL hub: a shortlisted candidate can be hired/released by the recruiter, or
    # progress into the interview funnel.
    CandidateStatus.SHORTLISTED: {
        CandidateStatus.INTERVIEWING,
        CandidateStatus.INTERVIEW_SCHEDULED,
        CandidateStatus.OUTREACH_SENT,
        CandidateStatus.HIRED,
        CandidateStatus.POOL,
        CandidateStatus.REJECTED,
    },
    CandidateStatus.OUTREACH_SENT: {
        CandidateStatus.INTERVIEWING,
        CandidateStatus.INTERVIEW_SCHEDULED,
        CandidateStatus.REJECTED,
    },
    CandidateStatus.INTERVIEWING: {CandidateStatus.INTERVIEW_COMPLETED, CandidateStatus.REJECTED},
    CandidateStatus.INTERVIEW_SCHEDULED: {CandidateStatus.HIRED, CandidateStatus.REJECTED},
    # Agent 5 (Evaluator) is the AI filter: pass -> PENDING_RECRUITER, fail -> back to POOL.
    CandidateStatus.INTERVIEW_COMPLETED: {
        CandidateStatus.INTERVIEWED,
        CandidateStatus.PENDING_RECRUITER,
        CandidateStatus.POOL,
        CandidateStatus.HIRED,
        CandidateStatus.REJECTED,
    },
    # HITL: interview finished, awaiting the recruiter's terminal call.
    CandidateStatus.INTERVIEWED: {
        CandidateStatus.HIRED,
        CandidateStatus.PENDING_RECRUITER,
        CandidateStatus.POOL,
        CandidateStatus.REJECTED,
    },
    # Human recruiter (stage-2) decides the terminal outcome.
    CandidateStatus.PENDING_RECRUITER: {
        CandidateStatus.HIRED,
        CandidateStatus.POOL,
        CandidateStatus.REJECTED,
    },
    CandidateStatus.HIRED: set(),
    CandidateStatus.REJECTED: set(),
}

# Scalar penalty added to score_penalty on each REJECT. Applied to cosine distance
# during matching so rejected candidates rank lower / fall below the gate, without
# ever touching the 768-d embedding.
REJECT_PENALTY: float = 0.5

# Source states from which each HITL override is permitted (strictly bounded).
_HIRE_FROM = {
    CandidateStatus.SHORTLISTED,
    CandidateStatus.INTERVIEWED,
    CandidateStatus.INTERVIEW_SCHEDULED,
    CandidateStatus.INTERVIEW_COMPLETED,
    CandidateStatus.PENDING_RECRUITER,
}
_REJECT_FROM = {
    CandidateStatus.SHORTLISTED,
    CandidateStatus.INTERVIEWED,
    CandidateStatus.INTERVIEW_COMPLETED,
    CandidateStatus.PENDING_RECRUITER,
}
_UNCALLED_FROM = {CandidateStatus.SHORTLISTED, CandidateStatus.PENDING_RECRUITER}


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


async def _lock_candidate(session: AsyncSession, candidate_id: UUID) -> Candidate:
    """SELECT ... FOR UPDATE: row-lock the candidate so concurrent HITL clicks can't
    race a double transition (Directive: state changes safe under concurrent traffic)."""
    res = await session.execute(
        select(Candidate).where(Candidate.id == candidate_id).with_for_update()
    )
    candidate = res.scalar_one_or_none()
    if candidate is None:
        raise IllegalTransition(f"Candidate {candidate_id} not found")
    return candidate


async def hire(session: AsyncSession, candidate_id: UUID) -> Candidate:
    """HITL Hire -> HIRED (terminal). Drops the interview room so the candidate is
    released from active matching/interview loops. job_id is retained for the record."""
    c = await _lock_candidate(session, candidate_id)
    if c.status not in _HIRE_FROM:
        raise IllegalTransition(f"Cannot hire from {c.status.value}")
    c.status = CandidateStatus.HIRED
    c.interview_room_id = None
    await session.commit()
    await session.refresh(c)
    return c


async def reject(session: AsyncSession, candidate_id: UUID) -> Candidate:
    """HITL Reject -> back to POOL with a persistent scalar penalty. The embedding is
    NOT touched; score_penalty depresses future automated ranking instead."""
    c = await _lock_candidate(session, candidate_id)
    if c.status not in _REJECT_FROM:
        raise IllegalTransition(f"Cannot reject from {c.status.value}")
    c.status = CandidateStatus.POOL
    c.job_id = None  # unlock from the job; free for future matching (but penalised)
    c.interview_room_id = None
    c.score_penalty = (c.score_penalty or 0.0) + REJECT_PENALTY
    await session.commit()
    await session.refresh(c)
    return c


async def release_uncalled(session: AsyncSession, candidate_id: UUID) -> Candidate:
    """HITL Uncalled Archive -> back to baseline POOL. Core metrics (embedding,
    ai_evaluation_score, score_penalty) are left UNCHANGED — no penalty applied."""
    c = await _lock_candidate(session, candidate_id)
    if c.status not in _UNCALLED_FROM:
        raise IllegalTransition(f"Cannot archive (uncalled) from {c.status.value}")
    c.status = CandidateStatus.POOL
    c.job_id = None
    c.interview_room_id = None
    await session.commit()
    await session.refresh(c)
    return c


async def get_candidate(session: AsyncSession, candidate_id: UUID) -> Candidate | None:
    return await session.get(Candidate, candidate_id)


async def list_candidates_for_job(session: AsyncSession, job_id: UUID) -> list[Candidate]:
    res = await session.execute(select(Candidate).where(Candidate.job_id == job_id))
    return list(res.scalars().all())
