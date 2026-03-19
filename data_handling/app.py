import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import config
from utils.secret import load_or_create
config.SECRET = load_or_create(config.DATA_PATH)

from flask import Flask, jsonify, request
from flask_cors import CORS
from utils.store  import bootstrap
from utils.audit  import log_system
from app.auth     import bp as auth_bp
from app.users    import bp as users_bp
from app.rooms    import bp as rooms_bp
from app.messages import bp as messages_bp
from app.uploads  import bp as uploads_bp
from app.events   import bp as events_bp
from app.dev      import bp as dev_bp, ensure_dev_account, ensure_flags

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(auth_bp,     url_prefix="/api/auth")
app.register_blueprint(users_bp,    url_prefix="/api/users")
app.register_blueprint(rooms_bp,    url_prefix="/api/rooms")
app.register_blueprint(messages_bp, url_prefix="/api/messages")
app.register_blueprint(uploads_bp,  url_prefix="/api/uploads")
app.register_blueprint(events_bp,   url_prefix="/api/events")
app.register_blueprint(dev_bp,      url_prefix="/api/dev")

@app.get("/")
def root():
    return jsonify({"service": "LAN Chat API", "status": "ok", "v": "1.7.15"})

@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "v": "1.7.15"})

import time as _time
_req_start = {}

@app.before_request
def before():
    _req_start[request.environ.get("REQUEST_ID",id(request))] = _time.time()

import time as _time
_req_start = {}

@app.before_request
def before():
    _req_start[request.environ.get("REQUEST_ID",id(request))] = _time.time()

@app.after_request
def after(response):
    rid = request.environ.get("REQUEST_ID", id(request))
    ms  = round((_time.time() - _req_start.pop(rid, _time.time())) * 1000)
    print(f"  [{request.method}] {request.path} {response.status_code} {ms}ms")
    rid = request.environ.get("REQUEST_ID", id(request))
    ms  = round((_time.time() - _req_start.pop(rid, _time.time())) * 1000)
    print(f"  [{request.method}] {request.path} {response.status_code} {ms}ms")
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "*"
    return response

if __name__ == "__main__":
    bootstrap(config.DATA_PATH)
    ensure_dev_account()
    ensure_flags()

    import socket as _sock
    try:
        s = _sock.socket(); s.connect(("8.8.8.8", 80))
        host_ip = s.getsockname()[0]; s.close()
    except Exception:
        host_ip = "0.0.0.0"

    from utils.ip_ledger import record_host
    record_host(host_ip)
    log_system("server_start", {"ip": host_ip, "port": config.PORT})

    print(f"\n  [API] http://{host_ip}:{config.PORT}")
    print(f"  [API] DATA → {config.DATA_PATH}\n")

    import os
    cert = os.path.expanduser('~/chatapp/cert.pem')
    key  = os.path.expanduser('~/chatapp/key.pem')
    ssl  = (cert, key) if os.path.exists(cert) and os.path.exists(key) else None
    if ssl:
        print(f"  [API] HTTPS on port {config.PORT}\n")
    try:
        from waitress import serve
        if ssl:
            import ssl as _ssl
            ctx = _ssl.SSLContext(_ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(cert, key)
            serve(app, host=config.HOST, port=config.PORT, threads=8, url_scheme='https')
        else:
            serve(app, host=config.HOST, port=config.PORT, threads=8)
    except ImportError:
        app.run(host=config.HOST, port=config.PORT, debug=True,
                use_reloader=False, threaded=True,
                ssl_context=ssl)
