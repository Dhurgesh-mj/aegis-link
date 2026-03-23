// frontend/components/CoinLeaderboard.tsx
// Aegis-Link — Leaderboard table with expandable rows + score trend chart

"use client";

import { Fragment, useEffect, useState } from "react";
import { getSignals, getChart, type ChartPoint, type Signal } from "@/lib/api";
import { formatSentimentLabel } from "@/lib/formatSentiment";
import HypeScoreBar from "./HypeScoreBar";
import BotRiskBadge from "./BotRiskBadge";
import ScoreTrendChart from "./ScoreTrendChart";

export default function CoinLeaderboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");
  const [loading, setLoading] = useState(true);
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  const fetchSignals = async () => {
    try {
      const data = await getSignals();
      const sorted = data.sort((a, b) => b.score - a.score);
      setSignals(sorted);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to fetch signals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadChart = async () => {
      if (!expanded) {
        setChartPoints([]);
        return;
      }

      setChartLoading(true);
      try {
        const data = await getChart(expanded, 288);
        if (cancelled) return;
        setChartPoints(data.points || []);
      } catch {
        if (cancelled) return;
        setChartPoints([]);
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    };

    loadChart();
    return () => {
      cancelled = true;
    };
  }, [expanded]);

  const toggleExpand = (coin: string) => {
    setExpanded(expanded === coin ? null : coin);
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "PUMP": return "var(--pump)";
      case "DUMP": return "var(--dump)";
      default: return "var(--watch)";
    }
  };

  return (
    <div className="leaderboard">
      {/* Header 32px */}
      <div className="lb-header">
        <span className="lb-title">LEADERBOARD</span>
        <span className="lb-updated">{lastUpdate || "..."}</span>
      </div>

      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th className="th-rank">#</th>
              <th className="th-coin">COIN</th>
              <th className="th-score">SCORE</th>
              <th className="th-signal">SIGNAL</th>
              <th className="th-bot">BOT RISK</th>
              <th className="th-time">TIME</th>
            </tr>
          </thead>
          <tbody>
            {loading && signals.length === 0 ? (
              <tr>
                <td colSpan={6} className="lb-loading">
                  LOADING...
                </td>
              </tr>
            ) : signals.length === 0 ? (
              <tr>
                <td colSpan={6} className="lb-empty">
                  NO DATA
                </td>
              </tr>
            ) : (
              signals.map((signal, index) => (
                <Fragment key={signal.coin}>
                  <tr
                    className={`lb-row ${expanded === signal.coin ? "lb-row--expanded" : ""} ${signal.stale ? "lb-row--stale" : ""}`}
                    onClick={() => toggleExpand(signal.coin)}
                  >
                    <td className="lb-rank">{index + 1}</td>
                    <td className="lb-coin">${signal.coin}</td>
                    <td className="lb-score-cell">
                      <div className="lb-score-inner">
                        <div className="lb-score-bar-wrap">
                          <div
                            className="lb-score-bar-fill"
                            style={{
                              width: `${Math.min(100, signal.score)}%`,
                              background: getSignalColor(signal.signal),
                              boxShadow: `0 0 3px ${getSignalColor(signal.signal)}`,
                            }}
                          />
                        </div>
                        <span
                          className="lb-score-num"
                          style={{ color: getSignalColor(signal.signal) }}
                        >
                          {Math.round(signal.score)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="lb-signal-badge"
                        style={{
                          color: getSignalColor(signal.signal),
                          borderColor: getSignalColor(signal.signal),
                        }}
                      >
                        {signal.signal}
                      </span>
                    </td>
                    <td>
                      <BotRiskBadge bot_risk={signal.bot_risk} compact />
                    </td>
                    <td className="lb-time">
                      {signal.ts ? signal.ts.split("T")[1]?.slice(0, 8) : ""}
                    </td>
                  </tr>
                  {expanded === signal.coin && (
                    <tr key={`${signal.coin}-detail`} className="lb-detail-row">
                      <td colSpan={6}>
                        <div className="lb-detail">
                          {/* Score Bar */}
                          <div className="detail-bar">
                            <HypeScoreBar score={signal.score} signal={signal.signal} height={3} />
                          </div>

                          {/* Trend Chart */}
                          <div className="trend-wrap">
                            {chartLoading && expanded === signal.coin ? (
                              <div className="trend-loading">Loading trend…</div>
                            ) : (
                              <ScoreTrendChart points={chartPoints} />
                            )}
                          </div>

                          {/* Detail Grid 2 columns */}
                          <div className="detail-grid">
                            <div className="detail-item">
                              <span className="detail-label">SENTIMENT</span>
                              <span className="detail-value">{formatSentimentLabel(signal.sentiment)}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">VELOCITY</span>
                              <span className="detail-value" style={{
                                color: signal.velocity_pct > 0 ? "var(--pump)"
                                  : signal.velocity_pct < 0 ? "var(--dump)" : "var(--muted)"
                              }}>
                                {signal.velocity_pct > 0 ? "+" : ""}{signal.velocity_pct}%
                              </span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">CONFIDENCE</span>
                              <span className="detail-value">{signal.confidence}%</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">VOL SPIKE</span>
                              <span className="detail-value">{signal.volume_spike}x</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">INFLUENCE</span>
                              <span className="detail-value">{Math.round(signal.influencer_weight)}%</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">SOURCE</span>
                              <span className="detail-value">{signal.top_source}</span>
                            </div>
                          </div>

                          {/* Bot flags */}
                          {signal.bot_flags.length > 0 && (
                            <div className="detail-flags">
                              {signal.bot_flags.map((flag) => (
                                <span key={flag} className="detail-flag">{flag}</span>
                              ))}
                            </div>
                          )}

                          {/* Explanation */}
                          {signal.explanation &&
                            !signal.explanation.toLowerCase().includes("not enough mentions") &&
                            !signal.explanation.toLowerCase().includes("no scored signal yet") && (
                            <p className="detail-explanation">{signal.explanation}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .leaderboard {
          height: 100%;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--border);
        }
        .lb-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 32px;
          padding: 0 16px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .lb-title {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--muted);
        }
        .lb-updated {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
        }
        .lb-table-wrap {
          flex: 1;
          overflow-y: auto;
        }
        .lb-table-wrap::-webkit-scrollbar {
          width: 4px;
        }
        .lb-table-wrap::-webkit-scrollbar-track {
          background: var(--bg);
        }
        .lb-table-wrap::-webkit-scrollbar-thumb {
          background: var(--muted);
        }
        .lb-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--mono);
          font-size: 11px;
        }
        .lb-table thead th {
          position: sticky;
          top: 0;
          background: var(--surface);
          padding: 8px 8px;
          text-align: left;
          font-size: 9px;
          letter-spacing: 0.12em;
          color: var(--muted);
          border-bottom: 1px solid var(--border);
          z-index: 1;
          font-weight: 400;
        }
        .th-rank { width: 32px; text-align: center; }
        .th-coin { width: 90px; }
        .th-score { }
        .th-signal { width: 64px; }
        .th-bot { width: 88px; }
        .th-time { width: 56px; }

        .lb-row {
          cursor: pointer;
          transition: background 0.15s;
          height: 44px;
        }
        .lb-row:hover {
          background: var(--surface);
        }
        .lb-row--stale {
          opacity: 0.55;
        }
        .lb-row--stale:hover {
          opacity: 0.75;
        }
        .lb-row--expanded {
          background: rgba(0, 255, 224, 0.03);
        }
        .lb-row td {
          padding: 8px 8px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
          vertical-align: middle;
        }
        .lb-rank {
          color: var(--muted);
          text-align: center;
          font-size: 10px;
        }
        .lb-coin {
          font-family: var(--display);
          font-weight: 700;
          font-size: 14px;
        }
        .lb-score-cell {
        }
        .lb-score-inner {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .lb-score-bar-wrap {
          flex: 1;
          height: 3px;
          background: var(--border);
          position: relative;
          max-width: 60px;
        }
        .lb-score-bar-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          transition: width 0.4s ease;
        }
        .lb-score-num {
          font-family: var(--display);
          font-weight: 700;
          font-size: 14px;
          min-width: 28px;
          text-align: right;
        }
        .lb-signal-badge {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          padding: 2px 6px;
          border: 1px solid;
        }
        .lb-time {
          color: var(--muted);
          font-size: 9px;
        }
        .lb-loading, .lb-empty {
          text-align: center;
          padding: 40px;
          color: var(--muted);
          letter-spacing: 0.15em;
        }

        /* Expanded detail */
        .lb-detail-row td {
          padding: 0;
          border-bottom: 1px solid var(--border);
        }
        .lb-detail {
          padding: 16px;
          background: rgba(0, 255, 224, 0.015);
          animation: expandIn 0.3s ease;
        }
        @keyframes expandIn {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 600px; }
        }
        .detail-bar {
          margin-bottom: 12px;
        }
        .trend-wrap {
          margin-bottom: 12px;
          padding: 8px 0;
          position: relative;
          overflow: visible;
        }
        .trend-loading {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
          padding: 10px 0;
          letter-spacing: 0.05em;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
          margin-bottom: 12px;
        }
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .detail-label {
          font-family: var(--mono);
          font-size: 8px;
          letter-spacing: 0.12em;
          color: var(--muted);
        }
        .detail-value {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--text);
        }
        .detail-flags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .detail-flag {
          font-family: var(--mono);
          font-size: 8px;
          letter-spacing: 0.1em;
          color: var(--dump);
          border: 1px solid rgba(255, 51, 85, 0.2);
          padding: 2px 6px;
          background: rgba(255, 51, 85, 0.05);
        }
        .detail-explanation {
          font-family: var(--body);
          font-size: 12px;
          color: var(--muted);
          font-style: italic;
          margin: 8px 0 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
