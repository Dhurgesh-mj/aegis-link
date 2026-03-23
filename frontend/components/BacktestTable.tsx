// frontend/components/BacktestTable.tsx
// Aegis-Link — Historical backtest events table

"use client";

interface BacktestEvent {
  coin: string;
  date: string;
  event: string;
  signal_score: number;
  z_score: number;
  bot_risk: number;
  velocity_pct: number;
  minutes_before_pump: number;
  price_1h_pct: number;
  price_24h_pct: number;
  source_mix: string;
}

interface BacktestTableProps {
  events: BacktestEvent[];
  showSummary?: boolean;
}

function signalColor(score: number): string {
  if (score >= 80) return "var(--pump)";
  if (score >= 60) return "var(--watch)";
  return "var(--muted)";
}

function gainColor(pct: number): string {
  if (pct > 100) return "var(--pump)";
  if (pct > 50) return "rgba(0,255,136,0.7)";
  if (pct > 0) return "var(--watch)";
  return "var(--dump)";
}

function rowBg(pct24h: number): string {
  if (pct24h > 300) return "rgba(0,255,136,0.06)";
  if (pct24h > 100) return "rgba(0,255,136,0.03)";
  if (pct24h < 0) return "rgba(255,51,85,0.03)";
  return "transparent";
}

function formatDate(d: string): string {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
}

function botBadge(risk: number) {
  const pct = (risk * 100).toFixed(0);
  const color = risk > 0.5 ? "var(--dump)" : risk > 0.2 ? "var(--watch)" : "var(--pump)";
  return <span style={{ color, fontFamily: "var(--mono)", fontSize: "11px" }}>{pct}%</span>;
}

export default function BacktestTable({ events, showSummary = false }: BacktestTableProps) {
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return (
    <div className="bt-wrap">
      <table className="bt-table">
        <thead>
          <tr>
            <th>DATE</th>
            <th>COIN</th>
            <th>SCORE</th>
            <th>Z-SCORE</th>
            <th>BOT</th>
            <th>LEAD</th>
            <th>1H</th>
            <th>24H</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} style={{ background: rowBg(e.price_24h_pct) }}>
              <td className="bt-date">{formatDate(e.date)}</td>
              <td className="bt-coin">${e.coin}</td>
              <td style={{ color: signalColor(e.signal_score) }}>{e.signal_score.toFixed(1)}</td>
              <td className="bt-zscore">{e.z_score.toFixed(1)}σ</td>
              <td>{botBadge(e.bot_risk)}</td>
              <td className="bt-lead">{e.minutes_before_pump}min</td>
              <td style={{ color: gainColor(e.price_1h_pct) }}>+{e.price_1h_pct.toFixed(1)}%</td>
              <td style={{ color: gainColor(e.price_24h_pct) }}>+{e.price_24h_pct.toFixed(1)}%</td>
            </tr>
          ))}
          {showSummary && events.length > 0 && (
            <tr className="bt-summary">
              <td>AVG</td>
              <td>—</td>
              <td style={{ color: "var(--accent)" }}>
                {avg(events.map((e) => e.signal_score)).toFixed(1)}
              </td>
              <td style={{ color: "var(--accent)" }}>
                {avg(events.map((e) => e.z_score)).toFixed(1)}σ
              </td>
              <td>—</td>
              <td style={{ color: "var(--accent)" }}>
                {avg(events.map((e) => e.minutes_before_pump)).toFixed(0)}min
              </td>
              <td style={{ color: "var(--accent)" }}>
                +{avg(events.map((e) => e.price_1h_pct)).toFixed(1)}%
              </td>
              <td style={{ color: "var(--accent)" }}>
                +{avg(events.map((e) => e.price_24h_pct)).toFixed(1)}%
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <style jsx>{`
        .bt-wrap {
          width: 100%;
          overflow-x: auto;
        }
        .bt-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--mono);
          font-size: 11px;
        }
        .bt-table thead th {
          font-size: 9px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--muted);
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
          font-weight: 400;
        }
        .bt-table tbody tr {
          height: 40px;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s;
        }
        .bt-table tbody tr:hover {
          background: rgba(0, 255, 224, 0.03) !important;
        }
        .bt-table td {
          padding: 0 10px;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text);
        }
        .bt-date {
          color: var(--muted);
        }
        .bt-coin {
          font-family: var(--display);
          font-weight: 700;
          font-size: 13px;
        }
        .bt-zscore {
          color: var(--accent);
        }
        .bt-lead {
          color: var(--muted);
        }
        .bt-summary {
          border-top: 1px solid var(--accent) !important;
        }
        .bt-summary td {
          color: var(--accent);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
