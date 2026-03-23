# backend/telegram_chat_bot.py
"""
Long-poll Telegram Bot API so users can discover their chat_id.

When someone sends /start (or /help), reply with their chat ID and short
instructions to paste it into Aegis-Link → Profile → Telegram Chat ID.

Requires TELEGRAM_BOT_TOKEN in backend/.env (same token as notifications).

Run standalone:
  cd backend && .venv/bin/python telegram_chat_bot.py

Or use start-dev.sh (starts this automatically if the token is set).
"""

import asyncio
import logging
import sys
from typing import Any, Dict, Optional

import aiohttp

from config import TELEGRAM_BOT_TOKEN

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [tg-chat-bot] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("telegram_chat_bot")


def _api(token: str, method: str) -> str:
    return f"https://api.telegram.org/bot{token}/{method}"


async def send_message(
    session: aiohttp.ClientSession, token: str, chat_id: int, text: str
) -> None:
    url = _api(token, "sendMessage")
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as resp:
        if resp.status != 200:
            body = await resp.text()
            log.warning("sendMessage %d: %s", resp.status, body[:300])


def _reply_text(chat: Dict[str, Any], from_user: Optional[Dict[str, Any]]) -> str:
    chat_id = chat.get("id")
    ctype = chat.get("type", "private")
    uid = (from_user or {}).get("id", "—")

    if ctype == "private":
        return (
            "<b>Aegis-Link</b>\n\n"
            "Use this value in the web app:\n"
            "<b>Profile → Telegram Chat ID</b>\n\n"
            f"<b>Your chat ID:</b> <code>{chat_id}</code>\n\n"
            "Then enable PUMP / DUMP / WATCH and save. "
            "Run a test from the profile page if needed."
        )

    return (
        "<b>Aegis-Link</b>\n\n"
        f"This chat is a <b>{ctype}</b>.\n\n"
        f"<b>Chat ID</b> (for group alerts): <code>{chat_id}</code>\n"
        f"<b>Your user ID:</b> <code>{uid}</code>\n\n"
        "For personal DMs, open a private chat with the bot and send "
        "<code>/start</code> there — use that chat ID in your profile."
    )


async def poll_loop(token: str) -> None:
    offset: Optional[int] = None
    log.info("Long-polling getUpdates (send /start to your bot in Telegram)…")

    async with aiohttp.ClientSession() as session:
        while True:
            try:
                params: dict = {"timeout": 45, "allowed_updates": ["message"]}
                if offset is not None:
                    params["offset"] = offset

                url = _api(token, "getUpdates")
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=55),
                ) as resp:
                    data = await resp.json()

                if not data.get("ok"):
                    code = data.get("error_code")
                    if code == 401:
                        log.error(
                            "Telegram 401 Unauthorized — this bot token is invalid or was revoked. "
                            "In Telegram open @BotFather → /mybots → your bot → API Token → "
                            "Revoke the old token, copy the NEW token into backend/.env as "
                            "TELEGRAM_BOT_TOKEN=... (no quotes, no spaces, full string). "
                            "If you ever posted the token online, you must revoke it."
                        )
                        raise SystemExit(1)
                    log.warning("getUpdates not ok: %s", data)
                    await asyncio.sleep(3)
                    continue

                for update in data.get("result", []):
                    offset = update["update_id"] + 1
                    msg = update.get("message")
                    if not msg:
                        continue

                    text = (msg.get("text") or "").strip()
                    if not text:
                        continue

                    low = text.split()[0].lower() if text else ""
                    if not (low.startswith("/start") or low.startswith("/help")):
                        continue

                    chat = msg.get("chat") or {}
                    from_user = msg.get("from")
                    chat_id = chat.get("id")
                    if chat_id is None:
                        continue

                    await send_message(session, token, chat_id, _reply_text(chat, from_user))
                    log.info("Sent chat_id to chat %s", chat_id)

            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.error("Poll loop error: %s — retry in 3s", exc)
                await asyncio.sleep(3)


def main() -> None:
    token = (TELEGRAM_BOT_TOKEN or "").strip().strip('"').strip("'")
    if not token:
        log.info("TELEGRAM_BOT_TOKEN not set — chat-id bot not started.")
        sys.exit(0)
    if " " in token:
        log.error(
            "TELEGRAM_BOT_TOKEN contains spaces — copy only the token from @BotFather "
            "(format: digits:letters, one string)."
        )
        sys.exit(1)

    try:
        asyncio.run(poll_loop(token))
    except KeyboardInterrupt:
        log.info("Stopped.")


if __name__ == "__main__":
    main()
