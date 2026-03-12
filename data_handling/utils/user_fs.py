"""
user_fs.py — helpers for reading/writing the per-user DATA/users/<username>_<id>/ tree.
"""
from pathlib import Path
from typing import Optional
import config
from utils.store import read, write, update, ensure_dir
from utils.time  import now


def user_root(user_dir: str) -> Path:
    return Path(config.DATA_PATH) / "users" / user_dir


def create_user_tree(user_dir: str, profile: dict, prefs: dict | None = None) -> None:
    """Scaffold all files for a new user."""
    root = user_root(user_dir)
    ensure_dir(root / "themes")
    ensure_dir(root / "messages")
    ensure_dir(root / "media")
    ensure_dir(root / "backups")

    write(root / "profile.json", profile)

    write(root / "prefs.json", prefs or {
        "enter_to_send":        True,
        "typing_indicators":    True,
        "group_consecutive":    True,
        "group_window_min":     5,
        "swipe_action_left":    "reply",
        "swipe_action_right":   "more",
        "sound_pack":           "default",
        "sound_volume":         0.8,
        "mute_keywords":        [],
        "notification_sounds":  True,
        "compact_mode":         False,
    })

    write(root / "privacy.json", {
        "send_read_receipts":   True,
        "last_seen_visibility": "everyone",  # "everyone" | "nobody"
        "blocked":              [],
    })

    write(root / "themes" / "current.json", {
        "mode":    "system",  # "system"|"dark"|"light"
        "palette": "default", # see PALETTES in frontend
    })

    write(root / "rooms.json", {
        # room_id -> { muted, last_read_id, joined_at, wallpaper }
    })

    write(root / "receipts.json", {
        # msg_id -> "sent"|"delivered"|"seen"
    })


def get_profile(user_dir: str) -> dict:
    return read(user_root(user_dir) / "profile.json", {})


def get_prefs(user_dir: str) -> dict:
    return read(user_root(user_dir) / "prefs.json", {})


def get_privacy(user_dir: str) -> dict:
    return read(user_root(user_dir) / "privacy.json", {})


def get_theme(user_dir: str) -> dict:
    return read(user_root(user_dir) / "themes" / "current.json",
                {"mode": "system", "palette": "default"})


def get_rooms_meta(user_dir: str) -> dict:
    return read(user_root(user_dir) / "rooms.json", {})


def get_receipts(user_dir: str) -> dict:
    return read(user_root(user_dir) / "receipts.json", {})


def update_profile(user_dir: str, patch: dict) -> dict:
    allowed = {"display_name", "avatar", "email", "bio", "status"}
    clean = {k: v for k, v in patch.items() if k in allowed}
    clean["updated_at"] = now()
    return update(user_root(user_dir) / "profile.json", clean)


def update_prefs(user_dir: str, patch: dict) -> dict:
    return update(user_root(user_dir) / "prefs.json", patch)


def update_privacy(user_dir: str, patch: dict) -> dict:
    return update(user_root(user_dir) / "privacy.json", patch)


def update_theme(user_dir: str, mode: str, palette: str) -> dict:
    data = {"mode": mode, "palette": palette, "updated_at": now()}
    write(user_root(user_dir) / "themes" / "current.json", data)
    return data


def update_room_meta(user_dir: str, room_id: str, patch: dict) -> dict:
    path = user_root(user_dir) / "rooms.json"
    data = read(path, {})
    data.setdefault(room_id, {}).update(patch)
    write(path, data)
    return data[room_id]


def set_receipt(user_dir: str, msg_id: int, status: str) -> None:
    path = user_root(user_dir) / "receipts.json"
    data = read(path, {})
    # Only upgrade: sent → delivered → seen
    order = {"sent": 0, "delivered": 1, "seen": 2}
    current = data.get(str(msg_id), "sent")
    if order.get(status, 0) > order.get(current, 0):
        data[str(msg_id)] = status
        write(path, data)