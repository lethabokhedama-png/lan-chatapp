from flask import Blueprint, request, jsonify
from app.middleware import require_auth
from pathlib import Path
import json, re, config

bp = Blueprint("smart_replies", __name__)

REPLIES_FILE = Path(config.DATA_PATH) / "common_replies.json"

def _load():
    try:
        if REPLIES_FILE.exists():
            return json.loads(REPLIES_FILE.read_text())
        return {}
    except Exception:
        return {}

def _save(data):
    REPLIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    REPLIES_FILE.write_text(json.dumps(data, indent=2))

@bp.get("/smart-replies")
@require_auth
def get_smart_replies():
    uid  = request.uid
    q    = request.args.get("q", "").lower().strip()
    data = _load()
    suggestions = []
    for pattern, replies in data.items():
        if not q or any(w in q for w in pattern.split()):
            sorted_r = sorted(replies.items(), key=lambda x: x[1], reverse=True)
            suggestions += [r for r, _ in sorted_r[:2]]
    seen, result = set(), []
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            result.append(s)
        if len(result) >= 5:
            break
    return jsonify({"suggestions": result})

@bp.post("/learn-reply")
@require_auth
def learn_reply():
    uid         = request.uid
    body        = request.json or {}
    context_msg = (body.get("context") or "").lower().strip()
    reply       = (body.get("reply")   or "").strip()
    if not context_msg or not reply or len(reply) > 120:
        return jsonify({"ok": True})
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
