"""
Admin account bootstrap.
Creates LethaboK account on first run if it doesn't exist.
"""
import config
from pathlib import Path
from utils.store import load_json, save_json
from utils.auth_helpers import hash_password
from utils.ids import next_id
import json, time

ADMIN_USERNAME    = "LethaboK"
ADMIN_DISPLAY     = "Lethabo"
ADMIN_PASSWORD    = "P@55word"
ADMIN_ROLE        = "admin"

def ensure_admin(data_path: str):
    index_path = Path(data_path) / "index.json"
    users_path = Path(data_path) / "users"

    if not index_path.exists():
        return  # store not bootstrapped yet

    index = json.loads(index_path.read_text()) if index_path.exists() else {}
    user_index = index.get("users", {})

    # Check if LethaboK already exists
    for uid_str, udata in user_index.items():
        if udata.get("username", "").lower() == ADMIN_USERNAME.lower():
            return  # already exists

    # Create admin user
    uid      = next_id(data_path, "user")
    pw_hash  = hash_password(ADMIN_PASSWORD)
    dir_name = f"{ADMIN_USERNAME}_{uid}"
    user_dir = users_path / dir_name
    user_dir.mkdir(parents=True, exist_ok=True)

    profile = {
        "id":           uid,
        "username":     ADMIN_USERNAME,
        "display_name": ADMIN_DISPLAY,
        "password":     pw_hash,
        "role":         ADMIN_ROLE,
        "created_at":   int(time.time() * 1000),
        "bio":          "LAN Chat Developer",
        "avatar_color": 0,
    }
    (user_dir / "profile.json").write_text(json.dumps(profile, indent=2))
    (user_dir / "prefs.json").write_text(json.dumps({}))
    (user_dir / "privacy.json").write_text(json.dumps({"show_online": True, "read_receipts": True}))
    (user_dir / "rooms.json").write_text(json.dumps([]))
    (user_dir / "receipts.json").write_text(json.dumps({}))

    # Update index
    index.setdefault("users", {})[str(uid)] = {
        "username": ADMIN_USERNAME,
        "dir":      dir_name,
        "role":     ADMIN_ROLE,
    }
    index_path.write_text(json.dumps(index, indent=2))
    print(f"  [Admin] Created admin account: {ADMIN_USERNAME} (uid={uid})")
