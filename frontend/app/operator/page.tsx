// frontend/app/operator/page.tsx
// Aegis-Link — Operator Console (judge "wow moment" page)
// Access via URL only. Not in navbar. Full terminal aesthetic.

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { useOperatorFeed, type OperatorEvent } from "@/lib/websocket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatTime(ts?: string): string {
  if (!ts) return new Date().toLocaleTimeString("en-GB");
  try {
    return new Date(ts).toLocaleTimeString("en-GB");
  } catch {
    return "--:--:--";
  }
}

const SOURCE_COLORS: Record<string, string> = {
  reddit: "#00ffe0",
  telegram: "#7b2fff",
  "4chan": "#ffb800",
  stocktwits: "#c8d6f0",
  cryptopanic: "#3a4a6b",
  coingecko: "#00ff88",
};

function getSourceColor(source: string): string {
  return SOURCE_COLORS[source?.toLowerCase()] || "#3a4a6b";
}

function signalColor(score: number): string {
  if (score >= 72) return "#00ff88";
  if (score < 28) return "#ff3355";
  return "#ffb800";
}

interface HealthData {
  status: string;
  uptime_human: string;
  signals_today: number;
  coins_tracked: number;
  sources: string[];
}

export default function OperatorPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { rawEvents, signals, connected } = useOperatorFeed();
  const [health, setHealth] = useState<HealthData | null>(null);
  const rawScrollRef = useRef<HTMLDivElement>(null);
  const signalScrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) router.push("/login");
  }, [router]);

  // Health polling
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      const data = await res.json();
      setHealth(data);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const iv = setInterval(fetchHealth, 5000);
    return () => clearInterval(iv);
  }, [fetchHealth]);

  // Auto-scroll raw events
  useEffect(() => {
    if (!isPaused && rawScrollRef.current) {
      rawScrollRef.current.scrollTop = rawScrollRef.current.scrollHeight;
    }
  }, [rawEvents, isPaused]);

  // Auto-scroll signals
  useEffect(() => {
    if (signalScrollRef.current) {
      signalScrollRef.current.scrollTop = signalScrollRef.current.scrollHeight;
    }
  }, [signals]);

  if (!mounted) return null;

  return (
    <div className="op-page">
      {/* Operator Header */}
      <div className="op-header">
        <span className="op-title">AEGIS-LINK // OPERATOR CONSOLE</span>
        <span className="op-status">
          <span className={`op-dot ${connected ? "online" : "offline"}`} />
          {connected ? "WS CONNECTED" : "RECONNECTING"}
        </span>
      </div>

      {/* Main */}
      <div className="op-main">
        {/* LEFT — Raw Event Stream */}
        <div className="op-left">
          <div className="op-section-header op-left-header">
            AEGIS:RAW // EVENT STREAM
          </div>
          <div
            className="op-stream"
            ref={rawScrollRef}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {rawEvents.length === 0 && (
              <div className="op-waiting">WAITING FOR EVENTS...</div>
            )}
            {rawEvents.map((evt, i) => {
              const coin = evt.coins?.[0] || "???";
              const source = evt.source || "unknown";
              const text = (evt.text || "").slice(0, 60);
              const ts = formatTime(evt.ts);
              return (
                <div key={i} className="op-raw-line">
                  <span className="op-ts">[{ts}]</span>
                  <span className="op-coin">${coin}</span>
                  <span className="op-source" style={{ color: getSourceColor(source) }}>
                    [{source}]
                  </span>
                  <span className="op-text">{text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Signals + Metrics */}
        <div className="op-right">
          {/* Top 65% — Signal Stream */}
          <div className="op-signals-section">
            <div className="op-section-header">
              AEGIS:SIGNALS // PROCESSED
            </div>
            <div className="op-signal-stream" ref={signalScrollRef}>
              {signals.length === 0 && (
                <div className="op-waiting">AWAITING PROCESSED SIGNALS...</div>
              )}
              {signals.map((sig, i) => {
                const ts = formatTime(sig.ts);
                const isCamp = sig.campaign?.campaign_detected;
                const isAnom = sig.anomaly?.is_anomaly;
                return (
                  <div key={i} className="op-sig-line">
                    <span className="op-ts">[{ts}]</span>
                    <span className="op-sig-coin" style={{ color: signalColor(sig.score) }}>
                      ${sig.coin}
                    </span>
                    <span className="op-sig-score" style={{ color: signalColor(sig.score) }}>
                      {sig.score?.toFixed(1)}
                    </span>
                    <span className="op-sig-type" style={{ color: signalColor(sig.score) }}>
                      {sig.signal}
                    </span>
                    {isCamp && <span className="op-tag op-tag-camp">CAMP</span>}
                    {isAnom && (
                      <span className="op-tag op-tag-anom">
                        {sig.anomaly?.z_score?.toFixed(1)}σ
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom 35% — System Metrics */}
          <div className="op-metrics-section">
            <div className="op-section-header">SYSTEM METRICS</div>
            <div className="op-metrics-grid">
              <div className="op-metric">
                <span className="op-metric-value">
                  {health?.signals_today || 0}
                </span>
                <span className="op-metric-label">EVENTS/MIN</span>
              </div>
              <div className="op-metric">
                <span className="op-metric-value" style={{ color: health?.status === "online" ? "var(--pump)" : "var(--dump)" }}>
                  {health?.status === "online" ? "ONLINE" : "OFFLINE"}
                </span>
                <span className="op-metric-label">OLLAMA STATUS</span>
              </div>
              <div className="op-metric">
                <span className="op-metric-value">
                  {health?.coins_tracked || 0}
                </span>
                <span className="op-metric-label">COINS TRACKED</span>
              </div>
              <div className="op-metric">
                <span className="op-metric-value">
                  {health?.sources?.length || 0}
                </span>
                <span className="op-metric-label">ACTIVE SOURCES</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="op-statusbar">
        <span>OPERATOR MODE // AEGIS-LINK v2</span>
        <span>{health?.uptime_human || "0h 0m"}</span>
        <span>{health?.sources?.length || 0} SOURCES ACTIVE</span>
      </div>

      <style jsx>{`
        .op-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
          color: var(--text);
        }

        /* Header */
        .op-header {
          height: 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .op-title {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 0.2em;
        }
        .op-status {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .op-dot {
          width: 6px;
          height: 6px;
          display: inline-block;
        }
        .op-dot.online {
          background: var(--pump);
          box-shadow: 0 0 8px var(--pump);
          animation: blink 2s infinite;
        }
        .op-dot.offline {
          background: var(--watch);
          animation: blink 0.5s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Main */
        .op-main {
          flex: 1;
          display: flex;
          min-height: 0;
        }

        .op-left {
          flex: 0 0 50%;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border);
          min-height: 0;
        }
        .op-right {
          flex: 0 0 50%;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .op-section-header {
          height: 28px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.12em;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .op-left-header {
          border-right: none;
        }

        /* Raw stream */
        .op-stream {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
          min-height: 0;
        }
        .op-raw-line {
          display: flex;
          gap: 6px;
          padding: 2px 12px;
          font-family: var(--mono);
          font-size: 12px;
          line-height: 1.6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .op-ts {
          color: var(--muted);
          flex-shrink: 0;
        }
        .op-coin {
          color: var(--accent);
          font-weight: 700;
          flex-shrink: 0;
        }
        .op-source {
          flex-shrink: 0;
        }
        .op-text {
          color: var(--text);
          opacity: 0.7;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .op-waiting {
          padding: 24px 12px;
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
          text-align: center;
          opacity: 0.5;
          animation: blink 2s infinite;
        }

        /* Signals section */
        .op-signals-section {
          flex: 0 0 65%;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .op-signal-stream {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
          min-height: 0;
        }
        .op-sig-line {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          height: 28px;
          font-family: var(--mono);
          font-size: 11px;
        }
        .op-sig-coin {
          font-weight: 700;
          flex-shrink: 0;
        }
        .op-sig-score {
          flex-shrink: 0;
          min-width: 36px;
        }
        .op-sig-type {
          flex-shrink: 0;
          min-width: 48px;
          font-size: 10px;
          letter-spacing: 0.08em;
        }
        .op-tag {
          font-size: 8px;
          padding: 1px 5px;
          letter-spacing: 0.08em;
          font-weight: 700;
        }
        .op-tag-camp {
          background: rgba(255,51,85,0.2);
          color: var(--dump);
          border: 1px solid var(--dump);
        }
        .op-tag-anom {
          background: rgba(255,184,0,0.2);
          color: var(--watch);
          border: 1px solid var(--watch);
        }

        /* Metrics */
        .op-metrics-section {
          flex: 0 0 35%;
          display: flex;
          flex-direction: column;
          border-top: 1px solid var(--border);
        }
        .op-metrics-grid {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          padding: 8px;
        }
        .op-metric {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .op-metric-value {
          font-family: var(--display);
          font-weight: 700;
          font-size: 20px;
          color: var(--text);
        }
        .op-metric-label {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.1em;
        }

        /* Status bar */
        .op-statusbar {
          height: 28px;
          border-top: 1px solid var(--border);
          padding: 0 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.08em;
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .op-main { flex-direction: column; }
          .op-left, .op-right { flex: none; min-height: 40vh; }
          .op-left { border-right: none; border-bottom: 1px solid var(--border); }
        }
      `}</style>
    </div>
  );
}
