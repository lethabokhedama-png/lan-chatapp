"use strict";
const presence = require("./presence");
const { dhPost, dhPatch, dhDelete, dhGet } = require("../utils/dataApi");

const log = (tag, ...args) =>
  console.log(`[${new Date().toLocaleTimeString()}] [${tag}]`, ...args);

async function getUsername(uid, token) {
  try {
    const u = await dhGet(`/api/users/${uid}`, token);
    return u?.display_name || u?.username || `uid:${uid}`;
  } catch { return `uid:${uid}`; }
}

let _io;

function init(io) {
  _io = io;

  io.on("connection", async (socket) => {
    const token    = socket.handshake.auth?.token;
    const uid      = socket.uid;
    const username = socket.username || `uid:${uid}`;

    if (!uid) {
      socket.disconnect(true);
      return;
    }

    // Track presence
    presence.connect(socket.id, uid, username, token);
    log("CONNECT", `@${username} uid=${uid}`);

    // Tell everyone this user is online
    io.emit("presence:update", { uid, status: "online" });

    // Tell this socket who is online
    socket.emit("presence:list", {
      online: presence.onlineList().map(e => e.uid),
    });

    // ── Room events ──────────────────────────────────────────────────────
    socket.on("room:join", ({ roomId }) => {
      socket.join(roomId);
    });

    socket.on("room:leave", ({ roomId }) => {
      socket.leave(roomId);
    });

    // ── Messages ─────────────────────────────────────────────────────────
    socket.on("msg:send", async (data) => {
      const { roomId, content, type, fileId, replyToId, clientId } = data;
      log("MSG", `@${username} -> ${roomId} "${String(content).slice(0,40)}"`);

      // System messages — no DB save, broadcast directly
      if (type === "system" || String(content).startsWith("[system]")) {
        const sysMsg = {
          id:         `sys_${Date.now()}`,
          room_id:    roomId,
          sender_id:  uid,
          content,
          type:       "system",
          created_at: new Date().toISOString(),
          client_id:  clientId,
        };
        io.to(roomId).emit("msg:new", sysMsg);
        // Also emit as notification to all connected sockets
        io.emit("sys:announce", { roomId, content, from: username });
        return;
      }

      try {
        const msg = await dhPost(`/api/messages/${roomId}`, {
          content, type: type || "text",
          file_id: fileId || null,
          reply_to: replyToId || null,
          client_id: clientId,
        }, token);
        log("MSG_SAVED", `id=${msg.id}`);
        io.to(roomId).emit("msg:new", msg);
      } catch (err) {
        log("ERR", `msg:send: ${err.message}`);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("msg:edit", async ({ roomId, msgId, content }) => {
      try {
        const updated = await dhPatch(`/api/messages/${roomId}/${msgId}`, { content }, token);
        io.to(roomId).emit("msg:edited", updated);
      } catch (err) { log("ERR", err.message); }
    });

    socket.on("msg:delete", async ({ roomId, msgId }) => {
      try {
        await dhDelete(`/api/messages/${roomId}/${msgId}`, token);
        io.to(roomId).emit("msg:deleted", { roomId, msgId });
      } catch (err) { log("ERR", err.message); }
    });

    socket.on("msg:react", async ({ roomId, msgId, emoji }) => {
      try {
        const updated = await dhPost(
          `/api/messages/${roomId}/${msgId}/react`,
          { emoji }, token
        );
        io.to(roomId).emit("msg:edited", updated);
      } catch (_) {}
    });

    socket.on("msg:delivered", async ({ roomId, msgId }) => {
      try {
        const updated = await dhPost(
          `/api/messages/${roomId}/${msgId}/delivered`, {}, token
        );
        io.to(roomId).emit("msg:receipt", { roomId, msgId, type: "delivered", uid, msg: updated });
      } catch (_) {}
    });

    socket.on("msg:seen", async ({ roomId, msgId }) => {
      try {
        const updated = await dhPost(
          `/api/messages/${roomId}/${msgId}/seen`, {}, token
        );
        io.to(roomId).emit("msg:receipt", { roomId, msgId, type: "seen", uid, msg: updated });
      } catch (_) {}
    });

    // ── Typing ───────────────────────────────────────────────────────────
    socket.on("typing:start", ({ roomId }) => {
      presence.startTyping(roomId, uid);
      socket.to(roomId).emit("typing:update", {
        roomId, typing: presence.typingIn(roomId),
      });
    });

    socket.on("typing:stop", ({ roomId }) => {
      presence.stopTyping(roomId, uid);
      socket.to(roomId).emit("typing:update", {
        roomId, typing: presence.typingIn(roomId),
      });
    });

    // ── Room refresh ────────────────────────────────────────────────────────
    socket.on("rooms:refresh", async () => {
      try {
        const rooms = await dhGet("/api/rooms/mine", token);
        socket.emit("rooms:list", rooms);
        (rooms || []).forEach(r => socket.join(r.id));
        log("ROOMS", `@${username} joined ${(rooms||[]).length} rooms`);
      } catch (err) {
        log("ERR", `rooms:refresh: ${err.message}`);
      }
    });

    // ── Ghost mode ───────────────────────────────────────────────────────
    socket.on("presence:ghost", ({ ghost }) => {
      presence.setGhost(socket.id, ghost);
      if (ghost) {
        io.emit("presence:update", { uid, status: "offline" });
      } else {
        io.emit("presence:update", { uid, status: "online" });
      }
      log("GHOST", `@${username} ghost=${ghost}`);
    });

    // ── Dev: kick ────────────────────────────────────────────────────────
    socket.on("dev:kick", ({ uid: targetUid }) => {
      // Only allow dev accounts — check by uid (lethabok is uid 6)
      const devUids = presence.getDevUids?.() || [6];
      if (!devUids.includes(Number(uid)) && uid !== 6) return;

      // Find all sockets for target uid and disconnect them
      const sockets = io.sockets.sockets;
      sockets.forEach((s) => {
        if (Number(s.uid) === Number(targetUid)) {
          s.emit("kicked", { message: "You have been disconnected by an admin." });
          s.disconnect(true);
          log("KICK", `@${username} kicked uid=${targetUid}`);
        }
      });
    });

    // ── Dev: broadcast system message ────────────────────────────────────
    socket.on("dev:broadcast", ({ content }) => {
      const sysMsg = {
        id:         `sys_${Date.now()}`,
        sender_id:  uid,
        content:    `[system] ${content}`,
        type:       "system",
        created_at: new Date().toISOString(),
      };
      // Send to all rooms this user knows about
      io.emit("sys:announce", { content, from: username });
      log("BROADCAST", `@${username}: ${content}`);
    });

    // ── Disconnect ───────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      // Clear all typing indicators for this user
      const { typingMap } = presence;
      if (typingMap) {
        typingMap.forEach((set, roomId) => {
          if (set.has(uid)) {
            set.delete(uid);
            io.to(roomId).emit("typing:update", {
              roomId, typing: Array.from(set),
            });
          }
        });
      }
      const gone = presence.disconnect(socket.id);
      if (gone !== null) {
        log("DISCONNECT", `@${username} uid=${uid} reason=${reason}`);
        io.emit("presence:update", { uid, status: "offline" });
      }
    });
  });
}

module.exports = { init };
