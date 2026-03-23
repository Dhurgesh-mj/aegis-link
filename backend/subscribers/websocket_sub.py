# backend/subscribers/websocket_sub.py
"""
Aegis-Link — WebSocket Subscriber
Subscribes to Redis "aegis:signals" pub/sub channel (real-time only).
Persists signals to SQLite.
Broadcasts every new signal to ALL connected WebSocket clients.
"""

import asyncio
import json
import logging
from typing import Set

import redis

from config import REDIS_HOST, REDIS_PORT, REDIS_SIGNAL_CHANNEL
import db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [ws_sub] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("websocket_sub")

# Active WebSocket connections (managed by api.py)
active_connections: Set = set()

# Recent signals buffer (last 10 for new connections)
_recent_signals: list[dict] = []
_recent_lock = asyncio.Lock()
_MAX_RECENT = 10


async def add_connection(websocket):
    """Register a new WebSocket connection and send recent signals."""
    active_connections.add(websocket)
    log.info("WebSocket connected (total: %d)", len(active_connections))

    # Send last N signals immediately
    async with _recent_lock:
        for signal in _recent_signals:
            try:
                await websocket.send_text(json.dumps(signal))
            except Exception:
                break


async def remove_connection(websocket):
    """Unregister a WebSocket connection."""
    active_connections.discard(websocket)
    log.info("WebSocket disconnected (total: %d)", len(active_connections))


def _persist_signal(signal: dict) -> None:
    """Persist signal to SQLite (replaces Redis writes)."""
    try:
        db.upsert_signal(signal)
    except Exception as exc:
        log.error("Failed to persist signal to SQLite: %s", exc)


async def broadcast(signal: dict):
    """Broadcast a signal to all connected WebSocket clients."""
    # Always keep in-memory replay buffer (even with zero clients)
    async with _recent_lock:
        _recent_signals.append(signal)
        while len(_recent_signals) > _MAX_RECENT:
            _recent_signals.pop(0)

    if not active_connections:
        return

    message = json.dumps(signal)
    dead_connections = set()

    for ws in active_connections.copy():
        try:
            await ws.send_text(message)
        except Exception:
            dead_connections.add(ws)

    # Clean up dead connections
    for ws in dead_connections:
        active_connections.discard(ws)
        log.debug("Cleaned up dead WebSocket connection")


async def redis_listener():
    """
    Background task: subscribe to Redis pub/sub and broadcast to WebSockets.
    Redis is used ONLY as a real-time message bus here.
    Runs in the FastAPI event loop (started from api.py).
    """
    log.info("WebSocket Redis listener starting...")

    while True:
        try:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            pubsub = r.pubsub()
            pubsub.subscribe(REDIS_SIGNAL_CHANNEL)
            log.info("Subscribed to %s", REDIS_SIGNAL_CHANNEL)

            while True:
                message = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: pubsub.get_message(timeout=1.0)
                )

                if message and message["type"] == "message":
                    try:
                        signal = json.loads(message["data"])
                        # Persist to SQLite (non-blocking)
                        loop = asyncio.get_event_loop()
                        await loop.run_in_executor(
                            None, _persist_signal, signal
                        )
                        await broadcast(signal)
                    except json.JSONDecodeError as exc:
                        log.error("Invalid JSON from Redis: %s", exc)

                await asyncio.sleep(0.1)

        except Exception as exc:
            log.error("Redis listener error: %s — reconnecting in 5s", exc)
            await asyncio.sleep(5)
