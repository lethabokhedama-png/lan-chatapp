import React, { useEffect, useState, useRef } from "react";
import { X, ChatCircleDots, Bell } from "@phosphor-icons/react";

let _dispatch = null;

export function showToast(message, type = "info", opts = {}) {
  _dispatch?.({ message, type, id: Date.now(), ...opts });
}

export function showNotification(senderName, content, roomId, onClick) {
  _dispatch?.({
    id:      Date.now(),
    type:    "notification",
    sender:  senderName,
    message: content?.slice(0, 80),
    roomId,
    onClick,
  });
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _dispatch = (t) => {
      setToasts(prev => [...prev.slice(-4), t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)),
        t.type === "notification" ? 5000 : 3500);
    };
    return () => { _dispatch = null; };
  }, []);

  if (!toasts.length) return null;

  return (
    <div style={{
      position: "fixed", top: 12, right: 12, left: 12,
      display: "flex", flexDirection: "column", gap: 8,
      zIndex: 999, pointerEvents: "none",
      alignItems: "flex-end",
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: "auto", width: "100%", maxWidth: 360 }}>
          {t.type === "notification"
            ? <NotifBanner t={t} onDismiss={() => setToasts(p => p.filter(x => x.id !== t.id))} />
            : <ToastBar t={t} onDismiss={() => setToasts(p => p.filter(x => x.id !== t.id))} />
          }
        </div>
      ))}
    </div>
  );
}

function NotifBanner({ t, onDismiss }) {
  return (
    <div onClick={() => { t.onClick?.(); onDismiss(); }} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "11px 14px",
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--accent)",
      borderRadius: "var(--radius)",
      boxShadow: "0 8px 32px rgba(0,0,0,.6)",
      cursor: t.onClick ? "pointer" : "default",
      backdropFilter: "blur(12px)",
      animation: "slideDown 200ms ease",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color: "#fff",
      }}>
        {(t.sender || "?")[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{t.sender}</div>
        <div style={{ fontSize: 12, color: "var(--text-2)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.message}
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onDismiss(); }}
        style={{ background: "none", border: "none", cursor: "pointer",
          color: "var(--text-3)", padding: 4 }}>
        <X size={13} />
      </button>
    </div>
  );
}

function ToastBar({ t, onDismiss }) {
  const colors = { error: "var(--red)", success: "var(--green)", info: "var(--accent)" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 14px",
      background: "var(--bg-raised)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${colors[t.type] || colors.info}`,
      borderRadius: "var(--radius)",
      fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      animation: "slideDown 200ms ease",
    }}>
      <span style={{ flex: 1 }}>{t.message}</span>
      <button onClick={onDismiss}
        style={{ background: "none", border: "none", cursor: "pointer",
          color: "var(--text-3)", padding: 2 }}>
        <X size={11} />
      </button>
    </div>
  );
}
