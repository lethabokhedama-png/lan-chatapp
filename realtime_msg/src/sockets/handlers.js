const presence        = require("./presence");
const { verifyToken } = require("../middleware/auth");
const { dhPost, dhPatch, dhDelete, dhGet } = require("../utils/dataApi");

const log = (tag, ...args) =>
  console.log(`[${new Date().toLocaleTimeString()}] [${tag}]`, ...args);

async function getUsername(uid, token) {
  try {
    const u = await dhGet(`/api/users/${uid}`, token);
    return u?.display_name || u?.username || `uid:${uid}`;
  } catch { return `uid:${uid}`; }
}

function logOnlineList() {
  const list = presence.onlineList();
  const names = list.map(e => e.username || `uid:${e.uid}`);
  log("ONLINE", `[${names.join(", ") || "nobody"}]`);
}

let _io;

function init(io) {
  _io = io;

  io.on("connection", async (socket) => {
    const token = socket.handshake.auth?.token;
    const uid   = verifyToken(token);

    if (!uid) {
      log("AUTH", `REJECTED sid=${socket.id} — invalid token`);
      socket.emit("error", { message: "Invalid token" });
      socket.disconnect(true);
      return;
    }

    const username = await getUsername(uid, token);
    presence.connect(socket.id, uid, username, token);

    log("CONNECT", `@${username} (uid=${uid}) sid=${socket.id} ip=${socket.handshake.address}`);
    logOnlineList();

    io.emit("presence:update", { uid, status: "online" });
    socket.emit("presence:list", { online: presence.onlineList().map(e => e.uid) });

    socket.on("room:join", ({ roomId }) => {
      socket.join(roomId);
      log("ROOM_JOIN", `@${username} joined ${roomId}`);
    });

    socket.on("room:leave", ({ roomId }) => {
      socket.leave(roomId);
      log("ROOM_LEAVE", `@${username} left ${roomId}`);
    });

    socket.on("msg:send", async (data) => {
      log("MSG", `@${username} -> room:${data.roomId} "${data.content?.slice(0, 50)}"`);
      try {
        const msg = await dhPost(`/api/messages/${data.roomId}`, {
          content: data.content, type: data.type || "text",
          file_id: data.fileId || null, reply_to: data.replyTo || null,
          client_id: data.clientId,
        }, token);
        log("MSG_SAVED", `id=${msg.id} broadcasting to room ${data.roomId}`);
        io.to(data.roomId).emit("msg:new", msg);
      } catch (err) {
        log("ERR", `msg:send failed: ${err.response?.data?.error || err.message}`);
        socket.emit("error", { message: err.response?.data?.error || "send failed" });
      }
    });

    socket.on("msg:edit", async ({ roomId, msgId, content }) => {
      log("EDIT", `@${username} msg=${msgId}`);
      try {
        const updated = await dhPatch(`/api/messages/${roomId}/${msgId}`, { content }, token);
        io.to(roomId).emit("msg:edited", updated);
      } catch (err) { log("ERR", err.message); }
    });

    socket.on("msg:delete", async ({ roomId, msgId }) => {
      log("DELETE", `@${username} msg=${msgId}`);
      try {
        await dhDelete(`/api/messages/${roomId}/${msgId}`, token);
        io.to(roomId).emit("msg:deleted", { roomId, msgId });
      } catch (err) { log("ERR", err.message); }
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
      const gone = presence.disconnect(socket.id);
      if (gone !== null) {
        log("DISCONNECT", `@${username} (uid=${uid}) reason=${reason}`);
        logOnlineList();
        io.emit("presence:update", { uid, status: "offline" });
      }
    });
  });
}

module.exports = { init };

// Re-emit presence on reconnect
// (added to fix users showing offline when online)
