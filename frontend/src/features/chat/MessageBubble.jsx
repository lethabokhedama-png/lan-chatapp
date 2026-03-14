import React, { useRef, useEffect, useState } from "react";
import { Clock } from "@phosphor-icons/react";
import useStore from "../../lib/store";
import { emit } from "../../lib/socket";

export default function MessageBubble({ msg, firstInGroup, mine, room, isGroup, onReply, typingUids }) {
  const { userMap, user } = useStore();
  const [pressed, setPressed] = useState(false);
  const pressTimer = useRef(null);
  const ref        = useRef(null);
  const sender     = userMap[Number(msg.sender_id)];
  const deleted    = msg.deleted || msg.type === "deleted";

  // Seen via IntersectionObserver
  useEffect(() => {
    if (mine || !msg.id) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { emit.seen(room.id, msg.id); obs.disconnect(); }
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [msg.id]);

  function onTouchStart() {
    pressTimer.current = setTimeout(() => setPressed(true), 400);
  }
  function onTouchEnd() {
    clearTimeout(pressTimer.current);
    setTimeout(() => setPressed(false), 2000);
  }

  // Render @mentions with highlights
  function renderContent(text) {
    if (!text) return null;
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const uname = part.slice(1);
        const isMe  = uname === user?.username;
        return <span key={i} className={`mention${isMe ? " me" : ""}`}>{part}</span>;
      }
      return part;
    });
  }

  const isSeen      = (msg.seen_by || []).filter(id => Number(id) !== Number(user?.id)).length > 0;
  const isDelivered = (msg.delivered_to || []).filter(id => Number(id) !== Number(user?.id)).length > 0;
  const isOnline    = room.type === "dm"
    ? onlineSet_stub(room, user, useStore.getState().onlineSet)
    : false;

  function onlineSet_stub(room, user, onlineSet) {
    const otherId = room.members?.find?.(m => Number(m.user_id) !== Number(user?.id))?.user_id;
    return onlineSet.has(Number(otherId));
  }

  // Status: clock | • sent (offline) | •• delivered/online | ••• seen
  function getStatus() {
    if (msg._optimistic || !msg.id) return "clock";
    if (isSeen) return "seen";
    if (isDelivered || isOnline) return "delivered";
    return "sent";
  }

  const status = mine ? getStatus() : null;

  const isTyping = typingUids?.length > 0;

  return (
    <div
      ref={ref}
      data-msgid={msg.id}
      className={`msg-group${mine ? " mine" : ""}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseEnter={() => setPressed(true)}
      onMouseLeave={() => setPressed(false)}
    >
      {/* Avatar */}
      <div className="msg-avatar-col">
        {!mine && firstInGroup && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff",
          }}>
            {(sender?.display_name || sender?.username || "?")[0].toUpperCase()}
          </div>
        )}
      </div>

      <div className="msg-col">
        {/* Sender + time */}
        {firstInGroup && !mine && (
          <div className="msg-meta">
            <span className="msg-sender">{sender?.display_name || sender?.username || "Unknown"}</span>
            <span className="msg-time">{fmtTime(msg.created_at)}</span>
          </div>
        )}

        <div style={{ position: "relative" }}>
          <div className={`msg-bubble${deleted ? " deleted" : ""}`}>
            {/* Reply quote */}
            {msg.reply_to_content && (
              <div className="reply-quote">
                <div className="rq-sender">{msg.reply_to_sender || "User"}</div>
                <div className="rq-text">{msg.reply_to_content}</div>
              </div>
            )}

            {deleted
              ? <span style={{ fontStyle: "italic", color: "var(--text-3)" }}>
                  {isGroup && msg.deleted_by
                    ? `Message deleted by @${userMap[Number(msg.deleted_by)]?.username || "unknown"}`
                    : "Message deleted"}
                </span>
              : msg.type === "image"
              ? <img src={msg.file_url} alt={msg.content}
                  style={{ maxWidth: 220, maxHeight: 180, borderRadius: 8, display: "block" }}
                  onError={e => e.target.style.display = "none"} />
              : <span>{renderContent(msg.content)}</span>
            }

            {/* Time + status row inside bubble */}
            {mine && !deleted && (
              <div className="status-row">
                <span className="status-time">{fmtTime(msg.created_at)}</span>
                <StatusDots status={status} />
              </div>
            )}
            {!mine && firstInGroup && (
              <div style={{ textAlign: "right", marginTop: 3 }}>
                <span className="status-time">{fmtTime(msg.created_at)}</span>
              </div>
            )}
          </div>

          {/* Seen label — only when not typing */}
          {mine && isSeen && !isTyping && (
            <div className="seen-label">Seen ✓</div>
          )}

          {/* Long-press action buttons */}
          {pressed && !deleted && (
            <div style={{
              position: "absolute",
              top: -34,
              [mine ? "left" : "right"]: 0,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              display: "flex", gap: 2, padding: "4px 6px",
              zIndex: 20, boxShadow: "0 4px 20px rgba(0,0,0,.6)",
              whiteSpace: "nowrap",
            }}>
              <ActionBtn onClick={onReply}>↩ Reply</ActionBtn>
              {mine && (
                <ActionBtn color="var(--red)"
                  onClick={() => emit.deleteMsg(room.id, msg.id)}>
                  🗑 Delete
                </ActionBtn>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusDots({ status }) {
  if (status === "clock") return (
    <span style={{ color: "var(--text-3)", display: "flex", alignItems: "center" }}>
      <Clock size={11} />
    </span>
  );

  const configs = {
    sent:      { count: 1, color: "var(--receipt-sent)",      label: "Sent" },
    delivered: { count: 2, color: "var(--receipt-delivered)", label: "Delivered" },
    seen:      { count: 3, color: "var(--receipt-seen)",      label: "Seen" },
  };
  const cfg = configs[status] || configs.sent;

  return (
    <span title={cfg.label} style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: cfg.count }).map((_, i) => (
        <span key={i} className="status-dot" style={{
          background: cfg.color,
          boxShadow: status === "seen" ? `0 0 5px ${cfg.color}` : "none",
        }} />
      ))}
    </span>
  );
}

function ActionBtn({ onClick, children, color }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: 5, cursor: "pointer",
      background: "transparent", border: "none",
      color: color || "var(--text-2)", fontSize: 12,
      fontFamily: "var(--font-body)", transition: "var(--trans)",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >{children}</button>
  );
}

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
