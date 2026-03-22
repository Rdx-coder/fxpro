from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
import os

DEFAULT_DEV_SECRET = "your-secret-key-change-in-production"
SECRET_KEY = os.getenv("JWT_SECRET_KEY", DEFAULT_DEV_SECRET)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# bcrypt has a 72-byte input limit. bcrypt_sha256 avoids that limit while
# still allowing verification of existing bcrypt hashes.
security = HTTPBearer()


def validate_auth_config() -> None:
    """Fail fast on insecure auth configuration in production-like environments."""
    env = os.getenv("APP_ENV", "development").lower()
    if env in {"production", "staging"}:
        if not SECRET_KEY or SECRET_KEY == DEFAULT_DEV_SECRET or len(SECRET_KEY) < 32:
            raise RuntimeError(
                "Invalid JWT_SECRET_KEY for production/staging. "
                "Set a strong secret with at least 32 characters."
            )

    if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
        raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be > 0")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    # Bcrypt processes up to 72 bytes; enforce model max_length <= 128 and hash safely.
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    role = payload.get("role")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    if role not in {"user", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token role",
        )
    return {"id": user_id, "role": role}

async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
