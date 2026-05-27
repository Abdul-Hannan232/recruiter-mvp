"""
Agent 3 — Coordinator.

Generates a personalised outreach email via the OpenAI Chat Completions REST API
and (in this MVP) logs it. A real SMTP/SendGrid call would slot in here as a
BackgroundTask side-effect — still no Celery, still no Redis.
"""
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import chat
from app.database.session import SessionLocal
from app.models.db import Candidate, CandidateStatus, JobDescription

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
        f"JOB TITLE: {jd.title}\n\nJOB DESCRIPTION:\n{jd.requirements_text}\n\n"
        f"CANDIDATE NAME: {candidate.full_name}\n\nRESUME:\n{candidate.original_resume_text}"
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


# --- Autonomous batch outreach (no recruiter review) --------------------------

_OUTREACH_SYSTEM = (
    "You are an autonomous recruiting coordinator. Write a brief, warm, professional "
    "outreach email (<=150 words) inviting the candidate to an interview. Reference one "
    "concrete strength from their resume that aligns with the job requirements. You MUST "
    "include, verbatim and on its own line, the interview link given in the prompt. Sign "
    "off as 'The Hiring Team'."
)


async def run_outreach_cycle(job_id: UUID, db: AsyncSession) -> dict[str, int]:
    """Agent 3 — autonomous outreach for every MATCHED candidate locked to a job.

    For each candidate the LLM (mocked locally) drafts a personalised email that must
    embed the candidate's unique interview link. The email is "sent" by logging it, the
    candidate advances to OUTREACH_SENT, and a single commit persists the batch.
    No recruiter review; this runs end-to-end on its own.
    """
    jd = await db.get(JobDescription, job_id)
    if jd is None:
        raise ValueError(f"Job {job_id} not found")

    stmt = select(Candidate).where(
        Candidate.job_id == job_id,
        Candidate.status == CandidateStatus.MATCHED,
    )
    candidates = (await db.execute(stmt)).scalars().all()

    completed = 0
    for candidate in candidates:
        # The link is built deterministically in Python (never trusted to the LLM),
        # then the prompt instructs the model to embed this exact URL in the body.
        interview_link = f"http://localhost:5173/interview/{candidate.id}"
        prompt = (
            f"JOB TITLE: {jd.title}\n\n"
            f"JOB REQUIREMENTS:\n{jd.requirements_text}\n\n"
            f"CANDIDATE NAME: {candidate.full_name}\n\n"
            f"CANDIDATE RESUME:\n{candidate.original_resume_text}\n\n"
            f"Write the personalised outreach email now. You MUST include this exact "
            f"interview link in the email body:\n{interview_link}"
        )
        email_body = await chat(
            [
                {"role": "system", "content": _OUTREACH_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
        )

        # Simulate "sending": log the full draft + the injected link for visibility.
        log.info(
            "📧 OUTREACH SENT\n  to: %s <%s>\n  interview_link: %s\n  body:\n%s\n%s",
            candidate.full_name,
            candidate.email,
            interview_link,
            email_body,
            "-" * 60,
        )

        candidate.status = CandidateStatus.OUTREACH_SENT
        completed += 1

    await db.commit()
    return {"outreach_completed": completed}


async def run_outreach_cycle_bg(job_id: UUID) -> None:
    """BackgroundTask entry point: opens its own session (the request session is
    already closed by the time this runs) and drives the outreach cycle."""
    async with SessionLocal() as session:
        await run_outreach_cycle(job_id, session)
