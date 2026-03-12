import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useStore from "./lib/store";
import { auth, users as usersApi, dev } from "./lib/api";
import { connect as connectSocket, getSocket, emit } from "./lib/socket";

import AuthPage     from "./pages/AuthPage";
import ChatPage     from "./pages/ChatPage";
import SettingsModal from "./features/settings/SettingsModal";

export default function App() {
  const { user, token, setAuth, clearAuth, setUsers, setOnline,
          setUserOnline, setUserOffline, appendMessage, updateMessage,
          setTyping, incUnread, activeRoom, settingsOpen, theme } = useStore();

  // ── Apply theme ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const mode = theme.mode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme.mode;
    root.setAttribute("data-theme",   mode);
    root.setAttribute("data-palette", theme.palette || "default");
  }, [theme]);

  // ── Auto-login from stored token ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    auth.me()
      .then((u) => setAuth(u, token))
      .catch(() => clearAuth());
  }, []);

  // ── Load user list + connect socket once logged in ───────────────────────────
  useEffect(() => {
    if (!user) return;

    usersApi.list().then((list) => setUsers(list)).catch(() => {});
    dev.flags().then((f) => useStore.getState().setFlags(f)).catch(() => {});

    const socket = connectSocket();

    socket.on("presence:list",   ({ online }) => setOnline(online));
    socket.on("presence:update", ({ uid, status }) => {
      if (status === "online") setUserOnline(uid);
      else setUserOffline(uid);
    });

    socket.on("msg:new", (msg) => {
      appendMessage(msg.room_id, msg);
      const cur = useStore.getState().activeRoom;
      if (!cur || cur.id !== msg.room_id) {
        incUnread(msg.room_id);
      } else {
        emit.seen(msg.room_id, msg.id);
      }
    });

    socket.on("msg:edited",  (msg) => updateMessage(msg.room_id, msg));
    socket.on("msg:deleted", ({ roomId, msgId }) => {
      updateMessage(roomId, { id: msgId, _deleted: true, content: "" });
    });

    socket.on("msg:receipt", ({ roomId, msg }) => {
      if (msg) updateMessage(roomId, msg);
    });

    socket.on("typing:update", ({ roomId, typing }) => {
      setTyping(roomId, typing);
    });

    return () => { socket.off(); };
  }, [user?.id]);

  if (!user) return <AuthPage />;

  return (
    <div className="app-shell">
      <ChatPage />
      <AnimatePresence>
        {settingsOpen && <SettingsModal />}
      </AnimatePresence>
    </div>
  );
}