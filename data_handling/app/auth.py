"""
/api/auth  — signup, login, token refresh, logout
"""
from flask import Blueprint, request, jsonify
from utils.ids          import next_user_id, register_user, username_taken, id_for_username, user_dir_name
from utils.auth_helpers import make_token, verify_token, hash_password, verify_password
from utils.user_fs      import create_user_tree, get_profile
from utils.audit        import log_auth
from utils.ip_ledger    import record_access
from utils.time         import now
from app.middleware     import require_auth
import config

bp = Blueprint("auth", __name__)


@bp.post("/signup")
def signup():
    d = request.json or {}
    username    = (d.get("username") or "").strip().lower()
    display_name= (d.get("display_name") or username).strip()
    email       = (d.get("email") or "").strip().lower()
    password    = d.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400
    if len(username) < 2 or len(username) > 32:
        return jsonify({"error": "username must be 2–32 characters"}), 400
    if username_taken(username):
        return jsonify({"error": "username already taken"}), 409

    uid      = next_user_id()
    user_dir = f"{username}_{uid}"

    profile = {
        "id":           uid,
        "username":     username,
        "display_name": display_name,
        "email":        email,
        "avatar":       None,
        "bio":          "",
        "status":       "offline",
        "created_at":   now(),
        "updated_at":   now(),
        "_password_hash": hash_password(password),  # kept in profile.json, never sent to client
    }

    create_user_tree(user_dir, profile)
    register_user(uid, username, display_name)

    token = make_token(uid)
    log_auth("signup", uid, username, request.remote_addr)

    return jsonify({
        "token": token,
        "user":  _safe_profile(profile),
    }), 201


@bp.post("/login")
def login():
    d = request.json or {}
    username = (d.get("username") or "").strip().lower()
    password = d.get("password", "")

    uid = id_for_username(username)
    if uid is None:
        return jsonify({"error": "Invalid credentials"}), 401

    # Check maintenance — dev account can always login
    if username != "lethabok" and check_maintenance():
        return jsonify({"error": "maintenance"}), 503

    udir    = user_dir_name(uid)
    profile = get_profile(udir)
    if not profile or not verify_password(password, profile.get("_password_hash", "")):
        return jsonify({"error": "Invalid credentials"}), 401

    # Check if user is banned
    ban = check_ban(uid)
    if ban:
        import time
        remaining = max(0, int((ban.get("until", 0) - time.time()) / 3600))
        reason = ban.get("reason", "Banned by admin")
        return jsonify({"error": f"Account banned: {reason}. {remaining}h remaining."}), 403

    token = make_token(uid)
    log_auth("login", uid, username, request.remote_addr)
    record_access(request.remote_addr, uid)

    return jsonify({
        "token": token,
        "user":  _safe_profile(profile),
    })


@bp.get("/me")
@require_auth
def me():
    from utils.ids import user_dir_name
    udir = user_dir_name(request.uid)
    if not udir:
        return jsonify({"error": "Not found"}), 404
    profile = get_profile(udir)
    return jsonify(_safe_profile(profile))


@bp.post("/logout")
@require_auth
def logout():
    log_auth("logout", request.uid, "", request.remote_addr)
    return jsonify({"ok": True})


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe_profile(p: dict) -> dict:
    """Strip private fields before sending to client."""
    return {k: v for k, v in p.items() if not k.startswith("_")}

def check_ban(uid):
    """Returns ban info if user is banned, None otherwise."""
    from utils.store import read
    from pathlib import Path
    import config, time
    flags_path = Path(config.DATA_PATH) / "dev" / "flags.json"
    flags = read(flags_path, {})
    ban = flags.get("bans", {}).get(str(uid))
    if not ban:
        return None
    if ban.get("until", 0) < time.time():
        return None  # Ban expired
    return ban


def check_maintenance():
    """Returns True if maintenance mode is on."""
    from utils.store import read
    from pathlib import Path
    flags_path = Path(config.DATA_PATH) / "dev" / "flags.json"
    try:
        import json
        data = json.loads(flags_path.read_text())
        return data.get("global", data).get("maintenance_mode", False)
    except Exception:
        return False
