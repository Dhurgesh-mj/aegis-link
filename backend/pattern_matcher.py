# backend/pattern_matcher.py
"""
Aegis-Link — Historical Pattern Similarity Engine
Finds past pump events similar to current signal conditions.
Computes confidence intervals from similar patterns.
"""

import logging
from statistics import mean, median

log = logging.getLogger("pattern_matcher")

PRE_SEEDED_PATTERNS = [
    {
        "coin": "PEPE",
        "date": "2023-04-14",
        "event": "PEPE initial viral pump",
        "signal_score": 81.4,
        "z_score": 3.8,
        "bot_risk": 0.08,
        "velocity_pct": 340,
        "minutes_before_pump": 31,
        "price_1h_pct": 127.6,
        "price_24h_pct": 340.2,
        "source_mix": "reddit+telegram+4chan",
    },
    {
        "coin": "BONK",
        "date": "2023-12-22",
        "event": "BONK Solana ecosystem pump",
        "signal_score": 77.2,
        "z_score": 3.1,
        "bot_risk": 0.12,
        "velocity_pct": 218,
        "minutes_before_pump": 44,
        "price_1h_pct": 89.3,
        "price_24h_pct": 210.7,
        "source_mix": "reddit+telegram",
    },
    {
        "coin": "WIF",
        "date": "2024-01-31",
        "event": "WIF viral meme spread",
        "signal_score": 83.1,
        "z_score": 4.2,
        "bot_risk": 0.09,
        "velocity_pct": 290,
        "minutes_before_pump": 27,
        "price_1h_pct": 156.4,
        "price_24h_pct": 480.1,
        "source_mix": "telegram+reddit",
    },
    {
        "coin": "FLOKI",
        "date": "2023-06-12",
        "event": "FLOKI Elon tweet response",
        "signal_score": 74.8,
        "z_score": 2.9,
        "bot_risk": 0.18,
        "velocity_pct": 180,
        "minutes_before_pump": 52,
        "price_1h_pct": 67.2,
        "price_24h_pct": 145.8,
        "source_mix": "twitter+reddit",
    },
    {
        "coin": "SHIB",
        "date": "2023-10-02",
        "event": "SHIB Shibarium launch hype",
        "signal_score": 79.3,
        "z_score": 3.4,
        "bot_risk": 0.11,
        "velocity_pct": 260,
        "minutes_before_pump": 38,
        "price_1h_pct": 94.1,
        "price_24h_pct": 287.3,
        "source_mix": "reddit+telegram+stocktwits",
    },
    {
        "coin": "DOGE",
        "date": "2023-07-14",
        "event": "DOGE Twitter rebrand spike",
        "signal_score": 88.2,
        "z_score": 5.1,
        "bot_risk": 0.06,
        "velocity_pct": 520,
        "minutes_before_pump": 18,
        "price_1h_pct": 203.4,
        "price_24h_pct": 410.6,
        "source_mix": "reddit+telegram+4chan",
    },
    {
        "coin": "PEPE",
        "date": "2023-05-05",
        "event": "PEPE second wave pump",
        "signal_score": 76.1,
        "z_score": 3.2,
        "bot_risk": 0.14,
        "velocity_pct": 195,
        "minutes_before_pump": 41,
        "price_1h_pct": 82.3,
        "price_24h_pct": 198.7,
        "source_mix": "reddit+telegram",
    },
    {
        "coin": "WOJAK",
        "date": "2023-05-08",
        "event": "WOJAK sympathy pump",
        "signal_score": 71.4,
        "z_score": 2.7,
        "bot_risk": 0.22,
        "velocity_pct": 156,
        "minutes_before_pump": 67,
        "price_1h_pct": 54.8,
        "price_24h_pct": 123.4,
        "source_mix": "reddit+4chan",
    },
    {
        "coin": "TURBO",
        "date": "2023-05-12",
        "event": "TURBO GPT-4 creation story",
        "signal_score": 73.9,
        "z_score": 3.0,
        "bot_risk": 0.09,
        "velocity_pct": 210,
        "minutes_before_pump": 35,
        "price_1h_pct": 78.6,
        "price_24h_pct": 167.2,
        "source_mix": "reddit+telegram+cryptopanic",
    },
    {
        "coin": "BRETT",
        "date": "2024-03-15",
        "event": "BRETT Base chain pump",
        "signal_score": 80.7,
        "z_score": 3.6,
        "bot_risk": 0.10,
        "velocity_pct": 275,
        "minutes_before_pump": 29,
        "price_1h_pct": 118.3,
        "price_24h_pct": 312.5,
        "source_mix": "telegram+reddit",
    },
]


class PatternMatcher:

    def find_similar(
        self, score: float, z_score: float, bot_risk: float
    ) -> list[dict]:
        """Find historical patterns similar to current signal conditions."""
        matches = []
        for p in PRE_SEEDED_PATTERNS:
            if (
                abs(p["signal_score"] - score) <= 10
                and abs(p["z_score"] - z_score) <= 1.0
                and abs(p["bot_risk"] - bot_risk) <= 0.20
            ):
                matches.append(p)

        # Sort by score similarity ascending (closest first)
        matches.sort(key=lambda p: abs(p["signal_score"] - score))
        return matches[:5]

    def compute_confidence_interval(self, similar: list[dict]) -> dict:
        """Compute confidence intervals from similar historical patterns."""
        if len(similar) == 0:
            return {
                "min_1h": None,
                "max_1h": None,
                "median_1h": None,
                "min_24h": None,
                "max_24h": None,
                "median_24h": None,
                "sample_size": 0,
                "avg_lead_minutes": None,
                "patterns": [],
            }

        vals_1h = [p["price_1h_pct"] for p in similar]
        vals_24h = [p["price_24h_pct"] for p in similar]
        leads = [p["minutes_before_pump"] for p in similar]

        return {
            "min_1h": round(min(vals_1h), 1),
            "max_1h": round(max(vals_1h), 1),
            "median_1h": round(median(vals_1h), 1),
            "min_24h": round(min(vals_24h), 1),
            "max_24h": round(max(vals_24h), 1),
            "median_24h": round(median(vals_24h), 1),
            "sample_size": len(similar),
            "avg_lead_minutes": round(mean(leads), 0),
            "patterns": similar,
        }
