import React from "react";
import Sidebar      from "../ui/Sidebar";
import ChatWindow   from "../features/chat/ChatWindow";
import ProfilePanel from "../features/profile/ProfilePanel";
import useStore     from "../lib/store";
import { rooms as roomsApi } from "../lib/api";
import { emit } from "../lib/socket";

export default function ChatPage() {
  const { activeRoom, profilePanel, sidebarOpen } = useStore();

  return (
    <div style={{ display: "flex", height: "100dvh", width: "100vw", overflow: "hidden", position: "fixed", inset: 0 }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {activeRoom ? <ChatWindow room={activeRoom} /> : <LandingPanel />}
      </div>
      {profilePanel && <ProfilePanel user={profilePanel} />}
    </div>
  );
}

function LandingPanel() {
  const { userMap, onlineSet, user, rooms, setActiveRoom, toggleSidebar } = useStore();
  const others  = Object.values(userMap).filter(u => u.id !== user?.id);
  const online  = others.filter(u => onlineSet.has(u.id));
  const offline = others.filter(u => !onlineSet.has(u.id));

  async function startDm(uid) {
    const room = await roomsApi.createDm({ user_id: uid });
    const allRooms = useStore.getState().rooms;
    if (!allRooms.find(r => r.id === room.id)) {
      useStore.getState().setRooms([...allRooms, room]);
    }
    setActiveRoom(room);
    emit.joinRoom(room.id);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Mobile header */}
      <div style={{
        height: "var(--header-h)", display: "flex", alignItems: "center",
        padding: "0 14px", gap: 10, borderBottom: "1px solid var(--border)",
        flexShrink: 0, background: "var(--bg-base)",
      }}>
        <button className="icon-btn hamburger" onClick={toggleSidebar} style={{ fontSize: 18 }}>☰</button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, flex: 1 }}>
          People
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          {online.length} online
        </div>
      </div>

      {/* Scrollable user list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px", WebkitOverflowScrolling: "touch" }}>
        {online.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
              color: "var(--text-3)", fontWeight: 600, marginBottom: 8, padding: "0 4px" }}>
              Online now — {online.length}
            </div>
            {online.map(u => <UserRow key={u.id} user={u} online onClick={() => startDm(u.id)} />)}
          </div>
        )}

        {offline.length > 0 && (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
              color: "var(--text-3)", fontWeight: 600, marginBottom: 8, padding: "0 4px" }}>
              Offline — {offline.length}
            </div>
            {offline.map(u => <UserRow key={u.id} user={u} online={false} onClick={() => startDm(u.id)} />)}
          </div>
        )}

        {others.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: .3 }}>👥</div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>No other users yet</div>
            <div style={{ fontSize: 12 }}>Share <strong style={{ color: "var(--text-2)" }}>192.168.101.110:5173</strong> on your WiFi</div>
          </div>
        )}
      </div>
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
        <div style={{ fontSize: 14, fontWeight: 500 }}>{user.display_name || user.username}</div>
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
