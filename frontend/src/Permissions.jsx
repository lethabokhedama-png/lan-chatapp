import React, { useEffect, useState } from "react";
import { Mic, Bell, Check, X } from "react-feather";

export default function Permissions({ onDone }) {
  const [mic, setMic]   = useState(null);
  const [notif, setNotif] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Check existing permissions
    navigator.permissions?.query({ name: "microphone" })
      .then(r => setMic(r.state)).catch(() => setMic("unknown"));
    navigator.permissions?.query({ name: "notifications" })
      .then(r => setNotif(r.state)).catch(() => setNotif("unknown"));
  }, []);

  // Skip if already granted
  useEffect(() => {
    if (mic === "granted" && (notif === "granted" || notif === "unknown")) {
      onDone();
    }
  }, [mic, notif]);

  async function requestMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMic("granted");
    } catch (_) { setMic("denied"); }
  }

  async function requestNotif() {
    try {
      const result = await Notification.requestPermission();
      setNotif(result);
    } catch (_) { setNotif("denied"); }
  }

  if (done) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--bg-base)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, marginBottom: 20,
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, boxShadow: "0 0 32px var(--accent-glow)",
      }}>⬡</div>

      <div style={{ fontFamily: "var(--font-display)", fontSize: 22,
        fontWeight: 800, marginBottom: 8, color: "var(--text-1)", textAlign: "center" }}>
        Allow permissions
      </div>
      <div style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 32,
        textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
        LAN Chat needs a couple of permissions to work properly
      </div>

      <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <PermRow
          icon={<Mic size={18} />}
          title="Microphone"
          sub="For voice notes"
          state={mic}
          onRequest={requestMic}
        />
        <PermRow
          icon={<Bell size={18} />}
          title="Notifications"
          sub="For message alerts"
          state={notif}
          onRequest={requestNotif}
        />
      </div>

      <button onClick={() => { setDone(true); onDone(); }} style={{
        marginTop: 28, padding: "12px 32px",
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        border: "none", borderRadius: "var(--radius-sm)",
        color: "#fff", fontFamily: "var(--font-body)",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        boxShadow: "0 4px 20px var(--accent-glow)",
      }}>
        Continue →
      </button>
    </div>
  );
}

function PermRow({ icon, title, sub, state, onRequest }) {
  const granted = state === "granted";
  const denied  = state === "denied";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", background: "var(--bg-surface)",
      border: `1px solid ${granted ? "rgba(78,203,113,.3)" : "var(--border)"}`,
      borderRadius: "var(--radius)", transition: "var(--trans)",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: granted ? "rgba(78,203,113,.15)" : "var(--bg-raised)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: granted ? "var(--green)" : "var(--accent)",
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>
      </div>
      {granted
        ? <Check size={18} color="var(--green)" />
        : denied
        ? <div style={{ fontSize: 11, color: "var(--red)" }}>Denied</div>
        : <button onClick={onRequest} style={{
            padding: "6px 14px", borderRadius: 20,
            background: "var(--accent)", border: "none",
            color: "#fff", fontSize: 11, cursor: "pointer",
            fontFamily: "var(--font-body)", fontWeight: 500,
          }}>Allow</button>
      }
    </div>
  );
}
