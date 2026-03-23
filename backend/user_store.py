# backend/user_store.py
"""
Aegis-Link — User Store
SQLite-backed user data access for notification routing.
"""

import logging

import db

log = logging.getLogger("user_store")


def get_all_users() -> list[dict]:
    """Return a list of all registered user dicts (excluding password hashes)."""
    try:
        return db.get_all_users()
    except Exception as exc:
        log.error("Failed to fetch all users: %s", exc)
        return []


def update_user_notifications(
    username: str,
    discord_webhook: str = "",
    telegram_id: str = "",
    notify_pump: bool = True,
    notify_dump: bool = False,
    notify_watch: bool = False,
) -> bool:
    """
    Update a user's notification preferences.
    Returns True on success, False if user not found.
    """
    try:
        result = db.update_user_notifications(
            username=username,
            discord_webhook=discord_webhook,
            telegram_id=telegram_id,
            notify_pump=notify_pump,
            notify_dump=notify_dump,
            notify_watch=notify_watch,
        )
        if result:
            log.info("Updated notifications for user %s", username)
        else:
            log.warning("User not found for notification update: %s", username)
        return result
    except Exception as exc:
        log.error("Failed to update notifications for %s: %s", username, exc)
        return False


def get_users_wanting_signal(signal_type: str) -> list[dict]:
    """
    Return list of users who have opted in to receive a given signal type.
    """
    try:
        matching = db.get_users_wanting_signal(signal_type)
        log.debug(
            "Found %d users wanting %s signals",
            len(matching), signal_type,
        )
        return matching
    except Exception as exc:
        log.error("Failed to query users for signal %s: %s", signal_type, exc)
        return []
