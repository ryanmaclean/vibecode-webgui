#!/bin/bash

################################################################################
# Service Connectivity Integration Test
#
# Purpose: Verify ALL 4 services are accessible with REAL connections
# Services: SSH (2222), Valkey (6379), PostgreSQL (5432), OpenVSCode (8080)
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
################################################################################

set -o pipefail

# ANSI color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=4

# Test evidence directory
EVIDENCE_DIR="/tmp/service-connectivity-test-evidence-$(date +%s)"
mkdir -p "$EVIDENCE_DIR"

# Helper functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_test_start() {
    echo -e "\n${YELLOW}► Testing: $1${NC}"
    echo "  Host: $2"
    echo "  Port: $3"
}

print_success() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

print_failure() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "${RED}  Error: $2${NC}"
    ((TESTS_FAILED++))
}

print_evidence() {
    echo -e "${BLUE}  Evidence:${NC}"
    echo "$1" | sed 's/^/    /'
}

save_evidence() {
    local service=$1
    local content=$2
    echo "$content" > "$EVIDENCE_DIR/${service}_output.txt"
}

# Display test information
print_header "SERVICE CONNECTIVITY INTEGRATION TEST"
echo "Test started: $(date)"
echo "Test ID: $(basename $EVIDENCE_DIR)"
echo "Evidence directory: $EVIDENCE_DIR"
echo ""
echo "Services to test:"
echo "  1. SSH (localhost:2222)"
echo "  2. Valkey (localhost:6379)"
echo "  3. PostgreSQL (localhost:5432)"
echo "  4. OpenVSCode (localhost:8080)"

################################################################################
# TEST 1: SSH Service
################################################################################
print_test_start "SSH Service" "localhost" "2222"

SSH_TEST_OUTPUT=""
SSH_SUCCESS=false

# Test SSH connection with real command execution
SSH_CMD="echo 'Hello from SSH test' && uname -a && date"
if SSH_RESULT=$(sshpass -p 'vibecode' ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -o ConnectionAttempts=1 -p 2222 root@localhost "$SSH_CMD" 2>&1); then
    # Verify we got actual output from the command
    if echo "$SSH_RESULT" | grep -q "Hello from SSH test" && echo "$SSH_RESULT" | grep -q "Linux"; then
        SSH_SUCCESS=true
        SSH_TEST_OUTPUT="$SSH_RESULT"
        save_evidence "ssh" "$SSH_RESULT"
        print_success "SSH connection established and commands executed successfully"
        print_evidence "$SSH_RESULT"
    else
        SSH_TEST_OUTPUT="$SSH_RESULT"
        print_failure "SSH connection succeeded but command output was invalid" "$SSH_RESULT"
    fi
else
    SSH_TEST_OUTPUT="$SSH_RESULT"
    save_evidence "ssh" "ERROR: $SSH_RESULT"
    print_failure "SSH connection failed or timed out" "$SSH_RESULT"
fi

################################################################################
# TEST 2: Valkey (Redis) Service
################################################################################
print_test_start "Valkey Service" "localhost" "6379"

VALKEY_TEST_OUTPUT=""
VALKEY_SUCCESS=false

# Test Valkey with PING, SET, and GET operations
TEST_KEY="test_key_$$"
TEST_VALUE="test_value_$(date +%s)"

# Execute multiple Redis commands
VALKEY_PING=$(redis-cli -h localhost -p 6379 PING 2>&1)
if [ "$VALKEY_PING" = "PONG" ]; then
    # Test SET operation
    VALKEY_SET=$(redis-cli -h localhost -p 6379 SET "$TEST_KEY" "$TEST_VALUE" 2>&1)
    if [ "$VALKEY_SET" = "OK" ]; then
        # Test GET operation
        VALKEY_GET=$(redis-cli -h localhost -p 6379 GET "$TEST_KEY" 2>&1)
        if [ "$VALKEY_GET" = "$TEST_VALUE" ]; then
            # Cleanup
            redis-cli -h localhost -p 6379 DEL "$TEST_KEY" > /dev/null 2>&1

            VALKEY_SUCCESS=true
            VALKEY_TEST_OUTPUT="PING: $VALKEY_PING\nSET $TEST_KEY: $VALKEY_SET\nGET $TEST_KEY: $VALKEY_GET"
            save_evidence "valkey" "$(echo -e "$VALKEY_TEST_OUTPUT")"
            print_success "Valkey PING, SET, and GET operations completed successfully"
            print_evidence "$(echo -e "$VALKEY_TEST_OUTPUT")"
        else
            VALKEY_TEST_OUTPUT="GET operation failed: $VALKEY_GET"
            save_evidence "valkey" "ERROR: $VALKEY_TEST_OUTPUT"
            print_failure "Valkey GET operation returned unexpected value" "$VALKEY_GET (expected: $TEST_VALUE)"
        fi
    else
        VALKEY_TEST_OUTPUT="SET operation failed: $VALKEY_SET"
        save_evidence "valkey" "ERROR: $VALKEY_TEST_OUTPUT"
        print_failure "Valkey SET operation failed" "$VALKEY_SET"
    fi
else
    VALKEY_TEST_OUTPUT="PING failed: $VALKEY_PING"
    save_evidence "valkey" "ERROR: $VALKEY_TEST_OUTPUT"
    print_failure "Valkey PING failed" "$VALKEY_PING"
fi

################################################################################
# TEST 3: PostgreSQL Service
################################################################################
print_test_start "PostgreSQL Service" "localhost" "5432"

PSQL_BIN="/opt/homebrew/Cellar/libpq/18.1/bin/psql"
POSTGRES_TEST_OUTPUT=""
POSTGRES_SUCCESS=false

# Test PostgreSQL with multiple queries
if [ -f "$PSQL_BIN" ]; then
    # Test connection and simple query
    PG_TEST_QUERY="SELECT 1 AS test_result;"
    if PG_RESULT=$( PGPASSWORD=postgres "$PSQL_BIN" -h localhost -p 5432 -U postgres -d postgres -t -c "$PG_TEST_QUERY" 2>&1); then
        # Verify output contains "1"
        if echo "$PG_RESULT" | grep -q "1"; then
            # Test database version query
            PG_VERSION_QUERY="SELECT version();"
            PG_VERSION=$( PGPASSWORD=postgres "$PSQL_BIN" -h localhost -p 5432 -U postgres -d postgres -t -c "$PG_VERSION_QUERY" 2>&1)

            # Test creating and dropping a test table
            PG_CREATE_QUERY="CREATE TEMP TABLE test_table_$$ (id INT, name TEXT);"
            PG_CREATE=$( PGPASSWORD=postgres "$PSQL_BIN" -h localhost -p 5432 -U postgres -d postgres -t -c "$PG_CREATE_QUERY" 2>&1)

            POSTGRES_SUCCESS=true
            POSTGRES_TEST_OUTPUT="Query: $PG_TEST_QUERY\nResult: $PG_RESULT\n\nVersion Query: $PG_VERSION_QUERY\nVersion: $(echo $PG_VERSION | head -c 80)...\n\nCreate Table: $PG_CREATE"
            save_evidence "postgresql" "$(echo -e "$POSTGRES_TEST_OUTPUT")"
            print_success "PostgreSQL queries executed successfully"
            print_evidence "$(echo -e "Query Result: $(echo $PG_RESULT | xargs)\nVersion: $(echo $PG_VERSION | head -c 60)...")"
        else
            POSTGRES_TEST_OUTPUT="Query returned unexpected result: $PG_RESULT"
            save_evidence "postgresql" "ERROR: $POSTGRES_TEST_OUTPUT"
            print_failure "PostgreSQL query returned unexpected result" "$PG_RESULT"
        fi
    else
        POSTGRES_TEST_OUTPUT="Connection or query failed: $PG_RESULT"
        save_evidence "postgresql" "ERROR: $POSTGRES_TEST_OUTPUT"
        print_failure "PostgreSQL connection or query failed" "$PG_RESULT"
    fi
else
    POSTGRES_TEST_OUTPUT="psql binary not found at $PSQL_BIN"
    save_evidence "postgresql" "ERROR: $POSTGRES_TEST_OUTPUT"
    print_failure "PostgreSQL client not found" "$PSQL_BIN"
fi

################################################################################
# TEST 4: OpenVSCode Service
################################################################################
print_test_start "OpenVSCode Web Service" "localhost" "8080"

OPENVSCODE_TEST_OUTPUT=""
OPENVSCODE_SUCCESS=false

# Test HTTP connection and verify HTML content
if VSCODE_RESULT=$( curl -s -f -L http://localhost:8080 2>&1); then
    # Verify HTML content contains VSCode-specific elements
    if echo "$VSCODE_RESULT" | grep -q -i "vscode" || echo "$VSCODE_RESULT" | grep -q -i "openvscode"; then
        # Get content length and extract some key information
        CONTENT_LENGTH=$(echo "$VSCODE_RESULT" | wc -c)
        HAS_HTML=$(echo "$VSCODE_RESULT" | grep -c "<html" || echo "0")
        HAS_TITLE=$(echo "$VSCODE_RESULT" | grep -o "<title>[^<]*</title>" | head -1)

        OPENVSCODE_SUCCESS=true
        OPENVSCODE_TEST_OUTPUT="HTTP Status: 200 OK\nContent-Length: $CONTENT_LENGTH bytes\nHTML Tags: $HAS_HTML\nTitle: $HAS_TITLE\nContent Preview: $(echo "$VSCODE_RESULT" | head -c 200)"
        save_evidence "openvscode" "$(echo -e "$OPENVSCODE_TEST_OUTPUT")\n\n=== FULL HTML (first 5000 chars) ===\n$(echo "$VSCODE_RESULT" | head -c 5000)"
        print_success "OpenVSCode HTTP response received with valid HTML content"
        print_evidence "$(echo -e "Content-Length: $CONTENT_LENGTH bytes\nTitle: $HAS_TITLE")"
    else
        OPENVSCODE_TEST_OUTPUT="HTTP response did not contain VSCode content"
        save_evidence "openvscode" "ERROR: $OPENVSCODE_TEST_OUTPUT\n\nReceived:\n$(echo "$VSCODE_RESULT" | head -c 1000)"
        print_failure "OpenVSCode returned invalid HTML content" "Content does not contain VSCode elements"
    fi
else
    OPENVSCODE_TEST_OUTPUT="HTTP request failed: $VSCODE_RESULT"
    save_evidence "openvscode" "ERROR: $OPENVSCODE_TEST_OUTPUT"
    print_failure "OpenVSCode HTTP request failed or timed out" "$VSCODE_RESULT"
fi

################################################################################
# TEST SUMMARY
################################################################################
print_header "TEST RESULTS SUMMARY"

echo -e "\nIndividual Service Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$SSH_SUCCESS" = true ]; then
    echo -e "${GREEN}✓${NC} SSH (localhost:2222) - PASS"
else
    echo -e "${RED}✗${NC} SSH (localhost:2222) - FAIL"
fi

if [ "$VALKEY_SUCCESS" = true ]; then
    echo -e "${GREEN}✓${NC} Valkey (localhost:6379) - PASS"
else
    echo -e "${RED}✗${NC} Valkey (localhost:6379) - FAIL"
fi

if [ "$POSTGRES_SUCCESS" = true ]; then
    echo -e "${GREEN}✓${NC} PostgreSQL (localhost:5432) - PASS"
else
    echo -e "${RED}✗${NC} PostgreSQL (localhost:5432) - FAIL"
fi

if [ "$OPENVSCODE_SUCCESS" = true ]; then
    echo -e "${GREEN}✓${NC} OpenVSCode (localhost:8080) - PASS"
else
    echo -e "${RED}✗${NC} OpenVSCode (localhost:8080) - FAIL"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Evidence saved to: $EVIDENCE_DIR"
echo "Test completed: $(date)"
echo ""

# Generate JSON report
cat > "$EVIDENCE_DIR/test-report.json" <<EOF
{
  "test_run": {
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "test_id": "$(basename $EVIDENCE_DIR)",
    "evidence_dir": "$EVIDENCE_DIR"
  },
  "summary": {
    "total_tests": $TOTAL_TESTS,
    "passed": $TESTS_PASSED,
    "failed": $TESTS_FAILED,
    "success_rate": "$((TESTS_PASSED * 100 / TOTAL_TESTS))%"
  },
  "services": {
    "ssh": {
      "host": "localhost",
      "port": 2222,
      "passed": $([[ "$SSH_SUCCESS" == "true" ]] && echo "true" || echo "false"),
      "evidence_file": "$EVIDENCE_DIR/ssh_output.txt"
    },
    "valkey": {
      "host": "localhost",
      "port": 6379,
      "passed": $([[ "$VALKEY_SUCCESS" == "true" ]] && echo "true" || echo "false"),
      "evidence_file": "$EVIDENCE_DIR/valkey_output.txt"
    },
    "postgresql": {
      "host": "localhost",
      "port": 5432,
      "passed": $([[ "$POSTGRES_SUCCESS" == "true" ]] && echo "true" || echo "false"),
      "evidence_file": "$EVIDENCE_DIR/postgresql_output.txt"
    },
    "openvscode": {
      "host": "localhost",
      "port": 8080,
      "passed": $([[ "$OPENVSCODE_SUCCESS" == "true" ]] && echo "true" || echo "false"),
      "evidence_file": "$EVIDENCE_DIR/openvscode_output.txt"
    }
  }
}
EOF

echo "JSON report: $EVIDENCE_DIR/test-report.json"

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}ALL TESTS PASSED! All 4 services are accessible.${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 0
else
    echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}TEST FAILURES DETECTED! $TESTS_FAILED out of $TOTAL_TESTS services failed.${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 1
fi
