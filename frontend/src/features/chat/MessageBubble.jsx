import React, { useRef, useEffect, useState } from "react";
import useStore from "../../lib/store";
import { emit } from "../../lib/socket";
import VoicePlayer       from "./VoicePlayer";
import DisappearingPhoto from "./DisappearingPhoto";

export default function MessageBubble({ msg, firstInGroup, mine, room, isGroup, onReply, isLatest, typingUids }) {
  const { userMap, user } = useStore();
  const [pressed, setPressed]   = useState(false);
  const [imgOpen, setImgOpen]   = useState(false);
  const pressTimer = useRef(null);
  const ref        = useRef(null);
  const sender     = userMap[Number(msg.sender_id)];
  const deleted    = msg.deleted || msg.type === "deleted";

  useEffect(() => {
    if (mine || !msg.id) return;
    const el  = ref.current;
    if (!el)  return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { emit.seen(room.id, msg.id); obs.disconnect(); }
    }, { threshold: 0.6 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [msg.id]);

  function onTouchStart() { pressTimer.current = setTimeout(() => setPressed(true), 400); }
  function onTouchEnd()   { clearTimeout(pressTimer.current); setTimeout(() => setPressed(false), 2200); }

  function scrollToReply() {
    if (!msg.reply_to_id) return;
    const el = document.querySelector(`[data-msgid="${msg.reply_to_id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.outline = "2px solid var(--accent)";
      setTimeout(() => el.style.outline = "", 1200);
    }
  }

  function renderContent(text) {
    if (!text) return null;
    return text.split(/(@\w+)/g).map((part, i) => {
      if (part.startsWith("@")) {
        const isMe = part.slice(1) === user?.username;
        return <span key={i} className={`mention${isMe ? " me" : ""}`}>{part}</span>;
      }
      return part;
    });
  }

  const seenBy      = (msg.seen_by      || []).filter(id => Number(id) !== Number(user?.id));
  const deliveredTo = (msg.delivered_to || []).filter(id => Number(id) !== Number(user?.id));
  const otherId     = room.members?.find?.(m => Number(m.user_id) !== Number(user?.id))?.user_id;
  const otherOnline = useStore.getState().onlineSet.has(Number(otherId));
  const isTyping    = (typingUids || []).length > 0;

  function getStatus() {
    if (msg._optimistic || !msg.id) return "sending";
    if (seenBy.length > 0)          return "read";
    if (deliveredTo.length > 0 || otherOnline) return "delivered";
    return "sent";
  }
  const status = mine ? getStatus() : null;
  const isSeen = seenBy.length > 0;

  function renderBody() {
    if (deleted) return (
      <span style={{ fontStyle: "italic", color: "var(--text-3)", fontSize: 13 }}>
        {isGroup && msg.deleted_by
          ? `Message deleted by @${userMap[Number(msg.deleted_by)]?.username || "someone"}`
          : "Message deleted"}
      </span>
    );
    if (msg.type === "voice") return <VoicePlayer url={msg.file_url} duration={msg.duration} />;
    if (msg.type === "image" && msg.max_views) return <DisappearingPhoto msg={msg} mine={mine} />;
    if (msg.type === "image" && msg.file_url) return (
      <>
        <img
          src={msg.file_url} alt="image"
          onClick={() => setImgOpen(true)}
          style={{
            maxWidth: 220, maxHeight: 200, borderRadius: 10,
            display: "block", cursor: "pointer", objectFit: "cover",
            border: "1px solid var(--border)",
          }}
          onError={e => { e.target.style.display = "none"; }}
        />
        {imgOpen && (
          <div onClick={() => setImgOpen(false)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.95)",
            zIndex: 500, display: "flex", alignItems: "center",
            justifyContent: "center",
          }}>
            <img src={msg.file_url} alt="full"
              style={{ maxWidth: "95vw", maxHeight: "90vh",
                borderRadius: 12, objectFit: "contain" }} />
            <div style={{ position: "absolute", bottom: 24,
              color: "rgba(255,255,255,.4)", fontSize: 12 }}>
              Tap to close
            </div>
          </div>
        )}
      </>
    );
    return <span style={{ fontSize: 14, lineHeight: 1.5 }}>{renderContent(msg.content)}</span>;
  }

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
      <div className="msg-avatar-col">
        {!mine && firstInGroup && sender && (
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff",
          }}>
            {(sender.display_name || sender.username || "?")[0].toUpperCase()}
          </div>
        )}
      </div>

      <div className="msg-col">
        {firstInGroup && !mine && (
          <div className="msg-meta">
            <span className="msg-sender"
              onClick={() => useStore.getState().setProfilePanel(sender)}>
              {sender?.display_name || sender?.username || "Unknown"}
            </span>
          </div>
        )}

        <div style={{ position: "relative" }}>
          <div className={`msg-bubble${deleted ? " deleted" : ""}`}>
            {msg.reply_to_content && (
              <div className="reply-quote" onClick={scrollToReply} style={{ cursor: "pointer" }}>
                <div className="rq-sender">↩ {msg.reply_to_sender || "User"}</div>
                <div className="rq-text">{msg.reply_to_content}</div>
              </div>
            )}
            {renderBody()}
          </div>

          {/* iMessage-style status — below bubble, right aligned */}
          {mine && !deleted && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              gap: 4, marginTop: 2, paddingRight: 2,
            }}>
              <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                {fmtTime(msg.created_at)}
              </span>
              <IMsgStatus status={status} />
            </div>
          )}

          {!mine && firstInGroup && (
            <div style={{ marginTop: 2, paddingLeft: 2 }}>
              <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                {fmtTime(msg.created_at)}
              </span>
            </div>
          )}

          {/* Seen label — latest message only, not typing */}
          {mine && isSeen && isLatest && !isTyping && (
            <div style={{
              fontSize: 10, color: "var(--accent)",
              textAlign: "right", marginTop: 1, paddingRight: 2,
              animation: "fadeIn 200ms ease",
            }}>
              Read
            </div>
          )}

          {/* Long press actions */}
          {pressed && !deleted && (
            <div style={{
              position: "absolute", top: -34,
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

function IMsgStatus({ status }) {
  const styles = {
    sending:   { text: "Sending…",  color: "var(--text-3)" },
    sent:      { text: "Sent",      color: "var(--text-3)" },
    delivered: { text: "Delivered", color: "var(--text-3)" },
    read:      { text: "Read",      color: "var(--accent)"  },
  };
  const s = styles[status] || styles.sent;
  return (
    <span style={{ fontSize: 10, color: s.color, fontWeight: status === "read" ? 600 : 400 }}>
      {s.text}
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
