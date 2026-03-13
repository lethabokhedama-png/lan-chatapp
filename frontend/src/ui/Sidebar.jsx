import React, { useEffect, useState, useRef } from "react";
import {
  House, Hash, ChatCircleDots, Plus, Gear, SignOut,
  WifiNone, WifiHigh, MagnifyingGlass, X,
  CaretDown, Bell, Lock, Palette, Info, ArrowLeft
} from "@phosphor-icons/react";
import useStore from "../lib/store";
import { rooms as roomsApi, auth, clearToken } from "../lib/api";
import { emit } from "../lib/socket";
import Avatar from "./Avatar";
import Modal  from "./Modal";

export default function Sidebar() {
  const {
    rooms, setRooms, setActiveRoom, activeRoom,
    sidebarOpen, toggleSidebar, closeSidebar,
    user, clearAuth, onlineSet, unread, openSettings,
    userMap,
  } = useStore();

  const [showCh, setShowCh]     = useState(false);
  const [showDm, setShowDm]     = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [chName, setChName]     = useState("");
  const [chTopic, setChTopic]   = useState("");
  const [search, setSearch]     = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [popover, setPopover]   = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    roomsApi.mine().then(r => setRooms(r)).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (popRef.current && !popRef.current.contains(e.target)) setPopover(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("touchstart", onClick); };
  }, []);

  const channels = rooms.filter(r => r.type === "channel");
  const dms      = rooms.filter(r => r.type === "dm");

  const filtered = search.trim()
    ? [...channels, ...dms].filter(r => roomLabel(r, user, userMap).toLowerCase().includes(search.toLowerCase()))
    : null;

  function roomLabel(r, u, map) {
    if (r.type === "channel") return r.name;
    const m = r.members?.find(m => m.user_id !== u?.id);
    const other = m ? map[m.user_id] : null;
    return other?.display_name || other?.username || "DM";
  }

  async function openRoom(room) {
    setActiveRoom(room);
    useStore.getState().clearUnread(room.id);
    emit.joinRoom(room.id);
    if (window.innerWidth < 700) closeSidebar();
  }

  function goHome() {
    setActiveRoom(null);
    if (window.innerWidth < 700) closeSidebar();
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
    setPopover(false);
  }

  function dmOtherId(room) {
    return room.members?.find?.(m => m.user_id !== user?.id)?.user_id;
  }

  const displayRooms = filtered || null;

  return (
    <>
      {sidebarOpen && (
        <div onClick={closeSidebar} style={{
          display: window.innerWidth < 700 ? "block" : "none",
          position: "fixed", inset: 0, zIndex: 19,
          background: "rgba(0,0,0,.5)",
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

        {/* Search bar */}
        <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "var(--bg-raised)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", padding: "6px 10px",
          }}>
            <MagnifyingGlass size={13} color="var(--text-3)" weight="bold" />
            <input
              placeholder="Search rooms…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: "transparent", border: "none",
                outline: "none", color: "var(--text-1)", fontSize: 12,
                fontFamily: "var(--font-body)",
              }}
            />
            {search && <button className="icon-btn" style={{ width: 18, height: 18, fontSize: 10 }}
              onClick={() => setSearch("")}><X size={11} /></button>}
          </div>
        </div>

        <div className="sidebar-scroll">
          {/* Home */}
          <div style={{ padding: "4px 6px 2px" }}>
            <div className={`room-item${!activeRoom ? " active" : ""}`} onClick={goHome}>
              <House size={15} weight={!activeRoom ? "fill" : "regular"} color="var(--accent)" />
              <span className="room-item-name">Home</span>
            </div>
          </div>

          {/* Search results */}
          {search && (
            <div style={{ padding: "4px 6px" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2,
                color: "var(--text-3)", fontWeight: 600, padding: "4px 10px 4px" }}>
                Results
              </div>
              {[...channels, ...dms]
                .filter(r => roomLabel(r, user, userMap).toLowerCase().includes(search.toLowerCase()))
                .map(r => (
                  <RoomItem key={r.id} room={r} active={activeRoom?.id === r.id}
                    label={roomLabel(r, user, userMap)}
                    online={r.type === "dm" ? onlineSet.has(dmOtherId(r)) : null}
                    unread={unread[r.id]} onClick={() => openRoom(r)} />
                ))}
            </div>
          )}

          {!search && <>
            {/* Channels */}
            <div style={{ padding: "6px 0 0" }}>
              <div className="section-header">
                <span className="section-label">Channels</span>
                <button className="icon-btn" onClick={() => setShowCh(true)} title="New channel">
                  <Plus size={14} weight="bold" />
                </button>
              </div>
              {channels.length === 0 && (
                <div style={{ padding: "4px 18px 8px", fontSize: 11, color: "var(--text-3)" }}>
                  No channels yet
                </div>
              )}
              {channels.map(r => (
                <RoomItem key={r.id} room={r} active={activeRoom?.id === r.id}
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
                  <Plus size={14} weight="bold" />
                </button>
              </div>
              {dms.length === 0 && (
                <div style={{ padding: "4px 18px 8px", fontSize: 11, color: "var(--text-3)" }}>
                  No messages yet
                </div>
              )}
              {dms.map(r => {
                const otherId = dmOtherId(r);
                const other   = userMap[otherId];
                const online  = onlineSet.has(otherId);
                return (
                  <RoomItem key={r.id} room={r} active={activeRoom?.id === r.id}
                    label={other?.display_name || other?.username || "DM"}
                    online={online} unread={unread[r.id]}
                    icon={
                      <div style={{ position: "relative", width: 22, height: 22, flexShrink: 0 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff",
                        }}>
                          {(other?.display_name || other?.username || "?")[0].toUpperCase()}
                        </div>
                        <div style={{
                          position: "absolute", bottom: 0, right: 0,
                          width: 7, height: 7, borderRadius: "50%",
                          background: online ? "var(--green)" : "var(--text-3)",
                          border: "1.5px solid var(--bg-sidebar)",
                          boxShadow: online ? "0 0 4px var(--green)" : "none",
                        }} />
                      </div>
                    }
                    onClick={() => openRoom(r)} />
                );
              })}
            </div>
          </>}
        </div>

        {/* Footer with popover */}
        <div style={{ padding: "8px", borderTop: "1px solid var(--border)", position: "relative" }} ref={popRef}>
          {/* Popover */}
          {popover && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", left: 8, right: 8,
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", boxShadow: "0 -8px 32px rgba(0,0,0,.5)",
              overflow: "hidden", zIndex: 50,
            }}>
              <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.display_name || user?.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>@{user?.username}</div>
              </div>
              {[
                { icon: <Gear size={14} />,    label: "Settings",       action: () => { openSettings("account"); setPopover(false); } },
                { icon: <Bell size={14} />,    label: "Notifications",  action: () => { openSettings("notifications"); setPopover(false); } },
                { icon: <Palette size={14} />, label: "Appearance",     action: () => { openSettings("appearance"); setPopover(false); } },
                { icon: <Lock size={14} />,    label: "Privacy",        action: () => { openSettings("privacy"); setPopover(false); } },
                { icon: <Info size={14} />,    label: "About",          action: () => { openSettings("about"); setPopover(false); } },
              ].map(item => (
                <button key={item.label} onClick={item.action} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "9px 14px",
                  background: "transparent", border: "none",
                  color: "var(--text-2)", cursor: "pointer",
                  fontSize: 13, fontFamily: "var(--font-body)",
                  textAlign: "left", transition: "var(--trans)",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  onTouchStart={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onTouchEnd={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ color: "var(--text-3)" }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
              <div style={{ borderTop: "1px solid var(--border)" }}>
                <button onClick={logout} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "9px 14px",
                  background: "transparent", border: "none",
                  color: "var(--red)", cursor: "pointer",
                  fontSize: 13, fontFamily: "var(--font-body)", textAlign: "left",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(224,92,92,.08)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <SignOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}

          {/* Account row */}
          <div onClick={() => setPopover(v => !v)} style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "8px 10px", borderRadius: "var(--radius-sm)",
            cursor: "pointer", transition: "var(--trans)",
            background: popover ? "var(--bg-active)" : "transparent",
          }}
            onMouseEnter={e => { if (!popover) e.currentTarget.style.background = "var(--bg-hover)"; }}
            onMouseLeave={e => { if (!popover) e.currentTarget.style.background = "transparent"; }}
          >
            <div className="avatar-wrap">
              <Avatar user={user} size="md" />
              <div className="dot online" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="footer-name">{user?.display_name || user?.username}</div>
              <div className="footer-status" style={{ color: "var(--green)" }}>● online</div>
            </div>
            <CaretDown size={13} color="var(--text-3)"
              style={{ transform: popover ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }} />
          </div>
        </div>
      </div>

      {/* Create channel modal */}
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

      {/* New DM modal */}
      <Modal open={showDm} onClose={() => setShowDm(false)} title="New Direct Message">
        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
          {allUsers.map(u => {
            const online = onlineSet.has(u.id);
            return (
              <div key={u.id} onClick={() => startDm(u.id)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: "var(--radius-sm)",
                cursor: "pointer", transition: "var(--trans)",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <Avatar user={u} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{u.display_name || u.username}</div>
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

function RoomItem({ room, active, label, icon, online, unread, onClick }) {
  return (
    <div className={`room-item${active ? " active" : ""}`} onClick={onClick}>
      {icon && <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>}
      <span className="room-item-name">{label}</span>
      {!!unread && <div className="unread-badge">{unread > 99 ? "99+" : unread}</div>}
    </div>
  );
}

function ConnBadge() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const t = setInterval(async () => {
      const { getSocket } = await import("../lib/socket");
      const s = getSocket();
      setConnected(!!s?.connected);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 500,
      background: connected ? "rgba(78,203,113,.1)" : "rgba(224,92,92,.1)",
      border: `1px solid ${connected ? "rgba(78,203,113,.3)" : "rgba(224,92,92,.3)"}`,
      color: connected ? "var(--green)" : "var(--red)",
    }}>
      {connected
        ? <WifiHigh size={11} weight="bold" />
        : <WifiNone size={11} weight="bold" />}
      {connected ? "live" : "off"}
    </div>
  );
}
