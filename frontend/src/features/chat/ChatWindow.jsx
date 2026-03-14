import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Search, Paperclip, ArrowLeft, Send, X, Mic, Camera } from "react-feather";
import useStore from "../../lib/store";
import { messages as msgsApi, getToken } from "../../lib/api";
import { emit } from "../../lib/socket";
import MessageBubble from "./MessageBubble";
import SmartReplies  from "./SmartReplies";
import VoiceRecorder from "./VoiceRecorder";

export default function ChatWindow({ room }) {
  const {
    user, messages: msgMap, setMessages, prependMessages,
    appendMessage, typing, replyTo, setReplyTo,
    userMap, onlineSet, toggleSidebar, setActiveRoom,
  } = useStore();

  const isGroup  = room.type === "group" || room.type === "channel";
  const roomMsgs = msgMap[room.id] || [];

  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  const fileRef   = useRef(null);
  const photoRef  = useRef(null);

  const [input, setInput]                 = useState("");
  const [hasMore, setHasMore]             = useState(true);
  const [loading, setLoading]             = useState(false);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [searchQ, setSearchQ]             = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [mentionQ, setMentionQ]           = useState("");
  const [mentionIdx, setMentionIdx]       = useState(0);
  const [showVoice, setShowVoice]         = useState(false);
  const [photoMode, setPhotoMode]         = useState(null); // null | "once" | "twice"

  const typingUids = (typing[room.id] || []).filter(u => Number(u) !== Number(user?.id));

  const mentionUsers = (isGroup && mentionQ)
    ? Object.values(userMap).filter(u =>
        Number(u.id) !== Number(user?.id) &&
        (u.username.toLowerCase().includes(mentionQ.toLowerCase()) ||
         (u.display_name || "").toLowerCase().includes(mentionQ.toLowerCase()))
      ).slice(0, 5)
    : [];

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
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) scrollToBottom();
  }, [roomMsgs.length]);

  function scrollToBottom() {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }

  async function loadOlder() {
    if (loading || !hasMore) return;
    setLoading(true);
    const oldest = roomMsgs[0];
    const prev   = scrollRef.current?.scrollHeight || 0;
    const msgs   = await msgsApi.fetch(room.id, { limit: 50, before_id: oldest?.id }).catch(() => []);
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
    const val = e.target.value;
    setInput(val);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
    if (isGroup) {
      const match = val.slice(0, e.target.selectionStart).match(/@(\w*)$/);
      setMentionQ(match ? match[1] : "");
      setMentionIdx(0);
    }
    emit.typingStart(room.id);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emit.typingStop(room.id), 1800);
  }

  function insertMention(u) {
    const pos    = inputRef.current?.selectionStart || input.length;
    const before = input.slice(0, pos).replace(/@\w*$/, `@${u.username} `);
    setInput(before + input.slice(pos));
    setMentionQ("");
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (mentionUsers.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => (i+1) % mentionUsers.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx(i => (i-1+mentionUsers.length) % mentionUsers.length); return; }
      if (e.key === "Enter" && mentionUsers.length) { e.preventDefault(); insertMention(mentionUsers[mentionIdx]); return; }
      if (e.key === "Escape") { setMentionQ(""); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(input); }
  }

  function sendMsg(content) {
    if (!content.trim()) return;
    const clientId = `tmp_${Date.now()}`;
    const mentionedUids = [];
    if (isGroup) {
      for (const m of content.matchAll(/@(\w+)/g)) {
        const found = Object.values(userMap).find(u => u.username === m[1]);
        if (found) mentionedUids.push(found.id);
      }
    }
    appendMessage(room.id, {
      id: null, client_id: clientId, room_id: room.id,
      sender_id: user.id, content: content.trim(), type: "text",
      created_at: new Date().toISOString(),
      delivered_to: [], seen_by: [], _optimistic: true,
      reply_to_id: replyTo?.id || null,
      reply_to_content: replyTo?.content || null,
      reply_to_sender: replyTo
        ? (userMap[replyTo.sender_id]?.display_name || userMap[replyTo.sender_id]?.username)
        : null,
    });
    emit.sendMsg({
      roomId: room.id, content: content.trim(), type: "text",
      replyTo: replyTo?.id || null, clientId, mentionedUids,
    });
    setInput(""); setReplyTo(null); setMentionQ("");
    emit.typingStop(room.id);
    clearTimeout(typingTimer.current);
    if (inputRef.current) inputRef.current.style.height = "auto";
    setTimeout(scrollToBottom, 80);

    // Learn reply pattern
    const state = useStore.getState();
    const msgs  = state.messages[room.id] || [];
    const prev  = [...msgs].reverse().find(m => Number(m.sender_id) !== Number(user.id));
    if (prev?.content) {
      fetch((import.meta.env.VITE_API_URL || "") + "/api/dev/learn-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ context: prev.content, reply: content.trim() }),
      }).catch(() => {});
    }
  }

  async function onFile(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    const BASE  = import.meta.env.VITE_API_URL || "";
    const token = getToken();
    const form  = new FormData();
    form.append("file", file);
    form.append("room_id", room.id);
    try {
      const res  = await fetch(`${BASE}/api/uploads/file`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const meta = await res.json();
      emit.sendMsg({
        roomId: room.id, content: file.name,
        type: file.type.startsWith("image/") ? "image" : "file",
        fileId: meta.id, clientId: `tmp_${Date.now()}`,
      });
    } catch (_) {}
  }

  async function onPhoto(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    const BASE  = import.meta.env.VITE_API_URL || "";
    const token = getToken();
    const form  = new FormData();
    form.append("file", file);
    form.append("room_id", room.id);
    form.append("max_views", photoMode === "once" ? "1" : "2");
    try {
      const res  = await fetch(`${BASE}/api/uploads/photo`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const meta = await res.json();
      emit.sendMsg({
        roomId: room.id, content: file.name,
        type: "image", fileId: meta.id,
        maxViews: photoMode === "once" ? 1 : 2,
        clientId: `tmp_${Date.now()}`,
      });
    } catch (_) {}
    setPhotoMode(null);
  }

  // Header info
  let headerName = room.name;
  let headerSub  = "";
  let otherId    = null;
  if (room.type === "dm") {
    otherId      = room.members?.find?.(m => Number(m.user_id) !== Number(user?.id))?.user_id;
    const other  = userMap[Number(otherId)];
    headerName   = other?.display_name || other?.username || "Direct Message";
    headerSub    = onlineSet.has(Number(otherId)) ? "online" : "offline";
  } else {
    headerSub = room.topic || `${room.members?.length || 0} members`;
  }

  const otherTyping = typingUids.map(uid =>
    userMap[Number(uid)]?.display_name || userMap[Number(uid)]?.username || "Someone"
  );

  const searchTimer = useRef(null);
  function onSearch(e) {
    setSearchQ(e.target.value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      if (!e.target.value.trim()) { setSearchResults([]); return; }
      const r = await msgsApi.search?.(room.id, e.target.value).catch(() => []) || [];
      setSearchResults(r);
    }, 300);
  }

  const lastMsg = roomMsgs[roomMsgs.length - 1];
  const grouped = groupMessages(roomMsgs);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="chat-header">
        <button className="icon-btn hamburger" onClick={toggleSidebar}><Menu size={20} /></button>
        <button className="icon-btn" onClick={() => setActiveRoom(null)} title="Back">
          <ArrowLeft size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
          {room.type === "dm" && otherId && (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "#fff",
              }}>
                {(userMap[Number(otherId)]?.display_name || userMap[Number(otherId)]?.username || "?")[0].toUpperCase()}
              </div>
              <div style={{
                position: "absolute", bottom: 0, right: 0,
                width: 9, height: 9, borderRadius: "50%",
                background: onlineSet.has(Number(otherId)) ? "var(--green)" : "var(--text-3)",
                border: "2px solid var(--bg-surface)",
              }} />
            </div>
          )}
          {isGroup && (
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>👥</div>
          )}
          <div className="chat-header-info">
            <div className="chat-header-name">{headerName}</div>
            {headerSub && (
              <div className="chat-header-sub" style={{
                color: headerSub === "online" ? "var(--green)" : undefined,
              }}>
                {headerSub === "online" ? "● online"
                  : headerSub === "offline" ? "● offline"
                  : headerSub}
              </div>
            )}
          </div>
        </div>

        <button className="icon-btn" onClick={() => setSearchOpen(v => !v)} title="Search">
          <Search size={17} />
        </button>
      </div>

      {/* Search dropdown */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ padding: "8px 12px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "var(--bg-raised)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "7px 11px",
              }}>
                <Search size={13} color="var(--text-3)" />
                <input autoFocus placeholder="Search messages…" value={searchQ} onChange={onSearch}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "var(--text-1)", fontSize: 13, fontFamily: "var(--font-body)" }} />
                {searchQ && (
                  <button className="icon-btn" style={{ width: 18, height: 18 }}
                    onClick={() => { setSearchQ(""); setSearchResults([]); }}>
                    <X size={11} />
                  </button>
                )}
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
          {grouped.map(({ msg, firstInGroup, showDate, dateLabel }, idx) => (
            <React.Fragment key={msg.id || msg.client_id}>
              {showDate && <div className="date-divider">{dateLabel}</div>}
              <MessageBubble
                msg={msg}
                firstInGroup={firstInGroup}
                mine={Number(msg.sender_id) === Number(user?.id)}
                room={room}
                isGroup={isGroup}
                isLatest={idx === grouped.length - 1}
                onReply={() => setReplyTo(msg)}
                typingUids={typingUids}
              />
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Typing indicator */}
      <div className="typing-bar">
        {otherTyping.length > 0 && (
          <>
            <div className="typing-dots"><span/><span/><span/></div>
            <span>
              💬 <strong style={{ color: "var(--accent)" }}>{otherTyping.join(", ")}</strong>
              {otherTyping.length === 1 ? " is typing…" : " are typing…"}
            </span>
          </>
        )}
      </div>

      {/* Smart replies */}
      <SmartReplies lastMessage={lastMsg} onSelect={sendMsg} inputValue={input} />

      {/* Reply bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div className="reply-bar"
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--accent)", marginBottom: 2 }}>
                ↩ Replying to {userMap[replyTo.sender_id]?.display_name || "User"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {replyTo.content?.slice(0, 60)}
              </div>
            </div>
            <button className="icon-btn" onClick={() => setReplyTo(null)}><X size={13} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice recorder */}
      <AnimatePresence>
        {showVoice && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", flexShrink: 0 }}>
            <VoiceRecorder roomId={room.id} onClose={() => setShowVoice(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disappearing photo mode picker */}
      <AnimatePresence>
        {photoMode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 14px", flexShrink: 0,
              background: "var(--bg-raised)", borderTop: "1px solid var(--border)",
              fontSize: 12,
            }}>
            <span style={{ color: "var(--accent)" }}>📸</span>
            <span style={{ color: "var(--text-2)", flex: 1 }}>
              {photoMode === "once"
                ? "View once — disappears after opening"
                : "View twice — opens 2 times then gone"}
            </span>
            <button onClick={() => photoRef.current?.click()} style={{
              padding: "4px 12px", borderRadius: 20,
              background: "var(--accent)", border: "none",
              color: "#fff", fontSize: 11, cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}>
              Choose photo
            </button>
            <button className="icon-btn" onClick={() => setPhotoMode(null)}><X size={13} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="input-area" style={{ position: "relative" }}>
        {/* @mention popup */}
        <AnimatePresence>
          {isGroup && mentionUsers.length > 0 && (
            <motion.div className="mention-popup"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}>
              {mentionUsers.map((u, i) => (
                <div key={u.id}
                  className={`mention-item${i === mentionIdx ? " selected" : ""}`}
                  onClick={() => insertMention(u)}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                  }}>
                    {(u.display_name || u.username)[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: 10, color: "var(--text-3)" }}>@{u.username}</div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <input ref={fileRef}  type="file" style={{ display: "none" }} onChange={onFile} />
        <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhoto} />

        <div className="input-shell">
          <button className="icon-btn" title="Attach file" onClick={() => fileRef.current?.click()}>
            <Paperclip size={17} />
          </button>

          <button className="icon-btn" title="Voice note"
            onClick={() => setShowVoice(v => !v)}>
            <Mic size={17} color={showVoice ? "var(--accent)" : undefined} />
          </button>

          <div style={{ position: "relative" }}>
            <button className="icon-btn" title="Disappearing photo"
              onClick={() => setPhotoMode(m => m ? null : "once")}>
              <Camera size={17} color={photoMode ? "var(--accent)" : undefined} />
            </button>
            {photoMode === "once" && (
              <button onClick={() => setPhotoMode("twice")} style={{
                position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "5px 10px", fontSize: 11,
                cursor: "pointer", whiteSpace: "nowrap", color: "var(--text-2)",
                fontFamily: "var(--font-body)", zIndex: 10,
              }}>
                Switch to 2× view
              </button>
            )}
          </div>

          <textarea
            ref={inputRef}
            className="msg-textarea"
            rows={1}
            placeholder={isGroup ? `Message #${room.name}… (@ to mention)` : `Message ${headerName}…`}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
          />

          <button className="send-btn" disabled={!input.trim()} onClick={() => sendMsg(input)}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function groupMessages(msgs) {
  const result = [];
  let lastSender = null, lastDate = null, lastTs = null;
  const WIN = 5 * 60 * 1000;
  for (const msg of msgs) {
    const date = msg.created_at?.slice(0, 10);
    const ts   = new Date(msg.created_at).getTime();
    const same = lastSender === msg.sender_id && ts - lastTs < WIN && date === lastDate;
    result.push({
      msg,
      firstInGroup: !same,
      showDate: date !== lastDate,
      dateLabel: fmtDate(msg.created_at),
    });
    lastSender = msg.sender_id;
    lastDate   = date;
    lastTs     = ts;
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
