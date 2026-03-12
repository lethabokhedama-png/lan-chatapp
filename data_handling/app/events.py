"""
/api/events  — read audit log (admin/dev use)
"""
import json
from pathlib import Path
from flask import Blueprint, request, jsonify
from app.middleware import require_auth
import config

bp = Blueprint("events", __name__)


@bp.get("/recent")
@require_auth
def recent():
    limit  = min(request.args.get("limit", 100, type=int), 500)
    month  = request.args.get("month")   # e.g. "2026-03"
    logdir = Path(config.DATA_PATH) / "user_log"

    if month:
        files = [logdir / f"{month}.jsonl"]
    else:
        files = sorted(logdir.glob("*.jsonl"), reverse=True)[:2]

    events = []
    for f in files:
        if not f.exists():
            continue
        for line in f.read_text(encoding="utf-8").splitlines():
            try:
                events.append(json.loads(line))
            except Exception:
                pass

    return jsonify(events[-limit:])