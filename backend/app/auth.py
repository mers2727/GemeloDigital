"""JWT-based authentication with local user table backed by Supabase.

Uses a pure-Python HMAC-SHA256 JWT implementation so the app works
without native crypto extensions. Password hashing uses hashlib-based
pbkdf2 (no bcrypt/cffi dependency).
"""

import hashlib
import hmac
import base64
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import get_settings, Settings

bearer_scheme = HTTPBearer()


# ─── Password hashing (PBKDF2-SHA256, pure Python) ───

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 260_000)
    return salt.hex() + ":" + dk.hex()


def verify_password(plain: str, hashed: str) -> bool:
    parts = hashed.split(":")
    if len(parts) != 2:
        return False
    salt = bytes.fromhex(parts[0])
    stored_dk = bytes.fromhex(parts[1])
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, 260_000)
    return hmac.compare_digest(dk, stored_dk)


# ─── JWT (HMAC-SHA256, pure Python) ───

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_access_token(data: dict, settings: Optional[Settings] = None) -> str:
    if settings is None:
        settings = get_settings()
    header = {"alg": "HS256", "typ": "JWT"}
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload["exp"] = int(expire.timestamp())

    segments = [
        _b64url_encode(json.dumps(header).encode()),
        _b64url_encode(json.dumps(payload).encode()),
    ]
    signing_input = f"{segments[0]}.{segments[1]}"
    signature = hmac.new(
        settings.jwt_secret.encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    segments.append(_b64url_encode(signature))
    return ".".join(segments)


def decode_token(token: str, settings: Optional[Settings] = None) -> dict:
    if settings is None:
        settings = get_settings()
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Bad token format")

        signing_input = f"{parts[0]}.{parts[1]}"
        expected_sig = hmac.new(
            settings.jwt_secret.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(parts[2])

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Signature mismatch")

        payload = json.loads(_b64url_decode(parts[1]))

        exp = payload.get("exp")
        if exp and datetime.now(timezone.utc).timestamp() > exp:
            raise ValueError("Token expired")

        return payload
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


class CurrentUser:
    """Dependency that extracts the current user from the JWT."""

    def __init__(self, user_id: str, email: str, full_name: str,
                 company_id: Optional[str] = None, role: Optional[str] = None):
        self.user_id = user_id
        self.email = email
        self.full_name = full_name
        self.company_id = company_id
        self.role = role


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    from app.database import get_supabase_service
    sb = get_supabase_service()

    # Fetch user
    user_row = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()
    if not user_row.data:
        raise HTTPException(status_code=401, detail="User not found")

    u = user_row.data

    # Fetch company membership
    membership = (
        sb.table("company_users")
        .select("company_id, role")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )

    company_id = membership.data["company_id"] if membership.data else None
    role = membership.data["role"] if membership.data else None

    return CurrentUser(
        user_id=u["id"],
        email=u["email"],
        full_name=u.get("full_name", ""),
        company_id=company_id,
        role=role,
    )


def require_role(*allowed_roles: str):
    """Dependency factory: ensures user has one of the allowed roles."""
    async def checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not user.company_id:
            raise HTTPException(status_code=403, detail="User not associated with a company")
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user.role}' not allowed. Required: {allowed_roles}",
            )
        return user
    return checker
