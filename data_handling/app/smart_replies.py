"""
Smart replies — learns from chat history in DATA/
Returns contextual suggestions based on the last message
"""
from flask import Blueprint, request, jsonify
from app.middleware import require_auth
from utils.store import load_json, save_json
from pathlib import Path
import config, re

bp = Blueprint("smart_replies", __name__)

REPLIES_FILE = Path(config.DATA_PATH) / "common_replies.json"

def _load():
    try:
        return load_json(str(REPLIES_FILE)) or {}
    except Exception:
        return {}

def _save(data):
    REPLIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    save_json(str(REPLIES_FILE), data)

@bp.get("/smart-replies")
@require_auth
def get_smart_replies(uid):
    q   = request.args.get("q", "").lower().strip()
    data = _load()

    # Find replies that were commonly sent after similar messages
    suggestions = []
    for pattern, replies in data.items():
        if not q or any(w in q for w in pattern.split()):
            # Sort by frequency
            sorted_r = sorted(replies.items(), key=lambda x: x[1], reverse=True)
            suggestions += [r for r, _ in sorted_r[:2]]

    # Deduplicate, max 5
    seen = set()
    result = []
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            result.append(s)
        if len(result) >= 5:
            break

    return jsonify({"suggestions": result})

@bp.post("/learn-reply")
@require_auth
def learn_reply(uid):
    """Called when a user sends a message — record what they replied with"""
    body        = request.json or {}
    context_msg = (body.get("context") or "").lower().strip()
    reply       = (body.get("reply")   or "").strip()

    if not context_msg or not reply or len(reply) > 120:
        return jsonify({"ok": True})

    # Use first 3 words of context as the pattern key
    words   = re.sub(r"[^\w\s]", "", context_msg).split()[:3]
    pattern = " ".join(words)
    if not pattern:
        return jsonify({"ok": True})

    data = _load()
    if pattern not in data:
        data[pattern] = {}
    data[pattern][reply] = data[pattern].get(reply, 0) + 1
    _save(data)

    return jsonify({"ok": True})
