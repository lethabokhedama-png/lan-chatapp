import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useStore from "../lib/store";
import { auth, setToken, users as usersApi } from "../lib/api";

export default function AuthPage() {
  const [tab, setTab]     = useState("login");
  const [form, setForm]   = useState({ username: "", display_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);
  const { setAuth }       = useStore();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = tab === "login"
        ? await auth.login({ username: form.username, password: form.password })
        : await auth.signup(form);
      setToken(res.token);
      setAuth(res.user, res.token);
    } catch (err) {
      setError(err.data?.error || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .28 }}
      >
        <div className="auth-logo">
          <div className="auth-logo-icon">⬡</div>
          <h1>LAN Chat</h1>
          <p>LOCAL NETWORK MESSENGER</p>
        </div>

        <div className="auth-tabs">
          {["login", "signup"].map(t => (
            <button key={t} className={`auth-tab${tab === t ? " active" : ""}`}
              onClick={() => { setTab(t); setError(""); }}>
              {t === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Username</label>
            <input className="input" type="text" autoComplete="username"
              placeholder="your_username" value={form.username} onChange={set("username")}
              onKeyDown={e => e.key === "Enter" && submit(e)} />
          </div>

          <AnimatePresence>
            {tab === "signup" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div className="form-group">
                  <label className="label">Display Name</label>
                  <input className="input" type="text" placeholder="Your Name"
                    value={form.display_name} onChange={set("display_name")} />
                </div>
                <div className="form-group">
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="you@local.lan"
                    value={form.email} onChange={set("email")} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="form-group">
            <label className="label">Password</label>
            <input className="input" type="password" autoComplete="current-password"
              placeholder="••••••••" value={form.password} onChange={set("password")}
              onKeyDown={e => e.key === "Enter" && submit(e)} />
          </div>

          {error && <div className="error-box">{error}</div>}

          <button className="btn btn-primary btn-full" type="submit"
            disabled={busy} style={{ marginTop: 10 }}>
            {busy ? "…" : tab === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}