// frontend/components/AnomalyChart.tsx
// Aegis-Link — Anomaly z-score chart with dynamic coloring and threshold markers

"use client";

import { useEffect, useRef } from "react";

interface AnomalyPoint {
  ts: string;
  count: number;
  zscore: number;
}

interface AnomalyChartProps {
  coin: string;
  history: AnomalyPoint[];
}

export default function AnomalyChart({ coin, history }: AnomalyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Colors
    const borderColor = "#0f1a2e";
    const mutedColor = "#3a4a6b";
    const accentColor = "#00ffe0";
    const dumpColor = "#ff3355";
    const watchColor = "#ffb800";

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Padding
    const pl = 44, pr = 12, pt = 28, pb = 24;
    const cw = w - pl - pr;
    const ch = h - pt - pb;

    // Data range
    const zscores = history.map((p) => p.zscore);
    const minZ = Math.min(...zscores, -1);
    const maxZ = Math.max(...zscores, 5);
    const rangeZ = maxZ - minZ || 1;

    const xStep = cw / Math.max(history.length - 1, 1);

    const toX = (i: number) => pl + i * xStep;
    const toY = (z: number) => pt + ch - ((z - minZ) / rangeZ) * ch;

    // Grid lines
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.5;
    for (let z = Math.ceil(minZ); z <= Math.floor(maxZ); z++) {
      const y = toY(z);
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(w - pr, y);
      ctx.stroke();

      ctx.fillStyle = mutedColor;
      ctx.font = "9px 'Share Tech Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${z}σ`, pl - 6, y + 3);
    }

    // Threshold lines
    const drawThreshold = (val: number, color: string, label: string) => {
      if (val >= minZ && val <= maxZ) {
        const y = toY(val);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pl, y);
        ctx.lineTo(w - pr, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.font = "8px 'Share Tech Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(label, pl + 4, y - 4);
        ctx.globalAlpha = 1;
      }
    };

    drawThreshold(2.5, accentColor, "ALERT THRESHOLD");
    drawThreshold(4.0, dumpColor, "EXTREME");

    // Fill area above 2.5
    if (maxZ > 2.5) {
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = watchColor;
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(2.5));
      for (let i = 0; i < history.length; i++) {
        const z = Math.max(history[i].zscore, 2.5);
        ctx.lineTo(toX(i), toY(z));
      }
      ctx.lineTo(toX(history.length - 1), toY(2.5));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Z-score line
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = toX(i);
      const y = toY(history[i].zscore);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    // Points with dynamic color
    for (let i = 0; i < history.length; i++) {
      const z = Math.abs(history[i].zscore);
      const color = z > 4 ? dumpColor : z > 3 ? watchColor : z > 2 ? accentColor : mutedColor;
      const x = toX(i);
      const y = toY(history[i].zscore);

      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // X axis labels (abbreviated timestamps)
    ctx.fillStyle = mutedColor;
    ctx.font = "8px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    const labelStep = Math.max(1, Math.floor(history.length / 6));
    for (let i = 0; i < history.length; i += labelStep) {
      const ts = history[i].ts;
      const time = ts.split("T")[1]?.slice(0, 5) || "";
      ctx.fillText(time, toX(i), h - 6);
    }

    // Title
    ctx.fillStyle = mutedColor;
    ctx.font = "10px 'Share Tech Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`$${coin} ANOMALY SCORE`, pl, 14);
  }, [coin, history]);

  return (
    <div className="anomaly-chart-wrap">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "160px", display: "block" }}
      />
      <style jsx>{`
        .anomaly-chart-wrap {
          width: 100%;
          background: transparent;
        }
      `}</style>
    </div>
  );
}
