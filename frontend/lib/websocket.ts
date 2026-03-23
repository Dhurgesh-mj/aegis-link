// frontend/lib/websocket.ts
// Aegis-Link — Live feed: full tracked coin set via /signals + WebSocket upserts

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSignals, type Signal } from "./api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";
/** Room for full TRACKED_COINS list + extras from API */
const MAX_FEED_COINS = 64;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

/** REST poll — same payload as leaderboard (all tickers, real + placeholders) */
const FEED_POLL_MS = Math.max(
  2000,
  parseInt(process.env.NEXT_PUBLIC_FEED_POLL_MS || "3000", 10) || 3000
);

/** Match backend/api.py route_signals sort */
function sortSignalsLikeApi(list: Signal[]): Signal[] {
  return [...list].sort((a, b) => {
    const sb = Number(b.score) || 0;
    const sa = Number(a.score) || 0;
    if (sb !== sa) return sb - sa;
    const ta = a.stale === true ? 1 : 0;
    const tb = b.stale === true ? 1 : 0;
    if (ta !== tb) return ta - tb;
    return (a.coin || "").localeCompare(b.coin || "");
  });
}

function upsertByCoin(prev: Signal[], incoming: Signal): Signal[] {
  const c = (incoming.coin || "").toUpperCase();
  if (!c) return prev;
  const fresh: Signal = { ...incoming, coin: c };
  delete fresh.stale;

  const idx = prev.findIndex((s) => (s.coin || "").toUpperCase() === c);
  let next: Signal[];
  if (idx >= 0) {
    next = [...prev];
    next[idx] = fresh;
  } else {
    next = [...prev, fresh];
  }
  return sortSignalsLikeApi(next).slice(0, MAX_FEED_COINS);
}

interface UseSignalFeedReturn {
  signals: Signal[];
  connected: boolean;
}

export function useSignalFeed(): UseSignalFeedReturn {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        reconnectAttemptRef.current = 0;
        console.log("[aegis-ws] Connected to", WS_URL);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === "keepalive" || data.type === "pong") return;

          if (data.coin) {
            setSignals((prev) => upsertByCoin(prev, data as Signal));
          }
        } catch (err) {
          console.warn("[aegis-ws] Parse error:", err);
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        setConnected(false);
        console.log("[aegis-ws] Disconnected (code:", event.code, ")");

        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
        reconnectAttemptRef.current = attempt + 1;

        console.log(
          `[aegis-ws] Reconnecting in ${delay / 1000}s (attempt ${attempt + 1})`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      };

      ws.onerror = (error) => {
        console.error("[aegis-ws] Error:", error);
      };
    } catch (err) {
      console.error("[aegis-ws] Connection failed:", err);

      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempt), MAX_RECONNECT_DELAY);
      reconnectAttemptRef.current = attempt + 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, delay);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 25000);

    return () => {
      mountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      clearInterval(pingInterval);

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Full universe: same as Coin Leaderboard (/signals)
  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const rows = await getSignals();
        if (cancelled) return;
        setSignals(sortSignalsLikeApi(rows).slice(0, MAX_FEED_COINS));
      } catch {
        /* offline / CORS */
      }
    };

    pull();
    const poll = setInterval(pull, FEED_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  return { signals, connected };
}

// ── v2: Operator Console Feed ───────────────────────────

const OPERATOR_WS_URL =
  process.env.NEXT_PUBLIC_WS_URL?.replace("/ws", "/ws/operator") ||
  "ws://localhost:8000/ws/operator";

const MAX_RAW_EVENTS = 200;
const MAX_SIGNAL_EVENTS = 50;

export interface OperatorEvent {
  source?: string;
  text?: string;
  coins?: string[];
  ts?: string;
  author?: string;
  [key: string]: unknown;
}

interface OperatorSignal {
  coin: string;
  score: number;
  signal: string;
  ts: string;
  anomaly?: { is_anomaly: boolean; z_score: number };
  campaign?: { campaign_detected: boolean; campaign_id: string; account_count: number };
  [key: string]: unknown;
}

interface UseOperatorFeedReturn {
  rawEvents: OperatorEvent[];
  signals: OperatorSignal[];
  connected: boolean;
}

export function useOperatorFeed(): UseOperatorFeedReturn {
  const [rawEvents, setRawEvents] = useState<OperatorEvent[]>([]);
  const [signals, setSignals] = useState<OperatorSignal[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(OPERATOR_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        reconnectAttemptRef.current = 0;
        console.log("[aegis-op-ws] Connected");
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const envelope = JSON.parse(event.data);
          if (envelope.type === "keepalive" || envelope.type === "pong") return;

          if (envelope.type === "raw_event" && envelope.data) {
            setRawEvents((prev) => {
              const next = [...prev, envelope.data as OperatorEvent];
              return next.length > MAX_RAW_EVENTS ? next.slice(-MAX_RAW_EVENTS) : next;
            });
          } else if (envelope.type === "signal" && envelope.data) {
            setSignals((prev) => {
              const next = [...prev, envelope.data as OperatorSignal];
              return next.length > MAX_SIGNAL_EVENTS ? next.slice(-MAX_SIGNAL_EVENTS) : next;
            });
          }
        } catch (err) {
          console.warn("[aegis-op-ws] Parse error:", err);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        reconnectAttemptRef.current = attempt + 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error("[aegis-op-ws] Error:", error);
      };
    } catch (err) {
      console.error("[aegis-op-ws] Connection failed:", err);
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      reconnectAttemptRef.current = attempt + 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 25000);

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { rawEvents, signals, connected };
}
