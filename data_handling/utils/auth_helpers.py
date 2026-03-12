"""
HMAC-SHA256 signed tokens. No external JWT lib required.
Token format:  <base64_payload>.<hex_signature>
"""
import base64, hashlib, hmac, json
from typing import Optional
import config
from utils.time import now_ms


def make_token(user_id: int) -> str:
    payload = base64.urlsafe_b64encode(
        json.dumps({"uid": user_id, "ts": now_ms()}).encode()
    ).decode()
    sig = hmac.new(config.SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def verify_token(token: str) -> Optional[int]:
    try:
        payload, sig = token.rsplit(".", 1)
        expected = hmac.new(config.SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(base64.urlsafe_b64decode(payload + "=="))
        # Optionally check TTL
        age_ms = now_ms() - data.get("ts", 0)
        if age_ms > config.TOKEN_TTL * 1000:
            return None
        return data["uid"]
    except Exception:
        return None


def hash_password(password: str) -> str:
    import os
    salt = os.urandom(16).hex()
    h = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{h}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        return hmac.compare_digest(
            hashlib.sha256(f"{salt}{password}".encode()).hexdigest(), h
        )
    except Exception:
        return False