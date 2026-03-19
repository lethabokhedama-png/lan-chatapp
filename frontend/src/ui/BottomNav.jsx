import React, { useState } from "react";
import { Home, Users, Settings, Plus, MessageSquare } from "react-feather";
import useStore from "../lib/store";
import Modal    from "./Modal";
import { rooms as roomsApi, users as usersApi } from "../lib/api";
import { emit }  from "../lib/socket";

export default function BottomNav({ active, onNavigate, hidePlus }) {
  const { unread, onlineSet, user, rooms, setRooms, setActiveRoom } = useStore();
  const [showNewDm,    setShowNewDm]    = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [allUsers,     setAllUsers]     = useState([]);
  const [chName,       setChName]       = useState("");
  const [chTopic,      setChTopic]      = useState("");
  const [chMembers,    setChMembers]    = useState([]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  const tabs = [
    { id: "home",     icon: Home,          label: "Home",   badge: null },
    { id: "messages", icon: MessageSquare, label: "Chats",  badge: totalUnread > 0 ? totalUnread : null },
    { id: "groups",   icon: Users,         label: "Groups", badge: null },
    { id: "settings", icon: Settings,      label: "Settings", badge: null },
  ];

  async function openNewDm() {
    const list = await usersApi.list();
    setAllUsers(list.filter(u => Number(u.id) !== Number(user?.id)));
    setShowNewDm(true);
  }

  async function startDm(uid) {
    const room = await roomsApi.createDm({ user_id: uid });
    const state = useStore.getState();
    if (!state.rooms.find(r => r.id === room.id)) state.setRooms([...state.rooms, room]);
    setActiveRoom(room);
    emit.joinRoom(room.id);
    setShowNewDm(false);
  }

  async function openNewGroup() {
    const list = await usersApi.list();
    setAllUsers(list.filter(u => Number(u.id) !== Number(user?.id)));
    setChName(""); setChTopic(""); setChMembers([]);
    setShowNewGroup(true);
  }

  async function createGroup() {
    if (!chName.trim()) return;
    const room = await roomsApi.createChannel({ name: chName, topic: chTopic, type: "group" });
    setRooms([...rooms, room]);
    for (const uid of chMembers) {
      await roomsApi.joinRoom?.(room.id, uid).catch(() => {});
    }
    setActiveRoom(room);
    emit.joinRoom(room.id);
    setShowNewGroup(false);
    setChName(""); setChTopic(""); setChMembers([]);
  }

  return (
    <>
      {/* Floating + button */}
      {!hidePlus && (active === "messages" || active === "groups") && (
        <button
          onClick={active === "messages" ? openNewDm : openNewGroup}
          style={{
            position: "fixed", bottom: 70, right: 16,
            width: 48, height: 48, borderRadius: "50%", zIndex: 49,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px var(--accent-glow)",
            transition: "transform 200ms",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <Plus size={22} color="#fff" />
        </button>
      )}

      {/* Bottom nav bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: 60,
        background: "var(--bg-sidebar)", borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-around",
        zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)",
        backdropFilter: "blur(12px)",
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 3, flex: 1, height: "100%",
              background: "transparent", border: "none",
              cursor: "pointer", position: "relative",
              color: isActive ? "var(--accent)" : "var(--text-3)",
              transition: "var(--trans)",
            }}>
              {isActive && (
                <div style={{
                  position: "absolute", top: 0, left: "25%", right: "25%",
                  height: 2, background: "var(--accent)",
                  borderRadius: "0 0 3px 3px",
                  boxShadow: "0 0 8px var(--accent-glow)",
                }} />
              )}
              <div style={{ position: "relative" }}>
                <Icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 1.8} />
                {tab.badge && (
                  <div style={{
                    position: "absolute", top: -6, right: -8,
                    minWidth: 16, height: 16, borderRadius: 8,
                    background: "var(--red)", color: "#fff",
                    fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 4px", border: "1.5px solid var(--bg-sidebar)",
                  }}>
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: 9, fontWeight: isActive ? 600 : 400,
                letterSpacing: 0.3, textTransform: "uppercase",
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* New DM modal */}
      <Modal open={showNewDm} onClose={() => setShowNewDm(false)} title="New Message">
        <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:320, overflowY:"auto" }}>
          {allUsers.map(u => {
            const online = onlineSet.has(Number(u.id));
            return (
              <div key={u.id} onClick={() => startDm(u.id)} style={{
                display:"flex", alignItems:"center", gap:10,
                padding:"9px 10px", borderRadius:"var(--radius-sm)",
                cursor:"pointer", transition:"var(--trans)",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}>
                <div style={{
                  width:36, height:36, borderRadius:"50%",
                  background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:700, color:"#fff", flexShrink:0,
                  position:"relative",
                }}>
                  {(u.display_name || u.username || "?")[0].toUpperCase()}
                  <div style={{
                    position:"absolute", bottom:0, right:0,
                    width:10, height:10, borderRadius:"50%",
                    background: online ? "var(--green)" : "var(--text-3)",
                    border:"2px solid var(--bg-surface)",
                  }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"var(--text-1)" }}>
                    {u.display_name || u.username}
                  </div>
                  <div style={{ fontSize:10, color:"var(--text-3)" }}>@{u.username}</div>
                </div>
                <div style={{
                  fontSize:10, padding:"2px 8px", borderRadius:20,
                  color: online ? "var(--green)" : "var(--text-3)",
                  background: online ? "rgba(78,203,113,.1)" : "transparent",
                  border:`1px solid ${online ? "rgba(78,203,113,.3)" : "var(--border)"}`,
                }}>
                  {online ? "online" : "offline"}
                </div>
              </div>
            );
          })}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowNewDm(false)}>Cancel</button>
        </div>
      </Modal>

      {/* New Group modal */}
      <Modal open={showNewGroup} onClose={() => setShowNewGroup(false)} title="New Group">
        <div className="form-group">
          <label className="label">Group Name</label>
          <input className="input" placeholder="e.g. squad" value={chName}
            onChange={e => setChName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">Description (optional)</label>
          <input className="input" placeholder="What is this group about?" value={chTopic}
            onChange={e => setChTopic(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label">Add Members</label>
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:180, overflowY:"auto" }}>
            {allUsers.map(u => {
              const sel = chMembers.includes(u.id);
              return (
                <div key={u.id} onClick={() => setChMembers(m =>
                  sel ? m.filter(x => x !== u.id) : [...m, u.id]
                )} style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"7px 10px", borderRadius:"var(--radius-sm)", cursor:"pointer",
                  background: sel ? "var(--bg-active)" : "transparent",
                  border: sel ? "1px solid var(--accent-dim)" : "1px solid transparent",
                }}>
                  <div style={{
                    width:28, height:28, borderRadius:"50%",
                    background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, fontWeight:700, color:"#fff", flexShrink:0,
                  }}>
                    {(u.display_name || u.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, color:"var(--text-1)" }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize:10, color:"var(--text-3)" }}>@{u.username}</div>
                  </div>
                  {sel && (
                    <div style={{
                      width:18, height:18, borderRadius:"50%", background:"var(--accent)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="white" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {chMembers.length > 0 && (
            <div style={{ fontSize:11, color:"var(--accent)", marginTop:6 }}>
              {chMembers.length} member{chMembers.length !== 1 ? "s" : ""} selected
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setShowNewGroup(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={createGroup} disabled={!chName.trim()}>
            Create Group
          </button>
        </div>
      </Modal>
    </>
  );
}
