// frontend/app/page.tsx
// Aegis-Link — Premium Visual-First Landing Page
// Particles, glitch hero, holographic cards, animated counters

"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SignalCard from "@/components/SignalCard";

const TICKER_ITEMS = [
  { coin: "PEPE", score: 87.4, signal: "PUMP" },
  { coin: "WIF", score: 22.1, signal: "DUMP" },
  { coin: "BONK", score: 55.3, signal: "WATCH" },
  { coin: "DOGE", score: 61.2, signal: "WATCH" },
  { coin: "SHIB", score: 78.9, signal: "PUMP" },
  { coin: "MOG", score: 91.0, signal: "PUMP" },
  { coin: "BRETT", score: 18.3, signal: "DUMP" },
  { coin: "TURBO", score: 66.7, signal: "WATCH" },
  { coin: "WOJAK", score: 82.4, signal: "PUMP" },
  { coin: "CHAD", score: 45.8, signal: "WATCH" },
  { coin: "COPE", score: 73.1, signal: "PUMP" },
  { coin: "SLERF", score: 15.2, signal: "DUMP" },
  { coin: "NOOT", score: 58.4, signal: "WATCH" },
  { coin: "MEME", score: 69.0, signal: "WATCH" },
  { coin: "FLOKI", score: 34.5, signal: "WATCH" },
];

const HERO_SIGNALS = [
  {
    coin: "PEPE", score: 87.4, signal: "PUMP" as const,
    sentiment: "BULLISH" as const, confidence: 91, velocity_pct: 340,
    volume_spike: 12.4, bot_risk: 0.08,
    explanation: "$PEPE: +340% velocity spike, low bot risk, influencer amplification",
    top_source: "reddit/r/CryptoMoonShots", ts: "2026-03-22T18:00:00Z",
    bot_flags: [], influencer_weight: 76.2, event_count: 42,
  },
  {
    coin: "WOJAK", score: 19.7, signal: "DUMP" as const,
    sentiment: "BEARISH" as const, confidence: 84, velocity_pct: -45,
    volume_spike: 4.8, bot_risk: 0.72,
    explanation: "$WOJAK: coordinated sell pressure, HIGH bot manipulation",
    top_source: "4chan/biz", ts: "2026-03-22T17:58:00Z",
    bot_flags: ["coordinated_spam"], influencer_weight: 42.1, event_count: 18,
  },
  {
    coin: "WIF", score: 81.2, signal: "PUMP" as const,
    sentiment: "BULLISH" as const, confidence: 88, velocity_pct: 210,
    volume_spike: 8.1, bot_risk: 0.12,
    explanation: "$WIF: organic growth from StockTwits + Reddit, clean signal",
    top_source: "stocktwits", ts: "2026-03-22T17:55:00Z",
    bot_flags: [], influencer_weight: 55.0, event_count: 31,
  },
];

function AnimatedCounter({ end, suffix = "" }: { end: string; suffix?: string }) {
  const [display, setDisplay] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const numericPart = parseInt(end.replace(/[^0-9]/g, "")) || 0;
    if (numericPart === 0) { setDisplay(end); return; }

    let start = 0;
    const duration = 1500;
    const startTime = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      start = Math.round(numericPart * eased);
      setDisplay(end.replace(/[0-9]+/, String(start)));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [visible, end]);

  return <span ref={ref}>{display}{suffix}</span>;
}

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Random glitch effect every few seconds
    const glitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 5000);
    return () => clearInterval(glitchInterval);
  }, []);

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "PUMP": return "var(--pump)";
      case "DUMP": return "var(--dump)";
      default: return "var(--watch)";
    }
  };

  return (
    <div className="landing">
      <Navbar />

      {/* ═══ FLOATING PARTICLES ═══ */}
      <div className="particles" aria-hidden="true">
        {mounted && Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${6 + Math.random() * 8}s`,
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
              opacity: 0.1 + Math.random() * 0.3,
            }}
          />
        ))}
      </div>

      {/* ═══ TICKER TAPE ═══ */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="ticker-item">
              <span className="tk-coin">${item.coin}</span>
              <span className="tk-dot">·</span>
              <span className="tk-score">{item.score.toFixed(1)}</span>
              <span className="tk-dot">·</span>
              <span className="tk-dot-indicator" style={{ background: getSignalColor(item.signal), boxShadow: `0 0 6px ${getSignalColor(item.signal)}` }} />
              <span className="tk-signal" style={{ color: getSignalColor(item.signal) }}>{item.signal}</span>
              <span className="tk-border" />
            </span>
          ))}
        </div>
      </div>

      {/* ═══ HERO ═══ */}
      <section className="hero">
        {/* Radial glow backdrop */}
        <div className="hero-glow" />
        <div className="hero-glow-2" />

        <div className={`hero-content ${mounted ? "reveal" : ""}`}>
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            // REAL-TIME THREAT INTELLIGENCE
          </span>

          <h1 className={`hero-h1 ${glitchActive ? "glitch" : ""}`}>
            DETECT<br />
            <span className="glow-accent">INTENT.</span><br />
            BEFORE THE<br />
            <span className="glow-accent2">MARKET.</span>
          </h1>

          <p className="hero-sub">
            Meme coins move on hype. We catch it first.
          </p>

          <div className="hero-btns">
            <Link href="/register" className="btn-filled">
              <span className="btn-text">ACCESS SYSTEM</span>
              <span className="btn-shine" />
            </Link>
            <Link href="/dashboard" className="btn-ghost">LIVE DEMO →</Link>
          </div>

          {/* ═══ FLOATING STAGGERED CARDS ═══ */}
          <div className="floating-cards">
            {HERO_SIGNALS.map((sig, i) => (
              <div
                key={i}
                className={`float-card float-card-${i}`}
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted
                    ? `translateY(${[0, 40, -15][i]}px) rotate(${[-1, 1.5, -0.5][i]}deg)`
                    : "translateY(60px) rotate(0deg)",
                  transitionDelay: `${0.6 + i * 0.2}s`,
                }}
              >
                <SignalCard signal={sig} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="stats-bar">
        {[
          { num: "10k+", label: "EVENTS / SEC" },
          { num: "<30s", label: "ALERT LATENCY" },
          { num: "6", label: "LIVE SOURCES" },
          { num: "24/7", label: "VPS UPTIME" },
        ].map((s, i) => (
          <div key={i} className="stat-cell" style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="stat-num"><AnimatedCounter end={s.num} /></span>
            <span className="stat-lbl">{s.label}</span>
            <div className="stat-line" />
          </div>
        ))}
      </section>

      {/* ═══ FEATURES ═══ */}
      <section className="features">
        <div className="features-grid">
          {[
            { id: "01", title: "Local LLM", desc: "// Ollama on VPS. No API key.", icon: "⧫" },
            { id: "02", title: "Bot Detection", desc: "// Sybil filter. Rug alerts.", icon: "⚡" },
            { id: "03", title: "Instant Alerts", desc: "// Redis pub/sub. Under 5ms.", icon: "◈" },
          ].map((f, i) => (
            <div key={i} className="feat-cell">
              <span className="feat-ghost">{f.id}</span>
              <div className="feat-icon-box">
                <span className="feat-icon">{f.icon}</span>
                <div className="feat-icon-ring" />
              </div>
              <h3 className="feat-title">{f.title}</h3>
              <span className="feat-desc">{f.desc}</span>
              <div className="feat-border-anim" />
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SIGNAL PREVIEW ═══ */}
      <section className="signal-preview">
        <div className="preview-header-line">
          <div className="preview-dot-pulse" />
          <span className="preview-label">LIVE FROM aegis:signals</span>
          <div className="preview-dot-pulse" />
        </div>
        <div className="preview-cards">
          <div className="preview-card pump-glow">
            <SignalCard signal={HERO_SIGNALS[0]} />
          </div>
          <div className="preview-card dump-glow">
            <SignalCard signal={HERO_SIGNALS[1]} />
          </div>
        </div>
        <span className="preview-hint">
          <span className="typing-text">Your Discord pings. Real time. No delay.</span>
          <span className="cursor-blink">▋</span>
        </span>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="cta">
        <div className="cta-glow" />
        <div className="cta-orbit" />
        <h2 className="cta-h2">The market moves in seconds.</h2>
        <p className="cta-sub">Get the intelligence they haven&apos;t calculated yet.</p>
        <Link href="/register" className="btn-filled cta-btn">
          <span className="btn-text">GET EARLY ACCESS</span>
          <span className="btn-shine" />
        </Link>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="foot">
        <span className="foot-logo">◆ AEGIS-LINK</span>
        <div className="foot-status">
          <span className="foot-status-dot" />
          <span>ALL SYSTEMS OPERATIONAL</span>
        </div>
        <span className="foot-right">BUILT FOR DEV HUB 1.0</span>
      </footer>

      <style jsx>{`
        .landing { min-height: 100vh; }

        /* ═══ PARTICLES ═══ */
        .particles {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
          z-index: 1;
          overflow: hidden;
        }
        .particle {
          position: absolute;
          bottom: -10px;
          background: var(--accent);
          border-radius: 50% !important;
          animation: particleRise linear infinite;
        }
        @keyframes particleRise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
        }

        /* ═══ TICKER ═══ */
        .ticker-wrap {
          border-bottom: 1px solid var(--border);
          overflow: hidden;
          background: rgba(4,5,10,0.8);
          backdrop-filter: blur(8px);
          padding: 10px 0;
          position: relative;
        }
        .ticker-wrap::before {
          content: "";
          position: absolute;
          left: 0; top: 0;
          width: 80px; height: 100%;
          background: linear-gradient(90deg, var(--bg), transparent);
          z-index: 2;
          pointer-events: none;
        }
        .ticker-wrap::after {
          content: "";
          position: absolute;
          right: 0; top: 0;
          width: 80px; height: 100%;
          background: linear-gradient(-90deg, var(--bg), transparent);
          z-index: 2;
          pointer-events: none;
        }
        .ticker-track {
          display: flex;
          white-space: nowrap;
          animation: tickerScroll 30s linear infinite;
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 14px;
          font-family: var(--mono);
          font-size: 11px;
        }
        .tk-coin { color: var(--text); font-weight: 700; }
        .tk-dot { color: var(--border); }
        .tk-score { color: var(--muted); }
        .tk-dot-indicator {
          width: 5px; height: 5px;
          display: inline-block;
        }
        .tk-border {
          display: inline-block;
          width: 1px; height: 16px;
          background: var(--border);
          margin-left: 10px;
        }

        /* ═══ HERO ═══ */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 80px 24px 240px;
          position: relative;
          overflow: visible;
        }
        .hero-glow {
          position: absolute;
          top: 20%;
          left: 50%;
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(0,255,224,0.06) 0%, transparent 70%);
          transform: translateX(-50%);
          pointer-events: none;
          animation: float 6s ease-in-out infinite;
        }
        .hero-glow-2 {
          position: absolute;
          top: 30%;
          left: 45%;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(255,45,107,0.04) 0%, transparent 70%);
          transform: translateX(-50%);
          pointer-events: none;
          animation: float 8s ease-in-out infinite reverse;
        }
        .hero-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: 0;
          transform: translateY(30px);
          transition: all 1.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          z-index: 3;
        }
        .hero-content.reveal {
          opacity: 1;
          transform: translateY(0);
        }
        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 0.3em;
          margin-bottom: 32px;
          text-shadow: 0 0 20px rgba(0,255,224,0.3);
          animation: fadeUp 0.8s ease 0.2s both;
        }
        .eyebrow-dot {
          width: 6px; height: 6px;
          background: var(--accent);
          box-shadow: 0 0 12px var(--accent);
          animation: blink 2s infinite;
          display: inline-block;
        }
        .hero-h1 {
          font-family: var(--display);
          font-weight: 800;
          font-size: clamp(60px, 10vw, 120px);
          line-height: 0.85;
          color: var(--text);
          margin-bottom: 32px;
          letter-spacing: -0.03em;
          animation: fadeUp 0.8s ease 0.3s both;
        }
        .hero-h1.glitch {
          animation: glitch 0.2s ease;
        }
        .glow-accent {
          color: var(--accent);
          text-shadow: 0 0 60px rgba(0,255,224,0.5), 0 0 120px rgba(0,255,224,0.15);
        }
        .glow-accent2 {
          color: var(--accent2);
          text-shadow: 0 0 60px rgba(255,45,107,0.5), 0 0 120px rgba(255,45,107,0.15);
        }
        .hero-sub {
          font-family: var(--body);
          font-size: 17px;
          font-weight: 300;
          color: var(--muted);
          margin-bottom: 48px;
          max-width: 400px;
          animation: fadeUp 0.8s ease 0.5s both;
        }
        .hero-btns {
          display: flex;
          gap: 16px;
          margin-bottom: 100px;
          animation: fadeUp 0.8s ease 0.6s both;
        }

        /* ═══ BUTTONS ═══ */
        .btn-filled {
          position: relative;
          overflow: hidden;
          font-family: var(--mono);
          font-weight: 800;
          font-size: 11px;
          letter-spacing: 0.15em;
          background: var(--accent);
          color: var(--bg);
          padding: 16px 32px;
          border: none;
          transition: all 0.3s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }
        .btn-filled:hover {
          box-shadow: 0 0 40px rgba(0,255,224,0.5), 0 0 80px rgba(0,255,224,0.2);
          transform: translateY(-3px);
        }
        .btn-filled:active {
          transform: translateY(0);
        }
        .btn-shine {
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shineSlide 3s ease infinite;
        }
        @keyframes shineSlide {
          0%, 70%, 100% { left: -100%; }
          30% { left: 100%; }
        }
        .btn-text {
          position: relative;
          z-index: 1;
        }
        .btn-ghost {
          font-family: var(--mono);
          font-weight: 800;
          font-size: 11px;
          letter-spacing: 0.15em;
          color: var(--muted);
          border: 1px solid var(--border);
          padding: 16px 32px;
          transition: all 0.3s;
          text-decoration: none;
          position: relative;
        }
        .btn-ghost:hover {
          color: var(--accent);
          border-color: var(--accent);
          background: rgba(0,255,224,0.05);
          box-shadow: 0 0 20px rgba(0,255,224,0.1);
        }

        /* ═══ FLOATING CARDS ═══ */
        .floating-cards {
          position: relative;
          width: 100%;
          max-width: 1100px;
          height: 260px;
        }
        .float-card {
          position: absolute;
          width: 340px;
          transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .float-card-0 {
          left: 5%;
          animation: float 5s ease-in-out infinite;
          animation-delay: 0s;
        }
        .float-card-1 {
          left: 36%;
          animation: float 6s ease-in-out infinite;
          animation-delay: 1s;
        }
        .float-card-2 {
          left: 67%;
          animation: float 5.5s ease-in-out infinite;
          animation-delay: 2s;
        }
        .float-card::before {
          content: "";
          position: absolute;
          inset: -1px;
          background: linear-gradient(135deg, rgba(0,255,224,0.15), transparent 60%);
          z-index: -1;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .float-card:hover::before {
          opacity: 1;
        }

        /* ═══ STATS ═══ */
        .stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: rgba(8,12,20,0.5);
        }
        .stat-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 56px 20px;
          border-right: 1px solid var(--border);
          position: relative;
          overflow: hidden;
          transition: all 0.3s;
        }
        .stat-cell:last-child { border-right: none; }
        .stat-cell:hover {
          background: rgba(0,255,224,0.02);
        }
        .stat-cell:hover .stat-num {
          text-shadow: 0 0 30px rgba(0,255,224,0.3);
        }
        .stat-num {
          font-family: var(--display);
          font-weight: 800;
          font-size: 56px;
          color: var(--text);
          line-height: 1;
          margin-bottom: 12px;
          transition: text-shadow 0.3s;
        }
        .stat-lbl {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.2em;
          color: var(--muted);
        }
        .stat-line {
          position: absolute;
          bottom: 0; left: 50%;
          width: 0; height: 2px;
          background: var(--accent);
          transition: all 0.4s;
          transform: translateX(-50%);
        }
        .stat-cell:hover .stat-line {
          width: 40px;
          box-shadow: 0 0 10px var(--accent);
        }

        /* ═══ FEATURES ═══ */
        .features {
          padding: 120px 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border);
        }
        .feat-cell {
          background: var(--bg);
          padding: 72px 48px;
          position: relative;
          overflow: hidden;
          transition: all 0.4s;
        }
        .feat-cell:hover {
          background: var(--surface);
        }
        .feat-ghost {
          position: absolute;
          top: -15px; right: 10px;
          font-family: var(--display);
          font-weight: 800;
          font-size: 120px;
          color: rgba(15,26,46,0.4);
          line-height: 1;
          pointer-events: none;
          transition: all 0.5s;
        }
        .feat-cell:hover .feat-ghost {
          color: rgba(0,255,224,0.06);
          transform: scale(1.1);
        }
        .feat-icon-box {
          position: relative;
          width: 48px; height: 48px;
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .feat-icon {
          font-size: 20px;
          color: var(--accent);
          position: relative;
          z-index: 2;
        }
        .feat-icon-ring {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(0,255,224,0.15);
          background: rgba(0,255,224,0.03);
          transition: all 0.3s;
        }
        .feat-cell:hover .feat-icon-ring {
          border-color: rgba(0,255,224,0.3);
          box-shadow: 0 0 20px rgba(0,255,224,0.1);
          background: rgba(0,255,224,0.06);
        }
        .feat-title {
          font-family: var(--display);
          font-weight: 700;
          font-size: 28px;
          color: var(--text);
          margin-bottom: 12px;
          position: relative;
          z-index: 1;
        }
        .feat-desc {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--accent);
          letter-spacing: 0.05em;
          position: relative;
          z-index: 1;
        }
        .feat-border-anim {
          position: absolute;
          bottom: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          opacity: 0;
          transition: opacity 0.4s;
        }
        .feat-cell:hover .feat-border-anim {
          opacity: 0.5;
        }

        /* ═══ SIGNAL PREVIEW ═══ */
        .signal-preview {
          padding: 120px 24px;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(8,12,20,0.3) 0%, rgba(4,5,10,0.8) 100%);
        }
        .preview-header-line {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 56px;
        }
        .preview-dot-pulse {
          width: 4px; height: 4px;
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent);
          animation: blink 2s infinite;
        }
        .preview-label {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--accent);
          letter-spacing: 0.4em;
        }
        .preview-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          max-width: 900px;
          margin: 0 auto 40px;
        }
        .preview-card {
          transition: transform 0.3s;
        }
        .preview-card:hover {
          transform: translateY(-4px);
        }
        .pump-glow {
          box-shadow: 0 0 60px rgba(0,255,136,0.08), 0 0 120px rgba(0,255,136,0.03);
        }
        .dump-glow {
          box-shadow: 0 0 60px rgba(255,51,85,0.08), 0 0 120px rgba(255,51,85,0.03);
        }
        .preview-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--muted);
          opacity: 0.6;
        }
        .cursor-blink {
          animation: blink 1s infinite;
          color: var(--accent);
        }

        /* ═══ CTA ═══ */
        .cta {
          padding: 200px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .cta-glow {
          position: absolute;
          top: 50%; left: 50%;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(0,255,224,0.06) 0%, transparent 70%);
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: float 6s ease-in-out infinite;
        }
        .cta-orbit {
          position: absolute;
          top: 50%; left: 50%;
          width: 300px; height: 300px;
          border: 1px solid rgba(0,255,224,0.04);
          transform: translate(-50%, -50%);
          pointer-events: none;
          animation: radarSweep 20s linear infinite;
        }
        .cta-h2 {
          font-family: var(--display);
          font-weight: 800;
          font-size: clamp(36px, 6vw, 80px);
          color: var(--text);
          margin-bottom: 16px;
          position: relative;
          z-index: 1;
        }
        .cta-sub {
          color: var(--muted);
          font-size: 17px;
          font-weight: 300;
          margin-bottom: 48px;
          position: relative;
          z-index: 1;
        }
        .cta-btn {
          padding: 20px 56px;
          font-size: 12px;
          position: relative;
          z-index: 1;
        }

        /* ═══ FOOTER ═══ */
        .foot {
          border-top: 1px solid var(--border);
          padding: 24px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(8,12,20,0.5);
        }
        .foot-logo {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--accent);
          font-weight: 800;
          letter-spacing: 0.2em;
          text-shadow: 0 0 20px rgba(0,255,224,0.3);
        }
        .foot-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--mono);
          font-size: 9px;
          color: var(--pump);
          letter-spacing: 0.15em;
        }
        .foot-status-dot {
          width: 4px; height: 4px;
          background: var(--pump);
          box-shadow: 0 0 8px var(--pump);
          animation: blink 2s infinite;
          display: inline-block;
        }
        .foot-right {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--muted);
        }

        @media (max-width: 768px) {
          .stats-bar { grid-template-columns: repeat(2, 1fr); }
          .features-grid { grid-template-columns: 1fr; }
          .preview-cards { grid-template-columns: 1fr; }
          .floating-cards { height: auto; position: static; }
          .float-card {
            position: static !important;
            width: 100% !important;
            margin-bottom: 16px;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
