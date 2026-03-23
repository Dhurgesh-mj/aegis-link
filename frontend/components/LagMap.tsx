// frontend/components/LagMap.tsx
// Aegis-Link — Hype propagation timeline visualization

"use client";

import type { LagData } from "@/lib/api";

interface LagMapProps {
  lag: LagData;
}

const SOURCE_COLORS: Record<string, string> = {
  reddit:      "var(--accent)",
  telegram:    "#7b2fff",
  "4chan":      "var(--watch)",
  stocktwits:  "var(--text)",
  cryptopanic: "var(--muted)",
  coingecko:   "var(--pump)",
};

function srcColor(src: string): string {
  return SOURCE_COLORS[src?.toLowerCase()] || "var(--muted)";
}

export default function LagMap({ lag }: LagMapProps) {
  if (!lag || !lag.propagation_path || lag.propagation_path.length === 0) {
    return null;
  }

  const path = lag.propagation_path;
  const isOrigin4chan = lag.origin === "4chan";

  return (
    <div className="lm-panel">
      <div className="lm-header">
        <span>HYPE PROPAGATION</span>
        <span>
          ORIGIN: <span style={{ color: srcColor(lag.origin) }}>{lag.origin_label}</span>
        </span>
      </div>

      {/* Timeline */}
      <div className="lm-timeline">
        {path.map((src, i) => {
          const isOrig = src === lag.origin;
          const info = lag.lag_map[src];
          const seconds = info?.seconds || 0;
          const label = info?.label || src;
          const color = srcColor(src);

          return (
            <div key={src} className="lm-node-group">
              {/* Connector line (not for first) */}
              {i > 0 && (
                <div className="lm-connector">
                  <div className="lm-connector-line" />
                </div>
              )}

              {/* Node */}
              <div className="lm-node">
                <div
                  className={`lm-dot ${isOrig ? "lm-dot-origin" : ""}`}
                  style={{
                    background: isOrig ? color : "var(--border)",
                    borderColor: color,
                    boxShadow: isOrig ? `0 0 8px ${color}` : "none",
                  }}
                />
                <span className="lm-src-label">{label}</span>
                <span className="lm-time">
                  {seconds === 0 ? "ORIGIN" : `+${seconds}s`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tags */}
      <div className="lm-tags">
        {isOrigin4chan && (
          <span className="lm-tag lm-tag-4chan">4CHAN ORIGIN</span>
        )}
        {lag.total_spread_seconds > 0 && (
          <span className="lm-tag">
            SPREAD: {Math.round(lag.total_spread_seconds / 60)}min
          </span>
        )}
      </div>

      {/* Insight */}
      {lag.insight && (
        <div className="lm-insight">{lag.insight}</div>
      )}

      <style jsx>{`
        .lm-panel {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .lm-header {
          display: flex;
          justify-content: space-between;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.1em;
        }
        .lm-timeline {
          display: flex;
          align-items: flex-start;
          overflow-x: auto;
          padding: 8px 0;
        }
        .lm-node-group {
          display: flex;
          align-items: flex-start;
        }
        .lm-connector {
          display: flex;
          align-items: center;
          padding-top: 4px;
          min-width: 24px;
        }
        .lm-connector-line {
          width: 100%;
          height: 1px;
          background: var(--border);
          min-width: 20px;
        }
        .lm-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          min-width: 60px;
        }
        .lm-dot {
          width: 8px;
          height: 8px;
          border: 1px solid;
          flex-shrink: 0;
        }
        .lm-dot-origin {
          width: 10px;
          height: 10px;
        }
        .lm-src-label {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          text-align: center;
          white-space: nowrap;
        }
        .lm-time {
          font-family: var(--mono);
          font-size: 8px;
          color: var(--muted);
          opacity: 0.7;
        }
        .lm-tags {
          display: flex;
          gap: 6px;
        }
        .lm-tag {
          font-family: var(--mono);
          font-size: 8px;
          padding: 2px 6px;
          border: 1px solid var(--border);
          color: var(--muted);
          letter-spacing: 0.08em;
        }
        .lm-tag-4chan {
          border-color: var(--watch);
          color: var(--watch);
        }
        .lm-insight {
          font-family: var(--body);
          font-size: 11px;
          color: var(--muted);
          font-style: italic;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
