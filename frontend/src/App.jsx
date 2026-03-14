import React, { useEffect, useState } from "react";
import useStore from "./lib/store";
import { getToken, auth, users as usersApi, clearToken } from "./lib/api";
import { connect, getSocket } from "./lib/socket";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import SettingsModal from "./features/settings/SettingsModal";
import Toast, { showNotification, showToast } from "./ui/Toast";
import Loader from "./Loader";

export default function App() {
  const {
    user, setAuth, setUserMap, setOnline, setOffline, setOnlineList,
    appendMessage, updateMessage, removeMessage, setTyping,
    settingsOpen, addUnread, rooms, setRooms,
  } = useStore();

  const [booting, setBooting] = useState(true);
  const [loaderProgress, setLoaderProgress] = useState(0);

  // Restore session on mount
  useEffect(() => {
    async function boot() {
      const t = getToken();
      if (!t) { setBooting(false); return; }
      try {
        setLoaderProgress(30);
        const u = await auth.me();
        setLoaderProgress(60);
        setAuth(u, t);
        setLoaderProgress(90);
      } catch (_) {
        clearToken();
      }
      setTimeout(() => setBooting(false), 300);
    }
    boot();
  }, []);

  // Socket setup once logged in
  useEffect(() => {
    if (!user) return;
    usersApi.list().then(list => setUserMap(list)).catch(() => {});

    const socket = connect();

    socket.on("presence:list", ({ online }) => {
      setOnlineList(online.map(Number));
    });

    socket.on("presence:update", ({ uid, status }) => {
      const n = Number(uid);
      if (status === "online") {
        setOnline(n);
        const u = useStore.getState().userMap[n];
        if (u && n !== user.id)
          showToast(`${u.display_name || u.username} is online`, "info");
      } else {
        setOffline(n);
      }
    });

    socket.on("msg:new", (msg) => {
      appendMessage(msg.room_id, msg);
      const state  = useStore.getState();
      const cur    = state.activeRoom;
      const isMine = Number(msg.sender_id) === Number(user.id);
      if (!isMine && (!cur || cur.id !== msg.room_id)) {
        addUnread(msg.room_id);
        const sender = state.userMap[Number(msg.sender_id)];
        const name   = sender?.display_name || sender?.username || "Someone";
        showNotification(name, msg.content, msg.room_id, () => {
          const room = state.rooms.find(r => r.id === msg.room_id);
          if (room) state.setActiveRoom(room);
        });
      }
    });

    socket.on("msg:edited",  (msg)               => updateMessage(msg.room_id, msg));
    socket.on("msg:deleted", ({ roomId, msgId })  => removeMessage(roomId, msgId));
    socket.on("msg:receipt", ({ roomId, msg })    => { if (msg) updateMessage(roomId, msg); });
    socket.on("typing:update", ({ roomId, typing }) => setTyping(roomId, typing || []));
    socket.on("connect",    () => console.log("[Socket] Connected uid=", user.id));
    socket.on("disconnect", () => showToast("Disconnected — reconnecting…", "error"));
    socket.on("reconnect",  () => showToast("Back online ✓", "success"));

    return () => {
      ["presence:list","presence:update","msg:new","msg:edited",
       "msg:deleted","msg:receipt","typing:update",
       "connect","disconnect","reconnect"].forEach(e => socket.off(e));
    };
  }, [user?.id]);

  if (booting) return <Loader />;
  if (!user)   return <AuthPage />;

  return (
    <>
      <ChatPage />
      {settingsOpen && <SettingsModal />}
      <Toast />
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
