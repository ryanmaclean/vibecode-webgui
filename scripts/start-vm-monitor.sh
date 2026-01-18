#!/bin/bash
# Start VM Service Monitor in Background
# Reports status every 10 seconds to console while running continuously in background

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_SCRIPT="${SCRIPT_DIR}/monitor-vm-services.sh"
LOG_FILE="/tmp/vm-service-monitor.log"
PID_FILE="/tmp/vm-service-monitor.pid"

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

# Check if monitor is already running
if [[ -f "$PID_FILE" ]]; then
    old_pid=$(cat "$PID_FILE")
    if ps -p "$old_pid" > /dev/null 2>&1; then
        echo -e "${YELLOW}Monitor already running with PID $old_pid${RESET}"
        echo "To stop: kill $old_pid"
        echo "To view log: tail -f $LOG_FILE"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

# Clear old log
> "$LOG_FILE"

echo -e "${BOLD}${BLUE}=== Starting VibeCode VM Service Monitor ===${RESET}"
echo ""
echo -e "Mode: ${GREEN}Background with periodic console updates${RESET}"
echo -e "Log file: ${BLUE}$LOG_FILE${RESET}"
echo -e "Update interval: ${YELLOW}10 seconds${RESET}"
echo ""

# Start monitor in background with custom check interval
CHECK_INTERVAL=5 "$MONITOR_SCRIPT" >> "$LOG_FILE" 2>&1 &
monitor_pid=$!

# Save PID
echo "$monitor_pid" > "$PID_FILE"

echo -e "${GREEN}✅ Monitor started with PID: $monitor_pid${RESET}"
echo ""
echo "Commands:"
echo -e "  View log:  ${CYAN}tail -f $LOG_FILE${RESET}"
echo -e "  Stop:      ${CYAN}kill $monitor_pid${RESET}"
echo -e "  Or:        ${CYAN}pkill -f monitor-vm-services${RESET}"
echo ""
echo -e "${BOLD}Showing updates every 10 seconds (Ctrl+C to stop watching, monitor continues):${RESET}"
echo ""

# Function to display summary from log
display_summary() {
    if [[ -f "$LOG_FILE" ]]; then
        # Get last status block
        local last_block=$(tail -30 "$LOG_FILE")

        # Extract VM IP
        local vm_ip=$(echo "$last_block" | grep "VM IP:" | tail -1 | awk '{print $3}')

        # Count service status
        local up_count=$(echo "$last_block" | grep -c "UP - PID" || true)
        local down_count=$(echo "$last_block" | grep -c ": DOWN" || true)

        local timestamp=$(date '+%H:%M:%S')

        echo -e "${BOLD}[$timestamp] Status Update:${RESET}"
        echo -e "  VM IP: ${BLUE}${vm_ip:-Detecting...}${RESET}"
        echo -e "  Services UP: ${GREEN}$up_count${RESET} | Services DOWN: ${RED}$down_count${RESET}"

        # Show specific service status
        if [[ $up_count -gt 0 ]]; then
            echo -e "  ${GREEN}✅ Running:${RESET} $(echo "$last_block" | grep "UP - PID" | awk -F'(' '{print $1}' | awk '{print $1}' | tr '\n' ' ')"
        fi
        if [[ $down_count -gt 0 ]]; then
            echo -e "  ${RED}❌ Down:${RESET} $(echo "$last_block" | grep ": DOWN" | awk -F'(' '{print $1}' | awk '{print $1}' | tr '\n' ' ')"
        fi

        echo ""
    fi
}

# Monitor and report every 10 seconds
trap 'echo -e "\n${YELLOW}Stopped watching. Monitor still running in background (PID: $monitor_pid)${RESET}"; exit 0' INT

sleep 3  # Give monitor time to start

while ps -p "$monitor_pid" > /dev/null 2>&1; do
    display_summary

    # Check if all services are up (monitor will exit on success)
    if tail -10 "$LOG_FILE" | grep -q "All services stable"; then
        echo -e "${GREEN}${BOLD}🎉 All services are running and stable!${RESET}"
        echo -e "${GREEN}Monitor completed successfully.${RESET}"
        rm -f "$PID_FILE"
        exit 0
    fi

    sleep 10
done

# Monitor stopped unexpectedly
if [[ -f "$PID_FILE" ]]; then
    rm -f "$PID_FILE"
fi

echo -e "${RED}Monitor process stopped.${RESET}"
echo "Check log for details: $LOG_FILE"
