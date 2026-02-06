#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Lima VM Manager for VibeCode
# Manages Valkey, PostgreSQL, and Node.js development VMs
#
# Usage:
#   ./scripts/lima-manager.sh start [vm-name]     # Start VM(s)
#   ./scripts/lima-manager.sh stop [vm-name]      # Stop VM(s)
#   ./scripts/lima-manager.sh restart [vm-name]   # Restart VM(s)
#   ./scripts/lima-manager.sh status              # Show VM status
#   ./scripts/lima-manager.sh list                # List all VMs
#   ./scripts/lima-manager.sh shell <vm-name>     # Open shell in VM
#   ./scripts/lima-manager.sh logs <vm-name>      # View VM logs
#   ./scripts/lima-manager.sh delete [vm-name]    # Delete VM(s)
#   ./scripts/lima-manager.sh validate            # Validate YAML configs
#   ./scripts/lima-manager.sh test                # Run connectivity tests
#   ./scripts/lima-manager.sh help                # Show this help

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/config/lima"

# VM names
VM_VALKEY="vibecode-valkey"
VM_POSTGRES="vibecode-pgvector"
VM_NODEJS="vibecode-nodejs-dev"

ALL_VMS=("$VM_VALKEY" "$VM_POSTGRES" "$VM_NODEJS")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Lima is installed
check_lima() {
    if ! command -v limactl &> /dev/null; then
        log_error "Lima is not installed. Install with: brew install lima"
        exit 1
    fi
}

# Get VM config file path
get_config_file() {
    local vm_name=$1
    case $vm_name in
        "$VM_VALKEY")
            echo "$CONFIG_DIR/valkey-vm.yaml"
            ;;
        "$VM_POSTGRES")
            echo "$CONFIG_DIR/postgresql-pgvector-vm.yaml"
            ;;
        "$VM_NODEJS")
            echo "$CONFIG_DIR/nodejs-dev-vm.yaml"
            ;;
        *)
            log_error "Unknown VM: $vm_name"
            exit 1
            ;;
    esac
}

# Start VM(s)
start_vm() {
    local vm_name=${1:-}

    if [ -z "$vm_name" ]; then
        log_info "Starting all VMs..."
        for vm in "${ALL_VMS[@]}"; do
            start_single_vm "$vm"
        done
    else
        start_single_vm "$vm_name"
    fi
}

start_single_vm() {
    local vm_name=$1
    local config_file=$(get_config_file "$vm_name")

    if [ ! -f "$config_file" ]; then
        log_error "Config file not found: $config_file"
        return 1
    fi

    log_info "Starting $vm_name..."

    # Check if VM already exists
    if limactl list | grep -q "^$vm_name"; then
        # VM exists, just start it
        limactl start "$vm_name" --tty=false
    else
        # VM doesn't exist, create and start
        limactl start --name="$vm_name" "$config_file" --tty=false
    fi

    log_success "$vm_name started successfully"
}

# Stop VM(s)
stop_vm() {
    local vm_name=${1:-}

    if [ -z "$vm_name" ]; then
        log_info "Stopping all VMs..."
        for vm in "${ALL_VMS[@]}"; do
            stop_single_vm "$vm"
        done
    else
        stop_single_vm "$vm_name"
    fi
}

stop_single_vm() {
    local vm_name=$1

    if ! limactl list | grep -q "^$vm_name"; then
        log_warning "$vm_name is not running"
        return 0
    fi

    log_info "Stopping $vm_name..."
    limactl stop "$vm_name"
    log_success "$vm_name stopped successfully"
}

# Restart VM(s)
restart_vm() {
    local vm_name=${1:-}

    if [ -z "$vm_name" ]; then
        log_info "Restarting all VMs..."
        for vm in "${ALL_VMS[@]}"; do
            stop_single_vm "$vm"
            start_single_vm "$vm"
        done
    else
        stop_single_vm "$vm_name"
        start_single_vm "$vm_name"
    fi
}

# Show VM status
show_status() {
    log_info "VibeCode VM Status:"
    echo ""
    limactl list | grep -E "NAME|vibecode-" || echo "No VibeCode VMs running"
    echo ""
}

# List all VMs
list_vms() {
    log_info "All Lima VMs:"
    echo ""
    limactl list
}

# Open shell in VM
open_shell() {
    local vm_name=${1:-}

    if [ -z "$vm_name" ]; then
        log_error "VM name required. Usage: $0 shell <vm-name>"
        echo ""
        echo "Available VMs:"
        for vm in "${ALL_VMS[@]}"; do
            echo "  - $vm"
        done
        exit 1
    fi

    if ! limactl list | grep -q "^$vm_name.*Running"; then
        log_error "$vm_name is not running. Start it first with: $0 start $vm_name"
        exit 1
    fi

    log_info "Opening shell in $vm_name..."
    limactl shell "$vm_name"
}

# View VM logs
view_logs() {
    local vm_name=${1:-}

    if [ -z "$vm_name" ]; then
        log_error "VM name required. Usage: $0 logs <vm-name>"
        exit 1
    fi

    local log_dir="$HOME/.lima/$vm_name"

    if [ ! -d "$log_dir" ]; then
        log_error "VM $vm_name not found"
        exit 1
    fi

    log_info "Viewing logs for $vm_name..."
    echo ""
    echo "Serial log (boot messages):"
    echo "----------------------------"
    tail -n 50 "$log_dir/serial*.log" 2>/dev/null || echo "No serial log found"
    echo ""
    echo "Host agent log:"
    echo "---------------"
    tail -n 50 "$log_dir/ha.stderr.log" 2>/dev/null || echo "No host agent log found"
}

# Delete VM(s)
delete_vm() {
    local vm_name=${1:-}

    if [ -z "$vm_name" ]; then
        log_warning "Deleting all VMs..."
        read -p "Are you sure? This will delete all VibeCode VMs. (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cancelled"
            exit 0
        fi
        for vm in "${ALL_VMS[@]}"; do
            delete_single_vm "$vm"
        done
    else
        log_warning "Deleting $vm_name..."
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cancelled"
            exit 0
        fi
        delete_single_vm "$vm_name"
    fi
}

delete_single_vm() {
    local vm_name=$1

    if ! limactl list | grep -q "^$vm_name"; then
        log_warning "$vm_name does not exist"
        return 0
    fi

    log_info "Deleting $vm_name..."
    limactl delete "$vm_name" -f
    log_success "$vm_name deleted successfully"
}

# Validate YAML configs
validate_configs() {
    log_info "Validating YAML configurations..."
    echo ""

    local all_valid=true

    for vm in "${ALL_VMS[@]}"; do
        local config_file=$(get_config_file "$vm")
        echo -n "Validating $vm... "

        if [ ! -f "$config_file" ]; then
            echo -e "${RED}MISSING${NC}"
            log_error "Config file not found: $config_file"
            all_valid=false
            continue
        fi

        if limactl validate "$config_file" &> /dev/null; then
            echo -e "${GREEN}VALID${NC}"
        else
            echo -e "${RED}INVALID${NC}"
            limactl validate "$config_file"
            all_valid=false
        fi
    done

    echo ""
    if $all_valid; then
        log_success "All configurations are valid"
    else
        log_error "Some configurations are invalid"
        exit 1
    fi
}

# Run connectivity tests
run_tests() {
    log_info "Running connectivity tests..."
    echo ""

    # Test Valkey
    echo -n "Testing Valkey connectivity... "
    if limactl list | grep -q "^$VM_VALKEY.*Running"; then
        if limactl shell "$VM_VALKEY" sudo valkey-cli -a VibeCodeChangeMe2025 ping 2>/dev/null | grep -q "PONG"; then
            echo -e "${GREEN}PASS${NC}"
        else
            echo -e "${RED}FAIL${NC}"
        fi
    else
        echo -e "${YELLOW}NOT RUNNING${NC}"
    fi

    # Test PostgreSQL
    echo -n "Testing PostgreSQL connectivity... "
    if limactl list | grep -q "^$VM_POSTGRES.*Running"; then
        if limactl shell "$VM_POSTGRES" sudo -u postgres pg_isready -h localhost 2>/dev/null | grep -q "accepting connections"; then
            echo -e "${GREEN}PASS${NC}"
        else
            echo -e "${RED}FAIL${NC}"
        fi
    else
        echo -e "${YELLOW}NOT RUNNING${NC}"
    fi

    # Test Node.js
    echo -n "Testing Node.js environment... "
    if limactl list | grep -q "^$VM_NODEJS.*Running"; then
        if limactl shell "$VM_NODEJS" node --version 2>/dev/null | grep -q "v22"; then
            echo -e "${GREEN}PASS${NC}"
        else
            echo -e "${RED}FAIL${NC}"
        fi
    else
        echo -e "${YELLOW}NOT RUNNING${NC}"
    fi

    echo ""
}

# Show help
show_help() {
    cat <<EOF
Lima VM Manager for VibeCode

Manages three VMs:
  - $VM_VALKEY (Valkey session storage)
  - $VM_POSTGRES (PostgreSQL + pgvector database)
  - $VM_NODEJS (Node.js development environment)

Commands:
  start [vm-name]     Start VM(s) - omit vm-name to start all
  stop [vm-name]      Stop VM(s) - omit vm-name to stop all
  restart [vm-name]   Restart VM(s) - omit vm-name to restart all
  status              Show status of VibeCode VMs
  list                List all Lima VMs
  shell <vm-name>     Open shell in VM
  logs <vm-name>      View VM logs
  delete [vm-name]    Delete VM(s) - omit vm-name to delete all (with confirmation)
  validate            Validate YAML configurations
  test                Run connectivity tests
  help                Show this help

Examples:
  $0 start                        # Start all VMs
  $0 start $VM_VALKEY             # Start Valkey VM only
  $0 status                       # Show VM status
  $0 shell $VM_NODEJS             # Open shell in Node.js VM
  $0 test                         # Run connectivity tests

Configuration files:
  Valkey:     $CONFIG_DIR/valkey-vm.yaml
  PostgreSQL: $CONFIG_DIR/postgresql-pgvector-vm.yaml
  Node.js:    $CONFIG_DIR/nodejs-dev-vm.yaml

VM Aliases:
  valkey      = $VM_VALKEY
  postgres    = $VM_POSTGRES
  postgresql  = $VM_POSTGRES
  pgvector    = $VM_POSTGRES
  nodejs      = $VM_NODEJS
  node        = $VM_NODEJS
  dev         = $VM_NODEJS
EOF
}

# Resolve VM name aliases
resolve_vm_name() {
    local name=${1:-}
    case $name in
        valkey)
            echo "$VM_VALKEY"
            ;;
        postgres|postgresql|pgvector)
            echo "$VM_POSTGRES"
            ;;
        nodejs|node|dev)
            echo "$VM_NODEJS"
            ;;
        *)
            echo "$name"
            ;;
    esac
}

# Main command dispatcher
main() {
    check_lima

    local command=${1:-help}
    local vm_arg=${2:-}

    # Resolve VM name alias
    local vm_name=$(resolve_vm_name "$vm_arg")

    case $command in
        start)
            start_vm "$vm_name"
            ;;
        stop)
            stop_vm "$vm_name"
            ;;
        restart)
            restart_vm "$vm_name"
            ;;
        status)
            show_status
            ;;
        list)
            list_vms
            ;;
        shell)
            open_shell "$vm_name"
            ;;
        logs)
            view_logs "$vm_name"
            ;;
        delete)
            delete_vm "$vm_name"
            ;;
        validate)
            validate_configs
            ;;
        test)
            run_tests
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
