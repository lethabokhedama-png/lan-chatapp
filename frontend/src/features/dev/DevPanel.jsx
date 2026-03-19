import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Activity, Users, Flag, Terminal,
  Send, RefreshCw, Eye, EyeOff,
  Trash2, Radio, MessageSquare
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

// ── All commands definition ─────────────────────────────────────────────────
const COMMAND_DEFS = {
  // QUERY commands
  "?help":     { desc: "Show all commands", args: [] },
  "?status":   { desc: "Server status and uptime", args: [] },
  "?users":    { desc: "List all registered users", args: [] },
  "?user":     { desc: "Details for one user", args: ["@username"] },
  "?rooms":    { desc: "List all rooms", args: [] },
  "?room":     { desc: "Room details and member list", args: ["<room_name_or_id>"] },
  "?online":   { desc: "Who is online right now", args: [] },
  "?flags":    { desc: "All feature flags and values", args: [] },
  "?flag":     { desc: "Value of one flag", args: ["<flag_name>"] },
  "?version":  { desc: "App version info", args: [] },
  "?ping":     { desc: "API response time in ms", args: [] },
  "?socket":   { desc: "Socket connection state", args: [] },
  "?storage":  { desc: "DATA folder disk usage", args: [] },
  "?time":     { desc: "Server vs client time diff", args: [] },
  "?env":      { desc: "IP, ports, cert expiry", args: [] },
  "?echo":     { desc: "Echo text back (test)", args: ["<text...>"] },
  // ACTION commands
  "!kick":        { desc: "Force disconnect a user", args: ["@username"] },
  "!ban":         { desc: "Block user from logging in", args: ["@username"] },
  "!delete":      { desc: "Delete account permanently", args: ["@username"] },
  "!promote":     { desc: "Give dev role to user", args: ["@username"] },
  "!demote":      { desc: "Remove dev role from user", args: ["@username"] },
  "!rename":      { desc: "Change a user's display name", args: ["@username", "<new_name>"] },
  "!resetpw":     { desc: "Reset user password", args: ["@username", "<new_password>"] },
  "!ghost":       { desc: "Toggle ghost mode", args: ["on|off"] },
  "!flag":        { desc: "Set a feature flag", args: ["<flag_name>", "<true|false|number>"] },
  "!broadcast":   { desc: "System message to ALL rooms", args: ["<message...>"] },
  "!msg":         { desc: "System message to one room", args: ["<room_name>", "<message...>"] },
  "!announce":    { desc: "Broadcast + browser notification", args: ["<message...>"] },
  "!maintenance": { desc: "Toggle maintenance mode", args: ["on|off"] },
  "!purge":       { desc: "Delete all messages in a room", args: ["<room_name_or_id>"] },
  "!close":       { desc: "Delete a room permanently", args: ["<room_name_or_id>"] },
  "!rename-room": { desc: "Rename a room", args: ["<room_id>", "<new_name>"] },
  "!gc":          { desc: "Delete unused upload files", args: [] },
  "!backup":      { desc: "Copy DATA/ to storage", args: [] },
  "!stats-reset": { desc: "Clear audit logs", args: [] },
  "!resetflags":  { desc: "Reset all flags to defaults", args: [] },
  "!reload":      { desc: "Notify all users to reload", args: [] },
  "!simulate":    { desc: "Send message as another user", args: ["@username", "<message...>"] },
  "!theme":       { desc: "Switch your theme", args: ["<theme_name>"] },
  "!clear":       { desc: "Clear console output", args: [] },
};

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

const THEMES = ["dark","darker","neon-purple","vampire","whatsapp","light","cyberpunk","deepsea","instagram","forest","rose","midnight"];

const TABS = [
  { id: "console", label: "Console",  icon: <Terminal size={12} /> },
  { id: "stats",   label: "Stats",    icon: <Activity size={12} /> },
  { id: "users",   label: "Users",    icon: <Users size={12} /> },
  { id: "flags",   label: "Flags",    icon: <Flag size={12} /> },
  { id: "monitor", label: "Monitor",  icon: <Radio size={12} /> },
  { id: "system",  label: "System",   icon: <Send size={12} /> },
  { id: "logs",    label: "Logs",     icon: <MessageSquare size={12} /> },
];

export default function DevPanel({ onClose }) {
  const [tab,       setTab]       = useState("console");
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

  // Console state
  const [cmdInput,    setCmdInput]    = useState("");
  const [history,     setHistory]     = useState([]);
  const [histIdx,     setHistIdx]     = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestIdx,  setSuggestIdx]  = useState(0);
  const [placeholder, setPlaceholder] = useState("?help or !kick @user...");
  const [consoleLogs, setConsoleLogs] = useState([
    { type:"system", text:"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
    { type:"system", text:"  LAN Chat Dev Console  v1.7.17" },
    { type:"system", text:"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
    { type:"output", text:'  ? = query    ! = action    Tab = complete' },
    { type:"output", text:'  Type ?help for full command list' },
    { type:"output", text:"" },
  ]);

  const consoleRef = useRef(null);
  const inputRef   = useRef(null);
  const startRef   = useRef(Date.now());
  const { rooms, onlineSet, userMap, user } = useStore();

  useEffect(() => {
    loadStats(); loadFlags();
    const t = setInterval(() =>
      setUptime(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    import("../../lib/socket").then(m => {
      const socket = m.getSocket();
      if (!socket) return;
      socket.on("msg:new", msg => {
        setMonitor(prev => [{
          ts:       new Date().toLocaleTimeString(),
          roomName: useStore.getState().rooms.find(r => r.id === msg.room_id)?.name || msg.room_id,
          sender:   userMap[msg.sender_id]?.username || String(msg.sender_id),
          content:  msg.content?.slice(0, 80) || `[${msg.type}]`,
          type:     msg.type,
        }, ...prev].slice(0, 200));
      });
    });
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (consoleRef.current)
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }, 30);
  }, [consoleLogs]);

  useEffect(() => { if (tab === "users") loadUsers(); }, [tab]);
  useEffect(() => { if (tab === "logs")  loadLogs();  }, [tab]);

  // ── Autocomplete + placeholder logic ─────────────────────────────────────
  useEffect(() => {
    const val    = cmdInput;
    const parts  = val.trim().split(/\s+/);
    const prefix = val[0];

    if (!val) {
      setSuggestions([]);
      setPlaceholder("?help or !kick @user...");
      return;
    }

    // Show command suggestions when typing first word
    if (parts.length === 1) {
      const allCmds = Object.keys(COMMAND_DEFS);
      const matches = allCmds.filter(c => c.startsWith(val));
      setSuggestions(matches.slice(0, 8));
      setSuggestIdx(0);

      // Show placeholder for exact match
      if (COMMAND_DEFS[val]) {
        const def = COMMAND_DEFS[val];
        setPlaceholder(`${val} ${def.args.join(" ")} — ${def.desc}`);
      } else {
        setPlaceholder("?help or !kick @user...");
      }
      return;
    }

    // Command is typed, show argument placeholder
    const cmd = parts[0];
    const def = COMMAND_DEFS[cmd];
    if (def) {
      const argIdx   = parts.length - 2; // which arg we're on
      const nextArg  = def.args[argIdx] || def.args[def.args.length - 1] || "";
      const remaining = def.args.slice(parts.length - 1).join(" ");
      setPlaceholder(remaining ? `${cmd} ... ${remaining}` : `${cmd} — ${def.desc}`);

      // @username suggestions
      if (nextArg === "@username" || (parts[parts.length-1].startsWith("@") && parts.length > 1)) {
        const q = parts[parts.length-1].replace("@","").toLowerCase();
        const matches = users
          .filter(u => u.username.toLowerCase().includes(q) || (u.display_name||"").toLowerCase().includes(q))
          .map(u => `@${u.username}`)
          .slice(0, 6);
        setSuggestions(matches);
        setSuggestIdx(0);
        return;
      }

      // Flag name suggestions
      if (cmd === "!flag" && parts.length === 2) {
        const q = parts[1].toLowerCase();
        setSuggestions(Object.keys(FLAG_META).filter(k => k.includes(q)).slice(0, 6));
        setSuggestIdx(0);
        return;
      }

      // on/off suggestions
      if (["!ghost","!maintenance"].includes(cmd) && parts.length === 2) {
        setSuggestions(["on","off"].filter(x => x.startsWith(parts[1])));
        setSuggestIdx(0);
        return;
      }

      // Theme suggestions
      if (cmd === "!theme" && parts.length === 2) {
        setSuggestions(THEMES.filter(t => t.startsWith(parts[1])));
        setSuggestIdx(0);
        return;
      }
    }

    setSuggestions([]);
  }, [cmdInput, users]);

  async function loadStats() {
    try {
      const d = await apiFetch("/api/health");
      setStats({ ...d, users: Object.keys(userMap).length, rooms: rooms.length });
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
        { ts: new Date().toISOString(), type:"info", msg:"Log endpoint not available" }
      ]);
    } catch (_) {
      setLogs([{ ts: new Date().toISOString(), type:"info", msg:"Could not load logs" }]);
    }
    setLoading(false);
  }

  async function toggleFlag(key, val) {
    const nv = typeof val === "boolean" ? !val : val;
    setFlags(f => ({ ...f, [key]: nv }));
    try { await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify({ [key]: nv }) }); } catch (_) {}
  }

  function print(...lines) {
    setConsoleLogs(h => [...h, ...lines.map(text => ({ type:"output", text }))]);
  }
  function printErr(text) { setConsoleLogs(h => [...h, { type:"error", text: `✗ ${text}` }]); }
  function printOk(text)  { setConsoleLogs(h => [...h, { type:"ok",    text: `✓ ${text}` }]); }
  function printSys(text) { setConsoleLogs(h => [...h, { type:"system", text }]); }

  // ── Run a command ─────────────────────────────────────────────────────────
  async function runCmd(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setHistory(h => [trimmed, ...h.filter(x => x !== trimmed)].slice(0, 100));
    setHistIdx(-1);
    setSuggestions([]);
    setConsoleLogs(h => [...h, { type:"input", text: trimmed }]);

    const prefix = trimmed[0];
    if (prefix !== "!" && prefix !== "?") {
      printErr('Commands start with ! (action) or ? (query). Type ?help');
      return;
    }

    const body  = trimmed.slice(1).trim();
    const parts = body.split(/\s+/);
    const cmd   = parts[0]?.toLowerCase();
    const args  = parts.slice(1);
    const rest  = args.join(" ");

    if (prefix === "?") {
      // ── QUERY COMMANDS ────────────────────────────────────────────────────
      if (cmd === "help") {
        printSys("─── Query Commands (?) ───────────────────────────");
        Object.entries(COMMAND_DEFS).filter(([k]) => k[0]==="?").forEach(([k,v]) => {
          print(`  ${k.padEnd(18)} ${v.args.join(" ").padEnd(28)} ${v.desc}`);
        });
        printSys("─── Action Commands (!) ──────────────────────────");
        Object.entries(COMMAND_DEFS).filter(([k]) => k[0]==="!").forEach(([k,v]) => {
          print(`  ${k.padEnd(18)} ${v.args.join(" ").padEnd(28)} ${v.desc}`);
        });
        printSys("──────────────────────────────────────────────────");

      } else if (cmd === "status") {
        const t0  = Date.now();
        const ok  = await apiFetch("/api/health").catch(() => null);
        const ms  = Date.now() - t0;
        print(
          `Status:   ${ok?.status || "unreachable"} (${ms}ms)`,
          `Version:  v1.7.17`,
          `Uptime:   ${fmtUptime(uptime)}`,
          `API:      ${BASE() || "(not set)"}`,
          `Users:    ${Object.keys(userMap).length}`,
          `Online:   ${onlineSet.size}`,
          `Rooms:    ${rooms.length}`,
        );

      } else if (cmd === "users") {
        if (!users.length) await loadUsers();
        if (!users.length) { printErr("No users found"); return; }
        print(`${users.length} users:`);
        users.forEach(u => print(
          `  [${String(u.id).padStart(3,"0")}] @${u.username.padEnd(18)} ${(u.display_name||"").padEnd(16)} ${u.role==="dev"?"[DEV]":"     "} ${onlineSet.has(Number(u.id))?"● online":"○ offline"}`
        ));

      } else if (cmd === "user") {
        const uname = args[0]?.replace("@","");
        if (!uname) { printErr("Usage: ?user @username"); return; }
        if (!users.length) await loadUsers();
        const u = users.find(x => x.username === uname);
        if (!u) { printErr(`@${uname} not found — try ?users`); return; }
        print(
          `@${u.username}`,
          `  Display:  ${u.display_name || "(none)"}`,
          `  UID:      ${u.id}`,
          `  Role:     ${u.role || "user"}`,
          `  Online:   ${onlineSet.has(Number(u.id)) ? "yes" : "no"}`,
          `  Bio:      ${u.bio || "(none)"}`,
        );

      } else if (cmd === "rooms") {
        if (!rooms.length) { print("No rooms"); return; }
        print(`${rooms.length} rooms:`);
        rooms.forEach(r => print(
          `  [${r.type.padEnd(7)}] ${(r.name||r.id).padEnd(24)} ${r.id}`
        ));

      } else if (cmd === "room") {
        const rname = rest;
        if (!rname) { printErr("Usage: ?room <name_or_id>"); return; }
        const room = rooms.find(r => r.id === rname || r.name === rname);
        if (!room) { printErr(`Room "${rname}" not found — try ?rooms`); return; }
        const members = room.members || [];
        print(
          `Room: ${room.name || room.id}`,
          `  ID:      ${room.id}`,
          `  Type:    ${room.type}`,
          `  Members: ${members.length}`,
          `  Topic:   ${room.topic || "(none)"}`,
        );
        members.forEach(m => {
          const u = userMap[Number(m.user_id)];
          if (u) print(`    ${onlineSet.has(Number(m.user_id))?"●":"○"} @${u.username}`);
        });

      } else if (cmd === "online") {
        const on = Array.from(onlineSet).map(id => userMap[id]).filter(Boolean);
        if (!on.length) { print("No users currently online"); return; }
        print(`${on.length} online:`);
        on.forEach(u => print(`  ● @${u.username.padEnd(20)} ${u.display_name||""}`));

      } else if (cmd === "flags") {
        print("Feature flags:");
        Object.entries(flags).forEach(([k,v]) =>
          print(`  ${k.padEnd(26)} = ${String(v).padEnd(8)} — ${FLAG_META[k]||""}`));

      } else if (cmd === "flag") {
        const key = args[0];
        if (!key) { printErr("Usage: ?flag <key>"); return; }
        print(`${key} = ${String(flags[key]??  "(not set)")}`, `  ${FLAG_META[key]||""}`);

      } else if (cmd === "version") {
        print("LAN Chat v1.7.17 — by Lethabo Khedama (LethaboK)");
        print("Stack: React + Vite / Python Flask + Waitress / Node.js Socket.IO");

      } else if (cmd === "ping") {
        const t0 = Date.now();
        await apiFetch("/api/health").catch(() => {});
        print(`API ping: ${Date.now() - t0}ms`);

      } else if (cmd === "socket") {
        const m = await import("../../lib/socket");
        const s = m.getSocket();
        if (!s) { printErr("Socket not initialised"); return; }
        print(
          `Socket ID:     ${s.id || "(none)"}`,
          `Connected:     ${s.connected}`,
          `Transport:     ${s.io?.engine?.transport?.name || "?"}`,
          `Reconnects:    ${s.io?._reconnectionAttempts || 0}`,
          `URL:           ${s.io?.opts?.hostname || "?"}:${s.io?.opts?.port || "?"}`,
        );

      } else if (cmd === "storage") {
        print("Checking DATA/ size… (estimate based on rooms and users)");
        print(`  Users:  ${users.length || "?"} accounts`);
        print(`  Rooms:  ${rooms.length} rooms`);
        print(`  Flags:  ${Object.keys(flags).length} flags`);

      } else if (cmd === "time") {
        const t0    = Date.now();
        const ok    = await apiFetch("/api/health").catch(() => null);
        const rtt   = Date.now() - t0;
        print(`Client time:  ${new Date().toISOString()}`);
        print(`RTT:          ${rtt}ms (half = ~${Math.floor(rtt/2)}ms latency)`);

      } else if (cmd === "env") {
        const apiUrl = import.meta.env.VITE_API_URL || "(not set)";
        const rtUrl  = import.meta.env.VITE_RT_URL  || "(not set)";
        print(
          `API URL:   ${apiUrl}`,
          `RT URL:    ${rtUrl}`,
          `Version:   v1.7.17`,
        );

      } else if (cmd === "echo") {
        print(rest || "(empty)");

      } else {
        printErr(`Unknown query: ?${cmd} — try ?help`);
      }

    } else {
      // ── ACTION COMMANDS ───────────────────────────────────────────────────
      const getUser = async (uname) => {
        if (!uname) return null;
        if (!users.length) await loadUsers();
        return users.find(x => x.username === uname.replace("@",""));
      };

      if (cmd === "clear") {
        setConsoleLogs([{ type:"system", text:"Console cleared." }]);

      } else if (cmd === "kick") {
        const u = await getUser(args[0]);
        if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
        if (!confirm(`Kick @${u.username}?`)) { print("Cancelled"); return; }
        const m = await import("../../lib/socket");
        m.getSocket()?.emit("dev:kick", { uid: u.id });
        printOk(`@${u.username} kicked offline (can reconnect)`);

      } else if (cmd === "ban") {
        const u = await getUser(args[0]);
        if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
        await apiFetch("/api/dev/flags", { method:"PATCH",
          body: JSON.stringify({ [`ban_${u.username}`]: true }) });
        printOk(`@${u.username} banned from logging in`);

      } else if (cmd === "delete") {
        const u = await getUser(args[0]);
        if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
        if (u.username === user?.username) { printErr("Cannot delete own account"); return; }
        if (!confirm(`Delete @${u.username} permanently?`)) { print("Cancelled"); return; }
        await apiFetch(`/api/users/${u.id}`, { method:"DELETE" });
        setUsers(list => list.filter(x => x.id !== u.id));
        printOk(`@${u.username} deleted permanently`);

      } else if (cmd === "promote") {
        const u = await getUser(args[0]);
        if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
        await apiFetch(`/api/users/${u.id}`, { method:"PATCH",
          body: JSON.stringify({ role:"dev" }) });
        printOk(`@${u.username} promoted to dev`);

      } else if (cmd === "demote") {
        const u = await getUser(args[0]);
        if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
        await apiFetch(`/api/users/${u.id}`, { method:"PATCH",
          body: JSON.stringify({ role:"user" }) });
        printOk(`@${u.username} demoted to user`);

      } else if (cmd === "rename") {
        const u    = await getUser(args[0]);
        const name = args.slice(1).join(" ");
        if (!u || !name) { printErr("Usage: !rename @username <new_display_name>"); return; }
        await apiFetch(`/api/users/${u.id}`, { method:"PATCH",
          body: JSON.stringify({ display_name: name }) });
        printOk(`@${u.username} renamed to "${name}"`);

      } else if (cmd === "resetpw") {
        const u  = await getUser(args[0]);
        const pw = args[1];
        if (!u || !pw) { printErr("Usage: !resetpw @username <new_password>"); return; }
        await apiFetch(`/api/users/${u.id}`, { method:"PATCH",
          body: JSON.stringify({ new_password: pw }) });
        printOk(`Password reset for @${u.username}`);

      } else if (cmd === "ghost") {
        const mode = args[0]?.toLowerCase();
        if (mode !== "on" && mode !== "off") { printErr("Usage: !ghost on | !ghost off"); return; }
        const next = mode === "on";
        setGhost(next);
        const m = await import("../../lib/socket");
        m.getSocket()?.emit("presence:ghost", { ghost: next });
        printOk(next ? "Ghost ON — you appear offline to everyone" : "Ghost OFF — you are visible");

      } else if (cmd === "flag") {
        if (args.length < 2) { printErr("Usage: !flag <key> <value>"); return; }
        const [k, rawVal] = args;
        const val = rawVal==="true" ? true : rawVal==="false" ? false : isNaN(rawVal) ? rawVal : Number(rawVal);
        setFlags(f => ({ ...f, [k]: val }));
        await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify({ [k]: val }) });
        printOk(`Flag "${k}" = ${val}`);

      } else if (cmd === "broadcast") {
        if (!rest) { printErr("Usage: !broadcast <message>"); return; }
        rooms.forEach(r => emit.sendMsg({
          roomId:r.id, content:`[system] ${rest}`, type:"system",
          clientId:`sys_${Date.now()}_${r.id}`,
        }));
        printOk(`Broadcast to ${rooms.length} rooms: "${rest}"`);

      } else if (cmd === "msg") {
        const rname = args[0];
        const msg   = args.slice(1).join(" ");
        if (!rname||!msg) { printErr("Usage: !msg <room_name> <message>"); return; }
        const room = rooms.find(r => r.id===rname||r.name===rname);
        if (!room) { printErr(`Room "${rname}" not found — try ?rooms`); return; }
        emit.sendMsg({ roomId:room.id, content:`[system] ${msg}`, type:"system",
          clientId:`sys_${Date.now()}` });
        printOk(`Message sent to "${room.name||room.id}"`);

      } else if (cmd === "announce") {
        if (!rest) { printErr("Usage: !announce <message>"); return; }
        rooms.forEach(r => emit.sendMsg({
          roomId:r.id, content:`[system] ${rest}`, type:"system",
          clientId:`sys_${Date.now()}_${r.id}`,
        }));
        if (Notification.permission === "granted")
          new Notification("LAN Chat Announcement", { body: rest });
        printOk(`Announced: "${rest}"`);

      } else if (cmd === "maintenance") {
        const mode = args[0]?.toLowerCase();
        if (mode!=="on"&&mode!=="off") { printErr("Usage: !maintenance on | !maintenance off"); return; }
        const val = mode === "on";
        setFlags(f => ({ ...f, maintenance_mode: val }));
        await apiFetch("/api/dev/flags", { method:"PATCH",
          body: JSON.stringify({ maintenance_mode: val }) });
        if (val) rooms.forEach(r => emit.sendMsg({
          roomId:r.id, content:"[system] Server entering maintenance mode.",
          type:"system", clientId:`sys_maint_${r.id}`,
        }));
        printOk(`Maintenance mode ${mode.toUpperCase()}`);

      } else if (cmd === "purge") {
        const rname = rest;
        const room  = rooms.find(r => r.id===rname||r.name===rname);
        if (!room) { printErr(`Room "${rname}" not found`); return; }
        if (!confirm(`Delete ALL messages in "${room.name}"?`)) { print("Cancelled"); return; }
        await apiFetch(`/api/messages/${room.id}/purge`, { method:"DELETE" });
        printOk(`All messages in "${room.name}" deleted`);

      } else if (cmd === "close") {
        const rname = rest;
        const room  = rooms.find(r => r.id===rname||r.name===rname);
        if (!room) { printErr(`Room "${rname}" not found`); return; }
        if (!confirm(`Delete room "${room.name}" permanently?`)) { print("Cancelled"); return; }
        await apiFetch(`/api/rooms/${room.id}`, { method:"DELETE" });
        printOk(`Room "${room.name}" deleted`);

      } else if (cmd === "rename-room") {
        const [roomId, ...nameParts] = args;
        const newName = nameParts.join(" ");
        if (!roomId||!newName) { printErr("Usage: !rename-room <room_id> <new_name>"); return; }
        await apiFetch(`/api/rooms/${roomId}/meta`, { method:"PATCH",
          body: JSON.stringify({ name: newName }) });
        printOk(`Room renamed to "${newName}"`);

      } else if (cmd === "gc") {
        print("Running garbage collection...");
        await apiFetch("/api/dev/gc", { method:"POST" }).catch(() => {});
        printOk("GC complete — unused uploads removed");

      } else if (cmd === "backup") {
        print("Backing up DATA/ to storage...");
        await apiFetch("/api/dev/backup", { method:"POST" }).catch(() => {});
        printOk("Backup saved to /storage/emulated/0/lanchat-backup/");

      } else if (cmd === "stats-reset") {
        if (!confirm("Clear all audit logs?")) { print("Cancelled"); return; }
        await apiFetch("/api/dev/logs", { method:"DELETE" }).catch(() => {});
        setLogs([]);
        printOk("Audit logs cleared");

      } else if (cmd === "resetflags") {
        const defaults = {
          smart_replies:true, voice_notes:true, disappearing_photos:true,
          read_receipts:true, typing_indicators:true, online_presence:true,
          group_mentions:true, registration_open:true, maintenance_mode:false,
          max_voice_seconds:300, max_upload_mb:10, max_group_members:50,
        };
        setFlags(defaults);
        await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify(defaults) });
        printOk("All flags reset to defaults");

      } else if (cmd === "reload") {
        rooms.forEach(r => emit.sendMsg({
          roomId:r.id, content:"[system] Admin requested reload. Please refresh.",
          type:"system", clientId:`sys_reload_${r.id}`,
        }));
        printOk("Reload message sent to all rooms");

      } else if (cmd === "simulate") {
        const u   = await getUser(args[0]);
        const msg = args.slice(1).join(" ");
        if (!u||!msg) { printErr("Usage: !simulate @username <message>"); return; }
        print(`[simulating as @${u.username}]: ${msg}`);
        printErr("Simulate requires backend support — message not actually sent");

      } else if (cmd === "theme") {
        const themeName = args[0];
        if (!THEMES.includes(themeName)) {
          printErr(`Unknown theme. Available: ${THEMES.join(", ")}`);
          return;
        }
        localStorage.setItem("lanchat_theme", themeName);
        // Trigger theme change by dispatching a storage event
        window.dispatchEvent(new StorageEvent("storage", { key:"lanchat_theme", newValue:themeName }));
        printOk(`Theme set to "${themeName}" — reload settings to see change`);

      } else {
        printErr(`Unknown command: !${cmd} — try ?help`);
      }
    }
  }

  function handleKeyDown(e) {
    if (suggestions.length > 0) {
      if (e.key === "Tab" || e.key === "ArrowRight") {
        e.preventDefault();
        const sel = suggestions[suggestIdx];
        if (sel) {
          // Complete the first word only
          const parts = cmdInput.trim().split(/\s+/);
          if (parts.length === 1) {
            setCmdInput(sel + " ");
          } else {
            // Complete the last argument
            const newParts = [...parts.slice(0,-1), sel];
            setCmdInput(newParts.join(" ") + " ");
          }
          setSuggestions([]);
        }
        return;
      }
      if (e.key === "ArrowUp" && suggestions.length > 0) {
        e.preventDefault();
        setSuggestIdx(i => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        e.preventDefault();
        setSuggestIdx(i => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "Escape") { setSuggestions([]); return; }
    } else {
      // History navigation
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = Math.min(histIdx + 1, history.length - 1);
        setHistIdx(idx);
        if (history[idx]) setCmdInput(history[idx]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = Math.max(histIdx - 1, -1);
        setHistIdx(idx);
        setCmdInput(idx === -1 ? "" : (history[idx] || ""));
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const toRun = suggestions.length > 0
        ? suggestions[suggestIdx]
        : cmdInput;
      runCmd(toRun);
      setCmdInput("");
      setSuggestions([]);
    }
  }

  function fmtUptime(s) {
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${s%60}s`;
  }

  async function kickUser(uid, uname) {
    if (!confirm(`Kick @${uname}?`)) return;
    const m = await import("../../lib/socket");
    m.getSocket()?.emit("dev:kick", { uid });
  }

  async function deleteUser(uid, uname) {
    if (!confirm(`Delete @${uname}? Cannot undo.`)) return;
    await apiFetch(`/api/users/${uid}`, { method:"DELETE" });
    setUsers(u => u.filter(x => x.id !== uid));
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
        width:"100%", maxWidth:680, maxHeight:"94dvh",
        display:"flex", flexDirection:"column",
        boxShadow:"0 -24px 80px rgba(0,0,0,.7)",
        animation:"slideUp 250ms cubic-bezier(.34,1.26,.64,1)",
      }}>

        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 18px 10px", borderBottom:"1px solid var(--border)", flexShrink:0,
        }}>
          <div>
            <div style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:800,
              color:"var(--text-1)", display:"flex", alignItems:"center", gap:8 }}>
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
              const next = !ghost; setGhost(next);
              import("../../lib/socket").then(m =>
                m.getSocket()?.emit("presence:ghost", { ghost:next }));
            }} style={{
              display:"flex", alignItems:"center", gap:4, padding:"5px 9px",
              background:ghost?"var(--bg-active)":"var(--bg-raised)",
              border:`1px solid ${ghost?"var(--accent-dim)":"var(--border)"}`,
              borderRadius:"var(--radius-sm)",
              color:ghost?"var(--accent)":"var(--text-3)",
              fontSize:11, cursor:"pointer", fontFamily:"var(--font-body)",
            }}>
              {ghost ? <EyeOff size={11}/> : <Eye size={11}/>}
              {ghost ? "Ghost ON" : "Ghost"}
            </button>
            <button className="icon-btn" onClick={onClose}><X size={16}/></button>
          </div>
        </div>

        {/* Tabs — TOP */}
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
              color:tab===t.id?"var(--accent)":"var(--text-3)",
              borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,
              marginBottom:-1, whiteSpace:"nowrap",
              fontWeight:tab===t.id?600:400, transition:"var(--trans)",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

          {/* ── CONSOLE ── */}
          {tab === "console" && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <div ref={consoleRef} style={{
                flex:1, background:"#080a0d", padding:"10px 14px",
                fontFamily:"'Courier New',monospace", fontSize:12,
                overflowY:"auto", color:"#c8c8c8",
              }}>
                {consoleLogs.map((entry,i) => (
                  <div key={i} style={{
                    padding:"1px 0", whiteSpace:"pre-wrap", wordBreak:"break-all",
                    color: entry.type==="input"  ? "#7ec8e3"
                         : entry.type==="error"  ? "#ff6b6b"
                         : entry.type==="ok"     ? "#4ec871"
                         : entry.type==="system" ? "#5a6070"
                         : "#c8c8c8",
                  }}>
                    {entry.type==="input" ? `$ ${entry.text}` : entry.text}
                  </div>
                ))}
                <div style={{ height:4 }} />
              </div>

              {/* Suggestions dropdown — Minecraft style */}
              {suggestions.length > 0 && (
                <div style={{
                  background:"#0d1117", borderTop:"1px solid #1e2028",
                  maxHeight:180, overflowY:"auto",
                  flexShrink:0,
                }}>
                  {suggestions.map((s, i) => {
                    const def = COMMAND_DEFS[s];
                    return (
                      <div key={s} onClick={() => {
                        const parts = cmdInput.trim().split(/\s+/);
                        if (parts.length <= 1) setCmdInput(s + " ");
                        else setCmdInput([...parts.slice(0,-1), s].join(" ") + " ");
                        setSuggestions([]);
                        inputRef.current?.focus();
                      }} style={{
                        display:"flex", alignItems:"center", gap:12,
                        padding:"6px 14px", cursor:"pointer",
                        background: i === suggestIdx ? "#1a2233" : "transparent",
                        borderLeft:`2px solid ${i===suggestIdx?"var(--accent)":"transparent"}`,
                      }}>
                        <span style={{ color:"#7ec8e3", fontFamily:"monospace", fontSize:12, flexShrink:0 }}>
                          {s}
                        </span>
                        {def && (
                          <>
                            <span style={{ color:"#f5a623", fontSize:11, fontFamily:"monospace" }}>
                              {def.args.join(" ")}
                            </span>
                            <span style={{ color:"#5a6070", fontSize:11, marginLeft:"auto" }}>
                              {def.desc}
                            </span>
                          </>
                        )}
                        {!def && (
                          <span style={{ color:"#5a6070", fontSize:11 }}>
                            {s.startsWith("@") ? "user" : "value"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ padding:"3px 14px 4px", fontSize:10, color:"#3a4050" }}>
                    Tab to complete · ↑↓ to select · Esc to dismiss
                  </div>
                </div>
              )}

              {/* Input */}
              <div style={{
                display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
                background:"#0d1117", borderTop:"1px solid #1e2028", flexShrink:0,
              }}>
                <span style={{ color:"#4ec871", fontFamily:"monospace", fontSize:12, flexShrink:0 }}>
                  {user?.username}@lanchat $
                </span>
                <div style={{ flex:1, position:"relative" }}>
                  {/* Ghost placeholder showing what's expected */}
                  {cmdInput && (
                    <div style={{
                      position:"absolute", top:0, left:0, right:0,
                      color:"#3a4050", fontFamily:"monospace", fontSize:12,
                      pointerEvents:"none", whiteSpace:"pre",
                    }}>
                      {cmdInput}<span style={{ color:"#2a3040" }}>{
                        placeholder.startsWith(cmdInput)
                          ? placeholder.slice(cmdInput.length)
                          : ""
                      }</span>
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    value={cmdInput}
                    onChange={e => { setCmdInput(e.target.value); setHistIdx(-1); }}
                    onKeyDown={handleKeyDown}
                    placeholder={!cmdInput ? placeholder : ""}
                    autoComplete="off" spellCheck={false}
                    style={{
                      width:"100%", background:"transparent", border:"none", outline:"none",
                      color:"#c8c8c8", fontFamily:"'Courier New',monospace", fontSize:12,
                      caretColor:"#4ec871", position:"relative", zIndex:1,
                    }}
                  />
                </div>
                <button onClick={() => { runCmd(cmdInput); setCmdInput(""); setSuggestions([]); }}
                  style={{ background:"transparent", border:"none",
                    cursor:"pointer", color:"#4ec871" }}>
                  <Send size={14}/>
                </button>
              </div>
            </div>
          )}

          {/* ── STATS ── */}
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
                  <div key={s.label} style={{ padding:12, background:"var(--bg-raised)",
                    border:"1px solid var(--border)", borderRadius:"var(--radius)" }}>
                    <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:.8,
                      color:"var(--text-3)", marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:20, fontWeight:700,
                      fontFamily:"var(--font-display)", color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11,textTransform:"uppercase",letterSpacing:1,
                color:"var(--text-3)",fontWeight:600,marginBottom:8 }}>Online Now</div>
              {Array.from(onlineSet).map(uid => {
                const u = userMap[uid]; if(!u) return null;
                return (
                  <div key={uid} style={{ display:"flex",alignItems:"center",gap:8,
                    padding:"6px 10px",marginBottom:4,background:"var(--bg-raised)",
                    borderRadius:"var(--radius-sm)",border:"1px solid rgba(78,203,113,.2)" }}>
                    <div style={{ width:7,height:7,borderRadius:"50%",
                      background:"var(--green)",boxShadow:"0 0 5px var(--green)" }} />
                    <span style={{ fontSize:12,color:"var(--text-1)" }}>{u.display_name||u.username}</span>
                    <span style={{ fontSize:10,color:"var(--text-3)" }}>@{u.username}</span>
                    <span style={{ fontSize:10,color:"var(--text-3)",marginLeft:"auto" }}>uid={uid}</span>
                  </div>
                );
              })}
              {!onlineSet.size && <div style={{ color:"var(--text-3)",fontSize:12 }}>No users online</div>}
              <button onClick={loadStats} style={{ marginTop:12,display:"flex",alignItems:"center",gap:5,
                padding:"6px 12px",background:"var(--bg-raised)",border:"1px solid var(--border)",
                borderRadius:"var(--radius-sm)",color:"var(--text-2)",fontSize:12,cursor:"pointer",
                fontFamily:"var(--font-body)" }}>
                <RefreshCw size={12}/> Refresh
              </button>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === "users" && (
            <div style={{ flex:1,overflowY:"auto",padding:"14px 18px" }}>
              <div style={{ fontSize:12,color:"var(--text-3)",marginBottom:12 }}>
                {users.length} accounts
              </div>
              {loading && <div style={{ color:"var(--text-3)",fontSize:12 }}>Loading…</div>}
              {users.map(u => (
                <div key={u.id} style={{ display:"flex",alignItems:"center",gap:10,
                  padding:"10px 12px",marginBottom:6,background:"var(--bg-raised)",
                  border:"1px solid var(--border)",borderRadius:"var(--radius-sm)" }}>
                  <div style={{ width:32,height:32,borderRadius:"50%",flexShrink:0,
                    background:"linear-gradient(135deg,var(--accent),var(--accent2))",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:700,color:"#fff" }}>
                    {(u.display_name||u.username||"?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:500,color:"var(--text-1)" }}>
                      {u.display_name||u.username}
                      {u.role==="dev"&&<span style={{ marginLeft:6,fontSize:9,padding:"1px 5px",
                        background:"var(--accent-glow)",color:"var(--accent)",
                        border:"1px solid var(--accent-dim)",borderRadius:10 }}>DEV</span>}
                    </div>
                    <div style={{ fontSize:10,color:"var(--text-3)" }}>@{u.username} • uid={u.id}</div>
                  </div>
                  <div style={{ width:8,height:8,borderRadius:"50%",flexShrink:0,
                    background:onlineSet.has(Number(u.id))?"var(--green)":"var(--text-3)" }} />
                  {u.username !== user?.username && (
                    <div style={{ display:"flex",gap:4 }}>
                      <button onClick={() => kickUser(u.id,u.username)} style={{
                        padding:"3px 8px",background:"rgba(245,166,35,.1)",
                        border:"1px solid rgba(245,166,35,.3)",borderRadius:"var(--radius-sm)",
                        color:"#f5a623",fontSize:10,cursor:"pointer",fontFamily:"var(--font-body)" }}>
                        Kick
                      </button>
                      <button onClick={() => deleteUser(u.id,u.username)} style={{
                        background:"transparent",border:"none",cursor:"pointer",
                        color:"var(--red)",padding:4 }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── FLAGS ── */}
          {tab === "flags" && (
            <div style={{ flex:1,overflowY:"auto",padding:"14px 18px" }}>
              <div style={{ fontSize:11,color:"var(--text-3)",marginBottom:14,lineHeight:1.6 }}>
                Toggle features on/off. Changes apply immediately to all users.
              </div>
              {Object.entries(FLAG_META).map(([key,desc]) => {
                const val=flags[key]; const isBool=typeof val==="boolean";
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
                          {key}: {String(val??"?")}
                        </div>
                      </div>
                      {isBool ? (
                        <button onClick={() => toggleFlag(key,val)} style={{
                          width:44,height:24,borderRadius:12,flexShrink:0,
                          background:val?"var(--accent)":"var(--bg-raised)",
                          border:`1px solid ${val?"var(--accent)":"var(--border)"}`,
                          cursor:"pointer",position:"relative",transition:"var(--trans)",
                        }}>
                          <div style={{ position:"absolute",top:2,left:val?22:2,
                            width:18,height:18,borderRadius:"50%",background:"#fff",
                            transition:"left 200ms",boxShadow:"0 1px 4px rgba(0,0,0,.3)" }} />
                        </button>
                      ) : (
                        <span style={{ fontSize:12,color:"var(--accent)",fontFamily:"monospace",
                          padding:"2px 8px",background:"var(--bg-raised)",
                          borderRadius:6,flexShrink:0 }}>{val}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── MONITOR ── */}
          {tab === "monitor" && (
            <div style={{ flex:1,display:"flex",flexDirection:"column",
              overflow:"hidden",padding:"14px 18px" }}>
              <div style={{ display:"flex",alignItems:"center",
                justifyContent:"space-between",marginBottom:10 }}>
                <div style={{ fontSize:12,color:"var(--text-3)" }}>
                  Live feed — {monitor.length} messages
                </div>
                <button onClick={() => setMonitor([])} style={{
                  padding:"3px 8px",background:"var(--bg-raised)",
                  border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",
                  color:"var(--text-2)",fontSize:11,cursor:"pointer",
                  fontFamily:"var(--font-body)" }}>Clear</button>
              </div>
              <div style={{ flex:1,background:"#080a0d",borderRadius:"var(--radius)",
                border:"1px solid var(--border)",padding:10,
                fontFamily:"monospace",fontSize:11,overflowY:"auto" }}>
                {!monitor.length&&<div style={{ color:"#5a6070" }}>Waiting for messages…</div>}
                {monitor.map((m,i) => (
                  <div key={i} style={{ padding:"2px 0",borderBottom:"1px solid #1a1d26",
                    display:"flex",gap:8 }}>
                    <span style={{ color:"#5a6070",flexShrink:0 }}>{m.ts}</span>
                    <span style={{ color:"#7ec8e3",flexShrink:0 }}>[{m.roomName?.slice(0,12)}]</span>
                    <span style={{ color:"#4ec871",flexShrink:0 }}>@{m.sender}</span>
                    <span style={{ color:"#c8c8c8",wordBreak:"break-all" }}>{m.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SYSTEM ── */}
          {tab === "system" && (
            <div style={{ flex:1,overflowY:"auto",padding:"14px 18px" }}>
              <div className="form-group">
                <label className="label">Target Room</label>
                <select value={sysRoom} onChange={e => setSysRoom(e.target.value)} style={{
                  width:"100%",padding:"9px 12px",background:"var(--bg-raised)",
                  border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",
                  color:"var(--text-1)",fontFamily:"var(--font-body)",fontSize:13,outline:"none" }}>
                  <option value="all">All Rooms</option>
                  {rooms.map(r=><option key={r.id} value={r.id}>{r.name||r.id}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Message</label>
                <textarea value={sysMsg} onChange={e=>setSysMsg(e.target.value)}
                  placeholder="Server restarting in 5 minutes…" rows={3} style={{
                    width:"100%",padding:"9px 12px",boxSizing:"border-box",
                    background:"var(--bg-raised)",border:"1px solid var(--border)",
                    borderRadius:"var(--radius-sm)",color:"var(--text-1)",
                    fontFamily:"var(--font-body)",fontSize:13,outline:"none",resize:"vertical" }} />
              </div>
              {sysMsg&&(
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
                cursor:sysMsg.trim()?"pointer":"not-allowed" }}>
                Send System Message
              </button>
              <div style={{ marginTop:16 }}>
                {["Server restarting in 5 minutes","Maintenance begins shortly",
                  "All systems operational","Please reconnect if having issues"].map(cmd=>(
                  <button key={cmd} onClick={()=>setSysMsg(cmd)} style={{
                    display:"block",width:"100%",textAlign:"left",padding:"7px 12px",marginBottom:4,
                    background:"var(--bg-raised)",border:"1px solid var(--border)",
                    borderRadius:"var(--radius-sm)",color:"var(--text-2)",
                    fontSize:12,cursor:"pointer",fontFamily:"var(--font-body)" }}>
                    ⚙ {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── LOGS ── */}
          {tab === "logs" && (
            <div style={{ flex:1,display:"flex",flexDirection:"column",
              overflow:"hidden",padding:"14px 18px" }}>
              <div style={{ display:"flex",justifyContent:"space-between",
                alignItems:"center",marginBottom:10 }}>
                <div style={{ fontSize:12,color:"var(--text-3)" }}>Last {logs.length} entries</div>
                <button onClick={loadLogs} style={{
                  display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                  background:"var(--bg-raised)",border:"1px solid var(--border)",
                  borderRadius:"var(--radius-sm)",color:"var(--text-2)",fontSize:11,
                  cursor:"pointer",fontFamily:"var(--font-body)" }}>
                  <RefreshCw size={11}/> Refresh
                </button>
              </div>
              <div style={{ flex:1,background:"#080a0d",borderRadius:"var(--radius)",
                border:"1px solid var(--border)",padding:10,
                fontFamily:"monospace",fontSize:11,overflowY:"auto" }}>
                {loading&&<div style={{ color:"#5a6070" }}>Loading…</div>}
                {logs.map((log,i) => (
                  <div key={i} style={{ padding:"2px 0",borderBottom:"1px solid #1a1d26",
                    display:"flex",gap:8 }}>
                    <span style={{ color:"#5a6070",flexShrink:0 }}>
                      {new Date(log.ts||log.created_at||Date.now()).toLocaleTimeString()}
                    </span>
                    <span style={{
                      color:log.type==="error"?"#ff6b6b":log.type==="warn"||log.type==="auth"?"#f5a623":"#4ec871",
                      flexShrink:0,minWidth:48 }}>[{log.type||"info"}]</span>
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
