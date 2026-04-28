#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║               C2 Project — Stop All Services                    ║
# ║  Usage:  ./stop_all.sh                                          ║
# ╚══════════════════════════════════════════════════════════════════╝

set -uo pipefail

# ── Colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BOLD='\033[1m';   DIM='\033[2m';      NC='\033[0m'

info() { echo -e "  ${YELLOW}[•]${NC} $*"; }
ok()   { echo -e "  ${GREEN}[✓]${NC} $*"; }

PID_FILE="/tmp/c2_project_pids.env"

echo -e "\n${BOLD}${RED}  ☠  C2 Control Platform${NC}${DIM}  —  stopping all services${NC}\n"

# ── Helper: kill by pattern, never fail ──────────────────────────────────
_stop() {
    local pattern="$1" label="$2"
    local count
    count=$(pgrep -c -f "$pattern" 2>/dev/null || echo 0)
    if [[ "$count" -gt 0 ]]; then
        pkill -f "$pattern" 2>/dev/null || true
        sleep 0.4
        # SIGKILL any survivors
        pkill -9 -f "$pattern" 2>/dev/null || true
        ok "Stopped ${label}  ${DIM}(${count} process(es) killed)${NC}"
    else
        info "${label} was not running"
    fi
}

# ── Kill each service ────────────────────────────────────────────────────
_stop "c2_server.py"      "C2 Server       "
_stop "bot.py"            "Telegram Bot    "
_stop "dashboard/app.py"  "Flask Dashboard "
_stop "next"              "Next.js Frontend"

# ── Remove PID file if present ────────────────────────────────────────────
if [[ -f "$PID_FILE" ]]; then
    rm -f "$PID_FILE"
    info "Removed PID file  ${DIM}(${PID_FILE})${NC}"
fi

echo -e "\n  ${GREEN}All services stopped.${NC}\n"
