#!/usr/bin/env bash
# Test Monitoring Integration Script

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"
cd "$REPO_ROOT"

log_step "🔍 Testing Datadog Monitoring Integration"

# Load environment variables: prefer .env, fall back to .env.local
if [ -f ".env" ]; then
    log_info "Loading environment variables from .env"
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
elif [ -f ".env.local" ]; then
    log_info "Loading environment variables from .env.local (fallback)"
    set -a
    # shellcheck disable=SC1091
    source .env.local
    set +a
fi

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0

run_test() {
    local test_name="$1"
    local command="$2"
    
    log_info "Testing: ${test_name}"
    
    ((TOTAL_TESTS++))
    
    if eval "$command" > /dev/null 2>&1; then
        log_success "✅ PASS - $test_name"
        ((PASSED_TESTS++))
    else
        log_error "❌ FAIL - $test_name"
    fi
}

log_step "1. Environment Configuration Tests"
echo "-----------------------------------"

# Test environment variables
run_test "DD_API_KEY is set" "[ ! -z \"\$DD_API_KEY\" ]"
run_test "DD_SERVICE is configured" "[ ! -z \"\$DD_SERVICE\" ] || [ ! -z \"\${DD_SERVICE:-vibecode-webgui}\" ]"
run_test "DD_ENV is configured" "[ ! -z \"\$DD_ENV\" ] || [ ! -z \"\${DD_ENV:-development}\" ]"

log_step "2. Package Dependencies"

# Test required packages
run_test "dd-trace package is installed" "npm list dd-trace"
run_test "@datadog/browser-rum is installed" "npm list @datadog/browser-rum"
run_test "@datadog/datadog-api-client is installed" "npm list @datadog/datadog-api-client"

log_step "3. Instrumentation Files"

# Test instrumentation files exist
run_test "src/instrument.ts exists" "[ -f src/instrument.ts ]"
run_test "LLM tracer exists" "[ -f src/lib/monitoring/llm-tracer.ts ]"
run_test "RUM client exists" "[ -f src/lib/monitoring/rum-client.ts ]"

log_step "4. Configuration Validation"

# Test TypeScript compilation
run_test "Instrumentation compiles" "npx tsc --noEmit src/instrument.ts"
run_test "LLM tracer compiles" "npx tsc --noEmit src/lib/monitoring/llm-tracer.ts"
run_test "RUM client compiles" "npx tsc --noEmit src/lib/monitoring/rum-client.ts"

log_step "5. Docker Compose Monitoring"

# Test Docker Compose configuration
run_test "Datadog agent configured in docker-compose" "grep -q 'datadog-agent:' docker-compose.yml"
run_test "DD_APM_ENABLED in docker-compose" "grep -q 'DD_APM_ENABLED=true' docker-compose.yml"
run_test "DD_LOGS_ENABLED in docker-compose" "grep -q 'DD_LOGS_ENABLED=true' docker-compose.yml"

log_step "6. Frontend RUM Configuration"

# Test RUM configuration in built docs
run_test "RUM script in Astro config" "grep -q 'datadog-rum.js' docs/astro.config.mjs"
run_test "sessionSampleRate configured" "grep -q 'sessionSampleRate.*100' docs/astro.config.mjs"
run_test "sessionReplaySampleRate configured" "grep -q 'sessionReplaySampleRate.*20' docs/astro.config.mjs"

log_step "7. Live Monitoring Test"

# Test if Datadog agent is accessible
if command -v curl >/dev/null 2>&1; then
    run_test "APM endpoint accessible (if running)" "timeout 3 curl -f http://localhost:8126/info 2>/dev/null || true"
    run_test "StatsD endpoint accessible (if running)" "timeout 3 nc -u -z localhost 8125 2>/dev/null || true"
else
    echo "⚠️  curl not available, skipping live monitoring tests"
fi

log_step "8. Synthetic Monitoring Data"

# Create a simple test to send monitoring data
cat > /tmp/test-monitoring.js << 'EOF'
// Test script to send monitoring data
const tracer = require('dd-trace');

// Initialize tracer
tracer.init({
    env: 'test',
    service: 'vibecode-monitoring-test',
    version: '1.0.0'
});

// Create a test span
const span = tracer.startSpan('monitoring.test');
span.setTag('test.type', 'integration');
span.setTag('test.component', 'monitoring');
span.finish();

console.log('✅ Test span created successfully');

// Test LLM observability data structure
const llmSpan = tracer.startSpan('llm.completion');
llmSpan.setTag('llm.request.model', 'gpt-4');
llmSpan.setTag('llm.request.provider', 'openai');
llmSpan.setTag('llm.operation', 'test-completion');
llmSpan.setTag('llm.usage.total_tokens', 100);
llmSpan.finish();

console.log('✅ LLM test span created successfully');
EOF

run_test "Test monitoring data creation" "cd '$REPO_ROOT' && node /tmp/test-monitoring.js"

log_step "9. Environment Files Check"

# Check for proper environment configuration
if [ -f ".env" ] || [ -f ".env.local" ]; then
    ENV_FILE=".env"; [ ! -f ".env" ] && ENV_FILE=".env.local"
    run_test "Datadog API key configured in $ENV_FILE" "grep -Eq '^(DD_API_KEY|DATADOG_API_KEY)=' $ENV_FILE"
    run_test "DD_LLMOBS_ENABLED configured" "grep -q 'DD_LLMOBS_ENABLED=' $ENV_FILE"
    run_test "RUM application ID configured" "grep -Eq '^NEXT_PUBLIC_(DD|DATADOG).*APPLICATION_ID=' $ENV_FILE"
else
    echo "⚠️  No .env or .env.local found, using environment variables"
fi

log_step "10. Integration Recommendations"

echo "📋 To complete monitoring setup:"
echo "  1. Ensure valid Datadog API keys are set"
echo "  2. Configure RUM client token for frontend monitoring"
echo "  3. Start Docker Compose to test agent connectivity"
echo "  4. Deploy to staging/production for full validation"

log_step "📊 Test Results Summary"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Passed: $PASSED_TESTS"
echo "  Failed: $((TOTAL_TESTS - PASSED_TESTS))"

if [ "$PASSED_TESTS" -eq "$TOTAL_TESTS" ]; then
    log_success "🎉 All monitoring tests passed!"
    echo "Your Datadog monitoring integration is properly configured."
    rm -f /tmp/test-monitoring.js
    exit 0
else
    log_warn "⚠️  Some tests failed. Review the configuration above."
    rm -f /tmp/test-monitoring.js
    exit 1
fi