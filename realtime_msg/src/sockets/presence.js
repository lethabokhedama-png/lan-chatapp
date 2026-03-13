// In-memory presence tracker
// Maps socketId -> uid and uid -> Set of socketIds (multi-tab support)

const sidToUid = new Map();   // socketId -> uid
const uidToSids = new Map();  // uid -> Set<socketId>
const typingMap = new Map();  // roomId -> Set<uid>

function connect(sid, uid) {
  sidToUid.set(sid, uid);
  if (!uidToSids.has(uid)) uidToSids.set(uid, new Set());
  uidToSids.get(uid).add(sid);
}

// Returns uid if they fully went offline, null if they have other sockets
function disconnect(sid) {
  const uid = sidToUid.get(sid);
  if (!uid) return null;
  sidToUid.delete(sid);
  const sids = uidToSids.get(uid);
  if (sids) {
    sids.delete(sid);
    if (sids.size === 0) {
      uidToSids.delete(uid);
      return uid; // fully offline
    }
  }
  return null; // still has other connections
}

function onlineList() {
  return Array.from(uidToSids.keys());
}

function isOnline(uid) {
  return uidToSids.has(uid) && uidToSids.get(uid).size > 0;
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
