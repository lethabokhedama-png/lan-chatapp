import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import useStore from "../../lib/store";
import { users as usersApi } from "../../lib/api";

const NAV = [
  { id: "account",     icon: "👤", label: "Account" },
  { id: "appearance",  icon: "🎨", label: "Appearance" },
  { id: "chat",        icon: "💬", label: "Chat" },
  { id: "notifs",      icon: "🔔", label: "Notifications" },
  { id: "privacy",     icon: "🔒", label: "Privacy" },
  { id: "rooms",       icon: "📂", label: "Rooms & DMs" },
  { id: "about",       icon: "ℹ️",  label: "About" },
];

const PALETTES = [
  { id: "default",        label: "Default",        bg: "#0d0f14", accent: "#4f8ef7" },
  { id: "midnight_blue",  label: "Midnight Blue",  bg: "#080e1a", accent: "#5baaf7" },
  { id: "grape_soda",     label: "Grape Soda",     bg: "#100a1c", accent: "#a855f7" },
  { id: "forest_moss",    label: "Forest Moss",    bg: "#080e0a", accent: "#4ade80" },
  { id: "sunset_ember",   label: "Sunset Ember",   bg: "#130a04", accent: "#f97316" },
  { id: "ocean_teal",     label: "Ocean Teal",     bg: "#040e0e", accent: "#2dd4bf" },
  { id: "bubblegum",      label: "Bubblegum",      bg: "#130810", accent: "#f472b6" },
  { id: "solarized_sand", label: "Solarized Sand", bg: "#fdf6e3", accent: "#b58900" },
];

export default function SettingsModal() {
  const { settingsPage, closeSettings, user, prefs, privacy, theme,
          setPrefs, setPrivacy, setTheme, flags } = useStore();
  const [page, setPage] = useState(settingsPage);
  const [profileForm, setProfileForm] = useState({
    display_name: user?.display_name || "",
    bio: user?.bio || "",
    email: user?.email || "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => { setPage(settingsPage); }, [settingsPage]);

  // Load prefs/privacy on mount
  useEffect(() => {
    usersApi.getPrefs().then(setPrefs).catch(() => {});
    usersApi.getPrivacy().then(setPrivacy).catch(() => {});
    usersApi.getTheme().then(setTheme).catch(() => {});
  }, []);

  async function saveProfile() {
    await usersApi.patchProfile(profileForm).catch(() => {});
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  async function togglePref(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await usersApi.patchPrefs({ [key]: !prefs[key] }).catch(() => {});
  }

  async function togglePrivacy(key) {
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    await usersApi.patchPrivacy({ [key]: !privacy[key] }).catch(() => {});
  }

  async function pickTheme(mode, palette) {
    const t = { mode: mode ?? theme.mode, palette: palette ?? theme.palette };
    setTheme(t);
    await usersApi.patchTheme(t).catch(() => {});
  }

  return (
    <motion.div className="overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={closeSettings}>
      <motion.div
        initial={{ scale: .96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: .96, opacity: 0 }} transition={{ duration: .18 }}
        style={{ width: "min(720px, 96vw)", height: "min(560px, 90vh)",
          background: "var(--bg-surface)", borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border)", overflow: "hidden",
          display: "flex", boxShadow: "0 28px 90px rgba(0,0,0,.6)" }}
        onClick={e => e.stopPropagation()}>

        {/* Nav */}
        <div className="settings-nav">
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700,
            padding: "0 10px 14px", color: "var(--text-3)", letterSpacing: .5 }}>
            SETTINGS
          </div>
          {NAV.map(n => (
            <div key={n.id} className={`settings-nav-item${page === n.id ? " active" : ""}`}
              onClick={() => setPage(n.id)}>
              <span>{n.icon}</span> {n.label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="settings-content">
          <button className="icon-btn" style={{ float: "right", marginBottom: 8 }}
            onClick={closeSettings}>✕</button>

          {/* ── Account ── */}
          {page === "account" && (
            <>
              <div className="settings-section-title">Account</div>
              <div className="form-group">
                <label className="label">Display Name</label>
                <input className="input" value={profileForm.display_name}
                  onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Bio</label>
                <input className="input" value={profileForm.bio}
                  onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input className="input" type="email" value={profileForm.email}
                  onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={saveProfile}>
                {saved ? "✓ Saved" : "Save Changes"}
              </button>
              <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <button className="btn btn-ghost"
                  onClick={() => { usersApi.logout?.(); import("../../lib/api").then(m => { m.clearToken(); useStore.getState().clearAuth(); }); }}>
                  Sign Out
                </button>
              </div>
            </>
          )}

          {/* ── Appearance ── */}
          {page === "appearance" && (
            <>
              <div className="settings-section-title">Appearance</div>

              <div className="setting-row">
                <div>
                  <div className="setting-label">Theme Mode</div>
                  <div className="setting-sub">Follow device, or pick manually</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["system", "dark", "light"].map(m => (
                    <button key={m} className={`btn ${theme.mode === m ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "5px 11px", fontSize: 11 }}
                      onClick={() => pickTheme(m, null)}>
                      {m === "system" ? "Default" : m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="setting-label" style={{ marginBottom: 10 }}>Colour Palette</div>
                <div className="palette-grid">
                  {PALETTES.map(p => (
                    <div key={p.id} title={p.label}
                      className={`palette-chip${theme.palette === p.id ? " selected" : ""}`}
                      style={{ background: p.bg, border: `2px solid ${theme.palette === p.id ? p.accent : "transparent"}` }}
                      onClick={() => pickTheme(null, p.id)}>
                      <div style={{ height: "50%", background: p.accent, opacity: .8 }} />
                      <div style={{ padding: "3px 5px", fontSize: 9, color: p.bg === "#fdf6e3" ? "#073642" : "#fff",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="setting-row" style={{ marginTop: 18 }}>
                <div>
                  <div className="setting-label">Reduce Motion</div>
                  <div className="setting-sub">Fewer animations</div>
                </div>
                <button className={`toggle${prefs.reduce_motion ? " on" : ""}`}
                  onClick={() => togglePref("reduce_motion")} />
              </div>
            </>
          )}

          {/* ── Chat ── */}
          {page === "chat" && (
            <>
              <div className="settings-section-title">Chat</div>
              {[
                { key: "enter_to_send",      label: "Enter to send",              sub: "Press Enter to send, Shift+Enter for newline" },
                { key: "typing_indicators",  label: "Typing indicators",          sub: "Show when others are typing" },
                { key: "group_consecutive",  label: "Group consecutive messages", sub: "Collapse messages from same sender within 5 min" },
              ].map(({ key, label, sub }) => (
                <div key={key} className="setting-row">
                  <div>
                    <div className="setting-label">{label}</div>
                    <div className="setting-sub">{sub}</div>
                  </div>
                  <button className={`toggle${prefs[key] !== false ? " on" : ""}`}
                    onClick={() => togglePref(key)} />
                </div>
              ))}
            </>
          )}

          {/* ── Notifications ── */}
          {page === "notifs" && (
            <>
              <div className="settings-section-title">Notifications & Sounds</div>
              {[
                { key: "notification_sounds", label: "Sound notifications", sub: "Play a sound for new messages" },
              ].map(({ key, label, sub }) => (
                <div key={key} className="setting-row">
                  <div>
                    <div className="setting-label">{label}</div>
                    <div className="setting-sub">{sub}</div>
                  </div>
                  <button className={`toggle${prefs[key] !== false ? " on" : ""}`}
                    onClick={() => togglePref(key)} />
                </div>
              ))}
            </>
          )}

          {/* ── Privacy ── */}
          {page === "privacy" && (
            <>
              <div className="settings-section-title">Privacy</div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Send read receipts</div>
                  <div className="setting-sub">If off, others see •• but not •••</div>
                </div>
                <button className={`toggle${privacy.send_read_receipts !== false ? " on" : ""}`}
                  onClick={() => togglePrivacy("send_read_receipts")} />
              </div>
              <div className="setting-row">
                <div>
                  <div className="setting-label">Last seen visibility</div>
                  <div className="setting-sub">Who can see when you were last active</div>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {["everyone", "nobody"].map(v => (
                    <button key={v} className={`btn ${privacy.last_seen_visibility === v ? "btn-primary" : "btn-ghost"}`}
                      style={{ padding: "5px 10px", fontSize: 11 }}
                      onClick={async () => {
                        setPrivacy({ ...privacy, last_seen_visibility: v });
                        await usersApi.patchPrivacy({ last_seen_visibility: v }).catch(() => {});
                      }}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Rooms ── */}
          {page === "rooms" && (
            <>
              <div className="settings-section-title">Rooms & DMs</div>
              <div style={{ color: "var(--text-3)", fontSize: 13 }}>
                Room-specific settings (mute, notifications) appear when you right-click a room in the sidebar.
              </div>
            </>
          )}

          {/* ── About ── */}
          {page === "about" && (
            <>
              <div className="settings-section-title">About</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["App", "LAN Chat"], ["Version", "1.0.0"], ["Build", "local"]].map(([k, v]) => (
                  <div key={k} className="setting-row">
                    <span className="setting-label" style={{ textTransform: "none", fontSize: 13 }}>{k}</span>
                    <span style={{ color: "var(--text-2)", fontSize: 13 }}>{v}</span>
                  </div>
                ))}
                {flags?.backup_button && (
                  <button className="btn btn-ghost" style={{ marginTop: 12, alignSelf: "flex-start" }}>
                    💾 Create Backup
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}