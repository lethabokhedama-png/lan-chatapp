import React, { useEffect, useRef, useState } from "react";
import {
  Search, Paperclip, ArrowLeft, Send, X, Mic, Camera
} from "react-feather";
import useStore from "../../lib/store";
import { messages as msgsApi, getToken } from "../../lib/api";
import { emit } from "../../lib/socket";
import MessageBubble from "./MessageBubble";
import MessageMenu   from "./MessageMenu";
import SmartReplies  from "./SmartReplies";
import VoiceRecorder from "./VoiceRecorder";

const BASE = () => import.meta.env.VITE_API_URL || "";

export default function ChatWindow({ room }) {
  const {
    user, messages: msgMap, setMessages, prependMessages,
    appendMessage, typing, replyTo, setReplyTo,
    userMap, onlineSet, setActiveRoom,
  } = useStore();

  const isGroup  = room.type === "group" || room.type === "channel";
  const roomMsgs = msgMap[room.id] || [];

  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  const fileRef   = useRef(null);
  const photoRef  = useRef(null);

  const [input,         setInput]         = useState("");
  const [hasMore,       setHasMore]       = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQ,       setSearchQ]       = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [mentionQ,      setMentionQ]      = useState("");
  const [mentionIdx,    setMentionIdx]    = useState(0);
  const [showVoice,     setShowVoice]     = useState(false);
  const [menuMsg,       setMenuMsg]       = useState(null);
  const [editingMsg,    setEditingMsg]    = useState(null);

  const typingUids = (typing[room.id] || []).filter(u => Number(u) !== Number(user?.id));

  const mentionUsers = (isGroup && mentionQ)
    ? Object.values(userMap).filter(u =>
        Number(u.id) !== Number(user?.id) &&
        (u.username.toLowerCase().includes(mentionQ.toLowerCase()) ||
         (u.display_name || "").toLowerCase().includes(mentionQ.toLowerCase()))
      ).slice(0, 5)
    : [];

  useEffect(() => {
    setInput(""); setReplyTo(null); setEditingMsg(null);
    msgsApi.fetch(room.id, { limit: 50 }).then(msgs => {
      setMessages(room.id, msgs);
      setTimeout(() => scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight, behavior: "instant",
      }), 50);
    }).catch(() => {});
    emit.joinRoom(room.id);
  }, [room.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (near) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [roomMsgs.length]);

  async function onScroll() {
    const el = scrollRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop < 60) {
      setLoading(true);
      const oldest = roomMsgs[0];
      const older  = await msgsApi.fetch(room.id, { before: oldest?.id, limit: 30 }).catch(() => []);
      if (older.length < 30) setHasMore(false);
      if (older.length > 0) {
        const prev = el.scrollHeight;
        prependMessages(room.id, older);
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prev; });
      }
      setLoading(false);
    }
  }

  function onInputChange(e) {
    const val = e.target.value;
    setInput(val);
    emit.typingStart(room.id);
    const match = val.match(/@(\w*)$/);
    setMentionQ(match && isGroup ? match[1] : "");
  }

  function insertMention(u) {
    setInput(input.replace(/@\w*$/, `@${u.username} `));
    setMentionQ("");
    inputRef.current?.focus();
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content) return;

    if (editingMsg) {
      emit.editMsg(room.id, editingMsg.id, content);
      setEditingMsg(null);
      setInput("");
      return;
    }

    setInput("");
    setReplyTo(null);
    setMentionQ("");
    emit.typingStop(room.id);

    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    appendMessage(room.id, {
      id: null, client_id: clientId, room_id: room.id,
      sender_id: user.id, content, type: "text",
      created_at: new Date().toISOString(),
      reply_to_id: replyTo?.id || null,
      reply_to_content: replyTo?.content || null,
      reply_to_sender: replyTo ? (userMap[replyTo.sender_id]?.username || "") : null,
      _optimistic: true,
    });

    emit.sendMsg({
      roomId: room.id, content, type: "text",
      replyToId: replyTo?.id || null, clientId,
    });
  }

  function onKeyDown(e) {
    if (mentionUsers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => (i+1) % mentionUsers.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx(i => (i-1+mentionUsers.length) % mentionUsers.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionUsers[mentionIdx]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  async function sendFile(file, isPhoto, maxViews) {
    if (!file) return;
    const form  = new FormData();
    form.append("file", file);
    if (isPhoto && maxViews) form.append("max_views", maxViews);
    const token = getToken();
    try {
      const res  = await fetch(BASE() + (isPhoto ? "/api/uploads/photo" : "/api/uploads/file"), {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const data = await res.json();
      const url  = data.url || data.file_url || "";
      emit.sendMsg({
        roomId: room.id, content: url,
        type: isPhoto ? "image" : (file.type.startsWith("image/") ? "image" : "file"),
        file_url: url, max_views: maxViews || null,
        clientId: `c_${Date.now()}`,
      });
    } catch (_) {}
  }

  const dmOther = !isGroup
    ? Object.values(userMap).find(u =>
        Number(u.id) !== Number(user?.id) &&
        room.members?.some(m => Number(m.user_id) === Number(u.id))
      )
    : null;
  const dmOnline = dmOther ? onlineSet.has(Number(dmOther.id)) : false;

  useEffect(() => {
    if (!searchQ) { setSearchResults([]); return; }
    setSearchResults(roomMsgs.filter(m =>
      m.content?.toLowerCase().includes(searchQ.toLowerCase())
    ));
  }, [searchQ, roomMsgs]);

  const grouped = roomMsgs.reduce((acc, msg, i) => {
    const prev  = roomMsgs[i - 1];
    const first = !prev || prev.sender_id !== msg.sender_id ||
      new Date(msg.created_at) - new Date(prev.created_at) > 300000;
    acc.push({ msg, first });
    return acc;
  }, []);

  const latestMine = [...roomMsgs].reverse().find(m =>
    Number(m.sender_id) === Number(user?.id) && m.id
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: "var(--bg-base)", position: "relative",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)", flexShrink: 0, minHeight: 56,
      }}>
        <button className="icon-btn" onClick={() => setActiveRoom(null)}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: isGroup ? 10 : "50%",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden",
          }}>
            {dmOther?.avatar_url
              ? <img src={dmOther.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
              : (isGroup ? room.name?.[0] : dmOther?.display_name?.[0] || "?").toUpperCase()}
          </div>
          {!isGroup && (
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 10, height: 10, borderRadius: "50%",
              background: dmOnline ? "var(--green)" : "var(--text-3)",
              border: "2px solid var(--bg-surface)",
            }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isGroup ? room.name : (dmOther?.display_name || dmOther?.username || "DM")}
          </div>
          <div style={{ fontSize: 11, color: dmOnline ? "var(--green)" : "var(--text-3)" }}>
            {isGroup
              ? `${room.members?.length || 0} members`
              : (dmOnline ? "online" : "offline")}
          </div>
        </div>
        <button className="icon-btn" onClick={() => setSearchOpen(v => !v)}>
          <Search size={16} />
        </button>
      </div>

      {/* Search */}
      {searchOpen && (
        <div style={{
          padding: "8px 12px", background: "var(--bg-raised)",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Search size={13} color="var(--text-3)" />
          <input autoFocus placeholder="Search messages..." value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ flex:1, background:"transparent", border:"none", outline:"none",
              color:"var(--text-1)", fontSize:13, fontFamily:"var(--font-body)" }} />
          <button className="icon-btn" onClick={() => { setSearchOpen(false); setSearchQ(""); }}>
            <X size={13} />
          </button>
        </div>
      )}
      {searchResults.length > 0 && (
        <div style={{ padding:"6px 12px", background:"var(--bg-raised)",
          borderBottom:"1px solid var(--border)", maxHeight:120, overflowY:"auto", flexShrink:0 }}>
          {searchResults.map(m => (
            <div key={m.id} onClick={() => {
              const el = document.querySelector(`[data-msgid="${m.id}"]`);
              el?.scrollIntoView({ behavior:"smooth", block:"center" });
              if (el) { el.style.outline = "2px solid var(--accent)"; setTimeout(() => el.style.outline = "", 1200); }
            }} style={{ fontSize:12, padding:"4px 0", cursor:"pointer",
              color:"var(--text-2)", borderBottom:"1px solid var(--border-light)" }}>
              {m.content?.slice(0, 60)}
            </div>
          ))}
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div style={{
          display:"flex", alignItems:"center", gap:10, padding:"8px 14px",
          background:"var(--bg-raised)", borderBottom:"1px solid var(--border)",
          borderLeft:"3px solid var(--accent)", flexShrink:0,
        }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, color:"var(--accent)", fontWeight:600 }}>
              Replying to {userMap[replyTo.sender_id]?.display_name || userMap[replyTo.sender_id]?.username || "someone"}
            </div>
            <div style={{ fontSize:12, color:"var(--text-3)", overflow:"hidden",
              textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {replyTo.content?.slice(0, 60)}
            </div>
          </div>
          <button className="icon-btn" onClick={() => setReplyTo(null)}><X size={14} /></button>
        </div>
      )}

      {/* Edit bar */}
      {editingMsg && (
        <div style={{
          display:"flex", alignItems:"center", gap:10, padding:"8px 14px",
          background:"rgba(79,142,247,.1)", borderBottom:"1px solid var(--border)",
          borderLeft:"3px solid var(--accent)", flexShrink:0,
        }}>
          <div style={{ flex:1, fontSize:12, color:"var(--accent)" }}>Editing message</div>
          <button className="icon-btn" onClick={() => { setEditingMsg(null); setInput(""); }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Messages scroll area */}
      <div ref={scrollRef} onScroll={onScroll} style={{
        flex:1, overflowY:"auto", overflowX:"hidden",
        padding:"10px 0 6px", display:"flex", flexDirection:"column",
      }}>
        {loading && (
          <div style={{ textAlign:"center", padding:8, fontSize:11, color:"var(--text-3)" }}>
            Loading older messages...
          </div>
        )}

        {grouped.map(({ msg, first }, i) => {
          const mine     = Number(msg.sender_id) === Number(user?.id);
          const isLatest = msg.id && msg.id === latestMine?.id;
          return (
            <MessageBubble
              key={msg.id || msg.client_id || i}
              msg={msg}
              mine={mine}
              firstInGroup={first}
              room={room}
              isGroup={isGroup}
              isLatest={isLatest}
              typingUids={typingUids}
              onReply={() => setReplyTo(msg)}
              onEdit={() => { setEditingMsg(msg); setInput(msg.content || ""); }}
              onMenu={() => setMenuMsg(msg)}
            />
          );
        })}

        {typingUids.length > 0 && (
          <div style={{ padding:"4px 16px 8px", display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ display:"flex", gap:3 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:6, height:6, borderRadius:"50%", background:"var(--text-3)",
                  animation:`bounce 1s ease ${i*.15}s infinite`,
                }} />
              ))}
            </div>
            <span style={{ fontSize:11, color:"var(--text-3)" }}>
              {typingUids.map(id => userMap[id]?.username).filter(Boolean).join(", ")} typing…
            </span>
          </div>
        )}
      </div>

      {/* Mention suggestions */}
      {mentionUsers.length > 0 && (
        <div style={{
          position:"absolute", bottom:68, left:12, right:12,
          background:"var(--bg-surface)", border:"1px solid var(--border)",
          borderRadius:"var(--radius)", overflow:"hidden",
          boxShadow:"0 -8px 24px rgba(0,0,0,.4)", zIndex:20,
        }}>
          {mentionUsers.map((u, i) => (
            <div key={u.id} onClick={() => insertMention(u)} style={{
              display:"flex", alignItems:"center", gap:10, padding:"8px 14px",
              cursor:"pointer", background: i === mentionIdx ? "var(--bg-active)" : "transparent",
            }}>
              <div style={{
                width:26, height:26, borderRadius:"50%",
                background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:10, fontWeight:700, color:"#fff",
              }}>
                {(u.display_name || u.username)[0].toUpperCase()}
              </div>
              <span style={{ fontSize:13, color:"var(--text-1)" }}>{u.display_name || u.username}</span>
              <span style={{ fontSize:11, color:"var(--text-3)" }}>@{u.username}</span>
            </div>
          ))}
        </div>
      )}

      <SmartReplies roomId={room.id} onSelect={r => { setInput(r); inputRef.current?.focus(); }} />

      {showVoice && <VoiceRecorder roomId={room.id} onClose={() => setShowVoice(false)} />}

      {/* Input */}
      {!showVoice && (
        <div style={{
          padding:"8px 12px", background:"var(--bg-surface)",
          borderTop:"1px solid var(--border)", flexShrink:0,
          paddingBottom:"max(8px, env(safe-area-inset-bottom))",
        }}>
          <div style={{
            display:"flex", alignItems:"flex-end", gap:8,
            background:"var(--bg-raised)", border:"1px solid var(--border)",
            borderRadius:24, padding:"6px 8px 6px 14px",
          }}>
            <button className="icon-btn" style={{ flexShrink:0, marginBottom:2 }}
              onClick={() => fileRef.current?.click()}>
              <Paperclip size={17} />
            </button>
            <input ref={fileRef} type="file" style={{ display:"none" }}
              onChange={e => sendFile(e.target.files[0], false, null)} />

            <button className="icon-btn" style={{ flexShrink:0, marginBottom:2 }}
              onClick={() => photoRef.current?.click()}>
              <Camera size={17} />
            </button>
            <input ref={photoRef} type="file" accept="image/*" style={{ display:"none" }}
              onChange={e => sendFile(e.target.files[0], true, 1)} />

            <textarea ref={inputRef} value={input} onChange={onInputChange} onKeyDown={onKeyDown}
              placeholder={editingMsg ? "Edit message..." : "Message..."}
              rows={1} style={{
                flex:1, background:"transparent", border:"none", outline:"none",
                color:"var(--text-1)", fontSize:14, fontFamily:"var(--font-body)",
                resize:"none", lineHeight:1.5, maxHeight:100, overflowY:"auto", paddingTop:3,
              }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
              }}
            />

            <button className="icon-btn" style={{ flexShrink:0, marginBottom:2 }}
              onClick={() => setShowVoice(true)}>
              <Mic size={17} />
            </button>

            {input.trim() && (
              <button onClick={sendMessage} style={{
                width:34, height:34, borderRadius:"50%", flexShrink:0,
                background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                border:"none", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 2px 10px var(--accent-glow)",
              }}>
                <Send size={15} color="#fff" />
              </button>
            )}
          </div>
        </div>
      )}

      {menuMsg && (
        <MessageMenu
          msg={menuMsg}
          mine={Number(menuMsg.sender_id) === Number(user?.id)}
          room={room}
          onClose={() => setMenuMsg(null)}
          onReply={() => { setReplyTo(menuMsg); setMenuMsg(null); }}
          onEdit={() => { setEditingMsg(menuMsg); setInput(menuMsg.content || ""); setMenuMsg(null); }}
        />
      )}

      <style>{`
        @keyframes bounce {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
