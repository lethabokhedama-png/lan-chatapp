import React, { useState } from "react";
import Sidebar         from "../ui/Sidebar";
import BottomNav       from "../ui/BottomNav";
import ChatWindow      from "../features/chat/ChatWindow";
import ProfilePanel    from "../features/profile/ProfilePanel";
import SettingsPage    from "./SettingsPage";
import useStore        from "../lib/store";
import { rooms as roomsApi } from "../lib/api";
import { emit }        from "../lib/socket";

export default function ChatPage() {
  const { activeRoom, profilePanel } = useStore();
  const [navTab, setNavTab] = useState("home");

  function onNavigate(tab) {
    setNavTab(tab);
    if (tab !== "settings" && tab !== "home") {
      useStore.getState().setActiveRoom(null);
    }
    if (tab === "home") {
      useStore.getState().setActiveRoom(null);
    }
  }

  // Settings is a full page tab
  if (navTab === "settings" && !activeRoom) {
    return (
      <div style={{
        display: "flex", height: "100dvh", width: "100vw",
        overflow: "hidden", position: "fixed", inset: 0,
        flexDirection: "column",
      }}>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <SettingsPage onBack={() => setNavTab("home")} />
        </div>
        <BottomNav active={navTab} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", height: "100dvh", width: "100vw",
      overflow: "hidden", position: "fixed", inset: 0,
    }}>
      <Sidebar />
      <div style={{
        flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
        height: "100%", overflow: "hidden",
        paddingBottom: "60px",
      }}>
        {activeRoom
          ? <ChatWindow room={activeRoom} />
          : <LandingPanel navTab={navTab} setNavTab={setNavTab} />}
      </div>
      {profilePanel && <ProfilePanel user={profilePanel} />}
      <BottomNav active={navTab} onNavigate={onNavigate} />
    </div>
  );
}

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

  if (navTab === "messages") {
    return <ListPanel title="Messages" items={dms} user={user} emptyText="No direct messages yet" onOpen={openRoom} />;
  }

  if (navTab === "groups") {
    return <ListPanel title="Groups" items={groups} user={user} emptyText="No groups yet" isGroup onOpen={openRoom} />;
  }

  if (navTab === "online") {
    return <OnlinePanel online={online} offline={offline} onStartDm={startDm} />;
  }

  // Home tab
  const initials = (user?.display_name || user?.username || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const isOnline = true; // current user is always online if logged in

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      {/* Profile header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 4px 20px",
        borderBottom: "1px solid var(--border)", marginBottom: 16,
      }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 700, color: "#fff",
            boxShadow: "0 0 20px var(--accent-glow)", overflow: "hidden",
          }}>
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="pfp"
                  style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : initials}
          </div>
          <div style={{
            position: "absolute", bottom: 1, right: 1,
            width: 14, height: 14, borderRadius: "50%",
            background: "var(--green)",
            border: "2px solid var(--bg-base)",
            boxShadow: "0 0 6px var(--green)",
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 18,
            fontWeight: 800, color: "var(--text-1)",
          }}>
            Hey, {user?.display_name || user?.username}
          </div>
          {/* Online status summary */}
          {online.length > 0 ? (
            <div
              onClick={() => setNavTab("online")}
              style={{ fontSize: 12, color: "var(--green)", marginTop: 2, cursor: "pointer" }}
            >
              {online.length} {online.length === 1 ? "person" : "people"} online — tap to see
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              Everyone is offline right now
            </div>
          )}
          {user?.bio && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
              {user.bio}
            </div>
          )}
        </div>
      </div>

      {/* Recent DMs */}
      {dms.length > 0 && (
        <Section title="Recent Messages">
          {dms.slice(0, 3).map(r => {
            const m = r.members?.find(m => Number(m.user_id) !== Number(user?.id));
            const other = m ? userMap[Number(m.user_id)] : null;
            const isOnline = m ? onlineSet.has(Number(m.user_id)) : false;
            return (
              <div key={r.id} onClick={() => openRoom(r)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", marginBottom: 6,
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", cursor: "pointer", transition: "var(--trans)",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-raised)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}
                onTouchStart={e => e.currentTarget.style.background = "var(--bg-raised)"}
                onTouchEnd={e => e.currentTarget.style.background = "var(--bg-surface)"}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff", position: "relative",
                }}>
                  {(other?.display_name || other?.username || "?")[0].toUpperCase()}
                  <div style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 10, height: 10, borderRadius: "50%",
                    background: isOnline ? "var(--green)" : "var(--text-3)",
                    border: "2px solid var(--bg-surface)",
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
                    {other?.display_name || other?.username || "DM"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    @{other?.username}
                  </div>
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {others.length === 0 && dms.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px",
          color: "var(--text-3)", fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: .3 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>No other users yet</div>
          <div style={{ fontSize: 12 }}>
            Share your IP and port on your WiFi
          </div>
        </div>
      )}
    </div>
  );
}

function OnlinePanel({ online, offline, onStartDm }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div style={{
        padding: "16px 4px 20px",
        borderBottom: "1px solid var(--border)", marginBottom: 16,
      }}>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 20,
          fontWeight: 800, color: "var(--text-1)", marginBottom: 4,
        }}>
          Online
        </div>
        <div style={{ fontSize: 12, color: online.length > 0 ? "var(--green)" : "var(--text-3)" }}>
          {online.length > 0
            ? `${online.length} ${online.length === 1 ? "person" : "people"} online now`
            : "No one online right now"}
        </div>
      </div>

      {online.length > 0 && (
        <Section title={`Online now — ${online.length}`}>
          {online.map(u => <UserRow key={u.id} user={u} online status="now" onClick={() => onStartDm(u.id)} />)}
        </Section>
      )}

      {offline.length > 0 && (
        <Section title={`Offline — ${offline.length}`}>
          {offline.map(u => <UserRow key={u.id} user={u} online={false} status="offline" onClick={() => onStartDm(u.id)} />)}
        </Section>
      )}
    </div>
  );
}

function ListPanel({ title, items, user, onOpen, emptyText, isGroup }) {
  const { userMap, onlineSet, unread } = useStore();

  function getLabel(room) {
    if (isGroup) return room.name;
    const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
    const other = m ? userMap[Number(m.user_id)] : null;
    return other?.display_name || other?.username || "Direct Message";
  }

  function getSub(room) {
    if (isGroup) return `${room.members?.length || 0} members`;
    const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
    const other = m ? userMap[Number(m.user_id)] : null;
    return other ? "@" + other.username : "";
  }

  function getOnline(room) {
    if (isGroup) return false;
    const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
    return m ? onlineSet.has(Number(m.user_id)) : false;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 20,
        fontWeight: 800, color: "var(--text-1)",
        padding: "16px 4px 20px",
        borderBottom: "1px solid var(--border)", marginBottom: 16,
      }}>
        {title}
      </div>
      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px",
          color: "var(--text-3)", fontSize: 13 }}>
          {emptyText}
        </div>
      )}
      {items.map(room => {
        const label  = getLabel(room);
        const sub    = getSub(room);
        const online = getOnline(room);
        const badge  = unread[room.id];
        return (
          <div key={room.id} onClick={() => onOpen(room)} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "11px 12px", marginBottom: 6,
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", cursor: "pointer", transition: "var(--trans)",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-raised)"}
            onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}
            onTouchStart={e => e.currentTarget.style.background = "var(--bg-raised)"}
            onTouchEnd={e => e.currentTarget.style.background = "var(--bg-surface)"}>
            <div style={{
              width: 42, height: 42,
              borderRadius: isGroup ? 12 : "50%",
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, color: "#fff",
              flexShrink: 0, position: "relative", overflow: "hidden",
            }}>
              {isGroup
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                : label[0]?.toUpperCase()
              }
              {!isGroup && (
                <div style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 10, height: 10, borderRadius: "50%",
                  background: online ? "var(--green)" : "var(--text-3)",
                  border: "2px solid var(--bg-surface)",
                }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {label}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>{sub}</div>
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
        );
      })}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
        color: "var(--text-3)", fontWeight: 600,
        marginBottom: 8, padding: "0 4px",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function UserRow({ user, online, status, onClick }) {
  const initials = (user.display_name || user.username || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 12px", borderRadius: "var(--radius)",
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      cursor: "pointer", marginBottom: 6, transition: "var(--trans)",
    }}
      onTouchStart={e => e.currentTarget.style.background = "var(--bg-raised)"}
      onTouchEnd={e => e.currentTarget.style.background = "var(--bg-surface)"}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-raised)"}
      onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}>
      <div style={{
        width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, fontWeight: 700, color: "#fff", position: "relative",
        overflow: "hidden",
      }}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt={initials}
              style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          : initials}
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: 11, height: 11, borderRadius: "50%",
          background: online ? "var(--green)" : "var(--text-3)",
          border: "2px solid var(--bg-surface)",
          boxShadow: online ? "0 0 6px var(--green)" : "none",
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>
          {user.display_name || user.username}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>@{user.username}</div>
      </div>
      <div style={{
        fontSize: 11, padding: "3px 10px", borderRadius: 20,
        color: online ? "var(--green)" : "var(--text-3)",
        background: online ? "rgba(78,203,113,.1)" : "rgba(255,255,255,.04)",
        border: `1px solid ${online ? "rgba(78,203,113,.3)" : "var(--border)"}`,
      }}>
        {online ? "online" : "offline"}
      </div>
    </div>
  );
}
