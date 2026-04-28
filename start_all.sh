#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  C2 Control Platform — One-command startup                              ║
# ║                                                                          ║
# ║  Usage:                                                                  ║
# ║    ./start_all.sh                    # normal start                     ║
# ║    FORCE_BUILD=true ./start_all.sh   # rebuild Next.js before start     ║
# ║    DASHBOARD_KEY=mysecret ./start_all.sh                                ║
# ╚══════════════════════════════════════════════════════════════════════════╝

# -u: error on unset vars   -o pipefail: propagate pipe errors
# NOTE: -e intentionally omitted — pkill / pgrep return non-zero when nothing
#       found and must not abort the script.
set -uo pipefail

# ── Colours ───────────────────────────────────────────────────────────────
RED='\033[0;31m';  GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m';  BOLD='\033[1m'; DIM='\033[2m'
NC='\033[0m'

info()    { echo -e "  ${BLUE}[•]${NC} $*"; }
ok()      { echo -e "  ${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "  ${YELLOW}[!]${NC} $*"; }
err()     { echo -e "  ${RED}[✗]${NC} $*" >&2; }
section() { echo -e "\n${BOLD}${CYAN}══ $* ══${NC}"; }

# ── Paths ─────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$PROJECT_DIR/venv"
PYTHON="$VENV/bin/python"
PID_FILE="/tmp/c2_project_pids.env"

# ── Config (all overridable via env vars) ─────────────────────────────────
export DASHBOARD_KEY="${DASHBOARD_KEY:-dashboard_secret_2026}"
export C2_SERVER_URL="${C2_SERVER_URL:-http://localhost:5000}"
export BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
export PYTHON_BIN="$PYTHON"          # used by dashboard/app.py for sub-process spawning
FORCE_BUILD="${FORCE_BUILD:-false}"

C2_PORT=5000
DASH_PORT=8080
FRONT_PORT=3000

# ── LAN IP detection ──────────────────────────────────────────────────────
LAN_IP=""
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}' | tr -d ' ')
[[ -z "$LAN_IP" ]] && LAN_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
[[ -z "$LAN_IP" ]] && LAN_IP="<your-machine-ip>"

# ── Banner ────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${RED}  ☠  C2 Control Platform${NC}${DIM}  —  starting all services${NC}"
echo -e "  ${DIM}Project : ${PROJECT_DIR}${NC}"
echo -e "  ${DIM}LAN IP  : ${LAN_IP}${NC}\n"

# ── Port conflict check ───────────────────────────────────────────────────
_port_in_use() {
    local port=$1
    if command -v ss &>/dev/null; then
        ss -tlnp 2>/dev/null | grep -q ":${port} "
        return $?
    elif command -v netstat &>/dev/null; then
        netstat -tlnp 2>/dev/null | grep -q ":${port} "
        return $?
    fi
    return 1
}

for _p in $C2_PORT $DASH_PORT $FRONT_PORT; do
    if _port_in_use "$_p"; then
        warn "Port ${_p} is already in use — existing process may conflict"
    fi
done

# ═════════════════════════════════════════════════════════════════════════
# STEP 1 — Python virtual environment
# ═════════════════════════════════════════════════════════════════════════
section "Python Virtual Environment"

if [[ ! -d "$VENV" ]]; then
    info "Creating venv at ${VENV} ..."
    python3 -m venv "$VENV" || { err "python3 -m venv failed — is python3 installed?"; exit 1; }
    ok "venv created"
else
    info "venv exists  →  ${VENV}"
fi

if [[ -f "$PROJECT_DIR/requirements.txt" ]]; then
    info "Installing / updating Python dependencies ..."
    "$PYTHON" -m pip install -q --upgrade pip 2>/dev/null || true
    "$PYTHON" -m pip install -q -r "$PROJECT_DIR/requirements.txt" \
        && ok "Python dependencies satisfied" \
        || warn "pip install had warnings — check manually"
fi

# ═════════════════════════════════════════════════════════════════════════
# STEP 2 — Kill any stale processes
# ═════════════════════════════════════════════════════════════════════════
section "Cleaning up stale processes"

_kill() {
    local pattern="$1" label="$2"
    if pkill -f "$pattern" 2>/dev/null; then
        warn "Killed existing ${label}"
        sleep 0.5
    else
        info "${label} not running — OK"
    fi
}

_kill "c2_server.py"     "C2 Server"
_kill "bot.py"           "Telegram Bot"
_kill "dashboard/app.py" "Flask Dashboard"
_kill "next-server"      "Next.js"

sleep 1  # give the OS time to release ports

# ═════════════════════════════════════════════════════════════════════════
# STEP 3 — C2 Server  (port 5000)
# ═════════════════════════════════════════════════════════════════════════
section "Starting C2 Server  →  :${C2_PORT}"

C2_SCRIPT="$PROJECT_DIR/c2_server.py"
[[ ! -f "$C2_SCRIPT" ]] && C2_SCRIPT="$PROJECT_DIR/c2_server (1).py"

if [[ ! -f "$C2_SCRIPT" ]]; then
    err "c2_server.py not found in ${PROJECT_DIR}"
    exit 1
fi

nohup "$PYTHON" "$C2_SCRIPT" > /tmp/c2_server.log 2>&1 &
C2_PID=$!
ok "C2 Server started  (PID ${C2_PID})  →  /tmp/c2_server.log"

sleep 2  # let Flask bind before the bot tries to reach it

# ═════════════════════════════════════════════════════════════════════════
# STEP 4 — Telegram Bot
# ═════════════════════════════════════════════════════════════════════════
section "Starting Telegram Bot"

BOT_SCRIPT="$PROJECT_DIR/bot.py"
[[ ! -f "$BOT_SCRIPT" ]] && BOT_SCRIPT="$PROJECT_DIR/bot (1).py"

BOT_PID=0
if [[ ! -f "$BOT_SCRIPT" ]]; then
    warn "bot.py not found — skipping"
else
    nohup "$PYTHON" "$BOT_SCRIPT" > /tmp/c2_bot.log 2>&1 &
    BOT_PID=$!
    ok "Telegram Bot started  (PID ${BOT_PID})  →  /tmp/c2_bot.log"
fi

sleep 1

# ═════════════════════════════════════════════════════════════════════════
# STEP 5 — Flask Dashboard  (port 8080)
# ═════════════════════════════════════════════════════════════════════════
section "Starting Flask Dashboard  →  :${DASH_PORT}"

DASHBOARD_DIR="$PROJECT_DIR/dashboard"

if [[ ! -d "$DASHBOARD_DIR" ]]; then
    err "dashboard/ directory not found in ${PROJECT_DIR}"
    exit 1
fi

if [[ ! -f "$DASHBOARD_DIR/app.py" ]]; then
    err "dashboard/app.py not found"
    exit 1
fi

nohup "$PYTHON" "$DASHBOARD_DIR/app.py" > /tmp/dashboard.log 2>&1 &
DASHBOARD_PID=$!
ok "Flask Dashboard started  (PID ${DASHBOARD_PID})  →  /tmp/dashboard.log"

sleep 1

# ═════════════════════════════════════════════════════════════════════════
# STEP 6 — Next.js Frontend  (port 3000, PRODUCTION)
# ═════════════════════════════════════════════════════════════════════════
section "Next.js Frontend  →  :${FRONT_PORT}  (production)"

FRONTEND_DIR="$PROJECT_DIR/frontend"

if [[ ! -d "$FRONTEND_DIR" ]]; then
    err "frontend/ directory not found in ${PROJECT_DIR}"
    exit 1
fi

cd "$FRONTEND_DIR"

# Install node_modules if missing
if [[ ! -d "node_modules" ]]; then
    info "node_modules missing — running npm install ..."
    npm install --silent \
        && ok "npm install complete" \
        || { err "npm install failed — check logs"; exit 1; }
fi

# Build for production if .next/BUILD_ID is absent or FORCE_BUILD is set
if [[ ! -f ".next/BUILD_ID" ]] || [[ "$FORCE_BUILD" == "true" ]]; then
    info "Building Next.js for production (this takes ~60–120 s) ..."
    info "Tail build log: tail -f /tmp/frontend_build.log"

    BACKEND_URL="$BACKEND_URL" \
    NEXT_PUBLIC_DASHBOARD_KEY="$DASHBOARD_KEY" \
    npm run build > /tmp/frontend_build.log 2>&1

    if [[ $? -ne 0 ]]; then
        err "npm run build FAILED"
        err "Last 30 lines of build log:"
        tail -30 /tmp/frontend_build.log >&2
        exit 1
    fi
    ok "Production build complete"
else
    info "Skipping build (.next/BUILD_ID exists)"
    info "  Use FORCE_BUILD=true ./start_all.sh to rebuild"
fi

# Start production server bound to all interfaces
BACKEND_URL="$BACKEND_URL" \
NEXT_PUBLIC_DASHBOARD_KEY="$DASHBOARD_KEY" \
nohup npm start > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
ok "Next.js started  (PID ${FRONTEND_PID})  →  /tmp/frontend.log"

cd "$PROJECT_DIR"

# ═════════════════════════════════════════════════════════════════════════
# Write PID file
# ═════════════════════════════════════════════════════════════════════════
cat > "$PID_FILE" << EOF
# C2 Project PIDs — $(date)
C2_PID=${C2_PID}
BOT_PID=${BOT_PID}
DASHBOARD_PID=${DASHBOARD_PID}
FRONTEND_PID=${FRONTEND_PID}
EOF

# Give services a moment to fully start before printing status
sleep 3

# ═════════════════════════════════════════════════════════════════════════
# Final status
# ═════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${GREEN}══ All services launched ══${NC}\n"

_status() {
    local label="$1" pattern="$2"
    if pgrep -f "$pattern" > /dev/null 2>&1; then
        echo -e "  ${GREEN}●${NC} ${BOLD}${label}${NC}"
    else
        echo -e "  ${RED}●${NC} ${BOLD}${label}${NC}  ${DIM}(still starting or failed — check logs)${NC}"
    fi
}

_status "C2 Server       " "c2_server.py"
_status "Telegram Bot    " "bot.py"
_status "Flask Dashboard " "dashboard/app.py"
_status "Next.js Frontend" "next-server"

echo -e "\n${BOLD}  Access URLs:${NC}"
printf "  ${CYAN}%-38s${NC} ${DIM}Dashboard (this machine)${NC}\n" "http://localhost:${FRONT_PORT}"
printf "  ${CYAN}%-38s${NC} ${DIM}Dashboard (LAN / other devices)${NC}\n" "http://${LAN_IP}:${FRONT_PORT}"
printf "  ${CYAN}%-38s${NC} ${DIM}Flask API${NC}\n"                       "http://localhost:${DASH_PORT}"
printf "  ${CYAN}%-38s${NC} ${DIM}C2 Server${NC}\n"                       "http://localhost:${C2_PORT}"

echo -e "\n${BOLD}  Logs:${NC}"
echo -e "  ${DIM}tail -f /tmp/c2_server.log /tmp/dashboard.log /tmp/frontend.log${NC}"

echo -e "\n${BOLD}  Management:${NC}"
echo -e "  ${DIM}Stop all  :  ./stop_all.sh${NC}"
echo -e "  ${DIM}Status    :  ./status.sh${NC}"
echo -e "  ${DIM}Rebuild   :  FORCE_BUILD=true ./start_all.sh${NC}"
echo -e "  ${DIM}PIDs      :  ${PID_FILE}${NC}\n"
