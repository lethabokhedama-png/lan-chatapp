import React, { useEffect, useState, useRef } from "react";
import {
  Home, Hash, Plus, Settings, LogOut,
  Wifi, WifiOff, Search, X,
  ChevronUp, Bell, Lock, Feather, Info, User, MessageSquare
} from "react-feather";
import useStore from "../lib/store";
import { rooms as roomsApi, auth, clearToken, users as usersApi } from "../lib/api";
import { emit } from "../lib/socket";
import Avatar from "./Avatar";
import Modal  from "./Modal";

const VERSION = "v0.4.0";

export default function Sidebar() {
  const {
    rooms, setRooms, setActiveRoom, activeRoom,
    sidebarOpen, toggleSidebar, closeSidebar,
    user, clearAuth, onlineSet, unread, openSettings, userMap,
  } = useStore();

  const [showCh, setShowCh]     = useState(false);
  const [showDm, setShowDm]     = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [chName, setChName]     = useState("");
  const [chTopic, setChTopic]   = useState("");
  const [search, setSearch]     = useState("");
  const [popover, setPopover]   = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    roomsApi.mine().then(r => setRooms(r)).catch(() => {});
  }, []);

  useEffect(() => {
    function onDown(e) {
      if (popRef.current && !popRef.current.contains(e.target)) setPopover(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const channels = rooms.filter(r => r.type === "channel" || r.type === "group");
  const dms      = rooms.filter(r => r.type === "dm");

  function dmOtherId(room) {
    return room.members?.find?.(m => Number(m.user_id) !== Number(user?.id))?.user_id;
  }

  function dmLabel(room) {
    const otherId = dmOtherId(room);
    const other   = otherId ? userMap[Number(otherId)] : null;
    return other?.display_name || other?.username || "DM";
  }

  async function openRoom(room) {
    setActiveRoom(room);
    useStore.getState().clearUnread(room.id);
    emit.joinRoom(room.id);
    closeSidebar();
  }

  function goHome() { setActiveRoom(null); closeSidebar(); }

  async function createGroup() {
    if (!chName.trim()) return;
    const room = await roomsApi.createChannel({ name: chName, topic: chTopic, type: "group" });
    setRooms([...rooms, room]);
    openRoom(room);
    setShowCh(false); setChName(""); setChTopic("");
  }

  async function openDmModal() {
    const list = await usersApi.list();
    setAllUsers(list.filter(u => Number(u.id) !== Number(user?.id)));
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
    clearToken(); clearAuth(); setPopover(false);
  }

  const searchLower = search.toLowerCase();
  const filtered = search
    ? [...channels, ...dms].filter(r =>
        (r.type === "dm" ? dmLabel(r) : r.name).toLowerCase().includes(searchLower)
      )
    : null;

  return (
    <>
      {sidebarOpen && (
        <div onClick={closeSidebar} style={{
          position: "fixed", inset: 0, zIndex: 18,
          background: "rgba(0,0,0,.55)",
          display: window.innerWidth < 700 ? "block" : "none",
        }} />
      )}

      <div className={`sidebar${sidebarOpen ? " open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <Feather size={14} color="#fff" />
            </div>
            <div>
              <span className="logo-name">LAN Chat</span>
              <div style={{ fontSize: 9, color: "var(--text-3)", letterSpacing: .5 }}>{VERSION}</div>
            </div>
          </div>
          <ConnBadge />
        </div>

        {/* Search */}
        <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "var(--bg-raised)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", padding: "6px 10px",
          }}>
            <Search size={12} color="var(--text-3)" />
            <input placeholder="Search…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: "transparent", border: "none",
                outline: "none", color: "var(--text-1)", fontSize: 12,
                fontFamily: "var(--font-body)",
              }} />
            {search && (
              <button className="icon-btn" style={{ width: 16, height: 16 }}
                onClick={() => setSearch("")}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-scroll">
          {/* Home */}
          <div style={{ padding: "4px 6px 2px" }}>
            <div className={`room-item${!activeRoom ? " active" : ""}`} onClick={goHome}>
              <Home size={14} color={!activeRoom ? "var(--accent)" : "var(--text-3)"} />
              <span className="room-item-name">Home</span>
            </div>
          </div>

          {/* Search results */}
          {filtered && (
            <div style={{ padding: "4px 6px" }}>
              <div className="section-label" style={{ padding: "4px 10px" }}>Results</div>
              {filtered.map(r => (
                <RoomRow key={r.id} r={r} active={activeRoom?.id === r.id}
                  label={r.type === "dm" ? dmLabel(r) : r.name}
                  online={r.type === "dm" ? onlineSet.has(Number(dmOtherId(r))) : null}
                  unread={unread[r.id]} userMap={userMap} otherId={dmOtherId(r)}
                  onClick={() => openRoom(r)} />
              ))}
              {!filtered.length && (
                <div style={{ color: "var(--text-3)", fontSize: 12, padding: "6px 14px" }}>No results</div>
              )}
            </div>
          )}

          {!filtered && <>
            {/* Groups */}
            <div style={{ padding: "6px 0 0" }}>
              <div className="section-header">
                <span className="section-label">Groups</span>
                <button className="icon-btn" onClick={() => setShowCh(true)} title="New group">
                  <Plus size={14} />
                </button>
              </div>
              {channels.length === 0 && (
                <div style={{ padding: "3px 18px 8px", fontSize: 11, color: "var(--text-3)" }}>No groups yet</div>
              )}
              {channels.map(r => (
                <RoomRow key={r.id} r={r} active={activeRoom?.id === r.id}
                  label={r.name} unread={unread[r.id]}
                  icon={<Hash size={13} color="var(--text-3)" />}
                  onClick={() => openRoom(r)} />
              ))}
            </div>

            {/* DMs */}
            <div style={{ padding: "6px 0 0" }}>
              <div className="section-header">
                <span className="section-label">Messages</span>
                <button className="icon-btn" onClick={openDmModal} title="New message">
                  <Plus size={14} />
                </button>
              </div>
              {dms.length === 0 && (
                <div style={{ padding: "3px 18px 8px", fontSize: 11, color: "var(--text-3)" }}>No messages yet</div>
              )}
              {dms.map(r => {
                const otherId = dmOtherId(r);
                const online  = onlineSet.has(Number(otherId));
                return (
                  <RoomRow key={r.id} r={r} active={activeRoom?.id === r.id}
                    label={dmLabel(r)} online={online} unread={unread[r.id]}
                    userMap={userMap} otherId={otherId}
                    sub={userMap[Number(otherId)] ? "@" + userMap[Number(otherId)]?.username : null}
                    onClick={() => openRoom(r)} />
                );
              })}
            </div>
          </>}
        </div>

        {/* Footer with popover */}
        <div style={{ borderTop: "1px solid var(--border)", position: "relative" }} ref={popRef}>
          {popover && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 4px)", left: 8, right: 8,
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", boxShadow: "0 -8px 32px rgba(0,0,0,.5)",
              overflow: "hidden", zIndex: 50,
            }}>
              <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
                  {user?.display_name || user?.username}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>@{user?.username}</div>
              </div>
              {[
                { icon: <User size={14} />,     label: "Account",      page: "account" },
                { icon: <Bell size={14} />,     label: "Notifications", page: "notifications" },
                { icon: <Settings size={14} />, label: "Appearance",   page: "appearance" },
                { icon: <Lock size={14} />,     label: "Privacy",      page: "privacy" },
                { icon: <Info size={14} />,     label: "About",        page: "about" },
                ...(user?.username === "lethabok" ? [{ icon: <Settings size={14} />, label: "Dev Panel", page: "dev" }] : []),
              ].map(item => (
                <PopItem key={item.label} icon={item.icon} label={item.label}
                  onClick={() => { openSettings(item.page); setPopover(false); }} />
              ))}
              <div style={{ borderTop: "1px solid var(--border)" }}>
                <PopItem icon={<LogOut size={14} />} label="Sign out"
                  color="var(--red)" onClick={logout} />
              </div>
            </div>
          )}

          {/* Account row */}
          <div onClick={() => setPopover(v => !v)} style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "10px 12px", cursor: "pointer", transition: "var(--trans)",
            background: popover ? "var(--bg-active)" : "transparent",
          }}
            onMouseEnter={e => { if (!popover) e.currentTarget.style.background = "var(--bg-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = popover ? "var(--bg-active)" : "transparent"; }}
          >
            <div className="avatar-wrap">
              <Avatar user={user} size="md" />
              <div className="dot online" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="footer-name">{user?.display_name || user?.username}</div>
              <div style={{ fontSize: 10, color: "var(--green)" }}>● online</div>
            </div>
            <ChevronUp size={13} color="var(--text-3)"
              style={{ transform: popover ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 200ms" }} />
          </div>
        </div>
      </div>

      {/* Create group modal */}
      <Modal open={showCh} onClose={() => setShowCh(false)} title="New Group">
        <div className="form-group">
          <label className="label">Group Name</label>
          <input className="input" placeholder="e.g. squad" value={chName}
            onChange={e => setChName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createGroup()} />
        </div>
        <div className="form-group">
          <label className="label">Description (optional)</label>
          <input className="input" placeholder="What's this group about?" value={chTopic}
            onChange={e => setChTopic(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowCh(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={createGroup}>Create</button>
        </div>
      </Modal>

      {/* New DM modal */}
      <Modal open={showDm} onClose={() => setShowDm(false)} title="New Direct Message">
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
          {allUsers.map(u => {
            const online = onlineSet.has(Number(u.id));
            return (
              <div key={u.id} onClick={() => startDm(u.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <Avatar user={u} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
                    {u.display_name || u.username}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>@{u.username}</div>
                </div>
                <div style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 20,
                  color: online ? "var(--green)" : "var(--text-3)",
                  background: online ? "rgba(78,203,113,.1)" : "transparent",
                  border: `1px solid ${online ? "rgba(78,203,113,.3)" : "var(--border)"}`,
                }}>
                  {online ? "● online" : "offline"}
                </div>
              </div>
            );
          })}
          {!allUsers.length && (
            <div style={{ color: "var(--text-3)", textAlign: "center", padding: 20, fontSize: 13 }}>
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

function RoomRow({ r, active, label, icon, online, unread, userMap, otherId, onClick, sub }) {
  return (
    <div className={`room-item${active ? " active" : ""}`} onClick={onClick}>
      {icon
        ? <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
        : otherId && userMap
        ? <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: "#fff",
            }}>
              {(label || "?")[0].toUpperCase()}
            </div>
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 7, height: 7, borderRadius: "50%",
              background: online ? "var(--green)" : "var(--text-3)",
              border: "1.5px solid var(--bg-sidebar)",
            }} />
          </div>
        : null
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="room-item-name">{label}</div>
        {sub && <div className="room-item-sub">{sub}</div>}
      </div>
      {!!unread && <div className="unread-badge">{unread > 99 ? "99+" : unread}</div>}
    </div>
  );
}

function PopItem({ icon, label, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      width: "100%", padding: "9px 14px",
      background: "transparent", border: "none",
      color: color || "var(--text-2)", cursor: "pointer",
      fontSize: 13, fontFamily: "var(--font-body)", textAlign: "left",
    }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ color: color || "var(--text-3)", flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

function ConnBadge() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const t = setInterval(async () => {
      const { getSocket } = await import("../lib/socket");
      setConnected(!!getSocket()?.connected);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 20, fontSize: 10, fontWeight: 500,
      background: connected ? "rgba(78,203,113,.1)" : "rgba(224,92,92,.1)",
      border: `1px solid ${connected ? "rgba(78,203,113,.3)" : "rgba(224,92,92,.3)"}`,
      color: connected ? "var(--green)" : "var(--red)",
    }}>
      {connected ? <Wifi size={10} /> : <WifiOff size={10} />}
      {connected ? "live" : "off"}
    </div>
  );
}
