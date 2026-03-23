// frontend/components/StrategyBadge.tsx
// Aegis-Link — Strategy action badge (BUY/WAIT/AVOID/WATCH)

"use client";

import type { StrategyData } from "@/lib/api";

interface StrategyBadgeProps {
  strategy: StrategyData;
  showReason?: boolean;
}

const ACTION_STYLES: Record<string, { bg: string; border: string; text: string; glow: boolean }> = {
  BUY:   { bg: "rgba(0,255,136,0.12)", border: "var(--pump)",  text: "var(--pump)",  glow: true },
  WAIT:  { bg: "rgba(255,184,0,0.12)", border: "var(--watch)", text: "var(--watch)", glow: false },
  AVOID: { bg: "rgba(255,51,85,0.12)", border: "var(--dump)",  text: "var(--dump)",  glow: true },
  WATCH: { bg: "var(--border)",        border: "var(--muted)", text: "var(--muted)", glow: false },
};

export default function StrategyBadge({ strategy, showReason = false }: StrategyBadgeProps) {
  const style = ACTION_STYLES[strategy.action] || ACTION_STYLES.WATCH;
  const showDot = strategy.action === "BUY" || strategy.action === "AVOID";

  return (
    <div className="sb-wrap">
      <span className="sb-badge">
        {showDot && <span className="sb-dot" />}
        {strategy.action}
      </span>

      {showReason && strategy.reason && (
        <div className="sb-reason">{strategy.reason}</div>
      )}

      {showReason && (
        <div className="sb-meta">
          <span>RISK: {strategy.risk}</span>
          <span className="sb-sep">·</span>
          <span>CONF: {strategy.confidence}</span>
        </div>
      )}

      <style jsx>{`
        .sb-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sb-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          padding: 4px 12px;
          background: ${style.bg};
          border: 1px solid ${style.border};
          color: ${style.text};
          width: fit-content;
        }
        .sb-dot {
          width: 5px;
          height: 5px;
          background: ${style.text};
          display: inline-block;
          animation: ${strategy.action === "AVOID" ? "blink" : "pulse"} 1s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.15; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sb-reason {
          font-family: var(--body);
          font-size: 11px;
          color: var(--muted);
          font-style: italic;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .sb-meta {
          display: flex;
          gap: 6px;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
        }
        .sb-sep {
          opacity: 0.4;
        }
      `}</style>
    </div>
  );
}
