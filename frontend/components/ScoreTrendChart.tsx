// frontend/components/ScoreTrendChart.tsx
// Aegis-Link — Interactive score trend chart with hover, crosshair, tooltip

"use client";

import { useMemo, useState } from "react";
import type { ChartPoint } from "@/lib/api";

function colorFor(signal: string) {
  switch (signal) {
    case "PUMP":
      return "#00ff88";
    case "DUMP":
      return "#ff3355";
    default:
      return "#ffb800";
  }
}

function sentimentLabel(s: string) {
  if (!s) return "—";
  const u = s.toUpperCase();
  if (u === "BULLISH") return "Bullish";
  if (u === "BEARISH") return "Bearish";
  return "Neutral";
}

export default function ScoreTrendChart({
  points,
  height = 120,
  width = 480,
}: {
  points: ChartPoint[];
  height?: number;
  width?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const pad = 6;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const { minScore, maxScore, coords } = useMemo(() => {
    const scores = points.map((p) => Number(p.score) || 0);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 1;
    const denom = safeMax - safeMin || 1;

    const c = points.map((p, i) => {
      const n = Math.max(points.length - 1, 1);
      const x = pad + (i / n) * innerW;
      const t = (((Number(p.score) || 0) - safeMin) / denom);
      const y = pad + (1 - t) * innerH;
      return { x, y };
    });

    return { minScore: safeMin, maxScore: safeMax, coords: c };
  }, [points, innerW, innerH]);

  // Build connected line path
  const linePath = coords.map((c, i) =>
    `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`
  ).join(" ");

  // Area fill path (for gradient under curve)
  const areaPath = linePath +
    ` L${coords[coords.length - 1]?.x.toFixed(1)},${height - pad}` +
    ` L${coords[0]?.x.toFixed(1)},${height - pad} Z`;

  const latest = points[points.length - 1];
  const latestColor = latest ? colorFor(latest.signal) : "#ffb800";

  if (!points || points.length < 2) {
    return (
      <div style={{ padding: "10px 0", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 10 }}>
        No trend data yet.
      </div>
    );
  }

  const hovPt = hovered !== null ? points[hovered] : null;
  const hovCoord = hovered !== null ? coords[hovered] : null;

  return (
    <div className="stc-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="stc-svg"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          {/* Line gradient */}
          <linearGradient id="stcStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={latestColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={latestColor} stopOpacity="1" />
          </linearGradient>
          {/* Area fill gradient */}
          <linearGradient id="stcFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={latestColor} stopOpacity="0.12" />
            <stop offset="100%" stopColor={latestColor} stopOpacity="0" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="stcGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Subtle horizontal midline */}
        <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} stroke="rgba(255,255,255,0.04)" />

        {/* Area fill under the curve */}
        {coords.length > 1 && (
          <path d={areaPath} fill="url(#stcFill)" />
        )}

        {/* Glow line (thicker, low opacity) */}
        <polyline
          points={coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={latestColor}
          strokeWidth={3}
          strokeOpacity={0.15}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Main trend line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#stcStroke)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ─── Crosshair on hover ─── */}
        {hovCoord && hovPt && (
          <g>
            {/* Vertical line */}
            <line
              x1={hovCoord.x} y1={pad}
              x2={hovCoord.x} y2={height - pad}
              stroke={colorFor(hovPt.signal)}
              strokeWidth="0.6"
              strokeDasharray="3,3"
              opacity="0.5"
            />
            {/* Horizontal line */}
            <line
              x1={pad} y1={hovCoord.y}
              x2={width - pad} y2={hovCoord.y}
              stroke={colorFor(hovPt.signal)}
              strokeWidth="0.6"
              strokeDasharray="3,3"
              opacity="0.5"
            />
          </g>
        )}

        {/* ─── Highlight adjacent line segments on hover ─── */}
        {hovered !== null && (
          <g>
            {hovered > 0 && (
              <line
                x1={coords[hovered - 1].x} y1={coords[hovered - 1].y}
                x2={coords[hovered].x} y2={coords[hovered].y}
                stroke={colorFor(points[hovered].signal)}
                strokeWidth="2.5"
                opacity="0.85"
                strokeLinecap="round"
              />
            )}
            {hovered < coords.length - 1 && (
              <line
                x1={coords[hovered].x} y1={coords[hovered].y}
                x2={coords[hovered + 1].x} y2={coords[hovered + 1].y}
                stroke={colorFor(points[hovered].signal)}
                strokeWidth="2.5"
                opacity="0.85"
                strokeLinecap="round"
              />
            )}
          </g>
        )}

        {/* ─── Dots on every point (small, show all) ─── */}
        {coords.map((c, i) => {
          const pt = points[i];
          const isHov = hovered === i;
          const isLast = i === points.length - 1;
          const dotColor = colorFor(pt.signal);
          // Only show dots for last point and hovered, keep others tiny
          const r = isHov ? 4.5 : isLast ? 3 : 0;

          return (
            <g key={i}
              onMouseEnter={() => setHovered(i)}
              style={{ cursor: "crosshair" }}
            >
              {/* Invisible hit area */}
              <rect
                x={c.x - (innerW / points.length / 2)}
                y={pad}
                width={innerW / points.length}
                height={innerH}
                fill="transparent"
              />

              {/* Visible dot */}
              {r > 0 && (
                <circle
                  cx={c.x} cy={c.y}
                  r={r}
                  fill={dotColor}
                  opacity={isHov ? 1 : 0.8}
                  filter={isHov ? "url(#stcGlow)" : undefined}
                  style={{ transition: "all 0.15s ease" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* ─── Score range labels ─── */}
      <div className="stc-labels">
        <span className="stc-min">{minScore.toFixed(0)}</span>
        <span className="stc-current" style={{ color: latestColor }}>
          {latest ? latest.score.toFixed(1) : "—"}
        </span>
        <span className="stc-max">{maxScore.toFixed(0)}</span>
      </div>

      {/* ─── Tooltip ─── */}
      {hovPt && hovCoord && (
        <div
          className="stc-tooltip"
          style={{
            left: `${(hovCoord.x / width) * 100}%`,
            top: hovCoord.y > height / 2 ? "4px" : undefined,
            bottom: hovCoord.y <= height / 2 ? "28px" : undefined,
          }}
        >
          <div className="tt-header" style={{ color: colorFor(hovPt.signal) }}>
            {hovPt.signal}
            <span className="tt-score">{hovPt.score.toFixed(1)}</span>
          </div>
          <div className="tt-grid">
            <div className="tt-item">
              <span className="tt-lbl">SENTIMENT</span>
              <span className="tt-val">{sentimentLabel(hovPt.sentiment)}</span>
            </div>
            <div className="tt-item">
              <span className="tt-lbl">VELOCITY</span>
              <span className="tt-val" style={{
                color: hovPt.velocity_pct > 0 ? "var(--pump)" : hovPt.velocity_pct < 0 ? "var(--dump)" : "var(--muted)"
              }}>
                {hovPt.velocity_pct > 0 ? "+" : ""}{hovPt.velocity_pct}%
              </span>
            </div>
            <div className="tt-item">
              <span className="tt-lbl">BOT RISK</span>
              <span className="tt-val" style={{
                color: hovPt.bot_risk > 0.5 ? "var(--dump)" : "var(--muted)"
              }}>
                {(hovPt.bot_risk * 100).toFixed(0)}%
              </span>
            </div>
            <div className="tt-item">
              <span className="tt-lbl">VOL SPIKE</span>
              <span className="tt-val">{hovPt.volume_spike?.toFixed(1)}x</span>
            </div>
          </div>
          <div className="tt-time">
            {hovPt.ts?.split("T")[1]?.slice(0, 8) || hovPt.ts || "—"}
          </div>
        </div>
      )}

      <style jsx>{`
        .stc-wrap {
          position: relative;
          width: 100%;
        }
        .stc-svg {
          width: 100%;
          height: auto;
          display: block;
        }

        /* Labels row */
        .stc-labels {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 6px;
          font-family: var(--mono);
        }
        .stc-min, .stc-max {
          color: var(--muted);
          font-size: 9px;
        }
        .stc-current {
          font-size: 10px;
          font-weight: 700;
        }

        /* Tooltip */
        .stc-tooltip {
          position: absolute;
          transform: translateX(-50%);
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 8px 12px;
          pointer-events: none;
          z-index: 20;
          min-width: 160px;
          animation: stcTipIn 0.12s ease;
          box-shadow: 0 0 16px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 255, 224, 0.04);
        }
        @keyframes stcTipIn {
          from { opacity: 0; transform: translateX(-50%) translateY(3px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        .tt-header {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 5px;
          margin-bottom: 5px;
          border-bottom: 1px solid var(--border);
        }
        .tt-score {
          font-family: var(--display);
          font-weight: 800;
          font-size: 14px;
        }

        .tt-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3px 12px;
        }
        .tt-item {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .tt-lbl {
          font-family: var(--mono);
          font-size: 7px;
          letter-spacing: 0.12em;
          color: var(--muted);
        }
        .tt-val {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--text);
        }

        .tt-time {
          font-family: var(--mono);
          font-size: 8px;
          color: var(--muted);
          margin-top: 5px;
          padding-top: 4px;
          border-top: 1px solid var(--border);
          text-align: center;
          letter-spacing: 0.08em;
        }
      `}</style>
    </div>
  );
}
