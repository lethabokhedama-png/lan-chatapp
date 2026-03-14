import React, { useState } from "react";
import Sidebar      from "../ui/Sidebar";
import BottomNav    from "../ui/BottomNav";
import ChatWindow   from "../features/chat/ChatWindow";
import ProfilePanel from "../features/profile/ProfilePanel";
import useStore     from "../lib/store";
import { rooms as roomsApi } from "../lib/api";
import { emit } from "../lib/socket";

export default function ChatPage() {
  const { activeRoom, profilePanel, user } = useStore();
  const [navTab, setNavTab] = useState("home");

  function onNavigate(tab) {
    setNavTab(tab);
    if (tab === "home")     useStore.getState().setActiveRoom(null);
    if (tab === "settings") useStore.getState().openSettings("account");
  }

  return (
    <div style={{
      display: "flex", height: "100dvh", width: "100vw",
      overflow: "hidden", position: "fixed", inset: 0,
    }}>
      {/* Sidebar — desktop only */}
      <div style={{ display: "none" }} className="desktop-sidebar">
        <Sidebar />
      </div>
      <Sidebar />

      {/* Main content */}
      <div style={{
        flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
        height: "100%", overflow: "hidden",
        paddingBottom: "60px", // space for bottom nav on mobile
      }}>
        {activeRoom
          ? <ChatWindow room={activeRoom} />
          : <LandingPanel navTab={navTab} />}
      </div>

      {profilePanel && <ProfilePanel user={profilePanel} />}

      {/* Bottom nav — mobile only */}
      <BottomNav active={navTab} onNavigate={onNavigate} />
    </div>
  );
}

function LandingPanel({ navTab }) {
  const { userMap, onlineSet, user, rooms, setActiveRoom } = useStore();
  const others  = Object.values(userMap).filter(u => u.id !== user?.id);
  const online  = others.filter(u => onlineSet.has(Number(u.id)));
  const offline = others.filter(u => !onlineSet.has(Number(u.id)));
  const dms     = rooms.filter(r => r.type === "dm");
  const groups  = rooms.filter(r => r.type === "group" || r.type === "channel");

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

  // Home tab
  if (navTab === "home" || !navTab) return (
    <HomePanel online={online} offline={offline} user={user}
      onStartDm={startDm} />
  );

  // Messages tab
  if (navTab === "messages") return (
    <ListPanel title="Messages" items={dms} userMap={useStore.getState().userMap}
      user={user} onlineSet={onlineSet} onOpen={openRoom}
      emptyText="No direct messages yet" />
  );

  // Groups tab
  if (navTab === "groups") return (
    <ListPanel title="Groups" items={groups} userMap={useStore.getState().userMap}
      user={user} onlineSet={onlineSet} onOpen={openRoom}
      emptyText="No groups yet" isGroup />
  );

  // Online tab
  if (navTab === "online") return (
    <HomePanel online={online} offline={[]} user={user}
      onStartDm={startDm} onlineOnly />
  );

  return null;
}

function HomePanel({ online, offline, user, onStartDm, onlineOnly }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      {/* Header */}
      <div style={{
        padding: "16px 4px 20px",
        borderBottom: "1px solid var(--border)", marginBottom: 16,
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20,
          fontWeight: 800, color: "var(--text-1)", marginBottom: 4 }}>
          {onlineOnly ? "Online Now" : `Hey, ${user?.display_name || user?.username} 👋`}
        </div>
        <div style={{ fontSize: 12, color: "var(--green)" }}>
          ● {online.length} {online.length === 1 ? "person" : "people"} online
        </div>
      </div>

      {online.length > 0 && (
        <Section title={`Online — ${online.length}`}>
          {online.map(u => (
            <UserRow key={u.id} user={u} online onClick={() => onStartDm(u.id)} />
          ))}
        </Section>
      )}

      {!onlineOnly && offline.length > 0 && (
        <Section title={`Offline — ${offline.length}`}>
          {offline.map(u => (
            <UserRow key={u.id} user={u} online={false} onClick={() => onStartDm(u.id)} />
          ))}
        </Section>
      )}

      {online.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px",
          color: "var(--text-3)", fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: .3 }}>👥</div>
          No one else is online yet
        </div>
      )}
    </div>
  );
}

function ListPanel({ title, items, userMap, user, onlineSet, onOpen, emptyText, isGroup }) {
  function getLabel(room) {
    if (isGroup) return room.name;
    const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
    const other = m ? userMap[Number(m.user_id)] : null;
    return other?.display_name || other?.username || "DM";
  }
  function getSub(room) {
    if (isGroup) return `${room.members?.length || 0} members`;
    const m = room.members?.find(m => Number(m.user_id) !== Number(user?.id));
    const other = m ? userMap[Number(m.user_id)] : null;
    return other ? "@" + other.username : "";
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 20,
        fontWeight: 800, color: "var(--text-1)", padding: "16px 4px 20px",
        borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
        {title}
      </div>
      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 16px",
          color: "var(--text-3)", fontSize: 13 }}>
          {emptyText}
        </div>
      )}
      {items.map(room => (
        <div key={room.id} onClick={() => onOpen(room)} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "11px 12px", marginBottom: 6,
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", cursor: "pointer", transition: "var(--trans)",
        }}
          onTouchStart={e => e.currentTarget.style.background = "var(--bg-raised)"}
          onTouchEnd={e => e.currentTarget.style.background = "var(--bg-surface)"}
          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-raised)"}
          onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}>
          <div style={{
            width: 40, height: 40, borderRadius: isGroup ? 12 : "50%", flexShrink: 0,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: isGroup ? 18 : 14, fontWeight: 700, color: "#fff",
          }}>
            {isGroup ? "👥" : getLabel(room)[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>
              {getLabel(room)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
              {getSub(room)}
            </div>
          </div>
          <div style={{ fontSize: 16, color: "var(--text-3)" }}>›</div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
        color: "var(--text-3)", fontWeight: 600, marginBottom: 8, padding: "0 4px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function UserRow({ user, online, onClick }) {
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
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff", position: "relative",
      }}>
        {initials}
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
        {online ? "● online" : "offline"}
      </div>
    </div>
  );
}
