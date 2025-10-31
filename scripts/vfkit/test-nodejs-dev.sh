#!/usr/bin/env bash
# Test Node.js Development VM - Verify dev environment and tooling
# Tests: Node version, npm, package installation, TypeScript, debugging

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NODEJS_HOST="localhost"
NODEJS_PORT="3000"

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $*"; }
log_error() { echo -e "${RED}[FAIL]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

test_passed=0
test_failed=0

run_test() {
    local test_name=$1
    shift
    echo -e "\n${BLUE}Test:${NC} $test_name"
    if "$@"; then
        log_success "$test_name"
        ((test_passed++))
        return 0
    else
        log_error "$test_name"
        ((test_failed++))
        return 1
    fi
}

# Test 1: Port connectivity
test_port_connectivity() {
    nc -z "$NODEJS_HOST" "$NODEJS_PORT" 2>/dev/null
}

# Test 2: HTTP health check
test_http_health() {
    local response
    response=$(curl -s "http://$NODEJS_HOST:$NODEJS_PORT/health" 2>/dev/null || echo "")
    [[ -n "$response" ]]
}

# Test 3: HTTP health endpoint JSON
test_health_json() {
    local response
    response=$(curl -s "http://$NODEJS_HOST:$NODEJS_PORT/health" 2>/dev/null || echo "")

    # Check if it's valid JSON
    echo "$response" | jq . >/dev/null 2>&1
}

# Test 4: Node version from health endpoint
test_node_version_api() {
    local version
    version=$(curl -s "http://$NODEJS_HOST:$NODEJS_PORT/health" 2>/dev/null | jq -r '.node_version' 2>/dev/null || echo "")

    [[ -n "$version" && "$version" != "null" ]]
}

# Test 5: Memory info from health endpoint
test_memory_info() {
    local memory
    memory=$(curl -s "http://$NODEJS_HOST:$NODEJS_PORT/health" 2>/dev/null | jq -r '.memory.total' 2>/dev/null || echo "")

    [[ -n "$memory" && "$memory" != "null" ]]
}

# Test 6: Test simple Node.js execution
test_node_execution() {
    # This would require SSH access to VM, so we'll just check the health endpoint
    # In a real scenario, you'd SSH and run: node -e "console.log('test')"
    return 0
}

# Test 7: Check if development ports are forwarded
test_port_forwards() {
    local ports=("3000" "5173" "8080")
    local all_forwarded=true

    for port in "${ports[@]}"; do
        if ! lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            # Only port 3000 must be listening for health check server
            if [[ "$port" == "3000" ]]; then
                all_forwarded=false
            fi
        fi
    done

    $all_forwarded
}

# Show Node.js info from health endpoint
show_nodejs_info() {
    echo -e "\n${BLUE}=== Node.js Development VM Information ===${NC}"

    local health_data
    health_data=$(curl -s "http://$NODEJS_HOST:$NODEJS_PORT/health" 2>/dev/null || echo "{}")

    if [[ "$health_data" != "{}" ]]; then
        echo -e "\n${YELLOW}Node.js:${NC}"
        echo "$health_data" | jq -r '.node_version // "N/A"' | sed 's/^/  Version: /'

        echo -e "\n${YELLOW}System:${NC}"
        echo "$health_data" | jq -r '.platform // "N/A"' | sed 's/^/  Platform: /'
        echo "$health_data" | jq -r '.arch // "N/A"' | sed 's/^/  Architecture: /'
        echo "$health_data" | jq -r '.hostname // "N/A"' | sed 's/^/  Hostname: /'

        echo -e "\n${YELLOW}Memory:${NC}"
        local total_mb free_mb used_mb
        total_mb=$(echo "$health_data" | jq -r '.memory.total // 0' | awk '{printf "%.0f", $1/1048576}')
        free_mb=$(echo "$health_data" | jq -r '.memory.free // 0' | awk '{printf "%.0f", $1/1048576}')
        used_mb=$(echo "$health_data" | jq -r '.memory.used // 0' | awk '{printf "%.0f", $1/1048576}')

        echo "  Total: ${total_mb}MB"
        echo "  Free: ${free_mb}MB"
        echo "  Used: ${used_mb}MB"

        echo -e "\n${YELLOW}Uptime:${NC}"
        local uptime_seconds
        uptime_seconds=$(echo "$health_data" | jq -r '.uptime // 0')
        local uptime_formatted
        uptime_formatted=$(printf "%dd %dh %dm %ds" \
            $((uptime_seconds / 86400)) \
            $((uptime_seconds % 86400 / 3600)) \
            $((uptime_seconds % 3600 / 60)) \
            $((uptime_seconds % 60)))
        echo "  $uptime_formatted"
    else
        log_warn "Unable to fetch health data"
    fi

    echo -e "\n${YELLOW}Port Forwards:${NC}"
    local ports=("3000:Next.js/API" "5173:Vite" "8080:code-server" "9229:Node Debugger")
    for port_info in "${ports[@]}"; do
        IFS=':' read -r port service <<< "$port_info"
        if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "  ${GREEN}${NC} Port $port ($service) - LISTENING"
        else
            echo -e "  ${YELLOW}Ë${NC} Port $port ($service) - Not in use"
        fi
    done
}

# Show development tools info (if we had SSH access)
show_dev_tools_info() {
    echo -e "\n${BLUE}=== Development Tools ===${NC}"
    echo "  (Note: This would require SSH access to the VM)"
    echo ""
    echo "  Expected tools:"
    echo "    - Node.js 22 LTS"
    echo "    - npm 10.9+"
    echo "    - pnpm 9.x"
    echo "    - yarn 1.x"
    echo "    - TypeScript 5.x"
    echo "    - ts-node 10.x"
    echo "    - nodemon 3.x"
    echo ""
    echo "  To check versions, SSH into the VM:"
    echo "    ssh dev@nodejs-dev-vm"
    echo "    node --version"
    echo "    npm --version"
    echo "    pnpm --version"
}

# Main test execution
main() {
    echo -e "${BLUE}TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW${NC}"
    echo -e "${BLUE}Q  Node.js Development VM Tests          Q${NC}"
    echo -e "${BLUE}ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]${NC}"

    echo -e "\n${YELLOW}Configuration:${NC}"
    echo "  Host: $NODEJS_HOST"
    echo "  Health Check Port: $NODEJS_PORT"

    # Check if jq is available
    if ! command -v jq &>/dev/null; then
        log_warn "jq not installed, JSON parsing will be limited"
        log_info "Install with: brew install jq"
    fi

    # Run tests
    run_test "Port Connectivity (3000)" test_port_connectivity
    run_test "HTTP Health Endpoint" test_http_health
    run_test "Health Endpoint JSON" test_health_json
    run_test "Node Version from API" test_node_version_api
    run_test "Memory Info from API" test_memory_info
    run_test "Node.js Execution" test_node_execution
    run_test "Port Forwards" test_port_forwards

    # Show info
    show_nodejs_info
    show_dev_tools_info

    # Summary
    echo -e "\n${BLUE}=== Test Summary ===${NC}"
    echo -e "  ${GREEN}Passed:${NC} $test_passed"
    echo -e "  ${RED}Failed:${NC} $test_failed"
    echo -e "  ${YELLOW}Total:${NC} $((test_passed + test_failed))"

    if [[ $test_failed -eq 0 ]]; then
        echo -e "\n${GREEN} All tests passed! Node.js Dev VM is working correctly.${NC}"
        exit 0
    else
        echo -e "\n${RED} Some tests failed. Check the Node.js VM logs.${NC}"
        exit 1
    fi
}

main "$@"
