import React, { useEffect } from "react";
import useStore from "./lib/store";
import { getToken, auth, users as usersApi } from "./lib/api";
import { connect, getSocket } from "./lib/socket";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import SettingsModal from "./features/settings/SettingsModal";
import Toast from "./ui/Toast";

export default function App() {
  const { user, token, setAuth, setUserMap, setOnline, setOffline,
          setOnlineList, appendMessage, updateMessage, removeMessage,
          setTyping, settingsOpen, addUnread, activeRoom } = useStore();

  // On mount — restore session
  useEffect(() => {
    const t = getToken();
    if (!t) return;
    auth.me().then(u => {
      setAuth(u, t);
    }).catch(() => {
      import("./lib/api").then(m => m.clearToken());
    });
  }, []);

  // Once logged in — load users and connect socket
  useEffect(() => {
    if (!user) return;

    // Load all users for the userMap
    usersApi.list().then(list => setUserMap(list)).catch(() => {});

    // Connect socket
    const socket = connect();

    socket.on("presence:list", ({ online }) => {
      console.log("[Presence] Online list:", online);
      setOnlineList(online.map(Number));
    });

    socket.on("presence:update", ({ uid, status }) => {
      console.log("[Presence] Update:", uid, status);
      if (status === "online") setOnline(Number(uid));
      else                     setOffline(Number(uid));
    });

    socket.on("msg:new", (msg) => {
      console.log("[Msg] New:", msg.id, "room:", msg.room_id);
      appendMessage(msg.room_id, msg);
      const cur = useStore.getState().activeRoom;
      if (!cur || cur.id !== msg.room_id) addUnread(msg.room_id);
    });

    socket.on("msg:edited", (msg) => updateMessage(msg.room_id, msg));
    socket.on("msg:deleted", ({ roomId, msgId }) => removeMessage(roomId, msgId));

    socket.on("msg:receipt", ({ roomId, msg }) => {
      if (msg) updateMessage(roomId, msg);
    });

    socket.on("typing:update", ({ roomId, typing }) => {
      setTyping(roomId, typing || []);
    });

    socket.on("connect", () => {
      console.log("[Socket] Connected — emitting online status");
      socket.emit("user:online", { uid: user.id });
    });

    return () => {
      socket.off("presence:list");
      socket.off("presence:update");
      socket.off("msg:new");
      socket.off("msg:edited");
      socket.off("msg:deleted");
      socket.off("msg:receipt");
      socket.off("typing:update");
      socket.off("connect");
    };
  }, [user?.id]);

  if (!user) return <AuthPage />;

  return (
    <>
      <ChatPage />
      {settingsOpen && <SettingsModal />}
      <Toast />
    </>
  );
}
