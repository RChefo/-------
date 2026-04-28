import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes
from modules.crypto_utils import encrypt_data
import base64

TOKEN = "8782474352:AAEK1FCeLrNMqnGXPLgLJfJQ1qmiHV9i9d4"

# =========================
# 📩 استقبال النصوص
# =========================
async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        if not update.message or not update.message.text:
            return

        text = update.message.text
        chat_id = update.message.chat.id

        print("Text:", text)
        print("Chat ID:", chat_id)

        # 🔥 إرسال للـ C2 Server
        try:
            encrypted = encrypt_data(text)
            encoded = base64.b64encode(encrypted).decode()

            print("Encrypted:", encoded[:50])

            requests.post(
                "http://localhost:5000/data",
                json={
                    "client_id": "telegram",
                    "type": "text",
                    "encrypted_data": encoded,
                    "chat_id": chat_id
                },
                timeout=5
            )

        except Exception as e:
            print("C2 ERROR:", e)

        # 💾 حفظ محلي
        with open("data.txt", "a", encoding="utf-8") as f:
            f.write(text + "\n")

        await update.message.reply_text("✅ تم الإرسال للسيرفر")

    except Exception as e:
        print("TEXT HANDLER ERROR:", e)


# =========================
# 🖼️ استقبال الصور
# =========================
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        if not update.message or not update.message.photo:
            return

        photo = update.message.photo[-1]
        file = await photo.get_file()

        file_path = f"photo_{update.message.message_id}.jpg"
        await file.download_to_drive(file_path)

        print("Photo saved:", file_path)

        await update.message.reply_text("🖼️ تم استلام الصورة")

    except Exception as e:
        print("PHOTO HANDLER ERROR:", e)


# =========================
# 📁 استقبال الملفات
# =========================
async def handle_file(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        if not update.message or not update.message.document:
            return

        document = update.message.document
        file = await document.get_file()

        file_path = document.file_name
        await file.download_to_drive(file_path)

        print("File saved:", file_path)

        await update.message.reply_text("📁 تم استلام الملف")

    except Exception as e:
        print("FILE HANDLER ERROR:", e)


# =========================
# ⚠️ Error Handler
# =========================
async def error_handler(update, context):
    print("GLOBAL ERROR:", context.error)


# =========================
# 🚀 تشغيل البوت
# =========================
if __name__ == "__main__":
    app = ApplicationBuilder().token(TOKEN).connect_timeout(30).read_timeout(30).build()

    app.add_handler(MessageHandler(filters.TEXT, handle_text))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    app.add_handler(MessageHandler(filters.Document.ALL, handle_file))

    app.add_error_handler(error_handler)

    print("🤖 Bot is running...")

    app.run_polling()
