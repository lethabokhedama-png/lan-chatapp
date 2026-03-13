import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useStore from "../lib/store";
import { auth, setToken } from "../lib/api";

export default function AuthPage() {
  const [tab, setTab]   = useState("login");
  const [form, setForm] = useState({ username: "", display_name: "", password: "" });
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
      setError(err.data?.error || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "var(--bg-base)", position: "relative",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 60% 50% at 20% 30%, rgba(79,142,247,.15) 0%, transparent 60%),
          radial-gradient(ellipse 45% 60% at 80% 75%, rgba(224,107,139,.1) 0%, transparent 55%)
        `,
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .3 }}
        style={{
          width: "100%", maxWidth: 380, padding: "40px 36px",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)", position: "relative", zIndex: 1,
          boxShadow: "0 0 80px rgba(0,0,0,.5)",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 56, height: 56, borderRadius: 16, marginBottom: 14,
              background: "linear-gradient(135deg, var(--accent), var(--accent2))",
              fontSize: 26, boxShadow: "0 0 32px var(--accent-glow)",
            }}
          >⬡</motion.div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: -.5 }}>
            LAN Chat
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, letterSpacing: 1.5 }}>
            LOCAL NETWORK MESSENGER
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
          background: "var(--bg-raised)", borderRadius: "var(--radius)",
          padding: 4, marginBottom: 24,
        }}>
          {["login", "signup"].map(t => (
            <button key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                padding: "8px", border: "none", cursor: "pointer",
                borderRadius: 8, fontSize: 12, fontWeight: 500,
                fontFamily: "var(--font-body)", letterSpacing: .5,
                textTransform: "uppercase", transition: "var(--trans)",
                background: tab === t ? "var(--bg-active)" : "transparent",
                color: tab === t ? "var(--text-1)" : "var(--text-3)",
              }}>
              {t === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <Field label="Username" type="text" placeholder="your_handle"
            value={form.username} onChange={set("username")} />

          <AnimatePresence>
            {tab === "signup" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                <Field label="Display Name" type="text" placeholder="Your Name"
                  value={form.display_name} onChange={set("display_name")} />
              </motion.div>
            )}
          </AnimatePresence>

          <Field label="Password" type="password" placeholder="••••••••"
            value={form.password} onChange={set("password")} />

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                color: "var(--red)", fontSize: 12,
                background: "rgba(224,92,92,.1)", border: "1px solid rgba(224,92,92,.3)",
                borderRadius: "var(--radius-sm)", padding: "8px 12px", marginBottom: 12,
              }}>
              {error}
            </motion.div>
          )}

          <button type="submit" disabled={busy} style={{
            width: "100%", padding: "11px", border: "none", borderRadius: "var(--radius-sm)",
            background: "var(--accent)", color: "#fff", fontFamily: "var(--font-body)",
            fontSize: 13, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? .6 : 1, transition: "var(--trans)",
            boxShadow: "0 4px 20px var(--accent-glow)", letterSpacing: .3,
          }}>
            {busy ? "…" : tab === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function Field({ label, type, placeholder, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: "block", fontSize: 10, textTransform: "uppercase",
        letterSpacing: 1.2, color: "var(--text-3)", marginBottom: 6, fontWeight: 600,
      }}>{label}</label>
      <input type={type} placeholder={placeholder} value={value} onChange={onChange}
        style={{
          width: "100%", padding: "10px 13px",
          background: "var(--bg-raised)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", color: "var(--text-1)",
          fontFamily: "var(--font-body)", fontSize: 13, outline: "none",
          transition: "var(--trans)", boxSizing: "border-box",
        }}
        onFocus={e => { e.target.style.borderColor = "var(--accent-dim)"; e.target.style.boxShadow = "0 0 0 3px var(--accent-glow)"; }}
        onBlur={e => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}
