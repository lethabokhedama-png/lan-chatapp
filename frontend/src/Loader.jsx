import React, { useEffect, useState } from "react";

export default function Loader({ message = "Starting up…" }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState(message);
  const [dots, setDots]         = useState("");

  useEffect(() => {
    // Animate dots
    const dt = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400);

    // Simulate realistic loading stages
    const stages = [
      { pct: 15,  msg: "Connecting to API",    delay: 200  },
      { pct: 35,  msg: "Loading user data",     delay: 600  },
      { pct: 55,  msg: "Fetching rooms",        delay: 900  },
      { pct: 75,  msg: "Connecting to realtime",delay: 1200 },
      { pct: 90,  msg: "Almost ready",          delay: 1600 },
    ];

    const timers = stages.map(s =>
      setTimeout(() => { setProgress(s.pct); setStatus(s.msg); }, s.delay)
    );

    return () => { clearInterval(dt); timers.forEach(clearTimeout); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--bg-base)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: 999, gap: 20,
    }}>
      {/* Logo */}
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, boxShadow: "0 0 40px var(--accent-glow)",
        animation: "pulse 2s ease infinite",
      }}>⬡</div>

      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 20,
          fontWeight: 800, color: "var(--text-1)", marginBottom: 4,
        }}>LAN Chat</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: 1.5 }}>
          v0.5.0 by LethaboK
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: 240 }}>
        <div style={{
          height: 3, background: "var(--border)",
          borderRadius: 3, overflow: "hidden", marginBottom: 10,
        }}>
          <div style={{
            height: "100%", borderRadius: 3,
            background: "linear-gradient(90deg, var(--accent), var(--accent2))",
            width: progress + "%",
            transition: "width 400ms ease",
            boxShadow: "0 0 8px var(--accent-glow)",
          }} />
        </div>
        <div style={{
          fontSize: 11, color: "var(--text-3)",
          textAlign: "center", minHeight: 16,
        }}>
          {status}{dots}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 40px var(--accent-glow); }
          50%      { box-shadow: 0 0 60px var(--accent-glow), 0 0 20px var(--accent); }
        }
      `}</style>
    </div>
  );
}
