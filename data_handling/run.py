"""
LAN Chat — DataHandling API
The sole authority over DATA/. Never bypass this.

Run:
    python run.py

Port: 8000
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify
from flask_cors import CORS

from utils.store   import bootstrap
from utils.audit   import log_system
from app.auth      import bp as auth_bp
from app.users     import bp as users_bp
from app.rooms     import bp as rooms_bp
from app.messages  import bp as messages_bp
from app.uploads   import bp as uploads_bp
from app.events    import bp as events_bp
from app.dev       import bp as dev_bp

import config

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(auth_bp,     url_prefix="/api/auth")
app.register_blueprint(users_bp,    url_prefix="/api/users")
app.register_blueprint(rooms_bp,    url_prefix="/api/rooms")
app.register_blueprint(messages_bp, url_prefix="/api/messages")
app.register_blueprint(uploads_bp,  url_prefix="/api/uploads")
app.register_blueprint(events_bp,   url_prefix="/api/events")
app.register_blueprint(dev_bp,      url_prefix="/api/dev")

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "data_handling", "v": "1.0.0"})

# ── Middleware: log every request ──────────────────────────────────────────────
@app.after_request
def log_request(response):
    from flask import request
    log_system("http_request", {
        "method":  request.method,
        "path":    request.path,
        "status":  response.status_code,
        "ip":      request.remote_addr,
    })
    return response

# ── Boot ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    bootstrap(config.DATA_PATH)

    import socket as _sock
    try:
        s = _sock.socket(); s.connect(("8.8.8.8", 80))
        host_ip = s.getsockname()[0]; s.close()
    except Exception:
        host_ip = "127.0.0.1"

    from utils.ip_ledger import record_host
    record_host(host_ip)
    log_system("server_start", {"ip": host_ip, "port": config.PORT})

    print(f"\n  [DataHandling] http://{host_ip}:{config.PORT}")
    print(f"  [DataHandling] DATA → {config.DATA_PATH}\n")
    app.run(host=config.HOST, port=config.PORT, debug=False, threaded=True)