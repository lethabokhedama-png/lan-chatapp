# ⬡ LAN Chat

> A fully-featured local network messenger built entirely on Android using Termux.  
> No internet required. No cloud. No third parties. Everything stays on your network.

**Author:** LethaboK  
**Version:** v1.5.0  
**License:** Proprietary — see [LICENSE](LICENSE)  
**Repository:** https://github.com/lethabokhedama-png/lan-chatapp

---

## Table of Contents

1. [What is LAN Chat?](#what-is-lan-chat)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Requirements](#requirements)
5. [Installation](#installation)
6. [Starting the App](#starting-the-app)
7. [Changing Networks / IP](#changing-networks--ip)
8. [User Guide](#user-guide)
9. [Dev Account](#dev-account)
10. [Dev Panel](#dev-panel)
11. [Feature Flags](#feature-flags)
12. [File Structure](#file-structure)
13. [DATA Directory](#data-directory)
14. [API Reference](#api-reference)
15. [Socket Events](#socket-events)
16. [Themes](#themes)
17. [Building an APK](#building-an-apk)
18. [Troubleshooting](#troubleshooting)
19. [Changelog](#changelog)
20. [License](#license)

---

## What is LAN Chat?

LAN Chat is a real-time messaging application that runs entirely on your local WiFi or mobile hotspot. It was built and runs on an Android phone using Termux — no PC, no cloud services, no internet connection needed at all.

Anyone connected to the same WiFi or hotspot can open the app in their browser and start chatting immediately.

**Why LAN Chat?**
- Privacy — messages never leave your network
- Speed — no internet latency, everything is local
- Control — you own the server, the data, everything
- Works offline — hotspot is all you need

---

## Features

### Messaging
- ✅ Real-time direct messages (DM)
- ✅ Group chats with @mentions
- ✅ Message replies with quote preview (tap to scroll to original)
- ✅ Message reactions (👍 ❤️ 😂 😮 😢 🙏 🔥 🎉 👀)
- ✅ Edit messages
- ✅ Delete messages (shows "Message deleted")
- ✅ Forward messages
- ✅ Pin messages
- ✅ Copy message text
- ✅ Message search within a chat
- ✅ System messages `[system]` — grey italic monospace, distinct from regular messages

### Media
- ✅ File attachments
- ✅ Image sharing (tap to fullscreen)
- ✅ Voice notes (up to 5 minutes, hold to record)
- ✅ Disappearing photos — 1x view or 2x view (Instagram style)

### Status & Presence
- ✅ Online/offline indicators in real-time
- ✅ Typing indicators — "💬 User is typing…"
- ✅ iMessage-style message status (Sending → Sent → Delivered → Read)
- ✅ "Read" label on latest seen message
- ✅ Seen disappears when recipient starts typing

### Notifications
- ✅ In-app notification banners with animated progress bar
- ✅ Browser notifications when app is in background
- ✅ Notification sound (rhea.mp3)
- ✅ Unread badge counts on sidebar and bottom nav

### UI & Themes
- ✅ 12 themes: Dark, Darker, Neon Purple, Vampire, WhatsApp, Light, Cyberpunk, Deep Sea, Instagram, Forest, Rose, Midnight
- ✅ All theme colors apply globally — every element changes
- ✅ Bottom navigation bar on mobile (Home, Messages, Groups, Online, Settings)
- ✅ Sidebar on desktop
- ✅ Smooth loading screen with progress bar on startup
- ✅ Permissions prompt on first launch (microphone + notifications)
- ✅ PWA manifest — add to home screen for app-like experience

### Account
- ✅ Sign up / log in
- ✅ Display name, bio, phone number, avatar color picker
- ✅ Change password
- ✅ Settings with horizontal tabs

### Dev / Admin
- ✅ Dev account (`lethabok`) with special access
- ✅ Dev panel — stats, user management, flag toggles, live logs, system messages
- ✅ Feature flags in `DATA/dev/flags.json`
- ✅ Smart reply learning — learns from your chat patterns
- ✅ Context-aware reply suggestions

---

## Architecture

LAN Chat runs as 3 separate services:

```
┌─────────────────┐     HTTP/REST      ┌──────────────────────┐
│                 │◄──────────────────►│                      │
│    Frontend     │                    │   data_handling      │
│  React + Vite   │                    │   Python Flask       │
│  Port: 5173     │                    │   Port: 8000         │
│                 │                    │                      │
└────────┬────────┘                    └──────────────────────┘
         │                                        │
         │  WebSocket                             │ reads/writes
         │                             ┌──────────▼──────────┐
         ▼                             │                      │
┌─────────────────┐                    │       DATA/          │
│                 │    HTTP to API     │   JSON file store    │
│  realtime_msg   │◄──────────────────►│                      │
│  Node.js +      │                    └──────────────────────┘
│  Socket.IO      │
│  Port: 6767     │
└─────────────────┘
```

### How it works
1. **data_handling** is the source of truth — all reads/writes go through it
2. **realtime_msg** handles WebSocket connections, verifies tokens, proxies message saves to data_handling, then broadcasts to all connected clients
3. **Frontend** is a built React app served as static files

### Authentication
Tokens are HMAC-SHA256 signed JWTs (no external library). The secret key is auto-generated on first boot and stored at `DATA/secret.key`. Both data_handling and realtime_msg read from the same file — no manual configuration needed.

---

## Requirements

- Android phone with Termux installed
- Termux packages: `python`, `nodejs`, `git`
- Python packages: `flask`, `flask-cors`
- Node packages: installed via `npm install` in each service

---

## Installation

```bash
# 1. Clone the repo
git clone https://github.com/lethabokhedama-png/lan-chatapp.git
cd lan-chatapp

# 2. Install Python dependencies
cd data_handling
pip install flask flask-cors --break-system-packages
cd ..

# 3. Install Node dependencies
cd realtime_msg && npm install && cd ..
cd frontend && npm install && npm install -g serve && cd ..
```

---

## Starting the App

### Option 1 — Auto start (recommended)
```bash
bash ~/chatapp/start.sh
```
This script:
- Auto-detects your current IP address
- Updates `frontend/.env` with the correct IP
- Builds the frontend
- Tells you exactly what to run in each session

### Option 2 — Manual (3 Termux sessions)

**Session 1 — Data API** (start this first)
```bash
cd ~/chatapp/data_handling
python app.py
```

**Session 2 — Realtime Server** (after Session 1 is running)
```bash
cd ~/chatapp/realtime_msg
npm start
```

**Session 3 — Frontend**
```bash
cd ~/chatapp/frontend
serve -s dist -l 5173
```

Then open `http://<YOUR_IP>:5173` in Chrome on any device on the same network.

### Startup Order
The order matters:
1. `data_handling` must start first — it generates `DATA/secret.key`
2. `realtime_msg` reads `secret.key` on startup (waits up to 30s)
3. `frontend` can start at any time

---

## Changing Networks / IP

Every time you switch WiFi networks or restart your hotspot, your IP changes. Run:

```bash
bash ~/chatapp/detect-ip.sh
```

Then rebuild the frontend:
```bash
cd ~/chatapp/frontend && npm start
```

Or just run `bash ~/chatapp/start.sh` which does both automatically.

---

## User Guide

### First time
1. Open `http://<IP>:5173` in Chrome
2. Allow microphone and notification permissions
3. Tap **Sign Up** and create your account
4. You'll land on the Home screen

### Sending a DM
1. From Home, tap any user in the online/offline list
2. Or tap **+** next to Messages in the sidebar
3. Type your message and tap Send (or press Enter)

### Creating a Group
1. Tap **+** next to Groups in the sidebar
2. Enter a group name and optional description
3. Members can join from their sidebar

### Voice notes
1. Tap the microphone icon in the message bar
2. Tap the red button to start recording
3. Tap Stop when done, then preview or send

### Disappearing photos
1. Tap the camera icon in the message bar
2. Choose 1× view or 2× view
3. Select a photo — recipient sees a "Tap to view" button
4. Photo disappears after the allowed number of views

### Reactions
Long press any message → tap an emoji to react

### Reply
Long press a message → tap Reply
The quoted message appears above your reply. Tap the quote to scroll to the original.

---

## Dev Account

Username: `lethabok`  
Password: `P@55word`  
Role: `dev`

The dev account gets a "Dev Panel" option in the account popover (bottom of sidebar). This panel is only visible to this account.

---

## Dev Panel

Access: tap your name at the bottom of the sidebar → Dev Panel

### Stats Tab
- Server status, version, uptime
- Total users, currently online count
- Room count
- Live list of who is online right now

### Users Tab
- All registered users with online status
- Delete any user (except yourself)

### Flags Tab
- Toggle every feature flag on/off
- Changes apply immediately to all users
- Non-boolean flags (like limits) shown as read-only values

### Logs Tab
- Last 100 server log entries
- Color coded: green = info, yellow = auth, red = error
- Refresh button to reload

### System Messages Tab
- Send a message to all rooms or a specific room
- Message appears in grey italic monospace with ⚙ prefix
- Quick command buttons for common announcements

---

## Feature Flags

Stored in `DATA/dev/flags.json`. Edit directly or use the Dev Panel.

| Flag | Default | Description |
|------|---------|-------------|
| `smart_replies` | `true` | Show contextual reply suggestions |
| `voice_notes` | `true` | Enable voice note recording |
| `disappearing_photos` | `true` | Enable 1x/2x view photos |
| `read_receipts` | `true` | Show Delivered/Read status |
| `typing_indicators` | `true` | Show typing animation |
| `online_presence` | `true` | Show online/offline status |
| `group_mentions` | `true` | @mentions in group chats |
| `dev_panel` | `true` | Show dev panel for dev account |
| `one_time_view` | `true` | 1x view disappearing photos |
| `two_time_view` | `true` | 2x view disappearing photos |
| `max_voice_seconds` | `300` | Max voice note length (seconds) |
| `max_upload_mb` | `10` | Max file upload size |
| `max_group_members` | `50` | Max members per group |
| `maintenance_mode` | `false` | Block all logins |
| `registration_open` | `true` | Allow new signups |

---

## File Structure

```
chatapp/
├── data_handling/          # Python Flask API
│   ├── app.py              # Entry point
│   ├── config.py           # Settings
│   ├── app/
│   │   ├── auth.py         # /api/auth/*
│   │   ├── users.py        # /api/users/*
│   │   ├── rooms.py        # /api/rooms/*
│   │   ├── messages.py     # /api/messages/*
│   │   ├── uploads.py      # /api/uploads/*
│   │   ├── events.py       # /api/events/*
│   │   ├── dev.py          # /api/dev/* + dev account + flags
│   │   └── middleware.py   # @require_auth decorator
│   └── utils/
│       ├── store.py        # JSON read/write helpers
│       ├── ids.py          # ID generation + index lookup
│       ├── auth_helpers.py # HMAC token + password hashing
│       ├── secret.py       # Auto-generate DATA/secret.key
│       ├── shard.py        # Monthly message sharding
│       ├── audit.py        # Append-only audit log
│       ├── user_fs.py      # Per-user file operations
│       └── ip_ledger.py    # IP access history
│
├── realtime_msg/           # Node.js + Socket.IO
│   └── src/
│       ├── server.js       # Reads secret.key, starts Socket.IO
│       ├── config.js       # DATA_PATH, ports
│       ├── middleware/
│       │   └── auth.js     # Token verification (mirrors Python)
│       ├── sockets/
│       │   ├── handlers.js # All socket events + debug logging
│       │   └── presence.js # Online/typing tracker
│       └── utils/
│           └── dataApi.js  # Axios client for data_handling
│
├── frontend/               # React + Vite
│   ├── src/
│   │   ├── App.jsx         # Root — socket setup, auth restore
│   │   ├── Loader.jsx      # Loading screen with progress bar
│   │   ├── Permissions.jsx # First-launch permission prompt
│   │   ├── pages/
│   │   │   ├── AuthPage.jsx    # Login / signup
│   │   │   └── ChatPage.jsx    # Main chat layout
│   │   ├── features/
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.jsx       # Full chat UI
│   │   │   │   ├── MessageBubble.jsx    # Single message
│   │   │   │   ├── MessageMenu.jsx      # Long press context menu
│   │   │   │   ├── SmartReplies.jsx     # Reply suggestions
│   │   │   │   ├── TypingIndicator.jsx  # Typing animation
│   │   │   │   ├── VoiceRecorder.jsx    # Record voice notes
│   │   │   │   ├── VoicePlayer.jsx      # Play voice notes
│   │   │   │   └── DisappearingPhoto.jsx# 1x/2x view photos
│   │   │   ├── settings/
│   │   │   │   └── SettingsModal.jsx    # Settings with tabs
│   │   │   └── dev/
│   │   │       └── DevPanel.jsx         # Dev-only panel
│   │   ├── ui/
│   │   │   ├── Sidebar.jsx   # Desktop sidebar + nav
│   │   │   ├── BottomNav.jsx # Mobile bottom navigation
│   │   │   ├── Avatar.jsx    # User avatar component
│   │   │   ├── Modal.jsx     # Generic modal wrapper
│   │   │   └── Toast.jsx     # Notifications + toasts
│   │   ├── lib/
│   │   │   ├── api.js        # All HTTP calls
│   │   │   ├── socket.js     # Socket.IO client
│   │   │   └── store.js      # Zustand global state
│   │   └── styles/
│   │       ├── variables.css # CSS tokens + 12 themes
│   │       └── main.css      # Full app styles
│   └── public/
│       ├── favicon.svg
│       ├── manifest.json    # PWA manifest
│       └── rhea.mp3         # Notification sound
│
├── DATA/                   # All app data (never commit this)
│   ├── index.json          # Global registry
│   ├── secret.key          # HMAC signing key (auto-generated)
│   ├── common_replies.json # Learned smart replies
│   ├── dev/
│   │   └── flags.json      # Feature flags
│   ├── users/              # Per-user data
│   ├── rooms/              # Room messages + metadata
│   ├── uploads/            # Files, voice, photos
│   └── user_log/           # Audit logs
│
├── detect-ip.sh            # Auto-detect IP + update .env
├── start.sh                # One-command startup helper
├── LICENSE                 # Proprietary license
└── README.md               # This file
```

---

## DATA Directory

All data is stored as JSON files. No database required.

### index.json
Global registry. Contains:
- `users_by_id` — uid → { username, display_name, dir }
- `users_by_username` — username → uid
- `rooms_by_id` — room_id → { name, type }
- `counters` — auto-increment counters

### User directory structure
```
DATA/users/<username>_<uid>/
├── profile.json    # Display name, bio, role, avatar
├── prefs.json      # User preferences
├── privacy.json    # Privacy settings
├── rooms.json      # Rooms the user is in
└── receipts.json   # Message read receipts
```

### Room directory structure
```
DATA/rooms/<room_id>/
├── meta.json       # Room name, type, topic
├── members.json    # Member list with roles
├── pins.json       # Pinned message IDs
└── messages/
    └── YYYY-MM.json  # Monthly message shards
```

---

## API Reference

All endpoints require `Authorization: Bearer <token>` unless marked public.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Get token |
| GET  | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Invalidate session |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/` | List all users |
| GET | `/api/users/<uid>` | Get user profile |
| PATCH | `/api/users/me` | Update own profile |
| GET | `/api/users/me/prefs` | Get preferences |
| GET | `/api/users/me/theme` | Get theme |
| PATCH | `/api/users/me/theme` | Save theme |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms/mine` | Get my rooms |
| POST | `/api/rooms/dm` | Create/get DM |
| POST | `/api/rooms/group` | Create group |
| GET | `/api/rooms/<id>/meta` | Room metadata |
| POST | `/api/rooms/<id>/join` | Join room |
| POST | `/api/rooms/<id>/pins` | Pin a message |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages/<room_id>` | Fetch messages |
| POST | `/api/messages/<room_id>` | Send message |
| PATCH | `/api/messages/<room_id>/<id>` | Edit message |
| DELETE | `/api/messages/<room_id>/<id>` | Delete message |
| POST | `/api/messages/<room_id>/<id>/seen` | Mark seen |
| POST | `/api/messages/<room_id>/<id>/delivered` | Mark delivered |

### Uploads
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/uploads/file` | Upload file |
| POST | `/api/uploads/voice` | Upload voice note |
| POST | `/api/uploads/photo` | Upload disappearing photo |
| GET | `/api/uploads/serve/<path>` | Serve file |

### Dev (dev account only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dev/flags` | Get feature flags |
| PATCH | `/api/dev/flags` | Update flags |
| GET | `/api/dev/users` | All users (admin view) |
| GET | `/api/dev/smart-replies` | Get reply suggestions |
| POST | `/api/dev/learn-reply` | Record reply pattern |

---

## Socket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `room:join` | `{ roomId }` | Join a room |
| `room:leave` | `{ roomId }` | Leave a room |
| `msg:send` | `{ roomId, content, type, replyTo, clientId }` | Send message |
| `msg:edit` | `{ roomId, msgId, content }` | Edit message |
| `msg:delete` | `{ roomId, msgId }` | Delete message |
| `msg:seen` | `{ roomId, msgId }` | Mark as seen |
| `msg:delivered` | `{ roomId, msgId }` | Mark as delivered |
| `msg:react` | `{ roomId, msgId, emoji }` | React to message |
| `typing:start` | `{ roomId }` | Start typing |
| `typing:stop` | `{ roomId }` | Stop typing |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `presence:list` | `{ online: [uid] }` | Who's online on connect |
| `presence:update` | `{ uid, status }` | User came online/offline |
| `msg:new` | message object | New message in a room |
| `msg:edited` | message object | Message was edited |
| `msg:deleted` | `{ roomId, msgId }` | Message was deleted |
| `msg:receipt` | `{ roomId, msgId, type, uid }` | Delivery/read receipt |
| `typing:update` | `{ roomId, typing: [uid] }` | Who's typing |

---

## Themes

| ID | Name | Accent | Background |
|----|------|--------|------------|
| `dark` | Dark | Blue | #0d0f14 |
| `darker` | Darker | Purple | #050608 |
| `neon-purple` | Neon Purple | #c060ff | #0a0612 |
| `vampire` | Vampire | #e02040 | #0e0608 |
| `whatsapp` | WhatsApp | #25d366 | #0a120e |
| `light` | Light | Blue | #f0f2f8 |
| `cyberpunk` | Cyberpunk | #f0f000 | #0a0a06 |
| `deepsea` | Deep Sea | #0090ff | #060e18 |
| `instagram` | Instagram | #e1306c | #0a080e |
| `forest` | Forest | #4ec871 | #0a1008 |
| `rose` | Rose | #f76f8e | #12080e |
| `midnight` | Midnight | Blue | #0a0e1a |

Change theme: tap your name → Settings → Appearance

---

## Building an APK

LAN Chat supports being compiled into a real Android APK using Capacitor.

### Step 1 — Install Capacitor
```bash
cd ~/chatapp/frontend
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### Step 2 — Initialize
```bash
npx cap init "LAN Chat" "com.lethabok.lanchat" --web-dir dist
npx cap add android
```

### Step 3 — Build and sync
```bash
npm run build
npx cap sync
```

### Step 4 — Build APK
Option A — using GitHub Actions (automated, recommended):
Push to GitHub and the workflow builds the APK automatically.

Option B — using Android Studio on a PC:
Copy the `android/` folder to a PC with Android Studio, open the project and build.

### PWA alternative (instant, no compilation)
1. Open the app in Chrome
2. Tap the 3-dot menu → Add to Home Screen
3. The app installs with its own icon and runs fullscreen

---

## Troubleshooting

### "Failed to fetch" on login
Your IP changed. Run `bash ~/chatapp/detect-ip.sh` then rebuild.

### realtime_msg says "invalid token"
The secret.key was regenerated (happens when DATA/ is deleted). Log out in the browser and log back in to get a fresh token.

### Port already in use
```bash
fuser -k 8000/tcp  # kill data_handling
fuser -k 6767/tcp  # kill realtime_msg
fuser -k 5173/tcp  # kill frontend
```

### DATA/ is empty after restart
Normal — DATA/ is created on first `python app.py` run. It persists between restarts unless manually deleted.

### Frontend build fails
```bash
cd ~/chatapp/frontend
rm -rf node_modules dist
npm install
npm start
```

### Can't access from another device
- Make sure both devices are on the same WiFi/hotspot
- The other device must use the hotspot host's IP (shown in `python app.py` output)
- Check that no firewall is blocking ports 5173, 8000, 6767

---

## Changelog

### v1.5.0 — Current
- Voice notes (up to 5 minutes)
- Disappearing photos (1x and 2x view)
- Dev panel (stats, logs, flags, system messages, user management)
- Feature flags system
- Auto IP detection script
- Loading screen with progress bar
- Permissions prompt on first launch
- iMessage-style message status (Sent / Delivered / Read)
- Notification banners with animated progress bar drain
- Notification sound support
- PWA manifest
- Capacitor APK setup

### v1.4.0
- Reply system with quote bubble (tap to scroll)
- @mentions in groups with notification
- Typing indicator "💬 User is typing…"
- Seen label on latest message
- Colored dot receipts
- Smart reply suggestions (learned + context-aware)
- Reaction system

### v1.3.0
- 12 themes with full app color switching
- Horizontal settings tabs
- Account fields: bio, phone, avatar color, change password
- About page with LethaboK credits
- Proprietary license

### v1.2.0
- Feather icons throughout
- SVG favicon
- Popover account menu
- Settings redesign
- Group creation
- DM labels with display name + @username

### v1.1.0
- Mobile layout fixed (sticky input, 100dvh)
- Build + serve workflow (replaces Vite dev server)
- Auto secret.key generation
- Debug logging in realtime_msg
- Hamburger menu for mobile

### v1.0.0
- Initial release
- Auth (signup/login with HMAC tokens)
- Real-time DMs via Socket.IO
- Presence (online/offline)
- Message history
- Basic themes

---

## License

Copyright © 2026 LethaboK. All rights reserved.

This software is proprietary. Unauthorized copying, modification, distribution, or use is strictly prohibited. See [LICENSE](LICENSE) for full terms.

Built with ❤️ on Android using Termux.
