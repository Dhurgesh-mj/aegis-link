# backend/auth.py
"""
Aegis-Link — Authentication Module
PyJWT + bcrypt. User registration, login, token verification.
User data stored in SQLite.
"""

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS
import db

log = logging.getLogger("auth")


class AuthError(Exception):
    """Raised on authentication failures."""
    pass


def register(username: str, password: str) -> str:
    """
    Register a new user.

    Args:
        username: unique username (case-insensitive, stored lowercase)
        password: plaintext password (min 6 chars)

    Returns:
        JWT token string

    Raises:
        AuthError if username taken or validation fails
    """
    username = username.strip().lower()

    if not username or len(username) < 3:
        raise AuthError("Username must be at least 3 characters")
    if not password or len(password) < 6:
        raise AuthError("Password must be at least 6 characters")
    if not username.isalnum():
        raise AuthError("Username must be alphanumeric")

    if db.user_exists(username):
        raise AuthError("Username already taken")

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.create_user(username, password_hash)
    log.info("User registered: %s", username)

    return _generate_token(username)


def login(username: str, password: str) -> str:
    """
    Authenticate a user and return a JWT token.

    Args:
        username: registered username
        password: plaintext password

    Returns:
        JWT token string

    Raises:
        AuthError if credentials invalid
    """
    username = username.strip().lower()

    stored_hash = db.get_user_password_hash(username)
    if not stored_hash:
        raise AuthError("Invalid username or password")

    if not bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
        raise AuthError("Invalid username or password")

    log.info("User logged in: %s", username)
    return _generate_token(username)


def verify_token(token: str) -> str:
    """
    Verify a JWT token and return the username.

    Args:
        token: JWT token string

    Returns:
        username string

    Raises:
        AuthError if token invalid or expired
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise AuthError("Invalid token payload")

        # Verify user still exists
        if not db.user_exists(username):
            raise AuthError("User no longer exists")

        return username
    except jwt.ExpiredSignatureError:
        raise AuthError("Token expired")
    except jwt.InvalidTokenError as exc:
        raise AuthError(f"Invalid token: {exc}")


def get_user(username: str) -> dict | None:
    """
    Fetch a user's data from SQLite.

    Returns:
        dict with user fields (excluding password_hash) or None
    """
    data = db.get_user(username)
    if not data:
        return None

    # Remove password hash from returned data
    data.pop("password_hash", None)
    return data


def _generate_token(username: str) -> str:
    """Generate a JWT token for the given username."""
    payload = {
        "sub": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
