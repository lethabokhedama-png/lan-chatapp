import React, { useState, useEffect, useRef } from "react";
import {
  CornerUpLeft, Edit2, Copy, Trash2,
  Share2, MapPin, X
} from "react-feather";
import { emit } from "../../lib/socket";
import useStore from "../../lib/store";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉", "👀"];

export default function MessageMenu({ msg, mine, room, onClose, onReply, onEdit }) {
  const { user } = useStore();
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    setTimeout(() => {
      document.addEventListener("mousedown", handle);
      document.addEventListener("touchstart", handle);
    }, 50);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, []);

  function copyMsg() {
    navigator.clipboard?.writeText(msg.content || "").catch(() => {});
    onClose();
  }

  function deleteMsg() {
    emit.deleteMsg(room.id, msg.id);
    onClose();
  }

  function pinMsg() {
    const BASE  = import.meta.env.VITE_API_URL || "";
    const token = localStorage.getItem("lanchat_token");
    fetch(`${BASE}/api/rooms/${room.id}/pins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message_id: msg.id }),
    }).catch(() => {});
    onClose();
  }

  function forwardMsg() {
    // Store in clipboard-like store for forward UI
    useStore.getState().setForwardMsg(msg);
    onClose();
  }

  function react(emoji) {
    emit.react(room.id, msg.id, emoji);
    onClose();
  }

  const actions = [
    { icon: <CornerUpLeft size={15} />, label: "Reply",   action: () => { onReply(); onClose(); } },
    ...(mine ? [{ icon: <Edit2 size={15} />, label: "Edit", action: () => { onEdit(); onClose(); } }] : []),
    { icon: <Copy size={15} />,         label: "Copy",    action: copyMsg },
    { icon: <Share2 size={15} />,       label: "Forward", action: forwardMsg },
    { icon: <MapPin size={15} />,          label: "Pin",     action: pinMsg },
    ...(mine ? [{ icon: <Trash2 size={15} />, label: "Delete", action: deleteMsg, danger: true }] : []),
  ];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,.5)",
      backdropFilter: "blur(3px)",
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      <div ref={ref} style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)",
        width: "100%",
        maxWidth: 320,
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,.7)",
        animation: "popIn 150ms cubic-bezier(.34,1.56,.64,1)",
      }}>
        {/* Message preview */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-raised)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>
            {mine ? "Your message" : useStore.getState().userMap[msg.sender_id]?.display_name || "Message"}
          </div>
          <div style={{
            fontSize: 13, color: "var(--text-2)",
            overflow: "hidden", textOverflow: "ellipsis",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}>
            {msg.content?.slice(0, 100) || "Media"}
          </div>
        </div>

        {/* Reactions */}
        <div style={{
          display: "flex",
          justifyContent: "space-around",
          padding: "12px 8px",
          borderBottom: "1px solid var(--border)",
        }}>
          {REACTIONS.map(emoji => {
            const myReaction = (msg.reactions?.[emoji] || [])
              .includes(Number(user?.id));
            return (
              <button
                key={emoji}
                onClick={() => react(emoji)}
                style={{
                  fontSize: 22,
                  background: myReaction ? "var(--bg-active)" : "transparent",
                  border: myReaction ? "1px solid var(--accent-dim)" : "1px solid transparent",
                  borderRadius: 10,
                  cursor: "pointer",
                  padding: "4px 6px",
                  transition: "var(--trans)",
                  transform: myReaction ? "scale(1.15)" : "scale(1)",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"}
                onMouseLeave={e => e.currentTarget.style.transform = myReaction ? "scale(1.15)" : "scale(1)"}
              >
                {emoji}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ padding: "6px 0" }}>
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.action}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "11px 18px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: a.danger ? "var(--red)" : "var(--text-1)",
                fontSize: 14,
                fontFamily: "var(--font-body)",
                textAlign: "left",
                transition: "var(--trans)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: a.danger ? "var(--red)" : "var(--text-3)", flexShrink: 0 }}>
                {a.icon}
              </span>
              {a.label}
            </button>
          ))}
        </div>

        {/* Close */}
        <div style={{ padding: "6px 12px 12px" }}>
          <button onClick={onClose} style={{
            width: "100%", padding: "10px",
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-2)", fontSize: 13,
            fontFamily: "var(--font-body)",
            cursor: "pointer", transition: "var(--trans)",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--bg-raised)"}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
