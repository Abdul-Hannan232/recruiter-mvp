"""
Agent 4 — Interviewer.

Owns the live interview session. Two responsibilities:
  (a) Mint an ephemeral OpenAI Realtime token bound to an interview-flavoured
      system prompt so the browser can open WebRTC directly to OpenAI.
  (b) Durably persist code the candidate submits during the live interview, so
      Agent 5 always has the real artifact to grade.

Raw audio NEVER flows through FastAPI; the browser talks to OpenAI directly over
WebRTC. This module only issues the session ticket and records code submissions.
"""
import logging
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.realtime import mint_ephemeral_token
from app.models.db import Candidate, CandidateStatus, JobDescription

log = logging.getLogger("agents.interviewer")


INTERVIEW_SYSTEM = (
    "You are a senior technical interviewer conducting a live voice interview. "
    "Conduct the interview in a natural, code-switching mix of Urdu and English — the "
    "way Pakistani tech professionals actually speak: keep technical terms in English "
    "while explanations, transitions, and rapport flow in Urdu. Your spoken audio MUST "
    "be natively bilingual (Urdu + English); any text you emit may be Roman Urdu + "
    "English. Maintain a professional, technical tone throughout. Be concise, ask one "
    "question at a time, and probe edge cases."
)


# A candidate may fetch a token on first entry (OUTREACH_SENT) or when rejoining
# after a dropped WebRTC connection (already INTERVIEWING). Both are cleared.
_TOKEN_ALLOWED_STATUSES = (CandidateStatus.OUTREACH_SENT, CandidateStatus.INTERVIEWING)


async def generate_webrtc_token(candidate_id: UUID, db: AsyncSession) -> dict:
    """Mint an ephemeral OpenAI Realtime token for the browser's WebRTC handshake.

    Acts as the secure "ticket booth": it never touches audio. It verifies the
    candidate is cleared to interview (OUTREACH_SENT for a first attempt, or
    INTERVIEWING when rejoining after a dropped connection), locks them into
    INTERVIEWING, then returns a token the frontend uses to connect directly to
    OpenAI. Raw audio flows browser <-> OpenAI; this server only issues the ticket.

    Returns ``{"token": <client_secret>, "model": <realtime model>}``.
    """
    candidate = await db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if candidate.status not in _TOKEN_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=403,
            detail=(
                "Candidate is not cleared to interview "
                f"(status={candidate.status.value}, expected outreach_sent or interviewing)"
            ),
        )

    if not settings.OPENAI_API_KEY:
        # Server misconfiguration, not a client error.
        raise HTTPException(status_code=500, detail="OpenAI API key is not configured")

    # Mint the real ephemeral token BEFORE mutating state, so a failed upstream
    # call doesn't strand the candidate in INTERVIEWING. mint_ephemeral_token
    # performs the async httpx POST to /v1/realtime/client_secrets (GA endpoint).
    try:
        payload = await mint_ephemeral_token(instructions=INTERVIEW_SYSTEM)
        token = payload["value"]  # GA: ephemeral key is the top-level "value"
    except httpx.HTTPError as e:
        log.error("generate_webrtc_token.upstream_error", extra={"err": str(e)})
        raise HTTPException(
            status_code=500, detail="Failed to mint realtime token from OpenAI"
        ) from e
    except (KeyError, TypeError) as e:
        log.error("generate_webrtc_token.bad_payload", extra={"err": str(e)})
        raise HTTPException(
            status_code=500, detail="Unexpected response shape from OpenAI"
        ) from e

    candidate.status = CandidateStatus.INTERVIEWING  # lock them into the session
    await db.commit()

    return {"token": token, "model": settings.OPENAI_REALTIME_MODEL}


def _interview_instructions(candidate: Candidate, jd: JobDescription | None) -> str:
    """Build a context-rich system prompt grounding the interviewer in this specific
    candidate's resume and the target job — so questions probe their real experience."""
    role_ctx = (
        f"# ROLE\nJOB TITLE: {jd.title}\nJOB REQUIREMENTS:\n{jd.requirements_text}\n\n"
        if jd is not None
        else "# ROLE\n(No job description on file.)\n\n"
    )
    return (
        f"{INTERVIEW_SYSTEM}\n\n"
        f"{role_ctx}"
        f"# CANDIDATE RESUME\n{candidate.original_resume_text}\n\n"
        "Tailor every question to interrogate the candidate's claimed experience above "
        "against the role's requirements. Start by greeting them by name "
        f"({candidate.full_name}) and asking your first question."
    )


# Room flow (Phase 3 -> 4): a SHORTLISTED candidate enters via their tokenized link;
# INTERVIEWING is allowed too so a dropped WebRTC connection can rejoin the same room.
_ROOM_TOKEN_ALLOWED = (CandidateStatus.SHORTLISTED, CandidateStatus.INTERVIEWING)


async def generate_webrtc_token_by_room(room_id: UUID, db: AsyncSession) -> dict:
    """Phase 4 ticket booth, keyed by the Phase 3 interview_room_id.

    Resolves the room -> candidate, verifies they are SHORTLISTED (or already
    INTERVIEWING for a rejoin), grounds the Realtime session in their resume + JD,
    mints the ephemeral token, then locks them into INTERVIEWING. Audio never touches
    this server. Returns ``{token, model, candidate_id}`` (the frontend needs the
    candidate_id for the code-context WS and the /complete call).
    """
    candidate = (
        await db.execute(select(Candidate).where(Candidate.interview_room_id == room_id))
    ).scalar_one_or_none()
    if candidate is None:
        raise HTTPException(status_code=404, detail="Invalid or expired interview room")
    if candidate.status not in _ROOM_TOKEN_ALLOWED:
        raise HTTPException(
            status_code=403,
            detail=(
                "This interview room is not active "
                f"(status={candidate.status.value}, expected shortlisted)"
            ),
        )
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key is not configured")

    jd = await db.get(JobDescription, candidate.job_id) if candidate.job_id else None
    instructions = _interview_instructions(candidate, jd)

    # Mint BEFORE mutating state, so an upstream failure doesn't strand the candidate.
    try:
        payload = await mint_ephemeral_token(instructions=instructions)
        token = payload["value"]
    except httpx.HTTPError as e:
        log.error("room_token.upstream_error", extra={"err": str(e)})
        raise HTTPException(500, "Failed to mint realtime token from OpenAI") from e
    except (KeyError, TypeError) as e:
        log.error("room_token.bad_payload", extra={"err": str(e)})
        raise HTTPException(500, "Unexpected response shape from OpenAI") from e

    if candidate.status == CandidateStatus.SHORTLISTED:
        candidate.status = CandidateStatus.INTERVIEWING  # lock into the session
        await db.commit()

    return {
        "token": token,
        "model": settings.OPENAI_REALTIME_MODEL,
        "candidate_id": str(candidate.id),
    }
