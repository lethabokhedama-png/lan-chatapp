"""
audit.py — append-only JSONL event log.
Files: DATA/user_log/YYYY-MM.jsonl

Every significant action is logged here:
  - auth events (signup, login, logout)
  - message events (sent, edited, deleted, seen, delivered)
  - room events (created, joined, left)
  - system events (server start, http requests)
  - file uploads
  - settings changes
  - errors
"""
from pathlib import Path
import config
from utils.store import append_jsonl
from utils.time  import now, month_key


def _log_path() -> Path:
    return Path(config.DATA_PATH) / "user_log" / f"{month_key()}.jsonl"


def _write(event_type: str, payload: dict, actor_id: int | None = None) -> None:
    record = {
        "ts":         now(),
        "type":       event_type,
        "actor_id":   actor_id,
        **payload,
    }
    append_jsonl(_log_path(), record)


# ── Public helpers ─────────────────────────────────────────────────────────────

def log_auth(action: str, user_id: int, username: str, ip: str) -> None:
    _write(f"auth.{action}", {"user_id": user_id, "username": username, "ip": ip}, user_id)


def log_message(action: str, user_id: int, room_id: str,
                msg_id: int, extra: dict | None = None) -> None:
    _write(f"message.{action}", {
        "user_id": user_id,
        "room_id": room_id,
        "msg_id":  msg_id,
        **(extra or {}),
    }, user_id)


def log_room(action: str, user_id: int, room_id: str, extra: dict | None = None) -> None:
    _write(f"room.{action}", {
        "user_id": user_id,
        "room_id": room_id,
        **(extra or {}),
    }, user_id)


def log_upload(user_id: int, file_id: str, mime: str, size: int, room_id: str) -> None:
    _write("upload.file", {
        "user_id": user_id,
        "file_id": file_id,
        "mime":    mime,
        "size":    size,
        "room_id": room_id,
    }, user_id)


def log_settings(user_id: int, section: str, changes: dict) -> None:
    _write("settings.change", {
        "user_id": user_id,
        "section": section,
        "changes": changes,
    }, user_id)


def log_system(event: str, payload: dict) -> None:
    _write(f"system.{event}", payload)


def log_error(event: str, payload: dict, user_id: int | None = None) -> None:
    _write(f"error.{event}", payload, user_id)