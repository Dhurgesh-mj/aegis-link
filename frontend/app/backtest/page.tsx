// frontend/app/backtest/page.tsx
// Aegis-Link — Historical Validation Page (Backtest)

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import BacktestTable from "@/components/BacktestTable";
import { fetchBacktest, fetchBacktestTimeline, type BacktestResult, type BacktestEvent } from "@/lib/api";

/* ── Interactive scatter chart sub-component ───────── */

function ScatterChart({ events }: { events: BacktestEvent[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Sort events by signal_score ascending for the connecting line
  const sorted = useMemo(
    () => [...events].sort((a, b) => a.signal_score - b.signal_score),
    [events],
  );

  // Chart dimensions / padding
  const W = 900, H = 340;
  const pl = 56, pr = 24, pt = 36, pb = 38;
  const cw = W - pl - pr;
  const ch = H - pt - pb;

  // Ranges
  const { minS, maxS, minG, maxG } = useMemo(() => {
    if (sorted.length === 0) return { minS: 0, maxS: 100, minG: 0, maxG: 500 };
    const scores = sorted.map((e) => e.signal_score);
    const gains = sorted.map((e) => e.price_24h_pct);
    return {
      minS: Math.min(...scores) - 5,
      maxS: Math.max(...scores) + 5,
      minG: 0,
      maxG: Math.max(...gains) * 1.15,
    };
  }, [sorted]);

  const toX = (s: number) => pl + ((s - minS) / (maxS - minS)) * cw;
  const toY = (g: number) => pt + ch - ((g - minG) / (maxG - minG)) * ch;

  const getColor = (pct: number) =>
    pct > 200 ? "#00ff88" : pct > 100 ? "#00cc6a" : pct > 50 ? "#ffb800" : "#ff3355";

  // Grid lines
  const hGridLines: number[] = [];
  for (let g = 0; g <= maxG; g += 100) hGridLines.push(g);
  const vGridLines: number[] = [];
  for (let s = Math.ceil(minS / 5) * 5; s <= maxS; s += 5) vGridLines.push(s);

  // Connect-the-dots polyline path
  const linePath = sorted.map((e, i) => {
    const x = toX(e.signal_score);
    const y = toY(e.price_24h_pct);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  if (sorted.length === 0) return null;

  return (
    <div className="scatter-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="scatter-svg"
      >
        <defs>
          {/* Glow filter for hovered dot */}
          <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Gradient for the connecting line */}
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff3355" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#ffb800" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00ff88" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {hGridLines.map((g) => (
          <g key={`hg-${g}`}>
            <line x1={pl} y1={toY(g)} x2={W - pr} y2={toY(g)} stroke="#0f1a2e" strokeWidth="0.5" />
            <text x={pl - 8} y={toY(g) + 3} textAnchor="end" fill="#3a4a6b"
              style={{ fontSize: "9px", fontFamily: "var(--mono)" }}>{g}%</text>
          </g>
        ))}
        {vGridLines.map((s) => (
          <g key={`vg-${s}`}>
            <line x1={toX(s)} y1={pt} x2={toX(s)} y2={pt + ch} stroke="#0f1a2e" strokeWidth="0.5" />
            <text x={toX(s)} y={H - 10} textAnchor="middle" fill="#3a4a6b"
              style={{ fontSize: "9px", fontFamily: "var(--mono)" }}>{s}</text>
          </g>
        ))}

        {/* Axis labels */}
        <text x={pl + cw / 2} y={H - 1} textAnchor="middle" fill="#3a4a6b"
          style={{ fontSize: "9px", fontFamily: "var(--mono)", letterSpacing: "0.12em" }}>SIGNAL SCORE</text>
        <text x={0} y={0} textAnchor="middle" fill="#3a4a6b"
          transform={`translate(12, ${pt + ch / 2}) rotate(-90)`}
          style={{ fontSize: "9px", fontFamily: "var(--mono)", letterSpacing: "0.12em" }}>24H GAIN %</text>

        {/* Title */}
        <text x={pl} y={18} textAnchor="start" fill="#3a4a6b"
          style={{ fontSize: "10px", fontFamily: "var(--mono)", letterSpacing: "0.12em" }}>
          SIGNAL SCORE vs PRICE GAIN
        </text>

        {/* ─── Connecting line ─── */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="connect-line"
        />

        {/* ─── Line segments highlight on hover ─── */}
        {hovered !== null && sorted.length > 1 && (() => {
          const segments: JSX.Element[] = [];
          // Highlight segment before and after hovered point
          if (hovered > 0) {
            const prev = sorted[hovered - 1];
            const cur = sorted[hovered];
            segments.push(
              <line key="seg-prev"
                x1={toX(prev.signal_score)} y1={toY(prev.price_24h_pct)}
                x2={toX(cur.signal_score)} y2={toY(cur.price_24h_pct)}
                stroke={getColor(cur.price_24h_pct)} strokeWidth="2.5" opacity="0.9"
              />
            );
          }
          if (hovered < sorted.length - 1) {
            const cur = sorted[hovered];
            const next = sorted[hovered + 1];
            segments.push(
              <line key="seg-next"
                x1={toX(cur.signal_score)} y1={toY(cur.price_24h_pct)}
                x2={toX(next.signal_score)} y2={toY(next.price_24h_pct)}
                stroke={getColor(cur.price_24h_pct)} strokeWidth="2.5" opacity="0.9"
              />
            );
          }
          return segments;
        })()}

        {/* ─── Crosshair guides on hover ─── */}
        {hovered !== null && (() => {
          const e = sorted[hovered];
          const x = toX(e.signal_score);
          const y = toY(e.price_24h_pct);
          return (
            <g className="crosshair">
              <line x1={x} y1={pt} x2={x} y2={pt + ch} stroke={getColor(e.price_24h_pct)} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4" />
              <line x1={pl} y1={y} x2={W - pr} y2={y} stroke={getColor(e.price_24h_pct)} strokeWidth="0.5" strokeDasharray="3,3" opacity="0.4" />
            </g>
          );
        })()}

        {/* ─── Data points ─── */}
        {sorted.map((e, i) => {
          const x = toX(e.signal_score);
          const y = toY(e.price_24h_pct);
          const color = getColor(e.price_24h_pct);
          const isHov = hovered === i;

          return (
            <g key={`pt-${i}`}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "crosshair" }}
            >
              {/* Invisible larger hit area */}
              <circle cx={x} cy={y} r={16} fill="transparent" />

              {/* Dot */}
              <circle
                cx={x} cy={y}
                r={isHov ? 7 : 5}
                fill={color}
                opacity={isHov ? 1 : 0.8}
                filter={isHov ? "url(#dotGlow)" : undefined}
                style={{ transition: "r 0.2s ease, opacity 0.2s ease" }}
              />

              {/* Label (always visible) */}
              <text x={x} y={y - (isHov ? 14 : 10)} textAnchor="middle"
                fill={isHov ? "var(--text)" : "#3a4a6b"}
                style={{ fontSize: isHov ? "9px" : "8px", fontFamily: "var(--mono)", transition: "all 0.2s ease" }}>
                ${e.coin}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ─── Tooltip ─── */}
      {hovered !== null && (() => {
        const e = sorted[hovered];
        const x = toX(e.signal_score);
        const y = toY(e.price_24h_pct);
        // Position tooltip relative to the SVG viewBox, clamped to stay in bounds
        const tipLeft = Math.min(Math.max(x - 70, pl), W - pr - 160);
        const tipTop = y > 120 ? y - 105 : y + 20;

        return (
          <div className="scatter-tooltip" style={{
            left: `${(tipLeft / W) * 100}%`,
            top: `${(tipTop / H) * 100}%`,
          }}>
            <div className="tt-row tt-coin" style={{ color: getColor(e.price_24h_pct) }}>
              ${e.coin}
            </div>
            <div className="tt-row">
              <span className="tt-label">SCORE</span>
              <span className="tt-val">{e.signal_score.toFixed(1)}</span>
            </div>
            <div className="tt-row">
              <span className="tt-label">24H GAIN</span>
              <span className="tt-val" style={{ color: "var(--pump)" }}>+{e.price_24h_pct.toFixed(1)}%</span>
            </div>
            <div className="tt-row">
              <span className="tt-label">1H GAIN</span>
              <span className="tt-val" style={{ color: "var(--pump)" }}>+{e.price_1h_pct.toFixed(1)}%</span>
            </div>
            <div className="tt-row">
              <span className="tt-label">LEAD TIME</span>
              <span className="tt-val" style={{ color: "var(--accent)" }}>{e.minutes_before_pump}min</span>
            </div>
            <div className="tt-row">
              <span className="tt-label">BOT RISK</span>
              <span className="tt-val" style={{ color: e.bot_risk > 0.5 ? "var(--dump)" : "var(--muted)" }}>
                {(e.bot_risk * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        );
      })()}

      <style jsx>{`
        .scatter-wrap {
          position: relative;
          width: 100%;
          border: 1px solid var(--border);
          background: var(--bg);
          overflow: visible;
        }
        .scatter-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .connect-line {
          transition: opacity 0.3s ease;
        }
        .scatter-wrap:hover .connect-line {
          opacity: 0.5;
        }

        /* Tooltip */
        .scatter-tooltip {
          position: absolute;
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 10px 14px;
          pointer-events: none;
          z-index: 20;
          min-width: 150px;
          animation: tooltipIn 0.15s ease;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 255, 224, 0.05);
        }
        @keyframes tooltipIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tt-coin {
          font-family: var(--display);
          font-weight: 800;
          font-size: 14px;
          margin-bottom: 6px;
          padding-bottom: 6px;
          border-bottom: 1px solid var(--border);
        }
        .tt-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 2px 0;
        }
        .tt-label {
          font-family: var(--mono);
          font-size: 8px;
          letter-spacing: 0.12em;
          color: var(--muted);
        }
        .tt-val {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text);
        }
      `}</style>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────── */

export default function BacktestPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [timeline, setTimeline] = useState<BacktestEvent[]>([]);

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) router.push("/login");
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      const [bt, tl] = await Promise.all([fetchBacktest(), fetchBacktestTimeline()]);
      setResult(bt);
      setTimeline(tl);
    } catch (e) {
      console.error("Backtest load error:", e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!mounted) return null;

  return (
    <div className="bt-page">
      <Navbar />

      {/* Header */}
      <div className="bt-header">
        <h1>HISTORICAL VALIDATION</h1>
        <p>Signal accuracy against verified pump events.</p>
      </div>

      {/* Stats Row */}
      {result && (
        <div className="stats-row">
          <div className="stats-inner">
            <div className="stat-cell">
              <span className="stat-number" style={{ color: "var(--pump)" }}>
                {result.accuracy_pct}%
              </span>
              <span className="stat-label">ACCURACY</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-cell">
              <span className="stat-number" style={{ color: "var(--pump)" }}>
                +{result.avg_gain_24h}%
              </span>
              <span className="stat-label">AVG 24H GAIN</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-cell">
              <span className="stat-number" style={{ color: "var(--accent)" }}>
                {result.avg_lead_minutes}min
              </span>
              <span className="stat-label">AVG LEAD TIME</span>
            </div>
          </div>
        </div>
      )}

      {/* Proof Statement */}
      {result && (
        <div className="proof-statement">
          On average, Aegis-Link signal fired {result.avg_lead_minutes} minutes before price moved.
        </div>
      )}

      {/* Table */}
      <div className="bt-content">
        <BacktestTable events={timeline} showSummary />
      </div>

      {/* Interactive Scatter Chart */}
      <div className="bt-chart-section">
        <ScatterChart events={timeline} />
      </div>

      <style jsx>{`
        .bt-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }
        .bt-header {
          padding: 32px 24px 16px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }
        .bt-header h1 {
          font-family: var(--display);
          font-weight: 800;
          font-size: 36px;
          color: var(--text);
          margin: 0;
        }
        .bt-header p {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--muted);
          margin-top: 6px;
          letter-spacing: 0.05em;
        }

        .stats-row {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          height: 80px;
          display: flex;
          align-items: center;
          background: var(--surface-glass);
        }
        .stats-inner {
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          align-items: center;
          padding: 0 24px;
        }
        .stat-cell {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
        }
        .stat-number {
          font-family: var(--display);
          font-weight: 800;
          font-size: 28px;
          line-height: 1;
        }
        .stat-label {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.15em;
          color: var(--muted);
          text-transform: uppercase;
        }
        .stat-divider {
          width: 1px;
          height: 32px;
          background: var(--border);
          flex-shrink: 0;
        }

        .proof-statement {
          text-align: center;
          padding: 20px 24px;
          font-family: var(--mono);
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 0.03em;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        .bt-content {
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          padding: 0 24px 24px;
        }

        .bt-chart-section {
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          padding: 0 24px 48px;
        }

        @media (max-width: 768px) {
          .bt-header h1 { font-size: 24px; }
          .stats-inner { flex-wrap: wrap; gap: 8px; }
          .stat-cell { flex: 0 0 100%; }
          .stat-divider { display: none; }
          .stats-row { height: auto; padding: 12px 0; }
        }
      `}</style>
    </div>
  );
}
