/**
 * DataHandling HTTP client.
 * All calls go to /api/* — Vite proxies to localhost:8000 in dev,
 * so in production point VITE_API_URL to the server's IP:8000.
 */
const BASE = import.meta.env.VITE_API_URL || "http://192.168.101.110:8000";

let _token = localStorage.getItem("lc_token") || null;

export const setToken  = (t) => { _token = t; localStorage.setItem("lc_token", t); };
export const clearToken= ()  => { _token = null; localStorage.removeItem("lc_token"); };
export const getToken  = ()  => _token;

async function req(method, path, body, isForm = false) {
  const headers = {};
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  if (!isForm && body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data   = data;
    throw err;
  }
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export const auth = {
  signup:  (d) => req("POST", "/api/auth/signup", d),
  login:   (d) => req("POST", "/api/auth/login",  d),
  me:      ()  => req("GET",  "/api/auth/me"),
  logout:  ()  => req("POST", "/api/auth/logout"),
};

// ── Users ──────────────────────────────────────────────────────────────────────
export const users = {
  list:         ()  => req("GET",   "/api/users/"),
  get:          (id)=> req("GET",   `/api/users/${id}`),
  patchProfile: (d) => req("PATCH", "/api/users/me/profile",  d),
  getPrefs:     ()  => req("GET",   "/api/users/me/prefs"),
  patchPrefs:   (d) => req("PATCH", "/api/users/me/prefs",    d),
  getPrivacy:   ()  => req("GET",   "/api/users/me/privacy"),
  patchPrivacy: (d) => req("PATCH", "/api/users/me/privacy",  d),
  getTheme:     ()  => req("GET",   "/api/users/me/theme"),
  patchTheme:   (d) => req("PATCH", "/api/users/me/theme",    d),
  setStatus:    (s) => req("POST",  "/api/users/me/status",   { status: s }),
};

// ── Rooms ──────────────────────────────────────────────────────────────────────
export const rooms = {
  list:          ()    => req("GET",   "/api/rooms/"),
  mine:          ()    => req("GET",   "/api/rooms/mine"),
  get:           (id)  => req("GET",   `/api/rooms/${id}`),
  createChannel: (d)   => req("POST",  "/api/rooms/group", d),
  createDm:      (d)   => req("POST",  "/api/rooms/dm",      d),
  join:          (id)  => req("POST",  `/api/rooms/${id}/join`),
  leave:         (id)  => req("POST",  `/api/rooms/${id}/leave`),
  patchMeta:     (id,d)=> req("PATCH", `/api/rooms/${id}/meta`, d),
  getPins:       (id)  => req("GET",   `/api/rooms/${id}/pins`),
  pin:           (id,msgId) => req("POST",   `/api/rooms/${id}/pins`, { message_id: msgId }),
  unpin:         (id,msgId) => req("DELETE", `/api/rooms/${id}/pins/${msgId}`),
};

// ── Messages ───────────────────────────────────────────────────────────────────
export const messages = {
  fetch:     (roomId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req("GET", `/api/messages/${roomId}${q ? "?" + q : ""}`);
  },
  search:    (roomId, q)   => req("GET",    `/api/messages/${roomId}/search?q=${encodeURIComponent(q)}`),
  edit:      (roomId, id, d)=> req("PATCH",  `/api/messages/${roomId}/${id}`, d),
  remove:    (roomId, id)  => req("DELETE",  `/api/messages/${roomId}/${id}`),
  delivered: (roomId, id)  => req("POST",    `/api/messages/${roomId}/${id}/delivered`),
  seen:      (roomId, id)  => req("POST",    `/api/messages/${roomId}/${id}/seen`),
};

// ── Uploads ────────────────────────────────────────────────────────────────────
export const uploads = {
  upload: (file, roomId) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("room_id", roomId);
    return req("POST", "/api/uploads/", fd, true);
  },
  url: (fileId) => `${BASE}/api/uploads/${fileId}`,
};

// ── Dev flags ──────────────────────────────────────────────────────────────────
export const dev = {
  flags:    ()  => req("GET",   "/api/dev/flags"),
  allFlags: ()  => req("GET",   "/api/dev/flags/all"),
  patch:    (d) => req("PATCH", "/api/dev/flags", d),
};
