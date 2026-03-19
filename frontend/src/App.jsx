import React, { useEffect, useState } from "react";
import useStore from "./lib/store";
import { getToken, auth, users as usersApi, clearToken } from "./lib/api";
import { connect, emit } from "./lib/socket";
import AuthPage    from "./pages/AuthPage";
import ChatPage    from "./pages/ChatPage";
import Toast, { showNotification, showToast } from "./ui/Toast";
import Loader      from "./Loader";
import Permissions from "./Permissions";
import ErrorBoundary from "./ErrorBoundary";

export default function App() {
  const {
    user, setAuth, setUserMap, setOnline, setOffline, setOnlineList,
    appendMessage, updateMessage, removeMessage, setTyping,
    addUnread, clearAuth,
  } = useStore();

  const [booting,      setBooting]      = useState(true);
  const [showPerms,    setShowPerms]    = useState(false);
  const [permsChecked, setPermsChecked] = useState(false);

  useEffect(() => {
    const granted = localStorage.getItem("lanchat_perms_granted");
    if (!granted) setShowPerms(true);
    setPermsChecked(true);
  }, []);

  useEffect(() => {
    if (!permsChecked || showPerms) return;
    (async () => {
      const t = getToken();
      if (t) {
        try { const u = await auth.me(); setAuth(u, t); }
        catch (_) { clearToken(); }
      }
      setBooting(false);
    })();
  }, [permsChecked, showPerms]);

  function onPermsDone() {
    localStorage.setItem("lanchat_perms_granted", "1");
    setShowPerms(false);
    (async () => {
      const t = getToken();
      if (t) {
        try { const u = await auth.me(); setAuth(u, t); }
        catch (_) { clearToken(); }
      }
      setBooting(false);
    })();
  }

  useEffect(() => {
    if (!user) return;

    // Load user list
    usersApi.list().then(list => setUserMap(list)).catch(() => {});

    const socket = connect();

    // ── Presence ──────────────────────────────────────────────────────────
    socket.on("presence:list", ({ online }) => {
      setOnlineList((online || []).map(Number));
    });

    socket.on("presence:update", ({ uid, status }) => {
      const n = Number(uid);
      if (n === Number(user.id)) return; // ignore self
      if (status === "online") {
        setOnline(n);
        const u = useStore.getState().userMap[n];
        if (u) showToast(`${u.display_name || u.username} is online`, "info");
      } else {
        setOffline(n);
      }
    });

    // ── Messages ──────────────────────────────────────────────────────────
    socket.on("msg:new", (msg) => {
      if (!msg?.room_id) return;
      appendMessage(msg.room_id, msg);
      const state  = useStore.getState();
      const isMine = Number(msg.sender_id) === Number(user.id);
      if (!isMine) {
        const inRoom = state.activeRoom?.id === msg.room_id;
        if (!inRoom) addUnread(msg.room_id);
        const sender = state.userMap[Number(msg.sender_id)];
        const name   = sender?.display_name || sender?.username || "Someone";
        const body   = msg.type === "voice" ? "Voice note"
                     : msg.type === "image" ? "Image"
                     : msg.type === "system" ? msg.content?.replace("[system]","").trim()
                     : msg.content;
        if (!inRoom) {
          showNotification(name, body, msg.room_id, () => {
            const r = state.rooms.find(x => x.id === msg.room_id);
            if (r) state.setActiveRoom(r);
          });
        }
      }
    });

    socket.on("msg:edited",  (msg)                => { if (msg) updateMessage(msg.room_id, msg); });
    socket.on("msg:deleted", ({ roomId, msgId })   => removeMessage(roomId, msgId));
    socket.on("msg:receipt", ({ roomId, msg })     => { if (msg) updateMessage(roomId, msg); });
    socket.on("typing:update", ({ roomId, typing }) => setTyping(roomId, typing || []));

    // ── System announcements from dev ─────────────────────────────────────
    socket.on("sys:announce", ({ content, from }) => {
      showNotification(
        `⚙ System — ${from || "Admin"}`,
        content?.replace("[system]","").trim() || "",
        null,
        () => {}
      );
    });

    // ── Kicked by admin ───────────────────────────────────────────────────
    socket.on("kicked", ({ message }) => {
      showToast(message || "You were disconnected by an admin.", "error");
      setTimeout(() => {
        clearToken();
        clearAuth();
      }, 2000);
    });

    // ── Connection state ──────────────────────────────────────────────────
    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      // Re-join all rooms on reconnect
      const state = useStore.getState();
      state.rooms?.forEach(r => emit.joinRoom(r.id));
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      if (reason !== "io client disconnect") {
        showToast("Connection lost — reconnecting…", "error");
      }
    });

    socket.on("connect_error", (e) => {
      console.error("[Socket] Error:", e.message);
    });

    return () => {
      [
        "presence:list","presence:update",
        "msg:new","msg:edited","msg:deleted","msg:receipt",
        "typing:update","sys:announce","kicked",
        "connect","disconnect","connect_error",
      ].forEach(e => socket.off(e));
    };
  }, [user?.id]);

  if (showPerms)                return <Permissions onDone={onPermsDone} />;
  if (!permsChecked || booting) return <Loader />;
  if (!user)                    return <AuthPage />;

  return (
    <ErrorBoundary>
      <ChatPage />
      <Toast />
      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
      `}</style>
    </ErrorBoundary>
  );
}
