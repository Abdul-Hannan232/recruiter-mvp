"""
Agent 2 — Matcher.

Purely deterministic. Computes pgvector cosine similarity between the candidate's
resume embedding and the parent JD embedding. Persists ai_evaluation_score. NO LLM calls.

This agent acts as the hard gate: if score < MATCH_THRESHOLD the pipeline halts.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import embed
from app.core.config import settings
from app.models.db import Candidate, CandidateStatus, JobDescription


async def _ensure_jd_embedding(session: AsyncSession, jd: JobDescription) -> list[float]:
    if jd.jd_embedding is not None:
        return jd.jd_embedding
    vec = await embed(jd.requirements_text)
    jd.jd_embedding = vec
    await session.commit()
    return vec


async def run(session: AsyncSession, candidate_id: UUID) -> float:
    """Returns cosine similarity in [0, 1]."""
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None or candidate.resume_embedding is None:
        raise ValueError("Candidate or candidate embedding missing")

    jd = (await session.execute(
        select(JobDescription).where(JobDescription.id == candidate.job_id)
    )).scalar_one()
    await _ensure_jd_embedding(session, jd)

    # pgvector cosine distance d in [0, 2]; similarity = 1 - d/2 in [0, 1].
    stmt = select(
        JobDescription.jd_embedding.cosine_distance(candidate.resume_embedding)
    ).where(JobDescription.id == jd.id)
    distance = float((await session.execute(stmt)).scalar_one())
    score = max(0.0, 1.0 - (distance / 2.0))

    candidate.ai_evaluation_score = score
    await session.commit()
    return score


async def run_matching_cycle(
    job_id: UUID, db: AsyncSession, top_k: int = 50
) -> dict[str, int]:
    """Batch Talent-Pool matcher (the "Top-K Math Gate"). ZERO generative LLM calls.

    Pulls the JD vector, then runs a single pgvector query over the POOL ordered by
    cosine distance, capped at top_k. Each returned candidate whose distance is
    strictly < MATCH_DISTANCE_THRESHOLD is locked to this job (status -> MATCHED,
    job_id set). Candidates at or above the threshold are left untouched in the POOL
    (job_id stays None) so a future JD can claim them.

    NOTE: `db` is an AsyncSession (the whole app is async); param name/order mirror
    the agreed `run_matching_cycle(job_id, db, top_k)` contract.
    """
    jd = await db.get(JobDescription, job_id)
    if jd is None:
        raise ValueError(f"Job {job_id} not found")
    if jd.jd_embedding is None:
        raise ValueError(f"Job {job_id} has no embedding; cannot match")

    # pgvector cosine distance, computed in SQL. We select the candidate row AND the
    # distance scalar so the threshold gate runs in Python against real DB math.
    distance = Candidate.resume_embedding.cosine_distance(jd.jd_embedding)
    stmt = (
        select(Candidate, distance.label("distance"))
        .where(Candidate.status == CandidateStatus.POOL)
        .order_by(distance)  # ascending: closest (most similar) first
        .limit(top_k)
    )
    rows = (await db.execute(stmt)).all()

    matched = 0
    for candidate, dist in rows:
        if dist < settings.MATCH_DISTANCE_THRESHOLD:
            candidate.status = CandidateStatus.MATCHED
            candidate.job_id = job_id  # lock the candidate to this role
            matched += 1
        # else: leave in POOL with job_id=None for a future job to match.

    await db.commit()
    return {"total_evaluated": len(rows), "matched_and_locked": matched}
