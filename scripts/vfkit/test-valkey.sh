#!/usr/bin/env bash
# Test Valkey VM - Comprehensive connection and functionality tests
# Tests: Ping, SET/GET, TTL, INFO, Memory, Persistence

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VALKEY_HOST="localhost"
VALKEY_PORT="6379"
VALKEY_PASSWORD="VibeCodeChangeMe2025"

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

# Check if redis-cli is available (Valkey is protocol-compatible)
check_cli() {
    if command -v redis-cli &>/dev/null; then
        return 0
    elif command -v valkey-cli &>/dev/null; then
        return 0
    else
        log_error "Neither redis-cli nor valkey-cli found"
        log_info "Install with: brew install redis (or valkey)"
        return 1
    fi
}

get_cli() {
    if command -v redis-cli &>/dev/null; then
        echo "redis-cli"
    else
        echo "valkey-cli"
    fi
}

# Test 1: Port connectivity
test_port_connectivity() {
    nc -z "$VALKEY_HOST" "$VALKEY_PORT" 2>/dev/null
}

# Test 2: Ping
test_ping() {
    local cli
    cli=$(get_cli)
    local response
    response=$($cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" ping 2>/dev/null)
    [[ "$response" == "PONG" ]]
}

# Test 3: SET/GET
test_set_get() {
    local cli
    cli=$(get_cli)
    local test_key="test:vibecode:$(date +%s)"
    local test_value="hello_from_vibecode_test"

    # SET
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        SET "$test_key" "$test_value" >/dev/null 2>&1 || return 1

    # GET
    local retrieved
    retrieved=$($cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        GET "$test_key" 2>/dev/null)

    # DELETE
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        DEL "$test_key" >/dev/null 2>&1

    [[ "$retrieved" == "$test_value" ]]
}

# Test 4: TTL (Time To Live)
test_ttl() {
    local cli
    cli=$(get_cli)
    local test_key="test:vibecode:ttl:$(date +%s)"
    local test_value="expires_in_5_seconds"

    # SETEX (SET with expiration)
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        SETEX "$test_key" 5 "$test_value" >/dev/null 2>&1 || return 1

    # Check TTL
    local ttl
    ttl=$($cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        TTL "$test_key" 2>/dev/null)

    # Cleanup
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        DEL "$test_key" >/dev/null 2>&1

    [[ "$ttl" -gt 0 && "$ttl" -le 5 ]]
}

# Test 5: Hash operations
test_hash_operations() {
    local cli
    cli=$(get_cli)
    local hash_key="test:vibecode:hash:$(date +%s)"

    # HSET
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        HSET "$hash_key" field1 "value1" field2 "value2" >/dev/null 2>&1 || return 1

    # HGET
    local value
    value=$($cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        HGET "$hash_key" field1 2>/dev/null)

    # HGETALL
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        HGETALL "$hash_key" >/dev/null 2>&1

    # Cleanup
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        DEL "$hash_key" >/dev/null 2>&1

    [[ "$value" == "value1" ]]
}

# Test 6: List operations
test_list_operations() {
    local cli
    cli=$(get_cli)
    local list_key="test:vibecode:list:$(date +%s)"

    # LPUSH
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        LPUSH "$list_key" "item1" "item2" "item3" >/dev/null 2>&1 || return 1

    # LLEN
    local length
    length=$($cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        LLEN "$list_key" 2>/dev/null)

    # LRANGE
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        LRANGE "$list_key" 0 -1 >/dev/null 2>&1

    # Cleanup
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        DEL "$list_key" >/dev/null 2>&1

    [[ "$length" -eq 3 ]]
}

# Test 7: Info command
test_info() {
    local cli
    cli=$(get_cli)
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        INFO server >/dev/null 2>&1
}

# Test 8: Memory info
test_memory() {
    local cli
    cli=$(get_cli)
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        INFO memory >/dev/null 2>&1
}

# Show Valkey info
show_valkey_info() {
    echo -e "\n${BLUE}=== Valkey Server Information ===${NC}"
    local cli
    cli=$(get_cli)

    echo -e "\n${YELLOW}Version:${NC}"
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        INFO server 2>/dev/null | grep -E "redis_version|valkey_version|os|arch_bits" || true

    echo -e "\n${YELLOW}Memory:${NC}"
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        INFO memory 2>/dev/null | grep -E "used_memory_human|maxmemory_human|mem_fragmentation" || true

    echo -e "\n${YELLOW}Stats:${NC}"
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        INFO stats 2>/dev/null | grep -E "total_connections|total_commands|keyspace" || true

    echo -e "\n${YELLOW}Persistence:${NC}"
    $cli -h "$VALKEY_HOST" -p "$VALKEY_PORT" -a "$VALKEY_PASSWORD" \
        INFO persistence 2>/dev/null | grep -E "aof_enabled|rdb_last_save" || true
}

# Main test execution
main() {
    echo -e "${BLUE}TPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPW${NC}"
    echo -e "${BLUE}Q  Valkey VM Comprehensive Test Suite   Q${NC}"
    echo -e "${BLUE}ZPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP]${NC}"

    echo -e "\n${YELLOW}Configuration:${NC}"
    echo "  Host: $VALKEY_HOST"
    echo "  Port: $VALKEY_PORT"
    echo "  Password: [REDACTED]"

    # Check CLI availability
    if ! check_cli; then
        exit 1
    fi

    local cli
    cli=$(get_cli)
    echo "  CLI: $cli"

    # Run tests
    run_test "Port Connectivity" test_port_connectivity
    run_test "PING Command" test_ping
    run_test "SET/GET Operations" test_set_get
    run_test "TTL (Expiration)" test_ttl
    run_test "Hash Operations (HSET/HGET)" test_hash_operations
    run_test "List Operations (LPUSH/LLEN)" test_list_operations
    run_test "INFO Command" test_info
    run_test "Memory Info" test_memory

    # Show info
    show_valkey_info

    # Summary
    echo -e "\n${BLUE}=== Test Summary ===${NC}"
    echo -e "  ${GREEN}Passed:${NC} $test_passed"
    echo -e "  ${RED}Failed:${NC} $test_failed"
    echo -e "  ${YELLOW}Total:${NC} $((test_passed + test_failed))"

    if [[ $test_failed -eq 0 ]]; then
        echo -e "\n${GREEN} All tests passed! Valkey is working correctly.${NC}"
        exit 0
    else
        echo -e "\n${RED} Some tests failed. Check the Valkey VM logs.${NC}"
        exit 1
    fi
}

main "$@"
