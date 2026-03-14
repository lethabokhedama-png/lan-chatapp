import { io } from "socket.io-client";
import { getToken } from "./api";

const RT_URL = import.meta.env.VITE_RT_URL || "http://192.168.101.110:6767";

let socket = null;

export function getSocket() { return socket; }

export function connect() {
  if (socket?.connected) return socket;
  console.log("[Socket] Connecting to", RT_URL);
  socket = io(RT_URL, {
    auth: { token: getToken() },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    transports: ["websocket", "polling"],
  });

  socket.on("connect",       () => console.log("[Socket] Connected:", socket.id));
  socket.on("disconnect",    r  => console.log("[Socket] Disconnected:", r));
  socket.on("connect_error", e  => console.error("[Socket] Error:", e.message));

  return socket;
}

export function disconnect() { socket?.disconnect(); socket = null; }

export const emit = {
  joinRoom:    (roomId)                 => socket?.emit("room:join",     { roomId }),
  leaveRoom:   (roomId)                 => socket?.emit("room:leave",    { roomId }),
  sendMsg:     (d)                      => socket?.emit("msg:send",      d),
  editMsg:     (roomId, msgId, content) => socket?.emit("msg:edit",      { roomId, msgId, content }),
  deleteMsg:   (roomId, msgId)          => socket?.emit("msg:delete",    { roomId, msgId }),
  delivered:   (roomId, msgId)          => socket?.emit("msg:delivered", { roomId, msgId }),
  seen:        (roomId, msgId)          => socket?.emit("msg:seen",      { roomId, msgId }),
  typingStart: (roomId)                 => socket?.emit("typing:start",  { roomId }),
  typingStop:  (roomId)                 => socket?.emit("typing:stop",   { roomId }),
  react:       (roomId, msgId, emoji)   => socket?.emit("msg:react",     { roomId, msgId, emoji }),
};
