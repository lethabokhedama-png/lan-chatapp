import React, { useEffect, useState } from "react";

let _addToast = null;

export function showToast(message, type = "info") {
  if (_addToast) _addToast({ message, type, id: Date.now() });
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    _addToast = (t) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500);
    };
    return () => { _addToast = null; };
  }, []);

  if (!toasts.length) return null;

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 12,
      display: "flex", flexDirection: "column", gap: 6, zIndex: 300,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: "9px 14px",
          background: "var(--bg-raised)",
          border: `1px solid var(--border)`,
          borderLeft: `3px solid ${t.type === "error" ? "var(--red)" : t.type === "success" ? "var(--green)" : "var(--accent)"}`,
          borderRadius: "var(--radius)",
          fontSize: 12, maxWidth: 280,
          boxShadow: "0 8px 24px rgba(0,0,0,.4)",
          color: "var(--text-1)",
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
