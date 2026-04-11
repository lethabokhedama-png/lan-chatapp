"""
/api/dev — feature flags, smart replies, dev tools
Dev account: lethabok / P@55word (auto-created on first boot)
"""
from flask import Blueprint, request, jsonify
from app.middleware import require_auth
from pathlib import Path
import json, re, time, config
from utils.auth_helpers import hash_password

bp = Blueprint("dev", __name__)

REPLIES_FILE = Path(config.DATA_PATH) / "common_replies.json"
DEV_USERNAME = "lethabok"
DEV_DISPLAY  = "LethaboK"
DEV_PASSWORD = "P@55word"
DEV_ROLE     = "dev"

# ── Dev account bootstrap ────────────────────────────────
def ensure_dev_account():
    index_path = Path(config.DATA_PATH) / "index.json"
    users_path = Path(config.DATA_PATH) / "users"
    if not index_path.exists():
        return
    index = json.loads(index_path.read_text())
    for username_str, uid_val in index.get("users_by_username", {}).items():
        udata = {"username": username_str}
        if udata.get("username", "").lower() == DEV_USERNAME:
            print("  [Dev] Account exists: @" + DEV_USERNAME)
            return
    uid = max((int(k) for k in index.get("users", {}).keys()), default=0) + 1
    pw  = hash_password(DEV_PASSWORD)
    dn  = DEV_USERNAME + "_" + str(uid)
    ud  = users_path / dn
    ud.mkdir(parents=True, exist_ok=True)
    prof = {
        "id": uid, "username": DEV_USERNAME,
        "display_name": DEV_DISPLAY, "role": DEV_ROLE,
        "created_at": int(time.time() * 1000),
        "bio": "LAN Chat Developer", "avatar_color": 0,
        "_password_hash": pw,
    }
    (ud / "profile.json").write_text(json.dumps(prof, indent=2))
    (ud / "prefs.json").write_text("{}")
    (ud / "privacy.json").write_text(json.dumps({"show_online": True, "read_receipts": True}))
    (ud / "rooms.json").write_text("[]")
    (ud / "receipts.json").write_text("{}")
    index.setdefault("users", {})[str(uid)] = {
        "username": DEV_USERNAME, "dir": dn, "role": DEV_ROLE,
    }
    index_path.write_text(json.dumps(index, indent=2))
    print("  [Dev] Created: @" + DEV_USERNAME + " uid=" + str(uid))

# ── Flags ────────────────────────────────────────────────
DEFAULT_FLAGS = {
    "smart_replies":        True,
    "voice_notes":          True,
    "disappearing_photos":  True,
    "read_receipts":        True,
    "typing_indicators":    True,
    "online_presence":      True,
    "group_mentions":       True,
    "dev_panel":            True,
    "one_time_view":        True,
    "two_time_view":        True,
    "registration_open":    True,
    "allow_self_dm":        False,
    "allow_file_uploads":   True,
    "allow_image_uploads":  True,
    "allow_group_creation": True,
    "require_approval":     False,
    "maintenance_mode":     False,
    "max_voice_seconds":    300,
    "max_upload_mb":        10,
    "max_group_members":    50,
    "max_message_length":   2000,
    "max_rooms_per_user":   20,
    "motd":                 "",
}

def ensure_flags():
    flags_path = Path(config.DATA_PATH) / "dev" / "flags.json"
    flags_path.parent.mkdir(parents=True, exist_ok=True)
    existing = {}
    if flags_path.exists():
        try:
            existing = json.loads(flags_path.read_text()).get("global", {})
        except Exception:
            pass
    merged = {**DEFAULT_FLAGS, **existing}
    data = {"global": merged, "users": {}}
    if flags_path.exists():
        try:
            data["users"] = json.loads(flags_path.read_text()).get("users", {})
        except Exception:
            pass
    data["global"] = merged
    flags_path.write_text(json.dumps(data, indent=2))
    print("  [Flags] Updated")

@bp.get("/flags")
@require_auth
def get_flags():
    uid = request.uid
    flags_path = Path(config.DATA_PATH) / "dev" / "flags.json"
    if not flags_path.exists():
        return jsonify({"global": DEFAULT_FLAGS, "users": {}})
    data   = json.loads(flags_path.read_text())
    flags  = {**DEFAULT_FLAGS, **data.get("global", {})}
    overrides = data.get("users", {}).get(str(uid), {})
    flags.update(overrides)
    return jsonify({"global": flags, "user": overrides})

@bp.patch("/flags")
@require_auth
def update_flags():
    uid = request.uid
    profile = _get_profile(uid)
    if not profile or profile.get("role") not in ("dev", "admin"):
        return jsonify({"error": "Dev only"}), 403
    flags_path = Path(config.DATA_PATH) / "dev" / "flags.json"
    data = json.loads(flags_path.read_text()) if flags_path.exists() else {"global": {}, "users": {}}
    updates = request.json or {}
    data["global"].update(updates)
    flags_path.write_text(json.dumps(data, indent=2))
    return jsonify({"ok": True, "flags": data["global"]})

@bp.get("/users")
@require_auth
def list_all_users():
    uid = request.uid
    profile = _get_profile(uid)
    if not profile or profile.get("role") not in ("dev", "admin"):
        return jsonify({"error": "Dev only"}), 403
    index_path = Path(config.DATA_PATH) / "index.json"
    index      = json.loads(index_path.read_text())
    users = []
    for username_str, uid_val in index.get("users_by_username", {}).items():
        udata = {"username": username_str}
        p = _get_profile_by_dir(udata.get("dir", ""))
        if p:
            users.append({k: v for k, v in p.items() if not k.startswith("_")})
    return jsonify(users)

# ── Smart replies ────────────────────────────────────────
def _load_replies():
    try:
        return json.loads(REPLIES_FILE.read_text()) if REPLIES_FILE.exists() else {}
    except Exception:
        return {}

def _save_replies(data):
    REPLIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPLIES_FILE.write_text(json.dumps(data, indent=2))

@bp.get("/smart-replies")
@require_auth
def get_smart_replies():
    q    = request.args.get("q", "").lower().strip()
    data = _load_replies()
    suggestions = []
    for pattern, replies in data.items():
        if not q or any(w in q for w in pattern.split()):
            sorted_r = sorted(replies.items(), key=lambda x: x[1], reverse=True)
            suggestions += [r for r, _ in sorted_r[:2]]
    seen, result = set(), []
    for s in suggestions:
        if s not in seen:
            seen.add(s); result.append(s)
        if len(result) >= 5:
            break
    return jsonify({"suggestions": result})

@bp.post("/learn-reply")
@require_auth
def learn_reply():
    body        = request.json or {}
    context_msg = (body.get("context") or "").lower().strip()
    reply       = (body.get("reply") or "").strip()
    if not context_msg or not reply or len(reply) > 120:
        return jsonify({"ok": True})
    words   = re.sub(r"[^\w\s]", "", context_msg).split()[:3]
    pattern = " ".join(words)
    if not pattern:
        return jsonify({"ok": True})
    data = _load_replies()
    if pattern not in data:
        data[pattern] = {}
    data[pattern][reply] = data[pattern].get(reply, 0) + 1
    _save_replies(data)
    return jsonify({"ok": True})

# ── Helpers ──────────────────────────────────────────────
def _get_profile(uid):
    from utils.ids import user_dir_name
    from utils.user_fs import get_profile
    udir = user_dir_name(uid)
    return get_profile(udir) if udir else None

def _get_profile_by_dir(dir_name):
    from utils.user_fs import get_profile
    return get_profile(dir_name) if dir_name else None


@bp.get("/logs")
@require_auth
def get_logs():
    import json
    from pathlib import Path
    log_path = Path(config.DATA_PATH) / "dev" / "audit.json"
    if not log_path.exists():
        return jsonify([])
    try:
        logs = json.loads(log_path.read_text())
        return jsonify(logs[-100:] if isinstance(logs, list) else [])
    except Exception:
        return jsonify([])


@bp.delete("/logs")
@require_auth  
def clear_logs():
    from pathlib import Path
    log_path = Path(config.DATA_PATH) / "dev" / "audit.json"
    log_path.write_text("[]")
    return jsonify({"ok": True})


@bp.delete("/rooms/<room_id>")
@require_auth
def close_room(room_id):
    from utils.store import read, write
    from pathlib import Path
    import config, shutil
    me = _get_profile(request.uid)
    if me.get("role") != "dev":
        return jsonify({"error": "forbidden"}), 403
    room_path = Path(config.DATA_PATH) / "rooms" / room_id
    if room_path.exists():
        shutil.rmtree(room_path)
    # Remove from user memberships
    idx = read(Path(config.DATA_PATH) / "index.json", {})
    return jsonify({"ok": True, "deleted": room_id})


@bp.delete("/rooms/<room_id>/messages")
@require_auth
def purge_room(room_id):
    from utils.store import write
    from pathlib import Path
    import config
    me = _get_profile(request.uid)
    if me.get("role") != "dev":
        return jsonify({"error": "forbidden"}), 403
    msg_path = Path(config.DATA_PATH) / "rooms" / room_id / "messages.json"
    write(msg_path, [])
    return jsonify({"ok": True, "purged": room_id})


@bp.patch("/rooms/<room_id>/meta")
@require_auth
def rename_room(room_id):
    from utils.store import read, write
    from pathlib import Path
    import config
    me = _get_profile(request.uid)
    if me.get("role") != "dev":
        return jsonify({"error": "forbidden"}), 403
    name = request.json.get("name", "")
    meta_path = Path(config.DATA_PATH) / "rooms" / room_id / "meta.json"
    meta = read(meta_path, {})
    meta["name"] = name
    write(meta_path, meta)
    return jsonify({"ok": True, "id": room_id, "name": name})


@bp.post("/gc")
@require_auth
def garbage_collect():
    from utils.store import read
    from pathlib import Path
    import config
    me = _get_profile(request.uid)
    if me.get("role") != "dev":
        return jsonify({"error": "forbidden"}), 403
    uploads_path = Path(config.DATA_PATH) / "uploads"
    removed = 0
    if uploads_path.exists():
        for f in uploads_path.rglob("*"):
            if f.is_file() and f.stat().st_size == 0:
                f.unlink()
                removed += 1
    return jsonify({"ok": True, "removed": removed})


@bp.post("/backup")
@require_auth
def backup_data():
    from pathlib import Path
    import config, shutil, time
    me = _get_profile(request.uid)
    if me.get("role") != "dev":
        return jsonify({"error": "forbidden"}), 403
    ts  = int(time.time())
    dst = Path("/storage/emulated/0") / f"lanchat-backup-{ts}"
    try:
        shutil.copytree(config.DATA_PATH, str(dst))
        return jsonify({"ok": True, "path": str(dst)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Additional dev endpoints ─────────────────────────────────────────────────

@bp.get("/rooms/<room_id>/messages")
@require_auth
def get_room_messages(room_id):
    from utils.store import read
    from pathlib import Path
    import config
    msgs = read(Path(config.DATA_PATH) / "rooms" / room_id / "messages.json", [])
    return jsonify(msgs[-20:])


@bp.post("/rooms/<room_id>/lock")
@require_auth
def lock_room(room_id):
    from utils.store import read, write
    from pathlib import Path
    import config
    meta_path = Path(config.DATA_PATH) / "rooms" / room_id / "meta.json"
    meta = read(meta_path, {})
    meta["locked"] = True
    write(meta_path, meta)
    return jsonify({"ok": True, "locked": True})


@bp.delete("/rooms/<room_id>/lock")
@require_auth
def unlock_room(room_id):
    from utils.store import read, write
    from pathlib import Path
    import config
    meta_path = Path(config.DATA_PATH) / "rooms" / room_id / "meta.json"
    meta = read(meta_path, {})
    meta["locked"] = False
    write(meta_path, meta)
    return jsonify({"ok": True, "locked": False})


@bp.post("/rooms/<room_id>/members")
@require_auth
def add_member(room_id):
    from utils.store import read, write
    from pathlib import Path
    import config
    from utils.time import now
    uid = request.json.get("uid")
    if not uid:
        return jsonify({"error": "uid required"}), 400
    members_path = Path(config.DATA_PATH) / "rooms" / room_id / "members.json"
    members = read(members_path, [])
    if not any(m["user_id"] == uid for m in members):
        members.append({"user_id": uid, "role": "member", "joined_at": now()})
        write(members_path, members)
    return jsonify({"ok": True})


@bp.delete("/rooms/<room_id>/members/<int:uid>")
@require_auth
def remove_member(room_id, uid):
    from utils.store import read, write
    from pathlib import Path
    import config
    members_path = Path(config.DATA_PATH) / "rooms" / room_id / "members.json"
    members = read(members_path, [])
    members = [m for m in members if m["user_id"] != uid]
    write(members_path, members)
    return jsonify({"ok": True})


@bp.post("/motd")
@require_auth
def set_motd():
    from utils.store import read, write
    from pathlib import Path
    import config
    msg = request.json.get("message", "")
    flags_path = Path(config.DATA_PATH) / "dev" / "flags.json"
    flags = read(flags_path, {})
    if "global" not in flags:
        flags["global"] = {}
    flags["global"]["motd"] = msg
    write(flags_path, flags)
    return jsonify({"ok": True, "motd": msg})


@bp.delete("/users/<int:uid>/messages")
@require_auth
def wipe_user_messages(uid):
    """Delete all messages sent by a user across all rooms."""
    from utils.store import read, write
    from pathlib import Path
    import config
    data_path = Path(config.DATA_PATH)
    rooms_path = data_path / "rooms"
    total = 0
    if rooms_path.exists():
        for room_dir in rooms_path.iterdir():
            msg_file = room_dir / "messages.json"
            if msg_file.exists():
                msgs = read(msg_file, [])
                before = len(msgs)
                msgs = [m for m in msgs if m.get("sender_id") != uid]
                if len(msgs) < before:
                    write(msg_file, msgs)
                    total += before - len(msgs)
    return jsonify({"ok": True, "deleted": total})


@bp.get("/disk")
@require_auth
def disk_usage():
    from pathlib import Path
    import config
    data_path = Path(config.DATA_PATH)
    def folder_size(p):
        return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())
    result = {}
    for sub in ["users","rooms","uploads","dev"]:
        p = data_path / sub
        result[sub] = folder_size(p) if p.exists() else 0
    result["total"] = sum(result.values())
    return jsonify(result)


@bp.get("/export/<room_id>")
@require_auth
def export_room(room_id):
    from utils.store import read
    from pathlib import Path
    import config, json, time
    msgs = read(Path(config.DATA_PATH) / "rooms" / room_id / "messages.json", [])
    meta = read(Path(config.DATA_PATH) / "rooms" / room_id / "meta.json", {})
    export = {"room": meta, "messages": msgs, "exported_at": time.time()}
    out = Path("/storage/emulated/0") / f"lanchat-export-{room_id[:8]}.json"
    out.write_text(json.dumps(export, indent=2))
    return jsonify({"ok": True, "path": str(out), "messages": len(msgs)})
