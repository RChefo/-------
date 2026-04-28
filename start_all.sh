#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║              C2 Project — Start All Services                    ║
# ║  Usage:  ./start_all.sh                                         ║
# ║  Env:    DASHBOARD_KEY=secret C2_SERVER_URL=http://... ./start_all.sh
# ╚══════════════════════════════════════════════════════════════════╝

set -uo pipefail   # -u = error on unset vars, -o pipefail = pipe errors
                   # NOTE: -e intentionally omitted so pkill/sleep never abort

# ── Colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m';  GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';  BOLD='\033[1m'; DIM='\033[2m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────
info()    { echo -e "  ${BLUE}[•]${NC} $*"; }
ok()      { echo -e "  ${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "  ${YELLOW}[!]${NC} $*"; }
err()     { echo -e "  ${RED}[✗]${NC} $*" >&2; }
section() { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}"; }

# ── Project root (wherever this script lives) ─────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Environment defaults ──────────────────────────────────────────────────
export DASHBOARD_KEY="${DASHBOARD_KEY:-dashboard_secret_2026}"
export C2_SERVER_URL="${C2_SERVER_URL:-http://localhost:5000}"

# ── PID file (written here, read by stop_all.sh) ─────────────────────────
PID_FILE="/tmp/c2_project_pids.env"

# ═════════════════════════════════════════════════════════════════════════
# BANNER
# ═════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${RED}  ☠  C2 Control Platform${NC}${DIM}  —  starting all services${NC}"
echo -e "  ${DIM}Project: ${PROJECT_DIR}${NC}"
echo -e "  ${DIM}Key:     ${DASHBOARD_KEY:0:8}…${NC}\n"

# ═════════════════════════════════════════════════════════════════════════
# STEP 1 — Kill any stale processes
# ═════════════════════════════════════════════════════════════════════════
section "Cleaning up stale processes"

_kill() {
    local pattern="$1" label="$2"
    if pkill -f "$pattern" 2>/dev/null; then
        warn "Killed existing ${label} (${pattern})"
    else
        info "${label} was not running — skipping"
    fi
}

_kill "c2_server.py"     "C2 Server"
_kill "bot.py"           "Telegram Bot"
_kill "dashboard/app.py" "Flask Dashboard"
_kill "next"             "Next.js Frontend"

sleep 1   # Give OS time to release ports

# ═════════════════════════════════════════════════════════════════════════
# STEP 2 — C2 Server  (port 5000)
# ═════════════════════════════════════════════════════════════════════════
section "Starting C2 Server  →  :5000"

C2_SCRIPT="$PROJECT_DIR/c2_server.py"
if [[ ! -f "$C2_SCRIPT" ]]; then
    # Try Windows-style backup name
    C2_SCRIPT="$PROJECT_DIR/c2_server (1).py"
fi

if [[ ! -f "$C2_SCRIPT" ]]; then
    err "c2_server.py not found in $PROJECT_DIR"
    exit 1
fi

nohup python3 "$C2_SCRIPT" \
    > /tmp/c2_server.log 2>&1 &
C2_PID=$!
ok "C2 Server started  (PID ${C2_PID})  →  /tmp/c2_server.log"

sleep 2   # Let Flask bind the port before the bot tries to reach it

# ═════════════════════════════════════════════════════════════════════════
# STEP 3 — Telegram Bot
# ═════════════════════════════════════════════════════════════════════════
section "Starting Telegram Bot"

BOT_SCRIPT="$PROJECT_DIR/bot.py"
if [[ ! -f "$BOT_SCRIPT" ]]; then
    BOT_SCRIPT="$PROJECT_DIR/bot (1).py"
fi

if [[ ! -f "$BOT_SCRIPT" ]]; then
    warn "bot.py not found — skipping"
    BOT_PID=0
else
    nohup python3 "$BOT_SCRIPT" \
        > /tmp/c2_bot.log 2>&1 &
    BOT_PID=$!
    ok "Telegram Bot started  (PID ${BOT_PID})  →  /tmp/c2_bot.log"
fi

sleep 1

# ═════════════════════════════════════════════════════════════════════════
# STEP 4 — Flask Dashboard  (port 8080)
# ═════════════════════════════════════════════════════════════════════════
section "Starting Flask Dashboard  →  :8080"

DASHBOARD_DIR="$PROJECT_DIR/dashboard"
if [[ ! -d "$DASHBOARD_DIR" ]]; then
    err "dashboard/ directory not found in $PROJECT_DIR"
    exit 1
fi

if [[ ! -f "$DASHBOARD_DIR/app.py" ]]; then
    err "dashboard/app.py not found"
    exit 1
fi

# Install Python dependencies if requirements.txt exists
if [[ -f "$DASHBOARD_DIR/requirements.txt" ]]; then
    info "Checking Python dependencies..."
    pip3 install -r "$DASHBOARD_DIR/requirements.txt" -q \
        && ok "Python dependencies satisfied" \
        || warn "pip3 install had warnings (check manually)"
fi

nohup python3 "$DASHBOARD_DIR/app.py" \
    > /tmp/dashboard.log 2>&1 &
DASHBOARD_PID=$!
ok "Flask Dashboard started  (PID ${DASHBOARD_PID})  →  /tmp/dashboard.log"

sleep 1

# ═════════════════════════════════════════════════════════════════════════
# STEP 5 — Next.js Frontend  (port 3000)
# ═════════════════════════════════════════════════════════════════════════
section "Starting Next.js Frontend  →  :3000"

FRONTEND_DIR="$PROJECT_DIR/frontend"
if [[ ! -d "$FRONTEND_DIR" ]]; then
    err "frontend/ directory not found in $PROJECT_DIR"
    exit 1
fi

cd "$FRONTEND_DIR"

# Auto-install node_modules if missing
if [[ ! -d "node_modules" ]]; then
    info "node_modules not found — running npm install..."
    npm install --silent \
        && ok "npm install complete" \
        || { err "npm install failed — check /tmp/frontend.log"; exit 1; }
fi

NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8080}" \
NEXT_PUBLIC_DASHBOARD_KEY="${DASHBOARD_KEY}" \
nohup npm run dev \
    > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
ok "Next.js Frontend started  (PID ${FRONTEND_PID})  →  /tmp/frontend.log"

cd "$PROJECT_DIR"

# ═════════════════════════════════════════════════════════════════════════
# Write PID file
# ═════════════════════════════════════════════════════════════════════════
cat > "$PID_FILE" << EOF
# C2 Project PIDs — written by start_all.sh on $(date)
C2_PID=${C2_PID}
BOT_PID=${BOT_PID}
DASHBOARD_PID=${DASHBOARD_PID}
FRONTEND_PID=${FRONTEND_PID}
EOF

sleep 3   # Give services time to fully initialise before printing URLs

# ═════════════════════════════════════════════════════════════════════════
# FINAL STATUS
# ═════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${GREEN}══ All services launched ══${NC}\n"

_status_line() {
    local label="$1" pattern="$2" url="$3"
    if pgrep -f "$pattern" > /dev/null 2>&1; then
        echo -e "  ${GREEN}●${NC} ${BOLD}${label}${NC}  ${DIM}→${NC}  ${CYAN}${url}${NC}"
    else
        echo -e "  ${RED}●${NC} ${BOLD}${label}${NC}  ${DIM}(may still be starting…)${NC}"
    fi
}

_status_line "C2 Server       " "c2_server.py"     "http://localhost:5000"
_status_line "Telegram Bot    " "bot.py"            "(background)"
_status_line "Flask Dashboard " "dashboard/app.py"  "http://localhost:8080"
_status_line "Next.js Frontend" "next"              "http://localhost:3000"

echo -e "\n  ${DIM}Logs:  tail -f /tmp/c2_server.log  /tmp/dashboard.log  /tmp/frontend.log${NC}"
echo -e "  ${DIM}Stop:  ./stop_all.sh${NC}"
echo -e "  ${DIM}PIDs:  ${PID_FILE}${NC}\n"
