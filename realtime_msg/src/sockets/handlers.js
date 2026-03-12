/**
 * All Socket.IO event handlers.
 * Each handler:
 *   1. Validates the token inline
 *   2. Calls DataHandling to persist
 *   3. Broadcasts to the room
 */
const presence  = require("./presence");
const { verifyToken } = require("../middleware/auth");
const { dhPost, dhPatch, dhDelete } = require("../utils/dataApi");

let _io; // set by init()

function init(io) {
  _io = io;

  io.on("connection", (socket) => {
    // ── Auth on connect ──────────────────────────────────────────────
    const token = socket.handshake.auth?.token;
    const uid   = verifyToken(token);
    if (!uid) {
      socket.emit("error", { message: "Invalid token" });
      socket.disconnect(true);
      return;
    }

    presence.connect(socket.id, uid, token);
    io.emit("presence:update", { uid, status: "online" });
    socket.emit("presence:list", { online: presence.onlineList() });
    console.log(`[+] uid=${uid} sid=${socket.id}`);

    // ── Join / leave rooms ───────────────────────────────────────────
    socket.on("room:join", ({ roomId }) => {
      socket.join(roomId);
      socket.emit("room:joined", { roomId });
    });

    socket.on("room:leave", ({ roomId }) => {
      socket.leave(roomId);
    });

    // ── Send message ─────────────────────────────────────────────────
    socket.on("msg:send", async (data) => {
      try {
        const msg = await dhPost(
          `/api/messages/${data.roomId}`,
          {
            content:   data.content,
            type:      data.type   || "text",
            file_id:   data.fileId || null,
            reply_to:  data.replyTo || null,
            client_id: data.clientId,
          },
          token
        );
        // Broadcast the saved message (with server-assigned ID) to room
        io.to(data.roomId).emit("msg:new", msg);
      } catch (err) {
        socket.emit("error", { message: err.response?.data?.error || "send failed" });
      }
    });

    // ── Edit message ─────────────────────────────────────────────────
    socket.on("msg:edit", async ({ roomId, msgId, content }) => {
      try {
        const updated = await dhPatch(`/api/messages/${roomId}/${msgId}`, { content }, token);
        io.to(roomId).emit("msg:edited", updated);
      } catch (err) {
        socket.emit("error", { message: "edit failed" });
      }
    });

    // ── Delete message ───────────────────────────────────────────────
    socket.on("msg:delete", async ({ roomId, msgId }) => {
      try {
        await dhDelete(`/api/messages/${roomId}/${msgId}`, token);
        io.to(roomId).emit("msg:deleted", { roomId, msgId });
      } catch (err) {
        socket.emit("error", { message: "delete failed" });
      }
    });

    // ── Receipts ─────────────────────────────────────────────────────
    socket.on("msg:delivered", async ({ roomId, msgId }) => {
      try {
        const updated = await dhPost(`/api/messages/${roomId}/${msgId}/delivered`, {}, token);
        io.to(roomId).emit("msg:receipt", { roomId, msgId, type: "delivered", uid, msg: updated });
      } catch (_) {}
    });

    socket.on("msg:seen", async ({ roomId, msgId }) => {
      try {
        const updated = await dhPost(`/api/messages/${roomId}/${msgId}/seen`, {}, token);
        io.to(roomId).emit("msg:receipt", { roomId, msgId, type: "seen", uid, msg: updated });
      } catch (_) {}
    });

    // ── Typing ───────────────────────────────────────────────────────
    socket.on("typing:start", ({ roomId }) => {
      presence.startTyping(roomId, uid);
      socket.to(roomId).emit("typing:update", { roomId, typing: presence.typingIn(roomId) });
    });

    socket.on("typing:stop", ({ roomId }) => {
      presence.stopTyping(roomId, uid);
      socket.to(roomId).emit("typing:update", { roomId, typing: presence.typingIn(roomId) });
    });

    // ── Disconnect ───────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const offlineUid = presence.disconnect(socket.id);
      if (offlineUid !== null) {
        io.emit("presence:update", { uid: offlineUid, status: "offline" });
        console.log(`[-] uid=${offlineUid} sid=${socket.id}`);
      }
    });
  });
}

module.exports = { init };