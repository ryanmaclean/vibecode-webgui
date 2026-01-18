#!/bin/bash

# VM Service Startup Script
# Purpose: Manually start PostgreSQL and OpenVSCode Server after VM boots
# Usage: ./start-vm-services.sh
#
# Environment variables:
#   VM_IP       - VM IP address (default: 192.168.64.9)
#   SSH_PORT    - SSH port (default: 2222)
#   SSH_USER    - SSH username (default: root)
#   SSH_PASS    - SSH password (default: vibecode)

set -o pipefail

# Configuration
VM_IP="${VM_IP:-192.168.64.9}"
SSH_PORT="${SSH_PORT:-2222}"
SSH_USER="${SSH_USER:-root}"
SSH_PASS="${SSH_PASS:-vibecode}"
MAX_RETRIES=30
RETRY_DELAY=2

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

# Wait for SSH to be available
wait_for_ssh() {
    log_info "Waiting for SSH to be available at ${VM_IP}:${SSH_PORT}..."

    for i in $(seq 1 $MAX_RETRIES); do
        if nc -z -w 5 "$VM_IP" "$SSH_PORT" 2>/dev/null; then
            log_success "SSH is available"
            sleep 2  # Give SSH a moment to fully initialize
            return 0
        fi
        echo -n "."
        sleep $RETRY_DELAY
    done

    log_error "SSH is not available after $((MAX_RETRIES * RETRY_DELAY)) seconds"
    return 1
}

# Execute command via SSH using expect
ssh_exec() {
    local cmd="$1"
    local show_output="${2:-true}"

    if [ "$show_output" = "true" ]; then
        expect <<EOF
set timeout 60
log_user 1
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${SSH_PORT} ${SSH_USER}@${VM_IP} "$cmd"
expect {
    "password:" {
        send "${SSH_PASS}\r"
        exp_continue
    }
    eof
}
catch wait result
exit [lindex \$result 3]
EOF
    else
        expect <<EOF
set timeout 60
log_user 0
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p ${SSH_PORT} ${SSH_USER}@${VM_IP} "$cmd"
expect {
    "password:" {
        send "${SSH_PASS}\r"
        exp_continue
    }
    eof
}
catch wait result
exit [lindex \$result 3]
EOF
    fi
}

# Check if a service is running
check_service() {
    local service_name="$1"
    local check_cmd="$2"

    if ssh_exec "$check_cmd" &>/dev/null; then
        log_success "$service_name is running"
        return 0
    else
        log_warning "$service_name is NOT running"
        return 1
    fi
}

# Initialize and start PostgreSQL
start_postgresql() {
    log_info "Starting PostgreSQL..."

    # Check if PostgreSQL is already listening on port
    if nc -z -w 5 "$VM_IP" 5432 2>/dev/null; then
        log_success "PostgreSQL is already running and accessible"
        return 0
    fi

    # Kill any stale PostgreSQL processes
    log_info "Cleaning up any stale PostgreSQL processes..."
    ssh_exec "pkill -f postgres || true" false

    sleep 2

    # Execute initialization and startup
    log_info "Initializing and starting PostgreSQL..."
    ssh_exec 'sh -c '\''
        # Check if PostgreSQL data directory needs initialization
        if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
            echo "Initializing PostgreSQL database..."
            su-exec postgres initdb -D /var/lib/postgresql/data --encoding=UTF8 --locale=C

            # Configure PostgreSQL to accept connections
            echo "host all all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf
            echo "listen_addresses = '\''*'\''" >> /var/lib/postgresql/data/postgresql.conf
            echo "PostgreSQL initialized successfully"
        else
            echo "PostgreSQL data directory already exists"
        fi

        # Start PostgreSQL in background
        echo "Starting PostgreSQL server..."
        nohup su-exec postgres postgres -D /var/lib/postgresql/data > /var/log/postgresql.log 2>&1 &
        PG_PID=$!
        echo "PostgreSQL started with PID: $PG_PID"

        # Wait for PostgreSQL to be ready (up to 10 seconds)
        for i in $(seq 1 10); do
            if netstat -tuln 2>/dev/null | grep -q ":5432 "; then
                echo "PostgreSQL is now listening on port 5432"
                exit 0
            fi
            echo "Waiting for PostgreSQL to start... ($i/10)"
            sleep 1
        done

        echo "WARNING: PostgreSQL may not be listening on port 5432 yet"
        exit 1
    '\'''

    local result=$?
    if [ $result -eq 0 ]; then
        log_success "PostgreSQL started successfully"

        # Double-check port accessibility from host
        sleep 2
        if nc -z -w 5 "$VM_IP" 5432 2>/dev/null; then
            log_success "PostgreSQL is accessible from host on port 5432"
            return 0
        else
            log_warning "PostgreSQL started but may not be accessible yet"
            return 0
        fi
    else
        log_error "Failed to start PostgreSQL"
        ssh_exec "tail -20 /var/log/postgresql.log" true || true
        return 1
    fi
}

# Start OpenVSCode Server
start_openvscode() {
    log_info "Starting OpenVSCode Server..."

    # Check if OpenVSCode is already listening on port
    if nc -z -w 5 "$VM_IP" 3000 2>/dev/null; then
        log_success "OpenVSCode Server is already running and accessible"
        return 0
    fi

    # Kill any stale node/openvscode processes
    log_info "Cleaning up any stale OpenVSCode processes..."
    ssh_exec "pkill -f node || true; pkill -f openvscode || true" false

    sleep 2

    # Try Method 1: Direct node call (preferred)
    log_info "Starting OpenVSCode Server (Method 1: Direct node call)..."
    ssh_exec 'sh -c '\''
        cd /opt/openvscode-server || exit 1

        if [ ! -f ./node ]; then
            echo "ERROR: Node binary not found at /opt/openvscode-server/node"
            exit 1
        fi

        if [ ! -f ./out/server-main.js ]; then
            echo "ERROR: server-main.js not found at /opt/openvscode-server/out/server-main.js"
            exit 1
        fi

        echo "Starting OpenVSCode Server with direct node call..."
        nohup ./node ./out/server-main.js --host 0.0.0.0 --port 3000 --without-connection-token > /var/log/openvscode.log 2>&1 &
        NODE_PID=$!
        echo "OpenVSCode Server started with PID: $NODE_PID"

        # Wait for server to start (up to 10 seconds)
        for i in $(seq 1 10); do
            if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
                echo "OpenVSCode Server is now listening on port 3000"
                exit 0
            fi
            echo "Waiting for OpenVSCode Server to start... ($i/10)"
            sleep 1
        done

        echo "WARNING: OpenVSCode Server may not be listening on port 3000 yet"
        tail -10 /var/log/openvscode.log
        exit 1
    '\'''

    local result=$?
    if [ $result -eq 0 ]; then
        log_success "OpenVSCode Server started successfully (Method 1)"

        # Double-check port accessibility from host
        sleep 2
        if nc -z -w 5 "$VM_IP" 3000 2>/dev/null; then
            log_success "OpenVSCode Server is accessible from host on port 3000"
            return 0
        else
            log_warning "OpenVSCode Server started but may not be accessible yet"
            return 0
        fi
    fi

    # Try Method 2: Fix wrapper and use it
    log_warning "Method 1 failed, trying Method 2 (Using wrapper)..."
    ssh_exec 'sh -c '\''
        export NODE=/opt/openvscode-server/node
        export PATH=/opt/openvscode-server:$PATH

        echo "Starting OpenVSCode Server with wrapper..."
        nohup /opt/openvscode-server/bin/openvscode-server --host 0.0.0.0 --port 3000 --without-connection-token > /var/log/openvscode.log 2>&1 &

        # Wait for server to start
        for i in $(seq 1 10); do
            if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
                echo "OpenVSCode Server is now listening on port 3000 (Method 2)"
                exit 0
            fi
            sleep 1
        done

        echo "Method 2 also failed"
        tail -10 /var/log/openvscode.log
        exit 1
    '\'''

    if [ $? -eq 0 ]; then
        log_success "OpenVSCode Server started successfully (Method 2)"
        return 0
    else
        log_error "Failed to start OpenVSCode Server with both methods"
        log_info "Check logs with: ssh -p 2222 root@${VM_IP} tail -50 /var/log/openvscode.log"
        return 1
    fi
}

# Verify all services are running
verify_services() {
    log_info "Verifying all services..."
    echo ""

    local all_ok=true

    # Check Dropbear SSH
    log_info "Checking Dropbear SSH (port 2222)..."
    if nc -z -w 5 "$VM_IP" 2222 2>/dev/null; then
        log_success "Dropbear SSH is accessible on port 2222"
    else
        log_error "Dropbear SSH is NOT accessible on port 2222"
        all_ok=false
    fi

    # Check Valkey
    log_info "Checking Valkey (port 6379)..."
    if nc -z -w 5 "$VM_IP" 6379 2>/dev/null; then
        log_success "Valkey is accessible on port 6379"
    else
        log_error "Valkey is NOT accessible on port 6379"
        all_ok=false
    fi

    # Check PostgreSQL
    log_info "Checking PostgreSQL (port 5432)..."
    if nc -z -w 5 "$VM_IP" 5432 2>/dev/null; then
        log_success "PostgreSQL is accessible on port 5432"
    else
        log_error "PostgreSQL is NOT accessible on port 5432"
        all_ok=false
    fi

    # Check OpenVSCode Server
    log_info "Checking OpenVSCode Server (port 3000)..."
    if nc -z -w 5 "$VM_IP" 3000 2>/dev/null; then
        log_success "OpenVSCode Server is accessible on port 3000"
    else
        log_error "OpenVSCode Server is NOT accessible on port 3000"
        all_ok=false
    fi

    echo ""
    if [ "$all_ok" = true ]; then
        log_success "All services are running successfully!"
        return 0
    else
        log_error "Some services are not running. Check the logs above."
        return 1
    fi
}

# Print service status
print_status() {
    echo ""
    echo "=================================="
    echo "VM Services Status"
    echo "=================================="
    echo "VM IP: ${VM_IP}"
    echo ""

    # Get process information from VM
    log_info "Fetching process information from VM..."

    ssh_exec 'sh -c '\''
        echo "=== Running Processes ==="
        echo ""
        echo "Dropbear SSH:"
        pgrep -f dropbear && echo "  Running" || echo "  NOT running"
        echo ""
        echo "Valkey:"
        pgrep -f valkey-server && echo "  Running" || echo "  NOT running"
        echo ""
        echo "PostgreSQL:"
        pgrep -f "postgres.*-D" && echo "  Running (PID: $(pgrep -f '\''postgres.*-D'\''))" || echo "  NOT running"
        echo ""
        echo "OpenVSCode Server:"
        pgrep -f "node.*server-main.js" && echo "  Running (PID: $(pgrep -f '\''node.*server-main.js'\''))" || echo "  NOT running"
        echo ""
        echo "=== Service Endpoints ==="
        echo "  SSH:             ssh -p 2222 root@'"$VM_IP"' (password: vibecode)"
        echo "  Valkey:          '"$VM_IP"':6379"
        echo "  PostgreSQL:      postgresql://postgres@'"$VM_IP"':5432/postgres"
        echo "  OpenVSCode:      http://'"$VM_IP"':3000"
    '\'''
}

# Main execution
main() {
    echo "=================================="
    echo "VM Service Startup Script"
    echo "=================================="
    echo ""

    # Check for required commands
    if ! command -v expect &> /dev/null; then
        log_error "expect is not installed. Please install it with: brew install expect"
        exit 1
    fi

    if ! command -v nc &> /dev/null; then
        log_error "nc (netcat) is not installed"
        exit 1
    fi

    # Wait for VM to boot and SSH to be available
    if ! wait_for_ssh; then
        log_error "Cannot connect to VM. Please ensure VM is running."
        exit 1
    fi

    # Start services
    local pg_result=0
    local vscode_result=0

    start_postgresql || pg_result=$?
    sleep 3

    start_openvscode || vscode_result=$?
    sleep 3

    # Verify all services
    verify_services || true

    # Print status
    print_status

    echo ""
    if [ $pg_result -eq 0 ] && [ $vscode_result -eq 0 ]; then
        log_success "Service startup complete!"
    else
        log_warning "Service startup completed with some errors"
    fi

    echo ""
    echo "Quick access commands:"
    echo "  SSH:        ssh -p 2222 root@${VM_IP}"
    echo "  PostgreSQL: psql postgresql://postgres@${VM_IP}:5432/postgres"
    echo "  OpenVSCode: open http://${VM_IP}:3000"
    echo ""
    echo "Debug commands:"
    echo "  Check PostgreSQL logs:  ssh -p 2222 root@${VM_IP} tail -50 /var/log/postgresql.log"
    echo "  Check OpenVSCode logs:  ssh -p 2222 root@${VM_IP} tail -50 /var/log/openvscode.log"
    echo "  Check ports:            ssh -p 2222 root@${VM_IP} netstat -tuln"
}

# Run main function
main "$@"
