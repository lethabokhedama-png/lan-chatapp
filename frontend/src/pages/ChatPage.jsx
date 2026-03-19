import React, { useState, useEffect } from "react";
import { MessageSquare, Users, Settings, Plus } from "react-feather";
import BottomNav    from "../ui/BottomNav";
import ChatWindow   from "../features/chat/ChatWindow";
import ProfilePanel from "../features/profile/ProfilePanel";
import SettingsPage from "./SettingsPage";
import DevPanel     from "../features/dev/DevPanel";
import useStore     from "../lib/store";
import { rooms as roomsApi } from "../lib/api";
import { emit, getSocket } from "../lib/socket";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function getGreeting(name) {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return `Good morning, ${name}`;
  if (h >= 12 && h < 17) return `Good afternoon, ${name}`;
  if (h >= 17 && h < 21) return `Good evening, ${name}`;
  return `Hey, ${name} — up late?`;
}

// ── Main ChatPage ─────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { activeRoom, profilePanel, user } = useStore();
  const [navTab,   setNavTab]   = useState("home");
  const [showDev,  setShowDev]  = useState(false);

  const devUnlocked = user?.username === "lethabok" ||
    localStorage.getItem("lanchat_dev_unlocked") === "1";

  function onNavigate(tab) {
    setNavTab(tab);
    useStore.getState().setActiveRoom(null);
  }

  if (navTab === "settings" && !activeRoom) {
    return (
      <div style={{
        display:"flex", height:"100dvh", width:"100vw",
        overflow:"hidden", position:"fixed", inset:0, flexDirection:"column",
      }}>
        <div style={{ flex:1, overflow:"hidden" }}>
          <SettingsPage
            onBack={() => setNavTab("home")}
            devUnlocked={devUnlocked}
            onOpenDev={() => setShowDev(true)}
          />
        </div>
        <BottomNav active={navTab} onNavigate={onNavigate} />
        {showDev && <DevPanel onClose={() => setShowDev(false)} />}
      </div>
    );
  }

  return (
    <div style={{
      display:"flex", height:"100dvh", width:"100vw",
      overflow:"hidden", position:"fixed", inset:0,
    }}>
      <div style={{
        flex:1, minWidth:0, display:"flex", flexDirection:"column",
        height:"100%", overflow:"hidden", paddingBottom:"60px",
      }}>
        {activeRoom
          ? <ChatWindow room={activeRoom} />
          : <LandingPanel navTab={navTab} setNavTab={setNavTab} />}
      </div>
      {profilePanel && <ProfilePanel user={profilePanel} />}
      {/* Hide + button when in active chat */}
      <BottomNav active={navTab} onNavigate={onNavigate} hidePlus={!!activeRoom} />
      {showDev && <DevPanel onClose={() => setShowDev(false)} />}
    </div>
  );
}

// ── Landing Panel ─────────────────────────────────────────────────────────────

function LandingPanel({ navTab, setNavTab }) {
  const { userMap, onlineSet, user, rooms, setActiveRoom } = useStore();
  const others = Object.values(userMap).filter(u => Number(u.id) !== Number(user?.id));
  const online = others.filter(u => onlineSet.has(Number(u.id)));
  const offline= others.filter(u => !onlineSet.has(Number(u.id)));
  const dms    = rooms.filter(r => r.type === "dm");
  const groups = rooms.filter(r => r.type === "group" || r.type === "channel");

  async function startDm(uid) {
    const room = await roomsApi.createDm({ user_id: uid });
    const state = useStore.getState();
    if (!state.rooms.find(r => r.id === room.id))
      state.setRooms([...state.rooms, room]);
    setActiveRoom(room);
    emit.joinRoom(room.id);
  }

  function openRoom(room) {
    setActiveRoom(room);
    emit.joinRoom(room.id);
  }

  if (navTab === "messages") return (
    <MessagesTab dms={dms} user={user} onOpen={openRoom} />
  );
  if (navTab === "groups") return (
    <GroupsTab groups={groups} user={user} onOpen={openRoom} />
  );

  return (
    <HomeTab
      user={user} online={online} offline={offline}
      others={others} dms={dms}
      onOpen={openRoom} onStartDm={startDm}
      setNavTab={setNavTab}
    />
  );
}

// ── Home Tab ──────────────────────────────────────────────────────────────────

function HomeTab({ user, online, offline, others, dms, onOpen, onStartDm, setNavTab }) {
  const { rooms, userMap, onlineSet, messages, unread } = useStore();
  const time = useClock();

  const initials = (user?.display_name || user?.username || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const greeting = getGreeting(user?.display_name || user?.username || "");

  const timeStr = time.toLocaleTimeString("en-ZA", {
    hour: "2-digit", minute: "2-digit",
  });
  const dateStr = time.toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long",
  });

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  // Recent activity — messages from others
  const activity = Object.entries(messages)
    .flatMap(([roomId, msgs]) =>
      (msgs || []).slice(-1).map(m => ({
        ...m, roomId,
        roomName: rooms.find(r => r.id === roomId)?.name || "DM",
      }))
    )
    .filter(m => m.created_at && Number(m.sender_id) !== Number(user?.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div style={{ flex:1, overflowY:"auto" }}>

      {/* ── Hero header ── */}
      <div style={{
        padding:"20px 16px 16px",
        background:"linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-raised) 100%)",
        borderBottom:"1px solid var(--border)",
        position:"relative", overflow:"hidden",
      }}>
        {/* Accent glow */}
        <div style={{
          position:"absolute", top:-60, right:-60,
          width:200, height:200, borderRadius:"50%",
          background:"var(--accent-glow)", filter:"blur(50px)", pointerEvents:"none",
        }} />

        <div style={{ display:"flex", alignItems:"center", gap:14, position:"relative" }}>
          <div style={{ position:"relative", flexShrink:0 }}>
            <div style={{
              width:54, height:54, borderRadius:"50%",
              background:"linear-gradient(135deg, var(--accent), var(--accent2))",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, fontWeight:700, color:"#fff",
              boxShadow:"0 0 24px var(--accent-glow)", overflow:"hidden",
            }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="pfp"
                    style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                : initials}
            </div>
            <div style={{
              position:"absolute", bottom:1, right:1,
              width:14, height:14, borderRadius:"50%",
              background:"var(--green)", border:"2.5px solid var(--bg-surface)",
              boxShadow:"0 0 8px var(--green)",
            }} />
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontFamily:"var(--font-display)", fontSize:17,
              fontWeight:800, color:"var(--text-1)", lineHeight:1.2,
            }}>
              {greeting}
            </div>
            <div style={{ fontSize:11, color:"var(--text-3)", marginTop:3 }}>
              {dateStr} • {timeStr}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:5, flexWrap:"wrap" }}>
              {online.length > 0 ? (
                <button onClick={() => setNavTab("online")} style={{
                  fontSize:11, color:"var(--green)",
                  background:"rgba(78,203,113,.1)", border:"1px solid rgba(78,203,113,.3)",
                  borderRadius:20, padding:"2px 9px", cursor:"pointer",
                  fontFamily:"var(--font-body)", display:"flex", alignItems:"center", gap:4,
                }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:"var(--green)" }} />
                  {online.length} online
                </button>
              ) : (
                <span style={{ fontSize:11, color:"var(--text-3)" }}>
                  Everyone is offline
                </span>
              )}
              {totalUnread > 0 && (
                <button onClick={() => setNavTab("messages")} style={{
                  fontSize:11, color:"#fff", background:"var(--red)",
                  border:"none", borderRadius:20, padding:"2px 9px",
                  cursor:"pointer", fontFamily:"var(--font-body)", fontWeight:600,
                }}>
                  {totalUnread} unread
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:"14px 12px 80px" }}>

        {/* ── Online now ── */}
        <div style={{ marginBottom:20 }}>
          <SectionTitle title="Online now" />
          {online.length === 0 ? (
            <div style={{
              padding:"16px 14px",
              background:"var(--bg-surface)", border:"1px solid var(--border)",
              borderRadius:"var(--radius)", fontSize:13, color:"var(--text-3)",
              display:"flex", alignItems:"center", gap:10,
            }}>
              <div style={{ width:8,height:8,borderRadius:"50%",background:"var(--text-3)",flexShrink:0 }} />
              No one else is online right now
            </div>
          ) : (
            <div style={{ display:"flex", gap:10, overflowX:"auto",
              paddingBottom:4, scrollbarWidth:"none" }}>
              {online.map(u => {
                const init = (u.display_name||u.username||"?")
                  .split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                return (
                  <div key={u.id} onClick={() => onStartDm(u.id)} style={{
                    display:"flex", flexDirection:"column",
                    alignItems:"center", gap:5, flexShrink:0, cursor:"pointer",
                  }}>
                    <div style={{ position:"relative" }}>
                      <div style={{
                        width:48, height:48, borderRadius:"50%",
                        background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:16, fontWeight:700, color:"#fff",
                        border:"2px solid var(--green)",
                        boxShadow:"0 0 12px var(--green)", overflow:"hidden",
                      }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                          : init}
                      </div>
                      <div style={{
                        position:"absolute", bottom:0, right:0,
                        width:12, height:12, borderRadius:"50%",
                        background:"var(--green)", border:"2px solid var(--bg-base)",
                        boxShadow:"0 0 6px var(--green)",
                      }} />
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-2)", maxWidth:54,
                      textAlign:"center", overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {u.display_name||u.username}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Offline ── */}
        {offline.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <SectionTitle title="Offline" />
            <div style={{ display:"flex", gap:8, overflowX:"auto",
              paddingBottom:4, scrollbarWidth:"none" }}>
              {offline.map(u => {
                const init = (u.display_name||u.username||"?")[0].toUpperCase();
                return (
                  <div key={u.id} style={{
                    display:"flex", flexDirection:"column",
                    alignItems:"center", gap:5, flexShrink:0,
                  }}>
                    <div style={{
                      width:38, height:38, borderRadius:"50%",
                      background:"var(--bg-raised)",
                      border:"1px solid var(--border)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:13, fontWeight:700, color:"var(--text-3)",
                      overflow:"hidden", opacity:.55,
                    }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                        : init}
                    </div>
                    <div style={{ fontSize:9, color:"var(--text-3)", maxWidth:44,
                      textAlign:"center", overflow:"hidden",
                      textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {u.display_name||u.username}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Unread messages ── */}
        {totalUnread > 0 && (
          <div style={{ marginBottom:20 }}>
            <SectionTitle title={`${totalUnread} unread`} accent />
            {Object.entries(unread).filter(([,v]) => v > 0).map(([roomId]) => {
              const room = useStore.getState().rooms.find(r => r.id === roomId);
              if (!room) return null;
              const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
              const other = m ? userMap[Number(m.user_id)] : null;
              const msgs = messages[roomId] || [];
              const last = msgs[msgs.length-1];
              return (
                <div key={roomId} onClick={() => onOpen(room)} style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"11px 12px", marginBottom:6,
                  background:"rgba(79,142,247,.06)",
                  border:"1px solid var(--accent-dim)",
                  borderRadius:"var(--radius)", cursor:"pointer",
                  transition:"var(--trans)",
                }}
                  onMouseEnter={e => e.currentTarget.style.background="rgba(79,142,247,.12)"}
                  onMouseLeave={e => e.currentTarget.style.background="rgba(79,142,247,.06)"}>
                  <div style={{
                    width:40, height:40, borderRadius:"50%", flexShrink:0,
                    background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:14, fontWeight:700, color:"#fff",
                  }}>
                    {(other?.display_name||other?.username||room.name||"?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"var(--text-1)" }}>
                      {other?.display_name||other?.username||room.name||"Group"}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-2)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {last?.content?.slice(0,50)||"New message"}
                    </div>
                  </div>
                  <div style={{
                    minWidth:20, height:20, borderRadius:10,
                    background:"var(--accent)", color:"#fff",
                    fontSize:10, fontWeight:700,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    padding:"0 5px",
                  }}>
                    {unread[roomId]}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Recent chats ── */}
        {dms.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <SectionTitle title="Recent chats" />
            {dms.slice(0,4).map(room => {
              const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
              const other = m ? userMap[Number(m.user_id)] : null;
              const isOn  = m ? onlineSet.has(Number(m.user_id)) : false;
              const msgs  = messages[room.id] || [];
              const last  = msgs[msgs.length-1];
              return (
                <div key={room.id} onClick={() => onOpen(room)} style={{
                  display:"flex", alignItems:"center", gap:12,
                  padding:"10px 12px", marginBottom:6,
                  background:"var(--bg-surface)", border:"1px solid var(--border)",
                  borderRadius:"var(--radius)", cursor:"pointer", transition:"var(--trans)",
                }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--bg-raised)"}
                  onMouseLeave={e => e.currentTarget.style.background="var(--bg-surface)"}
                  onTouchStart={e => e.currentTarget.style.background="var(--bg-raised)"}
                  onTouchEnd={e => e.currentTarget.style.background="var(--bg-surface)"}>
                  <div style={{
                    width:40, height:40, borderRadius:"50%", flexShrink:0,
                    background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:14, fontWeight:700, color:"#fff",
                    position:"relative", overflow:"hidden",
                  }}>
                    {other?.avatar_url
                      ? <img src={other.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                      : (other?.display_name||other?.username||"?")[0].toUpperCase()}
                    <div style={{
                      position:"absolute", bottom:1, right:1,
                      width:10, height:10, borderRadius:"50%",
                      background:isOn?"var(--green)":"var(--text-3)",
                      border:"2px solid var(--bg-surface)",
                    }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text-1)" }}>
                      {other?.display_name||other?.username||"DM"}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-3)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {last
                        ? (last.type==="voice" ? "Voice note"
                          : last.type==="image" ? "Image"
                          : last.content?.slice(0,45))
                        : "@"+(other?.username||"")}
                    </div>
                  </div>
                  {last?.created_at && (
                    <div style={{ fontSize:10, color:"var(--text-3)", flexShrink:0 }}>
                      {timeAgo(last.created_at)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Recent activity ── */}
        {activity.length > 0 && (
          <div style={{ marginBottom:20 }}>
            <SectionTitle title="Recent activity" />
            {activity.map((a,i) => {
              const sender = userMap[Number(a.sender_id)];
              const room   = rooms.find(r => r.id === a.roomId);
              return (
                <div key={i} onClick={() => {
                  if (room) { useStore.getState().setActiveRoom(room); emit.joinRoom(room.id); }
                }} style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"8px 10px", marginBottom:5,
                  background:"var(--bg-surface)", border:"1px solid var(--border)",
                  borderRadius:"var(--radius-sm)", cursor:"pointer",
                }}
                  onMouseEnter={e => e.currentTarget.style.background="var(--bg-raised)"}
                  onMouseLeave={e => e.currentTarget.style.background="var(--bg-surface)"}>
                  <div style={{
                    width:30, height:30, borderRadius:"50%", flexShrink:0,
                    background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:11, fontWeight:700, color:"#fff",
                  }}>
                    {(sender?.display_name||sender?.username||"?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:"var(--text-1)" }}>
                      <span style={{ color:"var(--accent)", fontWeight:500 }}>
                        {sender?.display_name||sender?.username||"Someone"}
                      </span>
                      <span style={{ color:"var(--text-3)" }}> in {a.roomName}</span>
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-2)",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {a.type==="voice"?"Voice note":a.type==="image"?"Image":a.content?.slice(0,55)||"…"}
                    </div>
                  </div>
                  <div style={{ fontSize:10, color:"var(--text-3)", flexShrink:0 }}>
                    {timeAgo(a.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Empty state ── */}
        {others.length === 0 && activity.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 16px", color:"var(--text-3)" }}>
            <div style={{ marginBottom:12, opacity:.25 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:6, color:"var(--text-2)" }}>
              No one else yet
            </div>
            <div style={{ fontSize:12, lineHeight:1.8 }}>
              Share your IP on your WiFi network<br/>
              to get started
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Messages Tab ──────────────────────────────────────────────────────────────

function MessagesTab({ dms, user, onOpen }) {
  const { userMap, onlineSet, unread, messages } = useStore();
  const sorted = [...dms].sort((a,b) => {
    const aL = (messages[a.id]||[]).slice(-1)[0]?.created_at||0;
    const bL = (messages[b.id]||[]).slice(-1)[0]?.created_at||0;
    return new Date(bL) - new Date(aL);
  });

  return (
    <div style={{ flex:1, overflowY:"auto", padding:12 }}>
      <div style={{ fontFamily:"var(--font-display)", fontSize:20,
        fontWeight:800, color:"var(--text-1)",
        padding:"16px 4px 14px",
        borderBottom:"1px solid var(--border)", marginBottom:12 }}>
        Messages
      </div>
      {sorted.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 16px",
          color:"var(--text-3)", fontSize:13 }}>
          No chats yet — tap + to start one
        </div>
      )}
      {sorted.map(room => {
        const m     = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
        const other = m ? userMap[Number(m.user_id)] : null;
        const isOn  = other ? onlineSet.has(Number(other.id)) : false;
        const badge = unread[room.id]||0;
        const msgs  = messages[room.id]||[];
        const last  = msgs[msgs.length-1];
        const isMe  = last ? Number(last.sender_id)===Number(user?.id) : false;
        return (
          <div key={room.id} onClick={() => onOpen(room)} style={{
            display:"flex", alignItems:"center", gap:12,
            padding:"11px 12px", marginBottom:6,
            background:badge>0?"var(--bg-raised)":"var(--bg-surface)",
            border:`1px solid ${badge>0?"var(--accent-dim)":"var(--border)"}`,
            borderRadius:"var(--radius)", cursor:"pointer", transition:"var(--trans)",
          }}
            onMouseEnter={e => e.currentTarget.style.background="var(--bg-raised)"}
            onMouseLeave={e => e.currentTarget.style.background=badge>0?"var(--bg-raised)":"var(--bg-surface)"}
            onTouchStart={e => e.currentTarget.style.background="var(--bg-raised)"}
            onTouchEnd={e => e.currentTarget.style.background=badge>0?"var(--bg-raised)":"var(--bg-surface)"}>
            <div style={{
              width:44, height:44, borderRadius:"50%", flexShrink:0,
              background:"linear-gradient(135deg,var(--accent),var(--accent2))",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, fontWeight:700, color:"#fff",
              position:"relative", overflow:"hidden",
            }}>
              {other?.avatar_url
                ? <img src={other.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                : (other?.display_name||other?.username||"?")[0].toUpperCase()}
              <div style={{
                position:"absolute", bottom:1, right:1,
                width:12, height:12, borderRadius:"50%",
                background:isOn?"var(--green)":"var(--text-3)",
                border:"2px solid var(--bg-surface)",
                boxShadow:isOn?"0 0 5px var(--green)":"none",
              }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2 }}>
                <span style={{ fontSize:14, fontWeight:badge>0?700:500,
                  color:"var(--text-1)", overflow:"hidden",
                  textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {other?.display_name||other?.username||"DM"}
                </span>
              </div>
              <div style={{ fontSize:11,
                color:badge>0?"var(--text-2)":"var(--text-3)",
                fontWeight:badge>0?500:400,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {last
                  ? `${isMe?"You: ":""}${last.type==="voice"?"Voice note":last.type==="image"?"Image":last.content?.slice(0,40)||"…"}`
                  : "@"+(other?.username||"…")}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column",
              alignItems:"flex-end", gap:4, flexShrink:0 }}>
              {last?.created_at && (
                <div style={{ fontSize:10, color:"var(--text-3)" }}>
                  {timeAgo(last.created_at)}
                </div>
              )}
              {badge>0 && (
                <div style={{
                  minWidth:18, height:18, borderRadius:9,
                  background:"var(--accent)", color:"#fff",
                  fontSize:10, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  padding:"0 4px",
                }}>
                  {badge>99?"99+":badge}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Groups Tab ────────────────────────────────────────────────────────────────

function GroupsTab({ groups, user, onOpen }) {
  const { userMap, onlineSet, unread } = useStore();
  return (
    <div style={{ flex:1, overflowY:"auto", padding:12 }}>
      <div style={{ fontFamily:"var(--font-display)", fontSize:20,
        fontWeight:800, color:"var(--text-1)",
        padding:"16px 4px 14px",
        borderBottom:"1px solid var(--border)", marginBottom:12 }}>
        Groups
      </div>
      {groups.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 16px",
          color:"var(--text-3)", fontSize:13 }}>
          <div style={{ marginBottom:10, opacity:.3 }}>
            <Users size={36} />
          </div>
          No groups yet — tap + to create one
        </div>
      )}
      {groups.map(room => {
        const members     = room.members||[];
        const onlineCount = members.filter(m => onlineSet.has(Number(m.user_id))).length;
        const badge       = unread[room.id]||0;
        return (
          <div key={room.id} onClick={() => onOpen(room)} style={{
            display:"flex", alignItems:"center", gap:12,
            padding:"12px 14px", marginBottom:8,
            background:"var(--bg-surface)", border:"1px solid var(--border)",
            borderRadius:"var(--radius)", cursor:"pointer", transition:"var(--trans)",
          }}
            onMouseEnter={e => e.currentTarget.style.background="var(--bg-raised)"}
            onMouseLeave={e => e.currentTarget.style.background="var(--bg-surface)"}>
            <div style={{
              width:44, height:44, borderRadius:13, flexShrink:0,
              background:"linear-gradient(135deg,var(--accent),var(--accent2))",
              display:"flex", alignItems:"center", justifyContent:"center",
              position:"relative",
            }}>
              <Users size={20} color="white" />
              {onlineCount>0 && (
                <div style={{
                  position:"absolute", top:-4, right:-4,
                  minWidth:16, height:16, borderRadius:8,
                  background:"var(--green)", color:"#fff",
                  fontSize:9, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  padding:"0 3px", border:"2px solid var(--bg-surface)",
                  boxShadow:"0 0 6px var(--green)",
                }}>
                  {onlineCount}
                </div>
              )}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, color:"var(--text-1)",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {room.name}
              </div>
              <div style={{ fontSize:11, color:"var(--text-3)", marginTop:1 }}>
                {members.length} member{members.length!==1?"s":""}
                {onlineCount>0 && (
                  <span style={{ color:"var(--green)", marginLeft:6 }}>
                    {onlineCount} online
                  </span>
                )}
              </div>
            </div>
            {badge>0 && (
              <div style={{
                minWidth:20, height:20, borderRadius:10,
                background:"var(--accent)", color:"#fff",
                fontSize:10, fontWeight:700,
                display:"flex", alignItems:"center", justifyContent:"center",
                padding:"0 5px", flexShrink:0,
              }}>
                {badge>99?"99+":badge}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function SectionTitle({ title, accent }) {
  return (
    <div style={{
      fontSize:10, textTransform:"uppercase", letterSpacing:1.2,
      color: accent ? "var(--accent)" : "var(--text-3)",
      fontWeight:600, marginBottom:10, padding:"0 2px",
    }}>
      {title}
    </div>
  );
}
