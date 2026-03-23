# backend/subscribers/api_sub.py
"""
Aegis-Link — API Subscriber (standalone optional process)

When uvicorn runs api.py, subscribers/websocket_sub.redis_listener already
persists to aegis:latest:* and aegis:history — you normally do NOT need this
script. Use it only if you run the predictor without the API.
"""

import json
import logging
from datetime import datetime, timezone

import redis

from config import REDIS_HOST, REDIS_PORT, REDIS_SIGNAL_CHANNEL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [api_sub] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("api_sub")


def main():
    """Subscribe to Redis and store latest signal per coin + history."""
    log.info("API subscriber starting...")

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    pubsub = r.pubsub()
    pubsub.subscribe(REDIS_SIGNAL_CHANNEL)
    log.info("Subscribed to %s", REDIS_SIGNAL_CHANNEL)

    for message in pubsub.listen():
        try:
            if message["type"] != "message":
                continue

            signal = json.loads(message["data"])
            coin = signal.get("coin", "").upper()

            if not coin:
                continue

            signal_json = json.dumps(signal)

            # 1. Write latest signal per coin
            key = f"aegis:latest:{coin}"
            r.set(key, signal_json)

            # 2. Maintain set of active coins
            r.sadd("aegis:active_coins", coin)

            # 3. Increment daily counter
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            r.incr(f"aegis:count:{today}")

            # 4. Push to history list (keep last 50)
            r.lpush("aegis:history", signal_json)
            r.ltrim("aegis:history", 0, 49)

            log.info(
                "Stored %s signal for %s (score=%.1f)",
                signal.get("signal"), coin, signal.get("score", 0),
            )

        except json.JSONDecodeError as exc:
            log.error("Invalid JSON from Redis: %s", exc)
        except redis.RedisError as exc:
            log.error("Redis write error: %s", exc)
        except Exception as exc:
            log.error("Unexpected error: %s", exc)


if __name__ == "__main__":
    main()
