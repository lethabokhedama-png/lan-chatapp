import React, { useEffect } from "react";
import useStore from "./lib/store";
import { getToken, auth, users as usersApi, clearToken } from "./lib/api";
import { connect, getSocket } from "./lib/socket";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import SettingsModal from "./features/settings/SettingsModal";
import Toast, { showNotification, showToast } from "./ui/Toast";

export default function App() {
  const {
    user, setAuth, setUserMap, setOnline, setOffline, setOnlineList,
    appendMessage, updateMessage, removeMessage, setTyping,
    settingsOpen, addUnread, userMap, setRooms, rooms,
  } = useStore();

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    auth.me().then(u => setAuth(u, t)).catch(() => clearToken());
  }, []);

  useEffect(() => {
    if (!user) return;
    usersApi.list().then(list => setUserMap(list)).catch(() => {});

    const socket = connect();

    socket.on("presence:list", ({ online }) => {
      console.log("[Presence] Online:", online);
      setOnlineList(online.map(Number));
    });

    socket.on("presence:update", ({ uid, status }) => {
      const uidN = Number(uid);
      if (status === "online") {
        setOnline(uidN);
        const u = useStore.getState().userMap[uidN];
        if (u && uidN !== user.id)
          showToast(`${u.display_name || u.username} came online`, "info");
      } else {
        setOffline(uidN);
      }
    });

    socket.on("msg:new", (msg) => {
      console.log("[Msg] New:", msg.id, "room:", msg.room_id);
      appendMessage(msg.room_id, msg);
      const state    = useStore.getState();
      const cur      = state.activeRoom;
      const isMine   = msg.sender_id === user.id;

      if (!isMine && (!cur || cur.id !== msg.room_id)) {
        addUnread(msg.room_id);
        const sender = state.userMap[msg.sender_id];
        const name   = sender?.display_name || sender?.username || "Someone";
        showNotification(name, msg.content, msg.room_id, () => {
          const room = state.rooms.find(r => r.id === msg.room_id);
          if (room) state.setActiveRoom(room);
        });
      }

      // Learn the reply pattern
      if (isMine) {
        const msgs = state.messages[msg.room_id] || [];
        const prev = [...msgs].reverse().find(m => m.sender_id !== user.id);
        if (prev?.content) {
          fetch(
            (import.meta.env.VITE_API_URL || "") + "/api/dev/learn-reply",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + getToken(),
              },
              body: JSON.stringify({ context: prev.content, reply: msg.content }),
            }
          ).catch(() => {});
        }
      }
    });

    socket.on("msg:edited",  (msg)            => updateMessage(msg.room_id, msg));
    socket.on("msg:deleted", ({ roomId, msgId }) => removeMessage(roomId, msgId));
    socket.on("msg:receipt", ({ roomId, msg }) => { if (msg) updateMessage(roomId, msg); });
    socket.on("typing:update", ({ roomId, typing }) => setTyping(roomId, typing || []));

    socket.on("connect", () => {
      console.log("[Socket] Connected as uid=", user.id);
      socket.emit("user:online", { uid: user.id });
    });

    socket.on("disconnect", () => showToast("Disconnected — reconnecting…", "error"));
    socket.on("reconnect",  () => showToast("Back online ✓", "success"));

    return () => {
      ["presence:list","presence:update","msg:new","msg:edited",
       "msg:deleted","msg:receipt","typing:update","connect",
       "disconnect","reconnect"].forEach(e => socket.off(e));
    };
  }, [user?.id]);

  if (!user) return <AuthPage />;

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
