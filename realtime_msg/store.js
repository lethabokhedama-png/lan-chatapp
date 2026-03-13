import { create } from "zustand";

const useStore = create((set, get) => ({
  // Auth
  user:  null,
  token: null,
  setAuth:   (user, token) => set({ user, token }),
  clearAuth: () => set({ user: null, token: null, activeRoom: null }),

  // Rooms
  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  activeRoom: null,
  setActiveRoom: (room) => set({ activeRoom: room }),

  // Users
  userMap: {},
  setUserMap: (users) => {
    const map = {};
    users.forEach(u => { map[u.id] = u; });
    set({ userMap: map });
  },

  // Messages
  messages: {},
  setMessages: (roomId, msgs) =>
    set(s => ({ messages: { ...s.messages, [roomId]: msgs } })),
  prependMessages: (roomId, msgs) =>
    set(s => ({ messages: { ...s.messages, [roomId]: [...msgs, ...(s.messages[roomId] || [])] } })),
  appendMessage: (roomId, msg) =>
    set(s => {
      const existing = s.messages[roomId] || [];
      const deduped  = existing.filter(m =>
        !(m._optimistic && m.client_id && m.client_id === msg.client_id) && m.id !== msg.id
      );
      return { messages: { ...s.messages, [roomId]: [...deduped, msg] } };
    }),
  updateMessage: (roomId, msg) =>
    set(s => ({
      messages: {
        ...s.messages,
        [roomId]: (s.messages[roomId] || []).map(m => m.id === msg.id ? msg : m),
      },
    })),
  removeMessage: (roomId, msgId) =>
    set(s => ({
      messages: {
        ...s.messages,
        [roomId]: (s.messages[roomId] || []).filter(m => m.id !== msgId),
      },
    })),

  // Presence
  onlineSet: new Set(),
  setOnline: (uid) => set(s => { const n = new Set(s.onlineSet); n.add(uid);    return { onlineSet: n }; }),
  setOffline:(uid) => set(s => { const n = new Set(s.onlineSet); n.delete(uid); return { onlineSet: n }; }),
  setOnlineList: (uids) => set({ onlineSet: new Set(uids) }),

  // Typing
  typing: {},
  setTyping: (roomId, uids) =>
    set(s => ({ typing: { ...s.typing, [roomId]: uids } })),

  // Unread
  unread: {},
  addUnread: (roomId) =>
    set(s => ({ unread: { ...s.unread, [roomId]: (s.unread[roomId] || 0) + 1 } })),
  clearUnread: (roomId) =>
    set(s => ({ unread: { ...s.unread, [roomId]: 0 } })),

  // Reply
  replyTo: null,
  setReplyTo: (msg) => set({ replyTo: msg }),

  // Profile panel
  profilePanel: null,
  setProfilePanel: (user) => set({ profilePanel: user }),

  // Settings
  settingsOpen: false,
  settingsPage: "account",
  openSettings:  (page = "account") => set({ settingsOpen: true,  settingsPage: page }),
  closeSettings: () => set({ settingsOpen: false }),

  // Sidebar (mobile)
  sidebarOpen: false,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar:  () => set({ sidebarOpen: false }),

  // Prefs
  prefs: {},
  setPrefs: (prefs) => set({ prefs }),
}));

export default useStore;
