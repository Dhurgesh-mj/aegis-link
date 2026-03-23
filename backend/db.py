# backend/db.py
"""
Aegis-Link — SQLite Database Module
Replaces Redis for all persistent storage.
Thread-safe, WAL mode for concurrent readers.
"""

import json
import logging
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

log = logging.getLogger("db")

DB_DIR = Path(__file__).parent / "data"
DB_PATH = os.getenv("AEGIS_DB_PATH", str(DB_DIR / "aegis.db"))

_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    """Get a thread-local SQLite connection."""
    if not hasattr(_local, "conn") or _local.conn is None:
        DB_DIR.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=15)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        _local.conn = conn
    return _local.conn


def init_db() -> None:
    """Create all tables if they don't exist."""
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            username       TEXT PRIMARY KEY,
            password_hash  TEXT NOT NULL,
            discord_webhook TEXT DEFAULT '',
            telegram_id    TEXT DEFAULT '',
            notify_pump    INTEGER DEFAULT 1,
            notify_dump    INTEGER DEFAULT 0,
            notify_watch   INTEGER DEFAULT 0,
            created_at     TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS signals (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            coin        TEXT NOT NULL,
            score       REAL DEFAULT 0,
            signal      TEXT DEFAULT 'WATCH',
            confidence  INTEGER DEFAULT 0,
            sentiment   TEXT DEFAULT 'NEUTRAL',
            velocity_pct INTEGER DEFAULT 0,
            volume_spike REAL DEFAULT 0,
            bot_risk    REAL DEFAULT 0,
            bot_flags   TEXT DEFAULT '[]',
            top_source  TEXT DEFAULT '',
            influencer_weight REAL DEFAULT 0,
            explanation TEXT DEFAULT '',
            event_count INTEGER DEFAULT 0,
            ts          TEXT NOT NULL,
            stale       INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_signals_coin ON signals(coin);
        CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(ts DESC);
        CREATE INDEX IF NOT EXISTS idx_signals_coin_ts ON signals(coin, ts DESC);

        CREATE TABLE IF NOT EXISTS chart_points (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            coin    TEXT NOT NULL,
            ts      TEXT NOT NULL,
            score   REAL DEFAULT 0,
            signal  TEXT DEFAULT 'WATCH',
            sentiment TEXT DEFAULT 'NEUTRAL',
            velocity_pct INTEGER DEFAULT 0,
            bot_risk REAL DEFAULT 0,
            volume_spike REAL DEFAULT 0,
            event_count INTEGER DEFAULT 0,
            unix_ts INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chart_coin ON chart_points(coin);
        CREATE INDEX IF NOT EXISTS idx_chart_coin_unix ON chart_points(coin, unix_ts DESC);

        CREATE TABLE IF NOT EXISTS daily_counts (
            date_key TEXT PRIMARY KEY,
            count    INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS active_coins (
            coin TEXT PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS market_data (
            coin             TEXT PRIMARY KEY,
            price_change_24h REAL DEFAULT 0,
            volume_24h       REAL DEFAULT 0,
            updated_at       TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS notification_log (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            coin      TEXT NOT NULL,
            signal    TEXT NOT NULL,
            channel   TEXT NOT NULL,
            target    TEXT DEFAULT '',
            sent_at   TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_notif_coin ON notification_log(coin, sent_at DESC);

        CREATE TABLE IF NOT EXISTS baselines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            coin TEXT NOT NULL,
            mention_count INTEGER NOT NULL,
            ts TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_baselines_coin ON baselines(coin, ts DESC);

        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id TEXT NOT NULL,
            coin TEXT NOT NULL,
            confidence REAL NOT NULL,
            account_count INTEGER NOT NULL,
            indicators TEXT NOT NULL,
            threat_level TEXT NOT NULL,
            ts TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_campaigns_coin ON campaigns(coin, ts DESC);

        CREATE TABLE IF NOT EXISTS onchain_cache (
            coin TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        );
    """)
    conn.commit()
    log.info("Database initialized at %s", DB_PATH)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# USER OPERATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def user_exists(username: str) -> bool:
    conn = _get_conn()
    row = conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone()
    return row is not None


def create_user(username: str, password_hash: str) -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
        (username, password_hash, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()


def get_user(username: str) -> Optional[dict]:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["notify_pump"] = "true" if d.get("notify_pump") else "false"
    d["notify_dump"] = "true" if d.get("notify_dump") else "false"
    d["notify_watch"] = "true" if d.get("notify_watch") else "false"
    return d


def get_user_password_hash(username: str) -> Optional[str]:
    conn = _get_conn()
    row = conn.execute("SELECT password_hash FROM users WHERE username = ?", (username,)).fetchone()
    return row["password_hash"] if row else None


def update_user_notifications(
    username: str,
    discord_webhook: str = "",
    telegram_id: str = "",
    notify_pump: bool = True,
    notify_dump: bool = False,
    notify_watch: bool = False,
) -> bool:
    conn = _get_conn()
    cur = conn.execute(
        """UPDATE users SET
            discord_webhook = ?,
            telegram_id = ?,
            notify_pump = ?,
            notify_dump = ?,
            notify_watch = ?
        WHERE username = ?""",
        (discord_webhook, telegram_id, int(notify_pump), int(notify_dump), int(notify_watch), username),
    )
    conn.commit()
    return cur.rowcount > 0


def get_all_users() -> list[dict]:
    conn = _get_conn()
    rows = conn.execute("SELECT * FROM users").fetchall()
    users = []
    for row in rows:
        d = dict(row)
        d.pop("password_hash", None)
        d["notify_pump"] = "true" if d.get("notify_pump") else "false"
        d["notify_dump"] = "true" if d.get("notify_dump") else "false"
        d["notify_watch"] = "true" if d.get("notify_watch") else "false"
        users.append(d)
    return users


def get_users_wanting_signal(signal_type: str) -> list[dict]:
    field_map = {"PUMP": "notify_pump", "DUMP": "notify_dump", "WATCH": "notify_watch"}
    field = field_map.get(signal_type.upper())
    if not field:
        return []
    conn = _get_conn()
    rows = conn.execute(f"SELECT * FROM users WHERE {field} = 1").fetchall()
    users = []
    for row in rows:
        d = dict(row)
        d.pop("password_hash", None)
        d["notify_pump"] = "true" if d.get("notify_pump") else "false"
        d["notify_dump"] = "true" if d.get("notify_dump") else "false"
        d["notify_watch"] = "true" if d.get("notify_watch") else "false"
        users.append(d)
    return users


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SIGNAL OPERATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _signal_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d.pop("id", None)
    d.pop("created_at", None)
    d["bot_flags"] = json.loads(d.get("bot_flags", "[]") or "[]")
    d["stale"] = bool(d.get("stale"))
    if d["stale"] is False:
        d.pop("stale", None)
    return d


def upsert_signal(signal: dict) -> None:
    """Insert or replace the latest signal for a coin."""
    conn = _get_conn()
    coin = (signal.get("coin") or "").upper()
    if not coin:
        return

    # Delete old latest for this coin, keep history via the signals table
    conn.execute("DELETE FROM signals WHERE coin = ? AND stale = 0", (coin,))
    conn.execute(
        """INSERT INTO signals
            (coin, score, signal, confidence, sentiment, velocity_pct,
             volume_spike, bot_risk, bot_flags, top_source,
             influencer_weight, explanation, event_count, ts, stale)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            coin,
            signal.get("score", 0),
            signal.get("signal", "WATCH"),
            signal.get("confidence", 0),
            signal.get("sentiment", "NEUTRAL"),
            signal.get("velocity_pct", 0),
            signal.get("volume_spike", 0),
            signal.get("bot_risk", 0),
            json.dumps(signal.get("bot_flags", [])),
            signal.get("top_source", ""),
            signal.get("influencer_weight", 0),
            signal.get("explanation", ""),
            signal.get("event_count", 0),
            signal.get("ts", datetime.now(timezone.utc).isoformat()),
            1 if signal.get("stale") else 0,
        ),
    )

    # Track active coins
    conn.execute("INSERT OR IGNORE INTO active_coins (coin) VALUES (?)", (coin,))

    # Increment daily count
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    conn.execute(
        """INSERT INTO daily_counts (date_key, count) VALUES (?, 1)
           ON CONFLICT(date_key) DO UPDATE SET count = count + 1""",
        (today,),
    )

    conn.commit()


def get_latest_signals() -> list[dict]:
    """Get latest signal per coin (equivalent to old /signals endpoint)."""
    conn = _get_conn()
    # Get the most recent signal per coin
    rows = conn.execute("""
        SELECT s.* FROM signals s
        INNER JOIN (
            SELECT coin, MAX(id) as max_id FROM signals GROUP BY coin
        ) latest ON s.id = latest.max_id
        ORDER BY s.score DESC, s.stale ASC, s.coin ASC
    """).fetchall()
    return [_signal_to_dict(r) for r in rows]


def get_signal_for_coin(coin: str) -> Optional[dict]:
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM signals WHERE coin = ? ORDER BY id DESC LIMIT 1",
        (coin.upper(),),
    ).fetchone()
    return _signal_to_dict(row) if row else None


def get_history(limit: int = 50) -> list[dict]:
    """Get last N signals across all coins, newest first."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM signals WHERE stale = 0 ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    return [_signal_to_dict(r) for r in rows]


def get_signals_today_count() -> int:
    conn = _get_conn()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    row = conn.execute("SELECT count FROM daily_counts WHERE date_key = ?", (today,)).fetchone()
    return row["count"] if row else 0


def get_active_coins() -> set[str]:
    conn = _get_conn()
    rows = conn.execute("SELECT coin FROM active_coins").fetchall()
    return {r["coin"] for r in rows}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CHART OPERATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAX_CHART_POINTS = 288


def _iso_to_unix(ts: Optional[str]) -> int:
    if not ts:
        return int(datetime.now(timezone.utc).timestamp())
    try:
        fixed = ts.replace("Z", "+00:00")
        return int(datetime.fromisoformat(fixed).timestamp())
    except Exception:
        return int(datetime.now(timezone.utc).timestamp())


def push_chart_snapshot(coin: str, signal: dict) -> None:
    coin = (coin or "").upper()
    if not coin:
        return

    ts = signal.get("ts") or datetime.now(timezone.utc).isoformat()
    unix_ts = _iso_to_unix(ts)

    conn = _get_conn()
    conn.execute(
        """INSERT INTO chart_points
            (coin, ts, score, signal, sentiment, velocity_pct,
             bot_risk, volume_spike, event_count, unix_ts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            coin,
            ts,
            signal.get("score", 0),
            signal.get("signal", "WATCH"),
            signal.get("sentiment", "NEUTRAL"),
            signal.get("velocity_pct", 0),
            signal.get("bot_risk", 0),
            signal.get("volume_spike", 0),
            signal.get("event_count", 0),
            unix_ts,
        ),
    )

    # Trim to MAX_CHART_POINTS per coin
    conn.execute(
        """DELETE FROM chart_points WHERE coin = ? AND id NOT IN (
            SELECT id FROM chart_points WHERE coin = ? ORDER BY unix_ts DESC LIMIT ?
        )""",
        (coin, coin, MAX_CHART_POINTS),
    )
    conn.commit()


def get_chart(coin: str, limit: int = 100) -> list[dict]:
    coin = (coin or "").upper()
    if not coin:
        return []
    limit = max(1, min(int(limit), MAX_CHART_POINTS))
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM chart_points WHERE coin = ? ORDER BY unix_ts DESC LIMIT ?",
        (coin, limit),
    ).fetchall()
    points = [
        {
            "ts": r["ts"],
            "score": r["score"],
            "signal": r["signal"],
            "sentiment": r["sentiment"],
            "velocity_pct": r["velocity_pct"],
            "bot_risk": r["bot_risk"],
            "volume_spike": r["volume_spike"],
            "event_count": r["event_count"],
        }
        for r in rows
    ]
    points.reverse()  # chronological order
    return points


def get_all_charts(limit: int = 50) -> dict[str, list[dict]]:
    limit = max(1, min(int(limit), MAX_CHART_POINTS))
    conn = _get_conn()
    coins = conn.execute("SELECT DISTINCT coin FROM chart_points").fetchall()
    out: dict[str, list[dict]] = {}
    for row in coins:
        c = row["coin"]
        pts = get_chart(c, limit)
        if pts:
            out[c] = pts
    return out


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MARKET DATA
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def set_market_data(coin: str, price_change_24h: float, volume_24h: float) -> None:
    conn = _get_conn()
    conn.execute(
        """INSERT INTO market_data (coin, price_change_24h, volume_24h, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(coin) DO UPDATE SET
               price_change_24h = excluded.price_change_24h,
               volume_24h = excluded.volume_24h,
               updated_at = excluded.updated_at""",
        (coin.upper(), price_change_24h, volume_24h, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()


def get_market_data(coin: str) -> Optional[dict]:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM market_data WHERE coin = ?", (coin.upper(),)).fetchone()
    return dict(row) if row else None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTIFICATION LOG (dedup / throttle)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def log_notification(coin: str, signal: str, channel: str, target: str = "") -> None:
    conn = _get_conn()
    conn.execute(
        "INSERT INTO notification_log (coin, signal, channel, target, sent_at) VALUES (?, ?, ?, ?, ?)",
        (coin.upper(), signal, channel, target, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()


def get_last_notification_time(coin: str, channel: str) -> Optional[str]:
    """Get the ISO timestamp of the last notification for this coin+channel."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT sent_at FROM notification_log WHERE coin = ? AND channel = ? ORDER BY id DESC LIMIT 1",
        (coin.upper(), channel),
    ).fetchone()
    return row["sent_at"] if row else None


# Initialize on import
init_db()
