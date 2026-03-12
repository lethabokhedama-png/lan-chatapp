/**
 * Socket.IO client — connects to realtime_msg server.
 * Exports a singleton socket and typed emit helpers.
 */
import { io } from "socket.io-client";
import { getToken } from "./api";

const RT_URL = import.meta.env.VITE_RT_URL ||
  `http://${location.hostname}:6767`;

let socket = null;

export function getSocket() { return socket; }

export function connect() {
  if (socket?.connected) return socket;
  socket = io(RT_URL, {
    auth:         { token: getToken() },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
}

// ── Typed emitters ─────────────────────────────────────────────────────────────

export const emit = {
  joinRoom:    (roomId)               => socket?.emit("room:join",     { roomId }),
  leaveRoom:   (roomId)               => socket?.emit("room:leave",    { roomId }),
  sendMsg:     (d)                    => socket?.emit("msg:send",      d),
  editMsg:     (roomId, msgId, content) => socket?.emit("msg:edit",   { roomId, msgId, content }),
  deleteMsg:   (roomId, msgId)        => socket?.emit("msg:delete",   { roomId, msgId }),
  delivered:   (roomId, msgId)        => socket?.emit("msg:delivered", { roomId, msgId }),
  seen:        (roomId, msgId)        => socket?.emit("msg:seen",      { roomId, msgId }),
  typingStart: (roomId)               => socket?.emit("typing:start",  { roomId }),
  typingStop:  (roomId)               => socket?.emit("typing:stop",   { roomId }),
};