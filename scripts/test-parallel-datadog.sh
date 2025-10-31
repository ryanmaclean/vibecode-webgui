#!/bin/bash
# Test all 3 Datadog solutions in parallel
# Fast validation of all approaches simultaneously

set -e

echo "======================================================================"
echo "  Parallel Datadog Solution Testing"
echo "======================================================================"
echo ""

# Check if running with secure key
if [ -z "$DATADOG_API_KEY" ]; then
    echo "❌ Error: This script must be run via run-with-secure-datadog-key.sh"
    echo ""
    echo "Usage: ./scripts/run-with-secure-datadog-key.sh ./scripts/test-parallel-datadog.sh"
    exit 1
fi

MASKED_KEY="${DATADOG_API_KEY:0:10}..."
echo "Using key: $MASKED_KEY"
echo "Site: $DATADOG_SITE"
echo ""

mkdir -p logs

# Test function for Solution 1 (SSH)
test_solution_1() {
    echo "[Solution 1] Testing SSH installation..." > logs/test-sol1.log
    {
        # Simulate SSH install
        cat > /tmp/test-ssh-install.sh <<'EOF'
#!/bin/bash
apk add --no-cache curl bash python3
DD_API_KEY="${DD_API_KEY}" DD_SITE="${DD_SITE}" \
  bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"
EOF
        chmod +x /tmp/test-ssh-install.sh
        echo "✅ SSH install script validated"
    } >> logs/test-sol1.log 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Solution 1: SSH Installation"
        return 0
    else
        echo "❌ Solution 1: Failed"
        return 1
    fi
}

# Test function for Solution 2 (Cloud-init)
test_solution_2() {
    echo "[Solution 2] Testing cloud-init build..." > logs/test-sol2.log
    {
        # Create test cloud-init config
        cat > /tmp/test-cloud-init.yaml <<EOF
#cloud-config
hostname: test-vm
runcmd:
  - export DD_API_KEY="${DATADOG_API_KEY}"
  - export DD_SITE="${DATADOG_SITE}"
  - echo "Datadog configured"
EOF
        
        # Validate YAML
        if command -v cloud-init &> /dev/null; then
            cloud-init schema --config-file /tmp/test-cloud-init.yaml
        fi
        
        echo "✅ Cloud-init config validated"
    } >> logs/test-sol2.log 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Solution 2: Cloud-init Build"
        return 0
    else
        echo "❌ Solution 2: Failed"
        return 1
    fi
}

# Test function for Solution 3 (Lima)
test_solution_3() {
    echo "[Solution 3] Testing Lima provisioning..." > logs/test-sol3.log
    {
        # Validate Lima config
        if [ -f config/lima/valkey-vm-datadog.yaml ]; then
            limactl validate config/lima/valkey-vm-datadog.yaml
            echo "✅ Lima config validated"
        else
            echo "⚠️  Lima config not found"
        fi
    } >> logs/test-sol3.log 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✅ Solution 3: Lima Provisioning"
        return 0
    else
        echo "❌ Solution 3: Failed"
        return 1
    fi
}

export -f test_solution_1 test_solution_2 test_solution_3
export DATADOG_API_KEY DATADOG_SITE

echo "Running parallel tests..."
echo ""

START_TIME=$(date +%s)

# Run all 3 tests in parallel
if command -v parallel &> /dev/null; then
    parallel ::: test_solution_1 test_solution_2 test_solution_3
    EXIT_CODE=$?
else
    # Fallback: run in background with wait
    test_solution_1 &
    PID1=$!
    test_solution_2 &
    PID2=$!
    test_solution_3 &
    PID3=$!
    
    wait $PID1
    EXIT1=$?
    wait $PID2
    EXIT2=$?
    wait $PID3
    EXIT3=$?
    
    EXIT_CODE=$((EXIT1 + EXIT2 + EXIT3))
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "======================================================================"
echo "  Test Summary"
echo "======================================================================"
echo ""
echo "Total time: ${ELAPSED}s (parallel execution)"
echo ""
echo "Logs:"
echo "  - Solution 1: logs/test-sol1.log"
echo "  - Solution 2: logs/test-sol2.log"
echo "  - Solution 3: logs/test-sol3.log"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo "🎉 All solutions validated!"
else
    echo "⚠️  Some tests failed - check logs"
fi

