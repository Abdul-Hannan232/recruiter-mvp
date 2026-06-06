"""
Ephemeral Token Pattern — OpenAI Realtime API.

The backend mints a short-lived client_secret and hands it to the browser.
The browser then opens a WebRTC peer connection DIRECTLY to OpenAI.
Raw audio never crosses our infrastructure — this is the security
and latency promise of the architecture.
"""
from typing import Any

import httpx

from app.core.config import settings

# GA Realtime API: ephemeral keys are minted here. The legacy beta endpoint
# /v1/realtime/sessions is retired and now 404s ("Invalid URL").
REALTIME_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"


async def mint_ephemeral_token(
    *,
    voice: str | None = None,
    instructions: str | None = None,
) -> dict[str, Any]:
    """Request a short-lived ephemeral key for the browser to use with WebRTC.

    Returns the upstream payload. In the GA API the ephemeral key is the
    top-level ``value`` (an ``ek_...`` string), and session metadata (id, etc.)
    is nested under ``session``.
    """
    session_cfg: dict[str, Any] = {
        "type": "realtime",
        "model": settings.OPENAI_REALTIME_MODEL,
    }
    if instructions:
        session_cfg["instructions"] = instructions
    # Enable input-audio transcription (whisper-1) so the CANDIDATE's speech is
    # transcribed and emitted over the data channel — without this we'd only ever
    # capture the interviewer's side. Output voice is merged in when supplied.
    session_cfg["audio"] = {
        "input": {"transcription": {"model": "whisper-1"}},
        **({"output": {"voice": voice}} if voice else {}),
    }

    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            REALTIME_CLIENT_SECRETS_URL, json={"session": session_cfg}, headers=headers
        )
        resp.raise_for_status()
        return resp.json()
