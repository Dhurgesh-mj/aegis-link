# backend/subscribers/log_sub.py
"""
Aegis-Link — Log Subscriber
Subscribes to Redis "aegis:signals" channel.
Appends each signal to logs/signals_YYYY-MM-DD.jsonl
"""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import redis

from config import REDIS_HOST, REDIS_PORT, REDIS_SIGNAL_CHANNEL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [log_sub] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("log_sub")

LOG_DIR = Path(__file__).parent.parent / "logs"


def _ensure_log_dir():
    """Create logs directory if it doesn't exist."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def _get_log_path() -> Path:
    """Get today's log file path."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return LOG_DIR / f"signals_{today}.jsonl"


def main():
    """Subscribe to Redis and log signals to daily JSONL files."""
    _ensure_log_dir()
    log.info("Log subscriber starting... (log dir: %s)", LOG_DIR)

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    pubsub = r.pubsub()
    pubsub.subscribe(REDIS_SIGNAL_CHANNEL)
    log.info("Subscribed to %s", REDIS_SIGNAL_CHANNEL)

    for message in pubsub.listen():
        try:
            if message["type"] != "message":
                continue

            signal = json.loads(message["data"])
            log_path = _get_log_path()

            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(signal, separators=(",", ":")) + "\n")

            log.info(
                "Logged %s signal for %s to %s",
                signal.get("signal"), signal.get("coin"), log_path.name,
            )

        except json.JSONDecodeError as exc:
            log.error("Invalid JSON from Redis: %s", exc)
        except OSError as exc:
            log.error("File write error: %s", exc)
        except Exception as exc:
            log.error("Unexpected error: %s", exc)


if __name__ == "__main__":
    main()
