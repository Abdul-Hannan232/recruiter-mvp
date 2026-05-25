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

REALTIME_SESSIONS_URL = "https://api.openai.com/v1/realtime/sessions"


async def mint_ephemeral_token(
    *,
    voice: str = "verse",
    instructions: str | None = None,
) -> dict[str, Any]:
    """Request a short-lived client_secret for the browser to use with WebRTC.

    Returns the upstream payload; the frontend reads `client_secret.value`.
    """
    payload: dict[str, Any] = {
        "model": settings.OPENAI_REALTIME_MODEL,
        "voice": voice,
        "modalities": ["audio", "text"],
    }
    if instructions:
        payload["instructions"] = instructions

    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(REALTIME_SESSIONS_URL, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()
