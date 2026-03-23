# backend/collector.py
"""
Aegis-Link — Multi-Source Data Collector
Six concurrent asyncio tasks: Reddit, CoinGecko, 4chan /biz/,
StockTwits, CryptoPanic, Telegram.
NO TWITTER anywhere.
All raw events piped through the C++ dedup_filter subprocess.
Cleaned events pushed to an asyncio.Queue for the predictor.
"""

import asyncio
import json
import logging
import os
import re
import subprocess
import uuid
from datetime import datetime, timezone

import aiohttp

try:
    import praw
except ImportError:
    praw = None

try:
    from telethon import TelegramClient, events as tg_events
except ImportError:
    TelegramClient = None

from config import (
    REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT,
    TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_CHANNELS,
    COINGECKO_BASE, COINGECKO_IDS, TRACKED_COINS, SUBREDDITS,
    FOURCHAN_BASE, STOCKTWITS_BASE, CRYPTOPANIC_BASE, CRYPTOPANIC_TOKEN,
    POLL_INTERVAL, FOURCHAN_INTERVAL,
    DEDUP_BINARY, MAX_TEXT_LENGTH,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("collector")

# Log Reddit 401 remediation once (otherwise one line per subreddit).
_reddit_401_hint_logged = False

# Shared asyncio Queue — predictor.py imports this
event_queue: asyncio.Queue = asyncio.Queue(maxsize=10000)

# ── Coin mention regex ──────────────────────────────────
_coin_pattern = re.compile(
    r"(?<!\w)\$?(" + "|".join(re.escape(c) for c in TRACKED_COINS) + r")(?!\w)",
    re.IGNORECASE,
)


def _detect_coins(text: str) -> list[str]:
    """Return list of uppercase tracked coin tickers found in text."""
    return list({m.group(1).upper() for m in _coin_pattern.finditer(text)})


def _make_event(
    source: str,
    author: str,
    followers: int,
    text: str,
    coins: list[str],
    url: str = "",
) -> dict:
    """Build a raw event dict matching the canonical schema."""
    return {
        "id": uuid.uuid4().hex[:16],
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "author": author,
        "followers": max(followers, 0),
        "text": text[:MAX_TEXT_LENGTH],
        "coins": coins,
        "url": url,
    }


# ── Dedup subprocess manager ────────────────────────────

class DedupPipe:
    """Manages the C++ dedup_filter as a long-running subprocess."""

    def __init__(self):
        self.proc: subprocess.Popen | None = None

    def start(self):
        binary = DEDUP_BINARY
        if not os.path.isfile(binary):
            log.warning("dedup_filter binary not found at %s — dedup disabled", binary)
            self.proc = None
            return
        try:
            self.proc = subprocess.Popen(
                [binary],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )
            log.info("dedup_filter subprocess started (pid %d)", self.proc.pid)
        except Exception as exc:
            log.error("Failed to start dedup_filter: %s", exc)
            self.proc = None

    async def filter_event(self, event: dict) -> dict | None:
        """Send event JSON through dedup filter; returns cleaned dict or None if dropped."""
        if self.proc is None or self.proc.poll() is not None:
            return event  # passthrough if binary unavailable

        loop = asyncio.get_running_loop()
        try:
            line = json.dumps(event, separators=(",", ":")) + "\n"
            await loop.run_in_executor(None, self.proc.stdin.write, line)
            await loop.run_in_executor(None, self.proc.stdin.flush)
            result_line = await loop.run_in_executor(None, self.proc.stdout.readline)
            if result_line.strip():
                return json.loads(result_line.strip())
            return None
        except Exception as exc:
            log.debug("dedup filter error: %s", exc)
            return event  # passthrough on error

    def stop(self):
        if self.proc and self.proc.poll() is None:
            self.proc.stdin.close()
            self.proc.terminate()
            log.info("dedup_filter stopped")


dedup = DedupPipe()


async def _enqueue(event: dict):
    """Filter through dedup, then push to the shared queue."""
    cleaned = await dedup.filter_event(event)
    if cleaned:
        try:
            event_queue.put_nowait(cleaned)
        except asyncio.QueueFull:
            log.warning("Event queue full — dropping event %s", cleaned.get("id", "?"))


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Reddit Collector
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def collect_reddit():
    """Poll Reddit subreddits for new + hot submissions and comments."""
    global _reddit_401_hint_logged
    if praw is None:
        log.warning("praw not installed — Reddit collector disabled")
        return
    if not REDDIT_CLIENT_ID:
        log.warning("REDDIT_CLIENT_ID not set — Reddit collector disabled")
        return
    if not (REDDIT_CLIENT_SECRET or "").strip():
        log.error(
            "REDDIT_CLIENT_SECRET is empty — Reddit OAuth will return 401. "
            "At https://www.reddit.com/prefs/apps create a 'script' app, then set "
            "REDDIT_CLIENT_ID (under the app name) and REDDIT_CLIENT_SECRET (the "
            "'secret' field — not your Reddit login password)."
        )
        return

    log.info("Reddit collector starting for subreddits: %s", SUBREDDITS)
    loop = asyncio.get_running_loop()

    try:
        reddit = praw.Reddit(
            client_id=REDDIT_CLIENT_ID,
            client_secret=REDDIT_CLIENT_SECRET,
            user_agent=REDDIT_USER_AGENT,
        )
    except Exception as exc:
        log.error("Failed to init Reddit client: %s", exc)
        return

    seen_ids: set[str] = set()

    while True:
        try:
            for sub_name in SUBREDDITS:
                try:
                    subreddit = await loop.run_in_executor(
                        None, reddit.subreddit, sub_name
                    )
                    new_posts = await loop.run_in_executor(
                        None, lambda: list(subreddit.new(limit=25))
                    )
                    hot_posts = await loop.run_in_executor(
                        None, lambda: list(subreddit.hot(limit=5))
                    )

                    for post in new_posts + hot_posts:
                        if post.id in seen_ids:
                            continue
                        seen_ids.add(post.id)

                        text = f"{post.title} {post.selftext or ''}"
                        coins = _detect_coins(text)
                        if not coins:
                            continue

                        evt = _make_event(
                            source=f"reddit/r/{sub_name}",
                            author=str(post.author) if post.author else "unknown",
                            followers=max(int(post.score), 0),
                            text=text,
                            coins=coins,
                            url=f"https://reddit.com{post.permalink}",
                        )
                        await _enqueue(evt)

                    # Comments on hot posts
                    for post in hot_posts[:5]:
                        try:
                            await loop.run_in_executor(
                                None, lambda p=post: p.comments.replace_more(limit=0)
                            )
                            comments = await loop.run_in_executor(
                                None, lambda p=post: list(p.comments.list()[:20])
                            )
                            for comment in comments:
                                cid = f"c_{comment.id}"
                                if cid in seen_ids:
                                    continue
                                seen_ids.add(cid)
                                coins = _detect_coins(comment.body)
                                if not coins:
                                    continue
                                evt = _make_event(
                                    source=f"reddit/r/{sub_name}",
                                    author=str(comment.author) if comment.author else "unknown",
                                    followers=max(int(comment.score), 0),
                                    text=comment.body,
                                    coins=coins,
                                    url=f"https://reddit.com{comment.permalink}",
                                )
                                await _enqueue(evt)
                        except Exception as exc:
                            log.debug("Reddit comment fetch error: %s", exc)

                except Exception as exc:
                    err = str(exc).lower()
                    if "401" in err and not _reddit_401_hint_logged:
                        _reddit_401_hint_logged = True
                        log.error(
                            "Reddit API 401 — credentials rejected. Fix backend/.env: "
                            "(1) REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET from "
                            "https://www.reddit.com/prefs/apps (type: script). "
                            "(2) Do not use your account password as the secret. "
                            "(3) REDDIT_USER_AGENT must be unique, e.g. "
                            "AegisLink/1.0 (by /u/YourRedditUsername)."
                        )
                    log.error("Reddit subreddit %s error: %s", sub_name, exc)

            if len(seen_ids) > 50000:
                seen_ids = set(list(seen_ids)[-25000:])

        except Exception as exc:
            log.error("Reddit collector loop error: %s", exc)

        await asyncio.sleep(POLL_INTERVAL)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. CoinGecko Collector
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def collect_coingecko():
    """Poll CoinGecko for market data: price_change_24h, volume events."""
    import db as _db
    log.info("CoinGecko collector starting for %d coins", len(COINGECKO_IDS))

    ids_param = ",".join(COINGECKO_IDS.values())
    url = (
        f"{COINGECKO_BASE}/coins/markets"
        f"?vs_currency=usd&ids={ids_param}"
        f"&order=market_cap_desc&per_page=100&page=1"
        f"&sparkline=false&price_change_percentage=24h"
    )
    id_to_ticker = {v: k for k, v in COINGECKO_IDS.items()}

    while True:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for coin in data:
                            ticker = id_to_ticker.get(coin.get("id", ""), "")
                            if not ticker:
                                continue

                            price_change = coin.get("price_change_percentage_24h", 0) or 0
                            volume = coin.get("total_volume", 0) or 0

                            text = (
                                f"{ticker} price {price_change:+.2f}% "
                                f"volume {volume:,.0f}"
                            )

                            evt = _make_event(
                                source="coingecko",
                                author="coingecko_api",
                                followers=int(volume / 1000),
                                text=text,
                                coins=[ticker],
                                url=f"https://www.coingecko.com/en/coins/{coin.get('id', '')}",
                            )
                            evt["price_change_24h"] = price_change
                            evt["volume_24h"] = volume
                            await _enqueue(evt)

                            # Store in SQLite for scorer
                            try:
                                _db.set_market_data(ticker, price_change, volume)
                            except Exception as exc:
                                log.debug("Market data persist error for %s: %s", ticker, exc)
                    else:
                        log.warning("CoinGecko API returned %d", resp.status)
        except Exception as exc:
            log.error("CoinGecko collector error: %s", exc)

        await asyncio.sleep(POLL_INTERVAL)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. 4chan /biz/ Collector
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NOTE: 4chan is early signal — PEPE and WOJAK originated here.
# All posters are anonymous = low follower influence by design.

async def collect_fourchan():
    """Poll 4chan /biz/ catalog for coin mentions."""
    log.info("4chan /biz/ collector starting (interval: %ds)", FOURCHAN_INTERVAL)
    catalog_url = f"{FOURCHAN_BASE}/catalog.json"
    seen_thread_ids: set[int] = set()

    while True:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    catalog_url,
                    timeout=aiohttp.ClientTimeout(total=30),
                    headers={"User-Agent": "aegis-link/1.0"},
                ) as resp:
                    if resp.status == 200:
                        pages = await resp.json()
                        for page in pages:
                            for thread in page.get("threads", []):
                                thread_no = thread.get("no", 0)
                                if thread_no in seen_thread_ids:
                                    continue
                                seen_thread_ids.add(thread_no)

                                # Combine subject + comment HTML
                                raw_text = (
                                    (thread.get("sub", "") or "")
                                    + " "
                                    + (thread.get("com", "") or "")
                                )
                                # Strip HTML tags
                                clean_text = re.sub(r"<[^>]+>", " ", raw_text)
                                clean_text = re.sub(r"&\w+;", " ", clean_text)

                                coins = _detect_coins(clean_text)
                                if not coins:
                                    continue

                                evt = _make_event(
                                    source="4chan/biz",
                                    author="anon",
                                    followers=1,  # anonymous, low influence
                                    text=clean_text,
                                    coins=coins,
                                    url=f"https://boards.4channel.org/biz/thread/{thread_no}",
                                )
                                await _enqueue(evt)
                    else:
                        log.warning("4chan catalog returned %d", resp.status)

            # Cap seen_thread_ids
            if len(seen_thread_ids) > 10000:
                seen_thread_ids = set(list(seen_thread_ids)[-5000:])

        except Exception as exc:
            log.error("4chan /biz/ collector error: %s", exc)

        await asyncio.sleep(FOURCHAN_INTERVAL)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. StockTwits Collector
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def collect_stocktwits():
    """Poll StockTwits streams per tracked coin."""
    log.info("StockTwits collector starting for %d coins", len(TRACKED_COINS))
    seen_msg_ids: set[int] = set()

    while True:
        try:
            async with aiohttp.ClientSession() as session:
                for coin in TRACKED_COINS:
                    try:
                        url = f"{STOCKTWITS_BASE}/streams/symbol/{coin}.json"
                        async with session.get(
                            url,
                            timeout=aiohttp.ClientTimeout(total=15),
                        ) as resp:
                            if resp.status == 404:
                                continue  # coin not listed on StockTwits
                            if resp.status != 200:
                                continue

                            data = await resp.json()
                            for msg in data.get("messages", []):
                                msg_id = msg.get("id", 0)
                                if msg_id in seen_msg_ids:
                                    continue
                                seen_msg_ids.add(msg_id)

                                body = msg.get("body", "")
                                coins = _detect_coins(body)
                                if not coins:
                                    coins = [coin]

                                user = msg.get("user", {})
                                followers = user.get("followers", 0) or 0

                                # StockTwits may include sentiment hint
                                sentiment_obj = msg.get("entities", {}).get("sentiment", {})
                                sentiment_hint = sentiment_obj.get("basic", "") if sentiment_obj else ""

                                evt = _make_event(
                                    source="stocktwits",
                                    author=user.get("username", "unknown"),
                                    followers=followers,
                                    text=body,
                                    coins=coins,
                                    url=f"https://stocktwits.com/symbol/{coin}",
                                )
                                if sentiment_hint:
                                    evt["sentiment_hint"] = sentiment_hint
                                await _enqueue(evt)

                        # Small delay between coins to avoid rate limits
                        await asyncio.sleep(1)

                    except Exception as exc:
                        log.debug("StockTwits error for %s: %s", coin, exc)

            # Cap seen_msg_ids
            if len(seen_msg_ids) > 50000:
                seen_msg_ids = set(list(seen_msg_ids)[-25000:])

        except Exception as exc:
            log.error("StockTwits collector error: %s", exc)

        await asyncio.sleep(90)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. CryptoPanic Collector
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def collect_cryptopanic():
    """Poll CryptoPanic news API for coin-related posts."""
    if not CRYPTOPANIC_TOKEN:
        log.warning("CRYPTOPANIC_TOKEN not set — CryptoPanic collector disabled")
        return

    log.info("CryptoPanic collector starting")
    seen_post_ids: set[int] = set()

    while True:
        try:
            async with aiohttp.ClientSession() as session:
                for coin in TRACKED_COINS:
                    try:
                        url = (
                            f"{CRYPTOPANIC_BASE}/posts/"
                            f"?auth_token={CRYPTOPANIC_TOKEN}"
                            f"&currencies={coin}&kind=news&public=true"
                        )
                        async with session.get(
                            url,
                            timeout=aiohttp.ClientTimeout(total=15),
                        ) as resp:
                            if resp.status != 200:
                                continue

                            data = await resp.json()
                            for post in data.get("results", []):
                                post_id = post.get("id", 0)
                                if post_id in seen_post_ids:
                                    continue
                                seen_post_ids.add(post_id)

                                title = post.get("title", "")
                                votes = post.get("votes", {})
                                positive = votes.get("positive", 0) or 0
                                negative = votes.get("negative", 0) or 0

                                evt = _make_event(
                                    source="cryptopanic",
                                    author="cryptopanic_news",
                                    followers=positive - negative,  # vote score as proxy
                                    text=title,
                                    coins=[coin],
                                    url=post.get("url", ""),
                                )
                                await _enqueue(evt)

                        await asyncio.sleep(0.5)

                    except Exception as exc:
                        log.debug("CryptoPanic error for %s: %s", coin, exc)

            if len(seen_post_ids) > 20000:
                seen_post_ids = set(list(seen_post_ids)[-10000:])

        except Exception as exc:
            log.error("CryptoPanic collector error: %s", exc)

        await asyncio.sleep(FOURCHAN_INTERVAL)  # same 120s interval


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. Telegram Collector
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def collect_telegram():
    """Monitor Telegram channels for coin mentions using Telethon."""
    if TelegramClient is None:
        log.warning("telethon not installed — Telegram collector disabled")
        return
    if not TELEGRAM_API_ID or not TELEGRAM_API_HASH:
        log.warning("Telegram API credentials not set — Telegram collector disabled")
        return

    log.info("Telegram collector starting for channels: %s", TELEGRAM_CHANNELS)
    client = TelegramClient("aegis_session", TELEGRAM_API_ID, TELEGRAM_API_HASH)

    @client.on(tg_events.NewMessage(chats=TELEGRAM_CHANNELS))
    async def handler(event):
        try:
            text = event.message.text or ""
            coins = _detect_coins(text)
            if not coins:
                return

            sender = await event.get_sender()
            author = "unknown"
            followers = 0
            if sender:
                if hasattr(sender, "username") and sender.username:
                    author = sender.username
                elif hasattr(sender, "title"):
                    author = sender.title
                if hasattr(sender, "participants_count"):
                    followers = sender.participants_count or 0

            channel_name = ""
            chat = await event.get_chat()
            if chat and hasattr(chat, "username") and chat.username:
                channel_name = chat.username

            evt = _make_event(
                source=f"telegram/{channel_name or 'channel'}",
                author=author,
                followers=followers,
                text=text,
                coins=coins,
                url="",
            )
            await _enqueue(evt)
        except Exception as exc:
            log.debug("Telegram message handler error: %s", exc)

    try:
        await client.start()
        log.info("Telegram client connected")
        await client.run_until_disconnected()
    except Exception as exc:
        log.error("Telegram client error: %s", exc)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Entry Point
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def run_collectors():
    """Launch all six collectors concurrently."""
    dedup.start()
    log.info("Starting all 6 collectors...")

    tasks = [
        asyncio.create_task(collect_reddit(), name="reddit"),
        asyncio.create_task(collect_coingecko(), name="coingecko"),
        asyncio.create_task(collect_fourchan(), name="4chan"),
        asyncio.create_task(collect_stocktwits(), name="stocktwits"),
        asyncio.create_task(collect_cryptopanic(), name="cryptopanic"),
        asyncio.create_task(collect_telegram(), name="telegram"),
    ]

    try:
        await asyncio.gather(*tasks, return_exceptions=True)
    except KeyboardInterrupt:
        log.info("Shutting down collectors...")
    finally:
        dedup.stop()
        for t in tasks:
            t.cancel()


if __name__ == "__main__":
    asyncio.run(run_collectors())
