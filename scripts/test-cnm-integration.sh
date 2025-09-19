#!/bin/bash
set -euo pipefail

# Datadog Cloud Network Monitoring Testing Script
# Agent 9: CNM Testing & Verification

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🧪 AGENT 9: Testing Datadog Cloud Network Monitoring Configuration..."

# Function to check GitHub Actions workflow status
check_github_actions() {
    echo "🔍 Checking GitHub Actions workflow status..."
    
    # Check if we're in GitHub Actions environment
    if [ -n "${GITHUB_ACTIONS:-}" ]; then
        echo "✅ Running in GitHub Actions environment"
        echo "Workflow: $GITHUB_WORKFLOW"
        echo "Job: $GITHUB_JOB"
        echo "Run ID: $GITHUB_RUN_ID"
        
        # Check CNM environment variables
        echo "🔧 Checking CNM environment variables:"
        echo "  DD_SYSTEM_PROBE_NETWORK_ENABLED: ${DD_SYSTEM_PROBE_NETWORK_ENABLED:-not set}"
        echo "  DD_PROCESS_AGENT_ENABLED: ${DD_PROCESS_AGENT_ENABLED:-not set}"
        echo "  DD_NETWORK_CONFIG_ENABLE_EBPFLESS: ${DD_NETWORK_CONFIG_ENABLE_EBPFLESS:-not set}"
        echo "  DD_NETWORK_CONFIG_ENABLE_EBPF: ${DD_NETWORK_CONFIG_ENABLE_EBPF:-not set}"
        echo "  DD_SYSTEM_PROBE_ENABLED: ${DD_SYSTEM_PROBE_ENABLED:-not set}"
        
        # Check CI Visibility variables
        echo "🔧 Checking CI Visibility variables:"
        echo "  DD_CI_VISIBILITY_ENABLED: ${DD_CI_VISIBILITY_ENABLED:-not set}"
        echo "  DD_SERVICE: ${DD_SERVICE:-not set}"
        echo "  DD_ENV: ${DD_ENV:-not set}"
        echo "  DD_VERSION: ${DD_VERSION:-not set}"
        
        return 0
    else
        echo "ℹ️  Not running in GitHub Actions environment"
        return 1
    fi
}

# Function to test network connectivity
test_network_connectivity() {
    echo "🌐 Testing network connectivity..."
    
    # Test basic connectivity
    if command -v curl &> /dev/null; then
        echo "Testing connectivity to Datadog..."
        if curl -s --max-time 10 "https://api.datadoghq.com" > /dev/null; then
            echo "✅ Datadog API connectivity working"
        else
            echo "⚠️  Datadog API connectivity may be limited"
        fi
        
        # Test GitHub API connectivity
        if curl -s --max-time 10 "https://api.github.com" > /dev/null; then
            echo "✅ GitHub API connectivity working"
        else
            echo "⚠️  GitHub API connectivity may be limited"
        fi
    else
        echo "ℹ️  curl not available for connectivity testing"
    fi
}

# Function to simulate network activity for CNM
simulate_network_activity() {
    echo "🔄 Simulating network activity for CNM testing..."
    
    # Create some network activity
    if command -v curl &> /dev/null; then
        echo "Making test HTTP requests..."
        
        # Test requests to different endpoints
        curl -s --max-time 5 "https://httpbin.org/get" > /dev/null || true
        curl -s --max-time 5 "https://httpbin.org/status/200" > /dev/null || true
        curl -s --max-time 5 "https://httpbin.org/delay/1" > /dev/null || true
        
        echo "✅ Network activity simulation completed"
    else
        echo "ℹ️  curl not available for network simulation"
    fi
}

# Function to check Datadog agent status (if available)
check_datadog_agent() {
    echo "🔍 Checking Datadog agent status..."
    
    if command -v datadog-agent &> /dev/null; then
        echo "✅ Datadog Agent is available"
        
        # Check agent status
        if datadog-agent status | grep -i "network" > /dev/null; then
            echo "✅ Network monitoring is active in agent"
        else
            echo "ℹ️  Network monitoring status not visible in agent status"
        fi
        
        # Check process agent
        if datadog-agent status | grep -i "process" > /dev/null; then
            echo "✅ Process agent is active"
        else
            echo "ℹ️  Process agent status not visible"
        fi
    else
        echo "ℹ️  Datadog Agent not available - using ebpf-less mode"
    fi
}

# Function to generate test report
generate_test_report() {
    echo "📊 Generating CNM test report..."
    
    local report_file="$PROJECT_ROOT/cnm-test-report-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$report_file" << EOF
# Datadog Cloud Network Monitoring Test Report
Generated: $(date)
Agent: Agent 9 (CNM Testing & Verification)
Environment: ${GITHUB_ACTIONS:+GitHub Actions}${GITHUB_ACTIONS:-Local}

## Environment Variables Status
DD_SYSTEM_PROBE_NETWORK_ENABLED: ${DD_SYSTEM_PROBE_NETWORK_ENABLED:-not set}
DD_PROCESS_AGENT_ENABLED: ${DD_PROCESS_AGENT_ENABLED:-not set}
DD_NETWORK_CONFIG_ENABLE_EBPFLESS: ${DD_NETWORK_CONFIG_ENABLE_EBPFLESS:-not set}
DD_NETWORK_CONFIG_ENABLE_EBPF: ${DD_NETWORK_CONFIG_ENABLE_EBPF:-not set}
DD_SYSTEM_PROBE_ENABLED: ${DD_SYSTEM_PROBE_ENABLED:-not set}
DD_CI_VISIBILITY_ENABLED: ${DD_CI_VISIBILITY_ENABLED:-not set}
DD_SERVICE: ${DD_SERVICE:-not set}
DD_ENV: ${DD_ENV:-not set}
DD_VERSION: ${DD_VERSION:-not set}

## Test Results
- GitHub Actions Environment: $([ -n "${GITHUB_ACTIONS:-}" ] && echo "✅ Yes" || echo "❌ No")
- Network Connectivity: $(curl -s --max-time 5 "https://api.datadoghq.com" > /dev/null && echo "✅ Working" || echo "⚠️ Limited")
- Datadog Agent Available: $(command -v datadog-agent &> /dev/null && echo "✅ Yes" || echo "❌ No")

## Next Steps
1. Check Datadog CI Visibility dashboard for network data
2. Verify spans show network metrics (TCP, HTTP, DNS)
3. Monitor for "No network data available" message resolution
4. Document any issues or successes

EOF
    
    echo "✅ Test report generated: $report_file"
}

# Function to check workflow files
check_workflow_files() {
    echo "📁 Checking GitHub Actions workflow files..."
    
    local workflow_files=(
        ".github/workflows/test-ci-simplified.yml"
        ".github/workflows/gitops-deployment.yml"
        ".github/workflows/test-simple.yml"
    )
    
    for file in "${workflow_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            echo "✅ $file exists"
            
            # Check if CNM variables are present
            if grep -q "DD_SYSTEM_PROBE_NETWORK_ENABLED" "$PROJECT_ROOT/$file"; then
                echo "  ✅ CNM environment variables found"
            else
                echo "  ❌ CNM environment variables missing"
            fi
        else
            echo "❌ $file missing"
        fi
    done
}

# Function to validate CNM configuration
validate_cnm_config() {
    echo "🔍 Validating CNM configuration..."
    
    local errors=0
    
    # Check required environment variables
    if [ "${DD_SYSTEM_PROBE_NETWORK_ENABLED:-}" != "true" ]; then
        echo "❌ DD_SYSTEM_PROBE_NETWORK_ENABLED not set to true"
        ((errors++))
    fi
    
    if [ "${DD_PROCESS_AGENT_ENABLED:-}" != "true" ]; then
        echo "❌ DD_PROCESS_AGENT_ENABLED not set to true"
        ((errors++))
    fi
    
    if [ "${DD_NETWORK_CONFIG_ENABLE_EBPFLESS:-}" != "true" ]; then
        echo "❌ DD_NETWORK_CONFIG_ENABLE_EBPFLESS not set to true"
        ((errors++))
    fi
    
    if [ "${DD_NETWORK_CONFIG_ENABLE_EBPF:-}" != "false" ]; then
        echo "❌ DD_NETWORK_CONFIG_ENABLE_EBPF not set to false"
        ((errors++))
    fi
    
    if [ $errors -eq 0 ]; then
        echo "✅ CNM configuration validation passed"
        return 0
    else
        echo "❌ CNM configuration validation failed ($errors errors)"
        return 1
    fi
}

# Main execution
main() {
    echo "🚀 Starting CNM testing and verification..."
    
    # Check if we're in GitHub Actions
    if check_github_actions; then
        echo "✅ GitHub Actions environment detected"
    else
        echo "ℹ️  Running in local environment"
    fi
    
    # Check workflow files
    check_workflow_files
    
    # Validate CNM configuration
    if validate_cnm_config; then
        echo "✅ CNM configuration is valid"
    else
        echo "❌ CNM configuration has issues"
        exit 1
    fi
    
    # Test network connectivity
    test_network_connectivity
    
    # Check Datadog agent status
    check_datadog_agent
    
    # Simulate network activity
    simulate_network_activity
    
    # Generate test report
    generate_test_report
    
    echo "🎉 CNM testing completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Check Datadog CI Visibility dashboard for network data"
    echo "2. Verify spans show network metrics (TCP, HTTP, DNS)"
    echo "3. Monitor for 'No network data available' message resolution"
    echo "4. Document results in TODO.md"
}

# Run main function
main "$@"
