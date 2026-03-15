import React, { useState, useEffect, useRef } from "react";
import {
  X, Activity, Users, Flag, Terminal,
  Send, RefreshCw, Wifi, Eye, EyeOff,
  Trash2, Radio, MessageSquare, CheckCircle, Clock
} from "react-feather";
import useStore from "../../lib/store";
import { getToken } from "../../lib/api";
import { emit } from "../../lib/socket";

const BASE = () => import.meta.env.VITE_API_URL || "";

async function apiFetch(path, opts = {}) {
  const res = await fetch(BASE() + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

const TABS = [
  { id: "console", label: "Console",  icon: <Terminal size={12} /> },
  { id: "stats",   label: "Stats",    icon: <Activity size={12} /> },
  { id: "users",   label: "Users",    icon: <Users size={12} /> },
  { id: "flags",   label: "Flags",    icon: <Flag size={12} /> },
  { id: "monitor", label: "Monitor",  icon: <Radio size={12} /> },
  { id: "system",  label: "System",   icon: <Send size={12} /> },
  { id: "logs",    label: "Logs",     icon: <MessageSquare size={12} /> },
];

const FLAG_META = {
  smart_replies:       "Show reply suggestions in chat",
  voice_notes:         "Allow voice message recording",
  disappearing_photos: "1x/2x view photos that delete after viewing",
  read_receipts:       "Show Sent / Delivered / Read status",
  typing_indicators:   "Show typing animation",
  online_presence:     "Show green/red online dots",
  group_mentions:      "Allow @username mentions in groups",
  registration_open:   "Allow new accounts to be created",
  maintenance_mode:    "Block all logins — maintenance screen",
  max_voice_seconds:   "Max voice note length (seconds)",
  max_upload_mb:       "Max file upload size (MB)",
  max_group_members:   "Max members per group",
};

// ── Help text ──────────────────────────────────────────────────────────────
const HELP_TEXT = `
LAN Chat Dev Console — Command Reference
─────────────────────────────────────────
Commands start with ! (action) or ? (query)

QUERY COMMANDS (?)
  ?help              Show this help
  ?status            Server status + uptime
  ?users             List all registered users
  ?user @username    Show details for a user
  ?rooms             List all rooms
  ?online            Show who is online now
  ?flags             Show all feature flags
  ?flag <key>        Show value of one flag
  ?version           Show app version

ACTION COMMANDS (!)
  !kick @username    Force disconnect a user
  !ban @username     Ban user from logging in
  !delete @username  Permanently delete an account
  !ghost on|off      Toggle your ghost mode (appear offline)
  !flag <key> <val>  Set a feature flag (true/false/number)
  !broadcast <msg>   Send system message to ALL rooms
  !msg <room> <txt>  Send system message to one room
  !maintenance on    Block all logins
  !maintenance off   Re-enable logins
  !clear             Clear the console
  !reload            Trigger frontend reload on all clients
  !resetflags        Reset all flags to defaults

SHORTCUTS
  Up arrow           Recall previous command
  Tab                Autocomplete command
  Enter              Run command
─────────────────────────────────────────
`.trim();

export default function DevPanel({ onClose }) {
  const [tab,        setTab]        = useState("console");
  const [stats,      setStats]      = useState(null);
  const [users,      setUsers]      = useState([]);
  const [flags,      setFlags]      = useState({});
  const [logs,       setLogs]       = useState([]);
  const [monitor,    setMonitor]    = useState([]);
  const [sysMsg,     setSysMsg]     = useState("");
  const [sysRoom,    setSysRoom]    = useState("all");
  const [ghost,      setGhost]      = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [uptime,     setUptime]     = useState(0);
  const [cmdInput,   setCmdInput]   = useState("");
  const [history,    setHistory]    = useState([]);  // command history for up arrow
  const [histIdx,    setHistIdx]    = useState(-1);
  const [console_,   setConsole_]   = useState([
    { type: "system", text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
    { type: "system", text: "  LAN Chat Dev Console  v1.7.17  by LethaboK" },
    { type: "system", text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
    { type: "output", text: '  Type ?help for commands, !kick @user to kick, etc.' },
    { type: "output", text: '  Commands start with ! (actions) or ? (queries).' },
    { type: "output", text: "" },
  ]);

  const consoleRef = useRef(null);
  const inputRef   = useRef(null);
  const startRef   = useRef(Date.now());
  const { rooms, onlineSet, userMap, user } = useStore();

  useEffect(() => {
    loadStats(); loadFlags();
    const t = setInterval(() =>
      setUptime(Math.floor((Date.now() - startRef.current) / 1000)), 1000);

    // Live message monitor
    import("../../lib/socket").then(m => {
      const socket = m.getSocket();
      if (!socket) return;
      socket.on("msg:new", msg => {
        setMonitor(prev => [{
          ts:      new Date().toLocaleTimeString(),
          room:    msg.room_id,
          roomName: useStore.getState().rooms.find(r => r.id === msg.room_id)?.name || msg.room_id,
          sender:  userMap[msg.sender_id]?.username || String(msg.sender_id),
          content: msg.content?.slice(0, 80) || `[${msg.type}]`,
          type:    msg.type,
        }, ...prev].slice(0, 200));
      });
    });

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (tab === "users") loadUsers();
    if (tab === "logs")  loadLogs();
  }, [tab]);

  // Scroll console to bottom
  useEffect(() => {
    setTimeout(() => {
      if (consoleRef.current)
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }, 30);
  }, [console_]);

  async function loadStats() {
    try {
      const d = await apiFetch("/api/health");
      setStats({ ...d, users: Object.keys(userMap).length, rooms: rooms.length, online: onlineSet.size });
    } catch (_) {}
  }

  async function loadUsers() {
    setLoading(true);
    try { setUsers(await apiFetch("/api/users/")); } catch (_) {}
    setLoading(false);
  }

  async function loadFlags() {
    try {
      const d = await apiFetch("/api/dev/flags");
      setFlags(d.global || {});
    } catch (_) {}
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const d = await apiFetch("/api/dev/logs");
      setLogs(Array.isArray(d) ? d.slice(-100).reverse() : [
        { ts: new Date().toISOString(), type: "info", msg: "Log endpoint not yet available" }
      ]);
    } catch (_) {
      setLogs([{ ts: new Date().toISOString(), type: "info", msg: "Could not load logs" }]);
    }
    setLoading(false);
  }

  async function toggleFlag(key, val) {
    const newVal = typeof val === "boolean" ? !val : val;
    setFlags(f => ({ ...f, [key]: newVal }));
    try { await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify({ [key]: newVal }) }); }
    catch (_) {}
  }

  function print(...lines) {
    setConsole_(h => [...h, ...lines.map(text => ({ type: "output", text }))]);
  }

  function printErr(text) {
    setConsole_(h => [...h, { type: "error", text }]);
  }

  function printOk(text) {
    setConsole_(h => [...h, { type: "ok", text }]);
  }

  // ── Command runner ─────────────────────────────────────────────────────────
  async function runCmd(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Add to history
    setHistory(h => [trimmed, ...h.filter(x => x !== trimmed)].slice(0, 50));
    setHistIdx(-1);

    // Echo input
    setConsole_(h => [...h, { type: "input", text: `${trimmed}` }]);

    const first = trimmed[0];
    if (first !== "!" && first !== "?") {
      printErr(`Commands must start with ! (action) or ? (query). Try ?help`);
      return;
    }

    const body   = trimmed.slice(1).trim();
    const parts  = body.split(/\s+/);
    const cmd    = parts[0]?.toLowerCase();
    const args   = parts.slice(1);

    // ── Query commands (?) ──────────────────────────────────────────────────
    if (first === "?") {
      if (cmd === "help") {
        HELP_TEXT.split("\n").forEach(l => print(l));

      } else if (cmd === "status") {
        print(
          `Status:   ${stats?.status || "unknown"}`,
          `Version:  v1.7.17`,
          `Uptime:   ${fmtUptime(uptime)}`,
          `API:      ${BASE() || "(not set)"}`,
          `Users:    ${stats?.users ?? Object.keys(userMap).length}`,
          `Online:   ${onlineSet.size}`,
          `Rooms:    ${rooms.length}`,
        );

      } else if (cmd === "users") {
        if (!users.length) await loadUsers();
        const list = users.length ? users : [];
        if (!list.length) { printErr("No users found"); return; }
        print(`${list.length} users:`);
        list.forEach(u => print(
          `  [${String(u.id).padStart(3,"0")}] @${u.username.padEnd(20)} ${u.display_name || ""} ${u.role === "dev" ? "[DEV]" : ""} ${onlineSet.has(Number(u.id)) ? "● online" : "○ offline"}`
        ));

      } else if (cmd === "user") {
        const uname = args[0]?.replace("@","");
        if (!uname) { printErr("Usage: ?user @username"); return; }
        if (!users.length) await loadUsers();
        const u = users.find(x => x.username === uname);
        if (!u) { printErr(`User @${uname} not found`); return; }
        print(
          `User: @${u.username}`,
          `  Display name: ${u.display_name || "(none)"}`,
          `  UID:          ${u.id}`,
          `  Role:         ${u.role || "user"}`,
          `  Online:       ${onlineSet.has(Number(u.id)) ? "yes" : "no"}`,
          `  Bio:          ${u.bio || "(none)"}`,
        );

      } else if (cmd === "rooms") {
        if (!rooms.length) { print("No rooms"); return; }
        print(`${rooms.length} rooms:`);
        rooms.forEach(r => print(`  [${r.type.padEnd(7)}] ${r.name || r.id}  (${r.id})`));

      } else if (cmd === "online") {
        const online = Array.from(onlineSet).map(id => userMap[id]).filter(Boolean);
        if (!online.length) { print("No users currently online"); return; }
        print(`${online.length} online:`);
        online.forEach(u => print(`  ● @${u.username} — ${u.display_name || ""}`));

      } else if (cmd === "flags") {
        print("Feature flags:");
        Object.entries(flags).forEach(([k, v]) =>
          print(`  ${k.padEnd(25)} = ${String(v)}`));

      } else if (cmd === "flag") {
        const key = args[0];
        if (!key) { printErr("Usage: ?flag <key>"); return; }
        print(`${key} = ${flags[key] ?? "(not set)"}`);

      } else if (cmd === "version") {
        print("LAN Chat v1.7.17 — by LethaboK");
        print("React + Vite / Python Flask / Node.js Socket.IO");

      } else {
        printErr(`Unknown query: ?${cmd}. Try ?help`);
      }

    // ── Action commands (!) ─────────────────────────────────────────────────
    } else {
      if (cmd === "clear") {
        setConsole_([{ type: "system", text: "Console cleared." }]);

      } else if (cmd === "kick") {
        const uname = args[0]?.replace("@","");
        if (!uname) { printErr("Usage: !kick @username"); return; }
        if (!users.length) await loadUsers();
        const u = users.find(x => x.username === uname);
        if (!u) { printErr(`User @${uname} not found. Run ?users first.`); return; }
        try {
          const m = await import("../../lib/socket");
          m.getSocket()?.emit("dev:kick", { uid: u.id });
          printOk(`Kicked @${uname} offline`);
        } catch (_) { printErr("Failed to kick user"); }

      } else if (cmd === "ban") {
        const uname = args[0]?.replace("@","");
        if (!uname) { printErr("Usage: !ban @username"); return; }
        if (!users.length) await loadUsers();
        const u = users.find(x => x.username === uname);
        if (!u) { printErr(`User @${uname} not found`); return; }
        try {
          await apiFetch("/api/dev/flags", {
            method:"PATCH",
            body: JSON.stringify({ [`ban_${u.username}`]: true }),
          });
          printOk(`@${uname} banned`);
        } catch (_) { printErr("Ban failed"); }

      } else if (cmd === "delete") {
        const uname = args[0]?.replace("@","");
        if (!uname) { printErr("Usage: !delete @username"); return; }
        if (uname === user?.username) { printErr("Cannot delete your own account"); return; }
        if (!users.length) await loadUsers();
        const u = users.find(x => x.username === uname);
        if (!u) { printErr(`User @${uname} not found`); return; }
        if (!confirm(`Delete @${uname} permanently?`)) { print("Cancelled"); return; }
        try {
          await apiFetch(`/api/users/${u.id}`, { method:"DELETE" });
          setUsers(list => list.filter(x => x.id !== u.id));
          printOk(`@${uname} deleted permanently`);
        } catch (_) { printErr("Delete failed"); }

      } else if (cmd === "ghost") {
        const mode = args[0]?.toLowerCase();
        if (mode !== "on" && mode !== "off") { printErr("Usage: !ghost on | !ghost off"); return; }
        const next = mode === "on";
        setGhost(next);
        const m = await import("../../lib/socket");
        m.getSocket()?.emit("presence:ghost", { ghost: next });
        printOk(next ? "Ghost mode ON — you appear offline to others" : "Ghost mode OFF — you are visible");

      } else if (cmd === "flag") {
        if (args.length < 2) { printErr("Usage: !flag <key> <value>"); return; }
        const [key, rawVal] = args;
        const val = rawVal === "true" ? true : rawVal === "false" ? false : isNaN(rawVal) ? rawVal : Number(rawVal);
        setFlags(f => ({ ...f, [key]: val }));
        try {
          await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify({ [key]: val }) });
          printOk(`Flag "${key}" set to ${val}`);
        } catch (_) { printErr("Flag update failed"); }

      } else if (cmd === "broadcast") {
        const msg = args.join(" ");
        if (!msg) { printErr("Usage: !broadcast <message>"); return; }
        rooms.forEach(r => emit.sendMsg({
          roomId: r.id, content: `[system] ${msg}`,
          type: "system", clientId: `sys_${Date.now()}_${r.id}`,
        }));
        printOk(`Broadcast sent to ${rooms.length} rooms: "${msg}"`);

      } else if (cmd === "msg") {
        const roomArg = args[0];
        const msg     = args.slice(1).join(" ");
        if (!roomArg || !msg) { printErr("Usage: !msg <room_id_or_name> <message>"); return; }
        const room = rooms.find(r => r.id === roomArg || r.name === roomArg);
        if (!room) { printErr(`Room "${roomArg}" not found. Try ?rooms`); return; }
        emit.sendMsg({ roomId: room.id, content: `[system] ${msg}`, type: "system", clientId: `sys_${Date.now()}` });
        printOk(`Message sent to "${room.name || room.id}"`);

      } else if (cmd === "maintenance") {
        const mode = args[0]?.toLowerCase();
        if (mode !== "on" && mode !== "off") { printErr("Usage: !maintenance on | !maintenance off"); return; }
        const val = mode === "on";
        setFlags(f => ({ ...f, maintenance_mode: val }));
        await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify({ maintenance_mode: val }) });
        if (val) {
          rooms.forEach(r => emit.sendMsg({
            roomId: r.id, content: "[system] Server entering maintenance mode. Please stand by.",
            type: "system", clientId: `sys_maint_${r.id}`,
          }));
        }
        printOk(`Maintenance mode ${mode.toUpperCase()}`);

      } else if (cmd === "resetflags") {
        const defaults = { smart_replies:true, voice_notes:true, disappearing_photos:true,
          read_receipts:true, typing_indicators:true, online_presence:true,
          group_mentions:true, registration_open:true, maintenance_mode:false,
          max_voice_seconds:300, max_upload_mb:10, max_group_members:50 };
        setFlags(defaults);
        await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify(defaults) });
        printOk("All flags reset to defaults");

      } else if (cmd === "reload") {
        rooms.forEach(r => emit.sendMsg({
          roomId: r.id, content: "[system] Reload requested by admin.",
          type: "system", clientId: `sys_reload_${r.id}`,
        }));
        printOk("Reload message sent. Users need to manually refresh.");

      } else {
        printErr(`Unknown command: !${cmd}. Try ?help`);
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      runCmd(cmdInput);
      setCmdInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      if (history[idx]) setCmdInput(history[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setCmdInput(idx === -1 ? "" : (history[idx] || ""));
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Autocomplete
      const v = cmdInput.trim();
      if (!v) return;
      const prefix = v[0];
      const rest   = v.slice(1).toLowerCase();
      const cmds   = prefix === "?"
        ? ["help","status","users","user","rooms","online","flags","flag","version"]
        : ["kick","ban","delete","ghost","flag","broadcast","msg","maintenance","resetflags","reload","clear"];
      const match = cmds.find(c => c.startsWith(rest));
      if (match) setCmdInput(prefix + match + " ");
    }
  }

  function fmtUptime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m ${s % 60}s`;
  }

  async function kickUser(uid, uname) {
    if (!confirm(`Kick @${uname}?`)) return;
    try {
      const m = await import("../../lib/socket");
      m.getSocket()?.emit("dev:kick", { uid });
    } catch (_) {}
  }

  async function deleteUser(uid, uname) {
    if (!confirm(`Delete @${uname}? Cannot be undone.`)) return;
    try {
      await apiFetch(`/api/users/${uid}`, { method: "DELETE" });
      setUsers(u => u.filter(x => x.id !== uid));
    } catch (_) {}
  }

  async function sendSystemMsg() {
    if (!sysMsg.trim()) return;
    const content = `[system] ${sysMsg.trim()}`;
    if (sysRoom === "all") {
      rooms.forEach(r => emit.sendMsg({ roomId:r.id, content, type:"system", clientId:`sys_${Date.now()}_${r.id}` }));
    } else {
      emit.sendMsg({ roomId:sysRoom, content, type:"system", clientId:`sys_${Date.now()}` });
    }
    setSysMsg("");
  }

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"rgba(0,0,0,.85)", backdropFilter:"blur(6px)",
      zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:"var(--bg-surface)", border:"1px solid var(--border)",
        borderRadius:"var(--radius-xl) var(--radius-xl) 0 0",
        width:"100%", maxWidth:640, maxHeight:"94dvh",
        display:"flex", flexDirection:"column",
        boxShadow:"0 -24px 80px rgba(0,0,0,.7)",
        animation:"slideUp 250ms cubic-bezier(.34,1.26,.64,1)",
      }}>

        {/* ── Header ── */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 18px 10px", borderBottom:"1px solid var(--border)", flexShrink:0,
        }}>
          <div>
            <div style={{
              fontFamily:"var(--font-display)", fontSize:16, fontWeight:800,
              color:"var(--text-1)", display:"flex", alignItems:"center", gap:8,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              Dev Panel
            </div>
            <div style={{ fontSize:10, color:"var(--accent)", marginTop:2 }}>
              @{user?.username} • v1.7.17 • {fmtUptime(uptime)}
              {ghost && <span style={{ color:"var(--text-3)", marginLeft:8 }}>• ghost</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => {
              const next = !ghost;
              setGhost(next);
              import("../../lib/socket").then(m =>
                m.getSocket()?.emit("presence:ghost", { ghost: next }));
            }} style={{
              display:"flex", alignItems:"center", gap:4, padding:"5px 9px",
              background: ghost ? "var(--bg-active)" : "var(--bg-raised)",
              border:`1px solid ${ghost ? "var(--accent-dim)" : "var(--border)"}`,
              borderRadius:"var(--radius-sm)",
              color: ghost ? "var(--accent)" : "var(--text-3)",
              fontSize:11, cursor:"pointer", fontFamily:"var(--font-body)",
            }}>
              {ghost ? <EyeOff size={11} /> : <Eye size={11} />}
              {ghost ? "Ghost ON" : "Ghost"}
            </button>
            <button className="icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* ── Tabs — TOP ── */}
        <div style={{
          display:"flex", borderBottom:"1px solid var(--border)",
          overflowX:"auto", scrollbarWidth:"none", flexShrink:0,
          background:"var(--bg-raised)",
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display:"flex", alignItems:"center", gap:4,
              padding:"9px 13px", background:"transparent", border:"none",
              cursor:"pointer", fontSize:11, fontFamily:"var(--font-body)",
              color: tab === t.id ? "var(--accent)" : "var(--text-3)",
              borderBottom:`2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
              marginBottom:-1, whiteSpace:"nowrap",
              fontWeight: tab === t.id ? 600 : 400,
              transition:"var(--trans)",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

          {/* CONSOLE */}
          {tab === "console" && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div ref={consoleRef} style={{
                flex:1, background:"#080a0d", padding:"10px 14px",
                fontFamily:"'Courier New', monospace", fontSize:12,
                overflowY:"auto", color:"#c8c8c8",
              }}>
                {console_.map((entry, i) => (
                  <div key={i} style={{
                    padding:"1px 0", whiteSpace:"pre-wrap", wordBreak:"break-all",
                    color: entry.type === "input"  ? "#7ec8e3"
                         : entry.type === "error"  ? "#ff6b6b"
                         : entry.type === "ok"     ? "#4ec871"
                         : entry.type === "system" ? "#5a6070"
                         : "#c8c8c8",
                  }}>
                    {entry.type === "input" ? `$ ${entry.text}` : entry.text}
                  </div>
                ))}
                <div style={{ height:4 }} />
              </div>
              <div style={{
                display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
                background:"#0d1117", borderTop:"1px solid #1e2028",
                flexShrink:0,
              }}>
                <span style={{ color:"#4ec871", fontFamily:"monospace", fontSize:13, flexShrink:0 }}>
                  {user?.username}@lanchat $
                </span>
                <input
                  ref={inputRef}
                  value={cmdInput}
                  onChange={e => setCmdInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="?help or !kick @user..."
                  autoComplete="off" spellCheck={false}
                  style={{
                    flex:1, background:"transparent", border:"none", outline:"none",
                    color:"#c8c8c8", fontFamily:"'Courier New', monospace", fontSize:13,
                  }}
                />
                <button onClick={() => { runCmd(cmdInput); setCmdInput(""); }} style={{
                  background:"transparent", border:"none",
                  cursor:"pointer", color:"#4ec871",
                }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STATS */}
          {tab === "stats" && (
            <div style={{ flex:1, overflowY:"auto", padding:"14px 18px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
                {[
                  { label:"Status",  value:stats?.status||"…",    color:"var(--green)" },
                  { label:"Uptime",  value:fmtUptime(uptime),      color:"var(--accent)" },
                  { label:"Users",   value:stats?.users||"…",      color:"var(--text-1)" },
                  { label:"Online",  value:onlineSet.size,          color:"var(--green)" },
                  { label:"Rooms",   value:rooms.length,            color:"var(--text-1)" },
                  { label:"Version", value:"v1.7.17",               color:"var(--accent)" },
                ].map(s => (
                  <div key={s.label} style={{
                    padding:12, background:"var(--bg-raised)",
                    border:"1px solid var(--border)", borderRadius:"var(--radius)",
                  }}>
                    <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:.8,
                      color:"var(--text-3)", marginBottom:4 }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize:20, fontWeight:700,
                      fontFamily:"var(--font-display)", color:s.color }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:1,
                color:"var(--text-3)", fontWeight:600, marginBottom:8 }}>
                Online Now
              </div>
              {Array.from(onlineSet).map(uid => {
                const u = userMap[uid]; if (!u) return null;
                return (
                  <div key={uid} style={{
                    display:"flex", alignItems:"center", gap:8,
                    padding:"6px 10px", marginBottom:4,
                    background:"var(--bg-raised)", borderRadius:"var(--radius-sm)",
                    border:"1px solid rgba(78,203,113,.2)",
                  }}>
                    <div style={{ width:7,height:7,borderRadius:"50%",
                      background:"var(--green)",boxShadow:"0 0 5px var(--green)" }} />
                    <span style={{ fontSize:12,color:"var(--text-1)" }}>
                      {u.display_name||u.username}
                    </span>
                    <span style={{ fontSize:10,color:"var(--text-3)" }}>@{u.username}</span>
                    <span style={{ fontSize:10,color:"var(--text-3)",marginLeft:"auto" }}>
                      uid={uid}
                    </span>
                  </div>
                );
              })}
              {!onlineSet.size && <div style={{ color:"var(--text-3)",fontSize:12 }}>No users online</div>}
              <button onClick={loadStats} style={{
                marginTop:12, display:"flex", alignItems:"center", gap:5,
                padding:"6px 12px", background:"var(--bg-raised)",
                border:"1px solid var(--border)", borderRadius:"var(--radius-sm)",
                color:"var(--text-2)", fontSize:12, cursor:"pointer",
                fontFamily:"var(--font-body)",
              }}>
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <div style={{ flex:1, overflowY:"auto", padding:"14px 18px" }}>
              <div style={{ fontSize:12,color:"var(--text-3)",marginBottom:12 }}>
                {users.length} accounts registered
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
                    width:32,height:32,borderRadius:"50%",flexShrink:0,
                    background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:700,color:"#fff",
                  }}>
                    {(u.display_name||u.username||"?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:500,color:"var(--text-1)" }}>
                      {u.display_name||u.username}
                      {u.role==="dev"&&<span style={{ marginLeft:6,fontSize:9,padding:"1px 5px",
                        background:"var(--accent-glow)",color:"var(--accent)",
                        border:"1px solid var(--accent-dim)",borderRadius:10 }}>DEV</span>}
                    </div>
                    <div style={{ fontSize:10,color:"var(--text-3)" }}>
                      @{u.username} • uid={u.id}
                    </div>
                  </div>
                  <div style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,
                    background:onlineSet.has(Number(u.id))?"var(--green)":"var(--text-3)" }} />
                  {u.username !== user?.username && (
                    <div style={{ display:"flex",gap:4 }}>
                      <button onClick={() => kickUser(u.id,u.username)} style={{
                        padding:"3px 8px",background:"rgba(245,166,35,.1)",
                        border:"1px solid rgba(245,166,35,.3)",borderRadius:"var(--radius-sm)",
                        color:"#f5a623",fontSize:10,cursor:"pointer",fontFamily:"var(--font-body)",
                      }}>Kick</button>
                      <button onClick={() => deleteUser(u.id,u.username)} style={{
                        background:"transparent",border:"none",
                        cursor:"pointer",color:"var(--red)",padding:4,
                      }}><Trash2 size={13}/></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* FLAGS */}
          {tab === "flags" && (
            <div style={{ flex:1,overflowY:"auto",padding:"14px 18px" }}>
              <div style={{ fontSize:11,color:"var(--text-3)",marginBottom:14,lineHeight:1.6 }}>
                Toggle features on/off. Changes apply immediately to all users.
              </div>
              {Object.entries(FLAG_META).map(([key, desc]) => {
                const val    = flags[key];
                const isBool = typeof val === "boolean";
                return (
                  <div key={key} style={{ padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
                    <div style={{ display:"flex",alignItems:"flex-start",
                      justifyContent:"space-between",gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13,color:"var(--text-1)",fontWeight:500,marginBottom:2 }}>
                          {key.replace(/_/g," ")}
                        </div>
                        <div style={{ fontSize:11,color:"var(--text-3)",lineHeight:1.5,marginBottom:3 }}>
                          {desc}
                        </div>
                        <div style={{ fontSize:10,color:"var(--accent)",fontFamily:"monospace" }}>
                          {key}: {String(val ?? "?")}
                        </div>
                      </div>
                      {isBool ? (
                        <button onClick={() => toggleFlag(key, val)} style={{
                          width:44,height:24,borderRadius:12,flexShrink:0,
                          background:val?"var(--accent)":"var(--bg-raised)",
                          border:`1px solid ${val?"var(--accent)":"var(--border)"}`,
                          cursor:"pointer",position:"relative",transition:"var(--trans)",
                        }}>
                          <div style={{
                            position:"absolute",top:2,left:val?22:2,
                            width:18,height:18,borderRadius:"50%",
                            background:"#fff",transition:"left 200ms",
                            boxShadow:"0 1px 4px rgba(0,0,0,.3)",
                          }} />
                        </button>
                      ) : (
                        <span style={{ fontSize:12,color:"var(--accent)",fontFamily:"monospace",
                          padding:"2px 8px",background:"var(--bg-raised)",borderRadius:6,flexShrink:0 }}>
                          {val}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MONITOR */}
          {tab === "monitor" && (
            <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"14px 18px" }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
                <div style={{ fontSize:12,color:"var(--text-3)" }}>
                  Live feed — all rooms ({monitor.length} messages captured)
                </div>
                <button onClick={() => setMonitor([])} style={{
                  padding:"3px 8px",background:"var(--bg-raised)",
                  border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",
                  color:"var(--text-2)",fontSize:11,cursor:"pointer",fontFamily:"var(--font-body)",
                }}>Clear</button>
              </div>
              <div style={{
                flex:1,background:"#080a0d",borderRadius:"var(--radius)",
                border:"1px solid var(--border)",padding:10,
                fontFamily:"monospace",fontSize:11,overflowY:"auto",
              }}>
                {!monitor.length && <div style={{ color:"#5a6070" }}>Waiting for messages…</div>}
                {monitor.map((m,i) => (
                  <div key={i} style={{ padding:"2px 0",borderBottom:"1px solid #1a1d26",display:"flex",gap:8 }}>
                    <span style={{ color:"#5a6070",flexShrink:0 }}>{m.ts}</span>
                    <span style={{ color:"#7ec8e3",flexShrink:0 }}>[{m.roomName?.slice(0,12)||m.room?.slice(-6)}]</span>
                    <span style={{ color:"#4ec871",flexShrink:0 }}>@{m.sender}</span>
                    <span style={{ color:"#c8c8c8",wordBreak:"break-all" }}>{m.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SYSTEM */}
          {tab === "system" && (
            <div style={{ flex:1,overflowY:"auto",padding:"14px 18px" }}>
              <div style={{ fontSize:12,color:"var(--text-3)",marginBottom:14,lineHeight:1.6 }}>
                Send a system announcement visible to all users in grey italic monospace.
              </div>
              <div className="form-group">
                <label className="label">Target Room</label>
                <select value={sysRoom} onChange={e => setSysRoom(e.target.value)} style={{
                  width:"100%",padding:"9px 12px",
                  background:"var(--bg-raised)",border:"1px solid var(--border)",
                  borderRadius:"var(--radius-sm)",color:"var(--text-1)",
                  fontFamily:"var(--font-body)",fontSize:13,outline:"none",
                }}>
                  <option value="all">All Rooms</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name||r.id}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Message</label>
                <textarea value={sysMsg} onChange={e => setSysMsg(e.target.value)}
                  placeholder="Server restarting in 5 minutes…" rows={3} style={{
                    width:"100%",padding:"9px 12px",boxSizing:"border-box",
                    background:"var(--bg-raised)",border:"1px solid var(--border)",
                    borderRadius:"var(--radius-sm)",color:"var(--text-1)",
                    fontFamily:"var(--font-body)",fontSize:13,outline:"none",resize:"vertical",
                  }} />
              </div>
              {sysMsg && (
                <div style={{ padding:"8px 12px",background:"var(--bg-raised)",
                  border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",marginBottom:12 }}>
                  <div style={{ fontSize:10,color:"var(--text-3)",marginBottom:4 }}>Preview:</div>
                  <div style={{ fontFamily:"monospace",fontSize:12,color:"var(--text-3)",
                    fontStyle:"italic",padding:"4px 10px",
                    borderLeft:"3px solid var(--text-3)",
                    background:"rgba(255,255,255,.03)",borderRadius:"0 4px 4px 0" }}>
                    ⚙ {sysMsg}
                  </div>
                </div>
              )}
              <button onClick={sendSystemMsg} disabled={!sysMsg.trim()} style={{
                width:"100%",padding:11,
                background:sysMsg.trim()?"linear-gradient(135deg,var(--accent),var(--accent2))":"var(--bg-raised)",
                border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",
                color:sysMsg.trim()?"#fff":"var(--text-3)",
                fontFamily:"var(--font-body)",fontSize:13,fontWeight:600,
                cursor:sysMsg.trim()?"pointer":"not-allowed",
              }}>
                Send System Message
              </button>
              <div style={{ marginTop:16 }}>
                <div style={{ fontSize:10,textTransform:"uppercase",letterSpacing:1,
                  color:"var(--text-3)",fontWeight:600,marginBottom:8 }}>
                  Quick Messages
                </div>
                {["Server restarting in 5 minutes","Maintenance begins shortly",
                  "All systems operational","Please reconnect if having issues"].map(cmd => (
                  <button key={cmd} onClick={() => setSysMsg(cmd)} style={{
                    display:"block",width:"100%",textAlign:"left",
                    padding:"7px 12px",marginBottom:4,
                    background:"var(--bg-raised)",border:"1px solid var(--border)",
                    borderRadius:"var(--radius-sm)",color:"var(--text-2)",
                    fontSize:12,cursor:"pointer",fontFamily:"var(--font-body)",
                  }}>⚙ {cmd}</button>
                ))}
              </div>
            </div>
          )}

          {/* LOGS */}
          {tab === "logs" && (
            <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"14px 18px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",
                alignItems:"center",marginBottom:10 }}>
                <div style={{ fontSize:12,color:"var(--text-3)" }}>Last {logs.length} entries</div>
                <button onClick={loadLogs} style={{
                  display:"flex",alignItems:"center",gap:4,
                  padding:"4px 10px",background:"var(--bg-raised)",
                  border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",
                  color:"var(--text-2)",fontSize:11,cursor:"pointer",fontFamily:"var(--font-body)",
                }}>
                  <RefreshCw size={11}/> Refresh
                </button>
              </div>
              <div style={{
                flex:1,background:"#080a0d",borderRadius:"var(--radius)",
                border:"1px solid var(--border)",padding:10,
                fontFamily:"monospace",fontSize:11,overflowY:"auto",
              }}>
                {loading && <div style={{ color:"#5a6070" }}>Loading…</div>}
                {logs.map((log,i) => (
                  <div key={i} style={{ padding:"2px 0",borderBottom:"1px solid #1a1d26",display:"flex",gap:8 }}>
                    <span style={{ color:"#5a6070",flexShrink:0 }}>
                      {new Date(log.ts||log.created_at||Date.now()).toLocaleTimeString()}
                    </span>
                    <span style={{
                      color:log.type==="error"?"#ff6b6b":log.type==="warn"||log.type==="auth"?"#f5a623":"#4ec871",
                      flexShrink:0,minWidth:48,
                    }}>[{log.type||"info"}]</span>
                    <span style={{ color:"#c8c8c8",wordBreak:"break-all" }}>
                      {typeof log.msg==="string"?log.msg:JSON.stringify(log.msg||log.data||log)}
                    </span>
                  </div>
                ))}
                {!loading&&!logs.length&&<div style={{ color:"#5a6070" }}>No logs yet</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(40px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}
