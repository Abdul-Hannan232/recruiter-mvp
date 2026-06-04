"""
FastAPI entry point for the Agentic AI Recruitment System.

Responsibilities:
- Boot the ASGI app, mount the REST routers.
- Initialize the SQLAlchemy engine and ensure pgvector extension.
- Expose ephemeral OpenAI Realtime session tokens to the frontend
  (raw audio NEVER touches this server; WebRTC is browser <-> OpenAI direct).
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import router as api_router
from app.api import realtime_ws
from app.core.config import settings
from app.database.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Agentic Recruitment API",
    version="0.1.0",
    description="Sequential 5-agent recruitment funnel. Ephemeral-token WebRTC pattern.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
# Agent 4 code-context WebSocket. Mounted at root (not /api/v1) to match the
# frontend's ws://host/ws/code/{id} path.
app.include_router(realtime_ws.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
