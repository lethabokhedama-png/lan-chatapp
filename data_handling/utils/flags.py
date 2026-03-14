import json
from pathlib import Path

DEFAULT_FLAGS = {
    "smart_replies": True, "voice_notes": True,
    "disappearing_photos": True, "read_receipts": True,
    "typing_indicators": True, "online_presence": True,
    "message_reactions": False, "link_previews": False,
    "group_mentions": True, "admin_panel": True,
    "one_time_view": True, "two_time_view": True,
    "max_voice_seconds": 300, "max_upload_mb": 10,
    "max_group_members": 50, "maintenance_mode": False,
    "registration_open": True,
}

def ensure_flags(data_path: str):
    flags_path = Path(data_path) / "dev" / "flags.json"
    flags_path.parent.mkdir(parents=True, exist_ok=True)
    existing = {}
    if flags_path.exists():
        try:
            existing = json.loads(flags_path.read_text()).get("global", {})
        except Exception:
            pass
    merged = {**DEFAULT_FLAGS, **existing}
    data = {"global": merged, "users": {}}
    if flags_path.exists():
        try:
            old = json.loads(flags_path.read_text())
            data["users"] = old.get("users", {})
        except Exception:
            pass
    data["global"] = merged
    flags_path.write_text(json.dumps(data, indent=2))
    print(f"  [Flags] Updated → {flags_path}")

def get_flags(data_path: str, uid: int = None) -> dict:
    flags_path = Path(data_path) / "dev" / "flags.json"
    if not flags_path.exists():
        return DEFAULT_FLAGS.copy()
    try:
        data  = json.loads(flags_path.read_text())
        flags = {**DEFAULT_FLAGS, **data.get("global", {})}
        if uid:
            flags.update(data.get("users", {}).get(str(uid), {}))
        return flags
    except Exception:
        return DEFAULT_FLAGS.copy()
