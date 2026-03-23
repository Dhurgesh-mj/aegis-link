// frontend/components/SignalCard.tsx
// Aegis-Link — Compact signal card (max ~100px) with skeleton state

"use client";

import { useEffect, useState } from "react";
import type { Signal } from "@/lib/api";
import { formatSentimentLabel } from "@/lib/formatSentiment";
import HypeScoreBar from "./HypeScoreBar";
import BotRiskBadge from "./BotRiskBadge";

interface SignalCardProps {
  signal: Signal;
  isNew?: boolean;
}

function isSkeletonSignal(s: Signal): boolean {
  return (
    s.stale === true ||
    s.score === 0 ||
    (s.event_count !== undefined && s.event_count < 3)
  );
}

export default function SignalCard({ signal, isNew = false }: SignalCardProps) {
  const [animate, setAnimate] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const signalColor =
    signal.signal === "PUMP"
      ? "var(--pump)"
      : signal.signal === "DUMP"
        ? "var(--dump)"
        : "var(--watch)";

  const isSkeleton = isSkeletonSignal(signal);
  const isHighBot = signal.bot_risk > 0.65;
  const ts = signal.ts ? signal.ts.split("T")[1]?.slice(0, 8) || signal.ts : "";

  // Filter explanation
  const showExplanation =
    signal.explanation &&
    signal.explanation.trim() !== "" &&
    !signal.explanation.toLowerCase().includes("not enough mentions") &&
    !signal.explanation.toLowerCase().includes("no scored signal yet");

  if (isSkeleton) {
    return (
      <div className="sc sc--skeleton">
        <div className="sk-row1">
          <span className="sk-coin">${signal.coin}</span>
          <span className="sk-collecting">COLLECTING DATA...</span>
        </div>
        <div className="sk-bar">
          <div className="skeleton-line sk-bar-line" />
        </div>
        <div className="sk-meta">
          <div className="skeleton-line sk-meta-1" />
          <div className="skeleton-line sk-meta-2" />
          <div className="skeleton-line sk-meta-3" />
        </div>

        <style jsx>{`
          .sc--skeleton {
            padding: 12px 16px;
            opacity: 0.6;
            border-left: 2px solid var(--border);
            border-bottom: 1px solid var(--border);
          }
          .sk-row1 {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
          }
          .sk-coin {
            font-family: var(--display);
            font-weight: 700;
            font-size: 18px;
            color: var(--text);
          }
          .sk-collecting {
            font-family: var(--mono);
            font-size: 9px;
            letter-spacing: 0.1em;
            color: var(--muted);
          }
          .sk-bar {
            margin-bottom: 8px;
          }
          .sk-bar-line {
            width: 100%;
            height: 2px;
          }
          .sk-meta {
            display: flex;
            gap: 12px;
          }
          .sk-meta-1 { width: 60px; }
          .sk-meta-2 { width: 50px; }
          .sk-meta-3 { width: 40px; }
          .skeleton-line {
            background: linear-gradient(
              90deg,
              var(--border) 25%,
              rgba(255,255,255,0.04) 50%,
              var(--border) 75%
            );
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            height: 8px;
          }
          @keyframes shimmer {
            0%   { background-position: -200% 0; }
            100% { background-position:  200% 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className={`sc ${animate ? "sc--new" : ""} ${isHighBot ? "sc--highbot" : ""}`}
      style={{ "--signal-color": signalColor } as React.CSSProperties}
    >
      {/* ROW 1: Coin + Badge + Score */}
      <div className="sc-row1">
        <div className="sc-left">
          <span className="sc-coin">${signal.coin}</span>
          <span className="sc-badge">{signal.signal}</span>
        </div>
        <span className="sc-score">{Math.round(signal.score)}</span>
      </div>

      {/* ROW 2: Score bar */}
      <div className="sc-bar">
        <HypeScoreBar score={signal.score} signal={signal.signal} height={2} />
      </div>

      {/* ROW 3: Metadata inline */}
      <div className="sc-row3">
        <span className="sc-meta">
          <span className="sc-meta-label">SENT</span>
          <span className="sc-meta-value">{formatSentimentLabel(signal.sentiment)} {signal.confidence}%</span>
        </span>
        <span className="sc-sep">·</span>
        <span className="sc-meta">
          <span className="sc-meta-label">VEL</span>
          <span
            className="sc-meta-value"
            style={{
              color:
                signal.velocity_pct > 0
                  ? "var(--pump)"
                  : signal.velocity_pct < 0
                    ? "var(--dump)"
                    : "var(--muted)",
            }}
          >
            {signal.velocity_pct > 0 ? "+" : ""}{signal.velocity_pct}%
          </span>
        </span>
        <span className="sc-sep">·</span>
        <BotRiskBadge bot_risk={signal.bot_risk} compact />
        <span className="sc-ts">{ts}</span>
      </div>

      {/* ROW 4: Explanation (optional) */}
      {showExplanation && (
        <div className="sc-explanation">{signal.explanation}</div>
      )}

      <style jsx>{`
        .sc {
          border-left: 2px solid var(--signal-color);
          border-bottom: 1px solid var(--border);
          padding: 10px 16px;
          transition: background 0.15s;
          position: relative;
        }
        .sc:hover {
          background: var(--surface);
        }
        .sc--new {
          animation: slideInCard 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                     flashGlow 1.5s ease-out;
        }
        .sc--highbot {
          background: rgba(255, 51, 85, 0.04);
        }
        .sc--highbot:hover {
          background: rgba(255, 51, 85, 0.06);
        }
        @keyframes slideInCard {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes flashGlow {
          0% { box-shadow: inset 0 0 20px rgba(0,255,224,0.1); }
          100% { box-shadow: none; }
        }

        /* ROW 1 */
        .sc-row1 {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .sc-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sc-coin {
          font-family: var(--display);
          font-weight: 700;
          font-size: 18px;
          color: var(--text);
        }
        .sc-badge {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          padding: 2px 8px;
          border: 1px solid var(--signal-color);
          color: var(--signal-color);
        }
        .sc-score {
          font-family: var(--display);
          font-weight: 800;
          font-size: 24px;
          color: var(--signal-color);
          text-align: right;
        }

        /* ROW 2 */
        .sc-bar {
          margin-bottom: 8px;
        }

        /* ROW 3 */
        .sc-row3 {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--mono);
          font-size: 10px;
          flex-wrap: wrap;
        }
        .sc-meta {
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .sc-meta-label {
          color: var(--muted);
          font-size: 9px;
          letter-spacing: 0.1em;
        }
        .sc-meta-value {
          color: var(--text);
        }
        .sc-sep {
          color: var(--muted);
          opacity: 0.5;
        }
        .sc-ts {
          color: var(--muted);
          font-size: 9px;
          margin-left: auto;
        }

        /* ROW 4 */
        .sc-explanation {
          font-family: var(--body);
          font-size: 12px;
          color: var(--muted);
          font-style: italic;
          margin-top: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
