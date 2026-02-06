#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Persistence Test Script for VM Reboot Cycles - Version 2
# Tests 5 complete reboot cycles and measures consistency

# Initialize log aggregation
init_log_aggregation


APP_PATH="/Users/ryan.maclean/vibecode-webgui/azure/SwiftUI-Apps/UnifiedServicesVibeCode-v3.0.app"
VM_IP="192.168.64.10"
SSH_PORT="2222"
REPORT_FILE="/Users/ryan.maclean/vibecode-webgui/persistence-test-report.md"
LOG_FILE="/Users/ryan.maclean/vibecode-webgui/persistence-test.log"

# Arrays to store results
declare -a BOOT_TIMES
declare -a SSH_RESULTS
declare -a VALKEY_RESULTS
declare -a POSTGRESQL_RESULTS
declare -a OPENVSCODE_RESULTS
declare -a DATADOG_RESULTS
declare -a ERRORS
declare -a WARNINGS

echo "Starting persistence test at $(date)" > "$LOG_FILE"

log_message() {
    echo "[$(date '+%H:%M:%S')] $1"
    echo "$(date '+%H:%M:%S') - $1" >> "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%H:%M:%S')] ERROR: $1"
    echo "$(date '+%H:%M:%S') - ERROR: $1" >> "$LOG_FILE"
}

log_warning() {
    echo "[$(date '+%H:%M:%S')] WARNING: $1"
    echo "$(date '+%H:%M:%S') - WARNING: $1" >> "$LOG_FILE"
}

# Function to stop the app
stop_app() {
    log_message "Stopping app..."
    local PID=$(pgrep -f "UnifiedServicesVibeCode")
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
    log_message "Starting app from: $APP_PATH"
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
    if nc -z -w2 "$VM_IP" "$SSH_PORT" 2>/dev/null; then
        echo "PASS"
        return 0
    else
        echo "FAIL"
        return 1
    fi
}

# Function to test Valkey service
test_valkey() {
    local result=$(timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" "echo PING | nc localhost 6379" 2>/dev/null | head -1)
    if [[ "$result" == *"PONG"* ]]; then
        echo "PASS"
        return 0
    else
        echo "FAIL"
        return 1
    fi
}

# Function to test PostgreSQL service
test_postgresql() {
    local result=$(timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" "pg_isready -U postgres" 2>/dev/null)
    if [[ "$result" == *"accepting connections"* ]]; then
        echo "PASS"
        return 0
    else
        echo "FAIL"
        return 1
    fi
}

# Function to test OpenVSCode service
test_openvscode() {
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$VM_IP:3000" 2>/dev/null)
    if [ "$http_code" -eq 200 ]; then
        echo "PASS"
        return 0
    else
        echo "FAIL"
        return 1
    fi
}

# Function to check Datadog extension
check_datadog_extension() {
    local ext_check=$(timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" \
        "ls -la /.openvscode-server/extensions/ 2>/dev/null | grep -i datadog" 2>/dev/null)

    if [ -n "$ext_check" ]; then
        echo "YES"
        return 0
    else
        echo "NO"
        return 1
    fi
}

# Function to check for Datadog UI notification
check_datadog_ui_notification() {
    log_message "Checking for Datadog UI notification (manual check required)"
    # This would require checking the OpenVSCode web UI
    echo "MANUAL_CHECK"
}

# Function to set Valkey test key
set_valkey_key() {
    local key=$1
    local value=$2
    log_message "Setting Valkey key: $key = $value"
    timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" \
        "echo 'SET $key \"$value\"' | nc localhost 6379" 2>/dev/null
}

# Function to get Valkey test key
get_valkey_key() {
    local key=$1
    log_message "Getting Valkey key: $key"
    local result=$(timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" \
        "echo 'GET $key' | nc localhost 6379" 2>/dev/null)
    echo "$result"
}

# Function to check disk space
check_disk_space() {
    timeout 5 ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p "$SSH_PORT" vibecode@"$VM_IP" \
        "df -h /" 2>/dev/null
}

# Initialize report
cat > "$REPORT_FILE" << EOF
# VM Persistence Test Report - 5 Reboot Cycles

**Test Date:** $(date)
**App Path:** $APP_PATH
**VM IP:** $VM_IP

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
            if pgrep -f "UnifiedServicesVibeCode" > /dev/null; then
                log_message "App is already running - stopping it first for clean test"
                stop_app
                sleep 5
            fi
        fi

        # Start the app
        log_message "Launching app..."
        start_app
        if [ $? -ne 0 ]; then
            log_error "Failed to start app on boot #$boot_num"
            BOOT_TIMES+=("-1")
            SSH_RESULTS+=("FAIL")
            VALKEY_RESULTS+=("FAIL")
            POSTGRESQL_RESULTS+=("FAIL")
            OPENVSCODE_RESULTS+=("FAIL")
            DATADOG_RESULTS+=("NO")
            ERRORS+=("Boot #$boot_num: Failed to start app")
            continue
        fi

        # Wait for VM to boot and measure time
        log_message "Waiting for VM to boot..."
        local boot_time=$(wait_for_ssh)

        if [ "$boot_time" -eq -1 ]; then
            log_error "Boot #$boot_num FAILED - SSH timeout"
            BOOT_TIMES+=("-1")
            SSH_RESULTS+=("FAIL")
            VALKEY_RESULTS+=("FAIL")
            POSTGRESQL_RESULTS+=("FAIL")
            OPENVSCODE_RESULTS+=("FAIL")
            DATADOG_RESULTS+=("NO")
            ERRORS+=("Boot #$boot_num: SSH timeout")
            continue
        fi

        BOOT_TIMES+=("$boot_time")
        log_message "Boot #$boot_num completed in ${boot_time}s"

        # Additional wait for services to initialize
        log_message "Waiting 10 seconds for services to initialize..."
        sleep 10

        # Test all services
        log_message "Testing services..."
        local ssh_result=$(test_ssh)
        local valkey_result=$(test_valkey)
        local postgresql_result=$(test_postgresql)
        local openvscode_result=$(test_openvscode)

        SSH_RESULTS+=("$ssh_result")
        VALKEY_RESULTS+=("$valkey_result")
        POSTGRESQL_RESULTS+=("$postgresql_result")
        OPENVSCODE_RESULTS+=("$openvscode_result")

        log_message "SSH: $ssh_result | Valkey: $valkey_result | PostgreSQL: $postgresql_result | OpenVSCode: $openvscode_result"

        # Check Datadog extension
        local datadog_result=$(check_datadog_extension)
        DATADOG_RESULTS+=("$datadog_result")
        log_message "Datadog Extension: $datadog_result"

        # Check disk space
        local disk_info=$(check_disk_space)

        # Test data persistence on boot #1 and #2
        local valkey_persistence_result=""
        if [ $boot_num -eq 1 ]; then
            log_message "Boot #1: Setting Valkey persistence test key..."
            set_valkey_key "TEST_PERSISTENCE" "boot1"
            sleep 1
            valkey_persistence_result=$(get_valkey_key "TEST_PERSISTENCE")
            log_message "Valkey key set, verification: $valkey_persistence_result"
        elif [ $boot_num -eq 2 ]; then
            log_message "Boot #2: Checking Valkey persistence test key..."
            valkey_persistence_result=$(get_valkey_key "TEST_PERSISTENCE")
            if [[ "$valkey_persistence_result" == *"boot1"* ]]; then
                log_warning "Valkey key PERSISTED (unexpected for ephemeral VM)"
                WARNINGS+=("Boot #2: Valkey data persisted unexpectedly")
            else
                log_message "Valkey key NOT FOUND (expected for ephemeral VM)"
            fi
        fi

        # Check for any errors or warnings
        if [ "$ssh_result" == "FAIL" ]; then
            ERRORS+=("Boot #$boot_num: SSH test failed")
        fi
        if [ "$valkey_result" == "FAIL" ]; then
            ERRORS+=("Boot #$boot_num: Valkey test failed")
        fi
        if [ "$postgresql_result" == "FAIL" ]; then
            ERRORS+=("Boot #$boot_num: PostgreSQL test failed")
        fi
        if [ "$openvscode_result" == "FAIL" ]; then
            ERRORS+=("Boot #$boot_num: OpenVSCode test failed")
        fi
        if [ "$datadog_result" == "NO" ]; then
            WARNINGS+=("Boot #$boot_num: Datadog extension not found")
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
- **UI Notification:** Manual check required

### Disk Space
\`\`\`
$disk_info
\`\`\`

EOF

        if [ $boot_num -eq 1 ]; then
            cat >> "$REPORT_FILE" << EOF
### Data Persistence Test (Boot #1)
- Set Valkey key: TEST_PERSISTENCE = "boot1"
- Verification: $valkey_persistence_result

EOF
        elif [ $boot_num -eq 2 ]; then
            local ephemeral_status="YES (key cleared)"
            if [[ "$valkey_persistence_result" == *"boot1"* ]]; then
                ephemeral_status="NO (key persisted)"
            fi
            cat >> "$REPORT_FILE" << EOF
### Data Persistence Test (Boot #2)
- Checked Valkey key: TEST_PERSISTENCE
- Result: $valkey_persistence_result
- **Ephemeral Behavior:** $ephemeral_status

EOF
        fi

        log_message "Boot #$boot_num complete"

        # Wait before next reboot (except on last boot)
        if [ $boot_num -lt 5 ]; then
            log_message "Waiting 5 seconds before next reboot cycle..."
            sleep 5
        fi
    done

    # Generate summary
    log_message ""
    log_message "========================================="
    log_message "Generating Summary"
    log_message "========================================="

    # Calculate boot time statistics
    local total_time=0
    local valid_boots=0
    local min_time=999999
    local max_time=0

    for time in "${BOOT_TIMES[@]}"; do
        if [ "$time" != "-1" ]; then
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
    local variance=0
    if [ $valid_boots -gt 0 ]; then
        avg_time=$((total_time / valid_boots))
        if [ $avg_time -gt 0 ]; then
            variance=$(( ((max_time - min_time) * 100) / avg_time ))
        fi
    fi

    # Count service passes
    local ssh_pass=0
    local valkey_pass=0
    local postgresql_pass=0
    local openvscode_pass=0
    local datadog_found=0

    for result in "${SSH_RESULTS[@]}"; do
        if [ "$result" == "PASS" ]; then
            ssh_pass=$((ssh_pass + 1))
        fi
    done

    for result in "${VALKEY_RESULTS[@]}"; do
        if [ "$result" == "PASS" ]; then
            valkey_pass=$((valkey_pass + 1))
        fi
    done

    for result in "${POSTGRESQL_RESULTS[@]}"; do
        if [ "$result" == "PASS" ]; then
            postgresql_pass=$((postgresql_pass + 1))
        fi
    done

    for result in "${OPENVSCODE_RESULTS[@]}"; do
        if [ "$result" == "PASS" ]; then
            openvscode_pass=$((openvscode_pass + 1))
        fi
    done

    for result in "${DATADOG_RESULTS[@]}"; do
        if [ "$result" == "YES" ]; then
            datadog_found=$((datadog_found + 1))
        fi
    done

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

### Service Reliability (Across All Boots)
- **SSH:** $ssh_pass/5 PASS
- **Valkey:** $valkey_pass/5 PASS
- **PostgreSQL:** $postgresql_pass/5 PASS
- **OpenVSCode:** $openvscode_pass/5 PASS

### Boot Time Consistency
$(if [ $variance -lt 10 ]; then echo "✅ PASS - Variance < 10%"; else echo "❌ FAIL - Variance >= 10% ($variance%)"; fi)

### Datadog Extension Persistence
- **Boots with Extension:** $datadog_found/5
- **Results per boot:** ${DATADOG_RESULTS[@]}

### Errors and Warnings

**Errors ($((${#ERRORS[@]})) total):**
EOF

    if [ ${#ERRORS[@]} -eq 0 ]; then
        echo "- None" >> "$REPORT_FILE"
    else
        for error in "${ERRORS[@]}"; do
            echo "- $error" >> "$REPORT_FILE"
        done
    fi

    cat >> "$REPORT_FILE" << EOF

**Warnings ($((${#WARNINGS[@]})) total):**
EOF

    if [ ${#WARNINGS[@]} -eq 0 ]; then
        echo "- None" >> "$REPORT_FILE"
    else
        for warning in "${WARNINGS[@]}"; do
            echo "- $warning" >> "$REPORT_FILE"
        done
    fi

    cat >> "$REPORT_FILE" << EOF

### Overall Assessment

EOF

    # Overall pass/fail assessment
    local overall_pass=true

    if [ $valid_boots -lt 5 ]; then
        cat >> "$REPORT_FILE" << EOF
❌ **Some boots failed** ($valid_boots/5 successful)

EOF
        overall_pass=false
    else
        cat >> "$REPORT_FILE" << EOF
✅ **All 5 boots completed successfully**

EOF
    fi

    if [ $variance -ge 10 ]; then
        cat >> "$REPORT_FILE" << EOF
⚠️ **Boot times show significant variance** (${variance}%)

EOF
        overall_pass=false
    else
        cat >> "$REPORT_FILE" << EOF
✅ **Boot times are consistent** (variance: ${variance}%)

EOF
    fi

    if [ $ssh_pass -eq 5 ] && [ $valkey_pass -eq 5 ] && [ $postgresql_pass -eq 5 ] && [ $openvscode_pass -eq 5 ]; then
        cat >> "$REPORT_FILE" << EOF
✅ **All services passed all tests**

EOF
    else
        cat >> "$REPORT_FILE" << EOF
❌ **Some service tests failed**

EOF
        overall_pass=false
    fi

    if [ $datadog_found -eq 5 ]; then
        cat >> "$REPORT_FILE" << EOF
✅ **Datadog extension persisted across all reboots**

EOF
    else
        cat >> "$REPORT_FILE" << EOF
⚠️ **Datadog extension persistence inconsistent** ($datadog_found/5)

EOF
    fi

    cat >> "$REPORT_FILE" << EOF

### Recommendations

EOF

    if [ "$overall_pass" = true ]; then
        cat >> "$REPORT_FILE" << EOF
✅ **System is stable and ready for production use**

All tests passed successfully:
- 5/5 boots completed
- Boot time variance < 10%
- All services functioning consistently
- Datadog extension persisting correctly

EOF
    else
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

        if [ $ssh_pass -lt 5 ] || [ $valkey_pass -lt 5 ] || [ $postgresql_pass -lt 5 ] || [ $openvscode_pass -lt 5 ]; then
            cat >> "$REPORT_FILE" << EOF
- ⚠️ Service reliability issues detected - investigate failed services
EOF
        fi

        if [ $datadog_found -lt 5 ]; then
            cat >> "$REPORT_FILE" << EOF
- ⚠️ Ensure Datadog extension is properly installed in persistent storage
EOF
        fi

        cat >> "$REPORT_FILE" << EOF

EOF
    fi

    cat >> "$REPORT_FILE" << EOF

---

**Test Completed:** $(date)
**Full Logs:** $LOG_FILE

EOF

    log_message "========================================="
    log_message "Test Complete!"
    log_message "Report saved to: $REPORT_FILE"
    log_message "Logs saved to: $LOG_FILE"
    log_message "========================================="

    echo ""
    echo "Summary:"
    echo "  Successful boots: $valid_boots/5"
    echo "  Average boot time: ${avg_time}s"
    echo "  Boot time variance: ${variance}%"
    echo "  Service reliability: SSH=$ssh_pass/5, Valkey=$valkey_pass/5, PostgreSQL=$postgresql_pass/5, OpenVSCode=$openvscode_pass/5"
    echo "  Datadog extension: $datadog_found/5"
    echo "  Errors: ${#ERRORS[@]}"
    echo "  Warnings: ${#WARNINGS[@]}"
}

# Run main function
main
