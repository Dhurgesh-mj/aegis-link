# backend/onchain_fetcher.py
"""
Aegis-Link — On-Chain Data Fetcher
Fetches on-chain signals via DexScreener free API.
No API key required.
Caches results in SQLite to avoid hammering API.
"""

import json
import logging
from datetime import datetime, timezone

import aiohttp

import db

log = logging.getLogger("onchain_fetcher")

DEXSCREENER_BASE = "https://api.dexscreener.com/latest"


async def fetch_dexscreener(coin: str) -> dict:
    """Fetch on-chain data from DexScreener with SQLite caching (120s TTL)."""
    coin = coin.upper()
    conn = db._get_conn()

    # Check cache
    row = conn.execute(
        "SELECT data, cached_at FROM onchain_cache WHERE coin = ?",
        (coin,),
    ).fetchone()

    if row:
        try:
            cached_at = datetime.fromisoformat(row["cached_at"].replace("Z", "+00:00"))
            age = (datetime.now(timezone.utc) - cached_at).total_seconds()
            if age < 120:
                return json.loads(row["data"])
        except (ValueError, TypeError):
            pass

    # Fetch from DexScreener
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{DEXSCREENER_BASE}/dex/search?q={coin}"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    log.warning("DexScreener returned %d for %s", resp.status, coin)
                    return {}
                body = await resp.json()
    except Exception as exc:
        log.error("DexScreener fetch error for %s: %s", coin, exc)
        return {}

    pairs = body.get("pairs", [])
    if not pairs:
        return {}

    # Filter for matching base token symbol
    matching = [
        p for p in pairs
        if p.get("baseToken", {}).get("symbol", "").upper() == coin
    ]

    if not matching:
        return {}

    # Sort by liquidity descending, take first
    matching.sort(
        key=lambda p: float(p.get("liquidity", {}).get("usd", 0) or 0),
        reverse=True,
    )
    pair = matching[0]

    txns_buys = int(pair.get("txns", {}).get("h24", {}).get("buys", 0) or 0)
    txns_sells = int(pair.get("txns", {}).get("h24", {}).get("sells", 0) or 0)

    data = {
        "coin": coin,
        "liquidity_usd": float(pair.get("liquidity", {}).get("usd", 0) or 0),
        "volume_24h": float(pair.get("volume", {}).get("h24", 0) or 0),
        "price_change_5m": float(pair.get("priceChange", {}).get("m5", 0) or 0),
        "price_change_1h": float(pair.get("priceChange", {}).get("h1", 0) or 0),
        "price_change_6h": float(pair.get("priceChange", {}).get("h6", 0) or 0),
        "txns_buys_24h": txns_buys,
        "txns_sells_24h": txns_sells,
        "buy_sell_ratio": round(txns_buys / max(txns_sells, 1), 2),
        "dex": pair.get("dexId", "unknown"),
        "chain": pair.get("chainId", "unknown"),
        "ts": datetime.now(timezone.utc).isoformat(),
    }

    # Cache in SQLite
    try:
        conn.execute(
            """INSERT INTO onchain_cache (coin, data, cached_at) VALUES (?, ?, ?)
               ON CONFLICT(coin) DO UPDATE SET data = excluded.data, cached_at = excluded.cached_at""",
            (coin, json.dumps(data), datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    except Exception as exc:
        log.error("Failed to cache onchain data for %s: %s", coin, exc)

    return data


async def compute_onchain_score(coin: str) -> float:
    """Compute a 0-100 on-chain signal score from DexScreener data."""
    data = await fetch_dexscreener(coin)
    if not data:
        return 50.0  # neutral if no data

    score = 0.0

    buy_sell_ratio = data.get("buy_sell_ratio", 1.0)
    if buy_sell_ratio > 1.5:
        score += 30
    elif buy_sell_ratio > 1.2:
        score += 15

    volume_24h = data.get("volume_24h", 0)
    if volume_24h > 5_000_000:
        score += 25
    elif volume_24h > 1_000_000:
        score += 15

    price_change_1h = data.get("price_change_1h", 0)
    if price_change_1h > 10:
        score += 25
    elif price_change_1h > 5:
        score += 15

    liquidity_usd = data.get("liquidity_usd", 0)
    if liquidity_usd > 1_000_000:
        score += 20
    elif liquidity_usd > 500_000:
        score += 10

    return min(score, 100.0)
