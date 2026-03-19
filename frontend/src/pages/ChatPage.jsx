import React, { useState, useEffect } from "react";
import {
  MessageSquare, Users, Search, X,
  Copy, Check, Clock, Activity,
  Bell, BellOff, Archive, User,
  Home
} from "react-feather";
import BottomNav    from "../ui/BottomNav";
import ChatWindow   from "../features/chat/ChatWindow";
import ProfilePanel from "../features/profile/ProfilePanel";
import SettingsPage from "./SettingsPage";
import DevPanel     from "../features/dev/DevPanel";
import useStore     from "../lib/store";
import { rooms as roomsApi } from "../lib/api";
import { emit }     from "../lib/socket";

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

// ── Main ChatPage ─────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { activeRoom, profilePanel, user } = useStore();
  const [navTab, setNavTab]   = useState("home");
  const [showDev, setShowDev] = useState(false);

  const devUnlocked = user?.username === "lethabok" ||
    localStorage.getItem("lanchat_dev_unlocked") === "1";

  function onNavigate(tab) {
    setNavTab(tab);
    useStore.getState().setActiveRoom(null);
  }

  if (navTab === "settings" && !activeRoom) {
    return (
      <div style={{
        display: "flex", height: "100dvh", width: "100vw",
        overflow: "hidden", position: "fixed", inset: 0,
        flexDirection: "column",
      }}>
        <div style={{ flex: 1, overflow: "hidden" }}>
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
      display: "flex", height: "100dvh", width: "100vw",
      overflow: "hidden", position: "fixed", inset: 0,
    }}>
      <div style={{
        flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
        height: "100%", overflow: "hidden", paddingBottom: "60px",
      }}>
        {activeRoom
          ? <ChatWindow room={activeRoom} />
          : <LandingPanel navTab={navTab} setNavTab={setNavTab} />}
      </div>
      {profilePanel && <ProfilePanel user={profilePanel} />}
      <BottomNav active={navTab} onNavigate={onNavigate} />
      {showDev && <DevPanel onClose={() => setShowDev(false)} />}
    </div>
  );
}

// ── Landing Panel router ──────────────────────────────────────────────────────

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

  if (navTab === "messages") return <MessagesTab dms={dms} user={user} onOpen={openRoom} />;
  if (navTab === "groups")   return <GroupsTab groups={groups} user={user} onOpen={openRoom} />;
  if (navTab === "online")   return <OnlineTab online={online} offline={offline} onStartDm={startDm} />;

  return <HomeTab user={user} online={online} others={others} dms={dms} onOpen={openRoom} setNavTab={setNavTab} />;
}

// ── Home Tab ──────────────────────────────────────────────────────────────────

// ── HomeTab — drop this function into ChatPage.jsx replacing the existing HomeTab ──

function HomeTab({ user, online, others, dms, onOpen, setNavTab }) {
  const { rooms, userMap, onlineSet, messages, unread } = useStore();
  const time   = useClock();
  const [apiOk, setApiOk] = useState(null);
  const [rtOk,  setRtOk]  = useState(null);

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || "";
    fetch(BASE + "/api/health").then(r => setApiOk(r.ok)).catch(() => setApiOk(false));
    import("../lib/socket").then(m => setRtOk(!!m.getSocket()?.connected));
    const t = setInterval(() => {
      import("../lib/socket").then(m => setRtOk(!!m.getSocket()?.connected));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const initials = (user?.display_name || user?.username || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const timeStr = time.toLocaleTimeString("en-ZA", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("en-ZA", {
    weekday: "long", day: "numeric", month: "long",
  });

  // Activity feed
  const activity = Object.entries(messages)
    .flatMap(([roomId, msgs]) =>
      (msgs || []).slice(-1).map(m => ({
        ...m, roomId,
        roomName: rooms.find(r => r.id === roomId)?.name || "DM",
      }))
    )
    .filter(m => m.created_at && Number(m.sender_id) !== Number(user?.id))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);
  const groups = rooms.filter(r => r.type === "group" || r.type === "channel");

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>

      {/* ── Hero header ── */}
      <div style={{
        padding: "20px 16px 16px",
        background: "linear-gradient(160deg, var(--bg-surface) 0%, var(--bg-raised) 100%)",
        borderBottom: "1px solid var(--border)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Glow orb */}
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: "var(--accent-glow)",
          filter: "blur(40px)", pointerEvents: "none",
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 54, height: 54, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700, color: "#fff",
              boxShadow: "0 0 24px var(--accent-glow)", overflow: "hidden",
            }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="pfp"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : initials}
            </div>
            <div style={{
              position: "absolute", bottom: 1, right: 1,
              width: 14, height: 14, borderRadius: "50%",
              background: "var(--green)", border: "2.5px solid var(--bg-surface)",
              boxShadow: "0 0 8px var(--green)",
            }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 18,
              fontWeight: 800, color: "var(--text-1)",
            }}>
              Hey, {user?.display_name || user?.username}
            </div>
            {user?.bio && (
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                {user.bio}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, color: "var(--green)",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%",
                  background: "var(--green)", boxShadow: "0 0 4px var(--green)" }} />
                online
              </div>
              {online.length > 0 && (
                <button onClick={() => setNavTab("online")} style={{
                  fontSize: 11, color: "var(--accent)",
                  background: "var(--accent-glow)", border: "1px solid var(--accent-dim)",
                  borderRadius: 20, padding: "1px 8px", cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}>
                  {online.length} other{online.length !== 1 ? "s" : ""} online
                </button>
              )}
              {totalUnread > 0 && (
                <button onClick={() => setNavTab("messages")} style={{
                  fontSize: 11, color: "#fff",
                  background: "var(--red)", border: "none",
                  borderRadius: 20, padding: "1px 8px", cursor: "pointer",
                  fontFamily: "var(--font-body)", fontWeight: 600,
                }}>
                  {totalUnread} unread
                </button>
              )}
            </div>
          </div>

          {/* Clock */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontFamily: "monospace", fontSize: 16, fontWeight: 700,
              color: "var(--accent)", letterSpacing: 1,
            }}>
              {timeStr}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 2 }}>
              {dateStr}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        borderBottom: "1px solid var(--border)",
      }}>
        {[
          {
            label: "Online", value: online.length,
            color: online.length > 0 ? "var(--green)" : "var(--text-3)",
            dot: online.length > 0,
            onClick: () => setNavTab("online"),
          },
          {
            label: "Chats", value: dms.length,
            color: "var(--accent)",
            onClick: () => setNavTab("messages"),
          },
          {
            label: "Groups", value: groups.length,
            color: "var(--accent2)",
            onClick: () => setNavTab("groups"),
          },
          {
            label: "API",
            value: apiOk === null ? "…" : apiOk ? "OK" : "Down",
            color: apiOk === null ? "var(--text-3)" : apiOk ? "var(--green)" : "var(--red)",
          },
        ].map((s, i) => (
          <div key={s.label} onClick={s.onClick} style={{
            padding: "12px 0", textAlign: "center",
            borderRight: i < 3 ? "1px solid var(--border)" : "none",
            cursor: s.onClick ? "pointer" : "default",
            background: "var(--bg-raised)",
            transition: "var(--trans)",
          }}
            onMouseEnter={e => s.onClick && (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={e => s.onClick && (e.currentTarget.style.background = "var(--bg-raised)")}>
            <div style={{ display: "flex", alignItems: "center",
              justifyContent: "center", gap: 4 }}>
              {s.dot && (
                <div style={{ width: 6, height: 6, borderRadius: "50%",
                  background: "var(--green)", boxShadow: "0 0 4px var(--green)" }} />
              )}
              <div style={{ fontSize: 18, fontWeight: 700,
                fontFamily: "var(--font-display)", color: s.color }}>
                {s.value}
              </div>
            </div>
            <div style={{ fontSize: 9, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: .8, marginTop: 1 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 12px 80px" }}>

        {/* ── Who's online now ── */}
        {online.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionTitle title="Online now" accent />
            <div style={{ display: "flex", gap: 10, overflowX: "auto",
              paddingBottom: 4, scrollbarWidth: "none" }}>
              {online.map(u => {
                const init = (u.display_name || u.username || "?")
                  .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <div key={u.id} style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 5, flexShrink: 0,
                    cursor: "pointer",
                  }} onClick={() => {
                    roomsApi?.createDm?.({ user_id: u.id }).then(room => {
                      useStore.getState().setActiveRoom(room);
                    }).catch(() => {});
                  }}>
                    <div style={{ position: "relative" }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 700, color: "#fff",
                        border: "2px solid var(--green)",
                        boxShadow: "0 0 10px var(--green)",
                        overflow: "hidden",
                      }}>
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                          : init}
                      </div>
                      <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 12, height: 12, borderRadius: "50%",
                        background: "var(--green)", border: "2px solid var(--bg-base)",
                        boxShadow: "0 0 6px var(--green)",
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-2)",
                      maxWidth: 52, textAlign: "center",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.display_name || u.username}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Offline users ── */}
        {others.filter(u => !onlineSet.has(Number(u.id))).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionTitle title="Offline" />
            <div style={{ display: "flex", gap: 8, overflowX: "auto",
              paddingBottom: 4, scrollbarWidth: "none" }}>
              {others.filter(u => !onlineSet.has(Number(u.id))).map(u => {
                const init = (u.display_name || u.username || "?")[0].toUpperCase();
                return (
                  <div key={u.id} style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 5, flexShrink: 0,
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: "var(--bg-raised)",
                      border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "var(--text-3)",
                      overflow: "hidden", opacity: .6,
                    }}>
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                        : init}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-3)",
                      maxWidth: 44, textAlign: "center",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.display_name || u.username}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Unread messages ── */}
        {totalUnread > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionTitle title={`${totalUnread} unread message${totalUnread !== 1 ? "s" : ""}`} accent />
            {dms.filter(r => unread[r.id] > 0).map(room => {
              const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
              const other = m ? userMap[Number(m.user_id)] : null;
              const msgs  = messages[room.id] || [];
              const last  = msgs[msgs.length - 1];
              return (
                <div key={room.id} onClick={() => onOpen(room)} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 12px", marginBottom: 6,
                  background: "rgba(79,142,247,.06)",
                  border: "1px solid var(--accent-dim)",
                  borderRadius: "var(--radius)", cursor: "pointer",
                  transition: "var(--trans)",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(79,142,247,.12)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(79,142,247,.06)"}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "#fff",
                  }}>
                    {(other?.display_name || other?.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>
                      {other?.display_name || other?.username || "DM"}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-2)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {last?.content?.slice(0, 50) || "New message"}
                    </div>
                  </div>
                  <div style={{
                    minWidth: 20, height: 20, borderRadius: 10,
                    background: "var(--accent)", color: "#fff",
                    fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px",
                  }}>
                    {unread[room.id]}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Recent activity ── */}
        {activity.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionTitle title="Recent activity" />
            {activity.map((a, i) => {
              const sender = userMap[Number(a.sender_id)];
              const room   = rooms.find(r => r.id === a.roomId);
              return (
                <div key={i} onClick={() => {
                  if (room) { useStore.getState().setActiveRoom(room); emit.joinRoom(room.id); }
                }} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", marginBottom: 5,
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", cursor: "pointer",
                  transition: "var(--trans)",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-raised)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#fff",
                  }}>
                    {(sender?.display_name || sender?.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--text-1)" }}>
                      <span style={{ color: "var(--accent)", fontWeight: 500 }}>
                        {sender?.display_name || sender?.username || "Someone"}
                      </span>
                      <span style={{ color: "var(--text-3)" }}> in {a.roomName}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-2)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.type === "voice" ? "Sent a voice note"
                       : a.type === "image" ? "Sent an image"
                       : a.content?.slice(0, 55) || "…"}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", flexShrink: 0 }}>
                    {timeAgo(a.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Empty state ── */}
        {others.length === 0 && activity.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-3)" }}>
            <div style={{ marginBottom: 12, opacity: .3 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: "var(--text-2)" }}>
              No one else yet
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7 }}>
              Share <strong style={{ color: "var(--accent)" }}>https://YOUR_IP:5173</strong>
              <br />with people on your WiFi to get started
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function MessagesTab({ dms, user, onOpen }) {
  const { userMap, onlineSet, unread, messages } = useStore();
  const [muted,    setMuted]    = useState(() => {
    try { return JSON.parse(localStorage.getItem("lanchat_muted") || "[]"); } catch { return []; }
  });
  const [archived, setArchived] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lanchat_archived") || "[]"); } catch { return []; }
  });
  const [showArchived, setShowArchived] = useState(false);

  function toggleMute(id) {
    setMuted(m => {
      const n = m.includes(id) ? m.filter(x => x !== id) : [...m, id];
      localStorage.setItem("lanchat_muted", JSON.stringify(n));
      return n;
    });
  }
  function toggleArchive(id) {
    setArchived(a => {
      const n = a.includes(id) ? a.filter(x => x !== id) : [...a, id];
      localStorage.setItem("lanchat_archived", JSON.stringify(n));
      return n;
    });
  }

  const sorted = [...dms]
    .filter(r => showArchived ? archived.includes(r.id) : !archived.includes(r.id))
    .sort((a, b) => {
      const aLast = (messages[a.id] || []).slice(-1)[0]?.created_at || 0;
      const bLast = (messages[b.id] || []).slice(-1)[0]?.created_at || 0;
      return new Date(bLast) - new Date(aLast);
    });

  function getOther(room) {
    const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
    return m ? userMap[Number(m.user_id)] : null;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 4px 14px", borderBottom: "1px solid var(--border)", marginBottom: 12,
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20,
          fontWeight: 800, color: "var(--text-1)" }}>
          Messages
        </div>
        <button onClick={() => setShowArchived(v => !v)} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px",
          background: showArchived ? "var(--bg-active)" : "var(--bg-raised)",
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          color: "var(--text-2)", fontSize: 11, cursor: "pointer",
          fontFamily: "var(--font-body)",
        }}>
          <Archive size={12} />
          {showArchived ? "Active" : "Archived"}
        </button>
      </div>

      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px",
          color: "var(--text-3)", fontSize: 13 }}>
          {showArchived ? "No archived conversations" : "No direct messages yet"}
        </div>
      )}

      {sorted.map(room => {
        const other   = getOther(room);
        const isOn    = other ? onlineSet.has(Number(other.id)) : false;
        const badge   = unread[room.id] || 0;
        const isMuted = muted.includes(room.id);
        const msgs    = messages[room.id] || [];
        const last    = msgs[msgs.length - 1];
        const isMe    = last ? Number(last.sender_id) === Number(user?.id) : false;

        return (
          <div key={room.id} style={{ marginBottom: 8 }}>
            <div onClick={() => onOpen(room)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 12px",
              background: badge > 0 ? "var(--bg-raised)" : "var(--bg-surface)",
              border: `1px solid ${badge > 0 ? "var(--accent-dim)" : "var(--border)"}`,
              borderRadius: "var(--radius)", cursor: "pointer", transition: "var(--trans)",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-raised)"}
              onMouseLeave={e => e.currentTarget.style.background = badge > 0 ? "var(--bg-raised)" : "var(--bg-surface)"}
              onTouchStart={e => e.currentTarget.style.background = "var(--bg-raised)"}
              onTouchEnd={e => e.currentTarget.style.background = badge > 0 ? "var(--bg-raised)" : "var(--bg-surface)"}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700, color: "#fff",
                position: "relative", overflow: "hidden",
              }}>
                {other?.avatar_url
                  ? <img src={other.avatar_url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                  : (other?.display_name || other?.username || "?")[0].toUpperCase()}
                <div style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 12, height: 12, borderRadius: "50%",
                  background: isOn ? "var(--green)" : "var(--text-3)",
                  border: "2px solid var(--bg-surface)",
                  boxShadow: isOn ? "0 0 5px var(--green)" : "none",
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: badge > 0 ? 700 : 500,
                    color: "var(--text-1)", overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {other?.display_name || other?.username || "DM"}
                  </span>
                  {isMuted && <BellOff size={10} color="var(--text-3)" />}
                </div>
                <div style={{ fontSize: 11,
                  color: badge > 0 ? "var(--text-2)" : "var(--text-3)",
                  fontWeight: badge > 0 ? 500 : 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {last
                    ? `${isMe ? "You: " : ""}${
                        last.type === "voice" ? "Voice note" :
                        last.type === "image" ? "Image" :
                        last.content?.slice(0, 40) || "…"}`
                    : "@" + (other?.username || "…")}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column",
                alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                {last?.created_at && (
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                    {timeAgo(last.created_at)}
                  </div>
                )}
                {badge > 0 && (
                  <div style={{
                    minWidth: 18, height: 18, borderRadius: 9,
                    background: "var(--accent)", color: "#fff",
                    fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px",
                  }}>
                    {badge > 99 ? "99+" : badge}
                  </div>
                )}
              </div>
            </div>
            {/* Action chips */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 2, paddingRight: 4 }}>
              <ActionChip
                icon={isMuted ? <Bell size={10} /> : <BellOff size={10} />}
                label={isMuted ? "Unmute" : "Mute"}
                onClick={() => toggleMute(room.id)}
              />
              <ActionChip
                icon={<Archive size={10} />}
                label={archived.includes(room.id) ? "Unarchive" : "Archive"}
                onClick={() => toggleArchive(room.id)}
              />
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
  const [copied,   setCopied]   = useState(null);
  const [expanded, setExpanded] = useState(null);

  function copyInvite(room) {
    const ip  = window.location.origin;
    navigator.clipboard?.writeText(
      `Join "${room.name}" on LAN Chat: ${ip}`
    ).catch(() => {});
    setCopied(room.id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 20,
        fontWeight: 800, color: "var(--text-1)",
        padding: "16px 4px 14px",
        borderBottom: "1px solid var(--border)", marginBottom: 12,
      }}>
        Groups
      </div>

      {groups.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px",
          color: "var(--text-3)", fontSize: 13 }}>
          <div style={{ marginBottom: 10, opacity: .3 }}><Users size={36} /></div>
          No groups yet — tap + in the sidebar to create one
        </div>
      )}

      {groups.map(room => {
        const members     = room.members || [];
        const onlineCount = members.filter(m => onlineSet.has(Number(m.user_id))).length;
        const badge       = unread[room.id] || 0;
        const isExpanded  = expanded === room.id;

        return (
          <div key={room.id} style={{ marginBottom: 10 }}>
            <div style={{
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", overflow: "hidden",
            }}>
              <div onClick={() => onOpen(room)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", cursor: "pointer", transition: "var(--trans)",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-raised)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{
                  width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                  background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  <Users size={20} color="white" />
                  {onlineCount > 0 && (
                    <div style={{
                      position: "absolute", top: -4, right: -4,
                      minWidth: 16, height: 16, borderRadius: 8,
                      background: "var(--green)", color: "#fff",
                      fontSize: 9, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "0 3px", border: "2px solid var(--bg-surface)",
                      boxShadow: "0 0 6px var(--green)",
                    }}>
                      {onlineCount}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {room.name}
                  </div>
                  {room.topic && (
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {room.topic}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                    {members.length} member{members.length !== 1 ? "s" : ""}
                    {onlineCount > 0 && (
                      <span style={{ color: "var(--green)", marginLeft: 6 }}>
                        {onlineCount} online
                      </span>
                    )}
                  </div>
                </div>
                {badge > 0 && (
                  <div style={{
                    minWidth: 20, height: 20, borderRadius: 10,
                    background: "var(--accent)", color: "#fff",
                    fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 5px", flexShrink: 0,
                  }}>
                    {badge > 99 ? "99+" : badge}
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div style={{ display: "flex", borderTop: "1px solid var(--border)" }}>
                <button onClick={() => setExpanded(isExpanded ? null : room.id)} style={{
                  flex: 1, padding: "7px 0", background: "transparent",
                  border: "none", borderRight: "1px solid var(--border)",
                  cursor: "pointer", color: "var(--text-3)", fontSize: 11,
                  fontFamily: "var(--font-body)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  <User size={11} />
                  {isExpanded ? "Hide" : "Members"}
                </button>
                <button onClick={() => copyInvite(room)} style={{
                  flex: 1, padding: "7px 0", background: "transparent",
                  border: "none", cursor: "pointer",
                  color: copied === room.id ? "var(--green)" : "var(--text-3)",
                  fontSize: 11, fontFamily: "var(--font-body)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                }}>
                  {copied === room.id ? <Check size={11} /> : <Copy size={11} />}
                  {copied === room.id ? "Copied!" : "Invite"}
                </button>
              </div>

              {/* Members list */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px" }}>
                  {members.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-3)", padding: "4px 0" }}>
                      No members
                    </div>
                  )}
                  {members.map(m => {
                    const u  = userMap[Number(m.user_id)];
                    const on = onlineSet.has(Number(m.user_id));
                    if (!u) return null;
                    return (
                      <div key={m.user_id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0,
                        }}>
                          {(u.display_name || u.username || "?")[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text-1)", flex: 1 }}>
                          {u.display_name || u.username}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                          @{u.username}
                        </span>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: on ? "var(--green)" : "var(--text-3)",
                          boxShadow: on ? "0 0 4px var(--green)" : "none",
                        }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Online Tab ────────────────────────────────────────────────────────────────

function OnlineTab({ online, offline, onStartDm }) {
  const [search, setSearch] = useState("");
  const { setProfilePanel } = useStore();
  const lower  = search.toLowerCase();
  const filter = arr => search
    ? arr.filter(u =>
        (u.display_name || "").toLowerCase().includes(lower) ||
        u.username.toLowerCase().includes(lower))
    : arr;

  const filteredOnline  = filter(online);
  const filteredOffline = filter(offline);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div style={{
        padding: "16px 4px 12px",
        borderBottom: "1px solid var(--border)", marginBottom: 12,
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20,
          fontWeight: 800, color: "var(--text-1)", marginBottom: 10 }}>
          Online
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "var(--bg-raised)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", padding: "8px 12px",
        }}>
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Search people..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, background: "transparent", border: "none",
              outline: "none", color: "var(--text-1)", fontSize: 13,
              fontFamily: "var(--font-body)",
            }}
          />
          {search && (
            <button className="icon-btn" style={{ width: 16, height: 16 }}
              onClick={() => setSearch("")}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {filteredOnline.length === 0 && filteredOffline.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px 0",
          color: "var(--text-3)", fontSize: 13 }}>
          {search ? `No results for "${search}"` : "No other users yet"}
        </div>
      )}

      {filteredOnline.length > 0 && (
        <SectionBlock title={`Online now — ${filteredOnline.length}`}>
          {filteredOnline.map(u => (
            <OnlineRow key={u.id} user={u} online
              onMessage={() => onStartDm(u.id)}
              onProfile={() => setProfilePanel(u)}
            />
          ))}
        </SectionBlock>
      )}

      {filteredOffline.length > 0 && (
        <SectionBlock title={`Offline — ${filteredOffline.length}`}>
          {filteredOffline.map(u => (
            <OnlineRow key={u.id} user={u} online={false}
              onMessage={() => onStartDm(u.id)}
              onProfile={() => setProfilePanel(u)}
            />
          ))}
        </SectionBlock>
      )}
    </div>
  );
}

function OnlineRow({ user, online, onMessage, onProfile }) {
  const initials = (user.display_name || user.username || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 12px", borderRadius: "var(--radius)",
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      marginBottom: 6,
    }}>
      <div onClick={onProfile} style={{
        width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, fontWeight: 700, color: "#fff",
        position: "relative", overflow: "hidden", cursor: "pointer",
      }}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt={initials}
              style={{ width:"100%",height:"100%",objectFit:"cover" }} />
          : initials}
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: 11, height: 11, borderRadius: "50%",
          background: online ? "var(--green)" : "var(--text-3)",
          border: "2px solid var(--bg-surface)",
          boxShadow: online ? "0 0 6px var(--green)" : "none",
        }} />
      </div>
      <div onClick={onProfile} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>
          {user.display_name || user.username}
        </div>
        <div style={{ fontSize: 11, color: online ? "var(--green)" : "var(--text-3)", marginTop: 1 }}>
          {online ? "online now" : "offline"}
        </div>
      </div>
      <button onClick={onMessage} style={{
        padding: "6px 12px", borderRadius: "var(--radius-sm)",
        background: "var(--bg-raised)", border: "1px solid var(--border)",
        color: "var(--text-2)", fontSize: 11, cursor: "pointer",
        fontFamily: "var(--font-body)", transition: "var(--trans)",
        display: "flex", alignItems: "center", gap: 4,
      }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
        onMouseLeave={e => e.currentTarget.style.background = "var(--bg-raised)"}>
        <MessageSquare size={11} />
        Message
      </button>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function SectionTitle({ icon, title }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
      color: "var(--text-3)", fontWeight: 600, marginBottom: 8, padding: "0 2px",
    }}>
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      {title}
    </div>
  );
}

function SectionBlock({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
        color: "var(--text-3)", fontWeight: 600, marginBottom: 8, padding: "0 4px",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ActionChip({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 3,
      padding: "3px 8px", background: "transparent", border: "none",
      borderRadius: 20, color: "var(--text-3)", fontSize: 10,
      cursor: "pointer", fontFamily: "var(--font-body)", transition: "var(--trans)",
    }}
      onMouseEnter={e => e.currentTarget.style.color = "var(--text-1)"}
      onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}>
      {icon} {label}
    </button>
  );
}
