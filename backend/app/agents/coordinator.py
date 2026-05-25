"""
Agent 3 — Coordinator.

Generates a personalised outreach email via the OpenAI Chat Completions REST API
and (in this MVP) logs it. A real SMTP/SendGrid call would slot in here as a
BackgroundTask side-effect — still no Celery, still no Redis.
"""
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import chat
from app.models.db import Candidate, JobDescription

log = logging.getLogger("agents.coordinator")


SYSTEM = (
    "You are a recruiting coordinator. Write a brief, warm, professional outreach "
    "email (<=120 words). Reference one concrete strength from the resume that "
    "aligns with the job. Sign off as 'The Hiring Team'."
)


async def run(session: AsyncSession, candidate_id: UUID) -> str:
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None:
        raise ValueError(f"Candidate {candidate_id} not found")
    jd = await session.get(JobDescription, candidate.job_id)
    if jd is None:
        raise ValueError(f"Job {candidate.job_id} not found")

    prompt = (
        f"JOB TITLE: {jd.title}\n\nJOB DESCRIPTION:\n{jd.description}\n\n"
        f"CANDIDATE NAME: {candidate.full_name}\n\nRESUME:\n{candidate.resume_text}"
    )
    message = await chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
    )

    log.info("outreach.draft", extra={"candidate_id": str(candidate_id), "to": candidate.email})
    # MVP: persist would go here (email_log table); we log + return.
    return message
