"""
/api/rooms  — channels, DMs, membership, pins, wallpaper
"""
from pathlib import Path
import requests as _req

def _notify_rt(event, data):
    """Tell realtime server about a new room so it can push to clients."""
    try:
        import config as _cfg
        _req.post(
            f"https://127.0.0.1:{_cfg.RT_NOTIFY_PORT or 6767}/internal/notify",
            json={"event": event, "data": data},
            verify=False, timeout=1,
        )
    except Exception:
        pass

from flask import Blueprint, request, jsonify
from utils.ids      import next_room_id, register_room, dm_room_id, user_dir_name
from utils.store    import read, write, update, ensure_dir
from utils.user_fs  import update_room_meta, get_rooms_meta
from utils.audit    import log_room
from utils.time     import now
from app.middleware import require_auth
import config

bp = Blueprint("rooms", __name__)


def _room_root(room_id: str) -> Path:
    return Path(config.DATA_PATH) / "rooms" / room_id


def _room_meta(room_id: str) -> dict:
    return read(_room_root(room_id) / "meta.json", {})


def _room_members(room_id: str) -> list:
    return read(_room_root(room_id) / "members.json", [])


def _is_member(room_id: str, uid: int) -> bool:
    return any(m["user_id"] == uid for m in _room_members(room_id))


def _create_room(room_id: str, meta: dict, creator_id: int) -> None:
    root = _room_root(room_id)
    ensure_dir(root / "messages")
    write(root / "meta.json", meta)
    write(root / "members.json", [{
        "user_id":   creator_id,
        "role":      "owner",
        "joined_at": now(),
    }])
    write(root / "pins.json", [])


# ── Routes ─────────────────────────────────────────────────────────────────────

@bp.get("/")
@require_auth
def list_rooms():
    rooms_dir = Path(config.DATA_PATH) / "rooms"
    result = []
    if not rooms_dir.exists():
        return jsonify([])
    for d in rooms_dir.iterdir():
        meta = _room_meta(d.name)
        if meta:
            result.append({**meta, "id": d.name})
    return jsonify(result)


@bp.get("/mine")
@require_auth
def my_rooms():
    udir = user_dir_name(request.uid)
    memberships = get_rooms_meta(udir)
    rooms = []
    for room_id in memberships:
        meta = _room_meta(room_id)
        if meta:
            rooms.append({**meta, "id": room_id, "_my": memberships[room_id]})
    return jsonify(rooms)


@bp.post("/channel")
@require_auth
def create_channel():
    d    = request.json or {}
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400

    room_id = f"ch_{next_room_id()}"
    meta = {
        "id":            room_id,
        "type":          "channel",
        "name":          name,
        "topic":         d.get("topic", ""),
        "slow_mode_sec": d.get("slow_mode_sec", 0),
        "wallpaper":     None,
        "roles":         {},
        "created_by":    request.uid,
        "created_at":    now(),
    }
    _create_room(room_id, meta, request.uid)
    register_room(room_id, name, "channel")

    udir = user_dir_name(request.uid)
    update_room_meta(udir, room_id, {"joined_at": now(), "muted": False, "last_read_id": 0})

    log_room("created", request.uid, room_id, {"name": name, "type": "channel"})
    return jsonify(meta), 201


@bp.post("/dm")
@require_auth
def create_dm():
    d    = request.json or {}
    other = d.get("user_id")
    if not other:
        return jsonify({"error": "user_id required"}), 400
    other = int(other)

    room_id = dm_room_id(request.uid, other)
    root    = _room_root(room_id)

    if not (root / "meta.json").exists():
        meta = {
            "id":         room_id,
            "type":       "dm",
            "name":       f"dm:{request.uid}:{other}",
            "topic":      "",
            "created_at": now(),
        }
        _create_room(room_id, meta, request.uid)
        # add other user to members
        members = _room_members(room_id)
        members.append({"user_id": other, "role": "member", "joined_at": now()})
        write(root / "members.json", members)
        register_room(room_id, meta["name"], "dm")

        for uid in (request.uid, other):
            udir = user_dir_name(uid)
            if udir:
                update_room_meta(udir, room_id, {"joined_at": now(), "muted": False, "last_read_id": 0})

    log_room("dm_open", request.uid, room_id)
    return jsonify(_room_meta(room_id))


@bp.get("/<room_id>")
@require_auth
def get_room(room_id):
    meta = _room_meta(room_id)
    if not meta:
        return jsonify({"error": "Not found"}), 404
    members = _room_members(room_id)
    return jsonify({**meta, "members": members})


@bp.post("/<room_id>/join")
@require_auth
def join_room(room_id):
    meta = _room_meta(room_id)
    if not meta:
        return jsonify({"error": "Not found"}), 404
    if meta["type"] == "dm":
        return jsonify({"error": "Cannot join a DM this way"}), 400

    members = _room_members(room_id)
    if not _is_member(room_id, request.uid):
        members.append({"user_id": request.uid, "role": "member", "joined_at": now()})
        write(_room_root(room_id) / "members.json", members)
        udir = user_dir_name(request.uid)
        update_room_meta(udir, room_id, {"joined_at": now(), "muted": False, "last_read_id": 0})
        log_room("joined", request.uid, room_id)

    return jsonify({"ok": True})


@bp.post("/<room_id>/leave")
@require_auth
def leave_room(room_id):
    members = _room_members(room_id)
    members = [m for m in members if m["user_id"] != request.uid]
    write(_room_root(room_id) / "members.json", members)
    log_room("left", request.uid, room_id)
    return jsonify({"ok": True})


@bp.patch("/<room_id>/meta")
@require_auth
def patch_room_meta(room_id):
    d = request.json or {}
    allowed = {"topic", "slow_mode_sec", "wallpaper", "name"}
    patch = {k: v for k, v in d.items() if k in allowed}
    updated = update(_room_root(room_id) / "meta.json", patch)
    log_room("updated", request.uid, room_id, patch)
    return jsonify(updated)


@bp.get("/<room_id>/pins")
@require_auth
def get_pins(room_id):
    return jsonify(read(_room_root(room_id) / "pins.json", []))


@bp.post("/<room_id>/pins")
@require_auth
def pin_message(room_id):
    msg_id = (request.json or {}).get("message_id")
    if not msg_id:
        return jsonify({"error": "message_id required"}), 400
    pins = read(_room_root(room_id) / "pins.json", [])
    if msg_id not in pins:
        pins.append(msg_id)
        write(_room_root(room_id) / "pins.json", pins)
    return jsonify(pins)


@bp.delete("/<room_id>/pins/<int:msg_id>")
@require_auth
def unpin_message(room_id, msg_id):
    pins = [p for p in read(_room_root(room_id) / "pins.json", []) if p != msg_id]
    write(_room_root(room_id) / "pins.json", pins)
    return jsonify(pins)
@bp.post("/group")
@require_auth
def create_group():
    d    = request.json or {}
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    room_id = f"gr_{next_room_id()}"
    meta = {
        "id":         room_id,
        "type":       "group",
        "name":       name,
        "topic":      d.get("topic", ""),
        "created_by": request.uid,
        "created_at": now(),
    }
    _create_room(room_id, meta, request.uid)
    register_room(room_id, name, "group")
    return jsonify({**meta, "members": _room_members(room_id)}), 201
