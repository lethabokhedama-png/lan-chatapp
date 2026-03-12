/**
 * Global state — Zustand store.
 * All UI state lives here; components subscribe via useStore().
 */
import { create } from "zustand";

const useStore = create((set, get) => ({
  // ── Auth ────────────────────────────────────────────────────────────────────
  user:       null,
  token:      localStorage.getItem("lc_token") || null,
  flags:      {},

  setAuth: (user, token) => {
    set({ user, token });
  },
  setFlags: (flags) => set({ flags }),
  clearAuth: () => set({ user: null, token: null }),

  // ── Rooms ───────────────────────────────────────────────────────────────────
  rooms:       [],        // [{...meta, _my: {...}}]
  activeRoom:  null,      // room object

  setRooms:      (rooms)  => set({ rooms }),
  setActiveRoom: (room)   => set({ activeRoom: room }),
  updateRoom: (roomId, patch) => set((s) => ({
    rooms: s.rooms.map(r => r.id === roomId ? { ...r, ...patch } : r),
    activeRoom: s.activeRoom?.id === roomId ? { ...s.activeRoom, ...patch } : s.activeRoom,
  })),

  // ── Users ───────────────────────────────────────────────────────────────────
  userMap:    {},         // uid → profile
  onlineSet:  new Set(),

  setUsers: (list) => set({ userMap: Object.fromEntries(list.map(u => [u.id, u])) }),
  setOnline: (uids) => set({ onlineSet: new Set(uids) }),
  setUserOnline:  (uid) => set((s) => ({ onlineSet: new Set([...s.onlineSet, uid]) })),
  setUserOffline: (uid) => set((s) => {
    const next = new Set(s.onlineSet);
    next.delete(uid);
    return { onlineSet: next };
  }),

  // ── Messages ─────────────────────────────────────────────────────────────────
  messages:   {},         // roomId → Message[]
  unread:     {},         // roomId → count
  typing:     {},         // roomId → uid[]

  setMessages: (roomId, msgs) => set((s) => ({
    messages: { ...s.messages, [roomId]: msgs },
  })),
  prependMessages: (roomId, older) => set((s) => {
    const existing = s.messages[roomId] || [];
    const ids = new Set(existing.map(m => m.id));
    return {
      messages: {
        ...s.messages,
        [roomId]: [...older.filter(m => !ids.has(m.id)), ...existing],
      },
    };
  }),
  appendMessage: (roomId, msg) => set((s) => {
    const existing = s.messages[roomId] || [];
    if (existing.find(m => m.id === msg.id || m.client_id === msg.client_id)) {
      // Replace optimistic bubble
      return {
        messages: {
          ...s.messages,
          [roomId]: existing.map(m =>
            (m.client_id && m.client_id === msg.client_id) ? msg : m
          ),
        },
      };
    }
    return {
      messages: { ...s.messages, [roomId]: [...existing, msg] },
    };
  }),
  updateMessage: (roomId, updated) => set((s) => ({
    messages: {
      ...s.messages,
      [roomId]: (s.messages[roomId] || []).map(m => m.id === updated.id ? { ...m, ...updated } : m),
    },
  })),

  incUnread:   (roomId) => set((s) => ({ unread: { ...s.unread, [roomId]: (s.unread[roomId] || 0) + 1 } })),
  clearUnread: (roomId) => set((s) => ({ unread: { ...s.unread, [roomId]: 0 } })),

  setTyping: (roomId, uids) => set((s) => ({ typing: { ...s.typing, [roomId]: uids } })),

  // ── Settings panel ───────────────────────────────────────────────────────────
  settingsOpen: false,
  settingsPage: "account",
  openSettings:  (page = "account") => set({ settingsOpen: true,  settingsPage: page }),
  closeSettings: ()                  => set({ settingsOpen: false }),

  // ── UI ───────────────────────────────────────────────────────────────────────
  sidebarOpen:  false,
  profilePanel: null,    // user object or null
  replyTo:      null,    // message object or null
  searchOpen:   false,

  toggleSidebar: ()        => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setProfilePanel: (user)  => set({ profilePanel: user }),
  setReplyTo:    (msg)     => set({ replyTo: msg }),
  toggleSearch:  ()        => set((s) => ({ searchOpen: !s.searchOpen })),

  // ── Prefs + Theme (client-side mirror) ───────────────────────────────────────
  prefs:   {},
  privacy: {},
  theme:   { mode: "system", palette: "default" },

  setPrefs:   (p) => set({ prefs: p }),
  setPrivacy: (p) => set({ privacy: p }),
  setTheme:   (t) => set({ theme: t }),
}));

export default useStore;