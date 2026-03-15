# ⬡ LAN Chat

> A fully-featured private messenger that runs entirely on your local WiFi or mobile hotspot.
> Built and hosted on an Android phone using Termux. No internet. No cloud. No third parties.

**Author:** Lethabo Khedama (LethaboK)
**Version:** v1.7.17
**License:** Proprietary — see [LICENSE](LICENSE)
**Repository:** https://github.com/lethabokhedama-png/lan-chatapp

---

## Table of Contents

1. [What is LAN Chat](#what-is-lan-chat)
2. [How it works](#how-it-works)
3. [Features](#features)
4. [Requirements](#requirements)
5. [Installation](#installation)
6. [Starting the app](#starting-the-app)
7. [Connecting other devices](#connecting-other-devices)
8. [User guide](#user-guide)
9. [Dev account](#dev-account)
10. [Dev panel](#dev-panel)
11. [Console commands](#console-commands)
12. [Feature flags](#feature-flags)
13. [File structure](#file-structure)
14. [API reference](#api-reference)
15. [Socket events](#socket-events)
16. [Themes](#themes)
17. [Building an APK](#building-an-apk)
18. [Troubleshooting](#troubleshooting)
19. [Changelog](#changelog)

---

## What is LAN Chat

LAN Chat is a real-time messaging app that runs on your phone and is accessible to anyone on the same WiFi or hotspot. No accounts with third parties, no data leaving the network, no subscription fees. Everything lives on the phone running Termux.

---

## How it works

Three services run simultaneously on the host phone:

```
Browser (any device)
       │
       │  HTTPS :5173
       ▼
  Frontend (React)          ← static files served by Node HTTPS server
       │
       ├── REST API calls ──► HTTPS Proxy :8443 ──► Flask API :8000
       │                                             (reads/writes DATA/)
       └── WebSocket ───────► HTTPS Proxy :6443 ──► Socket.IO :6767
                                                     (realtime events)
```

**Why proxies?** Browsers block HTTP calls from HTTPS pages (called "mixed content"). Since the frontend is served over HTTPS (required for microphone permissions on Android Chrome), all backend calls must also be HTTPS. The proxies are tiny Node.js servers that accept HTTPS connections and forward them to the plain HTTP backends.

---

## Features

### Messaging
- Real-time direct messages and group chats
- Message replies with quote bubble — tap to scroll to original
- Reactions — double tap a message for emoji row, or use long press menu
- Swipe right on a received message to quick-reply
- Edit messages, delete messages
- Forward messages, pin messages
- Copy message text
- @mentions in groups with highlight
- System messages in grey italic monospace

### Media
- Image sharing — tap to view fullscreen
- File attachments
- Voice notes — hold to record up to 5 minutes, preview before sending
- Disappearing photos — 1x or 2x view, deleted after opening

### Status and presence
- Real-time online/offline indicators
- Typing indicators
- iMessage-style status: Sending → Sent → Delivered → Read
- Seen label on latest message, disappears when recipient starts typing

### Notifications
- In-app banners with animated progress bar drain
- Browser notifications when app is minimised
- Notification sound (rhea.mp3)
- Unread count badges on nav tabs

### Navigation (mobile bottom nav)
- Home — profile, stats bar, live clock, activity feed, recent chats
- Chats — DM list sorted by recent, message preview, mute, archive
- Groups — group list with online count, member list, invite copy
- Settings — full settings page

### Settings
- Account: profile picture upload, display name, bio, phone, change password
- Appearance: 12 themes that apply globally
- Notifications: toggle banners, sound, online alerts, mentions
- Privacy: online status, read receipts, typing indicator, phone visibility
- About: version info, credits — tap version 5 times to unlock dev mode
- Sign out button
- Dev Panel button (lethabok only)

### Themes
Dark, Darker, Neon Purple, Vampire, WhatsApp, Light, Cyberpunk, Deep Sea, Instagram, Forest, Rose, Midnight

---

## Requirements

- Android phone with Termux
- Termux packages: python, nodejs, git, tmux, openssl-tool
- Python packages: flask, flask-cors, waitress
- Node packages: installed via npm install in each service folder

---

## Installation

```bash
# Clone
git clone https://github.com/lethabokhedama-png/lan-chatapp.git
cd lan-chatapp

# Python dependencies
cd data_handling
pip install flask flask-cors waitress --break-system-packages
cd ..

# Node dependencies
cd realtime_msg && npm install && cd ..
cd frontend && npm install && cd ..

# Install tmux
pkg install tmux openssl-tool -y
```

---

## Starting the app

```bash
bash ~/chatapp/start.sh
```

This single command:
1. Detects your current LAN IP automatically
2. Updates all .env files with the new IP
3. Regenerates the HTTPS certificate if the IP changed
4. Copies the cert to storage for other devices
5. Builds the frontend
6. Starts all 5 services in a single tmux window

To view all service logs: `tmux attach -t lanchat`
To stop everything: `tmux kill-session -t lanchat`

### The 5 services started
| Service | Port | What it does |
|---------|------|-------------|
| Flask API | 8000 | Handles all data — auth, messages, users, rooms |
| Socket.IO | 6767 | Realtime messaging and presence |
| API HTTPS proxy | 8443 | Wraps Flask in HTTPS so browsers accept it |
| RT HTTPS proxy | 6443 | Wraps Socket.IO in HTTPS |
| Frontend | 5173 | Serves the React app over HTTPS |

---

## Connecting other devices

1. Run `bash ~/chatapp/start.sh` — it copies `lanchat-cert.pem` to your internal storage
2. Send that file to the other device (AirDrop, Bluetooth, shared folder)
3. On the other device: Settings → Security → Install certificate → CA certificate → pick the file
4. Open `https://YOUR_IP:5173` in Chrome on that device
5. Accept the certificate warning once, then it works permanently

---

## User guide

### Sending a DM
Tap the + button on the Chats tab, pick a user

### Creating a group
Tap the + button on the Groups tab, name it, pick members

### Voice note
Tap the mic icon in the message bar, tap record, tap stop when done, preview, then send

### Disappearing photo
Tap the camera icon, select a photo — it will be viewable 1 time then deleted

### Reactions
Double tap any message to show the emoji row, or long press for the full context menu

### Swipe to reply
Swipe right on any received message to quickly quote-reply

### Long press menu
Hold any message for about 0.6 seconds for: Reply, Edit (own), Copy, Forward, Pin, React, Delete (own)

---

## Dev account

| Field | Value |
|-------|-------|
| Username | `lethabok` |
| Password | `P@55word` |
| Role | `dev` |

This account has access to the Dev Panel. It is created automatically on first boot.

---

## Dev panel

Access: Settings → Dev Panel button (bottom, only visible to lethabok)
Or: tap the version number in About 5 times to unlock dev mode on any account

The Dev Panel slides up from the bottom with tabs across the top.

### Console tab
The main interface. A terminal-style console where you type commands.

**Prompt format:** `lethabok@lanchat $`

Commands start with `!` for actions or `?` for queries:

```
?help              — full command list
?status            — server info
?users             — all accounts
?user @username    — one user's details
?rooms             — all rooms
?online            — who is online
?flags             — all feature flags
```

```
!kick @username    — disconnect a user immediately
!ban @username     — block a user from logging in
!delete @username  — permanently delete an account
!ghost on          — you appear offline to everyone
!ghost off         — you are visible again
!flag <key> <val>  — change a feature flag
!broadcast <msg>   — system message to all rooms
!msg <room> <msg>  — system message to one room
!maintenance on    — block all logins
!maintenance off   — re-enable logins
!resetflags        — reset all flags to defaults
!clear             — clear the console
```

**Keyboard shortcuts:**
- Up/Down arrows: scroll through command history
- Tab: autocomplete command name
- Enter: run command

### Stats tab
Live server stats: status, uptime, user count, online count, room count, version. List of currently online users.

### Users tab
All registered accounts with online status. Kick or delete any user except yourself.

### Flags tab
Every feature flag with full description, current value, and a toggle switch. Changes apply immediately.

### Monitor tab
Live feed of all messages sent across all rooms — room name, sender, content, timestamp. Useful for moderation.

### System tab
Send a formatted system announcement to all rooms or a specific room with a preview.

### Logs tab
Last 100 server log entries colour-coded by type (info/auth/warn/error).

---

## Console commands

Full reference:

```
QUERY (?)
  ?help              Full help text
  ?status            Server status and uptime
  ?users             List all users
  ?user @name        Details for one user
  ?rooms             List all rooms
  ?online            Online users right now
  ?flags             All feature flags
  ?flag <key>        One flag value
  ?version           App version

ACTION (!)
  !kick @name        Force disconnect (they can reconnect)
  !ban @name         Block login (flag-based)
  !delete @name      Delete account permanently
  !ghost on|off      Toggle invisible mode
  !flag <k> <v>      Set flag: !flag voice_notes false
  !broadcast <msg>   System msg to all rooms
  !msg <room> <msg>  System msg to one room
  !maintenance on    Block all logins
  !maintenance off   Re-enable logins
  !resetflags        Restore all defaults
  !reload            Notify users to reload
  !clear             Clear console output
```

---

## Feature flags

Stored in `DATA/dev/flags.json`. Edit via Dev Panel or `!flag` command.

| Flag | Default | Description |
|------|---------|-------------|
| smart_replies | true | Show reply suggestions |
| voice_notes | true | Allow voice recording |
| disappearing_photos | true | 1x/2x view photos |
| read_receipts | true | Show message status |
| typing_indicators | true | Show typing animation |
| online_presence | true | Show online dots |
| group_mentions | true | Allow @mentions |
| registration_open | true | Allow new signups |
| maintenance_mode | false | Block all logins |
| max_voice_seconds | 300 | Voice note limit |
| max_upload_mb | 10 | File size limit |
| max_group_members | 50 | Group size limit |

---

## File structure

```
chatapp/
├── data_handling/       Python Flask REST API
│   ├── app.py           Entry point (uses waitress in production)
│   ├── config.py        Settings (host, port, token TTL)
│   └── app/
│       ├── auth.py      Signup, login, token refresh
│       ├── users.py     Profiles, preferences
│       ├── rooms.py     DMs, groups, channels
│       ├── messages.py  Send, edit, delete, receipts
│       ├── uploads.py   Files, voice, photos
│       └── dev.py       Flags, dev account, smart replies
│
├── realtime_msg/        Node.js Socket.IO server
│   └── src/
│       ├── server.js    Entry point
│       ├── middleware/auth.js    Token verification
│       ├── sockets/handlers.js  All socket events
│       └── sockets/presence.js  Online tracking
│
├── frontend/            React + Vite
│   └── src/
│       ├── App.jsx              Root, socket setup
│       ├── pages/
│       │   ├── AuthPage.jsx     Login / Register
│       │   ├── ChatPage.jsx     Main layout, all tabs
│       │   └── SettingsPage.jsx Full settings
│       ├── features/
│       │   ├── chat/
│       │   │   ├── ChatWindow.jsx     Chat UI
│       │   │   ├── MessageBubble.jsx  Message rendering
│       │   │   ├── MessageMenu.jsx    Long press menu
│       │   │   ├── VoiceRecorder.jsx  Audio capture
│       │   │   └── VoicePlayer.jsx    Audio playback
│       │   └── dev/
│       │       └── DevPanel.jsx       Full dev panel
│       └── ui/
│           ├── BottomNav.jsx    4-tab navigation
│           ├── Toast.jsx        Notifications
│           └── Modal.jsx        Modal wrapper
│
├── DATA/                All app data (never commit)
│   ├── index.json       User and room registry
│   ├── secret.key       HMAC signing key
│   ├── dev/flags.json   Feature flags
│   ├── users/           Per-user profiles
│   ├── rooms/           Messages and metadata
│   └── uploads/         Files, voice, photos
│
├── api-https.cjs        HTTPS proxy for Flask API
├── rt-https.cjs         HTTPS proxy for Socket.IO
├── cert.pem             Self-signed TLS certificate
├── key.pem              Private key
├── start.sh             One-command startup with tmux
├── detect-ip.sh         IP detection utility
└── README.md            This file
```

---

## API reference

All routes require `Authorization: Bearer <token>` unless noted.

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/signup | Register |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| POST | /api/auth/logout | Logout |
| GET | /api/users/ | All users |
| GET | /api/users/:id | One user |
| PATCH | /api/users/me | Update profile |
| GET | /api/rooms/mine | My rooms |
| POST | /api/rooms/dm | Create DM |
| POST | /api/rooms/group | Create group |
| GET | /api/messages/:room | Fetch messages |
| POST | /api/messages/:room | Send message |
| PATCH | /api/messages/:room/:id | Edit message |
| DELETE | /api/messages/:room/:id | Delete message |
| POST | /api/uploads/file | Upload file |
| POST | /api/uploads/voice | Upload voice note |
| POST | /api/uploads/photo | Upload disappearing photo |
| GET | /api/dev/flags | Get flags |
| PATCH | /api/dev/flags | Update flags (dev only) |
| GET | /api/health | Health check |

---

## Socket events

### Client → Server
| Event | Payload |
|-------|---------|
| room:join | { roomId } |
| room:leave | { roomId } |
| msg:send | { roomId, content, type, replyToId, clientId } |
| msg:edit | { roomId, msgId, content } |
| msg:delete | { roomId, msgId } |
| msg:seen | { roomId, msgId } |
| msg:react | { roomId, msgId, emoji } |
| typing:start | { roomId } |
| typing:stop | { roomId } |
| presence:ghost | { ghost: true/false } |
| dev:kick | { uid } |

### Server → Client
| Event | Payload |
|-------|---------|
| presence:list | { online: [uid] } |
| presence:update | { uid, status } |
| msg:new | message object |
| msg:edited | message object |
| msg:deleted | { roomId, msgId } |
| msg:receipt | { roomId, msg } |
| typing:update | { roomId, typing: [uid] } |

---

## Themes

| ID | Name | Style |
|----|------|-------|
| dark | Dark | Default dark blue |
| darker | Darker | Near-black |
| neon-purple | Neon Purple | Purple glow |
| vampire | Vampire | Deep red |
| whatsapp | WhatsApp | Green on dark |
| light | Light | Light mode |
| cyberpunk | Cyberpunk | Yellow on black |
| deepsea | Deep Sea | Ocean blue |
| instagram | Instagram | Pink/purple |
| forest | Forest | Green on dark |
| rose | Rose | Pink/red |
| midnight | Midnight | Deep blue |

---

## Building an APK

```bash
cd ~/chatapp/frontend
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "LAN Chat" "com.lethabok.lanchat" --web-dir dist
npm run build
npx cap add android
npx cap sync
```

Build APK via GitHub Actions (set up in `.github/workflows/`) or copy the `android/` folder to a PC with Android Studio.

For instant app-like experience without compiling: open in Chrome → menu → Add to Home Screen. Runs fullscreen with its own icon.

---

## Troubleshooting

**Failed to fetch**
IP changed. Run `bash ~/chatapp/start.sh` to auto-detect and rebuild.

**Other device says untrusted certificate**
Install `lanchat-cert.pem` from internal storage: Settings → Security → Install certificate → CA certificate.

**Invalid credentials on login**
Run `?users` in the Dev Console to see registered usernames. Passwords are case-sensitive.

**Port already in use**
```bash
tmux kill-session -t lanchat
fuser -k 8000/tcp 6767/tcp 8443/tcp 6443/tcp 5173/tcp
```

**Voice notes not working**
Requires HTTPS and microphone permission. Open Settings in the browser and allow microphone for this site.

**Frontend build fails**
```bash
cd ~/chatapp/frontend
rm -rf dist node_modules
npm install
npm start
```

**DATA/ is empty**
Happens when you delete DATA/. Just run `python app.py` once and it recreates everything including the dev account.

---

## Changelog

### v1.7.17 — Current
- Single tmux startup: `bash start.sh` runs everything
- Sidebar removed — bottom nav only (Home, Chats, Groups, Settings)
- Floating + button for new DM and new group
- Dev Panel completely rebuilt: Console (! and ? commands), Stats, Users, Flags, Monitor, System, Logs
- Console commands with ! (actions) and ? (queries)
- Up arrow for command history, Tab for autocomplete
- Ghost mode via !ghost on/off
- Live message monitor across all rooms
- Detailed flag descriptions in Flags tab
- Logout button in Settings
- Dev Panel button in Settings (lethabok only)
- Correct message alignment: own = right, others = always left
- Swipe to reply on mobile
- Double tap for quick reaction row
- Long press (600ms) for full context menu
- Voice recorder fixed: actual audio capture with waveform preview
- Images render from file_url or content field
- iMessage status: Seen label only on latest message, disappears when other types

### v1.6.0
- HTTPS via self-signed cert + Node proxy
- Browser permissions prompt (mic + notifications)
- Bottom nav (mobile only at that time)
- Message context menu with reactions
- README added

### v1.5.0
- Dev panel (first version)
- Feature flags in DATA/dev/flags.json
- Loading screen
- Auto-IP detection script
- iMessage-style message status

### v1.4.0
- Voice notes
- Disappearing photos (1x/2x view)
- Reply system with quote bubble
- Seen label

### v1.3.0
- Smart reply suggestions
- Notification banners with progress bar
- @mentions in groups
- Read receipts

### v1.2.0
- 12 themes
- Settings modal
- Group creation
- Feather icons

### v1.1.0
- Mobile layout
- Build system
- Auto secret.key generation

### v1.0.0
- Initial release
- Auth, DMs, realtime, presence

---

## License

Copyright © 2026 Lethabo Khedama (LethaboK). All rights reserved.

This software is proprietary. Unauthorised copying, modification, distribution or use is strictly prohibited.

Built with care on Android using Termux.
