# backend/strategy_engine.py
"""
Aegis-Link — Strategy Recommendation Engine
Rule-based strategy recommendation derived from all signal fields.
No ML — pure decision logic with strict priority ordering.
Clear output: BUY / WAIT / AVOID / WATCH
"""

import logging

log = logging.getLogger("strategy_engine")


def recommend(
    signal: str,
    score: float,
    bot_risk: float,
    fomo_score: float,
    fomo_level: str,
    campaign_detected: bool,
    onchain_score: float,
    z_score: float,
    confidence_interval: dict,
    sentiment: str,
    sentiment_confidence: float,
) -> dict:
    """
    Evaluate rules in strict priority order and return strategy recommendation.
    Returns: {action, reason, confidence, risk, color}
    """
    try:
        # RULE 1 — Campaign detected → always AVOID
        if campaign_detected:
            return {
                "action": "AVOID",
                "reason": "Coordinated manipulation campaign detected",
                "confidence": "HIGH",
                "risk": "EXTREME",
                "color": "dump",
            }

        # RULE 2 — PUMP + organic + chain confirmed → BUY
        if (
            signal == "PUMP"
            and bot_risk < 0.25
            and onchain_score > 65
            and fomo_score > 65
            and sentiment == "BULLISH"
            and sentiment_confidence > 70
        ):
            median_24h = confidence_interval.get("median_24h", 0) or 0
            reason = (
                f"Organic hype confirmed on-chain. "
                f"Historical median: +{median_24h:.0f}% in 24h"
                if median_24h > 0
                else "Organic hype with on-chain confirmation"
            )
            return {
                "action": "BUY",
                "reason": reason,
                "confidence": "HIGH",
                "risk": "MEDIUM",
                "color": "pump",
            }

        # RULE 3 — PUMP + high bot risk → WAIT
        if signal == "PUMP" and bot_risk > 0.50:
            return {
                "action": "WAIT",
                "reason": "Elevated bot activity — signal may be artificial",
                "confidence": "MEDIUM",
                "risk": "HIGH",
                "color": "watch",
            }

        # RULE 4 — PUMP + anomaly spike but no chain → WAIT
        if signal == "PUMP" and z_score > 3.0 and onchain_score < 40:
            return {
                "action": "WAIT",
                "reason": "Social spike unconfirmed on-chain",
                "confidence": "MEDIUM",
                "risk": "HIGH",
                "color": "watch",
            }

        # RULE 5 — EXTREME FOMO + low bot → BUY
        if fomo_level == "EXTREME" and bot_risk < 0.30 and signal != "DUMP":
            return {
                "action": "BUY",
                "reason": "Extreme organic FOMO detected",
                "confidence": "MEDIUM",
                "risk": "MEDIUM",
                "color": "pump",
            }

        # RULE 6 — DUMP signal → AVOID
        if signal == "DUMP":
            return {
                "action": "AVOID",
                "reason": "Bearish signal with negative momentum",
                "confidence": "HIGH",
                "risk": "HIGH",
                "color": "dump",
            }

        # RULE 7 — Weak signal → WATCH
        return {
            "action": "WATCH",
            "reason": "Insufficient signal strength to act",
            "confidence": "LOW",
            "risk": "UNKNOWN",
            "color": "watch",
        }

    except Exception as exc:
        log.error("Strategy recommendation error: %s", exc)
        return {
            "action": "WATCH",
            "reason": "Strategy engine error — defaulting to WATCH",
            "confidence": "LOW",
            "risk": "UNKNOWN",
            "color": "watch",
        }
