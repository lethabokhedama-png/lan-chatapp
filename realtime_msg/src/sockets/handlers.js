const presence        = require("./presence");
const { verifyToken } = require("../middleware/auth");
const { dhPost, dhPatch, dhDelete } = require("../utils/dataApi");

const log = (tag, ...args) => console.log(`[${new Date().toLocaleTimeString()}] [${tag}]`, ...args);

let _io;

function init(io) {
  _io = io;

  io.on("connection", (socket) => {
    const token = socket.handshake.auth?.token;
    const uid   = verifyToken(token);

    if (!uid) {
      log("AUTH", `REJECTED sid=${socket.id} — invalid token`);
      socket.emit("error", { message: "Invalid token" });
      socket.disconnect(true);
      return;
    }

    presence.connect(socket.id, uid, token);
    log("CONNECT", `uid=${uid} sid=${socket.id} ip=${socket.handshake.address}`);
    log("ONLINE", `Online now: [${presence.onlineList().join(", ")}]`);

    // Tell everyone this user is online
    io.emit("presence:update", { uid, status: "online" });
    // Tell this socket who's online
    socket.emit("presence:list", { online: presence.onlineList() });

    socket.on("room:join", ({ roomId }) => {
      socket.join(roomId);
      log("ROOM", `uid=${uid} joined room ${roomId}`);
    });

    socket.on("room:leave", ({ roomId }) => {
      socket.leave(roomId);
      log("ROOM", `uid=${uid} left room ${roomId}`);
    });

    socket.on("msg:send", async (data) => {
      log("MSG", `uid=${uid} -> room=${data.roomId} content="${data.content?.slice(0,40)}"`);
      try {
        const msg = await dhPost(`/api/messages/${data.roomId}`, {
          content:   data.content,
          type:      data.type   || "text",
          file_id:   data.fileId || null,
          reply_to:  data.replyTo || null,
          client_id: data.clientId,
        }, token);
        log("MSG", `saved id=${msg.id} -> broadcasting to room ${data.roomId}`);
        io.to(data.roomId).emit("msg:new", msg);
      } catch (err) {
        log("ERR", `msg:send failed: ${err.response?.data?.error || err.message}`);
        socket.emit("error", { message: err.response?.data?.error || "send failed" });
      }
    });

    socket.on("msg:edit", async ({ roomId, msgId, content }) => {
      log("EDIT", `uid=${uid} msg=${msgId} room=${roomId}`);
      try {
        const updated = await dhPatch(`/api/messages/${roomId}/${msgId}`, { content }, token);
        io.to(roomId).emit("msg:edited", updated);
      } catch (err) {
        log("ERR", `msg:edit: ${err.message}`);
      }
    });

    socket.on("msg:delete", async ({ roomId, msgId }) => {
      log("DELETE", `uid=${uid} msg=${msgId} room=${roomId}`);
      try {
        await dhDelete(`/api/messages/${roomId}/${msgId}`, token);
        io.to(roomId).emit("msg:deleted", { roomId, msgId });
      } catch (err) {
        log("ERR", `msg:delete: ${err.message}`);
      }
    });

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

    socket.on("typing:start", ({ roomId }) => {
      presence.startTyping(roomId, uid);
      socket.to(roomId).emit("typing:update", { roomId, typing: presence.typingIn(roomId) });
    });

    socket.on("typing:stop", ({ roomId }) => {
      presence.stopTyping(roomId, uid);
      socket.to(roomId).emit("typing:update", { roomId, typing: presence.typingIn(roomId) });
    });

    socket.on("disconnect", (reason) => {
      const offlineUid = presence.disconnect(socket.id);
      log("DISCONNECT", `uid=${uid} sid=${socket.id} reason=${reason}`);
      if (offlineUid !== null) {
        log("ONLINE", `uid=${offlineUid} went offline. Online: [${presence.onlineList().join(", ")}]`);
        io.emit("presence:update", { uid: offlineUid, status: "offline" });
      }
    });

    socket.on("error", (err) => {
      log("ERR", `socket error uid=${uid}: ${err.message}`);
    });
  });
}

module.exports = { init };
