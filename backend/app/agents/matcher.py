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
from app.models.db import Candidate, JobDescription


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
