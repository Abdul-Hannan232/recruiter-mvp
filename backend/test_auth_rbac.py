"""End-to-end RBAC verification for the Supabase-JWT auth dependency.

We cannot mint a real Supabase-signed token offline (we don't hold the project's
private key), so this script stands in a *test* ES256 keypair: it builds a JWKS from
the test public key, injects it into the auth module's cache, and forges access tokens
signed with the matching private key. The signature-verification path
(jwt.decode → ES256 → aud/iss/exp) is therefore exercised for real. Only the DB
role lookup is stubbed (real auth.users rows are FK-constrained), via resolve_role.

Asserts, against the genuinely protected GET /api/v1/jobs route:
    * no token            -> 401
    * bad signature       -> 401
    * candidate token     -> 403
    * recruiter token     -> 200
    * authenticated, no app profile -> 403
"""
import time
import uuid

from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jose import jwk, jwt

from app.core import auth
from app.core.config import settings
from app.models.db import UserRole
from main import app

JOBS_URL = "/api/v1/jobs"
KID = "test-key-es256"

# Known subjects -> stubbed roles (keeps the test off the FK-constrained auth.users).
RECRUITER_SUB = str(uuid.uuid4())
CANDIDATE_SUB = str(uuid.uuid4())
ORPHAN_SUB = str(uuid.uuid4())  # valid token, but no profile row


def _make_keypair() -> tuple[str, dict]:
    """Return (private_pem, public_jwk) for ES256."""
    priv = ec.generate_private_key(ec.SECP256R1())
    from cryptography.hazmat.primitives import serialization

    priv_pem = priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    pub_pem = (
        priv.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    pub_jwk = jwk.construct(pub_pem, algorithm="ES256").to_dict()
    # jose returns bytes for x/y in some versions; normalise to str for JSON parity.
    for k in ("x", "y"):
        if isinstance(pub_jwk.get(k), bytes):
            pub_jwk[k] = pub_jwk[k].decode()
    pub_jwk.update({"kid": KID, "use": "sig", "alg": "ES256"})
    return priv_pem, pub_jwk


def _token(priv_pem: str, sub: str, *, aud: str | None = None, iss: str | None = None) -> str:
    base = (settings.SUPABASE_URL or "").rstrip("/")
    claims = {
        "sub": sub,
        "aud": aud or settings.SUPABASE_JWT_AUD,
        "iss": iss or f"{base}/auth/v1",
        "email": f"{sub[:8]}@example.com",
        "exp": int(time.time()) + 600,
        "iat": int(time.time()),
    }
    return jwt.encode(claims, priv_pem, algorithm="ES256", headers={"kid": KID})


async def _fake_resolve_role(session, user_id):
    sid = str(user_id)
    if sid == RECRUITER_SUB:
        return UserRole.RECRUITER, "recruiter@example.com"
    if sid == CANDIDATE_SUB:
        return UserRole.CANDIDATE, "candidate@example.com"
    return None  # ORPHAN_SUB -> no profile


def main() -> None:
    priv_pem, pub_jwk = _make_keypair()

    # Inject our test JWKS into the in-process cache so _get_jwks() never hits network.
    auth._jwks_cache = {"keys": [pub_jwk]}
    auth._jwks_fetched_at = time.monotonic()
    # Stub the DB role lookup (real auth.users rows are FK-constrained).
    auth.resolve_role = _fake_resolve_role

    failures = []

    def check(label, got, expected):
        ok = got == expected
        print(f"  [{'PASS' if ok else 'FAIL'}] {label}: got {got}, expected {expected}")
        if not ok:
            failures.append(label)

    with TestClient(app) as client:
        print("Verifying RBAC on protected route GET /api/v1/jobs\n")

        r = client.get(JOBS_URL)
        check("no token -> 401", r.status_code, 401)

        bad = _token(priv_pem, RECRUITER_SUB)[:-3] + "xyz"  # corrupt signature
        r = client.get(JOBS_URL, headers={"Authorization": f"Bearer {bad}"})
        check("tampered signature -> 401", r.status_code, 401)

        r = client.get(
            JOBS_URL,
            headers={"Authorization": f"Bearer {_token(priv_pem, RECRUITER_SUB, aud='wrong')}"},
        )
        check("wrong audience -> 401", r.status_code, 401)

        r = client.get(
            JOBS_URL,
            headers={"Authorization": f"Bearer {_token(priv_pem, CANDIDATE_SUB)}"},
        )
        check("candidate token -> 403", r.status_code, 403)

        r = client.get(
            JOBS_URL,
            headers={"Authorization": f"Bearer {_token(priv_pem, ORPHAN_SUB)}"},
        )
        check("authenticated, no profile -> 403", r.status_code, 403)

        r = client.get(
            JOBS_URL,
            headers={"Authorization": f"Bearer {_token(priv_pem, RECRUITER_SUB)}"},
        )
        check("recruiter token -> 200", r.status_code, 200)
        if r.status_code == 200:
            print(f"         recruiter saw jobs list (len={len(r.json())})")

    print()
    if failures:
        print(f"RESULT: FAILED ({len(failures)} checks): {failures}")
        raise SystemExit(1)
    print("RESULT: ALL RBAC CHECKS PASSED")


if __name__ == "__main__":
    main()
