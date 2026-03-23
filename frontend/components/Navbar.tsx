// frontend/components/Navbar.tsx
// Aegis-Link — Premium Navbar with sweep animation & RGB split logo

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getCurrentUsername, isLoggedIn } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setUsername(getCurrentUsername());
    setMounted(true);
  }, []);

  const handleLogout = () => {
    clearToken();
    router.push("/login");
  };

  const isActive = (path: string) => pathname === path;

  if (!mounted) return null;

  return (
    <nav className="navbar">
      {/* Sweep animation line */}
      <div className="nav-sweep" />

      <div className="navbar-inner">
        {/* Logo */}
        <Link href="/" className="navbar-logo">
          <span className="logo-diamond">◆</span>
          <span className="logo-text">AEGIS-LINK</span>
          <span className="logo-version">v2.1</span>
        </Link>

        {/* Center nav links */}
        <div className="navbar-links">
          {loggedIn ? (
            <>
              <Link
                href="/dashboard"
                className={`nav-link ${isActive("/dashboard") ? "active" : ""}`}
              >
                <span className="nav-link-dot" />
                DASHBOARD
              </Link>
              <Link
                href="/backtest"
                className={`nav-link ${isActive("/backtest") ? "active" : ""}`}
              >
                <span className="nav-link-dot" />
                BACKTEST
              </Link>
              <Link
                href="/campaigns"
                className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}
              >
                <span className="nav-link-dot" />
                CAMPAIGNS
              </Link>
              <Link
                href="/profile"
                className={`nav-link ${isActive("/profile") ? "active" : ""}`}
              >
                <span className="nav-link-dot" />
                PROFILE
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/"
                className={`nav-link ${isActive("/") ? "active" : ""}`}
              >
                <span className="nav-link-dot" />
                HOME
              </Link>
              <Link
                href="/login"
                className={`nav-link ${isActive("/login") ? "active" : ""}`}
              >
                <span className="nav-link-dot" />
                LOGIN
              </Link>
            </>
          )}
        </div>

        {/* Right side */}
        <div className="navbar-right">
          {loggedIn ? (
            <>
              <div className="nav-user-chip">
                <span className="nav-user-dot" />
                <span className="nav-username">{username}</span>
              </div>
              <button onClick={handleLogout} className="nav-logout">
                LOGOUT
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-outline">
              <span className="btn-outline-text">ACCESS SYSTEM</span>
            </Link>
          )}
        </div>
      </div>

      <style jsx>{`
        .navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(4, 5, 10, 0.9);
          backdrop-filter: blur(16px) saturate(1.5);
          border-bottom: 1px solid var(--border);
          padding: 0 24px;
          height: 56px;
          overflow: hidden;
        }

        /* Sweep line at bottom */
        .nav-sweep {
          position: absolute;
          bottom: 0; left: 0;
          width: 100%; height: 1px;
          background: linear-gradient(90deg,
            transparent,
            var(--accent),
            transparent
          );
          background-size: 200% 100%;
          animation: sweepLine 4s linear infinite;
          opacity: 0.4;
        }
        @keyframes sweepLine {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .navbar-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
        }

        /* Logo with RGB split on hover */
        .navbar-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-family: var(--mono);
          font-size: 14px;
          letter-spacing: 0.2em;
          color: var(--accent);
          text-shadow: 0 0 20px rgba(0, 255, 224, 0.5);
          transition: all 0.3s;
        }
        .navbar-logo:hover {
          animation: rgbSplit 0.5s ease;
          text-shadow: 0 0 30px rgba(0, 255, 224, 0.7);
        }
        @keyframes rgbSplit {
          0%, 100% { text-shadow: 0 0 20px rgba(0, 255, 224, 0.5); }
          25% { text-shadow: -2px 0 var(--accent2), 2px 0 var(--accent3), 0 0 20px rgba(0, 255, 224, 0.5); }
          50% { text-shadow: 2px 0 var(--accent2), -2px 0 var(--accent3), 0 0 20px rgba(0, 255, 224, 0.5); }
          75% { text-shadow: -1px 0 var(--accent2), 1px 0 var(--accent3), 0 0 20px rgba(0, 255, 224, 0.5); }
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
        .logo-text { font-weight: 700; }

        .logo-version {
          font-size: 8px;
          color: var(--muted);
          opacity: 0.5;
          letter-spacing: 0.1em;
          margin-top: 2px;
        }

        /* Nav links */
        .navbar-links {
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--mono);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          text-decoration: none;
          transition: all 0.3s;
          padding: 4px 0;
          position: relative;
        }
        .nav-link-dot {
          width: 3px; height: 3px;
          background: var(--muted);
          display: inline-block;
          transition: all 0.3s;
        }
        .nav-link:hover {
          color: var(--text);
        }
        .nav-link:hover .nav-link-dot {
          background: var(--accent);
          box-shadow: 0 0 6px var(--accent);
        }
        .nav-link.active {
          color: var(--accent);
          text-shadow: 0 0 10px rgba(0, 255, 224, 0.3);
        }
        .nav-link.active .nav-link-dot {
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent);
        }
        .nav-link.active::after {
          content: "";
          position: absolute;
          bottom: -2px; left: 0;
          width: 100%; height: 1px;
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent);
        }

        /* Right side */
        .navbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .nav-user-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border: 1px solid var(--border);
          background: rgba(0,255,224,0.03);
        }
        .nav-user-dot {
          width: 4px; height: 4px;
          background: var(--pump);
          box-shadow: 0 0 6px var(--pump);
          display: inline-block;
          animation: blink 2s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .nav-username {
          font-family: var(--mono);
          font-size: 10px;
          color: var(--text);
          letter-spacing: 0.08em;
        }
        .btn-outline {
          position: relative;
          overflow: hidden;
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          border: 1px solid var(--accent);
          padding: 7px 18px;
          text-decoration: none;
          transition: all 0.3s;
        }
        .btn-outline:hover {
          background: var(--accent);
          color: var(--bg);
          box-shadow: 0 0 20px rgba(0, 255, 224, 0.3);
        }
        .nav-logout {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          color: var(--muted);
          background: none;
          border: 1px solid var(--border);
          padding: 5px 12px;
          cursor: crosshair;
          transition: all 0.3s;
        }
        .nav-logout:hover {
          color: var(--accent2);
          border-color: var(--accent2);
          box-shadow: 0 0 12px rgba(255, 45, 107, 0.15);
        }
      `}</style>
    </nav>
  );
}
