"""Thin OpenAI client wrapper. Single import surface for all agents."""
from openai import AsyncOpenAI

from app.core.config import settings

_client: AsyncOpenAI | None = None


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def embed(text: str) -> list[float]:
    resp = await client().embeddings.create(
        model=settings.OPENAI_EMBED_MODEL,
        input=text,
    )
    return resp.data[0].embedding


async def chat(messages: list[dict], *, temperature: float = 0.2) -> str:
    resp = await client().chat.completions.create(
        model=settings.OPENAI_CHAT_MODEL,
        messages=messages,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""
