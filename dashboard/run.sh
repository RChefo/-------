#!/bin/bash
# ──────────────────────────────────────────────────────────────
# C2 Dashboard — run script (Linux / Kali / Ubuntu)
# Usage:
#   chmod +x run.sh
#   ./run.sh
#
# Optional env vars:
#   DASHBOARD_KEY=mysecret ./run.sh
#   C2_SERVER_URL=http://192.168.1.10:5000 ./run.sh
# ──────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  [*] Installing / verifying Python dependencies..."
pip3 install -r requirements.txt -q

echo "  [*] Starting C2 Dashboard on http://0.0.0.0:8080"
echo ""

python3 app.py
