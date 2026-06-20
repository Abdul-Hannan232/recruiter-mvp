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


async def run(
    session: AsyncSession, candidate_id: UUID, target_city: str | None = None
) -> float:
    """Returns cosine similarity in [0, 1].

    LOCATION-AWARE (Phase 13): mirrors run_matching_cycle's hard geo gate. ``target_city``
    defaults to the job's ``city``; when it is a concrete (non-"remote") city and the
    candidate isn't in it, the candidate FAILS the gate and is scored 0.0 — exactly as
    the SQL ILIKE filter would exclude them from the batch shortlist.
    """
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None or candidate.resume_embedding is None:
        raise ValueError("Candidate or candidate embedding missing")

    jd = (await session.execute(
        select(JobDescription).where(JobDescription.id == candidate.job_id)
    )).scalar_one()
    await _ensure_jd_embedding(session, jd)

    # Hard location gate, consistent with the batch matcher.
    if target_city is None:
        target_city = jd.city
    if target_city and target_city.strip().lower() != "remote":
        cand_city = (candidate.city or "").strip().lower()
        if cand_city != target_city.strip().lower():
            candidate.ai_evaluation_score = 0.0
            await session.commit()
            return 0.0

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
    job_id: UUID, db: AsyncSession, top_k: int = 50, target_city: str | None = None
) -> dict[str, int]:
    """Batch Talent-Pool matcher (the "Top-K Math Gate"). ZERO generative LLM calls.

    Pulls the JD vector, then runs a single pgvector query over the POOL ordered by
    cosine distance, capped at top_k. Each returned candidate whose distance is
    strictly < MATCH_DISTANCE_THRESHOLD is locked to this job (status -> MATCHED,
    job_id set). Candidates at or above the threshold are left untouched in the POOL
    (job_id stays None) so a future JD can claim them.

    LOCATION-AWARE (Phase 12): ``target_city`` defaults to the job's ``city``. When set
    to a concrete (non-"remote") city, a HARD metadata filter is applied as a SQL WHERE
    clause so the pool is restricted to that city BEFORE the cosine ORDER BY + LIMIT —
    i.e. geography gates the shortlist prior to vector ranking, never after. "remote"
    (case-insensitive) or an absent city disables the filter (global search).

    NOTE: `db` is an AsyncSession (the whole app is async); param name/order mirror
    the agreed `run_matching_cycle(job_id, db, top_k)` contract.
    """
    jd = await db.get(JobDescription, job_id)
    if jd is None:
        raise ValueError(f"Job {job_id} not found")
    if not jd.is_active:
        # Zombie-job safety net: a closed role never sources new candidates.
        return {"total_evaluated": 0, "matched_and_locked": 0}
    if jd.jd_embedding is None:
        raise ValueError(f"Job {job_id} has no embedding; cannot match")

    # Default the geo target to the job's own city unless the caller overrides it.
    if target_city is None:
        target_city = jd.city
    apply_city = bool(target_city and target_city.strip().lower() != "remote")

    # pgvector cosine distance, computed in SQL. We add the persistent score_penalty
    # (set on recruiter REJECT) so previously-rejected candidates rank lower and fall
    # below the gate — the 768-d embedding itself is never mutated. effective = d + p.
    distance = Candidate.resume_embedding.cosine_distance(jd.jd_embedding)
    effective = (distance + Candidate.score_penalty).label("effective_distance")
    stmt = select(Candidate, effective).where(Candidate.status == CandidateStatus.POOL)
    if apply_city:
        # HARD pre-vector location gate: case-insensitive exact city match. Candidates
        # with a NULL city (pre-Phase-11) are intentionally excluded from a city-scoped
        # search. ILIKE without wildcards == whole-string case-insensitive equality.
        stmt = stmt.where(Candidate.city.ilike(target_city.strip()))
    stmt = stmt.order_by(effective).limit(top_k)  # closest (least penalised) first
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
