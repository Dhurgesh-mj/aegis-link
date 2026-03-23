// frontend/components/MarketEmotion.tsx
// Aegis-Link — Market-wide emotion index panel with arc gauge + sparkline

"use client";

import type { MarketEmotion as MarketEmotionType, EmotionHistory } from "@/lib/api";

interface MarketEmotionProps {
  emotion: MarketEmotionType;
  history?: EmotionHistory[];
}

function emotionColor(color: string): string {
  switch (color) {
    case "pump":  return "var(--pump)";
    case "dump":  return "var(--dump)";
    case "watch": return "var(--watch)";
    default:      return "var(--muted)";
  }
}

export default function MarketEmotionPanel({ emotion, history = [] }: MarketEmotionProps) {
  const color = emotionColor(emotion.color);
  const pct = Math.min(emotion.index, 100) / 100;

  // 270° arc gauge (bottom gap). Center (60,60), radius 50, stroke 10
  const radius = 50;
  // 270° = 3/4 of full circle
  const arcLength = (270 / 360) * 2 * Math.PI * radius;
  const dashOffset = arcLength * (1 - pct);

  // Sparkline from history
  const sparkValues = history.map((h) => h.index_val);
  const sparkMin = Math.min(...sparkValues, 0);
  const sparkMax = Math.max(...sparkValues, 100);
  const sparkRange = sparkMax - sparkMin || 1;

  let sparkPath = "";
  if (sparkValues.length > 1) {
    const w = 200;
    const h = 40;
    const step = w / (sparkValues.length - 1);
    sparkPath = sparkValues
      .map((v, i) => {
        const x = i * step;
        const y = h - ((v - sparkMin) / sparkRange) * (h - 4) - 2;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  return (
    <div className="me-panel">
      <div className="me-header">
        <span>MARKET EMOTION INDEX</span>
        <span>{emotion.total_coins} COINS</span>
      </div>

      <div className="me-body">
        {/* Left: Arc gauge */}
        <div className="me-left">
          <div className="me-gauge-wrap">
            <svg viewBox="0 0 120 120" className="me-svg">
              {/* Track: 270° arc starting from 135° (bottom-left) */}
              <circle
                cx="60" cy="60" r={radius}
                fill="none"
                stroke="var(--border)"
                strokeWidth="10"
                strokeDasharray={`${arcLength} ${2 * Math.PI * radius - arcLength}`}
                strokeDashoffset={-arcLength / 2 - (Math.PI * radius) / 2}
                strokeLinecap="butt"
                transform="rotate(135 60 60)"
              />
              {/* Fill */}
              <circle
                cx="60" cy="60" r={radius}
                fill="none"
                stroke={color}
                strokeWidth="10"
                strokeDasharray={`${arcLength} ${2 * Math.PI * radius - arcLength}`}
                strokeDashoffset={dashOffset - arcLength / 2 - (Math.PI * radius) / 2 + arcLength}
                strokeLinecap="butt"
                transform="rotate(135 60 60)"
                className="me-arc-fill"
              />
            </svg>
            <div className="me-center">
              <span className="me-score" style={{ color }}>{Math.round(emotion.index)}</span>
              <span className="me-label">{emotion.label}</span>
            </div>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="me-right">
          <div className="me-pills">
            <span className="me-pill me-pill-pump">
              <span className="me-pill-num">{emotion.pump_count}</span>
              <span className="me-pill-label">PUMP</span>
            </span>
            <span className="me-pill me-pill-watch">
              <span className="me-pill-num">{emotion.watch_count}</span>
              <span className="me-pill-label">WATCH</span>
            </span>
            <span className="me-pill me-pill-dump">
              <span className="me-pill-num">{emotion.dump_count}</span>
              <span className="me-pill-label">DUMP</span>
            </span>
          </div>

          <div className="me-stat-rows">
            <div className="me-stat-row">
              <span className="me-stat-key">DOMINANT</span>
              <span className="me-stat-val">${emotion.dominant_coin || "—"}</span>
            </div>
            <div className="me-stat-row">
              <span className="me-stat-key">AVG FOMO</span>
              <span className="me-stat-val">{emotion.avg_fomo}</span>
            </div>
            <div className="me-stat-row">
              <span className="me-stat-key">BOT INDEX</span>
              <span className="me-stat-val">{(emotion.avg_bot_risk * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Sparkline */}
          {sparkPath && (
            <div className="me-sparkline">
              <svg viewBox={`0 0 200 40`} preserveAspectRatio="none" className="me-spark-svg">
                <path d={sparkPath} fill="none" stroke={color} strokeWidth="1.5" />
              </svg>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .me-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          width: 100%;
        }
        .me-header {
          height: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 12px;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.1em;
          border-bottom: 1px solid var(--border);
        }
        .me-body {
          display: flex;
          padding: 12px;
          gap: 12px;
        }
        .me-left {
          flex: 0 0 40%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .me-gauge-wrap {
          position: relative;
          width: 100%;
          max-width: 120px;
        }
        .me-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .me-arc-fill {
          transition: stroke-dashoffset 0.8s ease-out;
        }
        .me-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          display: flex;
          flex-direction: column;
        }
        .me-score {
          font-family: var(--display);
          font-weight: 800;
          font-size: 28px;
          line-height: 1;
        }
        .me-label {
          font-family: var(--mono);
          font-size: 8px;
          color: var(--muted);
          letter-spacing: 0.1em;
          margin-top: 2px;
        }

        .me-right {
          flex: 0 0 60%;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .me-pills {
          display: flex;
          gap: 6px;
        }
        .me-pill {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .me-pill-num {
          font-family: var(--display);
          font-weight: 700;
          font-size: 18px;
        }
        .me-pill-label {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.08em;
        }
        .me-pill-pump .me-pill-num { color: var(--pump); }
        .me-pill-pump .me-pill-label { color: var(--pump); }
        .me-pill-watch .me-pill-num { color: var(--watch); }
        .me-pill-watch .me-pill-label { color: var(--watch); }
        .me-pill-dump .me-pill-num { color: var(--dump); }
        .me-pill-dump .me-pill-label { color: var(--dump); }

        .me-stat-rows {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .me-stat-row {
          display: flex;
          justify-content: space-between;
          font-family: var(--mono);
          font-size: 10px;
        }
        .me-stat-key { color: var(--muted); }
        .me-stat-val { color: var(--text); }

        .me-sparkline {
          width: 100%;
          height: 40px;
        }
        .me-spark-svg {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
