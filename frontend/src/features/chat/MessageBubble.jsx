import React, { useRef, useEffect, useState } from "react";
import { Clock } from "@phosphor-icons/react";
import useStore from "../../lib/store";
import { emit } from "../../lib/socket";

export default function MessageBubble({ msg, firstInGroup, mine, room }) {
  const { userMap, setReplyTo, user } = useStore();
  const [showActions, setShowActions] = useState(false);
  const ref = useRef(null);
  const sender = userMap[msg.sender_id];

  // Mark seen when visible
  useEffect(() => {
    if (mine || !msg.id) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        emit.seen(room.id, msg.id);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [msg.id]);

  const deleted = msg.deleted || msg.type === "deleted";

  return (
    <div
      ref={ref}
      data-msgid={msg.id}
      className={`msg-group${mine ? " mine" : ""}`}
      onTouchStart={() => setShowActions(true)}
      onTouchEnd={() => setTimeout(() => setShowActions(false), 1800)}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar column — only for others, first in group */}
      <div className="msg-avatar-col">
        {!mine && firstInGroup && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff",
          }}>
            {(sender?.display_name || sender?.username || "?")[0].toUpperCase()}
          </div>
        )}
      </div>

      <div className="msg-col">
        {/* Sender name + time — first in group only */}
        {firstInGroup && !mine && (
          <div className="msg-meta">
            <span className="msg-sender"
              onClick={() => useStore.getState().setProfilePanel(sender)}>
              {sender?.display_name || sender?.username || "Unknown"}
            </span>
            <span className="msg-time">{fmtTime(msg.created_at)}</span>
          </div>
        )}

        <div style={{ position: "relative" }}>
          {/* Bubble */}
          <div className={`msg-bubble${deleted ? " deleted" : ""}`}>
            {/* Reply quote */}
            {msg.reply_to_content && (
              <div className="reply-quote">
                <strong>{msg.reply_to_sender || "User"}</strong>
                <div>{msg.reply_to_content?.slice(0, 60)}</div>
              </div>
            )}

            {deleted
              ? <span>This message was deleted</span>
              : msg.type === "image"
              ? <img src={msg.file_url} alt={msg.content} className="msg-image"
                  onError={e => e.target.style.display = "none"} />
              : <span>{msg.content}</span>
            }

            {/* Time + status row — bottom of bubble */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              gap: 4, marginTop: 4,
            }}>
              {mine && firstInGroup && (
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                  {fmtTime(msg.created_at)}
                </span>
              )}
              {mine && !deleted && <StatusDots msg={msg} userId={user?.id} />}
            </div>
          </div>

          {/* Action buttons on hover/long press */}
          {showActions && !deleted && (
            <div style={{
              position: "absolute",
              top: -28,
              [mine ? "left" : "right"]: 0,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              display: "flex", gap: 2, padding: "3px 5px",
              zIndex: 20, boxShadow: "0 4px 14px rgba(0,0,0,.5)",
              whiteSpace: "nowrap",
            }}>
              <ActionBtn onClick={() => setReplyTo(msg)}>↩ Reply</ActionBtn>
              {mine && <ActionBtn onClick={() => emit.deleteMsg(room.id, msg.id)}>🗑</ActionBtn>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDots({ msg, userId }) {
  // Determine status
  const seenBy      = msg.seen_by      || [];
  const deliveredTo = msg.delivered_to || [];
  const optimistic  = msg._optimistic;

  let status = "queued";
  if (!optimistic && msg.id) {
    const others = seenBy.filter(id => id !== userId);
    if (others.length > 0)        status = "seen";
    else if (deliveredTo.filter(id => id !== userId).length > 0) status = "delivered";
    else                          status = "sent";
  }

  const colors = {
    queued:    "var(--text-3)",      // grey clock
    sent:      "var(--text-3)",      // grey •
    delivered: "#f5a623",            // yellow ••
    seen:      "#4f8ef7",            // blue •••
  };

  if (status === "queued") {
    return (
      <span style={{ color: colors.queued, fontSize: 10, display: "flex", alignItems: "center" }}>
        <Clock size={11} weight="regular" />
      </span>
    );
  }

  const dotCount = status === "sent" ? 1 : status === "delivered" ? 2 : 3;
  return (
    <span style={{ display: "inline-flex", gap: 1.5, alignItems: "center" }}>
      {Array.from({ length: dotCount }).map((_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: colors[status],
          display: "inline-block",
          boxShadow: status === "seen" ? "0 0 4px rgba(79,142,247,.6)" : "none",
        }} />
      ))}
    </span>
  );
}

function ActionBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "3px 8px", borderRadius: 4, cursor: "pointer",
      background: "transparent", border: "none",
      color: "var(--text-2)", fontSize: 11,
      transition: "var(--trans)", fontFamily: "var(--font-body)",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >{children}</button>
  );
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
