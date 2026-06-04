"""Agent 4 code-context channel (WebSocket).

The React editor opens ``ws://.../ws/code/{candidate_id}`` and streams editor
snapshots during the live interview. We accept the socket only while the
candidate is INTERVIEWING, then forward each snapshot into the live OpenAI
Realtime session via ``interviewer.inject_code``.

Raw audio never touches this server (that flows browser <-> OpenAI over WebRTC);
this socket carries structured text/code context only.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import interviewer
from app.database.session import get_session
from app.models.db import Candidate, CandidateStatus
from app.models.schemas import CodeInjectionPayload

log = logging.getLogger("api.realtime_ws")
router = APIRouter()

# 1008 = policy violation (RFC 6455). Used to reject candidates not cleared to interview.
_WS_POLICY_VIOLATION = 1008


@router.websocket("/ws/code/{candidate_id}")
async def code_channel(
    websocket: WebSocket,
    candidate_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    candidate = await session.get(Candidate, candidate_id)
    if candidate is None or candidate.status != CandidateStatus.INTERVIEWING:
        # Reject before accepting the stream — only live interviews may connect.
        await websocket.close(code=_WS_POLICY_VIOLATION)
        return

    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_json()
            # The URL path is the source of truth for whose session this is;
            # never trust a candidate_id supplied in the message body.
            raw["candidate_id"] = str(candidate_id)
            try:
                payload = CodeInjectionPayload(**raw)
            except ValidationError as e:
                log.warning(
                    "code_channel.bad_payload",
                    extra={"candidate_id": str(candidate_id), "err": str(e)},
                )
                continue
            await interviewer.inject_code(payload)
    except WebSocketDisconnect:
        log.info("code_channel.disconnect", extra={"candidate_id": str(candidate_id)})
