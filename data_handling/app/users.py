"""
/api/users  — profiles, prefs, privacy, theme, presence
"""
from flask import Blueprint, request, jsonify
from utils.ids     import user_dir_name
from utils.user_fs import (get_profile, get_prefs, get_privacy, get_theme,
                            update_profile, update_prefs, update_privacy, update_theme)
from utils.audit   import log_settings, log_auth
from utils.store   import read
from app.middleware import require_auth
from pathlib import Path
import config

bp = Blueprint("users", __name__)


def _all_profiles() -> list:
    users_dir = Path(config.DATA_PATH) / "users"
    result = []
    if not users_dir.exists():
        return result
    for d in users_dir.iterdir():
        if d.is_dir():
            p = read(d / "profile.json", {})
            if p:
                result.append(_safe(p))
    return result


def _safe(p: dict) -> dict:
    return {k: v for k, v in p.items() if not k.startswith("_") and k != "email"}


@bp.get("/")
@require_auth
def list_users():
    return jsonify(_all_profiles())


@bp.get("/<int:uid>")
@require_auth
def get_user(uid):
    udir = user_dir_name(uid)
    if not udir:
        return jsonify({"error": "Not found"}), 404
    return jsonify(_safe(get_profile(udir)))


@bp.patch("/me/profile")
@require_auth
def patch_profile():
    d = request.json or {}
    udir = user_dir_name(request.uid)
    if not udir:
        return jsonify({"error": "Not found"}), 404
    updated = update_profile(udir, d)
    log_settings(request.uid, "profile", d)
    return jsonify(_safe(updated))


@bp.get("/me/prefs")
@require_auth
def get_prefs_route():
    udir = user_dir_name(request.uid)
    return jsonify(get_prefs(udir))


@bp.patch("/me/prefs")
@require_auth
def patch_prefs():
    d = request.json or {}
    udir = user_dir_name(request.uid)
    updated = update_prefs(udir, d)
    log_settings(request.uid, "prefs", d)
    return jsonify(updated)


@bp.get("/me/privacy")
@require_auth
def get_privacy_route():
    udir = user_dir_name(request.uid)
    return jsonify(get_privacy(udir))


@bp.patch("/me/privacy")
@require_auth
def patch_privacy():
    d = request.json or {}
    udir = user_dir_name(request.uid)
    updated = update_privacy(udir, d)
    log_settings(request.uid, "privacy", d)
    return jsonify(updated)


@bp.get("/me/theme")
@require_auth
def get_theme_route():
    udir = user_dir_name(request.uid)
    return jsonify(get_theme(udir))


@bp.patch("/me/theme")
@require_auth
def patch_theme():
    d = request.json or {}
    udir = user_dir_name(request.uid)
    updated = update_theme(udir, d.get("mode", "system"), d.get("palette", "default"))
    log_settings(request.uid, "theme", d)
    return jsonify(updated)


@bp.post("/me/status")
@require_auth
def set_status():
    d = request.json or {}
    status = d.get("status", "online")
    if status not in ("online", "away", "offline"):
        return jsonify({"error": "invalid status"}), 400
    udir = user_dir_name(request.uid)
    updated = update_profile(udir, {"status": status})
    return jsonify({"status": status})

@bp.delete("/<int:uid>")
@require_auth
def delete_user(uid):
    from utils.store import read, write
    from pathlib import Path
    import config
    # Must be dev
    me = read(Path(config.DATA_PATH) / "users" / f"uid_{request.uid}" / "profile.json", {})
    if me.get("role") != "dev":
        return jsonify({"error": "forbidden"}), 403
    # Remove from index
    idx = read(Path(config.DATA_PATH) / "index.json", {})
    uname = None
    for k, v in list(idx.get("users_by_id", {}).items()):
        if int(k) == uid:
            uname = v
            del idx["users_by_id"][k]
            break
    if uname and uname in idx.get("users_by_username", {}):
        del idx["users_by_username"][uname]
    write(Path(config.DATA_PATH) / "index.json", idx)
    return jsonify({"ok": True, "deleted": uid})


@bp.patch("/<int:uid>/role")
@require_auth
def set_role(uid):
    from utils.store import read, write
    from pathlib import Path
    import config, glob
    me = read(Path(config.DATA_PATH) / "users" / f"uid_{request.uid}" / "profile.json", {})
    if me.get("role") != "dev":
        return jsonify({"error": "forbidden"}), 403
    role = request.json.get("role", "user")
    # Find user dir
    user_dirs = list((Path(config.DATA_PATH) / "users").glob(f"uid_{uid}"))
    if not user_dirs:
        # Try by scanning
        for d in (Path(config.DATA_PATH) / "users").iterdir():
            p = read(d / "profile.json", {})
            if p.get("id") == uid or p.get("uid") == uid:
                user_dirs = [d]
                break
    if not user_dirs:
        return jsonify({"error": "not found"}), 404
    prof = read(user_dirs[0] / "profile.json", {})
    prof["role"] = role
    write(user_dirs[0] / "profile.json", prof)
    return jsonify({"ok": True, "uid": uid, "role": role})


@bp.post("/<int:uid>/ban")
@require_auth
def ban_user(uid):
    from utils.store import read, write
    from pathlib import Path
    import config
    me = read(Path(config.DATA_PATH) / "users" / f"uid_{request.uid}" / "profile.json", {})
    if me.get("role") != "dev":
        return jsonify({"error": "forbidden"}), 403
    reason    = request.json.get("reason", "Banned by admin")
    duration  = request.json.get("duration_hours", 24)
    permanent = request.json.get("permanent", False)
    import time
    if permanent or duration >= 87600:
        ban_until = int(time.time()) + (365 * 24 * 3600)  # 1 year
        permanent = True
    else:
        ban_until = int(time.time()) + int(duration * 3600)
    # Store ban in dev flags
    flags_path = Path(config.DATA_PATH) / "dev" / "flags.json"
    flags = read(flags_path, {})
    if "bans" not in flags:
        flags["bans"] = {}
    flags["bans"][str(uid)] = {
        "reason": reason,
        "until": ban_until,
        "duration_hours": duration,
        "permanent": permanent,
    }
    write(flags_path, flags)
    return jsonify({"ok": True, "uid": uid, "until": ban_until, "reason": reason})


@bp.delete("/<int:uid>/ban")
@require_auth
def unban_user(uid):
    from utils.store import read, write
    from pathlib import Path
    import config
    flags_path = Path(config.DATA_PATH) / "dev" / "flags.json"
    flags = read(flags_path, {})
    if "bans" in flags and str(uid) in flags["bans"]:
        del flags["bans"][str(uid)]
    write(flags_path, flags)
    return jsonify({"ok": True})
