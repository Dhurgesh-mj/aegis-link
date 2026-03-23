// frontend/components/CorrelationMatrix.tsx
// Aegis-Link — Coin correlation matrix with strong pairs list + optional heatmap

"use client";

import { useState } from "react";
import type { CorrelationMatrix as CorrelationMatrixType } from "@/lib/api";

interface CorrelationMatrixProps {
  matrix: CorrelationMatrixType;
}

function corrColor(r: number): string {
  const abs = Math.abs(r);
  if (r > 0) {
    if (abs > 0.85) return "var(--pump)";
    if (abs > 0.70) return "rgba(0,255,136,0.6)";
    if (abs > 0.30) return "rgba(255,184,0,0.5)";
    return "var(--muted)";
  } else {
    if (abs > 0.70) return "var(--dump)";
    if (abs > 0.30) return "rgba(255,51,85,0.4)";
    return "var(--muted)";
  }
}

function strengthLabel(r: number): string {
  const abs = Math.abs(r);
  if (abs > 0.85) return "STRONG";
  if (abs > 0.70) return "MODERATE";
  return "WEAK";
}

function heatColor(r: number): string {
  if (r >= 0.85) return "rgba(0,255,136,0.5)";
  if (r >= 0.70) return "rgba(0,255,136,0.3)";
  if (r >= 0.30) return "rgba(255,184,0,0.2)";
  if (r >= -0.30) return "rgba(58,74,107,0.2)";
  if (r >= -0.70) return "rgba(255,51,85,0.2)";
  return "rgba(255,51,85,0.4)";
}

export default function CorrelationMatrix({ matrix }: CorrelationMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  if (!matrix || !matrix.coins || matrix.coins.length === 0) {
    return (
      <div className="cm-empty">
        <span>INSUFFICIENT DATA FOR CORRELATION</span>
        <style jsx>{`
          .cm-empty {
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

  const pairs = (matrix.strong_pairs || []).slice(0, 5);
  const showHeatmap = matrix.coins.length <= 8;
  const cellSize = 28;

  return (
    <div className="cm-panel">
      {/* Section 1: Strong Pairs */}
      <div className="cm-section">
        <div className="cm-section-header">CORRELATED COINS</div>
        {pairs.length === 0 ? (
          <div className="cm-no-pairs">No strong correlations detected</div>
        ) : (
          <div className="cm-pairs">
            {pairs.map((p, i) => (
              <div key={i} className="cm-pair-row">
                <span className="cm-pair-coins">
                  ${p.coin_a} ↔ ${p.coin_b}
                </span>
                <div className="cm-pair-bar-wrap">
                  <div
                    className="cm-pair-bar"
                    style={{
                      width: `${Math.abs(p.correlation) * 100}%`,
                      background: p.correlation > 0 ? "var(--pump)" : "var(--dump)",
                    }}
                  />
                </div>
                <span className="cm-pair-val" style={{ color: corrColor(p.correlation) }}>
                  {p.correlation.toFixed(2)}
                </span>
                <span
                  className="cm-pair-strength"
                  style={{ color: corrColor(p.correlation) }}
                >
                  {p.correlation < -0.70 ? "INVERSE" : strengthLabel(p.correlation)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Mini Heatmap */}
      {showHeatmap && matrix.coins.length > 1 && (
        <div className="cm-section">
          <div className="cm-section-header">CORRELATION MATRIX</div>
          <div className="cm-heatmap-wrap">
            <svg
              width={(matrix.coins.length + 1) * cellSize}
              height={(matrix.coins.length + 1) * cellSize}
              className="cm-heatmap"
            >
              {/* Column labels */}
              {matrix.coins.map((coin, i) => (
                <text
                  key={`col-${coin}`}
                  x={(i + 1) * cellSize + cellSize / 2}
                  y={cellSize / 2 + 3}
                  textAnchor="middle"
                  className="cm-hm-label"
                >
                  {coin.slice(0, 4)}
                </text>
              ))}

              {/* Row labels + cells */}
              {matrix.coins.map((coinA, row) => (
                <g key={`row-${coinA}`}>
                  <text
                    x={cellSize / 2}
                    y={(row + 1) * cellSize + cellSize / 2 + 3}
                    textAnchor="middle"
                    className="cm-hm-label"
                  >
                    {coinA.slice(0, 4)}
                  </text>
                  {matrix.coins.map((coinB, col) => {
                    const r = matrix.matrix[coinA]?.[coinB] ?? 0;
                    const cellKey = `${coinA}-${coinB}`;
                    return (
                      <rect
                        key={cellKey}
                        x={(col + 1) * cellSize}
                        y={(row + 1) * cellSize}
                        width={cellSize - 1}
                        height={cellSize - 1}
                        fill={heatColor(r)}
                        stroke={hoveredCell === cellKey ? "var(--accent)" : "var(--border)"}
                        strokeWidth={hoveredCell === cellKey ? 1.5 : 0.5}
                        onMouseEnter={() => setHoveredCell(cellKey)}
                        onMouseLeave={() => setHoveredCell(null)}
                        style={{ cursor: "crosshair" }}
                      >
                        <title>{coinA} / {coinB}: {r.toFixed(3)}</title>
                      </rect>
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      <style jsx>{`
        .cm-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 12px;
        }
        .cm-section-header {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.12em;
          margin-bottom: 8px;
        }
        .cm-no-pairs {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
        }
        .cm-pairs {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cm-pair-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cm-pair-coins {
          font-family: var(--display);
          font-weight: 700;
          font-size: 13px;
          color: var(--text);
          min-width: 100px;
          white-space: nowrap;
        }
        .cm-pair-bar-wrap {
          flex: 1;
          height: 3px;
          background: var(--border);
          min-width: 40px;
        }
        .cm-pair-bar {
          height: 100%;
          transition: width 0.5s;
        }
        .cm-pair-val {
          font-family: var(--mono);
          font-size: 11px;
          min-width: 36px;
          text-align: right;
        }
        .cm-pair-strength {
          font-family: var(--mono);
          font-size: 8px;
          letter-spacing: 0.08em;
          min-width: 60px;
        }

        .cm-heatmap-wrap {
          overflow-x: auto;
        }
        .cm-heatmap {
          display: block;
        }
      `}</style>

      <style jsx global>{`
        .cm-hm-label {
          font-family: var(--mono);
          font-size: 8px;
          fill: var(--muted);
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}
