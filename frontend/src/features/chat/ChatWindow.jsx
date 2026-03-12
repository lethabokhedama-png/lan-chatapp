import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useStore   from "../../lib/store";
import { messages as msgsApi, uploads } from "../../lib/api";
import { emit }   from "../../lib/socket";
import MessageBubble  from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import Avatar     from "../../ui/Avatar";

const SMART_REPLIES = ["👍", "Ok", "On my way", "Be right back", "Thanks!", "Sounds good"];

export default function ChatWindow({ room }) {
  const {
    user, messages: msgMap, setMessages, prependMessages,
    appendMessage, typing, replyTo, setReplyTo,
    setProfilePanel, userMap, onlineSet,
  } = useStore();

  const roomMsgs  = msgMap[room.id] || [];
  const typingUids = (typing[room.id] || []).filter(u => u !== user?.id);

  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);
  const fileRef    = useRef(null);
  const [input, setInput] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ]       = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // ── Load initial messages ────────────────────────────────────────────────────
  useEffect(() => {
    setInput("");
    setReplyTo(null);
    msgsApi.fetch(room.id, { limit: 50 }).then(msgs => {
      setMessages(room.id, msgs);
      setHasMore(msgs.length === 50);
      setTimeout(() => scrollToBottom(), 60);
      // Mark last visible as seen
      if (msgs.length) emit.seen(room.id, msgs[msgs.length - 1].id);
    }).catch(() => {});
  }, [room.id]);

  // ── Auto-scroll on new messages ──────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) scrollToBottom();
  }, [roomMsgs.length]);

  function scrollToBottom() {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Load older ───────────────────────────────────────────────────────────────
  async function loadOlder() {
    if (loading || !hasMore) return;
    setLoading(true);
    const oldest = roomMsgs[0];
    const prev = scrollRef.current?.scrollHeight;
    const msgs = await msgsApi.fetch(room.id, { limit: 50, before_id: oldest?.id }).catch(() => []);
    prependMessages(room.id, msgs);
    setHasMore(msgs.length === 50);
    setLoading(false);
    // Preserve scroll position
    setTimeout(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prev;
    }, 0);
  }

  // ── Typing ───────────────────────────────────────────────────────────────────
  const typingTimer = useRef(null);
  function onInput(e) {
    setInput(e.target.value);
    // auto-resize
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    // typing event
    emit.typingStart(room.id);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emit.typingStop(room.id), 1800);
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  function sendMsg(content) {
    if (!content.trim()) return;
    const clientId = `tmp_${Date.now()}`;
    // Optimistic bubble
    appendMessage(room.id, {
      id: null, client_id: clientId, room_id: room.id,
      sender_id: user.id, content: content.trim(),
      type: "text", created_at: new Date().toISOString(),
      delivered_to: [], seen_by: [], _optimistic: true,
    });
    emit.sendMsg({
      roomId: room.id, content: content.trim(),
      type: "text", replyTo: replyTo?.id || null, clientId,
    });
    setInput("");
    setReplyTo(null);
    emit.typingStop(room.id);
    clearTimeout(typingTimer.current);
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    setTimeout(scrollToBottom, 60);
  }

  function onKeyDown(e) {
    const prefs = useStore.getState().prefs;
    if (e.key === "Enter" && !e.shiftKey && prefs?.enter_to_send !== false) {
      e.preventDefault();
      sendMsg(input);
    }
    if (e.key === "r" && e.altKey && roomMsgs.length) {
      setReplyTo(roomMsgs[roomMsgs.length - 1]);
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────────
  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const meta = await uploads.upload(file, room.id).catch(() => null);
    if (!meta) return;
    const isImg = file.type.startsWith("image/");
    emit.sendMsg({
      roomId: room.id, content: file.name,
      type: isImg ? "image" : "file",
      fileId: meta.id,
      clientId: `tmp_${Date.now()}`,
    });
  }

  // ── Room header info ─────────────────────────────────────────────────────────
  let headerName = room.name;
  let headerSub  = "";
  if (room.type === "dm") {
    const otherId = room.members?.find?.(m => m.user_id !== user?.id)?.user_id;
    const other   = userMap[otherId];
    headerName    = other?.display_name || other?.username || "Direct Message";
    headerSub     = onlineSet.has(otherId) ? "● online" : "offline";
  } else {
    headerSub = `${room.members?.length || 0} members${room.topic ? " · " + room.topic : ""}`;
  }

  // ── Search ───────────────────────────────────────────────────────────────────
  const searchTimer = useRef(null);
  function onSearch(e) {
    setSearchQ(e.target.value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!e.target.value.trim()) { setSearchResults([]); return; }
      const r = await msgsApi.search(room.id, e.target.value).catch(() => []);
      setSearchResults(r);
    }, 300);
  }

  // ── Group consecutive messages ────────────────────────────────────────────────
  const grouped = groupMessages(roomMsgs);

  return (
    <>
      {/* Header */}
      <div className="chat-header">
        <button className="icon-btn" style={{ display: "none" }}
          id="sidebar-toggle" onClick={() => useStore.getState().toggleSidebar()}>
          ☰
        </button>
        <div className="chat-header-info">
          <div className="chat-header-name">
            {room.type === "channel" ? "# " : ""}{headerName}
          </div>
          {headerSub && <div className="chat-header-sub">{headerSub}</div>}
        </div>
        <button className="icon-btn" title="Search (/ key)"
          onClick={() => setSearchOpen(v => !v)}>⌕</button>
        <button className="icon-btn" title="Members"
          onClick={() => useStore.getState().setProfilePanel(null)}>👥</button>
      </div>

      {/* Room search */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden", borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "8px 14px" }}>
              <input className="input" placeholder="Search messages…"
                autoFocus value={searchQ} onChange={onSearch}
                style={{ fontSize: 12, padding: "7px 11px" }} />
              <div style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 4,
                maxHeight: 200, overflowY: "auto" }}>
                {searchResults.map(m => (
                  <div key={m.id}
                    style={{ padding: "5px 8px", background: "var(--bg-raised)",
                      borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer" }}
                    onClick={() => {
                      document.querySelector(`[data-msgid="${m.id}"]`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      setSearchOpen(false);
                    }}>
                    <span style={{ color: "var(--accent)" }}>
                      {userMap[m.sender_id]?.display_name || "User"}
                    </span>
                    <span style={{ color: "var(--text-3)", marginLeft: 6, fontSize: 10 }}>
                      {m.created_at?.slice(0, 10)}
                    </span>
                    <div style={{ marginTop: 2 }}>{m.content?.slice(0, 80)}</div>
                  </div>
                ))}
                {searchQ && searchResults.length === 0 && (
                  <div style={{ color: "var(--text-3)", fontSize: 12 }}>No results</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="msg-scroll" ref={scrollRef}>
        {hasMore && (
          <button className="load-older" onClick={loadOlder} disabled={loading}>
            {loading ? "Loading…" : "Load older messages"}
          </button>
        )}
        <div className="msg-list">
          {grouped.map(({ msg, firstInGroup, showDate, dateLabel }) => (
            <React.Fragment key={msg.id || msg.client_id}>
              {showDate && <div className="date-divider">{dateLabel}</div>}
              <MessageBubble
                msg={msg}
                firstInGroup={firstInGroup}
                mine={msg.sender_id === user?.id}
                room={room}
              />
            </React.Fragment>
          ))}
        </div>
      </div>

      <TypingIndicator roomId={room.id} />

      {/* Smart replies */}
      {roomMsgs.length > 0 && (
        <div className="smart-replies">
          {SMART_REPLIES.map(r => (
            <button key={r} className="smart-chip" onClick={() => sendMsg(r)}>{r}</button>
          ))}
        </div>
      )}

      {/* Reply bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div className="reply-bar"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}>
            <span>↩ Replying to </span>
            <strong>{userMap[replyTo.sender_id]?.display_name || "User"}</strong>
            <span style={{ color: "var(--text-3)", marginLeft: 8, flex: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {replyTo.content?.slice(0, 50)}
            </span>
            <button className="icon-btn" onClick={() => setReplyTo(null)}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="input-area">
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={onFile} />
        <div className="input-shell">
          <button className="icon-btn" style={{ fontSize: 16 }} title="Attach"
            onClick={() => fileRef.current?.click()}>📎</button>
          <textarea ref={inputRef} className="msg-textarea" rows={1}
            placeholder="Message…"
            value={input} onChange={onInput} onKeyDown={onKeyDown} />
          <button className="send-btn" disabled={!input.trim()}
            onClick={() => sendMsg(input)}>▶</button>
        </div>
      </div>
    </>
  );
}

// ── Grouping helper ────────────────────────────────────────────────────────────
function groupMessages(msgs) {
  const result = [];
  let lastSender = null;
  let lastDate   = null;
  let lastTs     = null;
  const GROUP_WINDOW = 5 * 60 * 1000; // 5 min

  for (const msg of msgs) {
    const date  = msg.created_at?.slice(0, 10);
    const ts    = new Date(msg.created_at).getTime();
    const sameGroup = lastSender === msg.sender_id &&
      ts - lastTs < GROUP_WINDOW &&
      date === lastDate;

    result.push({
      msg,
      firstInGroup: !sameGroup,
      showDate:     date !== lastDate,
      dateLabel:    formatDate(msg.created_at),
    });

    lastSender = msg.sender_id;
    lastDate   = date;
    lastTs     = ts;
  }
  return result;
}

function formatDate(iso) {
  if (!iso) return "";
  const d     = new Date(iso);
  const today = new Date();
  const yest  = new Date(); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString())  return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}