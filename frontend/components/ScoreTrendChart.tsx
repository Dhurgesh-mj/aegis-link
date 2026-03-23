// frontend/components/ScoreTrendChart.tsx
// Aegis-Link — Score trend mini-chart (SVG)

"use client";

import { useMemo } from "react";
import type { ChartPoint } from "@/lib/api";

function colorFor(signal: string) {
  switch (signal) {
    case "PUMP":
      return "var(--pump)";
    case "DUMP":
      return "var(--dump)";
    default:
      return "var(--watch)";
  }
}

export default function ScoreTrendChart({
  points,
  height = 72,
  width = 260,
}: {
  points: ChartPoint[];
  height?: number;
  width?: number;
}) {
  const { polyline, minScore, maxScore, latest } = useMemo(() => {
    const scores = points.map((p) => Number(p.score) || 0);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 1;

    const pad = 6;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;

    const toX = (i: number) => {
      const n = Math.max(points.length - 1, 1);
      return pad + (i / n) * innerW;
    };

    const toY = (v: number) => {
      const denom = safeMax - safeMin;
      const t = denom === 0 ? 0.5 : (v - safeMin) / denom;
      // higher score => higher on chart
      return pad + (1 - t) * innerH;
    };

    const pts = points.map((p, i) => `${toX(i)},${toY(Number(p.score) || 0)}`);
    return {
      polyline: pts.join(" "),
      minScore: safeMin,
      maxScore: safeMax,
      latest: points[points.length - 1],
    };
  }, [points, height, width]);

  const latestColor = latest ? colorFor(latest.signal) : "var(--watch)";

  if (!points || points.length < 2) {
    return (
      <div style={{ padding: "10px 0", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 10 }}>
        No trend data yet.
      </div>
    );
  }

  return (
    <div style={{ width }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={latestColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={latestColor} stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* subtle grid */}
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.04)" />

        {/* glow */}
        <polyline
          points={polyline}
          fill="none"
          stroke={latestColor}
          strokeWidth={2.5}
          strokeOpacity={0.18}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* main */}
        <polyline
          points={polyline}
          fill="none"
          stroke="url(#trendStroke)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* latest dot */}
        {(() => {
          const lastIdx = points.length - 1;
          const pad = 6;
          const innerW = width - pad * 2;
          const innerH = height - pad * 2;
          const denom = (maxScore as number) - (minScore as number);
          const v = Number(points[lastIdx].score) || 0;
          const t = denom === 0 ? 0.5 : ((v - (minScore as number)) / denom);
          const x = pad + (innerW * (lastIdx / Math.max(points.length - 1, 1)));
          const y = pad + (1 - t) * innerH;
          return <circle cx={x} cy={y} r={3.2} fill={latestColor} />;
        })()}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, fontFamily: "var(--mono)" }}>
        <span style={{ color: "var(--muted)", fontSize: 9 }}>{minScore.toFixed(0)}</span>
        <span style={{ color: "var(--text)", fontSize: 10, fontWeight: 700 }}>{latest ? latest.score.toFixed(1) : "—"}</span>
        <span style={{ color: "var(--muted)", fontSize: 9 }}>{maxScore.toFixed(0)}</span>
      </div>
    </div>
  );
}

