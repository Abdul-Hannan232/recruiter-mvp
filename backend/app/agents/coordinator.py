"""
Agent 3 — Coordinator.

Generates a personalised outreach email via the OpenAI Chat Completions REST API
and (in this MVP) logs it. A real SMTP/SendGrid call would slot in here as a
BackgroundTask side-effect — still no Celery, still no Redis.
"""
import asyncio
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
        f"JOB TITLE: {jd.title}\n\nJOB LOCATION: {jd.city or 'Remote'}\n\n"
        f"JOB DESCRIPTION:\n{jd.requirements_text}\n\n"
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
    "concrete strength from their resume that aligns with the job requirements. When a "
    "job location is provided, mention it naturally (e.g. 'for our team in <City>'). You "
    "MUST include, verbatim and on its own line, the interview link given in the prompt. "
    "Sign off as 'The Hiring Team'."
)


# Cap on simultaneous draft+send fan-out. Keeps the outreach burst from tripping
# DeepSeek / SMTP rate limits while still overlapping the (slow) network I/O.
_OUTREACH_CONCURRENCY = 8


async def run_outreach_cycle(job_id: UUID, db: AsyncSession) -> dict[str, int]:
    """Agent 3 — autonomous outreach for every MATCHED candidate locked to a job.

    Drafting (LLM) and sending (SMTP) for ALL matched candidates run CONCURRENTLY via
    asyncio.gather (bounded by a semaphore). This is the fix for the outreach bottleneck:
    the previous version awaited each candidate's draft+send sequentially, so N matches
    took N x (LLM + SMTP) latency (the 10-20 min delays), and a single mid-loop failure
    aborted the whole batch BEFORE the commit — stranding every candidate after the first
    (the "only one contacted" symptom). Now each candidate's I/O overlaps, failures are
    isolated per-candidate via return_exceptions, and the batch commits exactly once.

    The gathered coroutines perform pure network I/O and NEVER touch the shared
    AsyncSession (which is not safe for concurrent use); all session mutation happens
    sequentially afterwards. No recruiter review; this runs end-to-end on its own.
    """
    jd = await db.get(JobDescription, job_id)
    if jd is None:
        raise ValueError(f"Job {job_id} not found")

    stmt = select(Candidate).where(
        Candidate.job_id == job_id,
        Candidate.status == CandidateStatus.MATCHED,
    )
    candidates = list((await db.execute(stmt)).scalars().all())
    if not candidates:
        return {"outreach_completed": 0}

    sem = asyncio.Semaphore(_OUTREACH_CONCURRENCY)

    async def _draft_and_send(candidate: Candidate) -> UUID:
        # uuid4 + link are CPU-only; the awaits below are pure network I/O and never
        # touch `db`, so overlapping these under gather is safe. The room token is
        # RETURNED (not assigned here) so the session is mutated only after all I/O
        # resolves, in the sequential phase below. The link is built deterministically
        # in Python (never trusted to the LLM) and the model is told to embed it verbatim.
        room_id = uuid4()
        interview_link = _room_link(room_id)
        prompt = (
            f"JOB TITLE: {jd.title}\n\n"
            f"JOB LOCATION: {jd.city or 'Remote'}\n\n"
            f"JOB REQUIREMENTS:\n{jd.requirements_text}\n\n"
            f"CANDIDATE NAME: {candidate.full_name}\n\n"
            f"CANDIDATE RESUME:\n{candidate.original_resume_text}\n\n"
            f"Write the personalised outreach email now. You MUST include this exact "
            f"interview link in the email body:\n{interview_link}"
        )
        async with sem:
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
        return room_id

    results = await asyncio.gather(
        *(_draft_and_send(c) for c in candidates), return_exceptions=True
    )

    completed = 0
    for candidate, result in zip(candidates, results):
        if isinstance(result, Exception):
            # Isolated failure: this candidate stays MATCHED for the next cycle to retry;
            # everyone else still goes out.
            #
            # asyncio.gather(return_exceptions=True) hands the exception back as a *value*,
            # so there is NO active exception context here — a bare log.exception() would
            # dump "NoneType: None". We pass the captured exception explicitly via
            # exc_info=result to force the full, unedited traceback with line numbers.
            log.error(
                "Outreach task encountered an unhandled exception for candidate %s:",
                candidate.id,
                exc_info=result,
            )
            continue
        # Agent 3 handoff: bind the room token and advance MATCHED -> SHORTLISTED
        # (awaiting the recruiter's HITL call) only for candidates we actually reached.
        candidate.interview_room_id = result
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
        f"JOB TITLE: {jd.title}\n\nJOB LOCATION: {jd.city or 'Remote'}\n\n"
        f"JOB REQUIREMENTS:\n{jd.requirements_text}\n\n"
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


# --- Autonomous "Zero-Click" orchestration (Agent 2 -> Agent 3) ---------------

async def run_full_pipeline_bg(job_id: UUID) -> None:
    """Autonomous chain for one job: Agent 2 matches the pool, and IF anyone was newly
    locked, Agent 3 immediately drafts + sends outreach and shortlists them. Opens its
    own session (runs as a BackgroundTask after the request returns)."""
    from app.agents import matcher  # local import keeps matcher<->coordinator decoupled

    async with SessionLocal() as session:
        jd = await session.get(JobDescription, job_id)
        if jd is None or not jd.is_active:
            return  # job deleted or closed before the task ran — nothing to do
        summary = await matcher.run_matching_cycle(job_id, session)
        if summary.get("matched_and_locked", 0) > 0:
            # The recruiter may have closed the role mid-run; re-read DB state before
            # spending tokens/emails on outreach for a now-closed job.
            await session.refresh(jd)
            if not jd.is_active:
                return
            await run_outreach_cycle(job_id, session)


async def run_full_pipeline_all_jobs_bg() -> None:
    """A new candidate just entered the global pool — autonomously try them against
    every open job (each job's cycle locks + reaches out to any newly matched pool
    candidate)."""
    async with SessionLocal() as session:
        job_ids = list((await session.execute(select(JobDescription.id))).scalars().all())
    for jid in job_ids:
        await run_full_pipeline_bg(jid)
