import React, { useState, useRef, useEffect } from "react";
import { ArrowLeft, ChevronRight, User, Bell, Sliders, Lock, Info } from "react-feather";
import useStore from "../lib/store";
import { users as usersApi, auth, clearToken } from "../lib/api";

const THEMES = [
  { id: "dark",        label: "Dark",        bg: "#0d0f14", accent: "#4f8ef7", accent2: "#7c6af7" },
  { id: "darker",      label: "Darker",      bg: "#050608", accent: "#7c6af7", accent2: "#4f8ef7" },
  { id: "neon-purple", label: "Neon Purple", bg: "#0a0612", accent: "#c060ff", accent2: "#8040e0" },
  { id: "vampire",     label: "Vampire",     bg: "#0e0608", accent: "#e02040", accent2: "#c01830" },
  { id: "whatsapp",    label: "WhatsApp",    bg: "#0a120e", accent: "#25d366", accent2: "#128c4a" },
  { id: "light",       label: "Light",       bg: "#f0f2f8", accent: "#4f8ef7", accent2: "#7c6af7" },
  { id: "cyberpunk",   label: "Cyberpunk",   bg: "#0a0a06", accent: "#f0f000", accent2: "#c0c000" },
  { id: "deepsea",     label: "Deep Sea",    bg: "#060e18", accent: "#0090ff", accent2: "#0060d0" },
  { id: "instagram",   label: "Instagram",   bg: "#0a080e", accent: "#e1306c", accent2: "#833ab4" },
  { id: "forest",      label: "Forest",      bg: "#0a1008", accent: "#4ec871", accent2: "#2ea050" },
  { id: "rose",        label: "Rose",        bg: "#12080e", accent: "#f76f8e", accent2: "#e04878" },
  { id: "midnight",    label: "Midnight",    bg: "#0a0e1a", accent: "#4f8ef7", accent2: "#7c6af7" },
];

const AVATAR_COLORS = [
  ["#4f8ef7","#7c6af7"],["#e1306c","#833ab4"],["#25d366","#128c4a"],
  ["#e02040","#c01830"],["#c060ff","#8040e0"],["#0090ff","#0060d0"],
  ["#f76f8e","#e04878"],["#f0f000","#c0c000"],["#4ec871","#2ea050"],
  ["#ffa030","#e07010"],["#00d4a0","#0090c0"],["#f5a623","#d4850a"],
];

const SECTIONS = [
  { id: "account",       label: "Account",       icon: <User size={16} />,    sub: "Profile, password, avatar" },
  { id: "appearance",    label: "Appearance",     icon: <Sliders size={16} />, sub: "Themes and colors" },
  { id: "notifications", label: "Notifications",  icon: <Bell size={16} />,    sub: "Alerts and sounds" },
  { id: "privacy",       label: "Privacy",        icon: <Lock size={16} />,    sub: "Online status, receipts" },
  { id: "about",         label: "About",          icon: <Info size={16} />,    sub: "Version and credits" },
];

function applyTheme(t) {
  localStorage.setItem("lanchat_theme", t.id);
  const vars = {
    dark:          { base:"#0d0f14",surface:"#13161e",sidebar:"#0f1117",raised:"#1a1d26",hover:"#1e2130",active:"#232638",border:"#2a2d3a",t1:"#e8eaf0",t2:"#9ba3b8",t3:"#5a6070",accent:"#4f8ef7",accent2:"#7c6af7",green:"#4ec871",red:"#e05c5c" },
    darker:        { base:"#050608",surface:"#0a0b0f",sidebar:"#070809",raised:"#0f1015",hover:"#13141a",active:"#171820",border:"#1e2028",t1:"#dde0ea",t2:"#8890a8",t3:"#484e60",accent:"#7c6af7",accent2:"#4f8ef7",green:"#4ec871",red:"#e05c5c" },
    "neon-purple": { base:"#0a0612",surface:"#110a1e",sidebar:"#0d0818",raised:"#180f28",hover:"#1e1330",active:"#251838",border:"#301e4a",t1:"#ecdeff",t2:"#a87fd4",t3:"#5e3d80",accent:"#c060ff",accent2:"#8040e0",green:"#50e0a0",red:"#ff4080" },
    vampire:       { base:"#0e0608",surface:"#180a0c",sidebar:"#120608",raised:"#200c10",hover:"#2a1015",active:"#32141a",border:"#4a1c22",t1:"#f5dde0",t2:"#c47880",t3:"#7a3840",accent:"#e02040",accent2:"#c01830",green:"#40e080",red:"#ff6080" },
    whatsapp:      { base:"#0a120e",surface:"#111a14",sidebar:"#0d1610",raised:"#162018",hover:"#1c2a1e",active:"#203024",border:"#264030",t1:"#d8f0e0",t2:"#6daa80",t3:"#3a6048",accent:"#25d366",accent2:"#128c4a",green:"#25d366",red:"#e05c5c" },
    light:         { base:"#f0f2f8",surface:"#ffffff",sidebar:"#e8eaf2",raised:"#eaecf4",hover:"#dfe1ee",active:"#d8daea",border:"#c8cad8",t1:"#1a1c28",t2:"#4a4e68",t3:"#8890a8",accent:"#4f8ef7",accent2:"#7c6af7",green:"#22a84a",red:"#d03030" },
    cyberpunk:     { base:"#0a0a06",surface:"#111108",sidebar:"#0d0d07",raised:"#18180a",hover:"#20200e",active:"#282810",border:"#383810",t1:"#f0f060",t2:"#a8a840",t3:"#606020",accent:"#f0f000",accent2:"#c0c000",green:"#00ff80",red:"#ff4040" },
    deepsea:       { base:"#060e18",surface:"#0a1420",sidebar:"#080f1a",raised:"#0e1c2c",hover:"#122234",active:"#162840",border:"#1e3450",t1:"#c8e8ff",t2:"#6090c0",t3:"#304868",accent:"#0090ff",accent2:"#0060d0",green:"#00d4a0",red:"#ff4060" },
    instagram:     { base:"#0a080e",surface:"#120f18",sidebar:"#0e0b14",raised:"#1a1622",hover:"#211c2c",active:"#282234",border:"#342844",t1:"#f0eaf8",t2:"#a090c0",t3:"#604878",accent:"#e1306c",accent2:"#833ab4",green:"#4ec871",red:"#ff3040" },
    forest:        { base:"#0a1008",surface:"#111a0e",sidebar:"#0d1409",raised:"#172010",hover:"#1e2a16",active:"#24321a",border:"#2e4020",t1:"#d8f0cc",t2:"#78a860",t3:"#406030",accent:"#4ec871",accent2:"#2ea050",green:"#4ec871",red:"#e05c5c" },
    rose:          { base:"#12080e",surface:"#1c0e16",sidebar:"#160a12",raised:"#22101a",hover:"#2c1422",active:"#341828",border:"#4a1e34",t1:"#f8dde8",t2:"#c870a0",t3:"#784060",accent:"#f76f8e",accent2:"#e04878",green:"#50e0b0",red:"#ff4060" },
    midnight:      { base:"#0a0e1a",surface:"#0f1420",sidebar:"#0c1018",raised:"#141c2c",hover:"#182234",active:"#1e2840",border:"#243048",t1:"#d0d8f0",t2:"#7080b0",t3:"#384060",accent:"#4f8ef7",accent2:"#7c6af7",green:"#4ec871",red:"#e05c5c" },
  };
  const v = vars[t.id] || vars.dark;
  const r = document.documentElement;
  r.style.setProperty("--bg-base",           v.base);
  r.style.setProperty("--bg-surface",        v.surface);
  r.style.setProperty("--bg-sidebar",        v.sidebar);
  r.style.setProperty("--bg-raised",         v.raised);
  r.style.setProperty("--bg-hover",          v.hover);
  r.style.setProperty("--bg-active",         v.active);
  r.style.setProperty("--border",            v.border);
  r.style.setProperty("--text-1",            v.t1);
  r.style.setProperty("--text-2",            v.t2);
  r.style.setProperty("--text-3",            v.t3);
  r.style.setProperty("--accent",            v.accent);
  r.style.setProperty("--accent2",           v.accent2);
  r.style.setProperty("--accent-dim",        v.accent + "44");
  r.style.setProperty("--accent-glow",       v.accent + "22");
  r.style.setProperty("--green",             v.green);
  r.style.setProperty("--red",               v.red);
  r.style.setProperty("--receipt-sent",      v.t3);
  r.style.setProperty("--receipt-delivered", "#f5a623");
  r.style.setProperty("--receipt-seen",      v.accent);
}

export default function SettingsPage({ onBack, devUnlocked, onOpenDev }) {
  const { user, setAuth, token, clearAuth } = useStore();
  const [section,     setSection]     = useState(null);
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio,         setBio]         = useState(user?.bio || "");
  const [phone,       setPhone]       = useState(user?.phone || "");
  const [oldPw,       setOldPw]       = useState("");
  const [newPw,       setNewPw]       = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [avatarColor, setAvatarColor] = useState(0);
  const [pfp,         setPfp]         = useState(user?.avatar_url || null);
  const [saved,       setSaved]       = useState("");
  const [theme,       setTheme]       = useState(
    () => localStorage.getItem("lanchat_theme") || "dark"
  );
  const pfpRef = useRef(null);

  useEffect(() => {
    const t = THEMES.find(x => x.id === theme);
    if (t) applyTheme(t);
  }, []);

  async function saveAccount() {
    try {
      const updated = await usersApi.updateMe({ display_name: displayName, bio, phone });
      setAuth(updated, token);
      setSaved("account");
      setTimeout(() => setSaved(""), 2500);
    } catch (_) {}
  }

  async function uploadPfp(e) {
    const file = e.target.files[0];
    if (!file) return;
    const BASE = import.meta.env.VITE_API_URL || "";
    const tk   = localStorage.getItem("lanchat_token");
    const form = new FormData();
    form.append("file", file);
    try {
      const res  = await fetch(BASE + "/api/uploads/file", {
        method: "POST",
        headers: { Authorization: "Bearer " + tk },
        body: form,
      });
      const meta = await res.json();
      const url  = meta.url || meta.file_url || "";
      setPfp(url);
      const updated = await usersApi.updateMe({ avatar_url: url });
      setAuth(updated, token);
    } catch (_) {}
  }

  async function changePassword() {
    if (newPw !== confirmPw) {
      setSaved("pw_mismatch");
      setTimeout(() => setSaved(""), 3000);
      return;
    }
    try {
      await auth.changePassword({ old_password: oldPw, new_password: newPw });
      setSaved("pw");
      setTimeout(() => setSaved(""), 2500);
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (_) {
      setSaved("pw_err");
      setTimeout(() => setSaved(""), 3000);
    }
  }

  function logout() {
    auth.logout().catch(() => {});
    clearToken();
    clearAuth();
  }

  const initials = (user?.display_name || user?.username || "?")[0].toUpperCase();
  const acColors = AVATAR_COLORS[avatarColor] || AVATAR_COLORS[0];

  // ── Section detail pages ─────────────────────────────────────────────────
  if (section) {
    return (
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        background: "var(--bg-base)", overflowY: "auto",
      }}>
        <PageHeader
          title={SECTIONS.find(s => s.id === section)?.label || ""}
          goBack={() => setSection(null)}
        />

        <div style={{ padding: 16, flex: 1 }}>

          {/* ── ACCOUNT ── */}
          {section === "account" && (
            <div>
              {/* Avatar */}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  position: "relative", display: "inline-block", marginBottom: 10,
                }}>
                  <div
                    onClick={() => pfpRef.current?.click()}
                    style={{
                      width: 80, height: 80, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${acColors[0]}, ${acColors[1]})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28, fontWeight: 700, color: "#fff",
                      boxShadow: `0 0 24px ${acColors[0]}44`,
                      cursor: "pointer", overflow: "hidden",
                    }}
                  >
                    {pfp
                      ? <img src={pfp} alt="pfp" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : initials}
                  </div>
                  <div
                    onClick={() => pfpRef.current?.click()}
                    style={{
                      position: "absolute", bottom: 0, right: 0,
                      width: 26, height: 26, borderRadius: "50%",
                      background: "var(--accent)", border: "2px solid var(--bg-base)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <input
                    ref={pfpRef} type="file" accept="image/*"
                    style={{ display: "none" }} onChange={uploadPfp}
                  />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>
                  {user?.display_name || user?.username}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>@{user?.username}</div>
              </div>

              {/* Avatar color */}
              <div style={{ marginBottom: 16 }}>
                <div className="label">Avatar Color</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {AVATAR_COLORS.map(([a, b], i) => (
                    <div
                      key={i}
                      onClick={() => setAvatarColor(i)}
                      style={{
                        width: 30, height: 30, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${a}, ${b})`,
                        cursor: "pointer",
                        border: avatarColor === i
                          ? "2px solid var(--text-1)"
                          : "2px solid transparent",
                        transition: "var(--trans)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div className="form-group">
                <label className="label">Display Name</label>
                <input className="input" value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name" />
              </div>
              <div className="form-group">
                <label className="label">Username</label>
                <input className="input" value={user?.username || ""} disabled />
              </div>
              <div className="form-group">
                <label className="label">Bio</label>
                <input className="input" value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="What is on your mind?" />
              </div>
              <div className="form-group">
                <label className="label">Phone</label>
                <input className="input" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+27 000 000 0000" type="tel" />
              </div>

              <button className="btn btn-primary btn-full" onClick={saveAccount}>
                {saved === "account" ? "Saved!" : "Save Changes"}
              </button>

              {/* Password change */}
              <div style={{
                marginTop: 22, paddingTop: 16,
                borderTop: "1px solid var(--border)",
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 600,
                  color: "var(--text-1)", marginBottom: 14,
                }}>
                  Change Password
                </div>
                <div className="form-group">
                  <label className="label">Current Password</label>
                  <input className="input" type="password" value={oldPw}
                    onChange={e => setOldPw(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label className="label">New Password</label>
                  <input className="input" type="password" value={newPw}
                    onChange={e => setNewPw(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="form-group">
                  <label className="label">Confirm New Password</label>
                  <input className="input" type="password" value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)} placeholder="••••••••" />
                </div>
                {saved === "pw_mismatch" && (
                  <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>
                    Passwords do not match
                  </div>
                )}
                {saved === "pw_err" && (
                  <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>
                    Wrong current password
                  </div>
                )}
                <button className="btn btn-ghost btn-full" onClick={changePassword}>
                  {saved === "pw" ? "Changed!" : "Change Password"}
                </button>
              </div>

              {/* Sign out inside account section too */}
              <div style={{
                marginTop: 16, paddingTop: 16,
                borderTop: "1px solid var(--border)",
              }}>
                <button
                  className="btn btn-full"
                  onClick={logout}
                  style={{
                    background: "rgba(224,92,92,.1)",
                    border: "1px solid rgba(224,92,92,.3)",
                    color: "var(--red)",
                  }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {section === "appearance" && (
            <div>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: "var(--text-1)", marginBottom: 14,
              }}>
                Theme
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}>
                {THEMES.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setTheme(t.id); applyTheme(t); }}
                    style={{
                      cursor: "pointer",
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                      border: `2px solid ${theme === t.id ? "var(--accent)" : "var(--border)"}`,
                      boxShadow: theme === t.id ? "0 0 0 3px var(--accent-glow)" : "none",
                      transition: "var(--trans)",
                    }}
                  >
                    <div style={{
                      height: 52, background: t.bg,
                      display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 6,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: t.accent,
                        boxShadow: `0 0 8px ${t.accent}`,
                      }} />
                      <div style={{
                        width: 14, height: 14, borderRadius: "50%",
                        background: t.accent2, opacity: 0.7,
                      }} />
                    </div>
                    <div style={{
                      padding: "4px 6px",
                      background: "var(--bg-raised)",
                      fontSize: 10, textAlign: "center",
                      color: "var(--text-2)",
                    }}>
                      {t.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {section === "notifications" && (
            <div>
              {[
                { label: "Message banners",    sub: "Show banner on new message",          defaultOn: true  },
                { label: "Online alerts",      sub: "When someone comes online",           defaultOn: true  },
                { label: "Notification sound", sub: "Play sound on new message",           defaultOn: true  },
                { label: "Mention alerts",     sub: "When you are @mentioned in a group",  defaultOn: true  },
                { label: "Background alerts",  sub: "Browser notification when minimised", defaultOn: false },
              ].map(item => (
                <ToggleRow key={item.label} {...item} />
              ))}
            </div>
          )}

          {/* ── PRIVACY ── */}
          {section === "privacy" && (
            <div>
              {[
                { label: "Show online status",  sub: "Others can see when you are online", defaultOn: true  },
                { label: "Read receipts",        sub: "Show when you have seen a message",  defaultOn: true  },
                { label: "Typing indicator",     sub: "Show when you are typing",           defaultOn: true  },
                { label: "Phone number visible", sub: "Allow others to see your number",    defaultOn: false },
              ].map(item => (
                <ToggleRow key={item.label} {...item} />
              ))}
            </div>
          )}

          {/* ── ABOUT ── */}
          {section === "about" && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                margin: "0 auto 14px",
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 32px var(--accent-glow)",
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                  stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 20,
                fontWeight: 800, marginBottom: 4, color: "var(--text-1)",
              }}>
                LAN Chat
              </div>
              <div style={{ color: "var(--text-3)", fontSize: 12, marginBottom: 4 }}>
                v1.7.24 — Local Network Messenger
              </div>
              <div style={{
                color: "var(--accent)", fontSize: 12,
                fontWeight: 600, marginBottom: 20,
              }}>
                Created by LethaboK
              </div>
              <div style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "14px 16px", fontSize: 12, textAlign: "left",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                {[
                  ["Version",    "v1.7.24"],
                  ["Frontend",   "React + Vite"],
                  ["Realtime",   "Node.js + Socket.IO"],
                  ["API",        "Python Flask + Waitress"],
                  ["Storage",    "JSON files — no database"],
                  ["Auth",       "HMAC-SHA256 tokens"],
                  ["Platform",   "Termux — Android"],
                  ["Author",     "Lethabo Khedama"],
                  ["License",    "Proprietary"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-3)" }}>{k}</span>
                    <span style={{ fontWeight: 500, color: "var(--text-1)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 16, fontSize: 11,
                color: "var(--text-3)", lineHeight: 1.8,
              }}>
                Built for private LAN and hotspot use only.<br />
                No data ever leaves your network.
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  // ── Main settings list ───────────────────────────────────────────────────
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: "var(--bg-base)", overflowY: "auto",
    }}>

      {/* Header with back button */}
      {onBack && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px", borderBottom: "1px solid var(--border)",
          background: "var(--bg-surface)",
          position: "sticky", top: 0, zIndex: 10, flexShrink: 0,
        }}>
          <button className="icon-btn" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: 16,
            fontWeight: 700, color: "var(--text-1)",
          }}>
            Settings
          </div>
        </div>
      )}

      {/* Profile header */}
      <div style={{
        padding: "20px 16px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: `linear-gradient(135deg, ${acColors[0]}, ${acColors[1]})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 700, color: "#fff",
          boxShadow: `0 0 20px ${acColors[0]}44`,
          flexShrink: 0, overflow: "hidden",
        }}>
          {pfp
            ? <img src={pfp} alt="pfp" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
            {user?.display_name || user?.username}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
            @{user?.username}
          </div>
          {user?.bio && (
            <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              {user.bio}
            </div>
          )}
        </div>
      </div>

      {/* Section list */}
      <div style={{ flex: 1, padding: "8px 0" }}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              width: "100%", padding: "14px 16px",
              background: "transparent", border: "none",
              borderBottom: "1px solid var(--border-light)",
              cursor: "pointer", textAlign: "left",
              transition: "var(--trans)",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            onTouchStart={e => e.currentTarget.style.background = "var(--bg-hover)"}
            onTouchEnd={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: "var(--bg-raised)",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--accent)", flexShrink: 0,
            }}>
              {s.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-1)" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                {s.sub}
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-3)" />
          </button>
        ))}
      </div>

      {/* Sign Out button */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={logout}
          style={{
            width: "100%", padding: "12px",
            background: "rgba(224,92,92,.08)",
            border: "1px solid rgba(224,92,92,.3)",
            borderRadius: "var(--radius-sm)",
            color: "var(--red)",
            fontFamily: "var(--font-body)",
            fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8,
            transition: "var(--trans)",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(224,92,92,.15)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(224,92,92,.08)"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>

      {/* Dev Panel button — lethabok only */}
      {devUnlocked && onOpenDev && (
        <div style={{ padding: "0 16px 24px" }}>
          <button
            onClick={onOpenDev}
            style={{
              width: "100%", padding: "12px",
              background: "rgba(79,142,247,.08)",
              border: "1px solid var(--accent-dim)",
              borderRadius: "var(--radius-sm)",
              color: "var(--accent)",
              fontFamily: "var(--font-body)",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
              transition: "var(--trans)",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(79,142,247,.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(79,142,247,.08)"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Dev Panel
          </button>
        </div>
      )}

    </div>
  );
}

// ── Helpers outside the component ────────────────────────────────────────────

function PageHeader({ title, goBack }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 16px",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg-surface)",
      position: "sticky", top: 0, zIndex: 10, flexShrink: 0,
    }}>
      <button className="icon-btn" onClick={goBack}>
        <ArrowLeft size={18} />
      </button>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 16,
        fontWeight: 700, color: "var(--text-1)",
      }}>
        {title}
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "13px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--text-1)" }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>
        )}
      </div>
      <button
        className={`toggle${on ? " on" : ""}`}
        onClick={() => setOn(v => !v)}
      />
    </div>
  );
}
