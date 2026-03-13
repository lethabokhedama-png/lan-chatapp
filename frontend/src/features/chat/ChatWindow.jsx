import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  List, MagnifyingGlass, Paperclip, ArrowLeft,
  PaperPlaneTilt, X, Smiley
} from "@phosphor-icons/react";
import useStore   from "../../lib/store";
import { messages as msgsApi, uploads } from "../../lib/api";
import { emit }   from "../../lib/socket";
import MessageBubble   from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import SmartReplies from "./SmartReplies";



export default function ChatWindow({ room }) {
  const {
    user, messages: msgMap, setMessages, prependMessages,
    appendMessage, typing, replyTo, setReplyTo,
    userMap, onlineSet, toggleSidebar, setActiveRoom,
  } = useStore();

  const roomMsgs   = msgMap[room.id] || [];
  const typingUids = (typing[room.id] || []).filter(u => u !== user?.id);

  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);
  const fileRef    = useRef(null);
  const [input, setInput]     = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQ, setSearchQ]         = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    setInput(""); setReplyTo(null);
    msgsApi.fetch(room.id, { limit: 50 }).then(msgs => {
      setMessages(room.id, msgs);
      setHasMore(msgs.length === 50);
      setTimeout(scrollToBottom, 80);
      if (msgs.length) emit.seen(room.id, msgs[msgs.length - 1].id);
    }).catch(() => {});
    emit.joinRoom(room.id);
  }, [room.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) scrollToBottom();
  }, [roomMsgs.length]);

  function scrollToBottom() {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }

  async function loadOlder() {
    if (loading || !hasMore) return;
    setLoading(true);
    const oldest = roomMsgs[0];
    const prev = scrollRef.current?.scrollHeight || 0;
    const msgs = await msgsApi.fetch(room.id, { limit: 50, before_id: oldest?.id }).catch(() => []);
    prependMessages(room.id, msgs);
    setHasMore(msgs.length === 50);
    setLoading(false);
    setTimeout(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prev;
    }, 0);
  }

  const typingTimer = useRef(null);
  function onInput(e) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
    emit.typingStart(room.id);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emit.typingStop(room.id), 1800);
  }

  function sendMsg(content) {
    if (!content.trim()) return;
    const clientId = `tmp_${Date.now()}`;
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
    setInput(""); setReplyTo(null);
    emit.typingStop(room.id);
    clearTimeout(typingTimer.current);
    if (inputRef.current) inputRef.current.style.height = "auto";
    setTimeout(scrollToBottom, 80);
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); sendMsg(input);
    }
  }

  async function onFile(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    const meta = await uploads.upload(file, room.id).catch(() => null);
    if (!meta) return;
    emit.sendMsg({ roomId: room.id, content: file.name,
      type: file.type.startsWith("image/") ? "image" : "file",
      fileId: meta.id, clientId: `tmp_${Date.now()}` });
  }

  let headerName = room.name;
  let headerSub  = "";
  let otherId    = null;
  if (room.type === "dm") {
    otherId    = room.members?.find?.(m => m.user_id !== user?.id)?.user_id;
    const other = userMap[otherId];
    headerName  = other?.display_name || other?.username || "Direct Message";
    headerSub   = onlineSet.has(otherId) ? "online" : "offline";
  } else {
    headerSub = room.topic || `${room.members?.length || 0} members`;
  }

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

  const grouped = groupMessages(roomMsgs);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", overflow: "hidden",
    }}>
      {/* Header */}
      <div className="chat-header">
        <button className="icon-btn hamburger" onClick={toggleSidebar}>
          <List size={20} weight="bold" />
        </button>
        <button className="icon-btn" onClick={() => setActiveRoom(null)}
          style={{ display: "flex" }} title="Back">
          <ArrowLeft size={18} weight="bold" />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
          {room.type === "dm" && otherId && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff",
              }}>
                {(userMap[otherId]?.display_name || userMap[otherId]?.username || "?")[0].toUpperCase()}
              </div>
              <div style={{
                position: "absolute", bottom: 0, right: 0,
                width: 9, height: 9, borderRadius: "50%",
                background: onlineSet.has(otherId) ? "var(--green)" : "var(--text-3)",
                border: "2px solid var(--bg-base)",
                boxShadow: onlineSet.has(otherId) ? "0 0 5px var(--green)" : "none",
              }} />
            </div>
          )}
          <div className="chat-header-info">
            <div className="chat-header-name">
              {room.type === "channel" ? "# " : ""}{headerName}
            </div>
            {headerSub && (
              <div className="chat-header-sub" style={{
                color: headerSub === "online" ? "var(--green)" : undefined,
              }}>
                {headerSub === "online" ? "● online" : headerSub}
              </div>
            )}
          </div>
        </div>

        <button className="icon-btn" onClick={() => setSearchOpen(v => !v)} title="Search">
          <MagnifyingGlass size={17} weight="bold" />
        </button>
      </div>

      {/* Search dropdown */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ padding: "8px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7,
                background: "var(--bg-raised)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "7px 11px" }}>
                <MagnifyingGlass size={13} color="var(--text-3)" />
                <input placeholder="Search messages…" autoFocus value={searchQ}
                  onChange={onSearch}
                  style={{ flex: 1, background: "transparent", border: "none",
                    outline: "none", color: "var(--text-1)", fontSize: 13,
                    fontFamily: "var(--font-body)" }} />
                {searchQ && <button className="icon-btn" style={{ width: 18, height: 18 }}
                  onClick={() => { setSearchQ(""); setSearchResults([]); }}>
                  <X size={11} /></button>}
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column",
                gap: 3, maxHeight: 180, overflowY: "auto" }}>
                {searchResults.map(m => (
                  <div key={m.id} onClick={() => {
                    document.querySelector(`[data-msgid="${m.id}"]`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    setSearchOpen(false);
                  }} style={{ padding: "5px 8px", background: "var(--bg-raised)",
                    borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer" }}>
                    <span style={{ color: "var(--accent)" }}>
                      {userMap[m.sender_id]?.display_name || "User"}
                    </span>
                    <span style={{ color: "var(--text-3)", marginLeft: 6, fontSize: 10 }}>
                      {m.created_at?.slice(0, 10)}
                    </span>
                    <div style={{ marginTop: 2 }}>{m.content?.slice(0, 80)}</div>
                  </div>
                ))}
                {searchQ && !searchResults.length && (
                  <div style={{ color: "var(--text-3)", fontSize: 12, padding: "4px 8px" }}>
                    No results
                  </div>
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
              <MessageBubble msg={msg} firstInGroup={firstInGroup}
                mine={msg.sender_id === user?.id} room={room} />
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Typing indicator */}
      <TypingIndicator roomId={room.id} />

      {/* Smart replies */}
      <SmartReplies
        lastMessage={roomMsgs[roomMsgs.length - 1]}
        onSelect={sendMsg}
        inputValue={input}
      />

      {/* Reply bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div className="reply-bar"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}>
            <span>↩ Replying to <strong>{userMap[replyTo.sender_id]?.display_name || "User"}</strong></span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap", color: "var(--text-3)" }}>
              {replyTo.content?.slice(0, 50)}
            </span>
            <button className="icon-btn" onClick={() => setReplyTo(null)}>
              <X size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="input-area">
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={onFile} />
        <div className="input-shell">
          <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Attach">
            <Paperclip size={17} weight="bold" />
          </button>
          <textarea ref={inputRef} className="msg-textarea" rows={1}
            placeholder={`Message ${room.type === "channel" ? "#" + room.name : headerName}…`}
            value={input} onChange={onInput} onKeyDown={onKeyDown} />
          <button className="send-btn" disabled={!input.trim()} onClick={() => sendMsg(input)}>
            <PaperPlaneTilt size={16} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}

function groupMessages(msgs) {
  const result = []; let lastSender = null, lastDate = null, lastTs = null;
  const WIN = 5 * 60 * 1000;
  for (const msg of msgs) {
    const date = msg.created_at?.slice(0, 10);
    const ts   = new Date(msg.created_at).getTime();
    const same = lastSender === msg.sender_id && ts - lastTs < WIN && date === lastDate;
    result.push({ msg, firstInGroup: !same, showDate: date !== lastDate, dateLabel: fmtDate(msg.created_at) });
    lastSender = msg.sender_id; lastDate = date; lastTs = ts;
  }
  return result;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso), t = new Date(), y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}
