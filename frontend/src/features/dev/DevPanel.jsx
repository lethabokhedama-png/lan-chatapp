import React, { useState, useEffect, useRef } from "react";
import {
  X, Activity, Users, Flag, Terminal,
  Send, RefreshCw, Wifi, WifiOff,
  CheckCircle, Clock, Trash2, AlertCircle,
  Eye, EyeOff, Radio, MessageSquare
} from "react-feather";
import useStore from "../../lib/store";
import { getToken } from "../../lib/api";
import { emit } from "../../lib/socket";

const BASE = () => import.meta.env.VITE_API_URL || "";

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(BASE() + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

const TABS = [
  { id: "stats",   label: "Stats",    icon: <Activity size={13} /> },
  { id: "users",   label: "Users",    icon: <Users size={13} /> },
  { id: "flags",   label: "Flags",    icon: <Flag size={13} /> },
  { id: "monitor", label: "Monitor",  icon: <Radio size={13} /> },
  { id: "system",  label: "System",   icon: <Send size={13} /> },
  { id: "console", label: "Console",  icon: <Terminal size={13} /> },
  { id: "logs",    label: "Logs",     icon: <MessageSquare size={13} /> },
];

const DEFAULT_FLAGS = {
  smart_replies:       { value: true,  desc: "Show AI-style reply suggestions in chat" },
  voice_notes:         { value: true,  desc: "Allow users to record and send voice messages" },
  disappearing_photos: { value: true,  desc: "1x and 2x view photos that delete after viewing" },
  read_receipts:       { value: true,  desc: "Show Sent / Delivered / Read under messages" },
  typing_indicators:   { value: true,  desc: "Show typing animation when someone is typing" },
  online_presence:     { value: true,  desc: "Show green/red online status dots" },
  group_mentions:      { value: true,  desc: "Allow @username mentions in group chats" },
  registration_open:   { value: true,  desc: "Allow new users to create accounts" },
  maintenance_mode:    { value: false, desc: "Block all logins and show maintenance message" },
  max_voice_seconds:   { value: 300,   desc: "Maximum voice note length in seconds" },
  max_upload_mb:       { value: 10,    desc: "Maximum file upload size in megabytes" },
  max_group_members:   { value: 50,    desc: "Maximum members allowed per group" },
};

// Built-in console commands
const COMMANDS = {
  help: () => [
    "Available commands:",
    "  help          — show this list",
    "  status        — show server status",
    "  users         — list all users",
    "  rooms         — list all rooms",
    "  online        — show online users",
    "  kick <user>   — kick a user offline",
    "  ghost on/off  — toggle ghost mode",
    "  flag <k> <v>  — set a feature flag",
    "  broadcast <msg> — send system message to all rooms",
    "  clear         — clear console",
    "  version       — show app version",
  ],
  version: () => ["LAN Chat v1.7.16 — by LethaboK"],
  clear: () => ["__clear__"],
};

export default function DevPanel({ onClose }) {
  const [tab,       setTab]       = useState("stats");
  const [stats,     setStats]     = useState(null);
  const [users,     setUsers]     = useState([]);
  const [flags,     setFlags]     = useState({});
  const [logs,      setLogs]      = useState([]);
  const [monitor,   setMonitor]   = useState([]);
  const [sysMsg,    setSysMsg]    = useState("");
  const [sysRoom,   setSysRoom]   = useState("all");
  const [ghost,     setGhost]     = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [uptime,    setUptime]    = useState(0);
  const [cmdInput,  setCmdInput]  = useState("");
  const [cmdHistory,setCmdHistory]= useState([
    { type: "system", text: "LAN Chat Dev Console v1.7.16" },
    { type: "system", text: 'Type "help" for available commands.' },
  ]);
  const cmdRef     = useRef(null);
  const startRef   = useRef(Date.now());
  const monitorRef = useRef(null);
  const { rooms, onlineSet, userMap, user } = useStore();

  useEffect(() => {
    loadStats(); loadFlags();
    const t = setInterval(() => setUptime(Math.floor((Date.now() - startRef.current) / 1000)), 1000);

    // Monitor all socket messages
    const { getSocket } = require ? null : null;
    import("../../lib/socket").then(m => {
      const socket = m.getSocket();
      if (socket) {
        socket.on("msg:new", (msg) => {
          setMonitor(prev => [{
            ts: new Date().toLocaleTimeString(),
            room: msg.room_id,
            sender: userMap[msg.sender_id]?.username || msg.sender_id,
            content: msg.content?.slice(0, 60) || "[media]",
            type: msg.type,
          }, ...prev].slice(0, 100));
        });
      }
    });

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (tab === "users") loadUsers();
    if (tab === "logs")  loadLogs();
  }, [tab]);

  async function loadStats() {
    try {
      const data = await apiFetch("/api/health");
      setStats({ ...data, users: Object.keys(userMap).length, rooms: rooms.length, online: onlineSet.size });
    } catch (_) {}
  }

  async function loadUsers() {
    setLoading(true);
    try { setUsers(await apiFetch("/api/users/")); } catch (_) {}
    setLoading(false);
  }

  async function loadFlags() {
    try {
      const data = await apiFetch("/api/dev/flags");
      setFlags(data.global || {});
    } catch (_) {
      // Use defaults
      const f = {};
      Object.entries(DEFAULT_FLAGS).forEach(([k, v]) => f[k] = v.value);
      setFlags(f);
    }
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/dev/logs");
      setLogs(Array.isArray(data) ? data.slice(-100).reverse() : []);
    } catch (_) {
      setLogs([{ ts: new Date().toISOString(), type: "info", msg: "Log endpoint not available yet" }]);
    }
    setLoading(false);
  }

  async function toggleFlag(key, val) {
    const newVal = typeof val === "boolean" ? !val : val;
    setFlags(f => ({ ...f, [key]: newVal }));
    try { await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify({ [key]: newVal }) }); }
    catch (_) {}
  }

  async function kickUser(uid, username) {
    if (!confirm(`Kick @${username} offline?`)) return;
    try {
      // Emit kick event via socket
      import("../../lib/socket").then(m => {
        m.getSocket()?.emit("dev:kick", { uid });
      });
      addLog("info", `Kicked @${username}`);
    } catch (_) {}
  }

  async function deleteUser(uid, username) {
    if (!confirm(`Delete account @${username}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/users/${uid}`, { method: "DELETE" });
      setUsers(u => u.filter(x => x.id !== uid));
      addLog("warn", `Deleted @${username}`);
    } catch (_) {}
  }

  async function sendSystemMessage() {
    if (!sysMsg.trim()) return;
    const content = `[system] ${sysMsg.trim()}`;
    if (sysRoom === "all") {
      rooms.forEach(r => emit.sendMsg({ roomId: r.id, content, type: "system", clientId: `sys_${Date.now()}_${r.id}` }));
    } else {
      emit.sendMsg({ roomId: sysRoom, content, type: "system", clientId: `sys_${Date.now()}` });
    }
    addLog("info", `System message sent: ${sysMsg}`);
    setSysMsg("");
  }

  function toggleGhost() {
    const next = !ghost;
    setGhost(next);
    import("../../lib/socket").then(m => {
      m.getSocket()?.emit("presence:ghost", { ghost: next });
    });
    addLog("info", next ? "Ghost mode ON — you appear offline" : "Ghost mode OFF — you are visible");
  }

  function addLog(type, msg) {
    setLogs(l => [{ ts: new Date().toISOString(), type, msg }, ...l].slice(0, 100));
  }

  // Console command runner
  async function runCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parts = trimmed.split(" ");
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);

    setCmdHistory(h => [...h, { type: "input", text: `> ${trimmed}` }]);

    let output = [];

    if (cmd === "clear") {
      setCmdHistory([{ type: "system", text: "Console cleared." }]);
      setCmdInput("");
      return;
    } else if (cmd === "help") {
      output = COMMANDS.help();
    } else if (cmd === "version") {
      output = COMMANDS.version();
    } else if (cmd === "status") {
      output = [
        `Status:  ${stats?.status || "unknown"}`,
        `Version: v1.7.16`,
        `Uptime:  ${fmtUptime(uptime)}`,
        `Users:   ${stats?.users || "?"}`,
        `Online:  ${onlineSet.size}`,
        `Rooms:   ${rooms.length}`,
      ];
    } else if (cmd === "users") {
      if (!users.length) await loadUsers();
      output = users.map(u => `  ${u.id.toString().padStart(3)} @${u.username} — ${u.display_name || ""}`);
      if (!output.length) output = ["No users found"];
    } else if (cmd === "rooms") {
      output = rooms.map(r => `  ${r.id} — ${r.name || r.id} [${r.type}]`);
      if (!output.length) output = ["No rooms"];
    } else if (cmd === "online") {
      const onlineUsers = Array.from(onlineSet).map(id => userMap[id]).filter(Boolean);
      output = onlineUsers.length
        ? onlineUsers.map(u => `  @${u.username} — ${u.display_name || ""}`)
        : ["No one online"];
    } else if (cmd === "kick") {
      const uname = args[0]?.replace("@","");
      const u = users.find(x => x.username === uname);
      if (u) { await kickUser(u.id, u.username); output = [`Kicked @${uname}`]; }
      else output = [`User @${uname || "?"} not found`];
    } else if (cmd === "ghost") {
      const mode = args[0]?.toLowerCase();
      if (mode === "on") { setGhost(true); output = ["Ghost mode ON"]; }
      else if (mode === "off") { setGhost(false); output = ["Ghost mode OFF"]; }
      else output = ["Usage: ghost on | ghost off"];
    } else if (cmd === "flag") {
      if (args.length < 2) {
        output = Object.entries(flags).map(([k, v]) => `  ${k}: ${v}`);
      } else {
        const [k, v] = args;
        const parsed = v === "true" ? true : v === "false" ? false : Number(v) || v;
        await toggleFlag(k, flags[k]);
        output = [`Flag "${k}" set to ${parsed}`];
      }
    } else if (cmd === "broadcast") {
      const msg = args.join(" ");
      if (msg) {
        rooms.forEach(r => emit.sendMsg({
          roomId: r.id, content: `[system] ${msg}`, type: "system",
          clientId: `sys_${Date.now()}_${r.id}`,
        }));
        output = [`Broadcast sent: ${msg}`];
      } else output = ["Usage: broadcast <message>"];
    } else {
      output = [`Unknown command: ${cmd}. Type "help" for list.`];
    }

    setCmdHistory(h => [...h, ...output.map(t => ({ type:"output", text: t }))]);
    setCmdInput("");
    setTimeout(() => cmdRef.current?.scrollTo({ top: cmdRef.current.scrollHeight }), 50);
  }

  function fmtUptime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,.85)", backdropFilter: "blur(6px)",
      zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
        width: "100%", maxWidth: 640, maxHeight: "92dvh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 -24px 80px rgba(0,0,0,.7)",
        animation: "slideUp 250ms cubic-bezier(.34,1.26,.64,1)",
      }}>
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"16px 20px 10px", borderBottom:"1px solid var(--border)", flexShrink:0,
        }}>
          <div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:17,
              fontWeight:800, color:"var(--text-1)", display:"flex", alignItems:"center", gap:8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Dev Panel
            </div>
            <div style={{ fontSize:10, color:"var(--accent)", marginTop:2 }}>
              @{user?.username} • v1.7.16 • {fmtUptime(uptime)}
              {ghost && <span style={{ color:"var(--text-3)", marginLeft:8 }}>• ghost mode</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={toggleGhost} style={{
              display:"flex", alignItems:"center", gap:4, padding:"6px 10px",
              background: ghost ? "var(--bg-active)" : "var(--bg-raised)",
              border:`1px solid ${ghost ? "var(--accent-dim)" : "var(--border)"}`,
              borderRadius:"var(--radius-sm)", color: ghost ? "var(--accent)" : "var(--text-3)",
              fontSize:11, cursor:"pointer", fontFamily:"var(--font-body)",
            }}>
              {ghost ? <EyeOff size={12} /> : <Eye size={12} />}
              {ghost ? "Ghost ON" : "Ghost"}
            </button>
            <button className="icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display:"flex", borderBottom:"1px solid var(--border)",
          overflowX:"auto", scrollbarWidth:"none", flexShrink:0,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display:"flex", alignItems:"center", gap:5,
              padding:"9px 13px", background:"transparent", border:"none",
              cursor:"pointer", fontSize:12, fontFamily:"var(--font-body)",
              color: tab === t.id ? "var(--accent)" : "var(--text-3)",
              borderBottom:`2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
              marginBottom:-1, whiteSpace:"nowrap",
              fontWeight: tab === t.id ? 600 : 400,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 18px" }}>

          {/* ── Stats ── */}
          {tab === "stats" && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                {[
                  { label:"Status",  value: stats?.status || "…",  color:"var(--green)",  icon:<CheckCircle size={14}/> },
                  { label:"Uptime",  value: fmtUptime(uptime),      color:"var(--accent)", icon:<Clock size={14}/> },
                  { label:"Users",   value: stats?.users || "…",    color:"var(--text-1)", icon:<Users size={14}/> },
                  { label:"Online",  value: onlineSet.size,          color:"var(--green)",  icon:<Wifi size={14}/> },
                  { label:"Rooms",   value: rooms.length,            color:"var(--text-1)", icon:<MessageSquare size={14}/> },
                  { label:"Version", value:"v1.7.16",                color:"var(--accent)", icon:<Activity size={14}/> },
                ].map(s => (
                  <div key={s.label} style={{
                    padding:14, background:"var(--bg-raised)",
                    border:"1px solid var(--border)", borderRadius:"var(--radius)",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5,
                      color:s.color, marginBottom:4, fontSize:10,
                      textTransform:"uppercase", letterSpacing:.8 }}>
                      {s.icon} {s.label}
                    </div>
                    <div style={{ fontSize:20, fontWeight:700,
                      fontFamily:"var(--font-display)", color:"var(--text-1)" }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:1,
                  color:"var(--text-3)", fontWeight:600, marginBottom:8 }}>
                  Currently Online
                </div>
                {Array.from(onlineSet).map(uid => {
                  const u = userMap[uid];
                  if (!u) return null;
                  return (
                    <div key={uid} style={{
                      display:"flex", alignItems:"center", gap:8,
                      padding:"6px 10px", marginBottom:4,
                      background:"var(--bg-raised)", borderRadius:"var(--radius-sm)",
                      border:"1px solid rgba(78,203,113,.2)",
                    }}>
                      <div style={{ width:7,height:7,borderRadius:"50%",
                        background:"var(--green)",boxShadow:"0 0 5px var(--green)" }} />
                      <span style={{ fontSize:13,color:"var(--text-1)" }}>
                        {u.display_name || u.username}
                      </span>
                      <span style={{ fontSize:11,color:"var(--text-3)" }}>@{u.username}</span>
                      <span style={{ fontSize:10,color:"var(--text-3)",marginLeft:"auto" }}>
                        uid={uid}
                      </span>
                    </div>
                  );
                })}
                {onlineSet.size === 0 && (
                  <div style={{ color:"var(--text-3)",fontSize:12 }}>No users online</div>
                )}
              </div>
              <button onClick={loadStats} style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"7px 12px", background:"var(--bg-raised)",
                border:"1px solid var(--border)", borderRadius:"var(--radius-sm)",
                color:"var(--text-2)", fontSize:12, cursor:"pointer",
                fontFamily:"var(--font-body)",
              }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          )}

          {/* ── Users ── */}
          {tab === "users" && (
            <div>
              <div style={{ fontSize:12, color:"var(--text-3)", marginBottom:12 }}>
                {users.length} registered users
              </div>
              {loading && <div style={{ color:"var(--text-3)",fontSize:12 }}>Loading…</div>}
              {users.map(u => (
                <div key={u.id} style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"10px 12px", marginBottom:6,
                  background:"var(--bg-raised)", border:"1px solid var(--border)",
                  borderRadius:"var(--radius-sm)",
                }}>
                  <div style={{
                    width:32, height:32, borderRadius:"50%", flexShrink:0,
                    background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:12, fontWeight:700, color:"#fff",
                  }}>
                    {(u.display_name || u.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"var(--text-1)" }}>
                      {u.display_name || u.username}
                      {u.role === "dev" && (
                        <span style={{ marginLeft:6, fontSize:9, padding:"1px 5px",
                          background:"var(--accent-glow)", color:"var(--accent)",
                          border:"1px solid var(--accent-dim)", borderRadius:10 }}>
                          DEV
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:10, color:"var(--text-3)" }}>
                      @{u.username} • uid={u.id}
                    </div>
                  </div>
                  <div style={{
                    width:8, height:8, borderRadius:"50%", flexShrink:0,
                    background: onlineSet.has(Number(u.id)) ? "var(--green)" : "var(--text-3)",
                  }} />
                  {u.username !== user?.username && (
                    <div style={{ display:"flex", gap:4 }}>
                      <button onClick={() => kickUser(u.id, u.username)} style={{
                        padding:"4px 8px", background:"rgba(245,166,35,.1)",
                        border:"1px solid rgba(245,166,35,.3)", borderRadius:"var(--radius-sm)",
                        color:"var(--yellow,#f5a623)", fontSize:10, cursor:"pointer",
                        fontFamily:"var(--font-body)",
                      }}>
                        Kick
                      </button>
                      <button onClick={() => deleteUser(u.id, u.username)} style={{
                        background:"transparent", border:"none",
                        cursor:"pointer", color:"var(--red)", padding:4,
                      }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Flags ── */}
          {tab === "flags" && (
            <div>
              <div style={{ fontSize:12, color:"var(--text-3)", marginBottom:14, lineHeight:1.6 }}>
                Feature flags control what users can and cannot do. Changes apply immediately.
              </div>
              {Object.entries({ ...DEFAULT_FLAGS, ...Object.fromEntries(
                Object.entries(flags).map(([k, v]) => [k, { value: v, desc: DEFAULT_FLAGS[k]?.desc || "" }])
              )}).map(([key, meta]) => {
                const val  = flags[key] ?? meta.value;
                const isBool = typeof val === "boolean";
                return (
                  <div key={key} style={{
                    padding:"12px 0", borderBottom:"1px solid var(--border)",
                  }}>
                    <div style={{ display:"flex", alignItems:"flex-start",
                      justifyContent:"space-between", gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, color:"var(--text-1)", fontWeight:500,
                          marginBottom:3 }}>
                          {key.replace(/_/g, " ")}
                        </div>
                        <div style={{ fontSize:11, color:"var(--text-3)", lineHeight:1.5 }}>
                          {meta.desc || ""}
                        </div>
                        <div style={{ fontSize:10, color:"var(--accent)",
                          fontFamily:"monospace", marginTop:3 }}>
                          {key}: {String(val)}
                        </div>
                      </div>
                      {isBool ? (
                        <button onClick={() => toggleFlag(key, val)} style={{
                          width:44, height:24, borderRadius:12, flexShrink:0,
                          background: val ? "var(--accent)" : "var(--bg-raised)",
                          border:`1px solid ${val ? "var(--accent)" : "var(--border)"}`,
                          cursor:"pointer", position:"relative", transition:"var(--trans)",
                        }}>
                          <div style={{
                            position:"absolute", top:2,
                            left: val ? 22 : 2,
                            width:18, height:18, borderRadius:"50%",
                            background:"#fff", transition:"left 200ms",
                            boxShadow:"0 1px 4px rgba(0,0,0,.3)",
                          }} />
                        </button>
                      ) : (
                        <span style={{ fontSize:12, color:"var(--accent)",
                          fontFamily:"monospace", padding:"2px 8px",
                          background:"var(--bg-raised)", borderRadius:6,
                          flexShrink:0 }}>
                          {val}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Monitor ── */}
          {tab === "monitor" && (
            <div>
              <div style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", marginBottom:12 }}>
                <div style={{ fontSize:12, color:"var(--text-3)" }}>
                  Live message feed — all rooms
                </div>
                <button onClick={() => setMonitor([])} style={{
                  padding:"4px 10px", background:"var(--bg-raised)",
                  border:"1px solid var(--border)", borderRadius:"var(--radius-sm)",
                  color:"var(--text-2)", fontSize:11, cursor:"pointer",
                  fontFamily:"var(--font-body)",
                }}>
                  Clear
                </button>
              </div>
              <div style={{
                background:"var(--bg-base)", borderRadius:"var(--radius)",
                border:"1px solid var(--border)", padding:10,
                fontFamily:"monospace", fontSize:11,
                maxHeight:360, overflowY:"auto",
              }}>
                {monitor.length === 0 && (
                  <div style={{ color:"var(--text-3)" }}>
                    Waiting for messages…
                  </div>
                )}
                {monitor.map((m, i) => (
                  <div key={i} style={{
                    padding:"3px 0", borderBottom:"1px solid var(--border-light)",
                    display:"flex", gap:8,
                  }}>
                    <span style={{ color:"var(--text-3)", flexShrink:0 }}>{m.ts}</span>
                    <span style={{ color:"var(--accent)", flexShrink:0 }}>
                      [{m.room?.slice(-6)}]
                    </span>
                    <span style={{ color:"var(--green)", flexShrink:0 }}>@{m.sender}</span>
                    <span style={{ color:"var(--text-2)", wordBreak:"break-all" }}>
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── System Messages ── */}
          {tab === "system" && (
            <div>
              <div style={{ fontSize:12, color:"var(--text-3)", marginBottom:16, lineHeight:1.6 }}>
                Send a system announcement. Appears in grey italic monospace — visually distinct
                from regular messages.
              </div>
              <div className="form-group">
                <label className="label">Target Room</label>
                <select value={sysRoom} onChange={e => setSysRoom(e.target.value)} style={{
                  width:"100%", padding:"10px 12px",
                  background:"var(--bg-raised)", border:"1px solid var(--border)",
                  borderRadius:"var(--radius-sm)", color:"var(--text-1)",
                  fontFamily:"var(--font-body)", fontSize:13, outline:"none",
                }}>
                  <option value="all">All Rooms</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name || r.id}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Message</label>
                <textarea value={sysMsg} onChange={e => setSysMsg(e.target.value)}
                  placeholder="Server will restart in 5 minutes…" rows={3} style={{
                    width:"100%", padding:"10px 12px", boxSizing:"border-box",
                    background:"var(--bg-raised)", border:"1px solid var(--border)",
                    borderRadius:"var(--radius-sm)", color:"var(--text-1)",
                    fontFamily:"var(--font-body)", fontSize:13, outline:"none", resize:"vertical",
                  }} />
              </div>
              {sysMsg && (
                <div style={{
                  padding:"10px 14px", background:"var(--bg-raised)",
                  border:"1px solid var(--border)", borderRadius:"var(--radius-sm)", marginBottom:14,
                }}>
                  <div style={{ fontSize:10, color:"var(--text-3)", marginBottom:6 }}>Preview:</div>
                  <div style={{
                    fontFamily:"monospace", fontSize:12, color:"var(--text-3)",
                    fontStyle:"italic", padding:"5px 10px",
                    borderLeft:"3px solid var(--text-3)",
                    background:"rgba(255,255,255,.03)", borderRadius:"0 6px 6px 0",
                  }}>
                    ⚙ {sysMsg}
                  </div>
                </div>
              )}
              <button onClick={sendSystemMessage} disabled={!sysMsg.trim()} style={{
                width:"100%", padding:11,
                background: sysMsg.trim()
                  ? "linear-gradient(135deg,var(--accent),var(--accent2))"
                  : "var(--bg-raised)",
                border:"1px solid var(--border)",
                borderRadius:"var(--radius-sm)",
                color: sysMsg.trim() ? "#fff" : "var(--text-3)",
                fontFamily:"var(--font-body)", fontSize:13, fontWeight:600,
                cursor: sysMsg.trim() ? "pointer" : "not-allowed",
              }}>
                Send System Message
              </button>
              <div style={{ marginTop:20 }}>
                <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:1,
                  color:"var(--text-3)", fontWeight:600, marginBottom:10 }}>
                  Quick Commands
                </div>
                {[
                  "Server restarting in 5 minutes",
                  "Maintenance begins shortly",
                  "All systems operational",
                  "Please reconnect if experiencing issues",
                ].map(cmd => (
                  <button key={cmd} onClick={() => setSysMsg(cmd)} style={{
                    display:"block", width:"100%", textAlign:"left",
                    padding:"8px 12px", marginBottom:4,
                    background:"var(--bg-raised)", border:"1px solid var(--border)",
                    borderRadius:"var(--radius-sm)", color:"var(--text-2)",
                    fontSize:12, cursor:"pointer", fontFamily:"var(--font-body)",
                  }}>
                    ⚙ {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Console ── */}
          {tab === "console" && (
            <div style={{ display:"flex", flexDirection:"column", height:400 }}>
              <div ref={cmdRef} style={{
                flex:1, background:"#0a0a0a", borderRadius:"var(--radius)",
                border:"1px solid var(--border)", padding:"10px 12px",
                fontFamily:"monospace", fontSize:12, overflowY:"auto",
                marginBottom:10, color:"#c8c8c8",
              }}>
                {cmdHistory.map((entry, i) => (
                  <div key={i} style={{
                    color: entry.type === "input"  ? "var(--accent)"
                         : entry.type === "system" ? "var(--text-3)"
                         : entry.type === "error"  ? "var(--red)"
                         : "#c8c8c8",
                    padding:"1px 0",
                    whiteSpace:"pre-wrap", wordBreak:"break-all",
                  }}>
                    {entry.text}
                  </div>
                ))}
              </div>
              <div style={{
                display:"flex", gap:8,
                background:"#0a0a0a", border:"1px solid var(--border)",
                borderRadius:"var(--radius-sm)", padding:"6px 12px",
              }}>
                <span style={{ color:"var(--accent)", fontFamily:"monospace", fontSize:13 }}>
                  $
                </span>
                <input
                  value={cmdInput}
                  onChange={e => setCmdInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") runCommand(cmdInput); }}
                  placeholder="Type a command... (help for list)"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    flex:1, background:"transparent", border:"none", outline:"none",
                    color:"#c8c8c8", fontFamily:"monospace", fontSize:13,
                  }}
                />
                <button onClick={() => runCommand(cmdInput)} style={{
                  background:"transparent", border:"none",
                  cursor:"pointer", color:"var(--accent)",
                }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Logs ── */}
          {tab === "logs" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:12, color:"var(--text-3)" }}>
                  Last {logs.length} entries
                </div>
                <button onClick={loadLogs} style={{
                  display:"flex", alignItems:"center", gap:4,
                  padding:"4px 10px", background:"var(--bg-raised)",
                  border:"1px solid var(--border)", borderRadius:"var(--radius-sm)",
                  color:"var(--text-2)", fontSize:11, cursor:"pointer",
                  fontFamily:"var(--font-body)",
                }}>
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>
              <div style={{
                background:"var(--bg-base)", borderRadius:"var(--radius)",
                border:"1px solid var(--border)", padding:10,
                fontFamily:"monospace", fontSize:11,
                maxHeight:380, overflowY:"auto",
              }}>
                {loading && <div style={{ color:"var(--text-3)" }}>Loading…</div>}
                {logs.map((log, i) => (
                  <div key={i} style={{
                    padding:"3px 0", borderBottom:"1px solid var(--border-light)",
                    display:"flex", gap:8,
                  }}>
                    <span style={{ color:"var(--text-3)", flexShrink:0 }}>
                      {new Date(log.ts || log.created_at || Date.now()).toLocaleTimeString()}
                    </span>
                    <span style={{
                      color: log.type === "error" ? "var(--red)"
                           : log.type === "auth"  ? "#f5a623"
                           : log.type === "warn"  ? "#f5a623"
                           : "var(--green)",
                      flexShrink:0, minWidth:48,
                    }}>
                      [{log.type || "info"}]
                    </span>
                    <span style={{ color:"var(--text-2)", wordBreak:"break-all" }}>
                      {typeof log.msg === "string"
                        ? log.msg
                        : JSON.stringify(log.msg || log.data || log)}
                    </span>
                  </div>
                ))}
                {!loading && !logs.length && (
                  <div style={{ color:"var(--text-3)" }}>No logs yet</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(30px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
