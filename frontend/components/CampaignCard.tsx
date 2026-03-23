// frontend/components/CampaignCard.tsx
// Aegis-Link — Campaign intelligence card with threat level indicators

"use client";

interface Campaign {
  campaign_id: string;
  coin: string;
  confidence: number;
  account_count: number;
  indicators: string[];
  threat_level: string;
  ts: string;
}

interface CampaignCardProps {
  campaign: Campaign;
}

export default function CampaignCard({ campaign }: CampaignCardProps) {
  const { campaign_id, coin, confidence, account_count, indicators, threat_level, ts } = campaign;

  const threatColors: Record<string, { border: string; text: string; bg: string }> = {
    CRITICAL: { border: "var(--dump)", text: "var(--dump)", bg: "rgba(255,51,85,0.12)" },
    HIGH: { border: "var(--dump)", text: "var(--dump)", bg: "transparent" },
    MEDIUM: { border: "var(--watch)", text: "var(--watch)", bg: "transparent" },
    LOW: { border: "var(--muted)", text: "var(--muted)", bg: "transparent" },
  };

  const tc = threatColors[threat_level] || threatColors.LOW;
  const time = ts?.split("T")[1]?.slice(0, 8) || "";

  return (
    <div className="campaign-card">
      <div className="cc-header">
        <span className="cc-id">CAMPAIGN #{campaign_id}</span>
        <span className="cc-badge">{threat_level}</span>
      </div>

      <div className="cc-meta">
        {account_count} accounts · ${coin} · {time}
      </div>

      <div className="cc-indicators">
        {indicators.map((ind) => (
          <span key={ind} className="cc-tag">
            {ind.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <div className="cc-confidence">
        <div className="cc-bar-track">
          <div
            className="cc-bar-fill"
            style={{ width: `${Math.min(confidence * 100, 100)}%` }}
          />
        </div>
        <span className="cc-conf-label">
          CONFIDENCE {(confidence * 100).toFixed(0)}%
        </span>
      </div>

      <style jsx>{`
        .campaign-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid ${tc.border};
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: box-shadow 0.3s;
          ${threat_level === "CRITICAL" ? `box-shadow: -4px 0 20px -4px ${tc.border}40;` : ""}
        }
        .campaign-card:hover {
          border-color: ${tc.border};
        }

        .cc-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cc-id {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--text);
          letter-spacing: 0.05em;
        }
        .cc-badge {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          padding: 2px 8px;
          border: 1px solid ${tc.border};
          color: ${tc.text};
          background: ${tc.bg};
          display: flex;
          align-items: center;
          gap: 5px;
        }
        ${threat_level === "CRITICAL"
          ? `.cc-badge::before {
              content: "";
              width: 5px;
              height: 5px;
              background: var(--dump);
              display: inline-block;
              animation: blink 1s infinite;
            }
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.2; }
            }`
          : ""}

        .cc-meta {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
        }

        .cc-indicators {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .cc-tag {
          font-family: var(--mono);
          font-size: 9px;
          padding: 2px 8px;
          background: var(--border);
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .cc-confidence {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cc-bar-track {
          width: 100%;
          height: 2px;
          background: var(--border);
        }
        .cc-bar-fill {
          height: 100%;
          background: ${tc.border};
          transition: width 0.5s;
        }
        .cc-conf-label {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
