/**
 * In-memory presence tracker.
 * uid → Set<socketId>
 * socketId → { uid, token }
 */

const _byUid   = new Map(); // uid  → Set<sid>
const _bySid   = new Map(); // sid  → { uid, token }
const _typing  = new Map(); // roomId → Set<uid>

function connect(sid, uid, token) {
  _bySid.set(sid, { uid, token });
  if (!_byUid.has(uid)) _byUid.set(uid, new Set());
  _byUid.get(uid).add(sid);
}

function disconnect(sid) {
  const info = _bySid.get(sid);
  if (!info) return null;
  _bySid.delete(sid);
  const sids = _byUid.get(info.uid);
  if (sids) {
    sids.delete(sid);
    if (sids.size === 0) {
      _byUid.delete(info.uid);
      return info.uid; // fully offline
    }
  }
  return null; // still has other connections
}

function isOnline(uid)    { return _byUid.has(uid) && _byUid.get(uid).size > 0; }
function onlineList()     { return [..._byUid.keys()]; }
function infoForSid(sid)  { return _bySid.get(sid) || null; }
function tokenForSid(sid) { return _bySid.get(sid)?.token || null; }

function startTyping(roomId, uid) {
  if (!_typing.has(roomId)) _typing.set(roomId, new Set());
  _typing.get(roomId).add(uid);
}

function stopTyping(roomId, uid) {
  _typing.get(roomId)?.delete(uid);
}

function typingIn(roomId) {
  return [...(_typing.get(roomId) || [])];
}

module.exports = {
  connect, disconnect,
  isOnline, onlineList, infoForSid, tokenForSid,
  startTyping, stopTyping, typingIn,
};