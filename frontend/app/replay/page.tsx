// frontend/app/replay/page.tsx
// Aegis-Link — Pump Replay Simulator
// Uses LIVE signal data from /signals API. Also shows historical patterns as fallback.

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import StrategyBadge from "@/components/StrategyBadge";
import FomoMeter from "@/components/FomoMeter";
import { fetchPatterns, type BacktestEvent, type Signal, type FomoData, type StrategyData } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Unified replay item — works for both live signals and historical patterns
interface ReplayItem {
  coin: string;
  score: number;
  signal: string;
  sentiment: string;
  bot_risk: number;
  velocity_pct: number;
  confidence: number;
  explanation: string;
  top_source: string;
  ts: string;
  fomo: FomoData | null;
  strategy: StrategyData | null;
  // Historical fields (null for live)
  date: string;
  price_24h_pct: number;
  z_score: number;
  minutes_before_pump: number;
  isLive: boolean;
}

function signalToReplay(s: Signal): ReplayItem {
  const raw = s as any;
  return {
    coin: s.coin,
    score: s.score,
    signal: s.signal,
    sentiment: s.sentiment,
    bot_risk: s.bot_risk,
    velocity_pct: s.velocity_pct,
    confidence: s.confidence,
    explanation: s.explanation,
    top_source: s.top_source,
    ts: s.ts,
    fomo: raw.fomo || null,
    strategy: raw.strategy || null,
    date: s.ts?.split("T")[0] || "LIVE",
    price_24h_pct: raw.volume_spike || 0,
    z_score: raw.anomaly?.z_score || 0,
    minutes_before_pump: 0,
    isLive: true,
  };
}

function patternToReplay(p: BacktestEvent): ReplayItem {
  return {
    coin: p.coin,
    score: p.signal_score,
    signal: "PUMP",
    sentiment: "BULLISH",
    bot_risk: p.bot_risk,
    velocity_pct: p.velocity_pct,
    confidence: 80,
    explanation: p.event,
    top_source: p.source_mix?.split("+")[0] || "reddit",
    ts: p.date,
    fomo: { fomo_score: 70, fomo_level: "HIGH", is_fomo_driven: true, raw_velocity: p.velocity_pct, acceleration: 0 },
    strategy: { action: "BUY", reason: "Historical verified pump", confidence: "HIGH", risk: "MEDIUM", color: "pump" },
    date: p.date,
    price_24h_pct: p.price_24h_pct,
    z_score: p.z_score,
    minutes_before_pump: p.minutes_before_pump,
    isLive: false,
  };
}

// Phase generator from replay item
interface Phase {
  start: number; end: number; score: number; signal: string; sentiment: string;
  fomo_level: string; strategy_action: string; velocity_pct: number;
}

function buildPhases(item: ReplayItem): Phase[] {
  const peak = item.score;
  const vel = item.velocity_pct;
  const isDump = item.signal === "DUMP";

  if (isDump) {
    // DUMP: starts stable, then crashes
    return [
      { start: 0,  end: 20, score: Math.round(peak * 0.85), signal: "WATCH",  sentiment: "NEUTRAL",  fomo_level: "LOW",     strategy_action: "WATCH", velocity_pct: Math.round(vel * 0.1) },
      { start: 20, end: 40, score: Math.round(peak * 0.70), signal: "WATCH",  sentiment: "BEARISH",  fomo_level: "MEDIUM",  strategy_action: "WATCH", velocity_pct: Math.round(vel * 0.4) },
      { start: 40, end: 60, score: Math.round(peak * 0.45), signal: "DUMP",   sentiment: "BEARISH",  fomo_level: "HIGH",    strategy_action: item.strategy?.action || "AVOID", velocity_pct: vel },
      { start: 60, end: 80, score: Math.round(peak * 0.20), signal: "DUMP",   sentiment: "BEARISH",  fomo_level: "EXTREME", strategy_action: "AVOID", velocity_pct: Math.round(vel * 1.3) },
      { start: 80, end: 100, score: Math.round(peak * 0.10), signal: "DUMP",  sentiment: "BEARISH",  fomo_level: "HIGH",    strategy_action: "AVOID", velocity_pct: Math.round(vel * 0.8) },
    ];
  }

  // PUMP / WATCH: starts low, builds up
  return [
    { start: 0,  end: 20, score: Math.round(peak * 0.35), signal: "WATCH", sentiment: "NEUTRAL", fomo_level: "LOW",     strategy_action: "WATCH", velocity_pct: Math.round(vel * 0.2) },
    { start: 20, end: 45, score: Math.round(peak * 0.60), signal: "WATCH", sentiment: "BULLISH", fomo_level: "MEDIUM",  strategy_action: "WATCH", velocity_pct: Math.round(vel * 0.5) },
    { start: 45, end: 70, score: peak,                     signal: item.signal, sentiment: "BULLISH", fomo_level: "HIGH",    strategy_action: item.strategy?.action || "BUY", velocity_pct: vel },
    { start: 70, end: 88, score: Math.min(peak + 6, 98),   signal: item.signal, sentiment: "BULLISH", fomo_level: "EXTREME", strategy_action: item.strategy?.action || "BUY", velocity_pct: Math.round(vel * 1.15) },
    { start: 88, end: 100, score: peak,                    signal: item.signal, sentiment: "BULLISH", fomo_level: "HIGH",    strategy_action: "WATCH", velocity_pct: Math.round(vel * 0.7) },
  ];
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function signalColor(sig: string): string {
  if (sig === "PUMP") return "var(--pump)";
  if (sig === "DUMP") return "var(--dump)";
  return "var(--watch)";
}

export default function ReplayPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"live" | "historical">("live");
  const [liveSignals, setLiveSignals] = useState<ReplayItem[]>([]);
  const [histEvents, setHistEvents] = useState<ReplayItem[]>([]);
  const [selected, setSelected] = useState<ReplayItem | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [signalFired, setSignalFired] = useState(false);
  const animRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) router.push("/login");
  }, [router]);

  // Load live signals
  const loadLive = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/signals`);
      const data: Signal[] = await res.json();
      const items = data
        .filter((s) => !s.stale && s.score > 0)
        .map(signalToReplay);
      setLiveSignals(items);
    } catch (e) { console.error("Failed to load live signals:", e); }
  }, []);

  // Load historical patterns
  const loadHist = useCallback(async () => {
    try {
      const data = await fetchPatterns();
      setHistEvents(data.map(patternToReplay));
    } catch (e) { console.error("Failed to load patterns:", e); }
  }, []);

  useEffect(() => {
    loadLive();
    loadHist();
    // Refresh live every 30s
    const iv = setInterval(loadLive, 30000);
    return () => clearInterval(iv);
  }, [loadLive, loadHist]);

  // Animation loop
  useEffect(() => {
    if (!playing || !selected) return;
    const tick = (ts: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = ts;
      const delta = ts - lastTimeRef.current;
      lastTimeRef.current = ts;
      const inc = (delta / 30000) * 100 * speed;
      setProgress((p) => {
        const next = p + inc;
        if (next >= 100) { setPlaying(false); return 100; }
        return next;
      });
      animRef.current = requestAnimationFrame(tick);
    };
    lastTimeRef.current = 0;
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing, selected, speed]);

  // Signal fire flash at 45%
  useEffect(() => {
    if (progress >= 45 && progress < 50 && !signalFired && selected) {
      setSignalFired(true);
      setTimeout(() => setSignalFired(false), 2000);
    }
  }, [progress, signalFired, selected]);

  // Seeded PRNG for per-coin unique chart noise
  const coinSeed = useRef(0);
  useEffect(() => {
    if (!selected) return;
    let s = 0;
    for (let i = 0; i < selected.coin.length; i++) s += selected.coin.charCodeAt(i) * (i + 1);
    coinSeed.current = s;
  }, [selected]);

  const seeded = (i: number) => {
    const x = Math.sin((coinSeed.current + i) * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };

  // Canvas price chart — unique per coin, DUMP = red downfall, PUMP = green rise
  useEffect(() => {
    if (!selected || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);

    const pl = 12, pr = 12, pt = 12, pb = 20;
    const cw = w - pl - pr, ch = h - pt - pb;
    const isDump = selected.signal === "DUMP";
    const lineColor = isDump ? "#ff3355" : "#00ff88";
    const signalPct = isDump ? 0.40 : 0.45; // where signal fires
    const gain = selected.isLive ? selected.score : selected.price_24h_pct;
    const maxY = isDump ? Math.max(gain * 1.4, 20) : Math.max(gain * 1.2, 10);

    // Grid
    ctx.strokeStyle = "#0f1a2e"; ctx.lineWidth = 0.5;
    const gridStep = Math.max(10, Math.round(maxY / 4));
    for (let p = 0; p <= maxY; p += gridStep) {
      const y = pt + ch - (p / maxY) * ch;
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(w - pr, y); ctx.stroke();
      ctx.fillStyle = "#3a4a6b"; ctx.font = "8px 'Share Tech Mono', monospace";
      ctx.textAlign = "right";
      if (isDump) {
        ctx.fillText(`${(maxY - p).toFixed(0)}`, pl - 2, y + 3);
      } else {
        ctx.fillText(selected.isLive ? `${p.toFixed(0)}` : `+${p.toFixed(0)}%`, pl - 2, y + 3);
      }
    }

    // Build unique per-coin noise offsets
    const totalPts = 120;
    const noise: number[] = [];
    for (let i = 0; i < totalPts; i++) {
      noise.push((seeded(i * 3) - 0.5) * 0.12);
    }

    // Price/score line
    ctx.beginPath(); ctx.strokeStyle = lineColor; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
    const visPts = Math.floor((progress / 100) * totalPts);

    for (let i = 0; i <= visPts; i++) {
      const pct = i / totalPts;
      const x = pl + pct * cw;
      let val = 0;

      if (isDump) {
        // DUMP curve: starts high, crashes down
        if (pct < signalPct) {
          // Stable with slight drift down
          val = gain * (0.85 - 0.15 * (pct / signalPct));
        } else {
          // Sharp crash after signal
          const crashT = (pct - signalPct) / (1 - signalPct);
          val = gain * 0.70 * (1 - Math.pow(crashT, 0.55));
        }
      } else {
        // PUMP curve: starts low, ramps up
        if (pct < signalPct) {
          val = gain * 0.2 * (pct / signalPct);
        } else {
          val = gain * 0.2 + (gain * 0.8) * Math.pow((pct - signalPct) / (1 - signalPct), 0.6);
        }
      }

      // Add per-coin noise for uniqueness
      const n = noise[i] || 0;
      val = Math.max(0, val * (1 + n));

      const y = pt + ch - (val / maxY) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glow effect under/over the line
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;

    // Signal fire marker
    if (progress >= signalPct * 100) {
      const sx = pl + signalPct * cw;
      ctx.setLineDash([3, 3]); ctx.strokeStyle = lineColor; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.moveTo(sx, pt); ctx.lineTo(sx, pt + ch); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = lineColor; ctx.font = "8px 'Share Tech Mono', monospace"; ctx.textAlign = "center";
      ctx.fillText(isDump ? "DUMP DETECTED" : "SIGNAL FIRED", sx, h - 4);
    }

    // X axis
    ctx.fillStyle = "#3a4a6b"; ctx.font = "8px 'Share Tech Mono', monospace";
    ctx.textAlign = "left"; ctx.fillText("0", pl, h - 4);
    ctx.textAlign = "center"; ctx.fillText(selected.isLive ? "NOW" : "12h", pl + cw * 0.5, h - 4);
    ctx.textAlign = "right"; ctx.fillText(selected.isLive ? "LIVE" : "24h", w - pr, h - 4);
  }, [selected, progress]);

  // Interpolated phase state
  const getState = () => {
    if (!selected) return null;
    const phases = buildPhases(selected);
    const phase = phases.find((p) => progress >= p.start && progress < p.end) || phases[phases.length - 1];
    const next = phases.find((p) => p.start > phase.start) || phase;
    const t = Math.min((progress - phase.start) / (phase.end - phase.start), 1);
    return {
      score: Math.round(lerp(phase.score, next.score, t)),
      signal: phase.signal,
      sentiment: phase.sentiment,
      bot_risk: selected.bot_risk,
      fomo_level: phase.fomo_level,
      strategy: {
        action: phase.strategy_action,
        reason: phase.strategy_action === "BUY" ? (selected.strategy?.reason || "Signal confirmed")
             : phase.strategy_action === "AVOID" ? "Risk detected" : "Monitoring",
        confidence: phase.strategy_action === "BUY" ? "HIGH" : "LOW",
        risk: phase.strategy_action === "BUY" ? "MEDIUM" : "UNKNOWN",
        color: phase.strategy_action === "BUY" ? "pump" : phase.strategy_action === "AVOID" ? "dump" : "watch",
      },
      velocity_pct: Math.round(lerp(phase.velocity_pct, next.velocity_pct, t)),
      fomo: selected.fomo ? {
        ...selected.fomo,
        fomo_level: phase.fomo_level,
        fomo_score: lerp(20, selected.fomo.fomo_score, Math.min(progress / 70, 1)),
      } : null,
    };
  };

  const handleSelect = (item: ReplayItem) => {
    setSelected(item); setProgress(0); setPlaying(false); setSignalFired(false);
  };
  const handleReset = () => { setProgress(0); setPlaying(false); setSignalFired(false); lastTimeRef.current = 0; };

  if (!mounted) return null;
  const state = getState();
  const displayItems = tab === "live" ? liveSignals : histEvents;

  return (
    <div className="rp-page">
      <Navbar />

      <div className="rp-header">
        <h1>SIGNAL REPLAY</h1>
        <p>{tab === "live" ? "Replay current live signals in real time." : "Replay verified historical pump events."}</p>
      </div>

      {!selected ? (
        <div className="rp-selector">
          {/* Tab switcher */}
          <div className="rp-tabs">
            <button className={`rp-tab ${tab === "live" ? "active" : ""}`} onClick={() => setTab("live")}>
              <span className="rp-live-dot" /> LIVE SIGNALS
            </button>
            <button className={`rp-tab ${tab === "historical" ? "active" : ""}`} onClick={() => setTab("historical")}>
              HISTORICAL
            </button>
          </div>

          {displayItems.length === 0 && (
            <div className="rp-loading">{tab === "live" ? "WAITING FOR LIVE SIGNALS..." : "LOADING HISTORICAL EVENTS..."}</div>
          )}

          <div className="rp-event-grid">
            {displayItems.map((item, i) => (
              <div key={`${item.coin}-${i}`} className="rp-event-card" onClick={() => handleSelect(item)}>
                <div className="rp-ec-top">
                  <span className="rp-ec-coin">${item.coin}</span>
                  <span className="rp-ec-date">
                    {item.isLive && <span className="rp-live-badge">LIVE</span>}
                    {item.date}
                  </span>
                </div>
                <div className="rp-ec-score" style={{ color: signalColor(item.signal) }}>
                  {item.isLive ? item.score.toFixed(0) : `+${item.price_24h_pct.toFixed(0)}%`}
                </div>
                <div className="rp-ec-signal" style={{ borderColor: signalColor(item.signal), color: signalColor(item.signal) }}>
                  {item.signal}
                </div>
                <div className="rp-ec-meta">
                  VEL +{item.velocity_pct}% · BOT {(item.bot_risk * 100).toFixed(0)}%
                  {item.z_score > 0 && ` · ${item.z_score.toFixed(1)}σ`}
                </div>
                <div className="rp-ec-btn">REPLAY →</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rp-replay">
          {signalFired && (
            <div className="rp-flash" style={{ background: selected.signal === "DUMP" ? "rgba(255,51,85,0.08)" : "rgba(0,255,136,0.08)" }}>
              <span style={{ color: signalColor(selected.signal), textShadow: `0 0 40px ${signalColor(selected.signal)}` }}>
                {selected.signal === "DUMP" ? "⚠ DUMP DETECTED" : "⚡ SIGNAL FIRED"}
              </span>
            </div>
          )}

          <div className="rp-replay-content">
            {/* LEFT */}
            <div className="rp-left">
              {state && (
                <div className="rp-signal-card" style={{ "--sc": signalColor(state.signal) } as React.CSSProperties}>
                  <div className="rp-sc-row1">
                    <span className="rp-sc-coin">${selected.coin}</span>
                    <span className="rp-sc-badge" style={{ borderColor: signalColor(state.signal), color: signalColor(state.signal) }}>
                      {state.signal}
                    </span>
                    {selected.isLive && <span className="rp-live-tag">LIVE DATA</span>}
                    <span className="rp-sc-score" style={{ color: signalColor(state.signal) }}>
                      {state.score}
                    </span>
                  </div>
                  <div className="rp-sc-bar-track">
                    <div className="rp-sc-bar-fill" style={{ width: `${state.score}%`, background: signalColor(state.signal) }} />
                  </div>
                  <div className="rp-sc-strategy">
                    <StrategyBadge strategy={state.strategy} showReason />
                  </div>
                  {state.fomo && (
                    <div className="rp-sc-fomo">
                      <FomoMeter fomo={state.fomo as FomoData} compact />
                    </div>
                  )}
                  <div className="rp-sc-meta">
                    <span>SENT: {state.sentiment}</span>
                    <span>VEL: {state.velocity_pct > 0 ? "+" : ""}{state.velocity_pct}%</span>
                    <span>BOT: {(state.bot_risk * 100).toFixed(0)}%</span>
                    <span>SRC: {selected.top_source}</span>
                  </div>
                  {selected.explanation && progress >= 45 && (
                    <div className="rp-sc-expl">{selected.explanation}</div>
                  )}
                </div>
              )}

              {/* Discord embed at signal fire */}
              {progress >= 45 && (
                <div className="rp-discord">
                  <div className="rp-discord-bar" style={{ background: signalColor(selected.signal) }} />
                  <div className="rp-discord-body">
                    <div className="rp-discord-title">🚨 AEGIS-LINK ALERT</div>
                    <div className="rp-discord-field"><span className="rp-dc-label">Coin</span><span className="rp-dc-val">${selected.coin}</span></div>
                    <div className="rp-discord-field"><span className="rp-dc-label">Score</span><span className="rp-dc-val" style={{ color: signalColor(selected.signal) }}>{selected.score.toFixed(1)}</span></div>
                    <div className="rp-discord-field"><span className="rp-dc-label">Signal</span><span className="rp-dc-val" style={{ color: signalColor(selected.signal) }}>{selected.signal}</span></div>
                    <div className="rp-discord-field"><span className="rp-dc-label">Source</span><span className="rp-dc-val">{selected.top_source}</span></div>
                    <div className="rp-discord-footer">{selected.isLive ? "Live alert sent to subscribers" : "Discord alert (historical replay)"}</div>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="rp-controls">
                <div className="rp-slider-track">
                  <div className="rp-slider-fill" style={{ width: `${progress}%` }} />
                  <input type="range" min="0" max="100" step="0.1" value={progress}
                    onChange={(e) => { setProgress(parseFloat(e.target.value)); setPlaying(false); }}
                    className="rp-slider" />
                </div>
                <div className="rp-control-btns">
                  <button className="rp-btn" onClick={() => { lastTimeRef.current = 0; setPlaying(!playing); }}>
                    {playing ? "⏸ PAUSE" : "▶ PLAY"}
                  </button>
                  <button className="rp-btn" onClick={handleReset}>↺ RESET</button>
                  <div className="rp-speed">
                    {[1, 2, 5].map((s) => (
                      <button key={s} className={`rp-speed-btn ${speed === s ? "active" : ""}`} onClick={() => setSpeed(s)}>{s}x</button>
                    ))}
                  </div>
                  <button className="rp-btn rp-btn-back" onClick={() => { setSelected(null); handleReset(); }}>← BACK</button>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="rp-right">
              <canvas ref={canvasRef} style={{ width: "100%", height: "200px", display: "block" }} />

              {progress >= 88 && (
                <div className="rp-outcome">
                  <div className="rp-outcome-coin">${selected.coin} — {selected.isLive ? "LIVE NOW" : selected.date}</div>
                  <div className="rp-outcome-gain" style={{ color: signalColor(selected.signal), textShadow: `0 0 60px ${selected.signal === "DUMP" ? "rgba(255,51,85,0.3)" : "rgba(0,255,136,0.3)"}` }}>
                    {selected.isLive ? `SCORE ${selected.score.toFixed(0)}` : `+${selected.price_24h_pct.toFixed(0)}%`}
                  </div>
                  <div className="rp-outcome-label">
                    {selected.isLive ? "CURRENT LIVE SCORE" : "IN 24 HOURS"}
                  </div>
                  {!selected.isLive && selected.minutes_before_pump > 0 && (
                    <div className="rp-outcome-lead">Signal fired {selected.minutes_before_pump} minutes before peak.</div>
                  )}
                  {selected.isLive && (
                    <div className="rp-outcome-lead">
                      Signal is LIVE — this coin is being actively monitored.
                    </div>
                  )}
                </div>
              )}

              <div className="rp-stats">
                <div className="rp-stat"><span className="rp-stat-key">SCORE</span><span className="rp-stat-val">{selected.score.toFixed(1)}</span></div>
                <div className="rp-stat"><span className="rp-stat-key">Z-SCORE</span><span className="rp-stat-val">{selected.z_score.toFixed(1)}σ</span></div>
                <div className="rp-stat"><span className="rp-stat-key">BOT RISK</span><span className="rp-stat-val">{(selected.bot_risk * 100).toFixed(0)}%</span></div>
                <div className="rp-stat"><span className="rp-stat-key">VELOCITY</span><span className="rp-stat-val">{selected.velocity_pct > 0 ? "+" : ""}{selected.velocity_pct}%</span></div>
                <div className="rp-stat"><span className="rp-stat-key">CONFIDENCE</span><span className="rp-stat-val">{selected.confidence}%</span></div>
                <div className="rp-stat"><span className="rp-stat-key">SOURCE</span><span className="rp-stat-val">{selected.top_source.toUpperCase()}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .rp-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); }
        .rp-header { padding: 32px 24px 16px; max-width: 1400px; margin: 0 auto; width: 100%; }
        .rp-header h1 { font-family: var(--display); font-weight: 800; font-size: 36px; color: var(--text); margin: 0; }
        .rp-header p { font-family: var(--mono); font-size: 12px; color: var(--muted); margin-top: 6px; letter-spacing: 0.05em; }

        /* Tabs */
        .rp-tabs { display: flex; gap: 2px; margin-bottom: 20px; }
        .rp-tab {
          font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em; padding: 8px 20px;
          border: 1px solid var(--border); background: transparent; color: var(--muted);
          cursor: crosshair; transition: all 0.2s; display: flex; align-items: center; gap: 6px;
        }
        .rp-tab.active { background: var(--surface); color: var(--accent); border-color: var(--accent); }
        .rp-tab:hover { border-color: var(--accent); color: var(--text); }
        .rp-live-dot {
          width: 6px; height: 6px; background: var(--pump); display: inline-block;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.3} }

        /* Selector */
        .rp-selector { max-width: 1400px; margin: 0 auto; width: 100%; padding: 0 24px 48px; }
        .rp-loading { font-family: var(--mono); font-size: 11px; color: var(--muted); text-align: center; padding: 48px; letter-spacing: 0.1em; }
        .rp-event-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .rp-event-card {
          background: var(--surface); border: 1px solid var(--border); padding: 16px;
          cursor: crosshair; display: flex; flex-direction: column; gap: 8px;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .rp-event-card:hover { border-color: var(--accent); box-shadow: 0 0 20px rgba(0,255,224,0.05); }
        .rp-ec-top { display: flex; justify-content: space-between; align-items: center; }
        .rp-ec-coin { font-family: var(--display); font-weight: 700; font-size: 18px; color: var(--text); }
        .rp-ec-date { font-family: var(--mono); font-size: 10px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
        .rp-live-badge {
          font-family: var(--mono); font-size: 8px; padding: 1px 6px;
          border: 1px solid var(--pump); color: var(--pump); letter-spacing: 0.08em;
        }
        .rp-ec-score { font-family: var(--display); font-weight: 800; font-size: 28px; }
        .rp-ec-signal {
          font-family: var(--mono); font-size: 9px; letter-spacing: 0.12em;
          padding: 2px 8px; border: 1px solid; width: fit-content;
        }
        .rp-ec-meta { font-family: var(--mono); font-size: 10px; color: var(--muted); }
        .rp-ec-btn { font-family: var(--mono); font-size: 10px; color: var(--accent); letter-spacing: 0.1em; margin-top: auto; }

        /* Replay */
        .rp-replay { flex: 1; max-width: 1400px; margin: 0 auto; width: 100%; padding: 0 24px 48px; position: relative; }
        .rp-flash {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center; justify-content: center;
          z-index: 100; animation: flashFade 2s ease-out forwards; pointer-events: none;
        }
        .rp-flash span {
          font-family: var(--display); font-weight: 800; font-size: 48px;
          animation: flashScale 0.5s ease-out;
        }
        @keyframes flashFade { 0%{opacity:1}70%{opacity:1}100%{opacity:0} }
        @keyframes flashScale { 0%{transform:scale(0.5);opacity:0}100%{transform:scale(1);opacity:1} }

        .rp-replay-content { display: flex; gap: 24px; }
        .rp-left { flex: 0 0 50%; display: flex; flex-direction: column; gap: 16px; }
        .rp-right { flex: 0 0 50%; display: flex; flex-direction: column; gap: 16px; }

        /* Signal card */
        .rp-signal-card {
          background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--sc);
          padding: 16px; display: flex; flex-direction: column; gap: 10px;
        }
        .rp-sc-row1 { display: flex; align-items: center; gap: 10px; }
        .rp-sc-coin { font-family: var(--display); font-weight: 700; font-size: 20px; color: var(--text); }
        .rp-sc-badge { font-family: var(--mono); font-size: 9px; letter-spacing: 0.12em; padding: 2px 8px; border: 1px solid; }
        .rp-live-tag {
          font-family: var(--mono); font-size: 8px; padding: 2px 6px;
          background: rgba(0,255,136,0.1); border: 1px solid var(--pump); color: var(--pump);
          letter-spacing: 0.08em; animation: pulse 1.5s infinite;
        }
        .rp-sc-score { font-family: var(--display); font-weight: 800; font-size: 24px; margin-left: auto; }
        .rp-sc-bar-track { width: 100%; height: 3px; background: var(--border); }
        .rp-sc-bar-fill { height: 100%; transition: width 0.3s; }
        .rp-sc-strategy { margin-top: 4px; }
        .rp-sc-fomo { margin-top: 2px; }
        .rp-sc-meta { display: flex; gap: 12px; font-family: var(--mono); font-size: 10px; color: var(--muted); flex-wrap: wrap; }
        .rp-sc-expl {
          font-family: var(--body); font-size: 11px; color: var(--muted); font-style: italic;
          animation: fadeIn 0.5s ease-out; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }

        /* Discord */
        .rp-discord { display: flex; background: #2b2d31; border: 1px solid #3b3d44; animation: slideIn 0.5s ease-out; }
        @keyframes slideIn { from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1} }
        .rp-discord-bar { width: 4px; flex-shrink: 0; }
        .rp-discord-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
        .rp-discord-title { font-family: var(--display); font-weight: 700; font-size: 14px; color: #f2f3f5; }
        .rp-discord-field { display: flex; gap: 8px; font-size: 12px; }
        .rp-dc-label { font-family: var(--mono); color: #949ba4; font-size: 10px; min-width: 48px; }
        .rp-dc-val { font-family: var(--mono); color: #f2f3f5; font-size: 11px; }
        .rp-discord-footer { font-family: var(--mono); font-size: 9px; color: #949ba4; margin-top: 4px; }

        /* Controls */
        .rp-controls { display: flex; flex-direction: column; gap: 8px; margin-top: auto; }
        .rp-slider-track { position: relative; height: 4px; background: var(--border); }
        .rp-slider-fill { position: absolute; left: 0; top: 0; height: 100%; background: var(--accent); pointer-events: none; }
        .rp-slider {
          position: absolute; top: -6px; left: 0; width: 100%; height: 16px;
          appearance: none; -webkit-appearance: none; background: transparent; cursor: crosshair;
        }
        .rp-slider::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 12px; height: 12px; background: var(--accent); cursor: crosshair; }
        .rp-control-btns { display: flex; align-items: center; gap: 8px; }
        .rp-btn {
          font-family: var(--mono); font-size: 10px; letter-spacing: 0.1em; padding: 6px 14px;
          border: 1px solid var(--border); background: transparent; color: var(--text); cursor: crosshair; transition: all 0.2s;
        }
        .rp-btn:hover { border-color: var(--accent); color: var(--accent); }
        .rp-btn-back { margin-left: auto; color: var(--muted); }
        .rp-speed { display: flex; gap: 2px; }
        .rp-speed-btn {
          font-family: var(--mono); font-size: 9px; padding: 4px 8px;
          border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: crosshair; transition: all 0.2s;
        }
        .rp-speed-btn.active { background: var(--accent); color: var(--bg); border-color: var(--accent); }

        /* Outcome */
        .rp-outcome { text-align: center; padding: 24px; animation: slideIn 0.8s ease-out; }
        .rp-outcome-coin { font-family: var(--mono); font-size: 12px; color: var(--muted); letter-spacing: 0.08em; }
        .rp-outcome-gain { font-family: var(--display); font-weight: 800; font-size: 48px; text-shadow: 0 0 60px rgba(0,255,136,0.3); line-height: 1.1; margin: 8px 0; }
        .rp-outcome-label { font-family: var(--mono); font-size: 11px; color: var(--muted); letter-spacing: 0.15em; }
        .rp-outcome-lead { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-top: 8px; }

        /* Stats */
        .rp-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: var(--surface); border: 1px solid var(--border); padding: 12px; }
        .rp-stat { display: flex; flex-direction: column; gap: 2px; }
        .rp-stat-key { font-family: var(--mono); font-size: 9px; color: var(--muted); letter-spacing: 0.1em; }
        .rp-stat-val { font-family: var(--display); font-weight: 700; font-size: 16px; color: var(--text); }

        @media (max-width: 900px) {
          .rp-replay-content { flex-direction: column; }
          .rp-left, .rp-right { flex: none; }
          .rp-stats { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
