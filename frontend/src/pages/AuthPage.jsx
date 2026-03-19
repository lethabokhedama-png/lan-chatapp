import { Eye, EyeOff } from "react-feather";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useStore from "../lib/store";
import { auth, setToken } from "../lib/api";

export default function AuthPage() {
  const [tab, setTab]   = useState("login");
  const [form, setForm] = useState({ username: "", display_name: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);
  const { setAuth }       = useStore();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = tab === "login"
        ? await auth.login({ username: form.username, password: form.password })
        : await auth.signup({ username: form.username, display_name: form.display_name, password: form.password });
      setToken(res.token);
      setAuth(res.user, res.token);
    } catch (err) {
      setError(err.data?.error || err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)", position: "relative", padding: 16,
    }}>
      {/* Glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 60% 50% at 20% 30%, var(--accent-glow) 0%, transparent 60%),
          radial-gradient(ellipse 45% 60% at 80% 75%, rgba(124,106,247,.08) 0%, transparent 55%)
        `,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .3 }}
        style={{
          width: "100%", maxWidth: 380, padding: "36px 32px",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)", position: "relative", zIndex: 1,
          boxShadow: "0 0 80px rgba(0,0,0,.5)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: 14, marginBottom: 12,
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            fontSize: 24, boxShadow: "0 0 32px var(--accent-glow)",
          }}>⬡</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>
            LAN Chat
          </div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3, letterSpacing: 1.5 }}>
            LOCAL NETWORK MESSENGER
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
          background: "var(--bg-raised)", borderRadius: "var(--radius-sm)",
          padding: 4, marginBottom: 22,
        }}>
          {["login", "register"].map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); }} style={{
              padding: "8px", border: "none", cursor: "pointer",
              borderRadius: 6, fontSize: 11, fontWeight: 500,
              fontFamily: "var(--font-body)", letterSpacing: .5,
              textTransform: "uppercase", transition: "var(--trans)",
              background: tab === t ? "var(--bg-active)" : "transparent",
              color: tab === t ? "var(--text-1)" : "var(--text-3)",
            }}>
              {t === "login" ? "Login" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <Field label="Username" type="text" placeholder="your_handle"
            value={form.username} onChange={set("username")} />

          <AnimatePresence>
            {tab === "register" && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                <Field label="Display Name" type="text" placeholder="Your Name"
                  value={form.display_name} onChange={set("display_name")} />
              </motion.div>
            )}
          </AnimatePresence>

          <Field label="Password" type={showPw ? "text" : "password"} placeholder="••••••••"
              value={form.password} onChange={set("password")}
              rightSlot={
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  background:"none", border:"none", cursor:"pointer",
                  color:"var(--text-3)", padding:4,
                  display:"flex", alignItems:"center",
                }}>
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              }
            />

          {error && (
            <div style={{
              color: "var(--red)", fontSize: 12,
              background: "rgba(224,92,92,.1)", border: "1px solid rgba(224,92,92,.3)",
              borderRadius: "var(--radius-sm)", padding: "8px 12px", marginBottom: 12,
            }}>{error}</div>
          )}

          <button type="submit" disabled={busy} style={{
            width: "100%", padding: "11px", border: "none",
            borderRadius: "var(--radius-sm)",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            color: "#fff", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? .6 : 1,
            transition: "var(--trans)", boxShadow: "0 4px 20px var(--accent-glow)",
          }}>
            {busy ? "…" : tab === "login" ? "Login →" : "Create Account →"}
          </button>
        </form>
      </motion.div>

      {/* Footer */}
      <div style={{
        marginTop: 20, fontSize: 10, color: "var(--text-3)",
        textAlign: "center", position: "relative", zIndex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 8, flexWrap: "wrap",
      }}>
        {["Made by LethaboK", "LAN only — no internet needed", "v1.7.20", "All data stays on your network", "© 2026 LethaboK — All rights reserved"].map((item, i, arr) => (
          <React.Fragment key={item}>
            <span>{item}</span>
            {i < arr.length - 1 && <span style={{ color: "var(--border)" }}>•</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Field({ label, type, placeholder, value, onChange, rightSlot }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: "block", fontSize: 10, textTransform: "uppercase",
        letterSpacing: 1.2, color: "var(--text-3)", marginBottom: 6, fontWeight: 600,
      }}>{label}</label>
      <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
      <input type={type} placeholder={placeholder} value={value} onChange={onChange}
        required
        style={{
          width: "100%", padding: "10px 13px",
          background: "var(--bg-raised)", border: `1px solid ${focused ? "var(--accent-dim)" : "var(--border)"}`,
          borderRadius: "var(--radius-sm)", color: "var(--text-1)",
          fontFamily: "var(--font-body)", fontSize: 13, outline: "none",
          boxSizing: "border-box", transition: "var(--trans)",
          boxShadow: focused ? "0 0 0 3px var(--accent-glow)" : "none",
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {rightSlot && (
        <div style={{
          position:"absolute", right:8, top:"50%",
          transform:"translateY(-50%)",
          display:"flex", alignItems:"center",
        }}>
          {rightSlot}
        </div>
      )}
      </div>
    </div>
  );
}
