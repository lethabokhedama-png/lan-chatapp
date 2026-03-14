import os, hashlib, time
from flask import Blueprint, request, jsonify, send_file
from pathlib import Path
from app.middleware import require_auth
import config, json

bp = Blueprint("uploads", __name__)

UPLOAD_BASE = Path(config.DATA_PATH) / "uploads"

def _save_file(file, subdir):
    data     = file.read()
    sha      = hashlib.sha256(data).hexdigest()
    ext      = Path(file.filename).suffix.lower() or ".bin"
    rel_dir  = subdir / sha[:2]
    rel_dir.mkdir(parents=True, exist_ok=True)
    dest     = rel_dir / f"{sha}{ext}"
    if not dest.exists():
        dest.write_bytes(data)
    return sha, ext, str(dest)

@bp.post("/file")
@require_auth
def upload_file():
    uid  = request.uid
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file"}), 400
    sha, ext, path = _save_file(file, UPLOAD_BASE / "files")
    meta = {
        "id":         sha[:16],
        "sha":        sha,
        "filename":   file.filename,
        "ext":        ext,
        "url":        f"/api/uploads/serve/{sha[:2]}/{sha}{ext}",
        "type":       "file",
        "uploaded_by": uid,
        "uploaded_at": int(time.time() * 1000),
    }
    meta_path = UPLOAD_BASE / "files" / sha[:2] / f"{sha}.json"
    meta_path.write_text(json.dumps(meta))
    return jsonify(meta), 201

@bp.post("/voice")
@require_auth
def upload_voice():
    uid  = request.uid
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file"}), 400
    sha, ext, path = _save_file(file, UPLOAD_BASE / "voice")
    meta = {
        "id":         sha[:16],
        "sha":        sha,
        "filename":   file.filename,
        "ext":        ext,
        "url":        f"/api/uploads/voice-serve/{sha[:2]}/{sha}{ext}",
        "type":       "voice",
        "uploaded_by": uid,
        "uploaded_at": int(time.time() * 1000),
    }
    meta_path = UPLOAD_BASE / "voice" / sha[:2] / f"{sha}.json"
    meta_path.write_text(json.dumps(meta))
    return jsonify(meta), 201

@bp.post("/photo")
@require_auth
def upload_photo():
    uid       = request.uid
    file      = request.files.get("file")
    max_views = int(request.form.get("max_views", 1))
    if not file:
        return jsonify({"error": "No file"}), 400
    sha, ext, path = _save_file(file, UPLOAD_BASE / "photos")
    meta = {
        "id":          sha[:16],
        "sha":         sha,
        "filename":    file.filename,
        "ext":         ext,
        "url":         f"/api/uploads/photo-serve/{sha[:2]}/{sha}{ext}",
        "type":        "photo",
        "max_views":   max_views,
        "view_count":  0,
        "viewers":     [],
        "uploaded_by": uid,
        "uploaded_at": int(time.time() * 1000),
    }
    meta_path = UPLOAD_BASE / "photos" / sha[:2] / f"{sha}.json"
    meta_path.write_text(json.dumps(meta))
    return jsonify(meta), 201

@bp.post("/photo-view/<path:file_path>")
@require_auth
def view_photo(file_path):
    uid       = request.uid
    meta_path = UPLOAD_BASE / "photos" / Path(file_path).parent / f"{Path(file_path).stem}.json"
    if not meta_path.exists():
        return jsonify({"error": "Not found"}), 404
    meta = json.loads(meta_path.read_text())
    if uid not in meta["viewers"]:
        meta["viewers"].append(uid)
        meta["view_count"] = len(meta["viewers"])
    meta_path.write_text(json.dumps(meta))
    return jsonify(meta)

@bp.get("/serve/<path:file_path>")
def serve_file(file_path):
    p = UPLOAD_BASE / "files" / file_path
    if not p.exists(): return jsonify({"error": "Not found"}), 404
    return send_file(str(p))

@bp.get("/voice-serve/<path:file_path>")
def serve_voice(file_path):
    p = UPLOAD_BASE / "voice" / file_path
    if not p.exists(): return jsonify({"error": "Not found"}), 404
    return send_file(str(p), mimetype="audio/webm")

@bp.get("/photo-serve/<path:file_path>")
@require_auth
def serve_photo(file_path):
    uid       = request.uid
    meta_path = UPLOAD_BASE / "photos" / Path(file_path).parent / f"{Path(file_path).stem}.json"
    meta      = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    if meta.get("view_count", 0) >= meta.get("max_views", 1) and uid not in meta.get("viewers", []):
        return jsonify({"error": "Photo expired"}), 410
    p = UPLOAD_BASE / "photos" / file_path
    if not p.exists(): return jsonify({"error": "Not found"}), 404
    return send_file(str(p))
