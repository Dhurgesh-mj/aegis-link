// frontend/components/HypeScoreBar.tsx
// Aegis-Link — Thin score bar with signal-colored fill

"use client";

import { useEffect, useRef, useState } from "react";

interface HypeScoreBarProps {
  score: number;
  signal: "PUMP" | "DUMP" | "WATCH" | string;
  height?: number;
}

export default function HypeScoreBar({ score, signal, height = 2 }: HypeScoreBarProps) {
  const [mounted, setMounted] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const prevScoreRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const startVal = prevScoreRef.current;
    const endVal = score;
    const duration = 600;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplayScore(Math.round(current));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevScoreRef.current = endVal;
      }
    };

    requestAnimationFrame(animate);
  }, [score, mounted]);

  const fillColor =
    signal === "PUMP"
      ? "var(--pump)"
      : signal === "DUMP"
        ? "var(--dump)"
        : "var(--watch)";

  const glowColor =
    signal === "PUMP"
      ? "rgba(0,255,136,0.4)"
      : signal === "DUMP"
        ? "rgba(255,51,85,0.4)"
        : "rgba(255,184,0,0.4)";

  const pct = Math.min(100, Math.max(0, score));

  return (
    <div className="score-bar-container">
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{
            width: mounted ? `${pct}%` : "0%",
            background: fillColor,
            boxShadow: `0 0 4px ${glowColor}`,
            height: `${height}px`,
          }}
        />
      </div>

      <style jsx>{`
        .score-bar-container {
          width: 100%;
        }
        .score-bar-track {
          width: 100%;
          height: ${height}px;
          background: var(--border);
          position: relative;
          overflow: hidden;
        }
        .score-bar-fill {
          position: absolute;
          top: 0;
          left: 0;
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
