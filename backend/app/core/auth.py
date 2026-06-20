"""Supabase Auth (ES256 / JWKS) verification + app-side RBAC resolution.

Flow: the browser authenticates against Supabase Auth and receives an ES256-signed
access token. We verify that token against the project's published JWKS (asymmetric
public keys, cached in-process so there is no per-request network hop), then resolve
the caller's *application* role by looking them up in our own `recruiters` /
`candidates` tables. Supabase Auth owns identity + credentials — we never store a
password here.

Why this matters: our backend connects to Postgres as the `postgres` role, which has
BYPASSRLS, so database RLS does NOT constrain server-side requests. This dependency is
therefore the authoritative RBAC gate at the API layer.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.session import get_session
from app.models.db import Candidate, Recruiter, UserRole

bearer_scheme = HTTPBearer(auto_error=False)

# --- JWKS in-process cache -------------------------------------------------
# The project's public signing keys change rarely (only on key rotation), so we
# cache them and refresh at most once per TTL — keeping the auth path latency to a
# single signature verification + one indexed DB lookup.
_JWKS_TTL_SECONDS = 3600
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0


@dataclass(frozen=True)
class Principal:
    """The authenticated, role-resolved caller passed to route handlers."""

    user_id: UUID  # == Supabase auth.users.id (the JWT `sub`)
    role: UserRole
    email: str | None


def _jwks_url() -> str:
    base = (settings.SUPABASE_URL or "").rstrip("/")
    if not base:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "SUPABASE_URL is not configured"
        )
    return f"{base}/auth/v1/.well-known/jwks.json"


def _issuer() -> str:
    return f"{(settings.SUPABASE_URL or '').rstrip('/')}/auth/v1"


async def _get_jwks(*, force: bool = False) -> dict:
    global _jwks_cache, _jwks_fetched_at
    now = time.monotonic()
    fresh = _jwks_cache is not None and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS
    if fresh and not force:
        return _jwks_cache  # type: ignore[return-value]
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(_jwks_url())
        resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_fetched_at = now
    return _jwks_cache


def _select_key(jwks: dict, kid: str | None) -> dict | None:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


async def _verify_token(token: str) -> dict:
    """Verify the ES256 signature + standard claims; return the decoded payload."""
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Malformed token") from e

    kid = header.get("kid")
    alg = header.get("alg", "ES256")

    key = _select_key(await _get_jwks(), kid)
    if key is None:
        # Cache miss can mean the project rotated keys — refresh once and retry.
        key = _select_key(await _get_jwks(force=True), kid)
    if key is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown token signing key")

    try:
        return jwt.decode(
            token,
            key,
            algorithms=[alg],
            audience=settings.SUPABASE_JWT_AUD,
            issuer=_issuer(),
        )
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from e


async def resolve_role(session: AsyncSession, user_id: UUID) -> tuple[UserRole, str | None] | None:
    """Map a Supabase user id to an application role via our own tables.

    Recruiters are the common protected path and live in a tiny table, so we probe
    that first and short-circuit (one indexed lookup). Returns None if the user is
    authenticated by Supabase but has no profile row in our app.
    """
    rec_email = (
        await session.execute(select(Recruiter.email).where(Recruiter.user_id == user_id))
    ).scalar_one_or_none()
    if rec_email is not None:
        return UserRole.RECRUITER, rec_email

    cand_email = (
        await session.execute(select(Candidate.email).where(Candidate.user_id == user_id))
    ).scalar_one_or_none()
    if cand_email is not None:
        return UserRole.CANDIDATE, cand_email

    return None


async def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> Principal:
    """Primary auth dependency: verify the Supabase JWT and resolve the app role."""
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")

    payload = await _verify_token(creds.credentials)
    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing a valid subject") from e

    resolved = await resolve_role(session, user_id)
    if resolved is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Authenticated user has no application profile"
        )
    role, email = resolved
    return Principal(user_id=user_id, role=role, email=email or payload.get("email"))


@dataclass(frozen=True)
class AuthIdentity:
    """A verified Supabase identity with NO app-side role resolved yet."""

    user_id: UUID
    email: str | None
    city: str | None


async def authenticated_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthIdentity:
    """Lightweight auth: verify the Supabase JWT and return the identity WITHOUT
    requiring an existing recruiters/candidates row. Used by the candidate's first
    resume upload, which must run before any app profile exists (avoids the RBAC
    chicken-and-egg trap in current_user)."""
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    payload = await _verify_token(creds.credentials)
    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing a valid subject") from e
    # city is set at signup into Supabase user_metadata (options.data), so it rides in
    # the JWT's user_metadata claim — the auth-level location source of truth.
    metadata = payload.get("user_metadata") or {}
    return AuthIdentity(
        user_id=user_id, email=payload.get("email"), city=metadata.get("city")
    )


def require_roles(*allowed: UserRole):
    """Dependency factory: 403 unless the caller holds one of `allowed` roles."""

    async def _guard(principal: Principal = Depends(current_user)) -> Principal:
        if principal.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role for this action")
        return principal

    return _guard


# Convenience guard for the recruiter-only management surface.
require_recruiter = require_roles(UserRole.RECRUITER)
