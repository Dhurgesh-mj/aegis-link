// frontend/components/NotificationForm.tsx
// Aegis-Link — Notification configuration form

"use client";

import { useState, useEffect } from "react";
import { getProfile, updateNotifications, testAlert, type UserProfile } from "@/lib/api";

export default function NotificationForm() {
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [notifyPump, setNotifyPump] = useState(true);
  const [notifyDump, setNotifyDump] = useState(false);
  const [notifyWatch, setNotifyWatch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profile = await getProfile();
      setDiscordWebhook(profile.discord_webhook || "");
      setTelegramId(profile.telegram_id || "");
      setNotifyPump(profile.notify_pump === "true");
      setNotifyDump(profile.notify_dump === "true");
      setNotifyWatch(profile.notify_watch === "true");
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess(false);

    // Validation
    if (discordWebhook && !discordWebhook.startsWith("https://discord.com/api/webhooks/")) {
      setError("Discord webhook must start with https://discord.com/api/webhooks/");
      return;
    }

    if (telegramId && !telegramId.startsWith("@") && !/^\d+$/.test(telegramId)) {
      setError("Telegram ID must start with @ or be numeric");
      return;
    }

    setSaving(true);
    try {
      await updateNotifications({
        discord_webhook: discordWebhook,
        telegram_id: telegramId,
        notify_pump: notifyPump,
        notify_dump: notifyDump,
        notify_watch: notifyWatch,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSignal = async () => {
    setTesting(true);
    setTestSent(false);
    try {
      const result = await testAlert();
      if (result.channels.length > 0) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 2000);
      }
    } catch (err) {
      console.error("Test alert failed:", err);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="notif-form">
      <div className="form-header">
        <span className="form-title">SIGNAL ROUTING CONFIGURATION</span>
      </div>

      <div className="form-body">
        {/* Discord Webhook */}
        <div className="field-group">
          <label className="field-label">DISCORD WEBHOOK URL</label>
          <input
            type="url"
            value={discordWebhook}
            onChange={(e) => setDiscordWebhook(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="field-input"
          />
          <button
            onClick={handleTestSignal}
            disabled={testing}
            className="btn-test"
          >
            {testSent ? "SENT ✓" : testing ? "TESTING..." : "TEST SIGNAL →"}
          </button>
        </div>

        {/* Telegram Chat ID */}
        <div className="field-group">
          <label className="field-label">TELEGRAM CHAT ID</label>
          <input
            type="text"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="@username or numeric ID"
            className="field-input"
          />
          <p className="field-hint">
            Open your bot in Telegram, send <code>/start</code> — the backend bot
            replies with your numeric chat ID (run{" "}
            <code>telegram_chat_bot.py</code> or <code>start-dev.sh</code> with{" "}
            <code>TELEGRAM_BOT_TOKEN</code> set).
          </p>
        </div>

        {/* Signal Toggles */}
        <div className="toggle-section">
          <div className="toggle-row">
            <span className="toggle-label" style={{ color: "var(--pump)" }}>
              PUMP SIGNALS
            </span>
            <button
              className={`toggle-switch ${notifyPump ? "toggle-on" : ""}`}
              onClick={() => setNotifyPump(!notifyPump)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          <div className="toggle-row">
            <span className="toggle-label" style={{ color: "var(--dump)" }}>
              DUMP SIGNALS
            </span>
            <button
              className={`toggle-switch ${notifyDump ? "toggle-on" : ""}`}
              onClick={() => setNotifyDump(!notifyDump)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          <div className="toggle-row">
            <span className="toggle-label" style={{ color: "var(--watch)" }}>
              WATCH SIGNALS
            </span>
            <button
              className={`toggle-switch ${notifyWatch ? "toggle-on" : ""}`}
              onClick={() => setNotifyWatch(!notifyWatch)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && <p className="form-error">// ERROR: {error}</p>}

        {/* Success */}
        {success && (
          <p className="form-success">// CONFIGURATION SAVED</p>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-save"
        >
          {saving ? "SAVING..." : "SAVE CONFIGURATION →"}
        </button>
      </div>

      <style jsx>{`
        .notif-form {
          border: 1px solid var(--border);
          background: var(--surface);
        }
        .form-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .form-title {
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          color: var(--text);
        }
        .form-body {
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field-label {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          color: var(--muted);
        }
        .field-input {
          background: var(--bg);
          border: 1px solid var(--border);
          color: var(--text);
          font-family: var(--mono);
          font-size: 12px;
          letter-spacing: 0.05em;
          padding: 10px 12px;
          outline: none;
          transition: all 0.2s;
          width: 100%;
        }
        .field-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 12px rgba(0, 255, 224, 0.15);
        }
        .field-input::placeholder {
          color: var(--muted);
          opacity: 0.5;
        }
        .field-hint {
          font-family: var(--mono);
          font-size: 9px;
          line-height: 1.5;
          color: var(--muted);
          letter-spacing: 0.04em;
          margin: 0;
          max-width: 520px;
        }
        .field-hint code {
          color: var(--accent);
          font-size: inherit;
        }
        .btn-test {
          align-self: flex-start;
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.1em;
          color: var(--accent);
          background: none;
          border: 1px solid var(--accent);
          padding: 4px 12px;
          cursor: crosshair;
          transition: all 0.2s;
        }
        .btn-test:hover:not(:disabled) {
          background: var(--accent);
          color: var(--bg);
        }
        .btn-test:disabled {
          opacity: 0.5;
        }
        .toggle-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .toggle-label {
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.1em;
        }
        .toggle-switch {
          position: relative;
          width: 40px;
          height: 18px;
          background: var(--border);
          border: 1px solid var(--muted);
          cursor: crosshair;
          padding: 0;
          transition: all 0.3s;
        }
        .toggle-switch.toggle-on {
          background: var(--accent);
          border-color: var(--accent);
        }
        .toggle-thumb {
          position: absolute;
          top: 1px;
          left: 1px;
          width: 14px;
          height: 14px;
          background: var(--bg);
          transition: transform 0.3s;
        }
        .toggle-switch.toggle-on .toggle-thumb {
          transform: translateX(22px);
        }
        .form-error {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--dump);
          letter-spacing: 0.05em;
        }
        .form-success {
          font-family: var(--mono);
          font-size: 11px;
          color: var(--pump);
          letter-spacing: 0.05em;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .btn-save {
          width: 100%;
          padding: 12px;
          background: var(--accent);
          color: var(--bg);
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          border: none;
          cursor: crosshair;
          transition: all 0.2s;
          font-weight: 600;
        }
        .btn-save:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(0, 255, 224, 0.3);
        }
        .btn-save:disabled {
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
