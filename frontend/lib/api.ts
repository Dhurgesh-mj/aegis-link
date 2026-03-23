// frontend/lib/api.ts
// Aegis-Link — API Client with Axios

import axios from "axios";
import { getToken, clearToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Request Interceptor: attach JWT ────────────────────
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor: handle 401 ───────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ── TypeScript Interfaces ──────────────────────────────

export interface Signal {
  coin: string;
  score: number;
  signal: "PUMP" | "DUMP" | "WATCH";
  confidence: number;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  velocity_pct: number;
  volume_spike: number;
  bot_risk: number;
  bot_flags: string[];
  top_source: string;
  influencer_weight: number;
  explanation: string;
  event_count: number;
  ts: string;
  /** True when no engine output yet — placeholder row */
  stale?: boolean;
}

export interface UserProfile {
  username: string;
  discord_webhook: string;
  telegram_id: string;
  notify_pump: string;
  notify_dump: string;
  notify_watch: string;
  created_at: string;
}

export interface NotificationConfig {
  discord_webhook: string;
  telegram_id: string;
  notify_pump: boolean;
  notify_dump: boolean;
  notify_watch: boolean;
}

export interface ChartPoint {
  ts: string;
  score: number;
  signal: "PUMP" | "DUMP" | "WATCH";
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  velocity_pct: number;
  bot_risk: number;
  volume_spike: number;
  event_count: number;
}

// ── Auth ────────────────────────────────────────────────

export async function login(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  const { data } = await api.post("/auth/login", { username, password });
  return data;
}

export async function register(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  const { data } = await api.post("/auth/register", { username, password });
  return data;
}

// ── User ────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile> {
  const { data } = await api.get("/user/profile");
  return data;
}

export async function updateNotifications(
  config: NotificationConfig
): Promise<void> {
  await api.put("/user/notifications", config);
}

export async function testAlert(): Promise<{ status: string; channels: string[] }> {
  const { data } = await api.post("/user/test-alert");
  return data;
}

// ── Signals ─────────────────────────────────────────────

export async function getSignals(): Promise<Signal[]> {
  const { data } = await api.get("/signals");
  return data;
}

export async function getCoin(ticker: string): Promise<Signal> {
  const { data } = await api.get(`/coin/${ticker}`);
  return data;
}

export async function getHistory(): Promise<Signal[]> {
  const { data } = await api.get("/history");
  return data;
}

export async function getChart(
  ticker: string,
  limit: number = 100
): Promise<{ coin: string; points: ChartPoint[] }> {
  const { data } = await api.get(`/chart/${ticker}`, { params: { limit } });
  return data;
}

export async function getCharts(
  limit: number = 50
): Promise<Record<string, ChartPoint[]>> {
  const { data } = await api.get("/charts", { params: { limit } });
  return data;
}

// ── v2: New Interfaces ──────────────────────────────────

export interface BacktestEvent {
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

export interface BacktestResult {
  total_signals: number;
  correct_calls: number;
  false_positives: number;
  accuracy_pct: number;
  avg_gain_1h: number;
  avg_gain_24h: number;
  avg_lead_minutes: number;
  best_call: BacktestEvent;
  worst_call: BacktestEvent;
  events: BacktestEvent[];
}

export interface Campaign {
  campaign_id: string;
  coin: string;
  confidence: number;
  account_count: number;
  indicators: string[];
  threat_level: string;
  ts: string;
}

export interface AnomalyPoint {
  ts: string;
  count: number;
  zscore: number;
}

export interface OnchainData {
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

export interface ConfidenceInterval {
  min_1h: number | null;
  max_1h: number | null;
  median_1h: number | null;
  min_24h: number | null;
  max_24h: number | null;
  median_24h: number | null;
  sample_size: number;
  avg_lead_minutes: number | null;
  patterns: BacktestEvent[];
}

// ── v2: New API Functions ───────────────────────────────

export async function fetchBacktest(days?: number): Promise<BacktestResult> {
  const { data } = await api.get("/backtest", {
    params: days ? { lookback_days: days } : {},
  });
  return data;
}

export async function fetchBacktestTimeline(): Promise<BacktestEvent[]> {
  const { data } = await api.get("/backtest/timeline");
  return data;
}

export async function fetchCampaigns(limit?: number): Promise<Campaign[]> {
  const { data } = await api.get("/campaigns", {
    params: limit ? { limit } : {},
  });
  return data;
}

export async function fetchCoinCampaigns(coin: string): Promise<Campaign[]> {
  const { data } = await api.get(`/campaigns/${coin}`);
  return data;
}

export async function fetchAnomalyHistory(
  coin: string,
  n?: number
): Promise<{ coin: string; history: AnomalyPoint[] }> {
  const { data } = await api.get(`/anomaly/${coin}`, {
    params: n ? { n } : {},
  });
  return data;
}

export async function fetchOnchain(coin: string): Promise<OnchainData> {
  const { data } = await api.get(`/onchain/${coin}`);
  return data;
}

export async function fetchPatterns(): Promise<BacktestEvent[]> {
  const { data } = await api.get("/patterns");
  return data;
}

export default api;

