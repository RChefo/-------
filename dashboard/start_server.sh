#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Start the C2 server (c2_server.py) in the background.
# Logs are written to /tmp/c2_server.log
# ──────────────────────────────────────────────────────────────

set -e

# Project root is one level above this script
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SCRIPT="$PROJECT_DIR/c2_server.py"

# Try the '(1)' variant if the plain name does not exist
if [ ! -f "$SCRIPT" ]; then
    SCRIPT="$PROJECT_DIR/c2_server (1).py"
fi

if [ ! -f "$SCRIPT" ]; then
    echo "[!] c2_server.py not found in $PROJECT_DIR"
    exit 1
fi

echo "[*] Starting C2 server: $SCRIPT"
nohup python3 "$SCRIPT" > /tmp/c2_server.log 2>&1 &

echo "[+] C2 server started (PID $!)"
echo "    Logs → /tmp/c2_server.log"
