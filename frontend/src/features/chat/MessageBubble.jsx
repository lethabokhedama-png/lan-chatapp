import React, { useRef, useEffect, useState } from "react";
import useStore from "../../lib/store";
import { emit } from "../../lib/socket";
import VoicePlayer       from "./VoicePlayer";
import DisappearingPhoto from "./DisappearingPhoto";

const REACTIONS = ["👍","❤️","😂","😮","😢","🙏","🔥","🎉","👀"];

export default function MessageBubble({
  msg, firstInGroup, mine, room, isGroup,
  onReply, onEdit, onMenu, isLatest, typingUids,
}) {
  const { userMap, user } = useStore();
  const ref        = useRef(null);
  const touchStart = useRef(null);
  const longTimer  = useRef(null);
  const tapTimer   = useRef(null);
  const tapCount   = useRef(0);
  const [swipeX,   setSwipeX]   = useState(0);
  const [swiping,  setSwiping]  = useState(false);
  const [showReact,setShowReact]= useState(false);
  const [imgOpen,  setImgOpen]  = useState(false);

  const sender  = userMap[Number(msg.sender_id)];
  const deleted = msg.deleted || msg.type === "deleted";
  const isSys   = msg.type === "system" || msg.content?.startsWith("[system]");

  // Mark as seen when visible
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

  // Touch handlers for swipe + long press + double tap
  function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    // Long press timer
    longTimer.current = setTimeout(() => {
      onMenu?.();
    }, 600);
  }

  function handleTouchMove(e) {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStart.current.y);

    // Only horizontal swipe, cancel long press
    if (Math.abs(dx) > 10 || dy > 10) {
      clearTimeout(longTimer.current);
    }

    if (dy < 20 && dx > 0 && !mine) {
      // Swipe right on received message = reply
      setSwiping(true);
      setSwipeX(Math.min(dx, 80));
    } else if (dy < 20 && dx < 0 && mine) {
      // Swipe left on own message = reply
      setSwiping(true);
      setSwipeX(Math.max(dx, -80));
    }
  }

  function handleTouchEnd(e) {
    clearTimeout(longTimer.current);
    const dx = swipeX;
    setSwiping(false);
    setSwipeX(0);

    // If swiped enough — trigger reply
    if (Math.abs(dx) > 50) {
      onReply?.();
      return;
    }

    // Double tap detection
    tapCount.current += 1;
    if (tapCount.current === 1) {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
      }, 300);
    } else if (tapCount.current === 2) {
      clearTimeout(tapTimer.current);
      tapCount.current = 0;
      // Double tap = show reaction row
      setShowReact(v => !v);
    }
  }

  function react(emoji) {
    emit.react(room.id, msg.id, emoji);
    setShowReact(false);
  }

  function renderContent() {
    if (deleted) return (
      <span style={{ fontStyle:"italic", color:"var(--text-3)", fontSize:13 }}>
        Message deleted
      </span>
    );
    if (msg.type === "voice") return <VoicePlayer url={msg.file_url || msg.content} duration={msg.duration} />;
    if (msg.type === "image" && msg.max_views) return <DisappearingPhoto msg={msg} mine={mine} />;
    if (msg.type === "image" || msg.file_url?.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
      const url = msg.file_url || msg.content;
      return (
        <>
          <img
            src={url} alt="image"
            onClick={() => setImgOpen(true)}
            onError={e => { e.target.style.display = "none"; }}
            style={{
              maxWidth: 220, maxHeight: 200, borderRadius: 10,
              display: "block", cursor: "pointer", objectFit: "cover",
              border: "1px solid var(--border)",
            }}
          />
          {imgOpen && (
            <div onClick={() => setImgOpen(false)} style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,.95)",
              zIndex:500, display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <img src={url} alt="full" style={{
                maxWidth:"95vw", maxHeight:"90vh",
                borderRadius:12, objectFit:"contain",
              }} />
              <div style={{ position:"absolute", bottom:24,
                color:"rgba(255,255,255,.4)", fontSize:12 }}>
                Tap to close
              </div>
            </div>
          )}
        </>
      );
    }
    if (msg.type === "file" || msg.file_url) {
      return (
        <a href={msg.file_url || msg.content} target="_blank" rel="noreferrer"
          style={{ color:"var(--accent)", fontSize:13, textDecoration:"underline" }}>
          Download file
        </a>
      );
    }
    // Text with @mentions
    return (
      <span style={{ fontSize:14, lineHeight:1.5 }}>
        {(msg.content || "").split(/(@\w+)/g).map((part, i) => {
          if (part.startsWith("@")) {
            const isMe = part.slice(1) === user?.username;
            return (
              <span key={i} style={{
                color: isMe ? "#fff" : "var(--accent)",
                background: isMe ? "var(--accent)" : "var(--accent-glow)",
                borderRadius: 4, padding: "0 3px",
                fontWeight: isMe ? 700 : 500,
              }}>
                {part}
              </span>
            );
          }
          return part;
        })}
      </span>
    );
  }

  // System message
  if (isSys) {
    const text = msg.content?.replace("[system]", "").trim();
    return (
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"6px 16px", margin:"4px 0",
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"5px 14px", background:"rgba(255,255,255,.04)",
          border:"1px solid var(--border)", borderRadius:20,
          fontFamily:"monospace", fontSize:11, color:"var(--text-3)",
          fontStyle:"italic", maxWidth:"90%",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          {text}
        </div>
      </div>
    );
  }

  // iMessage status
  const seenBy      = (msg.seen_by      || []).filter(id => Number(id) !== Number(user?.id));
  const deliveredTo = (msg.delivered_to || []).filter(id => Number(id) !== Number(user?.id));

  function getStatus() {
    if (msg._optimistic || !msg.id) return "sending";
    if (seenBy.length > 0)          return "read";
    if (deliveredTo.length > 0)     return "delivered";
    return "sent";
  }
  const status   = mine ? getStatus() : null;
  const isSeen   = seenBy.length > 0;
  const isTyping = (typingUids || []).length > 0;

  // Reactions display
  const reactions = msg.reactions || {};
  const reactionEntries = Object.entries(reactions).filter(([, uids]) => uids.length > 0);

  return (
    <div
      ref={ref}
      data-msgid={msg.id}
      style={{
        display: "flex",
        flexDirection: mine ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 6,
        padding: "2px 12px",
        marginBottom: firstInGroup ? 4 : 1,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => {}}
    >
      {/* Avatar — only for others in group, first in group */}
      {!mine && isGroup && firstInGroup ? (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "#fff", marginBottom: 2,
        }}>
          {(sender?.display_name || sender?.username || "?")[0].toUpperCase()}
        </div>
      ) : !mine && isGroup ? (
        <div style={{ width: 28, flexShrink: 0 }} />
      ) : null}

      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: mine ? "flex-end" : "flex-start",
        maxWidth: "75%",
        transform: swiping ? `translateX(${swipeX}px)` : "translateX(0)",
        transition: swiping ? "none" : "transform 200ms ease",
      }}>
        {/* Sender name in group */}
        {!mine && isGroup && firstInGroup && sender && (
          <div style={{ fontSize: 11, color: "var(--accent)",
            fontWeight: 600, marginBottom: 2, paddingLeft: 4 }}>
            {sender.display_name || sender.username}
          </div>
        )}

        {/* Reply quote */}
        {msg.reply_to_content && (
          <div
            onClick={() => {
              const el = document.querySelector(`[data-msgid="${msg.reply_to_id}"]`);
              el?.scrollIntoView({ behavior:"smooth", block:"center" });
              if (el) { el.style.outline = "2px solid var(--accent)"; setTimeout(() => el.style.outline = "", 1200); }
            }}
            style={{
              padding:"5px 10px", marginBottom:3,
              background:"var(--bg-raised)", border:"1px solid var(--border)",
              borderLeft:"3px solid var(--accent)", borderRadius:8,
              cursor:"pointer", maxWidth:"100%",
            }}
          >
            <div style={{ fontSize:10, color:"var(--accent)", fontWeight:600, marginBottom:1 }}>
              {msg.reply_to_sender || "User"}
            </div>
            <div style={{ fontSize:11, color:"var(--text-3)", overflow:"hidden",
              textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {msg.reply_to_content?.slice(0, 60)}
            </div>
          </div>
        )}

        {/* Bubble */}
        <div style={{
          padding: msg.type === "image" || msg.file_url?.match(/\.(jpg|jpeg|png|gif|webp)/i)
            ? "4px" : "8px 12px",
          background: mine
            ? "linear-gradient(135deg, var(--accent), var(--accent2))"
            : "var(--bg-surface)",
          color: mine ? "#fff" : "var(--text-1)",
          borderRadius: mine
            ? "18px 18px 4px 18px"
            : "18px 18px 18px 4px",
          border: mine ? "none" : "1px solid var(--border)",
          boxShadow: mine
            ? "0 2px 12px var(--accent-glow)"
            : "0 1px 4px rgba(0,0,0,.2)",
          wordBreak: "break-word",
          position: "relative",
        }}>
          {renderContent()}
        </div>

        {/* Reactions */}
        {reactionEntries.length > 0 && (
          <div style={{ display:"flex", gap:3, marginTop:3, flexWrap:"wrap" }}>
            {reactionEntries.map(([emoji, uids]) => {
              const iMine = uids.includes(Number(user?.id));
              return (
                <div key={emoji} onClick={() => react(emoji)} style={{
                  display:"flex", alignItems:"center", gap:2,
                  padding:"1px 6px", borderRadius:10, cursor:"pointer",
                  background: iMine ? "var(--accent-glow)" : "var(--bg-raised)",
                  border: `1px solid ${iMine ? "var(--accent-dim)" : "var(--border)"}`,
                  fontSize:12,
                }}>
                  {emoji}
                  <span style={{ fontSize:10, color:"var(--text-3)" }}>{uids.length}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Reaction picker (double tap) */}
        {showReact && (
          <div style={{
            display:"flex", gap:6, padding:"8px 10px",
            background:"var(--bg-surface)", border:"1px solid var(--border)",
            borderRadius:24, boxShadow:"0 4px 20px rgba(0,0,0,.5)",
            marginTop:4, zIndex:10,
            animation:"popIn 150ms cubic-bezier(.34,1.56,.64,1)",
          }}>
            {REACTIONS.map(e => (
              <button key={e} onClick={() => react(e)} style={{
                fontSize:20, background:"none", border:"none",
                cursor:"pointer", padding:2, lineHeight:1,
                transition:"transform 100ms",
              }}
                onMouseEnter={el => el.target.style.transform = "scale(1.3)"}
                onMouseLeave={el => el.target.style.transform = "scale(1)"}>
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Time + status */}
        <div style={{
          display:"flex", alignItems:"center", gap:4,
          marginTop:2, paddingLeft: mine ? 0 : 4, paddingRight: mine ? 4 : 0,
          justifyContent: mine ? "flex-end" : "flex-start",
        }}>
          <span style={{ fontSize:10, color: mine ? "rgba(255,255,255,.5)" : "var(--text-3)" }}>
            {fmtTime(msg.created_at)}
          </span>
          {mine && !deleted && (
            <span style={{
              fontSize:10,
              color: status === "read" ? (mine ? "rgba(255,255,255,.9)" : "var(--accent)")
                : (mine ? "rgba(255,255,255,.5)" : "var(--text-3)"),
              fontWeight: status === "read" ? 600 : 400,
            }}>
              {status === "sending"   ? "Sending…" :
               status === "sent"      ? "Sent" :
               status === "delivered" ? "Delivered" :
               status === "read"      ? "Read" : ""}
            </span>
          )}
        </div>

        {/* Seen label — only on latest message, disappears when other is typing */}
        {mine && isSeen && isLatest && !isTyping && (
          <div style={{
            fontSize:10, color: mine ? "rgba(255,255,255,.7)" : "var(--accent)",
            textAlign: mine ? "right" : "left",
            marginTop:1, paddingRight: mine ? 4 : 0,
          }}>
            Seen
          </div>
        )}
      </div>
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
}
