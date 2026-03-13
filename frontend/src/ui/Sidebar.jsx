import React, { useEffect, useState } from "react";
import useStore from "../lib/store";
import { rooms as roomsApi, auth, clearToken } from "../lib/api";
import { emit } from "../lib/socket";
import Avatar from "./Avatar";
import Modal  from "./Modal";

export default function Sidebar() {
  const {
    rooms, setRooms, setActiveRoom, activeRoom,
    sidebarOpen, toggleSidebar, user, clearAuth,
    onlineSet, unread, openSettings,
  } = useStore();

  const [showCh, setShowCh]   = useState(false);
  const [showDm, setShowDm]   = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [chName, setChName]   = useState("");
  const [chTopic, setChTopic] = useState("");

  useEffect(() => {
    roomsApi.mine().then(r => setRooms(r)).catch(() => {});
  }, []);

  const channels = rooms.filter(r => r.type === "channel");
  const dms      = rooms.filter(r => r.type === "dm");

  async function openRoom(room) {
    setActiveRoom(room);
    useStore.getState().clearUnread(room.id);
    emit.joinRoom(room.id);
    if (window.innerWidth < 700) toggleSidebar();
  }

  function goHome() {
    setActiveRoom(null);
    if (window.innerWidth < 700) toggleSidebar();
  }

  async function createChannel() {
    if (!chName.trim()) return;
    const room = await roomsApi.createChannel({ name: chName, topic: chTopic });
    setRooms([...rooms, room]);
    openRoom(room);
    setShowCh(false); setChName(""); setChTopic("");
  }

  async function openDmModal() {
    const { users } = await import("../lib/api");
    const list = await users.list();
    setAllUsers(list.filter(u => u.id !== user?.id));
    setShowDm(true);
  }

  async function startDm(otherId) {
    const room = await roomsApi.createDm({ user_id: otherId });
    if (!rooms.find(r => r.id === room.id)) setRooms([...rooms, { ...room }]);
    openRoom(room);
    setShowDm(false);
  }

  function logout() {
    auth.logout().catch(() => {});
    clearToken(); clearAuth();
  }

  function dmLabel(room) {
    const m = room.members?.find?.(m => m.user_id !== user?.id);
    const other = m ? useStore.getState().userMap[m.user_id] : null;
    return other?.display_name || other?.username || "Direct Message";
  }

  function dmOtherId(room) {
    return room.members?.find?.(m => m.user_id !== user?.id)?.user_id;
  }

  return (
    <>
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div onClick={toggleSidebar} style={{
          display: "none",
          position: "fixed", inset: 0, zIndex: 19,
          background: "rgba(0,0,0,.5)",
          ...(window.innerWidth < 700 ? { display: "block" } : {}),
        }} />
      )}

      <div className={`sidebar${sidebarOpen ? " open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">⬡</div>
            <span className="logo-name">LAN Chat</span>
          </div>
          <ConnBadge />
        </div>

        <div className="sidebar-scroll">
          {/* Home button */}
          <div style={{ padding: "4px 6px 2px" }}>
            <div className={`room-item${!activeRoom ? " active" : ""}`} onClick={goHome}>
              <span style={{ fontSize: 14 }}>🏠</span>
              <span className="room-item-name">Home</span>
            </div>
          </div>

          {/* Channels */}
          <div style={{ padding: "6px 0 0" }}>
            <div className="section-header">
              <span className="section-label">Channels</span>
              <button className="icon-btn" onClick={() => setShowCh(true)}>＋</button>
            </div>
            {channels.map(r => (
              <div key={r.id} className={`room-item${activeRoom?.id === r.id ? " active" : ""}`}
                onClick={() => openRoom(r)}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>#</span>
                <span className="room-item-name">{r.name}</span>
                {!!unread[r.id] && <div className="unread-badge">{unread[r.id] > 99 ? "99+" : unread[r.id]}</div>}
              </div>
            ))}
          </div>

          {/* DMs */}
          <div style={{ padding: "6px 0 0" }}>
            <div className="section-header">
              <span className="section-label">Direct Messages</span>
              <button className="icon-btn" onClick={openDmModal}>＋</button>
            </div>
            {dms.map(r => {
              const label    = dmLabel(r);
              const otherId  = dmOtherId(r);
              const online   = onlineSet.has(otherId);
              return (
                <div key={r.id} className={`room-item${activeRoom?.id === r.id ? " active" : ""}`}
                  onClick={() => openRoom(r)}>
                  <div style={{ position: "relative", width: 10, flexShrink: 0 }}>
                    <div className={`dot ${online ? "online" : "offline"}`} style={{ width: 8, height: 8 }} />
                  </div>
                  <span className="room-item-name">{label}</span>
                  {!!unread[r.id] && <div className="unread-badge">{unread[r.id] > 99 ? "99+" : unread[r.id]}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="sidebar-footer" onClick={() => openSettings("account")}>
          <div className="avatar-wrap">
            <Avatar user={user} size="md" />
            <div className="dot online" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="footer-name">{user?.display_name || user?.username}</div>
            <div className="footer-status">online</div>
          </div>
          <button className="icon-btn" onClick={e => { e.stopPropagation(); openSettings("account"); }}>⚙</button>
          <button className="icon-btn" onClick={e => { e.stopPropagation(); logout(); }}>⏻</button>
        </div>
      </div>

      {/* Create channel */}
      <Modal open={showCh} onClose={() => setShowCh(false)} title="New Channel">
        <div className="form-group">
          <label className="label">Name</label>
          <input className="input" placeholder="e.g. general" value={chName}
            onChange={e => setChName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createChannel()} />
        </div>
        <div className="form-group">
          <label className="label">Topic (optional)</label>
          <input className="input" placeholder="What's this about?" value={chTopic}
            onChange={e => setChTopic(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowCh(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={createChannel}>Create</button>
        </div>
      </Modal>

      {/* New DM */}
      <Modal open={showDm} onClose={() => setShowDm(false)} title="New Direct Message">
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          {allUsers.map(u => {
            const online = onlineSet.has(u.id);
            return (
              <div key={u.id} onClick={() => startDm(u.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "var(--trans)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <Avatar user={u} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{u.display_name || u.username}</div>
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>@{u.username}</div>
                </div>
                <div className={`dot ${online ? "online" : "offline"}`} />
              </div>
            );
          })}
          {!allUsers.length && <div style={{ color: "var(--text-3)", textAlign: "center", padding: 20, fontSize: 13 }}>No other users yet</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowDm(false)}>Close</button>
        </div>
      </Modal>
    </>
  );
}

function ConnBadge() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const check = async () => {
      const { getSocket } = await import("../lib/socket");
      const s = getSocket();
      if (!s) return;
      const upd = () => setConnected(s.connected);
      s.on("connect", upd); s.on("disconnect", upd); upd();
      return () => { s.off("connect", upd); s.off("disconnect", upd); };
    };
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, []);
  return <div className={`conn-badge ${connected ? "ok" : "off"}`}><span>●</span>{connected ? " live" : " off"}</div>;
}
