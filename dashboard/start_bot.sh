#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Start the Telegram bot (bot.py) in the background.
# Logs are written to /tmp/c2_bot.log
# ──────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SCRIPT="$PROJECT_DIR/bot.py"

if [ ! -f "$SCRIPT" ]; then
    SCRIPT="$PROJECT_DIR/bot (1).py"
fi

if [ ! -f "$SCRIPT" ]; then
    echo "[!] bot.py not found in $PROJECT_DIR"
    exit 1
fi

echo "[*] Starting Telegram bot: $SCRIPT"
nohup python3 "$SCRIPT" > /tmp/c2_bot.log 2>&1 &

echo "[+] Bot started (PID $!)"
echo "    Logs → /tmp/c2_bot.log"
