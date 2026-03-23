// frontend/components/ConfidenceInterval.tsx
// Aegis-Link — Confidence interval visualization from historical pattern matching

"use client";

interface ConfidenceIntervalData {
  min_1h: number | null;
  max_1h: number | null;
  median_1h: number | null;
  min_24h: number | null;
  max_24h: number | null;
  median_24h: number | null;
  sample_size: number;
  avg_lead_minutes: number | null;
  patterns: Array<{
    coin: string;
    date: string;
    event: string;
    signal_score: number;
    price_1h_pct: number;
    price_24h_pct: number;
  }>;
}

interface ConfidenceIntervalProps {
  interval: ConfidenceIntervalData | null;
  signal: string;
}

function RangeBar({
  min,
  max,
  median,
  label,
}: {
  min: number;
  max: number;
  median: number;
  label: string;
}) {
  const overall = Math.max(max * 1.1, 100);
  const minPct = (min / overall) * 100;
  const maxPct = (max / overall) * 100;
  const medPct = (median / overall) * 100;

  return (
    <div className="ci-range">
      <span className="ci-range-label">{label}</span>
      <div className="ci-bar-track">
        <div
          className="ci-bar-fill"
          style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
        />
        <div className="ci-bar-median" style={{ left: `${medPct}%` }} />
      </div>
      <div className="ci-range-nums">
        <span>{min.toFixed(1)}%</span>
        <span>{median.toFixed(1)}%</span>
        <span>{max.toFixed(1)}%</span>
      </div>

      <style jsx>{`
        .ci-range {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ci-range-label {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.1em;
        }
        .ci-bar-track {
          width: 100%;
          height: 6px;
          background: var(--border);
          position: relative;
        }
        .ci-bar-fill {
          position: absolute;
          top: 0;
          height: 100%;
          background: var(--pump);
          opacity: 0.4;
        }
        .ci-bar-median {
          position: absolute;
          top: -2px;
          width: 2px;
          height: 10px;
          background: var(--pump);
        }
        .ci-range-nums {
          display: flex;
          justify-content: space-between;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}

export default function ConfidenceInterval({ interval, signal }: ConfidenceIntervalProps) {
  if (!interval || interval.sample_size === 0) {
    return (
      <div className="ci-empty">
        <span>INSUFFICIENT HISTORICAL DATA</span>
        <style jsx>{`
          .ci-empty {
            font-family: var(--mono);
            font-size: 9px;
            color: var(--muted);
            padding: 16px;
            text-align: center;
            letter-spacing: 0.1em;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="ci-panel">
      <div className="ci-header">
        BASED ON {interval.sample_size} SIMILAR PATTERNS
      </div>

      <div className="ci-ranges">
        {interval.min_1h !== null && interval.max_1h !== null && interval.median_1h !== null && (
          <RangeBar
            min={interval.min_1h}
            max={interval.max_1h}
            median={interval.median_1h}
            label="1 HOUR ESTIMATE"
          />
        )}

        {interval.min_24h !== null && interval.max_24h !== null && interval.median_24h !== null && (
          <RangeBar
            min={interval.min_24h}
            max={interval.max_24h}
            median={interval.median_24h}
            label="24 HOUR ESTIMATE"
          />
        )}
      </div>

      {interval.avg_lead_minutes !== null && (
        <div className="ci-lead">
          Historically ~{interval.avg_lead_minutes.toFixed(0)} minutes before price movement.
        </div>
      )}

      {interval.patterns && interval.patterns.length > 0 && (
        <div className="ci-chips">
          {interval.patterns.map((p, i) => (
            <span key={i} className="ci-chip">
              ${p.coin} · {p.date}
            </span>
          ))}
        </div>
      )}

      <style jsx>{`
        .ci-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
        }
        .ci-header {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--accent);
          letter-spacing: 0.1em;
        }
        .ci-ranges {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ci-lead {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
        }
        .ci-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .ci-chip {
          font-family: var(--mono);
          font-size: 8px;
          padding: 2px 6px;
          background: var(--border);
          color: var(--muted);
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}
