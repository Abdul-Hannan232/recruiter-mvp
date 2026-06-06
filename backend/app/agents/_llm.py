"""Thin LLM client wrappers. Single import surface for all agents.

Provider split (cost/performance optimised):
  - embed()  -> Google Gemini (gemini-embedding-001, 768-d) to match the pgvector columns.
  - chat()   -> DeepSeek (deepseek-chat) for all text/extraction/drafting tasks.
  - OpenAI is reserved purely for the WebRTC voice agent (see app/core/realtime.py);
    it is intentionally NOT wired here.

DeepSeek exposes an OpenAI-compatible API, so we reuse the openai SDK pointed at a
custom base_url.
"""
from google import genai
from google.genai import types
from openai import AsyncOpenAI

from app.core.config import settings

_deepseek: AsyncOpenAI | None = None
_gemini: genai.Client | None = None


def deepseek() -> AsyncOpenAI:
    """Lazy DeepSeek client (OpenAI-compatible) for chat/extraction tasks."""
    global _deepseek
    if _deepseek is None:
        _deepseek = AsyncOpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url=settings.DEEPSEEK_BASE_URL,
        )
    return _deepseek


def gemini() -> genai.Client:
    global _gemini
    if _gemini is None:
        _gemini = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _gemini


async def embed(text: str) -> list[float]:
    """Embed text into a 768-d vector via Gemini gemini-embedding-001 (live).

    output_dimensionality is pinned to EMBED_DIM so the vector always matches the
    pgvector column width. Returns a plain list[float] — the stable contract every
    agent depends on.
    """
    resp = await gemini().aio.models.embed_content(
        model=settings.GEMINI_EMBED_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=settings.EMBED_DIM),
    )
    return list(resp.embeddings[0].values)


async def chat(
    messages: list[dict],
    *,
    model: str | None = None,
    temperature: float = 0.2,
    response_format: dict | None = None,
) -> str:
    """Chat completion via DeepSeek. Callers pass an explicit V4 model id (flash for
    extraction/drafting, pro for evaluation); defaults to flash when unspecified.
    Pass response_format={"type": "json_object"} to force strict JSON output."""
    kwargs: dict = {}
    if response_format is not None:
        kwargs["response_format"] = response_format
    resp = await deepseek().chat.completions.create(
        model=model or settings.DEEPSEEK_FLASH_MODEL,
        messages=messages,
        temperature=temperature,
        **kwargs,
    )
    return resp.choices[0].message.content or ""
