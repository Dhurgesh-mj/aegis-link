// frontend/app/dashboard/page.tsx
// Aegis-Link — Dashboard page: Stats Row + Signal Feed + Leaderboard + Status Bar

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getCurrentUsername } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import SignalFeed from "@/components/SignalFeed";
import CoinLeaderboard from "@/components/CoinLeaderboard";
import { useSignalFeed } from "@/lib/websocket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DashboardStats {
  signalsToday: number;
  activePump: number;
  activeDump: number;
  botDetections: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { signals, connected } = useSignalFeed();
  const username = getCurrentUsername();
  const [stats, setStats] = useState<DashboardStats>({
    signalsToday: 0,
    activePump: 0,
    activeDump: 0,
    botDetections: 0,
  });
  const [lastSignalTs, setLastSignalTs] = useState("");

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) {
      router.push("/login");
    }
  }, [router]);

  // Derive stats from signals
  const deriveStats = useCallback(() => {
    const pump = signals.filter((s) => s.signal === "PUMP" && !s.stale).length;
    const dump = signals.filter((s) => s.signal === "DUMP" && !s.stale).length;
    const botHigh = signals.filter((s) => s.bot_risk > 0.65).length;
    setStats((prev) => ({
      ...prev,
      activePump: pump,
      activeDump: dump,
      botDetections: botHigh,
    }));
    // Last signal timestamp
    if (signals.length > 0 && signals[0].ts) {
      setLastSignalTs(signals[0].ts.split("T")[1]?.slice(0, 8) || "");
    }
  }, [signals]);

  useEffect(() => {
    deriveStats();
  }, [deriveStats]);

  // Fetch signals_today from /health
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/health`);
      const data = await res.json();
      setStats((prev) => ({
        ...prev,
        signalsToday: data.signals_today || 0,
      }));
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const iv = setInterval(fetchHealth, 30000);
    return () => clearInterval(iv);
  }, [fetchHealth]);

  if (!mounted) return null;

  return (
    <div className="dashboard">
      <Navbar />

      {/* ── Stats Row ─────────────────────────────── */}
      <div className="stats-row">
        <div className="stats-inner">
          <div className="stat-cell">
            <span className="stat-number stat-accent">{stats.signalsToday}</span>
            <span className="stat-label">SIGNALS TODAY</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell">
            <span className="stat-number stat-pump">{stats.activePump}</span>
            <span className="stat-label">ACTIVE PUMP</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell">
            <span className="stat-number stat-dump">{stats.activeDump}</span>
            <span className="stat-label">ACTIVE DUMP</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell">
            <span className="stat-number stat-watch">{stats.botDetections}</span>
            <span className="stat-label">BOT DETECTIONS</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────── */}
      <div className="dashboard-content">
        <div className="panel-left">
          <SignalFeed />
        </div>
        <div className="panel-right">
          <CoinLeaderboard />
        </div>
      </div>

      {/* ── Status Bar (bottom, 32px) ─────────────── */}
      <div className="status-bar-bottom">
        <span className="status-bottom-left">
          <span className="status-dot-sm status-dot-sm--green" />
          ENGINE ONLINE
        </span>
        <span className="status-bottom-center">
          LAST SIGNAL: {lastSignalTs || "—"}
        </span>
        <span className="status-bottom-right">
          <span
            className={`status-dot-sm ${
              connected ? "status-dot-sm--green" : "status-dot-sm--yellow"
            }`}
          />
          WS: {connected ? "ACTIVE" : "RECONNECTING"}
        </span>
      </div>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }

        /* ── Stats Row ── */
        .stats-row {
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
        .stat-accent { color: var(--accent); }
        .stat-pump { color: var(--pump); }
        .stat-dump { color: var(--dump); }
        .stat-watch { color: var(--watch); }
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

        /* ── Main Layout ── */
        .dashboard-content {
          flex: 1;
          display: flex;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          min-height: 0;
        }
        .panel-left {
          flex: 0 0 60%;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 210px);
        }
        .panel-right {
          flex: 0 0 40%;
          display: flex;
          flex-direction: column;
          min-height: calc(100vh - 210px);
        }

        /* ── Status Bar ── */
        .status-bar-bottom {
          height: 32px;
          border-top: 1px solid var(--border);
          padding: 0 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(8, 12, 20, 0.5);
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          color: var(--muted);
          flex-shrink: 0;
        }
        .status-bottom-left {
          color: var(--pump);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-bottom-center {
          color: var(--muted);
        }
        .status-bottom-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-dot-sm {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-dot-sm--green {
          background: var(--pump);
          box-shadow: 0 0 6px var(--pump);
          animation: pulse 2s infinite;
        }
        .status-dot-sm--yellow {
          background: var(--watch);
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @media (max-width: 900px) {
          .dashboard-content {
            flex-direction: column;
          }
          .panel-left, .panel-right {
            flex: none;
            min-height: 50vh;
          }
          .panel-left {
            border-right: none;
            border-bottom: 1px solid var(--border);
          }
          .stats-inner {
            flex-wrap: wrap;
            gap: 8px;
          }
          .stat-cell {
            flex: 0 0 45%;
          }
          .stat-divider {
            display: none;
          }
          .stats-row {
            height: auto;
            padding: 12px 0;
          }
        }
      `}</style>
    </div>
  );
}
