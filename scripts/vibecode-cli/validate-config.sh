#!/bin/sh
# Vibecode WebGUI configuration validator
# Ensures environment files and integrations are ready for local development.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

WARNINGS=0
ERRORS=0

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

info() { printf "${BLUE}%s${NC}\n" "$1"; }
ok() { printf "${GREEN}✓ %s${NC}\n" "$1"; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$1"; WARNINGS=$((WARNINGS + 1)); }
err() { printf "${RED}✗ %s${NC}\n" "$1"; ERRORS=$((ERRORS + 1)); }

info "Vibecode WebGUI configuration validator"

CONFIG_FILE=".env.local"
if [ ! -f "$CONFIG_FILE" ]; then
    if [ -f "env.development.example" ]; then
        warn ".env.local not found. Create one via scripts/vibecode-cli/install.sh"
    else
        err "No local environment file present."
    fi
else
    ok "Found $CONFIG_FILE"
fi

load_var() {
    VAR_NAME="$1"
    if [ -f "$CONFIG_FILE" ]; then
        VALUE=$(grep "^$VAR_NAME=" "$CONFIG_FILE" | tail -n 1 | cut -d '=' -f2-)
        printf "%s" "$VALUE"
    else
        printf ""
    fi
}

DD_API_KEY=$(load_var "DD_API_KEY")
DD_SITE=$(load_var "DD_SITE")
DATABASE_URL=$(load_var "DATABASE_URL")
REDIS_URL=$(load_var "REDIS_URL")

info "Validating Datadog configuration"
if [ -z "$DD_API_KEY" ]; then
    warn "DD_API_KEY missing"
elif printf "%s" "$DD_API_KEY" | grep -qi "your-datadog"; then
    warn "DD_API_KEY still set to placeholder"
else
    ok "DD_API_KEY present"
fi

if [ -z "$DD_SITE" ]; then
    warn "DD_SITE not configured (defaulting to datadoghq.com)"
else
    ok "DD_SITE: $DD_SITE"
fi

if command -v curl >/dev/null 2>&1 && [ -n "$DD_API_KEY" ] && ! printf "%s" "$DD_API_KEY" | grep -qi "your-datadog"; then
    DD_BASE="https://${DD_SITE:-datadoghq.com}"
    if curl -s -m 5 -H "DD-API-KEY: $DD_API_KEY" "$DD_BASE/api/v1/validate" >/dev/null 2>&1; then
        ok "Datadog API reachable"
    else
        warn "Unable to validate Datadog API key against $DD_BASE"
    fi
else
    warn "Skipping Datadog connectivity (missing curl or API key)"
fi

info "Validating database connectivity"
if [ -z "$DATABASE_URL" ]; then
    warn "DATABASE_URL not configured"
elif command -v psql >/dev/null 2>&1; then
    if PGPASSWORD="" psql "$DATABASE_URL" -c 'SELECT 1;' >/dev/null 2>&1; then
        ok "Database reachable"
    else
        warn "Database connection failed. Ensure service is running."
    fi
else
    warn "psql not available. Install PostgreSQL client to test connectivity."
fi

info "Validating Redis configuration"
if [ -z "$REDIS_URL" ]; then
    warn "REDIS_URL not configured"
elif command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
        ok "Redis reachable"
    else
        warn "Redis ping failed ($REDIS_URL)"
    fi
else
    warn "redis-cli not installed. Skipping Redis connectivity test."
fi

info "Checking project tooling"
for tool in node npm git; do
    if command -v "$tool" >/dev/null 2>&1; then
        ok "$tool available"
    else
        err "$tool not found"
    fi
done

if [ -d node_modules ]; then
    ok "node_modules directory present"
else
    warn "node_modules missing. Run npm install."
fi

printf "\n"
info "Summary"
printf "  Errors  : %s\n" "$ERRORS"
printf "  Warnings: %s\n" "$WARNINGS"

if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    printf "${GREEN}Configuration validated successfully.${NC}\n"
elif [ "$ERRORS" -eq 0 ]; then
    printf "${YELLOW}Validation completed with warnings.${NC}\n"
else
    printf "${RED}Validation failed. Address the issues above.${NC}\n"
fi

[ "$ERRORS" -eq 0 ] || exit 1

