import os, secrets
from pathlib import Path

def load_or_create(data_path: str) -> str:
    p = Path(data_path) / "secret.key"
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        key = p.read_text().strip()
        if key:
            return key
    key = secrets.token_urlsafe(48)
    p.write_text(key)
    try:
        os.chmod(p, 0o600)
    except Exception:
        pass
    print(f"  [Secret] Generated new key -> {p}")
    return key
