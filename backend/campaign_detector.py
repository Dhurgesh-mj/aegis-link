# backend/campaign_detector.py
"""
Aegis-Link — Coordinated Campaign Detector
APT-style coordinated campaign fingerprinting.
Identifies manipulation campaigns using 5 methods:
  1. Temporal clustering (robotic posting intervals)
  2. Vocabulary fingerprinting (Jaccard similarity)
  3. Account creation cohort analysis
  4. Network amplification detection
  5. Source concentration burst detection
Stores detected campaigns in SQLite.
"""

import hashlib
import json
import logging
import statistics
from datetime import datetime, timezone

import db

log = logging.getLogger("campaign_detector")

STOPWORDS = {
    "the", "a", "an", "is", "in", "it", "to", "of", "and", "or",
    "i", "this", "that", "for", "on", "with", "at", "be", "was", "are",
}


class CampaignDetector:

    def analyze(self, events: list[dict], coin: str) -> dict:
        """Run all 5 campaign detection methods on a set of events for a coin."""
        if len(events) < 3:
            return {
                "campaign_detected": False,
                "campaign_id": None,
                "confidence": 0.0,
                "account_count": 0,
                "indicators": [],
                "threat_level": "LOW",
            }

        indicators = []
        confidence = 0.0

        # Unique authors
        unique_authors = set()
        for evt in events:
            author = evt.get("author", "")
            if author:
                unique_authors.add(author)

        # ── METHOD 1: Temporal clustering ──────────────────
        sorted_events = sorted(events, key=lambda e: e.get("ts", ""))
        gaps = []
        for i in range(1, len(sorted_events)):
            try:
                t1 = datetime.fromisoformat(sorted_events[i - 1].get("ts", "").replace("Z", "+00:00"))
                t2 = datetime.fromisoformat(sorted_events[i].get("ts", "").replace("Z", "+00:00"))
                gap = abs((t2 - t1).total_seconds())
                gaps.append(gap)
            except (ValueError, TypeError):
                continue

        if len(gaps) >= 3:
            mean_gap = statistics.mean(gaps)
            std_gap = statistics.stdev(gaps) if len(gaps) > 1 else 0
            cv = std_gap / max(mean_gap, 1)
            if cv < 0.20 and mean_gap < 120:
                indicators.append("robotic_posting_intervals")
                confidence += 0.30

        # ── METHOD 2: Vocabulary fingerprinting ────────────
        author_words: dict[str, set[str]] = {}
        for evt in events:
            author = evt.get("author", "")
            text = evt.get("text", "").lower()
            if not author or not text:
                continue
            words = [w for w in text.split() if w not in STOPWORDS and len(w) > 2]
            top_words = set(sorted(words, key=lambda w: -words.count(w))[:8])
            if author not in author_words:
                author_words[author] = top_words
            else:
                author_words[author] |= top_words

        authors_list = list(author_words.keys())
        if len(authors_list) >= 2:
            similarities = []
            for i in range(len(authors_list)):
                for j in range(i + 1, len(authors_list)):
                    a_words = author_words[authors_list[i]]
                    b_words = author_words[authors_list[j]]
                    if a_words or b_words:
                        union = a_words | b_words
                        intersection = a_words & b_words
                        jaccard = len(intersection) / max(len(union), 1)
                        similarities.append(jaccard)

            if similarities:
                mean_sim = statistics.mean(similarities)
                if mean_sim > 0.65 and len(unique_authors) >= 3:
                    indicators.append("shared_vocabulary_cluster")
                    confidence += 0.25

        # ── METHOD 3: Account creation cohort ──────────────
        creation_weeks: dict[str, int] = {}
        reddit_authors = 0
        for evt in events:
            created = evt.get("author_created")
            if created:
                reddit_authors += 1
                try:
                    dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                    week_key = dt.strftime("%Y-W%W")
                    creation_weeks[week_key] = creation_weeks.get(week_key, 0) + 1
                except (ValueError, TypeError):
                    continue

        if reddit_authors > 0 and creation_weeks:
            max_week_count = max(creation_weeks.values())
            if max_week_count / reddit_authors >= 0.40:
                indicators.append("creation_cohort")
                confidence += 0.25

        # ── METHOD 4: Network amplification ────────────────
        amplification_pairs = 0
        for i in range(len(sorted_events)):
            for j in range(i + 1, min(i + 20, len(sorted_events))):
                evt_a = sorted_events[i]
                evt_b = sorted_events[j]
                try:
                    t1 = datetime.fromisoformat(evt_a.get("ts", "").replace("Z", "+00:00"))
                    t2 = datetime.fromisoformat(evt_b.get("ts", "").replace("Z", "+00:00"))
                    time_diff = abs((t2 - t1).total_seconds())
                except (ValueError, TypeError):
                    continue

                if (
                    time_diff < 60
                    and evt_a.get("author", "") != evt_b.get("author", "")
                    and evt_a.get("followers", 0) < 100
                    and evt_b.get("followers", 0) < 100
                ):
                    amplification_pairs += 1

        if amplification_pairs >= 3:
            indicators.append("amplification_network")
            confidence += 0.20

        # ── METHOD 5: Source concentration ─────────────────
        source_counts: dict[str, int] = {}
        for evt in events:
            src = evt.get("source", "unknown")
            source_counts[src] = source_counts.get(src, 0) + 1

        total_events = len(events)
        if source_counts and total_events > 0:
            max_source_count = max(source_counts.values())
            top_source_pct = max_source_count / total_events

            # Check if all events within 15 minutes
            all_within_15min = False
            if len(sorted_events) >= 2:
                try:
                    first_ts = datetime.fromisoformat(sorted_events[0].get("ts", "").replace("Z", "+00:00"))
                    last_ts = datetime.fromisoformat(sorted_events[-1].get("ts", "").replace("Z", "+00:00"))
                    span = abs((last_ts - first_ts).total_seconds())
                    all_within_15min = span <= 900  # 15 minutes
                except (ValueError, TypeError):
                    pass

            if top_source_pct > 0.85 and all_within_15min:
                indicators.append("concentrated_source_burst")
                confidence += 0.15

        # ── Final determination ────────────────────────────
        campaign_detected = confidence >= 0.30 or len(indicators) >= 2

        threat_level = (
            "CRITICAL" if confidence >= 0.80 else
            "HIGH"     if confidence >= 0.55 else
            "MEDIUM"   if confidence >= 0.30 else
            "LOW"
        )

        campaign_id = None
        if campaign_detected:
            fingerprint = sorted(indicators)
            campaign_id = hashlib.sha256(
                (coin.upper() + str(fingerprint)).encode()
            ).hexdigest()[:8].upper()

            # Persist to SQLite
            try:
                conn = db._get_conn()
                conn.execute(
                    """INSERT INTO campaigns
                        (campaign_id, coin, confidence, account_count, indicators, threat_level, ts)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        campaign_id,
                        coin.upper(),
                        round(confidence, 3),
                        len(unique_authors),
                        json.dumps(indicators),
                        threat_level,
                        datetime.now(timezone.utc).isoformat(),
                    ),
                )
                conn.commit()
            except Exception as exc:
                log.error("Failed to persist campaign: %s", exc)

        return {
            "campaign_detected": campaign_detected,
            "campaign_id": campaign_id,
            "confidence": round(confidence, 3),
            "account_count": len(unique_authors),
            "indicators": indicators,
            "threat_level": threat_level,
        }

    def get_all_campaigns(self, limit: int = 50) -> list[dict]:
        """Get all detected campaigns, newest first."""
        conn = db._get_conn()
        rows = conn.execute(
            "SELECT * FROM campaigns ORDER BY ts DESC LIMIT ?",
            (limit,),
        ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d.pop("id", None)
            d["indicators"] = json.loads(d.get("indicators", "[]") or "[]")
            result.append(d)
        return result

    def get_coin_campaigns(self, coin: str) -> list[dict]:
        """Get campaigns for a specific coin."""
        conn = db._get_conn()
        rows = conn.execute(
            "SELECT * FROM campaigns WHERE coin = ? ORDER BY ts DESC LIMIT 20",
            (coin.upper(),),
        ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d.pop("id", None)
            d["indicators"] = json.loads(d.get("indicators", "[]") or "[]")
            result.append(d)
        return result
