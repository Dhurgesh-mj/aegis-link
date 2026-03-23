// frontend/app/campaigns/page.tsx
// Aegis-Link — Campaign Intelligence Page

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import CampaignCard from "@/components/CampaignCard";
import { fetchCampaigns, type Campaign } from "@/lib/api";

type ThreatFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export default function CampaignsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState<ThreatFilter>("ALL");

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) router.push("/login");
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchCampaigns();
      setCampaigns(data);
    } catch (e) {
      console.error("Campaigns load error:", e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = filter === "ALL"
    ? campaigns
    : campaigns.filter((c) => c.threat_level === filter);

  // Sort: CRITICAL first, then by ts desc
  const sorted = [...filtered].sort((a, b) => {
    const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const oa = order[a.threat_level] ?? 4;
    const ob = order[b.threat_level] ?? 4;
    if (oa !== ob) return oa - ob;
    return b.ts.localeCompare(a.ts);
  });

  // Stats
  const totalCampaigns = campaigns.length;
  const criticalHigh = campaigns.filter((c) => c.threat_level === "CRITICAL" || c.threat_level === "HIGH").length;
  const uniqueCoins = new Set(campaigns.map((c) => c.coin)).size;
  const totalAccounts = campaigns.reduce((sum, c) => sum + c.account_count, 0);

  const filters: ThreatFilter[] = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

  if (!mounted) return null;

  return (
    <div className="cp-page">
      <Navbar />

      {/* Header */}
      <div className="cp-header">
        <h1>CAMPAIGN INTELLIGENCE</h1>
        <p>Coordinated manipulation fingerprints.</p>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stats-inner">
          <div className="stat-cell">
            <span className="stat-number" style={{ color: "var(--watch)" }}>{totalCampaigns}</span>
            <span className="stat-label">CAMPAIGNS DETECTED</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell">
            <span className="stat-number" style={{ color: "var(--dump)" }}>{criticalHigh}</span>
            <span className="stat-label">CRITICAL + HIGH</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell">
            <span className="stat-number" style={{ color: "var(--accent)" }}>{uniqueCoins}</span>
            <span className="stat-label">COINS TARGETED</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-cell">
            <span className="stat-number" style={{ color: "var(--text)" }}>{totalAccounts}</span>
            <span className="stat-label">ACCOUNTS FLAGGED</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="cp-filters">
        {filters.map((f) => (
          <button
            key={f}
            className={`cp-pill ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
            data-threat={f}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Campaign Grid */}
      <div className="cp-content">
        {sorted.length === 0 ? (
          <div className="cp-empty">
            <span>NO CAMPAIGNS DETECTED YET</span>
            <span className="cp-empty-sub">System is monitoring...</span>
          </div>
        ) : (
          <div className="cp-grid">
            {sorted.map((c) => (
              <CampaignCard key={c.campaign_id + c.ts} campaign={c} />
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .cp-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--bg);
        }
        .cp-header {
          padding: 32px 24px 16px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }
        .cp-header h1 {
          font-family: var(--display);
          font-weight: 800;
          font-size: 36px;
          color: var(--text);
          margin: 0;
        }
        .cp-header p {
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

        .cp-filters {
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          padding: 16px 24px;
          display: flex;
          gap: 8px;
        }
        .cp-pill {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          padding: 5px 14px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          cursor: crosshair;
          transition: all 0.3s;
        }
        .cp-pill:hover {
          border-color: var(--accent);
          color: var(--text);
        }
        .cp-pill.active[data-threat="ALL"] {
          background: var(--accent);
          color: var(--bg);
          border-color: var(--accent);
        }
        .cp-pill.active[data-threat="CRITICAL"] {
          background: var(--dump);
          color: #fff;
          border-color: var(--dump);
        }
        .cp-pill.active[data-threat="HIGH"] {
          background: rgba(255,51,85,0.2);
          color: var(--dump);
          border-color: var(--dump);
        }
        .cp-pill.active[data-threat="MEDIUM"] {
          background: rgba(255,184,0,0.2);
          color: var(--watch);
          border-color: var(--watch);
        }
        .cp-pill.active[data-threat="LOW"] {
          background: rgba(58,74,107,0.3);
          color: var(--muted);
          border-color: var(--muted);
        }

        .cp-content {
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          padding: 0 24px 48px;
        }
        .cp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .cp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 0;
          gap: 8px;
          font-family: var(--mono);
          color: var(--muted);
          text-align: center;
        }
        .cp-empty span:first-child {
          font-size: 14px;
          letter-spacing: 0.15em;
        }
        .cp-empty-sub {
          font-size: 10px;
          opacity: 0.5;
        }

        @media (max-width: 900px) {
          .cp-grid { grid-template-columns: 1fr; }
          .stats-inner { flex-wrap: wrap; gap: 8px; }
          .stat-cell { flex: 0 0 45%; }
          .stat-divider { display: none; }
          .stats-row { height: auto; padding: 12px 0; }
        }
      `}</style>
    </div>
  );
}
