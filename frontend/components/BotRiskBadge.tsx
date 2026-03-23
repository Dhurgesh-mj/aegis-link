// frontend/components/BotRiskBadge.tsx
// Aegis-Link — Compact bot risk badge with HIGH prominence

"use client";

interface BotRiskBadgeProps {
  bot_risk: number;
  compact?: boolean;
}

export default function BotRiskBadge({ bot_risk, compact = false }: BotRiskBadgeProps) {
  let label: string;
  let color: string;
  let isHigh = false;

  if (bot_risk < 0.3) {
    label = "LOW";
    color = "var(--pump)";
  } else if (bot_risk <= 0.65) {
    label = "MED";
    color = "var(--watch)";
  } else {
    label = "HIGH";
    color = "var(--dump)";
    isHigh = true;
  }

  const riskPct = Math.round(bot_risk * 100);

  return (
    <span className={`bot-badge ${isHigh ? "bot-badge--danger" : ""} ${compact ? "bot-badge--compact" : ""}`}>
      <span
        className={`bot-dot ${isHigh ? "bot-dot--blink" : ""}`}
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      <span className="bot-text" style={{ color }}>
        BOT: {label}
      </span>
      {!compact && (
        <span className="bot-pct" style={{ color }}>{riskPct}%</span>
      )}

      <style jsx>{`
        .bot-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          white-space: nowrap;
          transition: all 0.3s;
        }
        .bot-badge--compact {
          font-size: 9px;
          gap: 4px;
        }
        .bot-badge--danger {
          animation: dangerPulse 2s ease infinite;
        }
        @keyframes dangerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .bot-dot {
          width: 4px;
          height: 4px;
          display: inline-block;
          flex-shrink: 0;
        }
        .bot-dot--blink {
          animation: blink 0.8s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.15; }
        }
        .bot-text {
          font-weight: 600;
        }
        .bot-pct {
          opacity: 0.6;
          font-size: 8px;
        }
      `}</style>
    </span>
  );
}
