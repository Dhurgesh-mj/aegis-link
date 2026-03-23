# backend/config.py
"""
Aegis-Link — Central Configuration
All secrets and constants. Edit values here before deployment.
NO TWITTER — replaced with 4chan /biz/, StockTwits, CryptoPanic.
"""

import os
from datetime import timezone

from dotenv import load_dotenv

# Load backend/.env when running api, predictor, or collectors locally
load_dotenv()


def _env_int(key: str, default: int = 0) -> int:
    raw = os.getenv(key)
    if raw is None or not str(raw).strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


# ── Reddit API ─────────────────────────────────────────────
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT", "aegis-link/1.0 by u/aegis-bot")

# ── Telegram API (data collection via Telethon) ──────────
TELEGRAM_API_ID = _env_int("TELEGRAM_API_ID", 0)
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "")
TELEGRAM_CHANNELS = [
    "CryptoMoonShots",
    "satoshistreetbets",
    "WallStreetBets",
    "CryptoPumpSignals",
]

# ── Discord Webhook (global broadcast) ───────────────────
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

# ── Telegram Bot (global broadcast) ─────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# ── CryptoPanic (free API) ──────────────────────────────
CRYPTOPANIC_TOKEN = os.getenv("CRYPTOPANIC_TOKEN", "")

# ── Ollama LLM ────────────────────────────────────────────
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = "llama3.2"
# Set OLLAMA_ENABLED=false to skip the API (uses keyword fallback in sentiment.py)
OLLAMA_ENABLED = os.getenv("OLLAMA_ENABLED", "true").strip().lower() not in (
    "0", "false", "no", "off",
)

# ── Database (SQLite) ─────────────────────────────────────
AEGIS_DB_PATH = os.getenv("AEGIS_DB_PATH", "")

# ── Redis (pub/sub only — NOT for persistent storage) ─────
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = _env_int("REDIS_PORT", 6379)
REDIS_SIGNAL_CHANNEL = "aegis:signals"

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "change-this-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7

# ── External API Bases ──────────────────────────────────
COINGECKO_BASE = "https://api.coingecko.com/api/v3"
STOCKTWITS_BASE = "https://api.stocktwits.com/api/2"
CRYPTOPANIC_BASE = "https://cryptopanic.com/api/v1"
FOURCHAN_BASE = "https://a.4cdn.org/biz"

# ── Scoring Weights ──────────────────────────────────────
W_VELOCITY = 0.30
W_SENTIMENT = 0.25
W_INFLUENCE = 0.25
W_VOLUME = 0.20
BOT_PENALTY = 0.40

# ── Signal Thresholds ────────────────────────────────────
PUMP_THRESHOLD = 72
DUMP_THRESHOLD = 28

# ── Poll Intervals (seconds) ────────────────────────────
# Lower POLL_INTERVAL for snappier UI (mind CoinGecko / source rate limits).
POLL_INTERVAL = max(10, _env_int("POLL_INTERVAL", 30))
FOURCHAN_INTERVAL = max(30, _env_int("FOURCHAN_INTERVAL", 120))

# Predictor needs this many distinct time-bucketed events per coin before scoring
MIN_COIN_EVENTS_FOR_SIGNAL = max(1, _env_int("MIN_COIN_EVENTS_FOR_SIGNAL", 2))
# Rolling window for mention velocity (seconds)
EVENT_WINDOW_SEC = max(60, _env_int("EVENT_WINDOW_SEC", 600))

# ── Tracked Coins ────────────────────────────────────────
TRACKED_COINS = [
    "PEPE", "DOGE", "SHIB", "FLOKI", "BONK",
    "WIF", "MEME", "TURBO", "BRETT", "MOG",
    "WOJAK", "CHAD", "COPE", "NOOT", "SLERF",
]

# ── Subreddits ───────────────────────────────────────────
SUBREDDITS = [
    "CryptoMoonShots",
    "SatoshiStreetBets",
    "memecoinmoonshots",
    "CryptoCurrency",
    "WallStreetBets",
    "shitcoinmoonshots",
]

# ── Misc ─────────────────────────────────────────────────
DEDUP_BINARY = "./dedup_filter"
MAX_TEXT_LENGTH = 500
EVENT_QUEUE_MAXSIZE = 10000
LOG_DIR = "logs"

# ── CoinGecko coin id mapping ───────────────────────────
COINGECKO_IDS = {
    "PEPE": "pepe",
    "DOGE": "dogecoin",
    "SHIB": "shiba-inu",
    "FLOKI": "floki",
    "BONK": "bonk",
    "WIF": "dogwifcoin",
    "BRETT": "brett",
    "MOG": "mog-coin",
    "TURBO": "turbo",
    "MEME": "memecoin-2",
    "WOJAK": "wojak",
    "CHAD": "chad-index",
    "COPE": "cope",
    "NOOT": "pingu",
    "SLERF": "slerf",
}

# ── Timezone ─────────────────────────────────────────────
UTC = timezone.utc
