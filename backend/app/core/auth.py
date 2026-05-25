"""Minimal JWT auth helpers for recruiter accounts."""
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return pwd_ctx.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return pwd_ctx.verify(raw, hashed)


def create_access_token(subject: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_TTL_MIN)
    return jwt.encode(
        {"sub": subject, "exp": exp},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALG,
    )


def current_user(token: str | None = Depends(oauth2_scheme)) -> str:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
        return payload["sub"]
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from e
