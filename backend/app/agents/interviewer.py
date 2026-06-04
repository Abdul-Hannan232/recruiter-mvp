"""
Agent 4 — Interviewer.

Owns the live interview session. Two responsibilities:
  (a) Mint an ephemeral OpenAI Realtime token bound to an interview-flavoured
      system prompt so the browser can open WebRTC directly to OpenAI.
  (b) Track active WebSocket connections from the React code editor and
      forward textual "code context" updates into the live Realtime session
      via server-side event injection.

Raw audio NEVER flows through FastAPI. This module only routes structured
text/code events into OpenAI's session context.
"""
import asyncio
import json
import logging
from dataclasses import dataclass, field
from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.realtime import mint_ephemeral_token
from app.models.db import Candidate, CandidateStatus
from app.models.schemas import CodeInjectionPayload

log = logging.getLogger("agents.interviewer")


INTERVIEW_SYSTEM = (
    "You are a senior technical interviewer conducting a live voice interview. "
    "Be concise, ask one question at a time, and probe edge cases. "
    "When the candidate's code editor updates, the system will inject a "
    "[CODE UPDATE] block; reason about it before your next utterance."
)


@dataclass
class LiveSession:
    candidate_id: UUID
    openai_session_id: str
    code_history: list[dict] = field(default_factory=list)


class InterviewerRegistry:
    """Process-local registry. FastAPI BackgroundTasks share this in-process."""

    def __init__(self) -> None:
        self._sessions: dict[UUID, LiveSession] = {}
        self._lock = asyncio.Lock()

    async def open(self, candidate_id: UUID, openai_session_id: str) -> LiveSession:
        async with self._lock:
            sess = LiveSession(candidate_id=candidate_id, openai_session_id=openai_session_id)
            self._sessions[candidate_id] = sess
            return sess

    async def close(self, candidate_id: UUID) -> LiveSession | None:
        async with self._lock:
            return self._sessions.pop(candidate_id, None)

    def get(self, candidate_id: UUID) -> LiveSession | None:
        return self._sessions.get(candidate_id)


registry = InterviewerRegistry()


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
    # performs the async httpx POST to /v1/realtime/sessions.
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


async def start_session(candidate_id: UUID) -> dict:
    """Mint ephemeral token for browser WebRTC. Returns OpenAI's session payload."""
    payload = await mint_ephemeral_token(instructions=INTERVIEW_SYSTEM)
    await registry.open(candidate_id, payload["session"]["id"])
    return payload


def format_code_block(p: CodeInjectionPayload) -> str:
    """Convert an editor payload into a textual context string for the model."""
    header = f"[CODE UPDATE] lang={p.language}"
    if p.cursor_line is not None:
        header += f" cursor_line={p.cursor_line}"
    if p.note:
        header += f" note={p.note!r}"
    return f"{header}\n```{p.language}\n{p.code}\n```"


async def inject_code(payload: CodeInjectionPayload) -> None:
    """
    Push the editor snapshot into the live OpenAI Realtime session.

    This uses the Realtime REST surface to append a conversation item server-side,
    so the model sees the latest code on its next turn without the browser having
    to relay it over WebRTC's audio data channel.
    """
    session = registry.get(payload.candidate_id)
    if session is None:
        log.warning("inject_code.no_session", extra={"candidate_id": str(payload.candidate_id)})
        return

    session.code_history.append({"language": payload.language, "code": payload.code})

    event = {
        "type": "conversation.item.create",
        "item": {
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": format_code_block(payload)}],
        },
    }
    url = f"https://api.openai.com/v1/realtime/sessions/{session.openai_session_id}/events"
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(url, content=json.dumps(event), headers=headers)
    except httpx.HTTPError as e:
        log.error("inject_code.http_error", extra={"err": str(e)})
