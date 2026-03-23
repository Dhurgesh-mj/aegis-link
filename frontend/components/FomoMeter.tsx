// frontend/components/FomoMeter.tsx
// Aegis-Link — FOMO arc gauge with compact mode for SignalCard

"use client";

import type { FomoData } from "@/lib/api";

interface FomoMeterProps {
  fomo: FomoData;
  compact?: boolean;
}

function fomoColor(level: string): string {
  switch (level) {
    case "EXTREME": return "var(--dump)";
    case "HIGH":    return "var(--watch)";
    case "MEDIUM":  return "var(--accent)";
    case "LOW":     return "var(--muted)";
    default:        return "var(--muted)";
  }
}

export default function FomoMeter({ fomo, compact = false }: FomoMeterProps) {
  const color = fomoColor(fomo.fomo_level);
  const pct = Math.min(fomo.fomo_score, 100) / 100;

  // Arc calculations for SVG semicircle
  // Semicircle from 180° to 0° (left to right)
  // Center at (100, 100), radius 80, stroke-width 8
  const radius = 80;
  const circumference = Math.PI * radius; // half circle
  const dashOffset = circumference * (1 - pct);

  if (compact) {
    // Compact mode for SignalCard — single row with mini arc
    const miniR = 14;
    const miniCirc = Math.PI * miniR;
    const miniDash = miniCirc * (1 - pct);

    return (
      <span className="fomo-compact">
        <svg width="32" height="18" viewBox="0 0 32 18">
          <path
            d={`M 2 16 A ${miniR} ${miniR} 0 0 1 30 16`}
            fill="none"
            stroke="var(--border)"
            strokeWidth="3"
            strokeLinecap="butt"
          />
          <path
            d={`M 2 16 A ${miniR} ${miniR} 0 0 1 30 16`}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="butt"
            strokeDasharray={`${miniCirc}`}
            strokeDashoffset={`${miniDash}`}
            style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
          />
        </svg>
        <span className="fomo-compact-level" style={{ color }}>
          {fomo.fomo_level}
        </span>

        <style jsx>{`
          .fomo-compact {
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }
          .fomo-compact-level {
            font-family: var(--mono);
            font-size: 9px;
            letter-spacing: 0.08em;
          }
        `}</style>
      </span>
    );
  }

  // Full mode
  return (
    <div className="fomo-meter">
      <div className="fomo-header">FOMO INDEX</div>

      <div className="fomo-gauge-wrap">
        <svg viewBox="0 0 200 120" className="fomo-svg">
          {/* Track */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
            strokeLinecap="butt"
          />
          {/* Fill */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="butt"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${dashOffset}`}
            className="fomo-arc"
          />
        </svg>

        <div className="fomo-center">
          <span className="fomo-score" style={{ color }}>
            {Math.round(fomo.fomo_score)}
          </span>
          <span className="fomo-level" style={{ color }}>
            {fomo.fomo_level}
          </span>
        </div>
      </div>

      <div className="fomo-stats">
        <span>VELOCITY {fomo.raw_velocity?.toFixed(0) || 0}%</span>
        <span>ACCEL {fomo.acceleration > 0 ? "+" : ""}{fomo.acceleration?.toFixed(0) || 0}%</span>
      </div>

      {fomo.is_fomo_driven && (
        <div className="fomo-active">
          <span className="fomo-dot" />
          FOMO ACTIVE
        </div>
      )}

      <style jsx>{`
        .fomo-meter {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .fomo-header {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.12em;
          align-self: flex-start;
        }
        .fomo-gauge-wrap {
          position: relative;
          width: 100%;
          max-width: 160px;
        }
        .fomo-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .fomo-arc {
          transition: stroke-dashoffset 0.8s ease-out;
        }
        .fomo-center {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          display: flex;
          flex-direction: column;
        }
        .fomo-score {
          font-family: var(--display);
          font-weight: 800;
          font-size: 28px;
          line-height: 1;
        }
        .fomo-level {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          margin-top: 2px;
        }
        .fomo-stats {
          display: flex;
          gap: 16px;
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
        }
        .fomo-active {
          display: flex;
          align-items: center;
          gap: 5px;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--dump);
          letter-spacing: 0.08em;
        }
        .fomo-dot {
          width: 5px;
          height: 5px;
          background: var(--dump);
          display: inline-block;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
