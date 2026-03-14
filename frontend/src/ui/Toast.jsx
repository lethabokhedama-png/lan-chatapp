import React, { useEffect, useState, useRef } from "react";
import { X } from "react-feather";

let _dispatch = null;
let _audio    = null;

function getAudio() {
  if (!_audio) {
    _audio = new Audio("/rhea.mp3");
    _audio.volume = 0.6;
  }
  return _audio;
}

export function showToast(message, type = "info", opts = {}) {
  _dispatch?.({ message, type, id: Date.now(), ...opts });
}

export function showNotification(senderName, content, roomId, onClick) {
  // Play sound
  try { getAudio().currentTime = 0; getAudio().play().catch(() => {}); } catch (_) {}

  // Browser notification if app is in background
  if (document.hidden && Notification.permission === "granted") {
    const n = new Notification(senderName, {
      body: content?.slice(0, 80),
      icon: "/favicon.svg",
      silent: true,
    });
    n.onclick = () => { window.focus(); onClick?.(); n.close(); };
  }

  _dispatch?.({
    id:      Date.now(),
    type:    "notification",
    sender:  senderName,
    message: content?.slice(0, 80),
    roomId,
    onClick,
    duration: 5000,
  });
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _dispatch = (t) => {
      setToasts(prev => [...prev.slice(-3), t]);
    };
    return () => { _dispatch = null; };
  }, []);

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  if (!toasts.length) return null;

  return (
    <div style={{
      position: "fixed", top: 12, right: 12, left: 12,
      display: "flex", flexDirection: "column", gap: 8,
      zIndex: 999, pointerEvents: "none", alignItems: "flex-end",
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: "auto", width: "100%", maxWidth: 360 }}>
          {t.type === "notification"
            ? <NotifBanner t={t} onDismiss={() => dismiss(t.id)} />
            : <ToastBar    t={t} onDismiss={() => dismiss(t.id)} />
          }
        </div>
      ))}
    </div>
  );
}

function NotifBanner({ t, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const rafRef = useRef(null);
  const startRef = useRef(Date.now());
  const duration = t.duration || 5000;

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onDismiss();
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden",
      boxShadow: "0 8px 32px rgba(0,0,0,.6)",
      animation: "slideDown 200ms ease",
    }}>
      <div onClick={() => { t.onClick?.(); onDismiss(); }} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 14px", cursor: t.onClick ? "pointer" : "default",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#fff",
        }}>
          {(t.sender || "?")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>
            {t.sender}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t.message}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDismiss(); }} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--text-3)", padding: 4, flexShrink: 0,
        }}>
          <X size={13} />
        </button>
      </div>
      {/* Progress bar */}
      <div style={{ height: 2, background: "var(--border)" }}>
        <div style={{
          height: "100%", background: "var(--accent)",
          width: progress + "%", transition: "none",
        }} />
      </div>
    </div>
  );
}

function ToastBar({ t, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, []);

  const colors = { error: "var(--red)", success: "var(--green)", info: "var(--accent)" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 14px", background: "var(--bg-raised)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${colors[t.type] || colors.info}`,
      borderRadius: "var(--radius)", fontSize: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      animation: "slideDown 200ms ease",
    }}>
      <span style={{ flex: 1, color: "var(--text-1)" }}>{t.message}</span>
      <button onClick={onDismiss} style={{
        background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 2,
      }}><X size={11} /></button>
    </div>
  );
}
