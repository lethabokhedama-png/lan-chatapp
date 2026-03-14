import React, { useState, useEffect, useRef } from "react";
import {
  X, Activity, Users, Flag, Terminal,
  Send, RefreshCw, Wifi, WifiOff,
  ChevronRight, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle, Clock, Trash2
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
  { id: "stats",   label: "Stats",    icon: <Activity size={14} /> },
  { id: "users",   label: "Users",    icon: <Users size={14} /> },
  { id: "flags",   label: "Flags",    icon: <Flag size={14} /> },
  { id: "logs",    label: "Logs",     icon: <Terminal size={14} /> },
  { id: "system",  label: "System",   icon: <Send size={14} /> },
];

export default function DevPanel({ onClose }) {
  const [tab, setTab]         = useState("stats");
  const [stats, setStats]     = useState(null);
  const [users, setUsers]     = useState([]);
  const [flags, setFlags]     = useState({});
  const [logs, setLogs]       = useState([]);
  const [sysMsg, setSysMsg]   = useState("");
  const [sysRoom, setSysRoom] = useState("all");
  const [loading, setLoading] = useState(false);
  const [uptime, setUptime]   = useState(0);
  const startTime             = useRef(Date.now());
  const { rooms, onlineSet, userMap, user } = useStore();

  useEffect(() => {
    loadStats();
    loadFlags();
    const uptimeInterval = setInterval(() => {
      setUptime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(uptimeInterval);
  }, []);

  useEffect(() => {
    if (tab === "users") loadUsers();
    if (tab === "logs")  loadLogs();
  }, [tab]);

  async function loadStats() {
    try {
      const data = await apiFetch("/api/health");
      const allUsers = Object.keys(useStore.getState().userMap).length;
      setStats({
        status:    data.status || "ok",
        version:   data.v || "1.5.0",
        users:     allUsers,
        online:    onlineSet.size,
        rooms:     rooms.length,
        messages:  "—",
      });
    } catch (_) {}
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/users/");
      setUsers(Array.isArray(data) ? data : []);
    } catch (_) {}
    setLoading(false);
  }

  async function loadFlags() {
    try {
      const data = await apiFetch("/api/dev/flags");
      setFlags(data.global || {});
    } catch (_) {}
  }

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await apiFetch("/api/dev/logs");
      setLogs(Array.isArray(data) ? data.slice(-100).reverse() : []);
    } catch (_) {
      setLogs([{ ts: new Date().toISOString(), type: "info", msg: "Logs endpoint not yet available" }]);
    }
    setLoading(false);
  }

  async function toggleFlag(key, val) {
    const newVal = !val;
    setFlags(f => ({ ...f, [key]: newVal }));
    try {
      await apiFetch("/api/dev/flags", {
        method: "PATCH",
        body: JSON.stringify({ [key]: newVal }),
      });
    } catch (_) {}
  }

  async function sendSystemMessage() {
    if (!sysMsg.trim()) return;
    const content = `[system] ${sysMsg.trim()}`;
    if (sysRoom === "all") {
      rooms.forEach(r => {
        emit.sendMsg({ roomId: r.id, content, type: "system", clientId: `sys_${Date.now()}_${r.id}` });
      });
    } else {
      emit.sendMsg({ roomId: sysRoom, content, type: "system", clientId: `sys_${Date.now()}` });
    }
    setSysMsg("");
  }

  async function deleteUser(uid) {
    if (!confirm(`Delete user uid=${uid}?`)) return;
    try {
      await apiFetch(`/api/users/${uid}`, { method: "DELETE" });
      setUsers(u => u.filter(x => x.id !== uid));
    } catch (_) {}
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
      background: "rgba(0,0,0,.8)",
      backdropFilter: "blur(6px)",
      zIndex: 300,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
        width: "100%",
        maxWidth: 600,
        maxHeight: "90dvh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -24px 80px rgba(0,0,0,.7)",
        animation: "slideUp 250ms cubic-bezier(.34,1.26,.64,1)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 17,
              fontWeight: 800, color: "var(--text-1)",
            }}>
              ⚙ Dev Panel
            </div>
            <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>
              @{user?.username} • v1.5.0 • uptime {fmtUptime(uptime)}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 0,
          borderBottom: "1px solid var(--border)",
          overflowX: "auto", scrollbarWidth: "none",
          flexShrink: 0,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "9px 14px", background: "transparent", border: "none",
              cursor: "pointer", fontSize: 12, fontFamily: "var(--font-body)",
              color: tab === t.id ? "var(--accent)" : "var(--text-3)",
              borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
              marginBottom: -1, whiteSpace: "nowrap",
              fontWeight: tab === t.id ? 600 : 400,
              transition: "var(--trans)",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* ── Stats ── */}
          {tab === "stats" && (
            <div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 10, marginBottom: 20,
              }}>
                {[
                  { label: "Status",   value: stats?.status || "…",       color: "var(--green)",  icon: <CheckCircle size={16} /> },
                  { label: "Version",  value: "v" + (stats?.version || "1.5.0"), color: "var(--accent)", icon: <Activity size={16} /> },
                  { label: "Users",    value: stats?.users || "…",         color: "var(--text-1)", icon: <Users size={16} /> },
                  { label: "Online",   value: onlineSet.size,              color: "var(--green)",  icon: <Wifi size={16} /> },
                  { label: "Rooms",    value: stats?.rooms || rooms.length, color: "var(--text-1)", icon: <Users size={16} /> },
                  { label: "Uptime",   value: fmtUptime(uptime),           color: "var(--accent)", icon: <Clock size={16} /> },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: "14px", background: "var(--bg-raised)",
                    border: "1px solid var(--border)", borderRadius: "var(--radius)",
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      color: s.color, marginBottom: 6,
                    }}>
                      {s.icon}
                      <span style={{ fontSize: 10, textTransform: "uppercase",
                        letterSpacing: 1, fontWeight: 600 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700,
                      fontFamily: "var(--font-display)", color: "var(--text-1)" }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Online users list */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase",
                  letterSpacing: 1, color: "var(--text-3)", marginBottom: 10,
                  fontWeight: 600 }}>
                  Currently Online
                </div>
                {Array.from(onlineSet).map(uid => {
                  const u = userMap[uid];
                  if (!u) return null;
                  return (
                    <div key={uid} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", marginBottom: 4,
                      background: "var(--bg-raised)", borderRadius: "var(--radius-sm)",
                      border: "1px solid rgba(78,203,113,.2)",
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: "var(--green)",
                        boxShadow: "0 0 6px var(--green)",
                      }} />
                      <span style={{ fontSize: 13, color: "var(--text-1)" }}>
                        {u.display_name || u.username}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                        @{u.username}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-3)",
                        marginLeft: "auto" }}>uid={uid}</span>
                    </div>
                  );
                })}
                {onlineSet.size === 0 && (
                  <div style={{ color: "var(--text-3)", fontSize: 12, padding: "8px 0" }}>
                    No users online
                  </div>
                )}
              </div>

              <button onClick={loadStats} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", background: "var(--bg-raised)",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                color: "var(--text-2)", fontSize: 12, cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}>
                <RefreshCw size={13} /> Refresh Stats
              </button>
            </div>
          )}

          {/* ── Users ── */}
          {tab === "users" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 12 }}>
                {users.length} registered users
              </div>
              {loading && <div style={{ color: "var(--text-3)", fontSize: 12 }}>Loading…</div>}
              {users.map(u => (
                <div key={u.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", marginBottom: 6,
                  background: "var(--bg-raised)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff",
                  }}>
                    {(u.display_name || u.username || "?")[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>
                      {u.display_name || u.username}
                      {u.role === "dev" && (
                        <span style={{
                          marginLeft: 6, fontSize: 9, padding: "1px 6px",
                          background: "var(--accent-glow)", color: "var(--accent)",
                          border: "1px solid var(--accent-dim)", borderRadius: 10,
                        }}>DEV</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                      @{u.username} • uid={u.id}
                    </div>
                  </div>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: onlineSet.has(Number(u.id)) ? "var(--green)" : "var(--text-3)",
                    flexShrink: 0,
                  }} />
                  {u.id !== user?.id && (
                    <button onClick={() => deleteUser(u.id)} style={{
                      background: "transparent", border: "none",
                      cursor: "pointer", color: "var(--red)", padding: 4,
                    }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Flags ── */}
          {tab === "flags" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>
                Feature flags — changes apply immediately
              </div>
              {Object.entries(flags).map(([key, val]) => {
                const isBool = typeof val === "boolean";
                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 0", borderBottom: "1px solid var(--border)",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text-1)", fontWeight: 500 }}>
                        {key.replace(/_/g, " ")}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2,
                        fontFamily: "monospace" }}>
                        {String(val)}
                      </div>
                    </div>
                    {isBool ? (
                      <button onClick={() => toggleFlag(key, val)} style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: val ? "var(--accent)" : "var(--text-3)",
                      }}>
                        {val
                          ? <ToggleRight size={28} strokeWidth={1.5} />
                          : <ToggleLeft  size={28} strokeWidth={1.5} />
                        }
                      </button>
                    ) : (
                      <span style={{
                        fontSize: 12, color: "var(--accent)",
                        fontFamily: "monospace", padding: "2px 8px",
                        background: "var(--bg-raised)", borderRadius: 6,
                      }}>
                        {val}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Logs ── */}
          {tab === "logs" && (
            <div>
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 12,
              }}>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  Last {logs.length} entries
                </div>
                <button onClick={loadLogs} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", background: "var(--bg-raised)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  color: "var(--text-2)", fontSize: 11, cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}>
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>
              <div style={{
                background: "var(--bg-base)", borderRadius: "var(--radius)",
                border: "1px solid var(--border)", padding: "10px",
                fontFamily: "monospace", fontSize: 11,
                maxHeight: 400, overflowY: "auto",
              }}>
                {loading && <div style={{ color: "var(--text-3)" }}>Loading…</div>}
                {logs.map((log, i) => (
                  <div key={i} style={{
                    padding: "3px 0", borderBottom: "1px solid var(--border-light)",
                    display: "flex", gap: 8,
                  }}>
                    <span style={{ color: "var(--text-3)", flexShrink: 0 }}>
                      {new Date(log.ts || log.created_at || Date.now()).toLocaleTimeString()}
                    </span>
                    <span style={{
                      color: log.type === "error" ? "var(--red)"
                           : log.type === "auth"  ? "var(--yellow)"
                           : "var(--green)",
                      flexShrink: 0, minWidth: 50,
                    }}>
                      [{log.type || "info"}]
                    </span>
                    <span style={{ color: "var(--text-2)", wordBreak: "break-all" }}>
                      {typeof log.msg === "string" ? log.msg : JSON.stringify(log.msg || log.data || log)}
                    </span>
                  </div>
                ))}
                {!loading && logs.length === 0 && (
                  <div style={{ color: "var(--text-3)" }}>No logs available</div>
                )}
              </div>
            </div>
          )}

          {/* ── System Message ── */}
          {tab === "system" && (
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.6 }}>
                Send a system message to all rooms or a specific room.
                It will appear in grey italic monospace — visually distinct from regular messages.
              </div>

              <div className="form-group">
                <label className="label">Target Room</label>
                <select value={sysRoom} onChange={e => setSysRoom(e.target.value)} style={{
                  width: "100%", padding: "10px 12px",
                  background: "var(--bg-raised)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)", color: "var(--text-1)",
                  fontFamily: "var(--font-body)", fontSize: 13, outline: "none",
                }}>
                  <option value="all">All Rooms</option>
                  {useStore.getState().rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.name || r.id}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Message</label>
                <textarea
                  value={sysMsg}
                  onChange={e => setSysMsg(e.target.value)}
                  placeholder="Server will restart in 5 minutes…"
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px",
                    background: "var(--bg-raised)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", color: "var(--text-1)",
                    fontFamily: "var(--font-body)", fontSize: 13, outline: "none",
                    resize: "vertical", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Preview */}
              {sysMsg && (
                <div style={{
                  padding: "10px 14px", background: "var(--bg-raised)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  marginBottom: 14,
                }}>
                  <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 6 }}>
                    Preview:
                  </div>
                  <div style={{
                    fontFamily: "monospace", fontSize: 12,
                    color: "var(--text-3)", fontStyle: "italic",
                    padding: "6px 10px",
                    borderLeft: "3px solid var(--text-3)",
                    background: "rgba(255,255,255,.03)",
                    borderRadius: "0 6px 6px 0",
                  }}>
                    ⚙ {sysMsg}
                  </div>
                </div>
              )}

              <button onClick={sendSystemMessage} disabled={!sysMsg.trim()} style={{
                width: "100%", padding: "11px",
                background: sysMsg.trim()
                  ? "linear-gradient(135deg, var(--accent), var(--accent2))"
                  : "var(--bg-raised)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: sysMsg.trim() ? "#fff" : "var(--text-3)",
                fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                cursor: sysMsg.trim() ? "pointer" : "not-allowed",
                transition: "var(--trans)",
              }}>
                Send System Message
              </button>

              {/* Recent system messages */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, textTransform: "uppercase",
                  letterSpacing: 1, color: "var(--text-3)", marginBottom: 10,
                  fontWeight: 600 }}>
                  Quick Commands
                </div>
                {[
                  "Server restarting in 5 minutes",
                  "Maintenance mode will begin shortly",
                  "All good — server is healthy",
                  "Please reconnect if you experience issues",
                ].map(cmd => (
                  <button key={cmd} onClick={() => setSysMsg(cmd)} style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 12px", marginBottom: 4,
                    background: "var(--bg-raised)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)", color: "var(--text-2)",
                    fontSize: 12, cursor: "pointer", fontFamily: "var(--font-body)",
                    transition: "var(--trans)",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseLeave={e => e.currentTarget.style.background = "var(--bg-raised)"}
                  >
                    ⚙ {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
