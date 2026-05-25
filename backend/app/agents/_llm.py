"""Thin LLM client wrappers. Single import surface for all agents.

Chat + Realtime run on OpenAI; embeddings run on Google Gemini
(text-embedding-004, 768-dim) to match the pgvector columns.
"""
from google import genai
from google.genai import types
from openai import AsyncOpenAI

from app.core.config import settings

_openai: AsyncOpenAI | None = None
_gemini: genai.Client | None = None


def client() -> AsyncOpenAI:
    global _openai
    if _openai is None:
        _openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai


def gemini() -> genai.Client:
    global _gemini
    if _gemini is None:
        _gemini = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _gemini


async def embed(text: str) -> list[float]:
    resp = await gemini().aio.models.embed_content(
        model=settings.GEMINI_EMBED_MODEL,
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=settings.EMBED_DIM),
    )
    return list(resp.embeddings[0].values)


async def chat(messages: list[dict], *, temperature: float = 0.2) -> str:
    resp = await client().chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=messages,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""
