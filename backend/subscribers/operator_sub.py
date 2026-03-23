# backend/subscribers/operator_sub.py
"""
Aegis-Link — Operator Console Subscriber
Maintains operator WebSocket connections.
Broadcasts both raw events and processed signals to the operator console.
"""

import asyncio
import json
import logging

import redis

from config import REDIS_HOST, REDIS_PORT, REDIS_SIGNAL_CHANNEL

log = logging.getLogger("operator_sub")

# Active operator WebSocket connections
operator_connections: set = set()


async def broadcast_to_operators(message: str):
    """Broadcast a message string to all connected operator clients."""
    dead = set()
    for ws in operator_connections.copy():
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    operator_connections.difference_update(dead)


async def raw_event_broadcaster():
    """Subscribe to Redis 'aegis:raw' and broadcast raw events to operator clients."""
    log.info("Operator raw event broadcaster starting...")

    while True:
        try:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            pubsub = r.pubsub()
            pubsub.subscribe("aegis:raw")
            log.info("Operator subscribed to aegis:raw")

            while True:
                message = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: pubsub.get_message(timeout=1.0)
                )

                if message and message["type"] == "message":
                    try:
                        payload = json.dumps({
                            "type": "raw_event",
                            "data": json.loads(message["data"]),
                        })
                        await broadcast_to_operators(payload)
                    except json.JSONDecodeError:
                        pass

                await asyncio.sleep(0.1)

        except Exception as exc:
            log.error("Operator raw broadcaster error: %s — reconnecting in 5s", exc)
            await asyncio.sleep(5)


async def signal_broadcaster():
    """Subscribe to Redis 'aegis:signals' and broadcast signals to operator clients."""
    log.info("Operator signal broadcaster starting...")

    while True:
        try:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            pubsub = r.pubsub()
            pubsub.subscribe(REDIS_SIGNAL_CHANNEL)
            log.info("Operator subscribed to %s", REDIS_SIGNAL_CHANNEL)

            while True:
                message = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: pubsub.get_message(timeout=1.0)
                )

                if message and message["type"] == "message":
                    try:
                        payload = json.dumps({
                            "type": "signal",
                            "data": json.loads(message["data"]),
                        })
                        await broadcast_to_operators(payload)
                    except json.JSONDecodeError:
                        pass

                await asyncio.sleep(0.1)

        except Exception as exc:
            log.error("Operator signal broadcaster error: %s — reconnecting in 5s", exc)
            await asyncio.sleep(5)


async def run_operator_subscribers():
    """Run both raw and signal broadcasters concurrently."""
    await asyncio.gather(
        raw_event_broadcaster(),
        signal_broadcaster(),
    )
