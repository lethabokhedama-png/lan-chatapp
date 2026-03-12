"""
/api/uploads  — file upload with content-addressed storage
Files stored under DATA/uploads/<type>/<sha256_prefix>/<sha256>.<ext>
"""
import hashlib, uuid
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file
from utils.audit    import log_upload
from utils.store    import write, read, ensure_dir
from utils.time     import now
from app.middleware import require_auth
import config

bp = Blueprint("uploads", __name__)

ALLOWED_IMAGES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_FILES  = {"application/pdf", "text/plain", "application/zip"}
ALLOWED_VOICE  = {"audio/webm", "audio/ogg", "audio/mpeg", "audio/wav"}
MAX_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


def _classify_mime(mime: str) -> str:
    if mime in ALLOWED_IMAGES: return "images"
    if mime in ALLOWED_VOICE:  return "voice"
    return "files"


def _store_path(bucket: str, sha: str, ext: str) -> Path:
    prefix = sha[:2]
    p = Path(config.DATA_PATH) / "uploads" / bucket / prefix
    ensure_dir(p)
    return p / f"{sha}{ext}"


@bp.post("/")
@require_auth
def upload():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400

    f       = request.files["file"]
    room_id = request.form.get("room_id", "")
    data    = f.read()

    if len(data) > MAX_SIZE_BYTES:
        return jsonify({"error": "File too large (max 25 MB)"}), 413

    mime    = f.content_type or "application/octet-stream"
    sha     = hashlib.sha256(data).hexdigest()
    ext     = Path(f.filename or "file").suffix.lower() or ""
    bucket  = _classify_mime(mime)
    fpath   = _store_path(bucket, sha, ext)

    # Content-addressed: skip if identical file already stored
    if not fpath.exists():
        fpath.write_bytes(data)

    file_id = sha  # The SHA256 IS the ID — deduplication is automatic

    meta = {
        "id":            file_id,
        "original_name": f.filename,
        "mime":          mime,
        "size":          len(data),
        "bucket":        bucket,
        "ext":           ext,
        "uploader_id":   request.uid,
        "room_id":       room_id,
        "uploaded_at":   now(),
        "_path":         str(fpath),   # internal, not sent to client
    }

    # Store metadata alongside the file
    write(fpath.with_suffix(".meta.json"), meta)
    log_upload(request.uid, file_id, mime, len(data), room_id)

    return jsonify({k: v for k, v in meta.items() if not k.startswith("_")}), 201


@bp.get("/<file_id>")
@require_auth
def get_file(file_id):
    # Search all buckets
    for bucket in ("images", "voice", "files"):
        prefix = file_id[:2]
        base   = Path(config.DATA_PATH) / "uploads" / bucket / prefix
        if not base.exists():
            continue
        for p in base.iterdir():
            if p.stem == file_id and p.suffix != ".json":
                meta_path = p.with_suffix(".meta.json")
                meta = read(meta_path, {})
                return send_file(p, download_name=meta.get("original_name", p.name),
                                 mimetype=meta.get("mime", "application/octet-stream"))
    return jsonify({"error": "Not found"}), 404