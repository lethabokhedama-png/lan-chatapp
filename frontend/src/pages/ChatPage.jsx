import React, { useState } from "react";
import Sidebar      from "../ui/Sidebar";
import ChatWindow   from "../features/chat/ChatWindow";
import ProfilePanel from "../features/profile/ProfilePanel";
import useStore     from "../lib/store";

export default function ChatPage() {
  const { activeRoom, profilePanel, user } = useStore();

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
        {activeRoom
          ? <ChatWindow room={activeRoom} />
          : <LandingPanel />}
      </div>
      {profilePanel && <ProfilePanel user={profilePanel} />}
    </div>
  );
}

function LandingPanel() {
  const { userMap, onlineSet, user, rooms } = useStore();
  const others = Object.values(userMap).filter(u => u.id !== user?.id);
  const online  = others.filter(u => onlineSet.has(u.id));
  const offline = others.filter(u => !onlineSet.has(u.id));

  async function startDm(uid) {
    const { rooms: roomsApi } = await import("../lib/api");
    const { emit } = await import("../lib/socket");
    const room = await roomsApi.createDm({ user_id: uid });
    useStore.getState().setActiveRoom(room);
    emit.joinRoom(room.id);
  }

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)", padding: 32, position: "relative", overflow: "hidden",
    }}>
      {/* Background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 50% 40% at 15% 20%, rgba(79,142,247,.08) 0%, transparent 60%),
          radial-gradient(ellipse 40% 50% at 85% 80%, rgba(224,107,139,.06) 0%, transparent 55%)
        `,
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: .15 }}>⬡</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
            Welcome back, {user?.display_name || user?.username}
          </div>
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>
            {online.length} {online.length === 1 ? "person" : "people"} online right now
          </div>
        </div>

        {/* Online users */}
        {online.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
              color: "var(--text-3)", fontWeight: 600, marginBottom: 10,
            }}>Online now</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {online.map(u => <UserRow key={u.id} user={u} online onClick={() => startDm(u.id)} />)}
            </div>
          </div>
        )}

        {/* Offline users */}
        {offline.length > 0 && (
          <div>
            <div style={{
              fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
              color: "var(--text-3)", fontWeight: 600, marginBottom: 10,
            }}>Offline</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {offline.map(u => <UserRow key={u.id} user={u} online={false} onClick={() => startDm(u.id)} />)}
            </div>
          </div>
        )}

        {others.length === 0 && (
          <div style={{
            textAlign: "center", color: "var(--text-3)", fontSize: 13,
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: "24px 16px",
          }}>
            No other users yet. Share your LAN IP and port so others can join.
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
    <div onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px", borderRadius: "var(--radius)",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        cursor: "pointer", transition: "var(--trans)",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-raised)"; e.currentTarget.style.borderColor = "var(--accent-dim)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-surface)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg, var(--accent), var(--accent2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color: "#fff", position: "relative",
      }}>
        {initials}
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: 10, height: 10, borderRadius: "50%",
          background: online ? "var(--green)" : "var(--text-3)",
          border: "2px solid var(--bg-surface)",
          boxShadow: online ? "0 0 6px var(--green)" : "none",
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>
          {user.display_name || user.username}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          @{user.username}
        </div>
      </div>
      <div style={{
        fontSize: 11, color: online ? "var(--green)" : "var(--text-3)",
        padding: "3px 9px", borderRadius: 20,
        background: online ? "rgba(78,203,113,.1)" : "rgba(255,255,255,.04)",
        border: `1px solid ${online ? "rgba(78,203,113,.3)" : "var(--border)"}`,
      }}>
        {online ? "● online" : "offline"}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)" }}>→</div>
    </div>
  );
}
