"""
Agent 3 — Coordinator.

Generates a personalised outreach email via the OpenAI Chat Completions REST API
and (in this MVP) logs it. A real SMTP/SendGrid call would slot in here as a
BackgroundTask side-effect — still no Celery, still no Redis.
"""
import logging
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents._llm import chat
from app.core.config import settings
from app.database.session import SessionLocal
from app.models.db import Candidate, CandidateStatus, JobDescription
from app.services.email import send_email

log = logging.getLogger("agents.coordinator")


def _room_link(room_id: UUID) -> str:
    """Tokenized interview-room link back to the recruiter dashboard."""
    return f"{settings.DASHBOARD_BASE_URL}/interview?room={room_id}"


def _render_html(body_text: str, room_link: str) -> str:
    """Wrap the LLM-drafted body in a minimal responsive HTML email with a CTA."""
    safe = body_text.replace("\n", "<br>")
    return (
        '<html><body style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;'
        'line-height:1.6;max-width:560px;margin:0 auto;padding:24px">'
        f"<div>{safe}</div>"
        '<p style="margin:28px 0">'
        f'<a href="{room_link}" style="background:#4f46e5;color:#fff;text-decoration:none;'
        'padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">'
        "Join your interview</a></p>"
        f'<p style="font-size:12px;color:#64748b">Or paste this link: {room_link}</p>'
        "</body></html>"
    )


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
        model=settings.DEEPSEEK_FLASH_MODEL,  # Agent 3: outreach drafting
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
        # Mint a tokenized interview room binding this candidate to the target job,
        # then build the dashboard link deterministically in Python (never trusted to
        # the LLM) and instruct the model to embed this exact URL in the body.
        candidate.interview_room_id = uuid4()
        interview_link = _room_link(candidate.interview_room_id)
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
            model=settings.DEEPSEEK_FLASH_MODEL,  # Agent 3: outreach drafting
            temperature=0.5,
        )

        await send_email(
            to=candidate.email,
            subject=f"Interview invitation — {jd.title}",
            html_body=_render_html(email_body, interview_link),
        )

        # Agent 3 handoff: candidate is now SHORTLISTED, awaiting the recruiter's HITL call.
        candidate.status = CandidateStatus.SHORTLISTED
        completed += 1

    await db.commit()
    return {"outreach_completed": completed}


async def shortlist_and_invite(
    session: AsyncSession,
    candidate_id: UUID,
) -> dict:
    """Single-candidate Agent 3 handoff (used by the HITL shortlist + the live email
    test). Mints the room token, drafts via deepseek-v4-flash, sends/render the email
    to the candidate's own address, and moves the candidate MATCHED -> SHORTLISTED."""
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None:
        raise ValueError(f"Candidate {candidate_id} not found")
    jd = await session.get(JobDescription, candidate.job_id) if candidate.job_id else None
    if jd is None:
        raise ValueError("Candidate is not locked to a job; run Agent 2 matching first")

    candidate.interview_room_id = uuid4()
    interview_link = _room_link(candidate.interview_room_id)
    prompt = (
        f"JOB TITLE: {jd.title}\n\nJOB REQUIREMENTS:\n{jd.requirements_text}\n\n"
        f"CANDIDATE NAME: {candidate.full_name}\n\nCANDIDATE RESUME:\n"
        f"{candidate.original_resume_text}\n\nWrite the personalised outreach email now. "
        f"You MUST include this exact interview link in the email body:\n{interview_link}"
    )
    draft = await chat(
        [
            {"role": "system", "content": _OUTREACH_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        model=settings.DEEPSEEK_FLASH_MODEL,
        temperature=0.5,
    )
    html = _render_html(draft, interview_link)
    # Recipient is resolved dynamically from the candidate record — no hardcoding.
    delivery = await send_email(
        to=candidate.email,
        subject=f"Interview invitation — {jd.title}",
        html_body=html,
    )

    candidate.status = CandidateStatus.SHORTLISTED
    await session.commit()
    await session.refresh(candidate)
    return {
        "candidate_id": str(candidate.id),
        "interview_room_id": str(candidate.interview_room_id),
        "interview_link": interview_link,
        "status": candidate.status.value,
        "delivery": delivery,
        "draft": draft,
        "html": html,
    }


async def run_outreach_cycle_bg(job_id: UUID) -> None:
    """BackgroundTask entry point: opens its own session (the request session is
    already closed by the time this runs) and drives the outreach cycle."""
    async with SessionLocal() as session:
        await run_outreach_cycle(job_id, session)
