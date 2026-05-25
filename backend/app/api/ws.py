"""
WebSocket endpoint for live code-editor injection.

Flow:
  React editor change -> WS frame to /ws/code/{candidate_id}
  -> validated as CodeInjectionPayload
  -> Agent 4 (interviewer) forwards as conversation.item.create
     into the active OpenAI Realtime session.

The browser still owns the WebRTC audio channel — we only relay textual code
context. This is the "Code Injection via WebSockets" rule.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.agents import interviewer
from app.models.schemas import CodeInjectionPayload

log = logging.getLogger("api.ws")
router = APIRouter()


@router.websocket("/ws/code/{candidate_id}")
async def code_ws(ws: WebSocket, candidate_id: UUID) -> None:
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_json()
            raw["candidate_id"] = str(candidate_id)
            try:
                payload = CodeInjectionPayload.model_validate(raw)
            except ValidationError as e:
                await ws.send_json({"ok": False, "error": e.errors()})
                continue
            await interviewer.inject_code(payload)
            await ws.send_json({"ok": True})
    except WebSocketDisconnect:
        log.info("code_ws.disconnect", extra={"candidate_id": str(candidate_id)})
