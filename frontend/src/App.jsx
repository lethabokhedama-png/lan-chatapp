import React, { useEffect, useState } from "react";
import useStore from "./lib/store";
import { getToken, auth, users as usersApi, clearToken } from "./lib/api";
import { connect } from "./lib/socket";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import SettingsModal from "./features/settings/SettingsModal";
import Toast, { showNotification, showToast } from "./ui/Toast";
import Loader from "./Loader";
import Permissions from "./Permissions";

const PERMS_KEY = "lanchat_perms_done";

export default function App() {
  const {
    user, setAuth, setUserMap, setOnline, setOffline, setOnlineList,
    appendMessage, updateMessage, removeMessage, setTyping,
    settingsOpen, addUnread,
  } = useStore();

  const [booting, setBooting]   = useState(true);
  const [showPerms, setShowPerms] = useState(false);

  useEffect(() => {
    async function boot() {
      // Show permissions on first ever launch
      if (!localStorage.getItem(PERMS_KEY)) {
        setShowPerms(true);
      }

      const t = getToken();
      if (!t) { setBooting(false); return; }
      try {
        const u = await auth.me();
        setAuth(u, t);
      } catch (_) { clearToken(); }
      setBooting(false);
    }
    boot();
  }, []);

  function onPermsDone() {
    localStorage.setItem(PERMS_KEY, "1");
    setShowPerms(false);
  }

  useEffect(() => {
    if (!user) return;
    usersApi.list().then(list => setUserMap(list)).catch(() => {});
    const socket = connect();

    socket.on("presence:list",   ({ online }) => setOnlineList(online.map(Number)));
    socket.on("presence:update", ({ uid, status }) => {
      const n = Number(uid);
      if (status === "online") {
        setOnline(n);
        const u = useStore.getState().userMap[n];
        if (u && n !== Number(user.id))
          showToast(`${u.display_name || u.username} is online`, "info");
      } else {
        setOffline(n);
      }
    });

    socket.on("msg:new", (msg) => {
      appendMessage(msg.room_id, msg);
      const state  = useStore.getState();
      const isMine = Number(msg.sender_id) === Number(user.id);
      if (!isMine && (!state.activeRoom || state.activeRoom.id !== msg.room_id)) {
        addUnread(msg.room_id);
        const sender = state.userMap[Number(msg.sender_id)];
        showNotification(
          sender?.display_name || sender?.username || "Someone",
          msg.content, msg.room_id,
          () => { const r = state.rooms.find(x => x.id === msg.room_id); if (r) state.setActiveRoom(r); }
        );
      }
    });

    socket.on("msg:edited",      (msg)              => updateMessage(msg.room_id, msg));
    socket.on("msg:deleted",     ({ roomId, msgId }) => removeMessage(roomId, msgId));
    socket.on("msg:receipt",     ({ roomId, msg })   => { if (msg) updateMessage(roomId, msg); });
    socket.on("typing:update",   ({ roomId, typing }) => setTyping(roomId, typing || []));
    socket.on("disconnect",      () => showToast("Disconnected…", "error"));
    socket.on("reconnect",       () => showToast("Back online ✓", "success"));

    return () => {
      ["presence:list","presence:update","msg:new","msg:edited",
       "msg:deleted","msg:receipt","typing:update","disconnect","reconnect"]
        .forEach(e => socket.off(e));
    };
  }, [user?.id]);

  if (showPerms) return <Permissions onDone={onPermsDone} />;
  if (booting)   return <Loader />;
  if (!user)     return <AuthPage />;

  return (
    <>
      <ChatPage />
      {settingsOpen && <SettingsModal />}
      <Toast />
      <style>{`
        @keyframes slideDown {
          from { opacity:0; transform:translateY(-12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; } to { opacity:1; }
        }
      `}</style>
    </>
  );
}
