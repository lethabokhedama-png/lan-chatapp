import React, { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Lock } from "react-feather";

export default function DisappearingPhoto({ msg, mine }) {
  const views     = msg.view_count  || 0;
  const maxViews  = msg.max_views   || 1;
  const fileUrl   = msg.file_url;
  const [open, setOpen]   = useState(false);
  const [left, setLeft]   = useState(maxViews - views);
  const [gone, setGone]   = useState(views >= maxViews);
  const timerRef  = useRef(null);
  const BASE      = import.meta.env.VITE_API_URL || "";

  async function view() {
    if (gone) return;
    setOpen(true);

    // Record view on server
    try {
      const token = localStorage.getItem("lanchat_token");
      const res = await fetch(`${BASE}/api/messages/${msg.room_id}/${msg.id}/view`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const newLeft = (maxViews) - (data.view_count || views + 1);
      setLeft(Math.max(0, newLeft));
      if (newLeft <= 0) {
        // Auto close after 5s then mark gone
        timerRef.current = setTimeout(() => { setOpen(false); setGone(true); }, 5000);
      }
    } catch (_) {}
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (gone) return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 12px", background: "var(--bg-hover)",
      borderRadius: 10, fontSize: 12, color: "var(--text-3)",
      border: "1px dashed var(--border)",
    }}>
      <EyeOff size={13} />
      Photo expired
    </div>
  );

  return (
    <>
      {/* Tap to view button */}
      <div onClick={view} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", background: "var(--bg-hover)",
        borderRadius: 12, cursor: "pointer", border: "1px solid var(--border)",
        transition: "var(--trans)",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-raised)"}
        onMouseLeave={e => e.currentTarget.style.background = "var(--bg-hover)"}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Eye size={16} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
            {mine ? "Photo you sent" : "Tap to view photo"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
            {left} view{left !== 1 ? "s" : ""} remaining • disappears after opening
          </div>
        </div>
        <Lock size={13} color="var(--text-3)" style={{ marginLeft: "auto" }} />
      </div>

      {/* Fullscreen viewer */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.95)",
          zIndex: 500, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            position: "absolute", top: 16, right: 16,
            fontSize: 12, color: "rgba(255,255,255,.5)",
            background: "rgba(255,255,255,.1)", padding: "4px 10px",
            borderRadius: 20, display: "flex", alignItems: "center", gap: 6,
          }}>
            <Eye size={11} />
            {left <= 0 ? "Last view — closing soon" : `${left} view${left !== 1 ? "s" : ""} left`}
          </div>

          <img src={fileUrl} alt="disappearing"
            style={{
              maxWidth: "90vw", maxHeight: "80vh",
              borderRadius: 12, objectFit: "contain",
              boxShadow: "0 0 80px rgba(0,0,0,.8)",
            }}
            onContextMenu={e => e.preventDefault()}
            draggable={false}
          />

          <div style={{
            position: "absolute", bottom: 24,
            fontSize: 12, color: "rgba(255,255,255,.4)",
          }}>
            Tap anywhere to close
          </div>
        </div>
      )}
    </>
  );
}
