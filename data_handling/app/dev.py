"""
/api/dev  — feature flags, dev panel (gated by flags.json overrides)
"""
from pathlib import Path
from flask import Blueprint, request, jsonify
from utils.store    import read, write
from app.middleware import require_auth
import config

bp = Blueprint("dev", __name__)


def _flags_path() -> Path:
    return Path(config.DATA_PATH) / "dev" / "flags.json"


def _flags() -> dict:
    return read(_flags_path(), {"features": {}, "overrides": {}})


def get_feature(user_id: int, feature: str) -> bool:
    f = _flags()
    override = f.get("overrides", {}).get(str(user_id), {})
    if feature in override:
        return bool(override[feature])
    return bool(f.get("features", {}).get(feature, False))


@bp.get("/flags")
@require_auth
def flags():
    """Returns the effective feature flags for the requesting user."""
    f   = _flags()
    uid = str(request.uid)
    merged = dict(f.get("features", {}))
    merged.update(f.get("overrides", {}).get(uid, {}))
    return jsonify(merged)


@bp.get("/flags/all")
@require_auth
def flags_all():
    """Full flags file — only visible if user has dev_panel."""
    if not get_feature(request.uid, "dev_panel"):
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(_flags())


@bp.patch("/flags")
@require_auth
def patch_flags():
    """Update flags — only for users with dev_panel enabled."""
    if not get_feature(request.uid, "dev_panel"):
        return jsonify({"error": "Forbidden"}), 403
    d       = request.json or {}
    current = _flags()
    if "features" in d:
        current["features"].update(d["features"])
    if "overrides" in d:
        current.setdefault("overrides", {}).update(d["overrides"])
    write(_flags_path(), current)
    return jsonify(current)