// frontend/app/profile/page.tsx
// Aegis-Link — Profile page with notification settings

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getCurrentUsername } from "@/lib/auth";
import { getProfile, type UserProfile } from "@/lib/api";
import Navbar from "@/components/Navbar";
import NotificationForm from "@/components/NotificationForm";

export default function ProfilePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const username = getCurrentUsername();

  useEffect(() => {
    setMounted(true);
    if (!isLoggedIn()) {
      router.push("/login");
      return;
    }
    loadProfile();
  }, [router]);

  const loadProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  if (!mounted) return null;

  return (
    <div className="profile-page">
      <Navbar />

      <div className="profile-content">
        {/* Account Section */}
        <div className="profile-card">
          <div className="card-header">
            <span className="card-eyebrow">// ANALYST PROFILE</span>
          </div>
          <div className="card-body">
            <div className="profile-username">{username}</div>
            <div className="profile-meta">
              <span className="meta-label">JOINED</span>
              <span className="meta-value">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                  : "..."}
              </span>
            </div>
            <div className="profile-meta">
              <span className="meta-label">STATUS</span>
              <span className="meta-value meta-active">
                <span className="active-dot" />
                ACTIVE
              </span>
            </div>
          </div>
        </div>

        {/* Notification Section */}
        <div className="notification-section">
          <NotificationForm />
        </div>
      </div>

      <style jsx>{`
        .profile-page {
          min-height: 100vh;
          background: var(--bg);
        }
        .profile-content {
          max-width: 700px;
          margin: 40px auto;
          padding: 0 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .profile-card {
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .card-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }
        .card-eyebrow {
          font-family: var(--mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          color: var(--muted);
        }
        .card-body {
          padding: 24px 16px;
        }
        .profile-username {
          font-family: var(--display);
          font-weight: 800;
          font-size: 32px;
          color: var(--text);
          margin-bottom: 16px;
        }
        .profile-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .meta-label {
          font-family: var(--mono);
          font-size: 9px;
          letter-spacing: 0.12em;
          color: var(--muted);
          min-width: 60px;
        }
        .meta-value {
          font-family: var(--mono);
          font-size: 12px;
          color: var(--text);
        }
        .meta-active {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--pump);
        }
        .active-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--pump);
          box-shadow: 0 0 6px var(--pump);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .notification-section {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
