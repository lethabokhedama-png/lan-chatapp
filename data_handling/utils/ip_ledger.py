"""
IP Ledger — tracks server host IPs and client access.
Files:  DATA/ip_history/.IP.json
"""
from pathlib import Path
import config
from utils.store import read, write, append_jsonl
from utils.time  import now


def _ip_file() -> Path:
    return Path(config.DATA_PATH) / "ip_history" / ".IP.json"


def record_host(ip: str) -> None:
    """Called on server start. Deduplicates consecutive identical IPs."""
    data = read(_ip_file(), {"hosts": [], "last": None})
    if data.get("last") != ip:
        data["hosts"].append({"ip": ip, "first_seen": now(), "role": "host"})
        data["last"] = ip
        write(_ip_file(), data)


def record_access(ip: str, user_id: int | None = None) -> None:
    """Called per-request. Lightweight dedup (skip if same IP as last 10)."""
    data = read(_ip_file(), {"hosts": [], "last": None, "accesses": []})
    recent = [a["ip"] for a in data.get("accesses", [])[-10:]]
    if ip not in recent:
        data.setdefault("accesses", []).append({
            "ip": ip,
            "user_id": user_id,
            "time": now(),
        })
        data["accesses"] = data["accesses"][-2000:]  # keep last 2000
        write(_ip_file(), data)


def get_ledger() -> dict:
    return read(_ip_file(), {"hosts": [], "accesses": []})