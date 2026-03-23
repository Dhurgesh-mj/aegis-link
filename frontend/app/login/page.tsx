// frontend/app/login/page.tsx
// Aegis-Link — Premium split-screen login with animated terminal

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    try {
      const { token } = await login(username.trim(), password);
      saveToken(token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left panel — atmospheric dark panel */}
      <div className="auth-left">
        <div className="left-content">
          <div className="left-logo">
            <span className="logo-diamond">◆</span>
            <span>AEGIS-LINK</span>
          </div>
          <div className="left-quote">
            <span className="quote-mark">&quot;</span>
            The market doesn&apos;t wait<br />for your analysis.
            <span className="quote-mark">&quot;</span>
          </div>
          <div className="left-terminal">
            <div className="term-line"><span className="term-prompt">&gt;</span> connecting to aegis-link...</div>
            <div className="term-line"><span className="term-prompt">&gt;</span> establishing secure channel...</div>
            <div className="term-line term-active"><span className="term-prompt">&gt;</span> awaiting credentials<span className="term-cursor">▋</span></div>
          </div>
        </div>

        {/* Grid pulse overlay */}
        <div className="grid-pulse" />
      </div>

      {/* Right panel — form */}
      <div className="auth-right">
        <div className="auth-card">
          <span className="auth-eyebrow">// AUTHENTICATE</span>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label className="field-label">USERNAME</label>
              <div className="input-wrap">
                <span className="input-prefix">&gt;</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="field-input"
                  autoComplete="username"
                  autoFocus
                  placeholder="operator_id"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">PASSWORD</label>
              <div className="input-wrap">
                <span className="input-prefix">&gt;</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="auth-error"><span className="err-icon">✕</span> {error}</p>}

            <button type="submit" disabled={loading} className="auth-submit">
              <span className="submit-text">
                {loading ? "AUTHENTICATING..." : "AUTHENTICATE →"}
              </span>
              <span className="submit-shine" />
            </button>
          </form>

          <div className="auth-footer">
            <Link href="/register" className="auth-link">
              // NO ACCOUNT? <span className="link-accent">CREATE ONE</span>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 55% 45%;
        }

        /* ── LEFT PANEL ── */
        .auth-left {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px;
          position: relative;
          overflow: hidden;
          border-right: 1px solid var(--border);
        }
        .left-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 48px;
        }
        .left-logo {
          font-family: var(--mono);
          font-size: 14px;
          letter-spacing: 0.25em;
          color: var(--accent);
          text-shadow: 0 0 30px rgba(0,255,224,0.4);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .logo-diamond {
          display: inline-block;
          animation: spin 8s linear infinite;
          font-size: 12px;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .left-quote {
          font-family: var(--display);
          font-weight: 800;
          font-size: clamp(32px, 4vw, 48px);
          line-height: 1.1;
          color: var(--text);
        }
        .quote-mark {
          color: var(--accent);
          opacity: 0.3;
          font-size: 1.5em;
        }
        .left-terminal {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .term-line {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--muted);
          letter-spacing: 0.05em;
        }
        .term-prompt {
          color: var(--accent);
          margin-right: 6px;
        }
        .term-active {
          color: var(--text);
        }
        .term-cursor {
          color: var(--accent);
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .grid-pulse {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,255,224,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,224,0.02) 1px, transparent 1px);
          background-size: 40px 40px;
          animation: gridAnimate 4s ease-in-out infinite;
        }
        @keyframes gridAnimate {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        /* ── RIGHT PANEL ── */
        .auth-right {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 48px;
          background: var(--surface);
        }
        .auth-card {
          width: 100%;
          max-width: 380px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .auth-eyebrow {
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.2em;
          color: var(--muted);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .field-label {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.15em;
          color: var(--muted);
        }
        .input-wrap {
          display: flex;
          align-items: center;
          background: var(--bg);
          border: 1px solid var(--border);
          transition: all 0.3s;
        }
        .input-wrap:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 20px rgba(0,255,224,0.1);
        }
        .input-prefix {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--accent);
          padding-left: 12px;
          opacity: 0.5;
        }
        .field-input {
          background: transparent;
          border: none;
          color: var(--text);
          font-family: var(--mono);
          font-size: 13px;
          letter-spacing: 0.05em;
          padding: 14px 12px;
          outline: none;
          width: 100%;
        }
        .field-input::placeholder {
          color: var(--muted);
          opacity: 0.3;
        }
        .auth-error {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--dump);
          letter-spacing: 0.05em;
          padding: 8px 12px;
          background: rgba(255,51,85,0.06);
          border: 1px solid rgba(255,51,85,0.15);
        }
        .err-icon {
          font-size: 10px;
        }
        .auth-submit {
          position: relative;
          overflow: hidden;
          width: 100%;
          padding: 16px;
          background: var(--accent);
          color: var(--bg);
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          border: none;
          cursor: crosshair;
          transition: all 0.3s;
          font-weight: 700;
        }
        .auth-submit:hover:not(:disabled) {
          box-shadow: 0 0 30px rgba(0,255,224,0.4);
          transform: translateY(-1px);
        }
        .auth-submit:disabled {
          opacity: 0.5;
        }
        .submit-text {
          position: relative;
          z-index: 1;
        }
        .submit-shine {
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shineSlide 3s ease infinite;
        }
        @keyframes shineSlide {
          0%, 70%, 100% { left: -100%; }
          30% { left: 100%; }
        }
        .auth-footer {
          text-align: center;
        }
        .auth-link {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          color: var(--muted);
          text-decoration: none;
          transition: color 0.2s;
        }
        .auth-link:hover {
          color: var(--text);
        }
        .link-accent {
          color: var(--accent);
        }

        @media (max-width: 768px) {
          .auth-page {
            grid-template-columns: 1fr;
          }
          .auth-left {
            display: none;
          }
          .auth-right {
            min-height: 100vh;
          }
        }
      `}</style>
    </div>
  );
}
