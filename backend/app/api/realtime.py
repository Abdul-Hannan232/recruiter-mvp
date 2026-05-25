"""
Ephemeral token endpoint.

The browser calls this once per interview to obtain a short-lived
client_secret. It then opens a WebRTC peer connection DIRECTLY to OpenAI.
The server returns immediately and stays out of the audio path.
"""
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.agents.interviewer import start_session
from app.models.schemas import EphemeralTokenResponse

router = APIRouter()


@router.post("/sessions/{candidate_id}", response_model=EphemeralTokenResponse)
async def create_session(candidate_id: UUID) -> EphemeralTokenResponse:
    try:
        payload = await start_session(candidate_id)
    except Exception as e:  # surface upstream OpenAI errors as 502
        raise HTTPException(502, f"Realtime upstream error: {e}") from e

    return EphemeralTokenResponse(
        session_id=payload["id"],
        client_secret=payload["client_secret"]["value"],
        expires_at=payload["client_secret"]["expires_at"],
        model=payload.get("model", ""),
    )
