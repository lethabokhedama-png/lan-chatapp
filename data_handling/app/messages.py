"""
/api/messages  — send, fetch (paginated), edit, delete, receipts, search
"""
from flask import Blueprint, request, jsonify
from utils.ids      import next_message_id, user_dir_name
from utils.shard    import (append_to_room_shard, append_to_user_shard,
                             get_messages_paginated, edit_message,
                             delete_message, update_receipts, list_room_shards,
                             read_room_shard)
from utils.user_fs  import set_receipt, update_room_meta, get_rooms_meta
from utils.audit    import log_message
from utils.time     import now
from app.middleware import require_auth
from pathlib        import Path
import config

bp = Blueprint("messages", __name__)


def _room_members_ids(room_id: str) -> list[int]:
    from utils.store import read
    p = Path(config.DATA_PATH) / "rooms" / room_id / "members.json"
    return [m["user_id"] for m in read(p, [])]


@bp.post("/<room_id>")
@require_auth
def send_message(room_id):
    d = request.json or {}

    # Validate membership
    if request.uid not in _room_members_ids(room_id):
        return jsonify({"error": "Not a member"}), 403

    msg_id = next_message_id()
    msg = {
        "id":           msg_id,
        "room_id":      room_id,
        "sender_id":    request.uid,
        "content":      d.get("content", ""),
        "type":         d.get("type", "text"),       # text|image|file|voice|system
        "file_id":      d.get("file_id"),
        "reply_to":     d.get("reply_to"),
        "client_id":    d.get("client_id"),          # optimistic UI correlation
        "created_at":   now(),
        "edited_at":    None,
        "_deleted":     False,
        "delivered_to": [request.uid],
        "seen_by":      [request.uid],
    }

    # Canonical room shard
    append_to_room_shard(room_id, msg)

    # Per-user mirrors for all members
    for uid in _room_members_ids(room_id):
        udir = user_dir_name(uid)
        if udir:
            append_to_user_shard(udir, room_id, msg)
            set_receipt(udir, msg_id, "sent")

    # Update sender's last_read
    sender_dir = user_dir_name(request.uid)
    if sender_dir:
        update_room_meta(sender_dir, room_id, {"last_read_id": msg_id})

    log_message("sent", request.uid, room_id, msg_id,
                {"type": msg["type"], "client_id": msg["client_id"]})
    return jsonify(msg), 201


@bp.get("/<room_id>")
@require_auth
def get_messages(room_id):
    before_id = request.args.get("before_id", type=int)
    limit     = min(request.args.get("limit", 50, type=int), 100)
    msgs      = get_messages_paginated(room_id, before_id=before_id, limit=limit)
    return jsonify(msgs)


@bp.patch("/<room_id>/<int:msg_id>")
@require_auth
def patch_message(room_id, msg_id):
    d       = request.json or {}
    content = d.get("content", "")
    updated = edit_message(room_id, msg_id, content, now())
    if not updated:
        return jsonify({"error": "Message not found"}), 404
    log_message("edited", request.uid, room_id, msg_id)
    return jsonify(updated)


@bp.delete("/<room_id>/<int:msg_id>")
@require_auth
def remove_message(room_id, msg_id):
    updated = delete_message(room_id, msg_id, now())
    if not updated:
        return jsonify({"error": "Message not found"}), 404
    log_message("deleted", request.uid, room_id, msg_id)
    return jsonify(updated)


@bp.post("/<room_id>/<int:msg_id>/delivered")
@require_auth
def mark_delivered(room_id, msg_id):
    updated = update_receipts(room_id, msg_id, "delivered_to", request.uid)
    udir    = user_dir_name(request.uid)
    if udir:
        set_receipt(udir, msg_id, "delivered")
    log_message("delivered", request.uid, room_id, msg_id)
    return jsonify(updated or {})


@bp.post("/<room_id>/<int:msg_id>/seen")
@require_auth
def mark_seen(room_id, msg_id):
    updated = update_receipts(room_id, msg_id, "seen_by", request.uid)
    udir    = user_dir_name(request.uid)
    if udir:
        set_receipt(udir, msg_id, "seen")
        update_room_meta(udir, room_id, {"last_read_id": msg_id})
    log_message("seen", request.uid, room_id, msg_id)
    return jsonify(updated or {})


@bp.get("/<room_id>/search")
@require_auth
def search_messages(room_id):
    q     = (request.args.get("q") or "").lower().strip()
    limit = min(request.args.get("limit", 30, type=int), 100)
    if not q:
        return jsonify([])

    results = []
    for month in list_room_shards(room_id):
        for msg in read_room_shard(room_id, month):
            if not msg.get("_deleted") and q in msg.get("content", "").lower():
                results.append(msg)
    return jsonify(results[-limit:])