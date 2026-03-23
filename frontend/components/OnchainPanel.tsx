// frontend/components/OnchainPanel.tsx
// Aegis-Link — On-chain data panel from DexScreener

"use client";

interface OnchainData {
  coin: string;
  liquidity_usd: number;
  volume_24h: number;
  price_change_5m: number;
  price_change_1h: number;
  price_change_6h: number;
  txns_buys_24h: number;
  txns_sells_24h: number;
  buy_sell_ratio: number;
  dex: string;
  chain: string;
  ts: string;
}

interface OnchainPanelProps {
  data: OnchainData | null;
  coin: string;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function OnchainPanel({ data, coin }: OnchainPanelProps) {
  if (!data) {
    return (
      <div className="oc-panel oc-loading">
        <div className="oc-shimmer" />
        <span className="oc-loading-text">FETCHING ON-CHAIN DATA...</span>
        <style jsx>{`
          .oc-panel { background: var(--surface); border: 1px solid var(--border); padding: 16px; }
          .oc-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 160px; }
          .oc-shimmer { width: 60%; height: 4px; background: linear-gradient(90deg, var(--border), var(--accent), var(--border)); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
          @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          .oc-loading-text { font-family: var(--mono); font-size: 10px; color: var(--muted); letter-spacing: 0.1em; }
        `}</style>
      </div>
    );
  }

  const bsrColor = data.buy_sell_ratio > 1.5 ? "var(--pump)" : data.buy_sell_ratio < 0.7 ? "var(--dump)" : "var(--watch)";
  const priceColor = data.price_change_1h > 0 ? "var(--pump)" : "var(--dump)";
  const totalTxns = data.txns_buys_24h + data.txns_sells_24h;
  const buyPct = totalTxns > 0 ? (data.txns_buys_24h / totalTxns) * 100 : 50;

  return (
    <div className="oc-panel">
      <div className="oc-header">
        <span>ON-CHAIN // DEXSCREENER</span>
        <span>{data.chain} · {data.dex}</span>
      </div>

      <div className="oc-grid">
        <div className="oc-cell">
          <span className="oc-value" style={{ color: bsrColor }}>{data.buy_sell_ratio.toFixed(2)}</span>
          <span className="oc-label">BUY/SELL RATIO</span>
        </div>
        <div className="oc-cell">
          <span className="oc-value" style={{ color: priceColor }}>{data.price_change_1h > 0 ? "+" : ""}{data.price_change_1h.toFixed(1)}%</span>
          <span className="oc-label">1H CHANGE</span>
        </div>
        <div className="oc-cell">
          <span className="oc-value">{formatNum(data.liquidity_usd)}</span>
          <span className="oc-label">LIQUIDITY USD</span>
        </div>
        <div className="oc-cell">
          <span className="oc-value">{formatNum(data.volume_24h)}</span>
          <span className="oc-label">24H VOLUME</span>
        </div>
      </div>

      <div className="oc-buysell">
        <div className="oc-bs-bar">
          <div className="oc-bs-buy" style={{ width: `${buyPct}%` }} />
          <div className="oc-bs-sell" style={{ width: `${100 - buyPct}%` }} />
        </div>
        <div className="oc-bs-labels">
          <span>BUYS {data.txns_buys_24h.toLocaleString()}</span>
          <span>SELLS {data.txns_sells_24h.toLocaleString()}</span>
        </div>
      </div>

      <style jsx>{`
        .oc-panel {
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .oc-header {
          height: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 12px;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.1em;
          border-bottom: 1px solid var(--border);
        }
        .oc-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }
        .oc-cell {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .oc-value {
          font-family: var(--display);
          font-weight: 700;
          font-size: 20px;
          color: var(--text);
        }
        .oc-label {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          letter-spacing: 0.1em;
        }
        .oc-buysell {
          padding: 8px 12px 12px;
        }
        .oc-bs-bar {
          display: flex;
          height: 4px;
          width: 100%;
          overflow: hidden;
        }
        .oc-bs-buy {
          background: var(--pump);
          height: 100%;
          transition: width 0.5s;
        }
        .oc-bs-sell {
          background: var(--dump);
          height: 100%;
          transition: width 0.5s;
        }
        .oc-bs-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
