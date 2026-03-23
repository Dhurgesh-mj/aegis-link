# backend/subscribers/discord_sub.py
"""
Aegis-Link — Discord Subscriber
Subscribes to Redis "aegis:signals" channel.
Sends rich embeds to the global Discord webhook.
Throttled: per-coin cooldown to prevent spam.
"""

import json
import logging
import time
from collections import defaultdict

import redis
import requests

from config import REDIS_HOST, REDIS_PORT, REDIS_SIGNAL_CHANNEL, DISCORD_WEBHOOK_URL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [discord_sub] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("discord_sub")

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

# ── Throttle settings ────────────────────────────────────
_COOLDOWN_PUMP = 300     # 5 min
_COOLDOWN_DUMP = 300     # 5 min
_COOLDOWN_WATCH = 600    # 10 min
_GLOBAL_RATE_LIMIT = 20  # max per minute

_last_sent: dict[str, float] = defaultdict(float)
_global_send_times: list[float] = []


def _should_send(coin: str, signal_type: str) -> bool:
    now = time.time()
    _global_send_times[:] = [t for t in _global_send_times if now - t < 60]
    if len(_global_send_times) >= _GLOBAL_RATE_LIMIT:
        return False

    key = f"{coin}:{signal_type}"
    last = _last_sent.get(key, 0)
    cooldown = _COOLDOWN_PUMP if signal_type == "PUMP" else _COOLDOWN_DUMP if signal_type == "DUMP" else _COOLDOWN_WATCH
    return now - last >= cooldown


def _mark_sent(coin: str, signal_type: str) -> None:
    now = time.time()
    _last_sent[f"{coin}:{signal_type}"] = now
    _global_send_times.append(now)


def _build_embed(signal: dict) -> dict:
    """Build a Discord embed for a signal."""
    signal_type = signal.get("signal", "WATCH")
    emoji = _SIGNAL_EMOJI.get(signal_type, "👀")
    color = _SIGNAL_COLOR.get(signal_type, 0xFFB800)

    score = signal.get("score", 0)
    influence = signal.get("influencer_weight", 0)

    return {
        "title": f"{emoji} {signal_type} SIGNAL — ${signal.get('coin', '?')}",
        "color": color,
        "fields": [
            {"name": "Coin", "value": f"${signal.get('coin', '?')}", "inline": True},
            {"name": "Score", "value": str(round(score)), "inline": True},
            {"name": "Signal", "value": signal_type, "inline": True},
            {"name": "Sentiment", "value": signal.get("sentiment", "N/A"), "inline": True},
            {"name": "Velocity", "value": f"{signal.get('velocity_pct', 0):+d}%", "inline": True},
            {"name": "Bot Risk", "value": f"{signal.get('bot_risk', 0):.0%}", "inline": True},
            {"name": "Influence", "value": f"{round(float(influence))}%", "inline": True},
            {"name": "Explanation", "value": signal.get("explanation", "N/A"), "inline": False},
        ],
        "footer": {"text": f"Aegis-Link Engine · {signal.get('ts', '')}"},
    }


def main():
    """Subscribe to Redis and forward signals to Discord (with throttling)."""
    if not DISCORD_WEBHOOK_URL:
        log.warning("DISCORD_WEBHOOK_URL not set — exiting")
        return

    log.info("Discord subscriber starting (with throttling)...")

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    pubsub = r.pubsub()
    pubsub.subscribe(REDIS_SIGNAL_CHANNEL)
    log.info("Subscribed to %s", REDIS_SIGNAL_CHANNEL)

    for message in pubsub.listen():
        try:
            if message["type"] != "message":
                continue

            signal = json.loads(message["data"])
            coin = signal.get("coin", "?")
            signal_type = signal.get("signal", "WATCH")

            if not _should_send(coin, signal_type):
                continue

            embed = _build_embed(signal)
            payload = {"embeds": [embed]}

            resp = requests.post(
                DISCORD_WEBHOOK_URL,
                json=payload,
                timeout=10,
            )

            if resp.status_code in (200, 204):
                _mark_sent(coin, signal_type)
                log.info(
                    "Sent %s signal for %s (score=%.1f)",
                    signal_type, coin, signal.get("score", 0),
                )
            elif resp.status_code == 429:
                retry_after = resp.json().get("retry_after", 5)
                log.warning("Rate limited — waiting %.1fs", retry_after)
                time.sleep(retry_after)
            else:
                log.warning("Discord returned %d: %s", resp.status_code, resp.text[:200])

        except json.JSONDecodeError as exc:
            log.error("Invalid JSON from Redis: %s", exc)
        except requests.RequestException as exc:
            log.error("Discord request error: %s", exc)
        except Exception as exc:
            log.error("Unexpected error: %s", exc)


if __name__ == "__main__":
    main()
