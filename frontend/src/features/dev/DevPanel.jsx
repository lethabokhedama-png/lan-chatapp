import React, { useState, useEffect, useRef } from "react";
import {
  X, Activity, Users, Flag, Terminal,
  Send, RefreshCw, Eye, EyeOff,
  Trash2, Radio, MessageSquare
} from "react-feather";
import useStore from "../../lib/store";
import { getToken } from "../../lib/api";
import { emit as socketEmit, getSocket } from "../../lib/socket";

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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Command definitions for autocomplete ────────────────────────────────────
const COMMAND_DEFS = {
  "?help":       { desc: "Show all commands", args: [] },
  "?status":     { desc: "Server status and uptime", args: [] },
  "?users":      { desc: "List all registered users", args: [] },
  "?user":       { desc: "Details for one user", args: ["@username"] },
  "?rooms":      { desc: "List all rooms", args: [] },
  "?room":       { desc: "Room details and members", args: ["<room_name_or_id>"] },
  "?online":     { desc: "Who is online right now", args: [] },
  "?flags":      { desc: "All feature flags", args: [] },
  "?flag":       { desc: "Value of one flag", args: ["<flag_name>"] },
  "?bans":       { desc: "List all active bans", args: [] },
  "?version":    { desc: "App version", args: [] },
  "?ping":       { desc: "API response time in ms", args: [] },
  "?socket":     { desc: "Socket connection state", args: [] },
  "?env":        { desc: "IP, ports, config", args: [] },
  "?time":       { desc: "Server vs client time diff", args: [] },
  "?echo":       { desc: "Echo text back (test)", args: ["<text...>"] },
  "!kick":       { desc: "Force disconnect a user (they can reconnect)", args: ["@username"] },
  "!ban":        { desc: "Ban user from logging in with reason", args: ["@username", "<reason>", "<hours?>"] },
  "!unban":      { desc: "Remove a ban", args: ["@username"] },
  "!delete":     { desc: "Delete account permanently", args: ["@username"] },
  "!promote":    { desc: "Give dev role to user", args: ["@username"] },
  "!demote":     { desc: "Remove dev role from user", args: ["@username"] },
  "!rename":     { desc: "Change a user's display name", args: ["@username", "<new_name>"] },
  "!resetpw":    { desc: "Reset user password", args: ["@username", "<new_password>"] },
  "!ghost":      { desc: "Toggle ghost mode (appear offline)", args: ["on|off"] },
  "!flag":       { desc: "Set a feature flag", args: ["<flag_name>", "<true|false|number>"] },
  "!broadcast":  { desc: "System message to ALL rooms", args: ["<message...>"] },
  "!msg":        { desc: "System message to one room", args: ["<room_name>", "<message...>"] },
  "!announce":   { desc: "Broadcast + browser notification", args: ["<message...>"] },
  "!maintenance":{ desc: "Toggle maintenance mode", args: ["on|off"] },
  "!purge":      { desc: "Delete all messages in a room", args: ["<room_name_or_id>"] },
  "!close":      { desc: "Delete a room permanently", args: ["<room_name_or_id>"] },
  "!rename-room":{ desc: "Rename a room", args: ["<room_id>", "<new_name>"] },
  "!gc":         { desc: "Remove unused upload files", args: [] },
  "!backup":     { desc: "Copy DATA/ to storage", args: [] },
  "!resetflags": { desc: "Reset all flags to defaults", args: [] },
  "!reload":     { desc: "Notify all users to reload", args: [] },
  "!simulate":   { desc: "Send a system message as another user", args: ["@username", "<message...>"] },
  "!theme":      { desc: "Switch your theme", args: ["<theme_name>"] },
  "!clear":      { desc: "Clear console output", args: [] },
  "!stats-reset":{ desc: "Clear audit logs", args: [] },
};

const FLAG_META = {
  smart_replies:       { def: true,  desc: "Show reply suggestions in chat" },
  voice_notes:         { def: true,  desc: "Allow voice message recording" },
  disappearing_photos: { def: true,  desc: "1x/2x view photos that auto-delete" },
  read_receipts:       { def: true,  desc: "Show Sent / Delivered / Read status" },
  typing_indicators:   { def: true,  desc: "Show typing animation" },
  online_presence:     { def: true,  desc: "Show green/red online dots" },
  group_mentions:      { def: true,  desc: "Allow @username mentions in groups" },
  registration_open:   { def: true,  desc: "Allow new accounts to be created" },
  maintenance_mode:    { def: false, desc: "Block all logins — maintenance screen" },
  max_voice_seconds:   { def: 300,   desc: "Max voice note length (seconds)" },
  max_upload_mb:       { def: 10,    desc: "Max file upload size (MB)" },
  max_group_members:   { def: 50,    desc: "Max members per group" },
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
  const [cmdInput,  setCmdInput]  = useState("");
  const [history,   setHistory]   = useState([]);
  const [histIdx,   setHistIdx]   = useState(-1);
  const [suggests,  setSuggests]  = useState([]);
  const [sugIdx,    setSugIdx]    = useState(0);
  const [consoleLogs, setConsoleLogs] = useState([
    { type:"system", text:"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
    { type:"system", text:"  LAN Chat Dev Console  v1.7.29  by LethaboK" },
    { type:"system", text:"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" },
    { type:"output", text:'  ? = query   ! = action   Tab = autocomplete' },
    { type:"output", text:'  Type ?help for full command reference' },
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
    const socket = getSocket();
    if (socket) {
      socket.on("msg:new", msg => {
        setMonitor(prev => [{
          ts:       new Date().toLocaleTimeString(),
          roomName: useStore.getState().rooms.find(r => r.id === msg.room_id)?.name || msg.room_id,
          sender:   userMap[msg.sender_id]?.username || String(msg.sender_id),
          content:  msg.content?.slice(0, 80) || `[${msg.type}]`,
          type:     msg.type,
        }, ...prev].slice(0, 200));
      });
    }
    return () => {
      clearInterval(t);
      getSocket()?.off("msg:new");
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (consoleRef.current)
        consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }, 30);
  }, [consoleLogs]);

  useEffect(() => { if (tab === "users") loadUsers(); }, [tab]);
  useEffect(() => { if (tab === "logs")  loadLogs();  }, [tab]);

  // Autocomplete suggestions
  useEffect(() => {
    const val   = cmdInput;
    const parts = val.trim().split(/\s+/);
    if (!val) { setSuggests([]); return; }

    if (parts.length === 1) {
      const matches = Object.keys(COMMAND_DEFS).filter(c => c.startsWith(val));
      setSuggests(matches.slice(0, 8));
      setSugIdx(0);
      return;
    }

    const cmd    = parts[0];
    const def    = COMMAND_DEFS[cmd];
    const argIdx = parts.length - 2;
    const nextArg = def?.args[argIdx] || "";

    if (nextArg === "@username" || parts[parts.length-1].startsWith("@")) {
      const q = parts[parts.length-1].replace("@","").toLowerCase();
      setSuggests(users.filter(u =>
        u.username.toLowerCase().includes(q)
      ).map(u => `@${u.username}`).slice(0,6));
      setSugIdx(0);
      return;
    }
    if (cmd === "!flag" && parts.length === 2) {
      setSuggests(Object.keys(FLAG_META).filter(k => k.includes(parts[1])).slice(0,6));
      return;
    }
    if (["!ghost","!maintenance"].includes(cmd) && parts.length === 2) {
      setSuggests(["on","off"].filter(x => x.startsWith(parts[1])));
      return;
    }
    if (cmd === "!theme" && parts.length === 2) {
      setSuggests(THEMES.filter(t => t.startsWith(parts[1])));
      return;
    }
    setSuggests([]);
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
      setFlags(d.global || d || {});
    } catch (_) {}
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const d = await apiFetch("/api/dev/logs");
      setLogs(Array.isArray(d) ? d.slice(-100).reverse() : []);
    } catch (_) {
      setLogs([{ ts: new Date().toISOString(), type:"info", msg:"Log endpoint unavailable" }]);
    }
    setLoading(false);
  }

  async function toggleFlag(key) {
    const cur = flags[key];
    const nv  = typeof cur === "boolean" ? !cur : cur;
    setFlags(f => ({ ...f, [key]: nv }));
    try {
      await apiFetch("/api/dev/flags", {
        method:"PATCH", body: JSON.stringify({ [key]: nv }),
      });
    } catch (_) {}
  }

  // ── Console output helpers ───────────────────────────────────────────────
  function print(...lines) {
    setConsoleLogs(h => [...h, ...lines.map(text => ({ type:"output", text }))]);
  }
  function printOk(text)   { setConsoleLogs(h => [...h, { type:"ok",    text: `✓ ${text}` }]); }
  function printErr(text)  { setConsoleLogs(h => [...h, { type:"error", text: `✗ ${text}` }]); }
  function printSys(text)  { setConsoleLogs(h => [...h, { type:"system", text }]); }

  // ── Get user helper ──────────────────────────────────────────────────────
  async function getUser(raw) {
    const uname = raw?.replace("@","");
    if (!uname) return null;
    if (!users.length) await loadUsers();
    return users.find(x => x.username.toLowerCase() === uname.toLowerCase()) || null;
  }

  // ── Broadcast system message to all rooms ────────────────────────────────
  function broadcastSysMsg(content) {
    const socket = getSocket();
    if (socket) {
      socket.emit("dev:broadcast", { content });
    } else {
      // Fallback — emit to each room directly
      rooms.forEach(r => socketEmit.sendMsg({
        roomId: r.id,
        content: `[system] ${content}`,
        type: "system",
        clientId: `sys_${Date.now()}_${r.id}`,
      }));
    }
  }

  // ── Main command runner ──────────────────────────────────────────────────
  async function runCmd(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setHistory(h => [trimmed, ...h.filter(x => x !== trimmed)].slice(0, 100));
    setHistIdx(-1);
    setSuggests([]);
    setConsoleLogs(h => [...h, { type:"input", text: trimmed }]);

    const prefix = trimmed[0];
    if (prefix !== "!" && prefix !== "?") {
      printErr("Commands start with ? (query) or ! (action). Try ?help");
      return;
    }

    const body  = trimmed.slice(1).trim();
    const parts = body.split(/\s+/);
    const cmd   = parts[0]?.toLowerCase();
    const args  = parts.slice(1);
    const rest  = args.join(" ");

    try {
      if (prefix === "?") {
        // ── QUERIES ────────────────────────────────────────────────────────
        if (cmd === "help") {
          printSys("─── Query Commands (?) ───────────────────────────────");
          Object.entries(COMMAND_DEFS).filter(([k]) => k[0]==="?").forEach(([k,v]) => {
            print(`  ${k.padEnd(16)} ${v.args.join(" ").padEnd(30)} ${v.desc}`);
          });
          printSys("─── Action Commands (!) ──────────────────────────────");
          Object.entries(COMMAND_DEFS).filter(([k]) => k[0]==="!").forEach(([k,v]) => {
            print(`  ${k.padEnd(16)} ${v.args.join(" ").padEnd(30)} ${v.desc}`);
          });
          printSys("─────────────────────────────────────────────────────");

        } else if (cmd === "status") {
          const t0 = Date.now();
          const ok = await apiFetch("/api/health").catch(() => null);
          const ms = Date.now() - t0;
          print(
            `Status:   ${ok?.status || "unreachable"} (${ms}ms)`,
            `Version:  v1.7.29`,
            `Uptime:   ${fmtUptime(uptime)}`,
            `API:      ${BASE()}`,
            `Users:    ${Object.keys(userMap).length}`,
            `Online:   ${onlineSet.size}`,
            `Rooms:    ${rooms.length}`,
          );

        } else if (cmd === "users") {
          if (!users.length) await loadUsers();
          print(`${users.length} accounts:`);
          users.forEach(u => print(
            `  [${String(u.id).padStart(3,"0")}] @${u.username.padEnd(18)} ${(u.display_name||"").padEnd(16)} ${u.role==="dev"?"[DEV]":"     "} ${onlineSet.has(Number(u.id))?"● online":"○ offline"}`
          ));

        } else if (cmd === "user") {
          const u = await getUser(args[0]);
          if (!u) { printErr(`@${args[0]||"?"} not found`); return; }
          print(
            `@${u.username}`,
            `  Display:  ${u.display_name || "(none)"}`,
            `  UID:      ${u.id}`,
            `  Role:     ${u.role || "user"}`,
            `  Online:   ${onlineSet.has(Number(u.id)) ? "yes" : "no"}`,
            `  Bio:      ${u.bio || "(none)"}`,
          );

        } else if (cmd === "rooms") {
          print(`${rooms.length} rooms:`);
          rooms.forEach(r => print(
            `  [${r.type.padEnd(7)}] ${(r.name||r.id).padEnd(24)} ${r.id}`
          ));

        } else if (cmd === "room") {
          const room = rooms.find(r => r.id===rest||r.name===rest);
          if (!room) { printErr(`Room "${rest}" not found`); return; }
          const members = room.members || [];
          print(
            `${room.name || room.id}`,
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
          await loadFlags();
          print("Feature flags:");
          Object.entries(flags).forEach(([k,v]) =>
            print(`  ${k.padEnd(26)} = ${String(v).padEnd(8)} — ${FLAG_META[k]?.desc||""}`));

        } else if (cmd === "flag") {
          await loadFlags();
          print(`${args[0]} = ${String(flags[args[0]]??"(not set)")}`, `  ${FLAG_META[args[0]]?.desc||""}`);

        } else if (cmd === "bans") {
          await loadFlags();
          const bans = flags.bans || {};
          const entries = Object.entries(bans);
          if (!entries.length) { print("No active bans"); return; }
          print(`${entries.length} active bans:`);
          entries.forEach(([uid, ban]) => {
            const u = userMap[Number(uid)];
            const remaining = Math.max(0, Math.floor((ban.until*1000 - Date.now()) / 3600000));
            print(`  uid=${uid} @${u?.username||"?"} — "${ban.reason}" — ${remaining}h remaining`);
          });

        } else if (cmd === "ping") {
          const t0 = Date.now();
          await apiFetch("/api/health");
          printOk(`API ping: ${Date.now()-t0}ms`);

        } else if (cmd === "socket") {
          const s = getSocket();
          if (!s) { printErr("Socket not connected"); return; }
          print(
            `Socket ID:  ${s.id || "(none)"}`,
            `Connected:  ${s.connected}`,
            `Transport:  ${s.io?.engine?.transport?.name || "?"}`,
          );

        } else if (cmd === "env") {
          print(
            `API URL:   ${import.meta.env.VITE_API_URL || "(not set)"}`,
            `RT URL:    ${import.meta.env.VITE_RT_URL  || "(not set)"}`,
            `Version:   v1.7.29`,
          );

        } else if (cmd === "time") {
          const t0 = Date.now();
          await apiFetch("/api/health");
          print(`Client:  ${new Date().toISOString()}`, `RTT:     ${Date.now()-t0}ms`);

        } else if (cmd === "version") {
          print("LAN Chat v1.7.29 — by Lethabo Khedama (LethaboK)");
          print("React + Vite / Python Flask / Node.js Socket.IO");

        } else if (cmd === "echo") {
          print(rest || "(empty)");

        } else {
          printErr(`Unknown query: ?${cmd} — try ?help`);
        }

      } else {
        // ── ACTIONS ────────────────────────────────────────────────────────
        if (cmd === "clear") {
          setConsoleLogs([{ type:"system", text:"Console cleared." }]);

        } else if (cmd === "kick") {
          const u = await getUser(args[0]);
          if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
          if (!confirm(`Kick @${u.username}?`)) { print("Cancelled"); return; }
          socketEmit.kick(u.id);
          printOk(`@${u.username} kicked (they can reconnect)`);

        } else if (cmd === "ban") {
          const u = await getUser(args[0]);
          if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
          const reason  = args.slice(1,-1).join(" ") || "Banned by admin";
          const hours   = parseInt(args[args.length-1]) || 24;
          await apiFetch(`/api/users/${u.id}/ban`, {
            method:"POST",
            body: JSON.stringify({ reason, duration_hours: hours }),
          });
          // Also kick them immediately
          socketEmit.kick(u.id);
          printOk(`@${u.username} banned for ${hours}h — reason: "${reason}"`);

        } else if (cmd === "unban") {
          const u = await getUser(args[0]);
          if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
          await apiFetch(`/api/users/${u.id}/ban`, { method:"DELETE" });
          printOk(`@${u.username} unbanned`);

        } else if (cmd === "delete") {
          const u = await getUser(args[0]);
          if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
          if (u.username === user?.username) { printErr("Cannot delete own account"); return; }
          if (!confirm(`Delete @${u.username} permanently? Cannot undo.`)) { print("Cancelled"); return; }
          await apiFetch(`/api/users/${u.id}`, { method:"DELETE" });
          setUsers(list => list.filter(x => x.id !== u.id));
          socketEmit.kick(u.id);
          printOk(`@${u.username} deleted permanently`);

        } else if (cmd === "promote") {
          const u = await getUser(args[0]);
          if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
          await apiFetch(`/api/users/${u.id}/role`, {
            method:"PATCH", body: JSON.stringify({ role:"dev" }),
          });
          setUsers(list => list.map(x => x.id===u.id ? {...x, role:"dev"} : x));
          printOk(`@${u.username} promoted to dev`);

        } else if (cmd === "demote") {
          const u = await getUser(args[0]);
          if (!u) { printErr(`User ${args[0]||"?"} not found`); return; }
          await apiFetch(`/api/users/${u.id}/role`, {
            method:"PATCH", body: JSON.stringify({ role:"user" }),
          });
          setUsers(list => list.map(x => x.id===u.id ? {...x, role:"user"} : x));
          printOk(`@${u.username} demoted to user`);

        } else if (cmd === "rename") {
          const u    = await getUser(args[0]);
          const name = args.slice(1).join(" ");
          if (!u || !name) { printErr("Usage: !rename @username <new_display_name>"); return; }
          await apiFetch(`/api/users/${u.id}/role`, {
            method:"PATCH", body: JSON.stringify({ display_name: name }),
          });
          setUsers(list => list.map(x => x.id===u.id ? {...x, display_name: name} : x));
          printOk(`@${u.username} renamed to "${name}"`);

        } else if (cmd === "resetpw") {
          const u  = await getUser(args[0]);
          const pw = args[1];
          if (!u || !pw) { printErr("Usage: !resetpw @username <new_password>"); return; }
          await apiFetch(`/api/users/${u.id}/role`, {
            method:"PATCH", body: JSON.stringify({ new_password: pw }),
          });
          printOk(`Password reset for @${u.username}`);

        } else if (cmd === "ghost") {
          const mode = args[0]?.toLowerCase();
          if (mode !== "on" && mode !== "off") { printErr("Usage: !ghost on | !ghost off"); return; }
          const next = mode === "on";
          setGhost(next);
          socketEmit.ghost(next);
          printOk(next ? "Ghost ON — you appear offline to everyone" : "Ghost OFF — you are visible");

        } else if (cmd === "flag") {
          if (args.length < 2) { printErr("Usage: !flag <key> <value>"); return; }
          const [k, rawVal] = args;
          const val = rawVal==="true" ? true : rawVal==="false" ? false : isNaN(rawVal) ? rawVal : Number(rawVal);
          setFlags(f => ({ ...f, [k]: val }));
          await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify({ [k]: val }) });
          printOk(`Flag "${k}" = ${val} — takes effect immediately`);

        } else if (cmd === "broadcast") {
          if (!rest) { printErr("Usage: !broadcast <message>"); return; }
          broadcastSysMsg(rest);
          printOk(`Broadcast sent to all rooms: "${rest}"`);

        } else if (cmd === "msg") {
          const rname = args[0];
          const msg   = args.slice(1).join(" ");
          if (!rname || !msg) { printErr("Usage: !msg <room_name> <message>"); return; }
          const room = rooms.find(r => r.id===rname || r.name===rname);
          if (!room) { printErr(`Room "${rname}" not found — try ?rooms`); return; }
          socketEmit.sendMsg({
            roomId: room.id, content: `[system] ${msg}`,
            type: "system", clientId: `sys_${Date.now()}`,
          });
          printOk(`Message sent to "${room.name || room.id}"`);

        } else if (cmd === "announce") {
          if (!rest) { printErr("Usage: !announce <message>"); return; }
          broadcastSysMsg(rest);
          if (Notification.permission === "granted") {
            new Notification("⚙ LAN Chat Announcement", { body: rest, icon: "/favicon.svg" });
          }
          printOk(`Announced: "${rest}"`);

        } else if (cmd === "maintenance") {
          const mode = args[0]?.toLowerCase();
          if (mode !== "on" && mode !== "off") { printErr("Usage: !maintenance on | !maintenance off"); return; }
          const val = mode === "on";
          setFlags(f => ({ ...f, maintenance_mode: val }));
          await apiFetch("/api/dev/flags", { method:"PATCH", body: JSON.stringify({ maintenance_mode: val }) });
          if (val) broadcastSysMsg("Server entering maintenance mode. Please stand by.");
          printOk(`Maintenance mode ${mode.toUpperCase()}`);

        } else if (cmd === "purge") {
          const room = rooms.find(r => r.id===rest || r.name===rest);
          if (!room) { printErr(`Room "${rest}" not found`); return; }
          if (!confirm(`Delete ALL messages in "${room.name}"?`)) { print("Cancelled"); return; }
          await apiFetch(`/api/dev/rooms/${room.id}/messages`, { method:"DELETE" });
          printOk(`All messages in "${room.name}" deleted`);

        } else if (cmd === "close") {
          const room = rooms.find(r => r.id===rest || r.name===rest);
          if (!room) { printErr(`Room "${rest}" not found`); return; }
          if (!confirm(`Delete room "${room.name}" permanently?`)) { print("Cancelled"); return; }
          await apiFetch(`/api/dev/rooms/${room.id}`, { method:"DELETE" });
          printOk(`Room "${room.name}" deleted`);

        } else if (cmd === "rename-room") {
          const [roomId, ...nameParts] = args;
          const newName = nameParts.join(" ");
          if (!roomId || !newName) { printErr("Usage: !rename-room <room_id> <new_name>"); return; }
          await apiFetch(`/api/dev/rooms/${roomId}/meta`, {
            method:"PATCH", body: JSON.stringify({ name: newName }),
          });
          printOk(`Room renamed to "${newName}"`);

        } else if (cmd === "gc") {
          print("Running garbage collection...");
          const r = await apiFetch("/api/dev/gc", { method:"POST" });
          printOk(`GC complete — removed ${r.removed || 0} unused files`);

        } else if (cmd === "backup") {
          print("Backing up DATA/ to storage...");
          const r = await apiFetch("/api/dev/backup", { method:"POST" });
          printOk(`Backup saved to: ${r.path || "/storage/emulated/0/"}`);

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
          broadcastSysMsg("Admin requested reload. Please refresh the page.");
          printOk("Reload message sent to all rooms");

        } else if (cmd === "simulate") {
          printErr("!simulate requires backend support — use !broadcast or !msg instead");

        } else if (cmd === "theme") {
          if (!THEMES.includes(args[0])) {
            printErr(`Unknown theme. Options: ${THEMES.join(", ")}`);
            return;
          }
          localStorage.setItem("lanchat_theme", args[0]);
          window.dispatchEvent(new StorageEvent("storage", { key:"lanchat_theme", newValue:args[0] }));
          printOk(`Theme set to "${args[0]}"`);

        } else if (cmd === "stats-reset") {
          if (!confirm("Clear all audit logs?")) { print("Cancelled"); return; }
          await apiFetch("/api/dev/logs", { method:"DELETE" });
          setLogs([]);
          printOk("Audit logs cleared");

        } else {
          printErr(`Unknown command: !${cmd} — try ?help`);
        }
      }
    } catch (err) {
      printErr(`Error: ${err.message}`);
    }
  }

  function handleKeyDown(e) {
    if (suggests.length > 0) {
      if (e.key === "Tab" || e.key === "ArrowRight") {
        e.preventDefault();
        const sel   = suggests[sugIdx];
        const parts = cmdInput.trim().split(/\s+/);
        setCmdInput(parts.length <= 1 ? sel + " " : [...parts.slice(0,-1), sel].join(" ") + " ");
        setSuggests([]);
        return;
      }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSugIdx(i => (i-1+suggests.length)%suggests.length); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSugIdx(i => (i+1)%suggests.length); return; }
      if (e.key === "Escape")    { setSuggests([]); return; }
    } else {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const idx = Math.min(histIdx+1, history.length-1);
        setHistIdx(idx);
        if (history[idx]) setCmdInput(history[idx]);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const idx = Math.max(histIdx-1, -1);
        setHistIdx(idx);
        setCmdInput(idx===-1 ? "" : history[idx]||"");
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      runCmd(cmdInput);
      setCmdInput("");
      setSuggests([]);
    }
  }

  function fmtUptime(s) {
    return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m ${s%60}s`;
  }

  async function kickUser(uid, uname) {
    if (!confirm(`Kick @${uname}?`)) return;
    socketEmit.kick(uid);
    printOk(`@${uname} kicked`);
  }

  async function deleteUser(uid, uname) {
    if (!confirm(`Delete @${uname}? Cannot undo.`)) return;
    try {
      await apiFetch(`/api/users/${uid}`, { method:"DELETE" });
      setUsers(u => u.filter(x => x.id !== uid));
      socketEmit.kick(uid);
    } catch (e) { alert(`Error: ${e.message}`); }
  }

  async function sendSystemMsg() {
    if (!sysMsg.trim()) return;
    const content = sysMsg.trim();
    if (sysRoom === "all") {
      broadcastSysMsg(content);
    } else {
      socketEmit.sendMsg({
        roomId: sysRoom, content: `[system] ${content}`,
        type: "system", clientId: `sys_${Date.now()}`,
      });
    }
    setSysMsg("");
  }

  return (
    <div style={{
      position:"fixed", inset:0,
      background:"var(--bg-base)", zIndex:300,
      display:"flex", flexDirection:"column",
    }}>
      {/* Header */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 18px", borderBottom:"1px solid var(--border)", flexShrink:0,
        background:"var(--bg-surface)",
      }}>
        <div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:16, fontWeight:800,
            color:"var(--text-1)", display:"flex", alignItems:"center", gap:8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            Dev Panel
          </div>
          <div style={{ fontSize:10, color:"var(--accent)", marginTop:2 }}>
            @{user?.username} • v1.7.29 • {fmtUptime(uptime)}
            {ghost && <span style={{ color:"var(--text-3)", marginLeft:8 }}>• ghost</span>}
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => {
            const next = !ghost; setGhost(next); socketEmit.ghost(next);
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
          <button style={{
            padding:"5px 9px", background:"var(--bg-raised)",
            border:"1px solid var(--border)", borderRadius:"var(--radius-sm)",
            color:"var(--text-3)", fontSize:11, cursor:"pointer", fontFamily:"var(--font-body)",
          }} onClick={loadStats}>
            <RefreshCw size={11}/>
          </button>
          <button className="icon-btn" onClick={onClose}><X size={16}/></button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display:"flex", borderBottom:"1px solid var(--border)",
        overflowX:"auto", scrollbarWidth:"none", flexShrink:0,
        background:"var(--bg-raised)",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display:"flex", alignItems:"center", gap:4,
            padding:"9px 14px", background:"transparent", border:"none",
            cursor:"pointer", fontSize:11, fontFamily:"var(--font-body)",
            color:tab===t.id?"var(--accent)":"var(--text-3)",
            borderBottom:`2px solid ${tab===t.id?"var(--accent)":"transparent"}`,
            marginBottom:-1, whiteSpace:"nowrap",
            fontWeight:tab===t.id?600:400,
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
              {consoleLogs.map((e,i) => (
                <div key={i} style={{
                  padding:"1px 0", whiteSpace:"pre-wrap", wordBreak:"break-all",
                  color: e.type==="input"?"#7ec8e3":e.type==="error"?"#ff6b6b":e.type==="ok"?"#4ec871":e.type==="system"?"#5a6070":"#c8c8c8",
                }}>
                  {e.type==="input"?`$ ${e.text}`:e.text}
                </div>
              ))}
            </div>

            {/* Autocomplete suggestions */}
            {suggests.length > 0 && (
              <div style={{
                background:"#0d1117", borderTop:"1px solid #1e2028",
                maxHeight:160, overflowY:"auto", flexShrink:0,
              }}>
                {suggests.map((s,i) => {
                  const def = COMMAND_DEFS[s];
                  return (
                    <div key={s} onClick={() => {
                      const parts = cmdInput.trim().split(/\s+/);
                      setCmdInput(parts.length<=1 ? s+" " : [...parts.slice(0,-1),s].join(" ")+" ");
                      setSuggests([]);
                      inputRef.current?.focus();
                    }} style={{
                      display:"flex", alignItems:"center", gap:12,
                      padding:"5px 14px", cursor:"pointer",
                      background:i===sugIdx?"#1a2233":"transparent",
                      borderLeft:`2px solid ${i===sugIdx?"var(--accent)":"transparent"}`,
                    }}>
                      <span style={{ color:"#7ec8e3", fontFamily:"monospace", fontSize:12, flexShrink:0 }}>{s}</span>
                      {def && <span style={{ color:"#f5a623", fontSize:11 }}>{def.args.join(" ")}</span>}
                      {def && <span style={{ color:"#5a6070", fontSize:11, marginLeft:"auto" }}>{def.desc}</span>}
                    </div>
                  );
                })}
                <div style={{ padding:"2px 14px 4px", fontSize:10, color:"#3a4050" }}>
                  Tab to complete · ↑↓ to select · Esc to close
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
              <input
                ref={inputRef}
                value={cmdInput}
                onChange={e => { setCmdInput(e.target.value); setHistIdx(-1); }}
                onKeyDown={handleKeyDown}
                placeholder="?help or !kick @user..."
                autoComplete="off" spellCheck={false}
                style={{
                  flex:1, background:"transparent", border:"none", outline:"none",
                  color:"#c8c8c8", fontFamily:"'Courier New',monospace", fontSize:12,
                  caretColor:"#4ec871",
                }}
              />
              <button onClick={() => { runCmd(cmdInput); setCmdInput(""); setSuggests([]); }}
                style={{ background:"transparent", border:"none", cursor:"pointer", color:"#4ec871" }}>
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
                { label:"Users",   value:Object.keys(userMap).length, color:"var(--text-1)" },
                { label:"Online",  value:onlineSet.size,          color:"var(--green)" },
                { label:"Rooms",   value:rooms.length,            color:"var(--text-1)" },
                { label:"Version", value:"v1.7.29",               color:"var(--accent)" },
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
            <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:1,
              color:"var(--text-3)", fontWeight:600, marginBottom:8 }}>Currently Online</div>
            {Array.from(onlineSet).map(uid => {
              const u = userMap[uid]; if(!u) return null;
              return (
                <div key={uid} style={{ display:"flex", alignItems:"center", gap:8,
                  padding:"6px 10px", marginBottom:4, background:"var(--bg-raised)",
                  borderRadius:"var(--radius-sm)", border:"1px solid rgba(78,203,113,.2)" }}>
                  <div style={{ width:7,height:7,borderRadius:"50%",
                    background:"var(--green)",boxShadow:"0 0 5px var(--green)" }} />
                  <span style={{ fontSize:12,color:"var(--text-1)" }}>{u.display_name||u.username}</span>
                  <span style={{ fontSize:10,color:"var(--text-3)" }}>@{u.username}</span>
                  <span style={{ fontSize:10,color:"var(--text-3)",marginLeft:"auto" }}>uid={uid}</span>
                </div>
              );
            })}
            {!onlineSet.size && <div style={{ color:"var(--text-3)",fontSize:12 }}>No users online</div>}
            <button onClick={loadStats} style={{
              marginTop:12, display:"flex", alignItems:"center", gap:5,
              padding:"6px 12px", background:"var(--bg-raised)", border:"1px solid var(--border)",
              borderRadius:"var(--radius-sm)", color:"var(--text-2)", fontSize:12,
              cursor:"pointer", fontFamily:"var(--font-body)" }}>
              <RefreshCw size={12}/> Refresh
            </button>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div style={{ flex:1, overflowY:"auto", padding:"14px 18px" }}>
            <div style={{ fontSize:12,color:"var(--text-3)",marginBottom:12 }}>
              {users.length} accounts registered
            </div>
            {loading && <div style={{ color:"var(--text-3)",fontSize:12 }}>Loading…</div>}
            {users.map(u => (
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10,
                padding:"10px 12px", marginBottom:6, background:"var(--bg-raised)",
                border:"1px solid var(--border)", borderRadius:"var(--radius-sm)" }}>
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
              Toggle features on/off. Changes apply immediately via the flags API.
            </div>
            {Object.entries(FLAG_META).map(([key,meta]) => {
              const val = flags[key] ?? meta.def;
              const isBool = typeof val === "boolean";
              return (
                <div key={key} style={{ padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
                  <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,color:"var(--text-1)",fontWeight:500,marginBottom:2 }}>
                        {key.replace(/_/g," ")}
                      </div>
                      <div style={{ fontSize:11,color:"var(--text-3)",lineHeight:1.5,marginBottom:3 }}>
                        {meta.desc}
                      </div>
                      <div style={{ fontSize:10,color:"var(--accent)",fontFamily:"monospace" }}>
                        {key}: {String(val??meta.def)}
                      </div>
                    </div>
                    {isBool ? (
                      <button onClick={() => toggleFlag(key)} style={{
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

        {/* ── MONITOR ── */}
        {tab === "monitor" && (
          <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"14px 18px" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
              <div style={{ fontSize:12,color:"var(--text-3)" }}>
                Live message feed — {monitor.length} captured
              </div>
              <button onClick={() => setMonitor([])} style={{
                padding:"3px 8px",background:"var(--bg-raised)",border:"1px solid var(--border)",
                borderRadius:"var(--radius-sm)",color:"var(--text-2)",fontSize:11,
                cursor:"pointer",fontFamily:"var(--font-body)" }}>Clear</button>
            </div>
            <div style={{ flex:1,background:"#080a0d",borderRadius:"var(--radius)",
              border:"1px solid var(--border)",padding:10,
              fontFamily:"monospace",fontSize:11,overflowY:"auto" }}>
              {!monitor.length&&<div style={{ color:"#5a6070" }}>Waiting for messages…</div>}
              {monitor.map((m,i) => (
                <div key={i} style={{ padding:"2px 0",borderBottom:"1px solid #1a1d26",display:"flex",gap:8 }}>
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
            <div style={{ fontSize:12,color:"var(--text-3)",marginBottom:14 }}>
              Send a system announcement. Appears in all rooms as grey italic monospace.
            </div>
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
                  fontStyle:"italic",padding:"4px 10px",borderLeft:"3px solid var(--text-3)",
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
                "All systems operational","Please reconnect if having issues",
                "New update available — reload to get it"].map(cmd=>(
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
          <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",padding:"14px 18px" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
              <div style={{ fontSize:12,color:"var(--text-3)" }}>Last {logs.length} entries</div>
              <div style={{ display:"flex",gap:6 }}>
                <button onClick={loadLogs} style={{
                  display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                  background:"var(--bg-raised)",border:"1px solid var(--border)",
                  borderRadius:"var(--radius-sm)",color:"var(--text-2)",fontSize:11,
                  cursor:"pointer",fontFamily:"var(--font-body)" }}>
                  <RefreshCw size={11}/> Refresh
                </button>
                <button onClick={async () => {
                  if (!confirm("Clear all logs?")) return;
                  await apiFetch("/api/dev/logs", { method:"DELETE" });
                  setLogs([]);
                }} style={{
                  padding:"4px 10px",background:"rgba(224,92,92,.08)",
                  border:"1px solid rgba(224,92,92,.3)",borderRadius:"var(--radius-sm)",
                  color:"var(--red)",fontSize:11,cursor:"pointer",fontFamily:"var(--font-body)" }}>
                  Clear
                </button>
              </div>
            </div>
            <div style={{ flex:1,background:"#080a0d",borderRadius:"var(--radius)",
              border:"1px solid var(--border)",padding:10,
              fontFamily:"monospace",fontSize:11,overflowY:"auto" }}>
              {loading&&<div style={{ color:"#5a6070" }}>Loading…</div>}
              {logs.map((log,i) => (
                <div key={i} style={{ padding:"2px 0",borderBottom:"1px solid #1a1d26",display:"flex",gap:8 }}>
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
  );
}
