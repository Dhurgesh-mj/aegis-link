// frontend/app/register/page.tsx
// Aegis-Link — Registration page

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { token } = await register(username.trim(), password);
      saveToken(token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    if (!password) return null;
    if (password.length < 6) return { label: "WEAK", color: "var(--dump)" };
    if (password.length < 10) return { label: "MODERATE", color: "#f0b429" };
    return { label: "STRONG", color: "var(--pump)" };
  };

  const strength = passwordStrength();

  return (
    <div className="auth-page">
      {/* Scanline overlay */}
      <div className="scanlines" />

      {/* Corner decorations */}
      <div className="corner corner-tl" />
      <div className="corner corner-br" />

      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo-row">
            <span className="auth-logo">
              <span className="logo-diamond">◆</span> AEGIS-LINK
            </span>
            <span className="auth-version">v2.4.1</span>
          </div>
          <span className="auth-eyebrow">// INITIALIZE NEW ANALYST ACCOUNT</span>
          <div className="header-divider" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">

          {/* Username */}
          <div className={`field-group ${focused === "username" ? "field-focused" : ""}`}>
            <div className="field-label-row">
              <label className="field-label">USERNAME</label>
              <span className="field-index">01</span>
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">›</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocused("username")}
                onBlur={() => setFocused(null)}
                className="field-input"
                autoComplete="username"
                autoFocus
                placeholder="analyst_handle"
              />
              {username && <span className="input-check">✓</span>}
            </div>
          </div>

          {/* Password */}
          <div className={`field-group ${focused === "password" ? "field-focused" : ""}`}>
            <div className="field-label-row">
              <label className="field-label">PASSWORD</label>
              <span className="field-index">02</span>
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">›</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                className="field-input"
                autoComplete="new-password"
                placeholder="min. 6 characters"
              />
            </div>
            {strength && (
              <div className="strength-bar-wrap">
                <div
                  className="strength-bar"
                  style={{
                    width: strength.label === "WEAK" ? "33%" : strength.label === "MODERATE" ? "66%" : "100%",
                    background: strength.color,
                  }}
                />
                <span className="strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className={`field-group ${focused === "confirm" ? "field-focused" : ""}`}>
            <div className="field-label-row">
              <label className="field-label">CONFIRM PASSWORD</label>
              <span className="field-index">03</span>
            </div>
            <div className="input-wrapper">
              <span className="input-prefix">›</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setFocused("confirm")}
                onBlur={() => setFocused(null)}
                className="field-input"
                autoComplete="new-password"
                placeholder="repeat password"
              />
              {confirmPassword && password === confirmPassword && (
                <span className="input-check">✓</span>
              )}
              {confirmPassword && password !== confirmPassword && (
                <span className="input-mismatch">✕</span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="auth-error-wrap">
              <span className="error-icon">!</span>
              <p className="auth-error">// {error}</p>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? (
              <span className="loading-text">
                <span className="loading-dot" />
                CREATING ACCOUNT...
              </span>
            ) : (
              "INITIALIZE ACCOUNT →"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <div className="footer-divider" />
          <Link href="/login" className="auth-link">
            // EXISTING ANALYST? ACCESS TERMINAL
          </Link>
        </div>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        /* Scanlines */
        .scanlines {
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 224, 0.015) 2px,
            rgba(0, 255, 224, 0.015) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        /* Corner decorations */
        .corner {
          position: fixed;
          width: 60px;
          height: 60px;
          pointer-events: none;
          z-index: 1;
        }
        .corner-tl {
          top: 24px;
          left: 24px;
          border-top: 1px solid var(--accent);
          border-left: 1px solid var(--accent);
          opacity: 0.4;
        }
        .corner-br {
          bottom: 24px;
          right: 24px;
          border-bottom: 1px solid var(--accent);
          border-right: 1px solid var(--accent);
          opacity: 0.4;
        }

        /* Card */
        .auth-card {
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          position: relative;
          z-index: 2;
        }

        /* Header */
        .auth-header {
          padding: 24px 24px 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .auth-logo-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .auth-logo {
          font-family: var(--mono);
          font-size: 14px;
          letter-spacing: 0.2em;
          color: var(--accent);
          text-shadow: 0 0 20px rgba(0, 255, 224, 0.5);
        }
        .logo-diamond {
          display: inline-block;
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .auth-version {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.1em;
          color: var(--muted);
          opacity: 0.5;
        }
        .auth-eyebrow {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          color: var(--muted);
        }
        .header-divider {
          height: 1px;
          background: linear-gradient(90deg, var(--accent) 0%, transparent 100%);
          opacity: 0.3;
          margin-top: 14px;
        }

        /* Form */
        .auth-form {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: opacity 0.2s;
        }
        .field-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .field-label {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          color: var(--muted);
        }
        .field-index {
          font-family: var(--mono);
          font-size: 9px;
          color: var(--muted);
          opacity: 0.35;
        }
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-prefix {
          position: absolute;
          left: 10px;
          font-family: var(--mono);
          font-size: 14px;
          color: var(--muted);
          pointer-events: none;
          transition: color 0.2s;
        }
        .field-focused .input-prefix {
          color: var(--accent);
        }
        .input-check {
          position: absolute;
          right: 10px;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--pump);
        }
        .input-mismatch {
          position: absolute;
          right: 10px;
          font-family: var(--mono);
          font-size: 11px;
          color: var(--dump);
        }
        .field-input {
          background: var(--bg);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--mono);
          font-size: 13px;
          letter-spacing: 0.05em;
          padding: 12px 32px 12px 26px;
          outline: none;
          transition: all 0.2s;
          width: 100%;
        }
        .field-input::placeholder {
          color: var(--muted);
          opacity: 0.4;
        }
        .field-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 15px rgba(0, 255, 224, 0.12);
        }

        /* Password strength */
        .strength-bar-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
        }
        .strength-bar {
          height: 2px;
          background: var(--accent);
          transition: width 0.3s ease, background 0.3s ease;
          flex-shrink: 0;
        }
        .strength-label {
          font-family: var(--mono);
          font-size: 8px;
          letter-spacing: 0.12em;
        }

        /* Error */
        .auth-error-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid var(--dump);
          background: rgba(255, 59, 48, 0.05);
        }
        .error-icon {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--dump);
          font-weight: 700;
        }
        .auth-error {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--dump);
          letter-spacing: 0.05em;
          margin: 0;
        }

        /* Submit */
        .auth-submit {
          width: 100%;
          padding: 13px;
          background: var(--accent);
          color: var(--bg);
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          border: none;
          cursor: crosshair;
          transition: all 0.2s;
          font-weight: 700;
          margin-top: 4px;
        }
        .auth-submit:hover:not(:disabled) {
          box-shadow: 0 0 28px rgba(0, 255, 224, 0.35);
        }
        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .loading-text {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .loading-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--bg);
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        /* Footer */
        .auth-footer {
          padding: 0 24px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .footer-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, var(--border) 50%, transparent 100%);
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
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}