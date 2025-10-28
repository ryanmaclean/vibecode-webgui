#!/bin/sh
# Vibecode WebGUI - Comprehensive validation harness
# Runs health checks, unit tests, and optional integration smoke tests.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_TESTS=0
SKIP_MOCK=0

usage() {
    cat <<'USAGE'
Usage: scripts/comprehensive-validation.sh [options]

Runs Vibecode WebGUI validation steps:
  1. Configuration validation
  2. Mock telemetry server startup (optional)
  3. Lint & type checks
  4. Targeted unit tests
  5. Playwright smoke listing (ensures config loads)

Options:
    --skip-tests   Skip Jest and Playwright checks
    --skip-mock    Do not launch mock telemetry server
    -h, --help     Show this message
USAGE
}

while [ $# -gt 0 ]; do
    case "$1" in
        --skip-tests)
            SKIP_TESTS=1
            ;;
        --skip-mock)
            SKIP_MOCK=1
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            printf "${RED}Unknown option: %s${NC}\n" "$1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

log() { printf "${BLUE}%s${NC}\n" "$1"; }
ok() { printf "${GREEN}✓ %s${NC}\n" "$1"; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$1"; }
err() { printf "${RED}✗ %s${NC}\n" "$1"; }

log "Vibecode WebGUI comprehensive validation"
log "Project root: $PROJECT_ROOT"

if [ ! -d node_modules ]; then
    warn "node_modules missing. Run scripts/vibecode-cli/install.sh first."
fi

log "Validating configuration"
if scripts/vibecode-cli/validate-config.sh; then
    ok "Configuration validated"
else
    warn "Configuration checks reported issues. Review output above."
fi

MOCK_PID=""
if [ "$SKIP_MOCK" -eq 0 ]; then
    if command -v python3 >/dev/null 2>&1; then
        log "Starting mock telemetry server on 0.0.0.0:8080"
        python3 scripts/mock-services/mock-telemetry-server.py --http-port 8080 --statsd-port 0 &
        MOCK_PID=$!
        sleep 1
        ok "Mock telemetry server PID $MOCK_PID"
    else
        warn "python3 not available; skipping mock telemetry server"
    fi
else
    warn "Skipping mock telemetry server (--skip-mock)"
fi

cleanup() {
    if [ -n "$MOCK_PID" ] && ps -p "$MOCK_PID" >/dev/null 2>&1; then
        kill "$MOCK_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

log "Running lint & type checks (npm run check)"
if npm run check; then
    ok "Lint + type check passed"
else
    err "Lint or type check failed"
    EXIT_CODE=1
fi

if [ "$SKIP_TESTS" -eq 0 ]; then
    log "Executing focused unit tests"
    if npm run test:unit -- --runInBand --bail; then
        ok "Unit tests passed"
    else
        err "Unit tests failed"
        EXIT_CODE=1
    fi

    log "Ensuring Playwright config loads"
    if npx playwright test --list; then
        ok "Playwright project detected"
    else
        warn "Playwright command failed. Install dependencies if UI tests are required."
        EXIT_CODE=1
    fi
else
    warn "Skipping tests (--skip-tests)"
fi

if [ -z "$EXIT_CODE" ]; then
    log "Validation complete"
    exit 0
else
    err "Validation completed with failures"
    exit "$EXIT_CODE"
fi

