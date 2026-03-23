// frontend/components/SignalFeed.tsx
// Aegis-Link — Live signal feed with WebSocket connection

"use client";

import { useSignalFeed } from "@/lib/websocket";
import SignalCard from "./SignalCard";

export default function SignalFeed() {
  const { signals, connected } = useSignalFeed();

  return (
    <div className="signal-feed">
      {/* Header bar (32px) */}
      <div className="feed-header">
        <span className="feed-title">LIVE SIGNAL FEED</span>
        <div className="feed-right">
          <span className={`live-dot ${connected ? "live-dot--on" : "live-dot--off"}`} />
          <span className="feed-count">{signals.length} SIGNALS</span>
        </div>
      </div>

      {/* Connection lost banner */}
      {!connected && (
        <div className="feed-disconnected">
          <span className="disconnect-dot" />
          CONNECTION LOST · RECONNECTING
        </div>
      )}

      {/* Signal list */}
      <div className="feed-list">
        {signals.length === 0 ? (
          <div className="feed-empty">
            <span className="empty-text">AWAITING SIGNALS</span>
            <span className="blink-cursor">_</span>
          </div>
        ) : (
          signals.map((signal, index) => (
            <SignalCard
              key={`${signal.coin}-${signal.ts}-${index}`}
              signal={signal}
              isNew={index === 0}
            />
          ))
        )}
      </div>

      <style jsx>{`
        .signal-feed {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .feed-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 32px;
          padding: 0 16px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .feed-title {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.15em;
          color: var(--muted);
        }
        .feed-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .live-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }
        .live-dot--on {
          background: var(--pump);
          box-shadow: 0 0 8px var(--pump);
          animation: pulse 2s infinite;
        }
        .live-dot--off {
          background: var(--dump);
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .feed-count {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--muted);
          letter-spacing: 0.1em;
        }
        .feed-disconnected {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          background: rgba(255, 184, 0, 0.03);
          border-bottom: 1px solid rgba(255, 184, 0, 0.15);
          font-family: var(--mono);
          font-size: 10px;
          color: var(--watch);
          letter-spacing: 0.1em;
          animation: pulse 1.5s infinite;
          flex-shrink: 0;
        }
        .disconnect-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--watch);
        }
        .feed-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .feed-list::-webkit-scrollbar {
          width: 4px;
        }
        .feed-list::-webkit-scrollbar-track {
          background: var(--bg);
        }
        .feed-list::-webkit-scrollbar-thumb {
          background: var(--muted);
        }
        .feed-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 80px 0;
        }
        .empty-text {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 0.2em;
        }
        .blink-cursor {
          font-family: var(--mono);
          font-size: 14px;
          color: var(--accent);
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
