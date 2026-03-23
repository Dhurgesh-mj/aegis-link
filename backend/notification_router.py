# backend/notification_router.py
"""
Aegis-Link — Personal Notification Router
Routes signals to individual users based on their preferences.
Delivers via Discord webhooks and/or Telegram bot messages.
Per-coin cooldown to prevent repeated notifications.
"""

import html
import logging
import time
from collections import defaultdict

import aiohttp

from config import TELEGRAM_BOT_TOKEN
from user_store import get_users_wanting_signal
import db

log = logging.getLogger("notification_router")

_SIGNAL_EMOJI = {
    "PUMP": "🚀",
    "DUMP": "📉",
    "WATCH": "👀",
}

_SIGNAL_COLOR = {
    "PUMP": 0x00FF88,
    "DUMP": 0xFF3355,
    "WATCH": 0xFFB800,
}

# ── Per-user, per-coin throttle ──────────────────────────
# key = "username:coin:signal_type" → last_sent_epoch
_USER_NOTIFY_LAST: dict[str, float] = defaultdict(float)

# Cooldown per signal type (seconds)
_COOLDOWN = {
    "PUMP": 300,    # 5 minutes
    "DUMP": 300,    # 5 minutes
    "WATCH": 600,   # 10 minutes
}


def _should_notify_user(username: str, coin: str, signal_type: str) -> bool:
    """Check per-user per-coin cooldown."""
    now = time.time()
    key = f"{username}:{coin}:{signal_type}"
    last = _USER_NOTIFY_LAST.get(key, 0)
    cooldown = _COOLDOWN.get(signal_type, 600)
    return now - last >= cooldown


def _mark_user_notified(username: str, coin: str, signal_type: str) -> None:
    """Record notification sent."""
    key = f"{username}:{coin}:{signal_type}"
    _USER_NOTIFY_LAST[key] = time.time()


async def route_to_users(signal: dict):
    """
    Route a signal to all users who want it.
    Respects per-user per-coin cooldowns.

    For each matching user:
        - If discord_webhook set → POST Discord embed
        - If telegram_id set → send Telegram message
    """
    signal_type = signal.get("signal", "WATCH")
    coin = signal.get("coin") or "?"
    users = get_users_wanting_signal(signal_type)

    if not users:
        return

    log.info("Routing %s signal for %s to %d potential users", signal_type, coin, len(users))

    for user in users:
        username = user.get("username", "unknown")

        # Check per-user cooldown
        if not _should_notify_user(username, coin, signal_type):
            log.debug("Throttled %s notification for user %s coin %s", signal_type, username, coin)
            continue

        sent = False

        # Discord delivery
        discord_webhook = user.get("discord_webhook", "").strip()
        if discord_webhook and discord_webhook.startswith("https://discord.com/api/webhooks/"):
            try:
                await _send_discord_embed(discord_webhook, signal)
                log.info("Discord delivered to %s", username)
                sent = True
            except Exception as exc:
                log.error("Discord delivery failed for %s: %s", username, exc)

        # Telegram delivery
        telegram_id = user.get("telegram_id", "").strip()
        if telegram_id and TELEGRAM_BOT_TOKEN:
            try:
                await _send_telegram_message(telegram_id, signal)
                log.info("Telegram delivered to %s", username)
                sent = True
            except Exception as exc:
                log.error("Telegram delivery failed for %s: %s", username, exc)

        if sent:
            _mark_user_notified(username, coin, signal_type)
            # Log to DB for audit
            try:
                channel = "discord+telegram" if discord_webhook and telegram_id else "discord" if discord_webhook else "telegram"
                db.log_notification(coin, signal_type, channel, username)
            except Exception:
                pass


async def _send_discord_embed(webhook_url: str, signal: dict):
    """Send a Discord embed to a user's webhook."""
    signal_type = signal.get("signal", "WATCH")
    emoji = _SIGNAL_EMOJI.get(signal_type, "👀")
    color = _SIGNAL_COLOR.get(signal_type, 0xFFB800)

    score = signal.get("score", 0)
    influence = signal.get("influencer_weight", 0)

    embed = {
        "title": f"{emoji} {signal_type} SIGNAL — ${signal.get('coin', '?')}",
        "color": color,
        "fields": [
            {"name": "Coin", "value": f"${signal.get('coin', '?')}", "inline": True},
            {"name": "Score", "value": str(round(score)), "inline": True},
            {"name": "Signal", "value": signal_type, "inline": True},
            {"name": "Sentiment", "value": signal.get("sentiment", "N/A"), "inline": True},
            {"name": "Velocity", "value": f"{signal.get('velocity_pct', 0):+d}%", "inline": True},
            {"name": "Bot Risk", "value": f"{signal.get('bot_risk', 0):.0%}", "inline": True},
            {"name": "Explanation", "value": signal.get("explanation", "N/A"), "inline": False},
        ],
        "footer": {"text": f"Aegis-Link · {signal.get('ts', '')}"},
    }

    payload = {"embeds": [embed]}

    async with aiohttp.ClientSession() as session:
        async with session.post(
            webhook_url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status not in (200, 204):
                body = await resp.text()
                log.warning("Discord webhook returned %d: %s", resp.status, body[:200])


async def _send_telegram_message(chat_id: str, signal: dict):
    """Send a Telegram message to a user's chat (HTML)."""
    signal_type = signal.get("signal", "WATCH")
    emoji = _SIGNAL_EMOJI.get(signal_type, "👀")
    coin = html.escape(str(signal.get("coin", "?")))
    sent = html.escape(str(signal.get("sentiment", "N/A")))
    src = html.escape(str(signal.get("top_source", "N/A")))
    expl = html.escape(str(signal.get("explanation", "")))

    score = signal.get("score", 0)
    influence = signal.get("influencer_weight", 0)

    text = (
        f"{emoji} <b>{html.escape(str(signal_type))} SIGNAL</b> — ${coin}\n\n"
        f"📊 Score: <code>{round(score)}</code>\n"
        f"💬 Sentiment: <code>{sent}</code>\n"
        f"⚡ Velocity: <code>{int(signal.get('velocity_pct', 0) or 0):+d}%</code>\n"
        f"🤖 Bot Risk: <code>{float(signal.get('bot_risk', 0) or 0):.0%}</code>\n"
        f"📡 Source: <code>{src}</code>\n"
        f"👤 Influence: <code>{round(float(influence))}%</code>\n\n"
        f"<i>{expl}</i>"
    )

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            url,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status != 200:
                body = await resp.text()
                log.warning("Telegram API returned %d: %s", resp.status, body[:200])
