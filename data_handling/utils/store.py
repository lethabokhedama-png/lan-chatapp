"""
store.py — atomic JSON I/O + DATA/ bootstrap.

All reads/writes go through read() / write() / update() so that:
  • Writes are atomic  (write to .tmp, then os.replace)
  • Reads never crash  (return `default` on missing/corrupt files)
  • Concurrent threads don't corrupt files  (per-path lock)
"""
import json, os, threading
from pathlib import Path
from typing  import Any

_locks: dict[str, threading.Lock] = {}
_gl    = threading.Lock()


def _lock(path: str) -> threading.Lock:
    with _gl:
        if path not in _locks:
            _locks[path] = threading.Lock()
        return _locks[path]


# ── Public API ─────────────────────────────────────────────────────────────────

def read(path: str | Path, default: Any = None) -> Any:
    p = str(path)
    with _lock(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return default if default is not None else {}


def write(path: str | Path, data: Any) -> None:
    p = str(path)
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with _lock(p):
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        os.replace(tmp, p)


def update(path: str | Path, patch: dict) -> dict:
    """Atomic read-merge-write. Returns merged result."""
    p = str(path)
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with _lock(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            data = {}
        _deep_merge(data, patch)
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        os.replace(tmp, p)
    return data


def append_jsonl(path: str | Path, record: dict) -> None:
    """Append one JSON line to a .jsonl file (audit log)."""
    p = str(path)
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with _lock(p):
        with open(p, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False, default=str) + "\n")


def append_to_list(path: str | Path, item: Any, key: str | None = None) -> list:
    """Append item to a JSON array (or to array at `key` inside a JSON object)."""
    p = str(path)
    os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
    with _lock(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            data = [] if key is None else {}

        if key:
            data.setdefault(key, [])
            data[key].append(item)
            result = data[key]
        else:
            if not isinstance(data, list):
                data = []
            data.append(item)
            result = data

        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        os.replace(tmp, p)
    return result


def ensure_dir(path: str | Path) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def exists(path: str | Path) -> bool:
    return Path(path).exists()


# ── Deep merge ─────────────────────────────────────────────────────────────────

def _deep_merge(base: dict, patch: dict) -> dict:
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_merge(base[k], v)
        else:
            base[k] = v
    return base


# ── Bootstrap DATA/ ────────────────────────────────────────────────────────────

def bootstrap(data_path: str) -> None:
    """Create DATA/ skeleton on first run."""
    dp = Path(data_path)

    dirs = [
        dp,
        dp / "ip_history",
        dp / "user_log",
        dp / "uploads" / "images",
        dp / "uploads" / "files",
        dp / "uploads" / "voice",
        dp / "rooms",
        dp / "users",
        dp / "dev",
    ]
    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)

    # Global index
    idx = dp / "index.json"
    if not idx.exists():
        write(idx, {
            "version":          "1.0.0",
            "counters":         {"users": 0, "rooms": 0, "messages": 0},
            "users_by_id":      {},
            "users_by_username":{},
            "rooms_by_id":      {},
            "rooms_by_type":    {"channel": [], "dm": []},
            "last_updated":     None,
        })

    # Dev flags
    flags = dp / "dev" / "flags.json"
    if not flags.exists():
        write(flags, {
            "features":  {
                "dev_panel":        False,
                "backup_button":    False,
                "mentions_inbox":   True,
                "smart_replies":    True,
                "per_room_wallpaper": True,
            },
            "overrides": {},
        })