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
    "smart_replies": True, "voice_notes": True,
    "disappearing_photos": True, "read_receipts": True,
    "typing_indicators": True, "online_presence": True,
    "group_mentions": True, "dev_panel": True,
    "one_time_view": True, "two_time_view": True,
    "max_voice_seconds": 300, "max_upload_mb": 10,
    "max_group_members": 50, "maintenance_mode": False,
    "registration_open": True,
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
