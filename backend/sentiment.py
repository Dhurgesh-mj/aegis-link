# backend/sentiment.py
"""
Aegis-Link — Sentiment via Ollama when available; keyword heuristic otherwise.
"""

import asyncio
import errno
import json
import logging
import re

import aiohttp
from aiohttp.client_exceptions import ClientConnectorError

from config import OLLAMA_HOST, OLLAMA_MODEL, OLLAMA_ENABLED

log = logging.getLogger("sentiment")

_PROMPT_TEMPLATE = (
    "You are a crypto sentiment analyst. Classify this social media post. "
    "Return ONLY valid JSON, no explanation, no markdown: "
    '{"label":"BULLISH|BEARISH|NEUTRAL","confidence":0-100,'
    '"reason":"one sentence max"}\n'
    "Post: {text}"
)

_FALLBACK = {"label": "NEUTRAL", "confidence": 50, "reason": "parse error"}

# Log Ollama connection failure once per process (avoid spam every text)
_ollama_unreachable_logged = False

_BULL = re.compile(
    r"\b(moon|pump|bullish|lfg|wagmi|gem|buy|long|rocket|hodl|ath|gains)\b",
    re.I,
)
_BEAR = re.compile(
    r"\b(rug|dump|bearish|scam|sell|short|dead|rekt|crash|fud|ponzi)\b",
    re.I,
)


def _keyword_sentiment(text: str) -> dict:
    """Cheap sentiment when Ollama is off or unreachable."""
    t = text or ""
    b = len(_BULL.findall(t))
    s = len(_BEAR.findall(t))
    if b > s:
        return {
            "label": "BULLISH",
            "confidence": min(55 + b * 5, 85),
            "reason": "keyword heuristic (Ollama off)",
        }
    if s > b:
        return {
            "label": "BEARISH",
            "confidence": min(55 + s * 5, 85),
            "reason": "keyword heuristic (Ollama off)",
        }
    return {
        "label": "NEUTRAL",
        "confidence": 50,
        "reason": "keyword heuristic — no strong cues",
    }


def _is_unreachable(exc: BaseException) -> bool:
    if isinstance(exc, ClientConnectorError):
        return True
    if isinstance(exc, OSError) and exc.errno in (errno.ECONNREFUSED, errno.EHOSTUNREACH):
        return True
    msg = str(exc).lower()
    return "errno 61" in msg or "connection refused" in msg or "connect call failed" in msg


async def score_sentiment(text: str) -> dict:
    """
    Classify sentiment: Ollama if OLLAMA_ENABLED and reachable; else keyword heuristic.
    """
    if not OLLAMA_ENABLED:
        return _keyword_sentiment(text)

    global _ollama_unreachable_logged
    prompt = _PROMPT_TEMPLATE.replace("{text}", text[:500])

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 150,
        },
    }

    for attempt in range(3):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{OLLAMA_HOST}/api/generate",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as resp:
                    if resp.status != 200:
                        log.warning(
                            "Ollama returned status %d on attempt %d",
                            resp.status,
                            attempt + 1,
                        )
                        if attempt < 2:
                            await asyncio.sleep(1)
                            continue
                        return _keyword_sentiment(text)

                    data = await resp.json()
                    raw_response = data.get("response", "")

                    result = _parse_llm_response(raw_response)
                    if result:
                        return result

                    log.warning(
                        "Failed to parse LLM response on attempt %d: %s",
                        attempt + 1,
                        raw_response[:200],
                    )
                    if attempt < 2:
                        await asyncio.sleep(1)
                        continue
                    return _keyword_sentiment(text)

        except asyncio.TimeoutError:
            log.warning("Ollama timeout on attempt %d", attempt + 1)
            if attempt < 2:
                await asyncio.sleep(1)
                continue
            return _keyword_sentiment(text)

        except Exception as exc:
            if _is_unreachable(exc):
                if not _ollama_unreachable_logged:
                    _ollama_unreachable_logged = True
                    log.warning(
                        "Ollama not reachable at %s — using keyword sentiment. "
                        "Install/run: https://ollama.com  or set OLLAMA_ENABLED=false in .env",
                        OLLAMA_HOST,
                    )
                else:
                    log.debug("Ollama still unreachable: %s", exc)
                return _keyword_sentiment(text)

            log.error("Ollama request error on attempt %d: %s", attempt + 1, exc)
            if attempt < 2:
                await asyncio.sleep(1)
                continue
            return _keyword_sentiment(text)

    return _keyword_sentiment(text)


def _parse_llm_response(raw: str) -> dict | None:
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        text = "\n".join(lines).strip()

    try:
        result = json.loads(text)
        return _validate_result(result)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            result = json.loads(text[start : end + 1])
            return _validate_result(result)
        except json.JSONDecodeError:
            pass

    return None


def _validate_result(result: dict) -> dict | None:
    if not isinstance(result, dict):
        return None

    label = str(result.get("label", "")).upper().strip()
    if label not in ("BULLISH", "BEARISH", "NEUTRAL"):
        label = "NEUTRAL"

    confidence = result.get("confidence", 50)
    try:
        confidence = int(confidence)
    except (ValueError, TypeError):
        confidence = 50
    confidence = max(0, min(100, confidence))

    reason = str(result.get("reason", ""))[:200]
    if not reason:
        reason = "model classification"

    return {
        "label": label,
        "confidence": confidence,
        "reason": reason,
    }
