# backend/api.py
"""
Aegis-Link — FastAPI Server
REST API + WebSocket endpoint for the frontend.
JWT authentication, CORS, signal queries, user management.
SQLite for persistent storage, Redis pub/sub only for real-time WS.
"""

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import redis
import requests as http_requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import (
    REDIS_HOST, REDIS_PORT, TRACKED_COINS,
    DISCORD_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
)
from auth import register as auth_register, login as auth_login, verify_token, get_user, AuthError
from user_store import update_user_notifications
import db
from subscribers.websocket_sub import (
    add_connection, remove_connection, redis_listener as ws_redis_listener,
)
from subscribers.operator_sub import (
    operator_connections, run_operator_subscribers,
)
from anomaly_detector import AnomalyDetector
from campaign_detector import CampaignDetector
from onchain_fetcher import fetch_dexscreener
from backtest_engine import BacktestEngine
from pattern_matcher import PatternMatcher, PRE_SEEDED_PATTERNS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [api] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("api")

_start_time = time.time()


# ── Lifespan ────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background tasks on startup."""
    log.info("Starting WebSocket Redis listener...")
    task = asyncio.create_task(ws_redis_listener())
    op_task = asyncio.create_task(run_operator_subscribers())
    yield
    task.cancel()
    op_task.cancel()
    log.info("API shutting down")


app = FastAPI(
    title="Aegis-Link API",
    description="Real-time meme coin threat intelligence engine",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic Models ─────────────────────────────────────

class AuthRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    username: str


class NotificationConfig(BaseModel):
    discord_webhook: str = ""
    telegram_id: str = ""
    notify_pump: bool = True
    notify_dump: bool = False
    notify_watch: bool = False


# ── JWT Dependency ──────────────────────────────────────

async def get_current_user(authorization: str = Header(default="")):
    """Extract and verify JWT token from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = authorization
    if token.startswith("Bearer "):
        token = token[7:]

    try:
        username = verify_token(token)
        return username
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


# ── Auth Routes ─────────────────────────────────────────

@app.post("/auth/register", response_model=AuthResponse)
async def route_register(body: AuthRequest):
    """Register a new user account."""
    try:
        token = auth_register(body.username, body.password)
        return AuthResponse(token=token, username=body.username)
    except AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/auth/login", response_model=AuthResponse)
async def route_login(body: AuthRequest):
    """Login with username and password."""
    try:
        token = auth_login(body.username, body.password)
        return AuthResponse(token=token, username=body.username)
    except AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


# ── User Routes ─────────────────────────────────────────

@app.get("/user/profile")
async def route_profile(username: str = Depends(get_current_user)):
    """Get the current user's profile."""
    user = get_user(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.put("/user/notifications")
async def route_update_notifications(
    body: NotificationConfig,
    username: str = Depends(get_current_user),
):
    """Update the current user's notification preferences."""
    success = update_user_notifications(
        username=username,
        discord_webhook=body.discord_webhook,
        telegram_id=body.telegram_id,
        notify_pump=body.notify_pump,
        notify_dump=body.notify_dump,
        notify_watch=body.notify_watch,
    )
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "updated"}


@app.post("/user/test-alert")
async def route_test_alert(username: str = Depends(get_current_user)):
    """Send a test signal to the user's configured webhook/telegram."""
    user = get_user(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    channels_sent: list[str] = []

    test_signal = {
        "coin": "PEPE",
        "score": 85.0,
        "signal": "PUMP",
        "confidence": 91,
        "sentiment": "BULLISH",
        "velocity_pct": 340,
        "volume_spike": 12.4,
        "bot_risk": 0.08,
        "bot_flags": [],
        "top_source": "test/aegis-link",
        "influencer_weight": 76.2,
        "explanation": "TEST SIGNAL — This is a test alert from Aegis-Link",
        "event_count": 1,
        "ts": datetime.now(timezone.utc).isoformat(),
    }

    # Discord webhook
    discord_url = user.get("discord_webhook", "")
    if discord_url and discord_url.startswith("https://discord.com/api/webhooks/"):
        try:
            embed = {
                "title": "🧪 TEST SIGNAL — AEGIS-LINK",
                "color": 0x00ff88,
                "fields": [
                    {"name": "Coin", "value": f"${test_signal['coin']}", "inline": True},
                    {"name": "Score", "value": f"{test_signal['score']}/100", "inline": True},
                    {"name": "Signal", "value": test_signal["signal"], "inline": True},
                ],
                "footer": {"text": "Aegis-Link · Test Alert"},
            }
            resp = http_requests.post(discord_url, json={"embeds": [embed]}, timeout=10)
            if resp.status_code in (200, 204):
                channels_sent.append("discord")
        except Exception as exc:
            log.error("Test alert Discord error: %s", exc)

    # Telegram
    telegram_id = user.get("telegram_id", "")
    if telegram_id and TELEGRAM_BOT_TOKEN:
        try:
            text = (
                "🧪 TEST SIGNAL — AEGIS-LINK\n"
                f"Coin: ${test_signal['coin']}\n"
                f"Score: {test_signal['score']}/100\n"
                f"Signal: {test_signal['signal']}\n"
                "This is a test alert."
            )
            resp = http_requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": telegram_id, "text": text, "parse_mode": "HTML"},
                timeout=10,
            )
            if resp.status_code == 200:
                channels_sent.append("telegram")
        except Exception as exc:
            log.error("Test alert Telegram error: %s", exc)

    return {"status": "sent", "channels": channels_sent}


# ── Signal Routes ───────────────────────────────────────

def _placeholder_signal(coin: str) -> dict:
    """Row when no analysis has persisted yet for this ticker."""
    return {
        "coin": coin,
        "score": 50.0,
        "signal": "WATCH",
        "confidence": 0,
        "sentiment": "NEUTRAL",
        "velocity_pct": 0,
        "volume_spike": 0.0,
        "bot_risk": 0.0,
        "bot_flags": [],
        "top_source": "—",
        "influencer_weight": 0.0,
        "explanation": (
            "No scored signal yet — not enough mentions in the rolling window, "
            "or collectors have not seen this ticker."
        ),
        "event_count": 0,
        "ts": datetime.now(timezone.utc).isoformat(),
        "stale": True,
    }


@app.get("/signals")
async def route_signals():
    """
    Latest signal per coin for the full tracked universe.
    Always includes every TRACKED_COINS entry (plus any extra tickers seen).
    """
    signals: list[dict] = []
    try:
        # Get stored signals from SQLite
        stored = db.get_latest_signals()
        stored_coins = {s["coin"].upper() for s in stored}

        # Get extra active coins
        active = db.get_active_coins()

        # Build ordered list of coins
        ordered: list[str] = []
        seen: set[str] = set()
        for c in TRACKED_COINS:
            u = c.upper()
            if u not in seen:
                ordered.append(u)
                seen.add(u)
        for c in sorted(active):
            if c not in seen:
                ordered.append(c)
                seen.add(c)

        # Build signals list
        stored_by_coin = {s["coin"].upper(): s for s in stored}
        for coin in ordered:
            if coin in stored_by_coin:
                signals.append(stored_by_coin[coin])
            else:
                signals.append(_placeholder_signal(coin))

    except Exception as exc:
        log.error("Error fetching signals: %s", exc)

    signals.sort(
        key=lambda s: (
            -float(s.get("score", 0) or 0),
            s.get("stale") is True,
            s.get("coin", ""),
        )
    )
    return signals


@app.get("/coin/{ticker}")
async def route_coin(ticker: str):
    """Get the latest signal for a specific coin."""
    ticker = ticker.upper()
    try:
        data = db.get_signal_for_coin(ticker)
        if not data:
            raise HTTPException(status_code=404, detail=f"No signal data for {ticker}")
        return data
    except HTTPException:
        raise
    except Exception as exc:
        log.error("Error fetching coin %s: %s", ticker, exc)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/history")
async def route_history():
    """Get last 50 signals from history."""
    try:
        return db.get_history(50)
    except Exception as exc:
        log.error("Error fetching history: %s", exc)
        return []


@app.get("/chart/{ticker}")
async def route_chart(ticker: str, limit: int = 100):
    """Get score/sentiment time-series chart points for one coin."""
    ticker = ticker.upper()
    limit = max(1, min(int(limit), 288))

    from chart_store import get_chart
    points = get_chart(ticker, limit)
    if not points:
        raise HTTPException(status_code=404, detail=f"No chart data yet for {ticker}")

    return {"coin": ticker, "points": points}


@app.get("/charts")
async def route_charts(limit: int = 50):
    """Get chart points for all coins that have chart data."""
    limit = max(1, min(int(limit), 288))
    from chart_store import get_all_charts
    return get_all_charts(limit)


# ── Health ──────────────────────────────────────────────

@app.get("/health")
async def route_health():
    """Health check endpoint."""
    uptime = time.time() - _start_time

    signals_today = 0
    try:
        signals_today = db.get_signals_today_count()
    except Exception:
        pass

    return {
        "status": "online",
        "uptime_seconds": round(uptime, 1),
        "uptime_human": f"{int(uptime // 3600)}h {int((uptime % 3600) // 60)}m",
        "signals_today": signals_today,
        "coins_tracked": len(TRACKED_COINS),
        "sources": ["reddit", "telegram", "coingecko", "4chan", "stocktwits", "cryptopanic"],
        "ts": datetime.now(timezone.utc).isoformat(),
    }


# ── WebSocket ───────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket stream endpoint.
    On connect: sends last 10 signals from history.
    Then streams new signals as they arrive via Redis pub/sub.
    """
    await websocket.accept()
    await add_connection(websocket)

    # Send last 10 from history on connect
    try:
        history = db.get_history(10)
        for item in history:
            try:
                await websocket.send_text(json.dumps(item))
            except Exception:
                break
    except Exception as exc:
        log.debug("Error sending history on WS connect: %s", exc)

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text(json.dumps({"type": "keepalive"}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.debug("WebSocket error: %s", exc)
    finally:
        await remove_connection(websocket)


# ── v2: Advanced Routes ─────────────────────────────────

@app.get("/backtest")
async def route_backtest(lookback_days: int = 90):
    """Run historical validation backtest."""
    engine = BacktestEngine()
    return engine.run(lookback_days)


@app.get("/backtest/timeline")
async def route_backtest_timeline():
    """Get all historical events sorted by date."""
    engine = BacktestEngine()
    return engine.get_timeline()


@app.get("/campaigns")
async def route_campaigns(limit: int = 50):
    """Get all detected campaigns."""
    detector = CampaignDetector()
    return detector.get_all_campaigns(limit)


@app.get("/campaigns/{coin}")
async def route_coin_campaigns(coin: str):
    """Get campaigns for a specific coin."""
    detector = CampaignDetector()
    return detector.get_coin_campaigns(coin.upper())


@app.get("/anomaly/{coin}")
async def route_anomaly_history(coin: str, n: int = 60):
    """Get z-score history for a coin."""
    detector = AnomalyDetector()
    history = detector.get_zscore_history(coin.upper(), n)
    return {"coin": coin.upper(), "history": history}


@app.get("/anomaly/{coin}/current")
async def route_anomaly_current(coin: str):
    """Get current anomaly state for a coin."""
    coin_upper = coin.upper()
    # Get current mention count from last signal
    count = 0
    try:
        signal = db.get_signal_for_coin(coin_upper)
        if signal:
            count = signal.get("event_count", 0)
    except Exception:
        pass
    detector = AnomalyDetector()
    return detector.is_anomaly(coin_upper, count)


@app.get("/onchain/{coin}")
async def route_onchain(coin: str):
    """Get on-chain data from DexScreener."""
    data = await fetch_dexscreener(coin.upper())
    if not data:
        raise HTTPException(status_code=404, detail=f"No on-chain data for {coin.upper()}")
    return data


@app.get("/patterns")
async def route_patterns():
    """Get all pre-seeded historical patterns."""
    return PRE_SEEDED_PATTERNS


# ── v2: Operator WebSocket ──────────────────────────────

@app.websocket("/ws/operator")
async def operator_websocket_endpoint(websocket: WebSocket):
    """
    Operator console WebSocket.
    Streams both raw events (aegis:raw) and processed signals (aegis:signals).
    """
    await websocket.accept()
    operator_connections.add(websocket)
    log.info("Operator WS connected (total: %d)", len(operator_connections))

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text(json.dumps({"type": "keepalive"}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        log.debug("Operator WS error: %s", exc)
    finally:
        operator_connections.discard(websocket)
        log.info("Operator WS disconnected (total: %d)", len(operator_connections))
