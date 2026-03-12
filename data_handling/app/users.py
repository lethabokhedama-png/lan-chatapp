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