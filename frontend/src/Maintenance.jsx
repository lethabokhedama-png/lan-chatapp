import React, { useEffect, useState } from "react";

const BASE = () => import.meta.env.VITE_API_URL || "";

export default function Maintenance() {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    // Animate dots
    const d = setInterval(() => setDots(x => (x + 1) % 4), 600);

    // Poll every 5s — auto reload when maintenance turns off
    const t = setInterval(async () => {
      try {
        const res  = await fetch(BASE() + "/api/dev/flags");
        const data = await res.json();
        const on   = data?.global?.maintenance_mode ?? data?.maintenance_mode ?? false;
        if (!on) window.location.reload();
      } catch (_) {}
    }, 5000);

    return () => { clearInterval(d); clearInterval(t); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--bg-base)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 32, textAlign: "center",
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 20, marginBottom: 28,
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 40px var(--accent-glow)",
        animation: "glow 2s ease infinite",
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
          stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      </div>

      <div style={{
        fontFamily: "var(--font-display)", fontSize: 26,
        fontWeight: 800, color: "var(--text-1)", marginBottom: 10,
      }}>
        Under Maintenance
      </div>

      <div style={{
        fontSize: 14, color: "var(--text-3)", lineHeight: 1.9,
        maxWidth: 300, marginBottom: 32,
      }}>
        LAN Chat is currently down for maintenance.
        The app will automatically reload when
        the server is back online.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: i < dots ? "var(--accent)" : "var(--bg-raised)",
            border: "1px solid var(--accent)",
            transition: "background 300ms",
          }} />
        ))}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: 0.5 }}>
        Checking every 5 seconds
      </div>

      <style>{`
        @keyframes glow {
          0%,100% { box-shadow: 0 0 40px var(--accent-glow); }
          50%      { box-shadow: 0 0 70px var(--accent-glow); }
        }
      `}</style>
    </div>
  );
}
