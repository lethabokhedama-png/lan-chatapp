"""
shard.py — monthly JSON shard helpers.

Messages live in:
  DATA/rooms/<room_id>/messages/YYYY-MM.json   ← canonical log
  DATA/users/<user_dir>/messages/<room_id>/YYYY-MM.json  ← per-user mirror

Each shard file is a JSON array of message objects.
Appends are atomic via store.write().
"""
from pathlib import Path
from typing  import Any

import config
from utils.store import read, write
from utils.time  import month_key


# ── Room shards ────────────────────────────────────────────────────────────────

def room_shard_path(room_id: str, month: str | None = None) -> Path:
    m = month or month_key()
    return Path(config.DATA_PATH) / "rooms" / room_id / "messages" / f"{m}.json"


def append_to_room_shard(room_id: str, message: dict) -> None:
    p = room_shard_path(room_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    shard: list = read(p, [])
    shard.append(message)
    write(p, shard)


def read_room_shard(room_id: str, month: str) -> list:
    return read(room_shard_path(room_id, month), [])


def list_room_shards(room_id: str) -> list[str]:
    """Returns sorted list of month keys, e.g. ['2026-03', '2026-04']."""
    d = Path(config.DATA_PATH) / "rooms" / room_id / "messages"
    if not d.exists():
        return []
    return sorted(f.stem for f in d.glob("*.json"))


# ── User message mirror ────────────────────────────────────────────────────────

def user_shard_path(user_dir: str, room_id: str, month: str | None = None) -> Path:
    m = month or month_key()
    return (Path(config.DATA_PATH) / "users" / user_dir
            / "messages" / room_id / f"{m}.json")


def append_to_user_shard(user_dir: str, room_id: str, message: dict) -> None:
    p = user_shard_path(user_dir, room_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    shard: list = read(p, [])
    shard.append(message)
    write(p, shard)


# ── Pagination helper ──────────────────────────────────────────────────────────

def get_messages_paginated(room_id: str,
                            before_id: int | None = None,
                            limit: int = 50) -> list[dict]:
    """
    Returns up to `limit` messages ordered oldest-first,
    ending before `before_id` (for infinite-scroll pagination).
    Walks shards newest-first and stops early.
    """
    shards = list_room_shards(room_id)[::-1]  # newest first
    collected: list[dict] = []

    for month in shards:
        msgs = read_room_shard(room_id, month)
        # filter tombstoned deletions out of display (keep for audit)
        visible = [m for m in msgs if not m.get("_deleted")]
        if before_id is not None:
            visible = [m for m in visible if m["id"] < before_id]
        collected = visible + collected
        if len(collected) >= limit:
            break

    return collected[-limit:]


# ── Message mutation (tombstone) ───────────────────────────────────────────────

def _find_and_patch(room_id: str, msg_id: int, patch: dict) -> dict | None:
    """Scan shards to find `msg_id`, apply patch in-place, rewrite shard."""
    for month in list_room_shards(room_id)[::-1]:
        p   = room_shard_path(room_id, month)
        msgs = read(p, [])
        for i, m in enumerate(msgs):
            if m.get("id") == msg_id:
                msgs[i].update(patch)
                write(p, msgs)
                return msgs[i]
    return None


def edit_message(room_id: str, msg_id: int, new_content: str, ts: str) -> dict | None:
    return _find_and_patch(room_id, msg_id, {
        "content":   new_content,
        "edited_at": ts,
    })


def delete_message(room_id: str, msg_id: int, ts: str) -> dict | None:
    """Tombstone — blanks content, keeps record for audit."""
    return _find_and_patch(room_id, msg_id, {
        "_deleted":   True,
        "content":    "",
        "deleted_at": ts,
    })


def update_receipts(room_id: str, msg_id: int,
                    field: str, user_id: int) -> dict | None:
    """Add user_id to delivered_to or seen_by list."""
    for month in list_room_shards(room_id)[::-1]:
        p   = room_shard_path(room_id, month)
        msgs = read(p, [])
        for i, m in enumerate(msgs):
            if m.get("id") == msg_id:
                lst = msgs[i].setdefault(field, [])
                if user_id not in lst:
                    lst.append(user_id)
                    write(p, msgs)
                return msgs[i]
    return None