#!/bin/bash

# Persistence Test Script for VM Reboot Cycles
# Tests 5 complete reboot cycles and measures consistency

APP_PATH="/tmp/vibecode-clean-test-1768252319/UnifiedServicesVibeCode.app"
VM_IP="192.168.64.10"
SSH_PORT="2222"
REPORT_FILE="/Users/ryan.maclean/vibecode-webgui/persistence-test-report.md"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Arrays to store results
BOOT_TIMES=()
SERVICE_RESULTS=()
DATADOG_RESULTS=()

# Initialize report
cat > "$REPORT_FILE" << 'EOF'
# VM Persistence Test Report - 5 Reboot Cycles

**Test Date:** $(date)
**App Path:** /tmp/vibecode-clean-test-1768252319/UnifiedServicesVibeCode.app
**VM IP:** 192.168.64.10

---

## Test Methodology

This test conducts 5 complete VM reboot cycles to verify:
- Service persistence and reliability
- Boot time consistency
- Datadog extension persistence
- Data ephemeral behavior (Valkey)
- System stability over multiple reboots

Each cycle includes:
1. Clean app shutdown
2. 5-second wait period
3. App launch
4. VM boot monitoring
5. Service health checks (SSH, Valkey, PostgreSQL, OpenVSCode)
6. Datadog extension verification
7. Performance measurements

---

EOF

log_message() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
    echo "$(date '+%H:%M:%S') - $1" >> /tmp/persistence-test.log
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $1"
    echo "$(date '+%H:%M:%S') - ERROR: $1" >> /tmp/persistence-test.log
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARNING:${NC} $1"
    echo "$(date '+%H:%M:%S') - WARNING: $1" >> /tmp/persistence-test.log
}

# Function to stop the app
stop_app() {
    log_message "Stopping app..."
    local PID=$(pgrep -f "UnifiedServicesVibeCode.app")
    if [ -n "$PID" ]; then
        kill "$PID"
        log_message "Sent kill signal to PID $PID"
        return 0
    else
        log_warning "No running app process found"
        return 1
    fi
}

# Function to start the app
start_app() {
    log_message "Starting app..."
    open "$APP_PATH"
    return $?
}

# Function to wait for SSH to be available
wait_for_ssh() {
    local max_wait=120
    local elapsed=0
    local start_time=$(date +%s)

    log_message "Waiting for SSH to become available..."

    while [ $elapsed -lt $max_wait ]; do
        if nc -z -w1 "$VM_IP" "$SSH_PORT" 2>/dev/null; then
            local end_time=$(date +%s)
            local boot_time=$((end_time - start_time))
            log_message "SSH available after ${boot_time} seconds"
            echo "$boot_time"
            return 0
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    log_error "SSH did not become available within ${max_wait} seconds"
    echo "-1"
    return 1
}

# Function to test SSH service
test_ssh() {
    log_message "Testing SSH service..."
    if nc -z -w2 "$VM_IP" "$SSH_PORT" 2>/dev/null; then
        log_message "SSH: PASS"
        echo "PASS"
        return 0
    else
        log_error "SSH: FAIL"
        echo "FAIL"
        return 1
    fi
}

# Function to test Valkey service
test_valkey() {
    log_message "Testing Valkey service..."
    local result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" "echo PING | nc localhost 6379" 2>/dev/null)
    if [[ "$result" == *"PONG"* ]]; then
        log_message "Valkey: PASS"
        echo "PASS"
        return 0
    else
        log_error "Valkey: FAIL"
        echo "FAIL"
        return 1
    fi
}

# Function to test PostgreSQL service
test_postgresql() {
    log_message "Testing PostgreSQL service..."
    local result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" "pg_isready -U postgres" 2>/dev/null)
    if [[ "$result" == *"accepting connections"* ]]; then
        log_message "PostgreSQL: PASS"
        echo "PASS"
        return 0
    else
        log_error "PostgreSQL: FAIL"
        echo "FAIL"
        return 1
    fi
}

# Function to test OpenVSCode service
test_openvscode() {
    log_message "Testing OpenVSCode service..."
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$VM_IP:3000" 2>/dev/null)
    if [ "$http_code" -eq 200 ]; then
        log_message "OpenVSCode: PASS"
        echo "PASS"
        return 0
    else
        log_error "OpenVSCode: FAIL (HTTP $http_code)"
        echo "FAIL"
        return 1
    fi
}

# Function to check Datadog extension
check_datadog_extension() {
    log_message "Checking Datadog extension..."

    # Check for extension directory
    local ext_check=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" \
        "ls -la /.openvscode-server/extensions/ 2>/dev/null | grep -i datadog" 2>/dev/null)

    if [ -n "$ext_check" ]; then
        log_message "Datadog extension directory: FOUND"
        echo "YES"
        return 0
    else
        log_error "Datadog extension directory: NOT FOUND"
        echo "NO"
        return 1
    fi
}

# Function to set Valkey test key
set_valkey_key() {
    local key=$1
    local value=$2
    log_message "Setting Valkey key: $key = $value"
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" \
        "echo -e 'SET $key \"$value\"\nQUIT' | nc localhost 6379" 2>/dev/null
}

# Function to get Valkey test key
get_valkey_key() {
    local key=$1
    log_message "Getting Valkey key: $key"
    local result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" \
        "echo -e 'GET $key\nQUIT' | nc localhost 6379" 2>/dev/null)
    echo "$result"
}

# Function to check disk space
check_disk_space() {
    log_message "Checking disk space..."
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" \
        "df -h /" 2>/dev/null
}

# Main test loop
main() {
    log_message "========================================="
    log_message "Starting 5-Reboot Persistence Test"
    log_message "========================================="

    for boot_num in {1..5}; do
        log_message ""
        log_message "========================================="
        log_message "BOOT CYCLE #$boot_num"
        log_message "========================================="

        # Record start timestamp
        local start_timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        log_message "Start timestamp: $start_timestamp"

        # Stop the app if this is not the first boot
        if [ $boot_num -gt 1 ]; then
            stop_app
            log_message "Waiting 5 seconds for clean shutdown..."
            sleep 5
        else
            log_message "First boot - checking if app is already running..."
            if pgrep -f "UnifiedServicesVibeCode.app" > /dev/null; then
                log_message "App is already running"
            else
                log_warning "App is not running - will start it"
            fi
        fi

        # Start the app
        if [ $boot_num -gt 1 ] || ! pgrep -f "UnifiedServicesVibeCode.app" > /dev/null; then
            start_app
            if [ $? -ne 0 ]; then
                log_error "Failed to start app on boot #$boot_num"
                continue
            fi
        fi

        # Wait for VM to boot and measure time
        log_message "Waiting for VM to boot..."
        boot_time=$(wait_for_ssh)

        if [ "$boot_time" -eq -1 ]; then
            log_error "Boot #$boot_num FAILED - SSH timeout"
            BOOT_TIMES+=("-1")
            continue
        fi

        BOOT_TIMES+=("$boot_time")
        log_message "Boot #$boot_num completed in ${boot_time}s"

        # Additional wait for services to initialize
        log_message "Waiting 10 seconds for services to initialize..."
        sleep 10

        # Test all services
        log_message "Testing services..."
        ssh_result=$(test_ssh)
        valkey_result=$(test_valkey)
        postgresql_result=$(test_postgresql)
        openvscode_result=$(test_openvscode)

        # Check Datadog extension
        datadog_result=$(check_datadog_extension)
        DATADOG_RESULTS+=("$datadog_result")

        # Check disk space
        disk_info=$(check_disk_space)

        # Test data persistence on boot #1 and #2
        if [ $boot_num -eq 1 ]; then
            log_message "Boot #1: Setting Valkey persistence test key..."
            set_valkey_key "TEST_PERSISTENCE" "boot1"
            valkey_key_result=$(get_valkey_key "TEST_PERSISTENCE")
            log_message "Valkey key set result: $valkey_key_result"
        elif [ $boot_num -eq 2 ]; then
            log_message "Boot #2: Checking Valkey persistence test key..."
            valkey_key_result=$(get_valkey_key "TEST_PERSISTENCE")
            if [[ "$valkey_key_result" == *"boot1"* ]]; then
                log_warning "Valkey key PERSISTED (unexpected for ephemeral VM)"
            else
                log_message "Valkey key NOT FOUND (expected for ephemeral VM)"
            fi
        fi

        # Append results to report
        cat >> "$REPORT_FILE" << EOF

## Boot Cycle #$boot_num

**Timestamp:** $start_timestamp
**Boot Time:** ${boot_time}s

### Service Status
- **SSH:** $ssh_result
- **Valkey:** $valkey_result
- **PostgreSQL:** $postgresql_result
- **OpenVSCode:** $openvscode_result

### Datadog Extension
- **Extension Present:** $datadog_result

### Disk Space
\`\`\`
$disk_info
\`\`\`

EOF

        if [ $boot_num -eq 1 ]; then
            cat >> "$REPORT_FILE" << EOF
### Data Persistence Test (Boot #1)
- Set Valkey key: TEST_PERSISTENCE = "boot1"
- Result: $valkey_key_result

EOF
        elif [ $boot_num -eq 2 ]; then
            cat >> "$REPORT_FILE" << EOF
### Data Persistence Test (Boot #2)
- Checked Valkey key: TEST_PERSISTENCE
- Result: $valkey_key_result
- **Ephemeral Behavior:** $(if [[ "$valkey_key_result" == *"boot1"* ]]; then echo "NO (key persisted)"; else echo "YES (key cleared)"; fi)

EOF
        fi

        log_message "Boot #$boot_num complete"
        log_message ""

        # Wait a bit before next reboot (except on last boot)
        if [ $boot_num -lt 5 ]; then
            log_message "Waiting 5 seconds before next reboot cycle..."
            sleep 5
        fi
    done

    # Generate summary
    log_message "========================================="
    log_message "Generating Summary"
    log_message "========================================="

    # Calculate boot time statistics
    local total_time=0
    local valid_boots=0
    local min_time=999999
    local max_time=0

    for time in "${BOOT_TIMES[@]}"; do
        if [ "$time" -ne -1 ]; then
            total_time=$((total_time + time))
            valid_boots=$((valid_boots + 1))
            if [ "$time" -lt "$min_time" ]; then
                min_time=$time
            fi
            if [ "$time" -gt "$max_time" ]; then
                max_time=$time
            fi
        fi
    done

    local avg_time=0
    if [ $valid_boots -gt 0 ]; then
        avg_time=$((total_time / valid_boots))
    fi

    # Calculate variance
    local variance=0
    if [ $valid_boots -gt 0 ] && [ $avg_time -gt 0 ]; then
        variance=$(( ((max_time - min_time) * 100) / avg_time ))
    fi

    cat >> "$REPORT_FILE" << EOF

---

## Summary

### Boot Time Statistics
- **Total Boots:** 5
- **Successful Boots:** $valid_boots
- **Failed Boots:** $((5 - valid_boots))
- **Average Boot Time:** ${avg_time}s
- **Min Boot Time:** ${min_time}s
- **Max Boot Time:** ${max_time}s
- **Variance:** ${variance}%
- **Boot Times:** ${BOOT_TIMES[@]}

### Boot Time Consistency
$(if [ $variance -lt 10 ]; then echo "✅ PASS - Variance < 10%"; else echo "❌ FAIL - Variance >= 10%"; fi)

### Datadog Extension Persistence
- **Boot #1:** ${DATADOG_RESULTS[0]}
- **Boot #2:** ${DATADOG_RESULTS[1]}
- **Boot #3:** ${DATADOG_RESULTS[2]}
- **Boot #4:** ${DATADOG_RESULTS[3]}
- **Boot #5:** ${DATADOG_RESULTS[4]}

### Overall Assessment

EOF

    # Check if all boots were successful
    if [ $valid_boots -eq 5 ]; then
        cat >> "$REPORT_FILE" << EOF
✅ **All 5 boots completed successfully**

EOF
    else
        cat >> "$REPORT_FILE" << EOF
❌ **Some boots failed** ($valid_boots/5 successful)

EOF
    fi

    # Check boot time consistency
    if [ $variance -lt 10 ]; then
        cat >> "$REPORT_FILE" << EOF
✅ **Boot times are consistent** (variance: ${variance}%)

EOF
    else
        cat >> "$REPORT_FILE" << EOF
⚠️ **Boot times show variance** (variance: ${variance}%)

EOF
    fi

    # Check Datadog persistence
    local datadog_count=0
    for result in "${DATADOG_RESULTS[@]}"; do
        if [ "$result" == "YES" ]; then
            datadog_count=$((datadog_count + 1))
        fi
    done

    if [ $datadog_count -eq 5 ]; then
        cat >> "$REPORT_FILE" << EOF
✅ **Datadog extension persisted across all reboots** ($datadog_count/5)

EOF
    else
        cat >> "$REPORT_FILE" << EOF
❌ **Datadog extension did not persist consistently** ($datadog_count/5)

EOF
    fi

    cat >> "$REPORT_FILE" << EOF

### Recommendations

EOF

    if [ $valid_boots -lt 5 ]; then
        cat >> "$REPORT_FILE" << EOF
- ⚠️ Investigate boot failures and improve reliability
EOF
    fi

    if [ $variance -ge 10 ]; then
        cat >> "$REPORT_FILE" << EOF
- ⚠️ Investigate boot time variance and optimize startup sequence
EOF
    fi

    if [ $datadog_count -lt 5 ]; then
        cat >> "$REPORT_FILE" << EOF
- ⚠️ Ensure Datadog extension is properly installed in persistent storage
EOF
    fi

    if [ $valid_boots -eq 5 ] && [ $variance -lt 10 ] && [ $datadog_count -eq 5 ]; then
        cat >> "$REPORT_FILE" << EOF
- ✅ System is stable and ready for production use
EOF
    fi

    cat >> "$REPORT_FILE" << EOF

---

**Test Completed:** $(date)

EOF

    log_message "========================================="
    log_message "Test Complete!"
    log_message "Report saved to: $REPORT_FILE"
    log_message "========================================="
}

# Run main function
main
