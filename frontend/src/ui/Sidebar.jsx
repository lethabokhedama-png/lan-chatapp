import React, { useEffect, useState } from "react";
import useStore     from "../lib/store";
import { rooms as roomsApi, auth, clearToken } from "../lib/api";
import { emit }     from "../lib/socket";
import Avatar       from "./Avatar";
import Modal        from "./Modal";

const PALETTES = [
  { id: "default",       label: "Default",         colors: ["#0d0f14","#4f8ef7"] },
  { id: "midnight_blue", label: "Midnight Blue",   colors: ["#080e1a","#5baaf7"] },
  { id: "grape_soda",    label: "Grape Soda",      colors: ["#100a1c","#a855f7"] },
  { id: "forest_moss",   label: "Forest Moss",     colors: ["#080e0a","#4ade80"] },
  { id: "sunset_ember",  label: "Sunset Ember",    colors: ["#130a04","#f97316"] },
  { id: "ocean_teal",    label: "Ocean Teal",      colors: ["#040e0e","#2dd4bf"] },
  { id: "bubblegum",     label: "Bubblegum",       colors: ["#130810","#f472b6"] },
  { id: "solarized_sand",label: "Solarized Sand",  colors: ["#fdf6e3","#b58900"] },
];

export default function Sidebar() {
  const {
    rooms, setRooms, setActiveRoom, activeRoom, sidebarOpen, toggleSidebar,
    user, clearAuth, onlineSet, unread, openSettings,
  } = useStore();

  const [showCh, setShowCh]   = useState(false);
  const [showDm, setShowDm]   = useState(false);
  const [allUsers, setAllUsers]= useState([]);
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
    if (sidebarOpen) toggleSidebar();
  }

  async function createChannel() {
    if (!chName.trim()) return;
    const room = await roomsApi.createChannel({ name: chName, topic: chTopic });
    setRooms([...rooms, room]);
    setActiveRoom(room);
    emit.joinRoom(room.id);
    setShowCh(false); setChName(""); setChTopic("");
  }

  async function openDmModal() {
    const list = await import("../lib/api").then(m => m.users.list());
    setAllUsers(list.filter(u => u.id !== user?.id));
    setShowDm(true);
  }

  async function startDm(otherId) {
    const room = await roomsApi.createDm({ user_id: otherId });
    if (!rooms.find(r => r.id === room.id)) setRooms([...rooms, room]);
    setActiveRoom(room);
    emit.joinRoom(room.id);
    setShowDm(false);
  }

  function logout() {
    auth.logout().catch(() => {});
    clearToken();
    clearAuth();
  }

  function dmName(room) {
    const otherId = room.members?.find?.(m => m.user_id !== user?.id)?.user_id
      || room.name.split(":").filter(x => parseInt(x) !== user?.id)[0];
    const other = useStore.getState().userMap[otherId];
    return other?.display_name || other?.username || "Direct Message";
  }

  return (
    <>
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
          {/* Channels */}
          <div className="sidebar-section">
            <div className="section-header">
              <span className="section-label">Channels</span>
              <button className="icon-btn" title="New channel" onClick={() => setShowCh(true)}>＋</button>
            </div>
            {channels.map(r => (
              <RoomItem key={r.id} icon="#" name={r.name}
                active={activeRoom?.id === r.id}
                unread={unread[r.id]}
                onClick={() => openRoom(r)} />
            ))}
          </div>

          {/* DMs */}
          <div className="sidebar-section">
            <div className="section-header">
              <span className="section-label">Direct Messages</span>
              <button className="icon-btn" title="New DM" onClick={openDmModal}>＋</button>
            </div>
            {dms.map(r => {
              const name = dmName(r);
              const otherId = r.members?.find?.(m => m.user_id !== user?.id)?.user_id;
              const online = onlineSet.has(otherId);
              return (
                <RoomItem key={r.id} icon={null} name={name}
                  active={activeRoom?.id === r.id}
                  unread={unread[r.id]}
                  online={online}
                  onClick={() => openRoom(r)} />
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
          <button className="icon-btn" title="Settings"
            onClick={(e) => { e.stopPropagation(); openSettings("account"); }}
            style={{ fontSize: 15 }}>⚙</button>
          <button className="icon-btn" title="Sign out"
            onClick={(e) => { e.stopPropagation(); logout(); }}>⏻</button>
        </div>
      </div>

      {/* Create channel modal */}
      <Modal open={showCh} onClose={() => setShowCh(false)} title="Create Channel">
        <div className="form-group">
          <label className="label">Channel Name</label>
          <input className="input" placeholder="e.g. general"
            value={chName} onChange={e => setChName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createChannel()} />
        </div>
        <div className="form-group">
          <label className="label">Topic (optional)</label>
          <input className="input" placeholder="What's this channel about?"
            value={chTopic} onChange={e => setChTopic(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowCh(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={createChannel}>Create</button>
        </div>
      </Modal>

      {/* New DM modal */}
      <Modal open={showDm} onClose={() => setShowDm(false)} title="New Direct Message">
        <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 320, overflowY: "auto" }}>
          {allUsers.map(u => (
            <div key={u.id}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px",
                       borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "var(--trans)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = ""}
              onClick={() => startDm(u.id)}>
              <Avatar user={u} size="sm" />
              <div>
                <div style={{ fontSize: 13 }}>{u.display_name || u.username}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)" }}>@{u.username}</div>
              </div>
              <div className={`dot ${onlineSet.has(u.id) ? "online" : "offline"}`}
                style={{ marginLeft: "auto" }} />
            </div>
          ))}
          {allUsers.length === 0 && (
            <div style={{ color: "var(--text-3)", textAlign: "center", padding: 20 }}>
              No other users yet
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowDm(false)}>Close</button>
        </div>
      </Modal>
    </>
  );
}

function RoomItem({ icon, name, active, unread, online, onClick }) {
  return (
    <div className={`room-item${active ? " active" : ""}`} onClick={onClick}>
      {icon
        ? <span className="room-item-icon">{icon}</span>
        : (
          <div style={{ position: "relative", width: 16, flexShrink: 0 }}>
            <div className={`dot ${online ? "online" : "offline"}`} style={{ width: 8, height: 8 }} />
          </div>
        )}
      <span className="room-item-name">{name}</span>
      {!!unread && <div className="unread-badge">{unread > 99 ? "99+" : unread}</div>}
    </div>
  );
}

function ConnBadge() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const s = import("../lib/socket").then(m => {
      const check = () => setConnected(m.getSocket()?.connected ?? false);
      const sock = m.getSocket();
      if (sock) { sock.on("connect", check); sock.on("disconnect", check); check(); }
      return sock;
    });
  }, []);
  return (
    <div className={`conn-badge ${connected ? "ok" : "off"}`}>
      <span>●</span> {connected ? "online" : "offline"}
    </div>
  );
}