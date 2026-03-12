"""
ID generation and global index management.
All IDs are auto-incrementing integers.
Username directories are named  <username>_<id>/
"""
import threading
from pathlib import Path
import config
from utils.store import read, write

_lock = threading.Lock()


def _idx_path() -> Path:
    return Path(config.DATA_PATH) / "index.json"


def _read_idx() -> dict:
    return read(_idx_path(), {})


def _write_idx(data: dict) -> None:
    write(_idx_path(), data)


# ── Next IDs ───────────────────────────────────────────────────────────────────

def next_user_id() -> int:
    with _lock:
        idx = _read_idx()
        idx.setdefault("counters", {})
        n = idx["counters"].get("users", 0) + 1
        idx["counters"]["users"] = n
        _write_idx(idx)
        return n


def next_room_id() -> int:
    with _lock:
        idx = _read_idx()
        idx.setdefault("counters", {})
        n = idx["counters"].get("rooms", 0) + 1
        idx["counters"]["rooms"] = n
        _write_idx(idx)
        return n


def next_message_id() -> int:
    with _lock:
        idx = _read_idx()
        idx.setdefault("counters", {})
        n = idx["counters"].get("messages", 0) + 1
        idx["counters"]["messages"] = n
        _write_idx(idx)
        return n


# ── Registry helpers ───────────────────────────────────────────────────────────

def register_user(user_id: int, username: str, display_name: str) -> None:
    with _lock:
        idx = _read_idx()
        idx.setdefault("users_by_id", {})[str(user_id)] = {
            "username": username,
            "display_name": display_name,
            "dir": f"{username}_{user_id}",
        }
        idx.setdefault("users_by_username", {})[username.lower()] = user_id
        _write_idx(idx)


def register_room(room_id: str, name: str, rtype: str) -> None:
    with _lock:
        idx = _read_idx()
        idx.setdefault("rooms_by_id", {})[room_id] = {"name": name, "type": rtype}
        idx.setdefault("rooms_by_type", {}).setdefault(rtype, [])
        if room_id not in idx["rooms_by_type"][rtype]:
            idx["rooms_by_type"][rtype].append(room_id)
        _write_idx(idx)


def username_taken(username: str) -> bool:
    idx = _read_idx()
    return username.lower() in idx.get("users_by_username", {})


def id_for_username(username: str) -> int | None:
    idx = _read_idx()
    return idx.get("users_by_username", {}).get(username.lower())


def user_dir_name(user_id: int) -> str | None:
    """Returns  '<username>_<id>'  or None."""
    idx = _read_idx()
    entry = idx.get("users_by_id", {}).get(str(user_id))
    return entry["dir"] if entry else None


def dm_room_id(uid_a: int, uid_b: int) -> str:
    """Deterministic DM room ID from two user IDs."""
    import hashlib
    pair = "-".join(str(x) for x in sorted([uid_a, uid_b]))
    return "dm_" + hashlib.sha1(pair.encode()).hexdigest()[:14]