import React, { useRef, useEffect } from "react";
import useStore from "../../lib/store";
import { emit } from "../../lib/socket";
import { uploads } from "../../lib/api";
import Avatar   from "../../ui/Avatar";

const RECEIPT_ICONS = {
  queued:    { icon: "⏱", cls: "queued" },
  sent:      { icon: "✓",  cls: "sent" },
  delivered: { icon: "✓✓", cls: "delivered" },
  seen:      { icon: "✓✓", cls: "seen" },
};

function receiptStatus(msg, myId, members) {
  if (msg._optimistic) return "queued";
  const others = members.filter(m => m !== myId);
  if (!others.length) return "sent";
  if (others.every(u => msg.seen_by?.includes(u)))      return "seen";
  if (others.every(u => msg.delivered_to?.includes(u))) return "delivered";
  return "sent";
}

export default function MessageBubble({ msg, firstInGroup, mine, room }) {
  const { user, userMap, setReplyTo, setProfilePanel, updateMessage } = useStore();
  const sender   = userMap[msg.sender_id] || { display_name: "User #" + msg.sender_id };
  const members  = room.members?.map?.(m => m.user_id) || [];
  const timeStr  = msg.created_at
    ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  // IntersectionObserver → emit seen when 80% visible
  const bubbleRef = useRef(null);
  useEffect(() => {
    if (!bubbleRef.current || mine || !msg.id) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.8 && !msg.seen_by?.includes(user?.id)) {
          emit.seen(room.id, msg.id);
          updateMessage(room.id, {
            ...msg, seen_by: [...(msg.seen_by || []), user?.id],
          });
        }
      },
      { threshold: 0.8 }
    );
    obs.observe(bubbleRef.current);
    return () => obs.disconnect();
  }, [msg.id, msg.seen_by?.length]);

  if (msg._deleted) {
    return (
      <div className={`msg-group${mine ? " mine" : ""}`} data-msgid={msg.id}>
        <div className="msg-avatar-col" />
        <div className="msg-col">
          <div className="msg-bubble deleted">🗑 Message deleted</div>
        </div>
      </div>
    );
  }

  const receipt = mine ? receiptStatus(msg, user?.id, members) : null;
  const { icon: rIcon, cls: rCls } = RECEIPT_ICONS[receipt] || {};

  return (
    <div className={`msg-group${mine ? " mine" : ""}`}
      data-msgid={msg.id}
      style={{ marginTop: firstInGroup ? 6 : 0 }}>
      <div className="msg-avatar-col">
        {firstInGroup && (
          <div onClick={() => setProfilePanel(userMap[msg.sender_id])} style={{ cursor: "pointer" }}>
            <Avatar user={sender} size="sm" />
          </div>
        )}
      </div>
      <div className="msg-col" ref={bubbleRef}>
        {firstInGroup && (
          <div className="msg-meta">
            <span className="msg-sender"
              onClick={() => setProfilePanel(userMap[msg.sender_id])}>
              {sender.display_name || sender.username}
            </span>
            <span className="msg-time">{timeStr}</span>
            {msg.edited_at && <span className="msg-edited">(edited)</span>}
          </div>
        )}

        <div className="msg-bubble" style={{ position: "relative" }}>
          {/* Actions */}
          <div className="msg-actions">
            <button className="action-btn" onClick={() => setReplyTo(msg)} title="Reply">↩</button>
            {mine && <button className="action-btn"
              onClick={() => {
                const c = prompt("Edit message:", msg.content);
                if (c !== null && c !== msg.content) emit.editMsg(room.id, msg.id, c);
              }}>✎</button>}
            {mine && <button className="action-btn"
              onClick={() => { if (confirm("Delete?")) emit.deleteMsg(room.id, msg.id); }}>🗑</button>}
            <button className="action-btn"
              onClick={() => {/* pin */}}>📌</button>
          </div>

          {/* Reply quote */}
          {msg.reply_to && (
            <div className="reply-quote">
              ↩ {useStore.getState().messages[room.id]
                ?.find(m => m.id === msg.reply_to)?.content?.slice(0, 60) || "Original message"}
            </div>
          )}

          {/* Content */}
          <BubbleContent msg={msg} />
        </div>

        {/* Receipt */}
        {mine && receipt && (
          <div className="receipts">
            <i className={`receipt-icon ${rCls}`} title={receipt}>{rIcon}</i>
          </div>
        )}
      </div>
    </div>
  );
}

function BubbleContent({ msg }) {
  if (msg.type === "image" && msg.file_id) {
    return (
      <img className="msg-image"
        src={uploads.url(msg.file_id)}
        alt={msg.content}
        onClick={() => window.open(uploads.url(msg.file_id), "_blank")} />
    );
  }
  if (msg.type === "file" && msg.file_id) {
    return (
      <a href={uploads.url(msg.file_id)} target="_blank" rel="noreferrer"
        style={{ color: "var(--accent)" }}>
        📎 {msg.content}
      </a>
    );
  }
  if (msg.type === "voice" && msg.file_id) {
    return <audio controls src={uploads.url(msg.file_id)} style={{ maxWidth: 260 }} />;
  }
  // text — render with newline support
  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {msg.content}
      {msg._optimistic && <span style={{ opacity: .4, marginLeft: 4 }}>⏱</span>}
    </span>
  );
}