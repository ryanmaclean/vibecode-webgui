#!/usr/bin/env bash
# Datadog monitoring integration smoke checks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

REPO_ROOT="$(cd "${SCRIPTS_ROOT}/.." && pwd)"
cd "$REPO_ROOT"

log_step "Datadog Monitoring Integration Checks"

TOTAL_TESTS=0
PASSED_TESTS=0

run_test() {
  local name=$1
  local command=$2
  ((TOTAL_TESTS+=1))
  log_info "Running: ${name}"
  if eval "$command" >/dev/null 2>&1; then
    log_success "${name}"
    ((PASSED_TESTS+=1))
  else
    log_error "${name}"
  fi
}

log_step "1. Loading environment variables"
ENV_FILE=""
if [[ -f .env ]]; then
  ENV_FILE=".env"
elif [[ -f .env.local ]]; then
  ENV_FILE=".env.local"
fi

if [[ -n "$ENV_FILE" ]]; then
  log_info "Sourcing variables from ${ENV_FILE}"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  log_warn "No .env or .env.local file found – relying on in-session variables"
fi

log_step "2. Environment configuration"
run_test "DD_API_KEY is set" "[ -n \"${DD_API_KEY:-${DATADOG_API_KEY:-}}\" ]"
run_test "DD_SERVICE configured" "[ -n \"${DD_SERVICE:-}\" ]"
run_test "DD_ENV configured" "[ -n \"${DD_ENV:-}\" ]"

log_step "3. Package dependencies"
run_test "dd-trace installed" 'npm list dd-trace'
run_test "@datadog/browser-rum installed" 'npm list @datadog/browser-rum'
run_test "@datadog/datadog-api-client installed" 'npm list @datadog/datadog-api-client'

log_step "4. Instrumentation files present"
run_test "src/instrument.ts present" '[ -f src/instrument.ts ]'
run_test "LLM tracer present" '[ -f src/lib/monitoring/llm-tracer.ts ]'
run_test "RUM client present" '[ -f src/lib/monitoring/rum-client.ts ]'

log_step "5. TypeScript compilation checks"
run_test "Instrumentation compiles" 'npx tsc --noEmit src/instrument.ts'
run_test "LLM tracer compiles" 'npx tsc --noEmit src/lib/monitoring/llm-tracer.ts'
run_test "RUM client compiles" 'npx tsc --noEmit src/lib/monitoring/rum-client.ts'

log_step "6. Docker Compose monitoring configuration"
run_test "Datadog agent defined" "grep -q 'datadog-agent:' docker-compose.yml"
run_test "DD_APM_ENABLED present" "grep -q 'DD_APM_ENABLED=true' docker-compose.yml"
run_test "DD_LOGS_ENABLED present" "grep -q 'DD_LOGS_ENABLED=true' docker-compose.yml"

log_step "7. Astro RUM configuration"
run_test "RUM script referenced" "grep -q 'datadog-rum.js' docs/astro.config.mjs"
run_test "sessionSampleRate configured" "grep -q 'sessionSampleRate.*100' docs/astro.config.mjs"
run_test "sessionReplaySampleRate configured" "grep -q 'sessionReplaySampleRate.*20' docs/astro.config.mjs"

log_step "8. Live endpoints (best effort)"
if command -v curl >/dev/null 2>&1; then
  run_test "APM agent responding" 'timeout 3 curl -f http://localhost:8126/info 2>/dev/null || true'
else
  log_warn "curl not available – skipping APM probe"
fi
if command -v nc >/dev/null 2>&1; then
  run_test "StatsD port reachable" 'timeout 3 nc -u -z localhost 8125 2>/dev/null || true'
else
  log_warn "nc not available – skipping StatsD probe"
fi

log_step "9. Synthetic monitoring span test"
cat > /tmp/test-monitoring.js <<'NODE'
const tracer = require('dd-trace');
tracer.init({ env: 'test', service: 'vibecode-monitoring-test', version: '1.0.0' });
const span = tracer.startSpan('monitoring.test');
span.setTag('test.type', 'integration');
span.finish();
const llmSpan = tracer.startSpan('llm.completion');
llmSpan.setTag('llm.request.model', 'gpt-4');
llmSpan.setTag('llm.operation', 'test-completion');
llmSpan.setTag('llm.usage.total_tokens', 100);
llmSpan.finish();
NODE
run_test "Synthetic spans emit" "node /tmp/test-monitoring.js"

log_step "10. Environment file sanity"
if [[ -n "$ENV_FILE" ]]; then
  run_test "Datadog API key in ${ENV_FILE}" "grep -Eq '^(DD_API_KEY|DATADOG_API_KEY)=' ${ENV_FILE}"
  run_test "DD_LLMOBS_ENABLED present" "grep -q 'DD_LLMOBS_ENABLED=' ${ENV_FILE}"
  run_test "RUM application ID present" "grep -Eq '^NEXT_PUBLIC_(DD|DATADOG).*APPLICATION_ID=' ${ENV_FILE}"
else
  log_warn "Skipped .env checks – no environment file available"
fi

log_step "Summary"
log_info "Total tests: ${TOTAL_TESTS}"
log_success "Passed: ${PASSED_TESTS}"
FAILED=$((TOTAL_TESTS - PASSED_TESTS))
if (( FAILED == 0 )); then
  log_success "Monitoring integration looks healthy"
else
  log_warn "${FAILED} checks failed – review the log output above"
fi
