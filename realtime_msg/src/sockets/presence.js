"use strict";

const sidToUid  = new Map(); // socket.id -> uid
const uidToData = new Map(); // uid -> { sids: Set, username, ghost }
const typingMap = new Map(); // roomId -> Set(uid)

function connect(sid, uid, username, token) {
  sidToUid.set(sid, uid);
  if (!uidToData.has(uid)) {
    uidToData.set(uid, { sids: new Set(), username, ghost: false });
  }
  const data = uidToData.get(uid);
  data.sids.add(sid);
  data.username = username;
}

function disconnect(sid) {
  const uid = sidToUid.get(sid);
  if (!uid) return null;
  sidToUid.delete(sid);
  const data = uidToData.get(uid);
  if (!data) return null;
  data.sids.delete(sid);
  if (data.sids.size === 0) {
    uidToData.delete(uid);
    return uid;
  }
  return null; // still connected on another socket
}

function setGhost(sid, ghost) {
  const uid = sidToUid.get(sid);
  if (!uid) return;
  const data = uidToData.get(uid);
  if (data) data.ghost = ghost;
}

function onlineList() {
  return Array.from(uidToData.entries())
    .filter(([, d]) => !d.ghost)
    .map(([uid, d]) => ({ uid, username: d.username }));
}

function startTyping(roomId, uid) {
  if (!typingMap.has(roomId)) typingMap.set(roomId, new Set());
  typingMap.get(roomId).add(uid);
}

function stopTyping(roomId, uid) {
  typingMap.get(roomId)?.delete(uid);
}

function typingIn(roomId) {
  return Array.from(typingMap.get(roomId) || []);
}

function getDevUids() {
  return [6]; // lethabok uid
}

module.exports = {
  connect, disconnect, setGhost,
  onlineList, startTyping, stopTyping,
  typingIn, getDevUids,
};
