#!/usr/bin/env bash
# VibeCode VM Manager - Complete VM Orchestration CLI
# Manages multiple vfkit VMs: valkey, postgresql, nodejs-dev
# Author: DevOps Automation Engineer
# Platform: macOS ARM64 with Virtualization Framework

set -euo pipefail

# ==============================================================================
# CONFIGURATION
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config/vfkit"
VFKIT_BINARY="$PROJECT_ROOT/src-tauri/resources/vfkit-aarch64-apple-darwin"

# Runtime directories
VIBECODE_HOME="${VIBECODE_HOME:-$HOME/.vibecode}"
VM_LOGS_DIR="$VIBECODE_HOME/vm-logs"
VM_PIDS_DIR="$VIBECODE_HOME/vm-pids"
VM_STATE_DIR="$VIBECODE_HOME/vm-state"

# Create directories
mkdir -p "$VM_LOGS_DIR" "$VM_PIDS_DIR" "$VM_STATE_DIR"

# VM Definitions
declare -A VMS
VMS[valkey]="valkey-vm.yaml"
VMS[postgresql]="postgresql-vm.yaml"
VMS[nodejs-dev]="nodejs-dev-vm.yaml"

# VM Ports for health checks
declare -A VM_PORTS
VM_PORTS[valkey]="6379"
VM_PORTS[postgresql]="5432"
VM_PORTS[nodejs-dev]="3000"

# VM Dependencies (start order)
declare -A VM_DEPENDENCIES
VM_DEPENDENCIES[valkey]=""
VM_DEPENDENCIES[postgresql]=""
VM_DEPENDENCIES[nodejs-dev]="valkey postgresql"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_section() {
    echo ""
    echo -e "${CYAN}===${NC} $* ${CYAN}===${NC}"
}

# Check if vfkit binary exists
check_vfkit() {
    if [[ ! -x "$VFKIT_BINARY" ]]; then
        log_error "vfkit binary not found or not executable: $VFKIT_BINARY"
        exit 1
    fi
}

# Validate VM name
validate_vm_name() {
    local vm_name=$1
    if [[ ! -v VMS[$vm_name] ]]; then
        log_error "Unknown VM: $vm_name"
        log_info "Available VMs: ${!VMS[*]}"
        exit 1
    fi
}

# Get PID file path
get_pid_file() {
    local vm_name=$1
    echo "$VM_PIDS_DIR/${vm_name}.pid"
}

# Get log file path
get_log_file() {
    local vm_name=$1
    echo "$VM_LOGS_DIR/${vm_name}.log"
}

# Get state file path
get_state_file() {
    local vm_name=$1
    echo "$VM_STATE_DIR/${vm_name}.state"
}

# Check if VM is running
is_vm_running() {
    local vm_name=$1
    local pid_file
    pid_file=$(get_pid_file "$vm_name")

    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # Stale PID file
            rm -f "$pid_file"
        fi
    fi
    return 1
}

# Get VM PID
get_vm_pid() {
    local vm_name=$1
    local pid_file
    pid_file=$(get_pid_file "$vm_name")

    if [[ -f "$pid_file" ]]; then
        cat "$pid_file"
    else
        echo ""
    fi
}

# Wait for port to be available
wait_for_port() {
    local port=$1
    local timeout=${2:-30}
    local elapsed=0

    while ! nc -z localhost "$port" 2>/dev/null; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [[ $elapsed -ge $timeout ]]; then
            return 1
        fi
    done
    return 0
}

# Check port availability
is_port_available() {
    local port=$1
    ! lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1
}

# Check port conflict
check_port_conflict() {
    local vm_name=$1
    local port=${VM_PORTS[$vm_name]}

    if ! is_port_available "$port"; then
        local process
        process=$(lsof -Pi :"$port" -sTCP:LISTEN -t 2>/dev/null || echo "unknown")
        log_warn "Port $port is already in use by process $process"
        return 1
    fi
    return 0
}

# ==============================================================================
# VM OPERATIONS
# ==============================================================================

start_vm() {
    local vm_name=$1
    local config_file="$CONFIG_DIR/${VMS[$vm_name]}"

    validate_vm_name "$vm_name"

    log_section "Starting VM: $vm_name"

    # Check if already running
    if is_vm_running "$vm_name"; then
        log_warn "VM $vm_name is already running (PID: $(get_vm_pid "$vm_name"))"
        return 0
    fi

    # Check config file exists
    if [[ ! -f "$config_file" ]]; then
        log_error "Config file not found: $config_file"
        return 1
    fi

    # Check port conflicts
    if ! check_port_conflict "$vm_name"; then
        log_error "Cannot start $vm_name due to port conflict"
        return 1
    fi

    # Start dependencies first
    if [[ -n "${VM_DEPENDENCIES[$vm_name]:-}" ]]; then
        log_info "Starting dependencies: ${VM_DEPENDENCIES[$vm_name]}"
        for dep in ${VM_DEPENDENCIES[$vm_name]}; do
            if ! is_vm_running "$dep"; then
                start_vm "$dep" || return 1
            fi
        done
    fi

    # Start the VM
    local log_file
    log_file=$(get_log_file "$vm_name")
    local pid_file
    pid_file=$(get_pid_file "$vm_name")
    local state_file
    state_file=$(get_state_file "$vm_name")

    log_info "Config: $config_file"
    log_info "Logs: $log_file"

    # Launch vfkit in background
    nohup "$VFKIT_BINARY" \
        --config "$config_file" \
        > "$log_file" 2>&1 &

    local vm_pid=$!
    echo "$vm_pid" > "$pid_file"
    echo "started:$(date +%s)" > "$state_file"

    log_info "VM process started (PID: $vm_pid)"

    # Wait for VM to be ready
    local port=${VM_PORTS[$vm_name]}
    log_info "Waiting for port $port to be available..."

    if wait_for_port "$port" 60; then
        log_success "VM $vm_name is ready and listening on port $port"
        echo "ready:$(date +%s)" >> "$state_file"
        return 0
    else
        log_error "VM $vm_name failed to start (port $port not available after 60s)"
        # Show last 20 lines of log
        log_error "Last 20 lines of log:"
        tail -20 "$log_file" | while read -r line; do
            echo "  $line"
        done
        stop_vm "$vm_name"
        return 1
    fi
}

stop_vm() {
    local vm_name=$1

    validate_vm_name "$vm_name"

    log_section "Stopping VM: $vm_name"

    if ! is_vm_running "$vm_name"; then
        log_warn "VM $vm_name is not running"
        return 0
    fi

    local pid
    pid=$(get_vm_pid "$vm_name")
    local pid_file
    pid_file=$(get_pid_file "$vm_name")
    local state_file
    state_file=$(get_state_file "$vm_name")

    log_info "Sending SIGTERM to PID $pid..."
    kill "$pid" 2>/dev/null || true

    # Wait for graceful shutdown
    local timeout=15
    local elapsed=0
    while ps -p "$pid" > /dev/null 2>&1; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [[ $elapsed -ge $timeout ]]; then
            log_warn "VM didn't stop gracefully, sending SIGKILL..."
            kill -9 "$pid" 2>/dev/null || true
            sleep 1
            break
        fi
    done

    # Cleanup
    rm -f "$pid_file"
    echo "stopped:$(date +%s)" >> "$state_file"

    log_success "VM $vm_name stopped"
}

restart_vm() {
    local vm_name=$1
    validate_vm_name "$vm_name"

    log_section "Restarting VM: $vm_name"
    stop_vm "$vm_name"
    sleep 2
    start_vm "$vm_name"
}

status_vm() {
    local vm_name=$1
    validate_vm_name "$vm_name"

    local status_color=$RED
    local status_text="STOPPED"
    local pid=""
    local uptime=""
    local port_status=""

    if is_vm_running "$vm_name"; then
        status_color=$GREEN
        status_text="RUNNING"
        pid=$(get_vm_pid "$vm_name")

        # Calculate uptime
        local state_file
        state_file=$(get_state_file "$vm_name")
        if [[ -f "$state_file" ]]; then
            local start_time
            start_time=$(grep "^started:" "$state_file" | tail -1 | cut -d: -f2)
            if [[ -n "$start_time" ]]; then
                local now
                now=$(date +%s)
                local uptime_seconds=$((now - start_time))
                uptime=$(printf "%dd %dh %dm %ds" \
                    $((uptime_seconds / 86400)) \
                    $((uptime_seconds % 86400 / 3600)) \
                    $((uptime_seconds % 3600 / 60)) \
                    $((uptime_seconds % 60)))
            fi
        fi

        # Check port
        local port=${VM_PORTS[$vm_name]}
        if nc -z localhost "$port" 2>/dev/null; then
            port_status="${GREEN}LISTENING${NC}"
        else
            port_status="${RED}NOT LISTENING${NC}"
        fi
    fi

    echo -e "  ${MAGENTA}${vm_name}${NC}"
    echo -e "    Status: ${status_color}${status_text}${NC}"
    [[ -n "$pid" ]] && echo -e "    PID: $pid"
    [[ -n "$uptime" ]] && echo -e "    Uptime: $uptime"
    [[ -n "$port_status" ]] && echo -e "    Port ${VM_PORTS[$vm_name]}: $port_status"
    echo -e "    Config: ${VMS[$vm_name]}"
    echo -e "    Logs: $(get_log_file "$vm_name")"
}

logs_vm() {
    local vm_name=$1
    local lines=${2:-50}
    validate_vm_name "$vm_name"

    local log_file
    log_file=$(get_log_file "$vm_name")

    if [[ ! -f "$log_file" ]]; then
        log_error "Log file not found: $log_file"
        return 1
    fi

    log_section "Logs for VM: $vm_name (last $lines lines)"
    tail -n "$lines" "$log_file"
}

follow_logs_vm() {
    local vm_name=$1
    validate_vm_name "$vm_name"

    local log_file
    log_file=$(get_log_file "$vm_name")

    log_section "Following logs for VM: $vm_name (Ctrl+C to exit)"
    tail -f "$log_file"
}

list_vms() {
    log_section "VibeCode VMs Status"
    echo ""

    for vm_name in "${!VMS[@]}"; do
        status_vm "$vm_name"
        echo ""
    done
}

# ==============================================================================
# BULK OPERATIONS
# ==============================================================================

start_all() {
    log_section "Starting all VMs"

    # Start in dependency order
    local start_order=("valkey" "postgresql" "nodejs-dev")

    for vm_name in "${start_order[@]}"; do
        if ! is_vm_running "$vm_name"; then
            start_vm "$vm_name" || log_error "Failed to start $vm_name"
        else
            log_info "$vm_name is already running"
        fi
        echo ""
    done

    log_section "All VMs started"
    list_vms
}

stop_all() {
    log_section "Stopping all VMs"

    # Stop in reverse dependency order
    local stop_order=("nodejs-dev" "postgresql" "valkey")

    for vm_name in "${stop_order[@]}"; do
        if is_vm_running "$vm_name"; then
            stop_vm "$vm_name" || log_error "Failed to stop $vm_name"
        fi
        echo ""
    done

    log_success "All VMs stopped"
}

restart_all() {
    log_section "Restarting all VMs"
    stop_all
    sleep 3
    start_all
}

# ==============================================================================
# HEALTH CHECK
# ==============================================================================

health_check() {
    log_section "VM Health Check"
    echo ""

    local all_healthy=true

    for vm_name in "${!VMS[@]}"; do
        echo -e "${MAGENTA}${vm_name}${NC}"

        if ! is_vm_running "$vm_name"; then
            echo -e "  Status: ${RED}NOT RUNNING${NC}"
            all_healthy=false
            continue
        fi

        local port=${VM_PORTS[$vm_name]}

        # Port check
        if nc -z localhost "$port" 2>/dev/null; then
            echo -e "  Port $port: ${GREEN}OK${NC}"
        else
            echo -e "  Port $port: ${RED}FAILED${NC}"
            all_healthy=false
        fi

        # Service-specific checks
        case $vm_name in
            valkey)
                if command -v redis-cli &>/dev/null; then
                    if redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG; then
                        echo -e "  Ping: ${GREEN}PONG${NC}"
                    else
                        echo -e "  Ping: ${RED}FAILED${NC}"
                        all_healthy=false
                    fi
                fi
                ;;
            postgresql)
                if command -v psql &>/dev/null; then
                    if psql -h localhost -U vibecode -d vibecode -c "SELECT 1" &>/dev/null; then
                        echo -e "  Connection: ${GREEN}OK${NC}"
                    else
                        echo -e "  Connection: ${YELLOW}AUTH REQUIRED${NC}"
                    fi
                fi
                ;;
            nodejs-dev)
                if curl -s http://localhost:3000/health &>/dev/null; then
                    echo -e "  HTTP: ${GREEN}OK${NC}"
                else
                    echo -e "  HTTP: ${YELLOW}NOT RESPONDING${NC}"
                fi
                ;;
        esac

        echo ""
    done

    if $all_healthy; then
        log_success "All VMs are healthy"
        return 0
    else
        log_error "Some VMs are unhealthy"
        return 1
    fi
}

# ==============================================================================
# RESOURCE MONITORING
# ==============================================================================

monitor_resources() {
    log_section "VM Resource Usage"
    echo ""

    for vm_name in "${!VMS[@]}"; do
        if is_vm_running "$vm_name"; then
            local pid
            pid=$(get_vm_pid "$vm_name")

            echo -e "${MAGENTA}${vm_name}${NC} (PID: $pid)"

            # Get CPU and memory usage
            if ps -p "$pid" -o %cpu,%mem,rss,vsz | tail -1 | read -r cpu mem rss vsz; then
                echo "  CPU: ${cpu}%"
                echo "  Memory: ${mem}%"
                echo "  RSS: $((rss / 1024)) MB"
                echo "  VSZ: $((vsz / 1024)) MB"
            fi

            echo ""
        fi
    done
}

# ==============================================================================
# HELP AND USAGE
# ==============================================================================

usage() {
    cat <<EOF
VibeCode VM Manager - vfkit VM Orchestration CLI

USAGE:
    $(basename "$0") <command> [options]

COMMANDS:
    start <vm>          Start a specific VM
    stop <vm>           Stop a specific VM
    restart <vm>        Restart a specific VM
    status <vm>         Show status of a specific VM
    logs <vm> [lines]   Show logs for a VM (default: 50 lines)
    follow <vm>         Follow logs for a VM (like tail -f)

    start-all           Start all VMs in correct order
    stop-all            Stop all VMs gracefully
    restart-all         Restart all VMs

    list                List all VMs and their status
    health              Run health checks on all VMs
    monitor             Monitor resource usage of all VMs

AVAILABLE VMS:
    valkey              In-memory cache (port 6379)
    postgresql          Database with pgvector (port 5432)
    nodejs-dev          Node.js development environment (ports 3000, 5173, 8080)

EXAMPLES:
    # Start all VMs
    $(basename "$0") start-all

    # Start individual VM
    $(basename "$0") start valkey

    # Check status
    $(basename "$0") list

    # View logs
    $(basename "$0") logs postgresql 100

    # Follow logs
    $(basename "$0") follow nodejs-dev

    # Health check
    $(basename "$0") health

    # Stop everything
    $(basename "$0") stop-all

DIRECTORIES:
    Logs: $VM_LOGS_DIR
    PIDs: $VM_PIDS_DIR
    State: $VM_STATE_DIR
    Configs: $CONFIG_DIR

EOF
}

# ==============================================================================
# MAIN
# ==============================================================================

main() {
    check_vfkit

    local command=${1:-}

    case $command in
        start)
            [[ -z ${2:-} ]] && { log_error "VM name required"; usage; exit 1; }
            start_vm "$2"
            ;;
        stop)
            [[ -z ${2:-} ]] && { log_error "VM name required"; usage; exit 1; }
            stop_vm "$2"
            ;;
        restart)
            [[ -z ${2:-} ]] && { log_error "VM name required"; usage; exit 1; }
            restart_vm "$2"
            ;;
        status)
            [[ -z ${2:-} ]] && { log_error "VM name required"; usage; exit 1; }
            status_vm "$2"
            ;;
        logs)
            [[ -z ${2:-} ]] && { log_error "VM name required"; usage; exit 1; }
            logs_vm "$2" "${3:-50}"
            ;;
        follow)
            [[ -z ${2:-} ]] && { log_error "VM name required"; usage; exit 1; }
            follow_logs_vm "$2"
            ;;
        start-all)
            start_all
            ;;
        stop-all)
            stop_all
            ;;
        restart-all)
            restart_all
            ;;
        list|ls)
            list_vms
            ;;
        health)
            health_check
            ;;
        monitor|top)
            monitor_resources
            ;;
        help|--help|-h)
            usage
            ;;
        "")
            usage
            ;;
        *)
            log_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
