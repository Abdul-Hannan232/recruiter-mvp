"""
Five-agent sequential funnel. Each module exposes a single `run()` coroutine.

Order:
  1. vectorizer  — parse + embed resume
  2. matcher     — pgvector cosine, deterministic hard gate
  3. coordinator — outreach (LLM)
  4. interviewer — orchestrate WebRTC + WS code injection
  5. evaluator   — post-interview scoring (LLM, async)
"""
