#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║               C2 Project — Service Status                       ║
# ║  Usage:  ./status.sh                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

set -uo pipefail

# ── Colours ──────────────────────────────────────────────────────────────
RED='\033[0;31m';   GREEN='\033[0;32m';  YELLOW='\033[1;33m'
CYAN='\033[0;36m';  BOLD='\033[1m';      DIM='\033[2m'; NC='\033[0m'

PID_FILE="/tmp/c2_project_pids.env"

# ── Check if a port is bound ─────────────────────────────────────────────
_port_open() {
    local port="$1"
    # Try ss first (faster), fall back to netstat
    if command -v ss &>/dev/null; then
        ss -tlnp 2>/dev/null | grep -q ":${port} " && return 0
    elif command -v netstat &>/dev/null; then
        netstat -tlnp 2>/dev/null | grep -q ":${port} " && return 0
    fi
    return 1
}

# ── Print one status row ─────────────────────────────────────────────────
_row() {
    local label="$1" pattern="$2" port="$3"

    # pgrep: get PID list
    local pids
    pids=$(pgrep -d',' -f "$pattern" 2>/dev/null || true)

    if [[ -n "$pids" ]]; then
        local port_flag=""
        if [[ -n "$port" ]]; then
            if _port_open "$port"; then
                port_flag="  ${GREEN}:${port}${NC}"
            else
                port_flag="  ${YELLOW}:${port} (binding…)${NC}"
            fi
        fi
        echo -e "  ${GREEN}● RUNNING${NC}  ${BOLD}${label}${NC}${port_flag}  ${DIM}PID(s): ${pids}${NC}"
    else
        echo -e "  ${RED}○ STOPPED${NC}  ${BOLD}${label}${NC}"
    fi
}

# ── Log tail helper ──────────────────────────────────────────────────────
_last_log() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local line
        line=$(tail -1 "$file" 2>/dev/null)
        [[ -n "$line" ]] && echo -e "              ${DIM}└ ${line:0:80}${NC}"
    fi
}

# ════════════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}  ☠  C2 Control Platform  —  Service Status${NC}"
echo -e "  ${DIM}$(date)${NC}\n"

echo -e "  ${BOLD}SERVICE              STATUS${NC}"
echo -e "  ${DIM}─────────────────────────────────────────────────${NC}"

_row "C2 Server        " "c2_server.py"      "5000"
_last_log "/tmp/c2_server.log"

_row "Telegram Bot     " "bot.py"            ""
_last_log "/tmp/c2_bot.log"

_row "Flask Dashboard  " "dashboard/app.py"  "8080"
_last_log "/tmp/dashboard.log"

_row "Next.js Frontend " "next"              "3000"
_last_log "/tmp/frontend.log"

echo -e "\n  ${DIM}─────────────────────────────────────────────────${NC}"

# ── Show saved PIDs if file exists ───────────────────────────────────────
if [[ -f "$PID_FILE" ]]; then
    echo -e "\n  ${DIM}PID file: ${PID_FILE}${NC}"
    while IFS='=' read -r key val; do
        [[ "$key" =~ ^# ]] && continue
        [[ -z "$key" ]]    && continue
        printf "  ${DIM}  %-20s %s${NC}\n" "$key" "$val"
    done < "$PID_FILE"
fi

# ── Quick URL guide ──────────────────────────────────────────────────────
echo -e ""
echo -e "  ${CYAN}http://localhost:3000${NC}  ${DIM}← Next.js dashboard${NC}"
echo -e "  ${CYAN}http://localhost:8080${NC}  ${DIM}← Flask API / legacy UI${NC}"
echo -e "  ${CYAN}http://localhost:5000${NC}  ${DIM}← C2 server${NC}"
echo -e ""
echo -e "  ${DIM}Logs:  tail -f /tmp/c2_server.log /tmp/dashboard.log /tmp/frontend.log${NC}"
echo -e "  ${DIM}Start: ./start_all.sh   Stop: ./stop_all.sh${NC}\n"
