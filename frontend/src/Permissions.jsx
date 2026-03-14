import React, { useState, useEffect } from "react";
import { Mic, Bell, CheckCircle, AlertCircle } from "react-feather";

export default function Permissions({ onDone }) {
  const [micState,   setMicState]   = useState("unknown");
  const [notifState, setNotifState] = useState("unknown");
  const [requesting, setRequesting] = useState(false);
  const [checked,    setChecked]    = useState(false);

  // Check current permission states on mount
  useEffect(() => {
    async function check() {
      // Check notification permission
      if (typeof Notification !== "undefined") {
        setNotifState(Notification.permission); // "default" | "granted" | "denied"
      } else {
        setNotifState("denied");
      }

      // Check mic permission
      try {
        const result = await navigator.permissions?.query({ name: "microphone" });
        setMicState(result?.state || "prompt");
      } catch (_) {
        setMicState("prompt");
      }

      setChecked(true);
    }
    check();
  }, []);

  // If both already granted — skip screen
  useEffect(() => {
    if (!checked) return;
    if (micState === "granted" && notifState === "granted") {
      onDone();
    }
  }, [checked, micState, notifState]);

  async function requestAll() {
    setRequesting(true);

    // Request mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicState("granted");
    } catch (_) {
      setMicState("denied");
    }

    // Request notifications
    try {
      const result = await Notification.requestPermission();
      setNotifState(result);
    } catch (_) {
      setNotifState("denied");
    }

    setRequesting(false);
  }

  // Don't render until we've checked
  if (!checked) return (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--bg-base)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ color: "var(--text-3)", fontSize: 12 }}>Checking permissions…</div>
    </div>
  );

  const allGranted = micState === "granted" && notifState === "granted";
  const anyDenied  = micState === "denied"  || notifState === "denied";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "var(--bg-base)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24, zIndex: 1000,
    }}>
      {/* Glow background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 60% 50% at 30% 30%, var(--accent-glow) 0%, transparent 60%),
          radial-gradient(ellipse 40% 50% at 70% 70%, rgba(124,106,247,.08) 0%, transparent 55%)
        `,
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 340,
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        {/* Logo */}
        <div style={{
          width: 60, height: 60, borderRadius: 18, marginBottom: 20,
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, boxShadow: "0 0 40px var(--accent-glow)",
        }}>⬡</div>

        <div style={{
          fontFamily: "var(--font-display)", fontSize: 22,
          fontWeight: 800, color: "var(--text-1)",
          textAlign: "center", marginBottom: 8,
        }}>
          Before we start
        </div>
        <div style={{
          fontSize: 13, color: "var(--text-3)",
          textAlign: "center", marginBottom: 32, lineHeight: 1.6,
        }}>
          LAN Chat needs these permissions to work properly.
          Your data never leaves this network.
        </div>

        {/* Permission cards */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          <PermCard
            icon={<Mic size={20} />}
            title="Microphone"
            sub="Required for voice notes"
            state={micState}
          />
          <PermCard
            icon={<Bell size={20} />}
            title="Notifications"
            sub="For message alerts when app is in background"
            state={notifState}
          />
        </div>

        {/* Denied warning */}
        {anyDenied && (
          <div style={{
            width: "100%", padding: "10px 14px", marginBottom: 16,
            background: "rgba(224,92,92,.1)", border: "1px solid rgba(224,92,92,.3)",
            borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--red)",
            lineHeight: 1.5,
          }}>
            Some permissions were denied. You can still use LAN Chat but voice notes
            or notifications may not work. Go to Chrome → Site Settings to change this.
          </div>
        )}

        {/* Action buttons */}
        {!allGranted && (
          <button onClick={requestAll} disabled={requesting} style={{
            width: "100%", padding: "13px",
            background: requesting ? "var(--bg-raised)" : "linear-gradient(135deg, var(--accent), var(--accent2))",
            border: "none", borderRadius: "var(--radius-sm)",
            color: requesting ? "var(--text-3)" : "#fff",
            fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
            cursor: requesting ? "not-allowed" : "pointer",
            boxShadow: requesting ? "none" : "0 4px 20px var(--accent-glow)",
            transition: "var(--trans)", marginBottom: 10,
          }}>
            {requesting ? "Requesting permissions…" : "Allow permissions"}
          </button>
        )}

        <button onClick={onDone} style={{
          width: "100%", padding: "11px",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-3)",
          fontFamily: "var(--font-body)", fontSize: 13,
          cursor: "pointer", transition: "var(--trans)",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.color = "var(--text-1)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-3)"; }}
        >
          {allGranted ? "Continue →" : "Skip for now"}
        </button>
      </div>
    </div>
  );
}

function PermCard({ icon, title, sub, state }) {
  const granted = state === "granted";
  const denied  = state === "denied";
  const pending = state === "prompt" || state === "unknown";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px",
      background: granted ? "rgba(78,203,113,.06)" : "var(--bg-surface)",
      border: `1px solid ${granted ? "rgba(78,203,113,.3)" : denied ? "rgba(224,92,92,.3)" : "var(--border)"}`,
      borderRadius: "var(--radius)",
      transition: "var(--trans)",
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: granted ? "rgba(78,203,113,.15)"
          : denied  ? "rgba(224,92,92,.1)"
          : "var(--bg-raised)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: granted ? "var(--green)"
          : denied  ? "var(--red)"
          : "var(--accent)",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600,
          color: "var(--text-1)", marginBottom: 3,
        }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.4 }}>
          {sub}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {granted && <CheckCircle size={18} color="var(--green)" />}
        {denied  && <AlertCircle size={18} color="var(--red)" />}
        {pending && (
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            border: "2px solid var(--border)",
          }} />
        )}
      </div>
    </div>
  );
}
