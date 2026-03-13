const sidToUid  = new Map();
const uidToData = new Map(); // uid -> { sids: Set, username }
const typingMap = new Map();

function connect(sid, uid, username, token) {
  sidToUid.set(sid, uid);
  if (!uidToData.has(uid)) uidToData.set(uid, { sids: new Set(), username });
  uidToData.get(uid).sids.add(sid);
  uidToData.get(uid).username = username;
}

function disconnect(sid) {
  const uid = sidToUid.get(sid);
  if (!uid) return null;
  sidToUid.delete(sid);
  const data = uidToData.get(uid);
  if (data) {
    data.sids.delete(sid);
    if (data.sids.size === 0) {
      uidToData.delete(uid);
      return uid;
    }
  }
  return null;
}

function onlineList() {
  return Array.from(uidToData.entries()).map(([uid, d]) => ({
    uid, username: d.username,
  }));
}

function isOnline(uid) {
  return uidToData.has(uid) && uidToData.get(uid).sids.size > 0;
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

module.exports = { connect, disconnect, onlineList, isOnline, startTyping, stopTyping, typingIn };
