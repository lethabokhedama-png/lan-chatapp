"""
Shared middleware for all blueprints.
"""
import functools
from flask import request, jsonify
from utils.auth_helpers import verify_token
from utils.ip_ledger    import record_access


def require_auth(f):
    """Decorator: verifies Bearer token, sets request.uid."""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        raw = request.headers.get("Authorization", "")
        token = raw.removeprefix("Bearer ").strip()
        if not token:
            return jsonify({"error": "Missing token"}), 401
        uid = verify_token(token)
        if uid is None:
            return jsonify({"error": "Invalid or expired token"}), 401
        record_access(request.remote_addr, uid)
        request.uid = uid
        return f(*args, **kwargs)
    return wrapper