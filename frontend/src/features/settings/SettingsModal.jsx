import React, { useState, useEffect } from "react";
import { X, User, Bell, Palette, Lock, Info, Key, Phone, ImageSquare } from "@phosphor-icons/react";
import useStore from "../../lib/store";
import { users as usersApi, auth } from "../../lib/api";

const TABS = [
  { id: "account",       label: "Account",      icon: <User size={14} /> },
  { id: "appearance",    label: "Appearance",   icon: <Palette size={14} /> },
  { id: "notifications", label: "Notifs",       icon: <Bell size={14} /> },
  { id: "privacy",       label: "Privacy",      icon: <Lock size={14} /> },
  { id: "about",         label: "About",        icon: <Info size={14} /> },
];

const THEMES = [
  { id: "dark",        label: "Dark",         bg: "#0d0f14", accent: "#4f8ef7", accent2: "#7c6af7" },
  { id: "darker",      label: "Darker",       bg: "#050608", accent: "#7c6af7", accent2: "#4f8ef7" },
  { id: "neon-purple", label: "Neon Purple",  bg: "#0a0612", accent: "#c060ff", accent2: "#8040e0" },
  { id: "vampire",     label: "Vampire",      bg: "#0e0608", accent: "#e02040", accent2: "#c01830" },
  { id: "whatsapp",    label: "WhatsApp",     bg: "#0a120e", accent: "#25d366", accent2: "#128c4a" },
  { id: "light",       label: "Light",        bg: "#f0f2f8", accent: "#4f8ef7", accent2: "#7c6af7" },
  { id: "cyberpunk",   label: "Cyberpunk",    bg: "#0a0a06", accent: "#f0f000", accent2: "#c0c000" },
  { id: "deepsea",     label: "Deep Sea",     bg: "#060e18", accent: "#0090ff", accent2: "#0060d0" },
  { id: "instagram",   label: "Instagram",    bg: "#0a080e", accent: "#e1306c", accent2: "#833ab4" },
  { id: "forest",      label: "Forest",       bg: "#0a1008", accent: "#4ec871", accent2: "#2ea050" },
  { id: "rose",        label: "Rose",         bg: "#12080e", accent: "#f76f8e", accent2: "#e04878" },
  { id: "midnight",    label: "Midnight",     bg: "#0a0e1a", accent: "#4f8ef7", accent2: "#7c6af7" },
];

const AVATAR_COLORS = [
  ["#4f8ef7","#7c6af7"], ["#e1306c","#833ab4"], ["#25d366","#128c4a"],
  ["#e02040","#c01830"], ["#c060ff","#8040e0"], ["#0090ff","#0060d0"],
  ["#f76f8e","#e04878"], ["#f0f000","#c0c000"], ["#4ec871","#2ea050"],
  ["#ffa030","#e07010"], ["#00d4a0","#0090c0"], ["#f5a623","#d4850a"],
];

export default function SettingsModal() {
  const { closeSettings, settingsPage, user, setAuth, token } = useStore();
  const [tab, setTab]             = useState(settingsPage || "account");
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [bio, setBio]             = useState(user?.bio || "");
  const [phone, setPhone]         = useState(user?.phone || "");
  const [oldPw, setOldPw]         = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [avatarColor, setAvatarColor] = useState(0);
  const [saved, setSaved]         = useState("");
  const [theme, setTheme]         = useState(
    () => localStorage.getItem("lanchat_theme") || "dark"
  );

  useEffect(() => { setTab(settingsPage || "account"); }, [settingsPage]);

  function applyTheme(t) {
    setTheme(t.id);
    localStorage.setItem("lanchat_theme", t.id);
    document.documentElement.setAttribute("data-theme", t.id);

    const vars = {
      dark:         { base:"#0d0f14", surface:"#13161e", sidebar:"#0f1117", raised:"#1a1d26", hover:"#1e2130", active:"#232638", border:"#2a2d3a", t1:"#e8eaf0", t2:"#9ba3b8", t3:"#5a6070", accent:"#4f8ef7", accent2:"#7c6af7", green:"#4ec871", red:"#e05c5c" },
      darker:       { base:"#050608", surface:"#0a0b0f", sidebar:"#070809", raised:"#0f1015", hover:"#13141a", active:"#171820", border:"#1e2028", t1:"#dde0ea", t2:"#8890a8", t3:"#484e60", accent:"#7c6af7", accent2:"#4f8ef7", green:"#4ec871", red:"#e05c5c" },
      "neon-purple":{ base:"#0a0612", surface:"#110a1e", sidebar:"#0d0818", raised:"#180f28", hover:"#1e1330", active:"#251838", border:"#301e4a", t1:"#ecdeff", t2:"#a87fd4", t3:"#5e3d80", accent:"#c060ff", accent2:"#8040e0", green:"#50e0a0", red:"#ff4080" },
      vampire:      { base:"#0e0608", surface:"#180a0c", sidebar:"#120608", raised:"#200c10", hover:"#2a1015", active:"#32141a", border:"#4a1c22", t1:"#f5dde0", t2:"#c47880", t3:"#7a3840", accent:"#e02040", accent2:"#c01830", green:"#40e080", red:"#ff6080" },
      whatsapp:     { base:"#0a120e", surface:"#111a14", sidebar:"#0d1610", raised:"#162018", hover:"#1c2a1e", active:"#203024", border:"#264030", t1:"#d8f0e0", t2:"#6daa80", t3:"#3a6048", accent:"#25d366", accent2:"#128c4a", green:"#25d366", red:"#e05c5c" },
      light:        { base:"#f0f2f8", surface:"#ffffff", sidebar:"#e8eaf2", raised:"#eaecf4", hover:"#dfe1ee", active:"#d8daea", border:"#c8cad8", t1:"#1a1c28", t2:"#4a4e68", t3:"#8890a8", accent:"#4f8ef7", accent2:"#7c6af7", green:"#22a84a", red:"#d03030" },
      cyberpunk:    { base:"#0a0a06", surface:"#111108", sidebar:"#0d0d07", raised:"#18180a", hover:"#20200e", active:"#282810", border:"#383810", t1:"#f0f060", t2:"#a8a840", t3:"#606020", accent:"#f0f000", accent2:"#c0c000", green:"#00ff80", red:"#ff4040" },
      deepsea:      { base:"#060e18", surface:"#0a1420", sidebar:"#080f1a", raised:"#0e1c2c", hover:"#122234", active:"#162840", border:"#1e3450", t1:"#c8e8ff", t2:"#6090c0", t3:"#304868", accent:"#0090ff", accent2:"#0060d0", green:"#00d4a0", red:"#ff4060" },
      instagram:    { base:"#0a080e", surface:"#120f18", sidebar:"#0e0b14", raised:"#1a1622", hover:"#211c2c", active:"#282234", border:"#342844", t1:"#f0eaf8", t2:"#a090c0", t3:"#604878", accent:"#e1306c", accent2:"#833ab4", green:"#4ec871", red:"#ff3040" },
      forest:       { base:"#0a1008", surface:"#111a0e", sidebar:"#0d1409", raised:"#172010", hover:"#1e2a16", active:"#24321a", border:"#2e4020", t1:"#d8f0cc", t2:"#78a860", t3:"#406030", accent:"#4ec871", accent2:"#2ea050", green:"#4ec871", red:"#e05c5c" },
      rose:         { base:"#12080e", surface:"#1c0e16", sidebar:"#160a12", raised:"#22101a", hover:"#2c1422", active:"#341828", border:"#4a1e34", t1:"#f8dde8", t2:"#c870a0", t3:"#784060", accent:"#f76f8e", accent2:"#e04878", green:"#50e0b0", red:"#ff4060" },
      midnight:     { base:"#0a0e1a", surface:"#0f1420", sidebar:"#0c1018", raised:"#141c2c", hover:"#182234", active:"#1e2840", border:"#243048", t1:"#d0d8f0", t2:"#7080b0", t3:"#384060", accent:"#4f8ef7", accent2:"#7c6af7", green:"#4ec871", red:"#e05c5c" },
    };
    const v = vars[t.id] || vars.dark;
    const r = document.documentElement;
    r.style.setProperty("--bg-base",     v.base);
    r.style.setProperty("--bg-surface",  v.surface);
    r.style.setProperty("--bg-sidebar",  v.sidebar);
    r.style.setProperty("--bg-raised",   v.raised);
    r.style.setProperty("--bg-hover",    v.hover);
    r.style.setProperty("--bg-active",   v.active);
    r.style.setProperty("--border",      v.border);
    r.style.setProperty("--text-1",      v.t1);
    r.style.setProperty("--text-2",      v.t2);
    r.style.setProperty("--text-3",      v.t3);
    r.style.setProperty("--accent",      v.accent);
    r.style.setProperty("--accent2",     v.accent2);
    r.style.setProperty("--accent-dim",  v.accent + "44");
    r.style.setProperty("--accent-glow", v.accent + "22");
    r.style.setProperty("--green",       v.green);
    r.style.setProperty("--red",         v.red);
    r.style.setProperty("--receipt-sent",      v.t3);
    r.style.setProperty("--receipt-delivered", "#f5a623");
    r.style.setProperty("--receipt-seen",      v.accent);
  }

  useEffect(() => {
    const saved = localStorage.getItem("lanchat_theme") || "dark";
    const t = THEMES.find(x => x.id === saved);
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

  async function changePassword() {
    if (newPw !== confirmPw) { setSaved("pw_mismatch"); setTimeout(() => setSaved(""), 3000); return; }
    try {
      await auth.changePassword({ old_password: oldPw, new_password: newPw });
      setSaved("pw"); setTimeout(() => setSaved(""), 2500);
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (_) { setSaved("pw_err"); setTimeout(() => setSaved(""), 3000); }
  }

  const initials = (user?.display_name || user?.username || "?")[0].toUpperCase();

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.75)",
      backdropFilter: "blur(6px)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 200, padding: 12,
    }} onClick={closeSettings}>
      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 520,
        maxHeight: "92dvh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,.7)", overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px 0", flexShrink: 0,
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, color: "var(--text-1)" }}>
            Settings
          </div>
          <button className="icon-btn" onClick={closeSettings}><X size={16} /></button>
        </div>

        {/* Horizontal tabs */}
        <div style={{
          display: "flex", padding: "10px 16px 0",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
          overflowX: "auto", scrollbarWidth: "none", gap: 0,
        }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "8px 11px", background: "transparent", border: "none",
              cursor: "pointer", fontSize: 12, fontFamily: "var(--font-body)",
              color: tab === t.id ? "var(--accent)" : "var(--text-3)",
              borderBottom: `2px solid ${tab === t.id ? "var(--accent)" : "transparent"}`,
              marginBottom: -1, whiteSpace: "nowrap", transition: "var(--trans)",
              fontWeight: tab === t.id ? 600 : 400,
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>

          {/* ── Account ── */}
          {tab === "account" && (
            <div>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%", margin: "0 auto 10px",
                  background: `linear-gradient(135deg, ${AVATAR_COLORS[avatarColor][0]}, ${AVATAR_COLORS[avatarColor][1]})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 26, fontWeight: 700, color: "#fff",
                  boxShadow: `0 0 24px ${AVATAR_COLORS[avatarColor][0]}44`,
                }}>
                  {initials}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>{user?.display_name || user?.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>@{user?.username}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="label">Avatar Color</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {AVATAR_COLORS.map(([a, b], i) => (
                    <div key={i} onClick={() => setAvatarColor(i)} style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${a}, ${b})`,
                      cursor: "pointer",
                      border: avatarColor === i ? "2px solid var(--text-1)" : "2px solid transparent",
                      boxShadow: avatarColor === i ? `0 0 10px ${a}88` : "none",
                      transition: "var(--trans)",
                    }} />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="label">Display Name</label>
                <input className="input" value={displayName}
                  onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" />
              </div>
              <div className="form-group">
                <label className="label">Username</label>
                <input className="input" value={user?.username} disabled />
              </div>
              <div className="form-group">
                <label className="label">Bio / Status</label>
                <input className="input" value={bio}
                  onChange={e => setBio(e.target.value)} placeholder="What's on your mind?" />
              </div>
              <div className="form-group">
                <label className="label">Phone Number</label>
                <input className="input" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+27 000 000 0000" type="tel" />
              </div>

              <button className="btn btn-primary btn-full" onClick={saveAccount}>
                {saved === "account" ? "✓ Saved!" : "Save Changes"}
              </button>

              <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--text-1)" }}>
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
                  <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>Passwords don't match</div>
                )}
                {saved === "pw_err" && (
                  <div style={{ color: "var(--red)", fontSize: 12, marginBottom: 8 }}>Incorrect current password</div>
                )}
                <button className="btn btn-ghost btn-full" onClick={changePassword}>
                  {saved === "pw" ? "✓ Password Changed!" : "Change Password"}
                </button>
              </div>
            </div>
          )}

          {/* ── Appearance ── */}
          {tab === "appearance" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "var(--text-1)" }}>Theme</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {THEMES.map(t => (
                  <div key={t.id} onClick={() => applyTheme(t)} style={{
                    cursor: "pointer", borderRadius: "var(--radius-sm)", overflow: "hidden",
                    border: `2px solid ${theme === t.id ? "var(--accent)" : "var(--border)"}`,
                    transition: "var(--trans)",
                    boxShadow: theme === t.id ? "0 0 0 3px var(--accent-glow)" : "none",
                  }}>
                    <div style={{
                      height: 52, background: t.bg,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: t.accent2, opacity: .7 }} />
                    </div>
                    <div style={{
                      padding: "4px 6px", background: "var(--bg-raised)",
                      fontSize: 10, textAlign: "center", color: "var(--text-2)",
                    }}>{t.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === "notifications" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                { label: "Message banners",    sub: "Show banner when message arrives",      defaultOn: true },
                { label: "Online alerts",      sub: "When someone comes online",             defaultOn: true },
                { label: "Sound on message",   sub: "Play notification sound",               defaultOn: false },
                { label: "Mention alerts",     sub: "When you're @mentioned in a group",     defaultOn: true },
              ].map(item => <ToggleRow key={item.label} {...item} />)}
            </div>
          )}

          {/* ── Privacy ── */}
          {tab === "privacy" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[
                { label: "Show online status",    sub: "Others can see when you're online",    defaultOn: true },
                { label: "Read receipts",         sub: "Show when you've seen messages",       defaultOn: true },
                { label: "Typing indicator",      sub: "Show when you're typing",              defaultOn: true },
                { label: "Phone number visible",  sub: "Allow others to see your number",      defaultOn: false },
              ].map(item => <ToggleRow key={item.label} {...item} />)}
            </div>
          )}

          {/* ── About ── */}
          {tab === "about" && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, margin: "0 auto 14px",
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, boxShadow: "0 0 32px var(--accent-glow)",
              }}>⬡</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, marginBottom: 4, color: "var(--text-1)" }}>
                LAN Chat
              </div>
              <div style={{ color: "var(--text-3)", fontSize: 12, marginBottom: 4 }}>
                v0.4.0 — Local Network Messenger
              </div>
              <div style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
                Made by LethaboK
              </div>
              <div style={{
                background: "var(--bg-raised)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "14px 16px",
                fontSize: 12, textAlign: "left", display: "flex", flexDirection: "column", gap: 10,
              }}>
                {[
                  ["Frontend",   "React + Vite"],
                  ["Realtime",   "Node.js + Socket.IO"],
                  ["API",        "Python Flask"],
                  ["Storage",    "JSON files (no DB)"],
                  ["Auth",       "HMAC-SHA256 tokens"],
                  ["Icons",      "Phosphor Icons"],
                  ["Platform",   "Termux / Android"],
                  ["Author",     "LethaboK"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-3)" }}>{k}</span>
                    <span style={{ fontWeight: 500, color: "var(--text-1)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-3)", lineHeight: 1.8 }}>
                Built for private LAN/hotspot use only.{"\n"}
                No data leaves your network.

© 2026 LethaboK — All rights reserved.
Unauthorized copying or modification is prohibited.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, defaultOn = false }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--text-1)" }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
      </div>
      <button className={`toggle${on ? " on" : ""}`} onClick={() => setOn(v => !v)} />
    </div>
  );
}
