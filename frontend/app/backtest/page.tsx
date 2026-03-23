// frontend/app/backtest/page.tsx
// Aegis-Link — Historical Validation Page (Backtest)

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import BacktestTable from "@/components/BacktestTable";
import { fetchBacktest, fetchBacktestTimeline, type BacktestResult, type BacktestEvent } from "@/lib/api";

export default function BacktestPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [timeline, setTimeline] = useState<BacktestEvent[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Scatter plot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || timeline.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pl = 50, pr = 20, pt = 30, pb = 30;
    const cw = w - pl - pr;
    const ch = h - pt - pb;

    ctx.clearRect(0, 0, w, h);

    // Ranges
    const scores = timeline.map((e) => e.signal_score);
    const gains = timeline.map((e) => e.price_24h_pct);
    const minS = Math.min(...scores) - 5;
    const maxS = Math.max(...scores) + 5;
    const minG = 0;
    const maxG = Math.max(...gains) * 1.1;

    const toX = (s: number) => pl + ((s - minS) / (maxS - minS)) * cw;
    const toY = (g: number) => pt + ch - ((g - minG) / (maxG - minG)) * ch;

    // Grid
    ctx.strokeStyle = "#0f1a2e";
    ctx.lineWidth = 0.5;
    for (let g = 0; g <= maxG; g += 100) {
      const y = toY(g);
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(w - pr, y);
      ctx.stroke();
      ctx.fillStyle = "#3a4a6b";
      ctx.font = "9px 'Share Tech Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${g}%`, pl - 6, y + 3);
    }

    for (let s = Math.ceil(minS / 5) * 5; s <= maxS; s += 5) {
      const x = toX(s);
      ctx.beginPath();
      ctx.moveTo(x, pt);
      ctx.lineTo(x, pt + ch);
      ctx.stroke();
      ctx.fillStyle = "#3a4a6b";
      ctx.textAlign = "center";
      ctx.fillText(`${s}`, x, h - 10);
    }

    // Points
    for (const e of timeline) {
      const x = toX(e.signal_score);
      const y = toY(e.price_24h_pct);
      const color =
        e.price_24h_pct > 200
          ? "#00ff88"
          : e.price_24h_pct > 100
          ? "rgba(0,255,136,0.6)"
          : e.price_24h_pct > 50
          ? "#ffb800"
          : "#ff3355";

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = "#3a4a6b";
      ctx.font = "8px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`$${e.coin}`, x, y - 8);
    }

    // Axis labels
    ctx.fillStyle = "#3a4a6b";
    ctx.font = "9px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("SIGNAL SCORE", pl + cw / 2, h - 2);
    ctx.save();
    ctx.translate(10, pt + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("24H GAIN %", 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = "#3a4a6b";
    ctx.font = "10px 'Share Tech Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("SIGNAL SCORE vs PRICE GAIN", pl, 16);
  }, [timeline]);

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

      {/* Scatter Chart */}
      <div className="bt-chart-section">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "300px", display: "block" }}
        />
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
          background: rgba(8, 12, 20, 0.4);
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
