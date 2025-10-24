#!/bin/sh
# Vibecode WebGUI - Local installation helper
# Bootstraps development prerequisites, env files, and optional setup routines.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SKIP_INSTALL=0
SKIP_SETUP=0

while [ $# -gt 0 ]; do
    case "$1" in
        --skip-install)
            SKIP_INSTALL=1
            ;;
        --skip-setup)
            SKIP_SETUP=1
            ;;
        -h|--help)
            cat <<'USAGE'
Usage: scripts/vibecode-cli/install.sh [options]

Prepares a local Vibecode WebGUI development environment.

Options:
    --skip-install   Skip package installation (npm install)
    --skip-setup     Skip project setup script (npm run setup)
    -h, --help       Show this help text

Examples:
    # Standard install
    scripts/vibecode-cli/install.sh

    # Re-run validation without reinstalling dependencies
    scripts/vibecode-cli/install.sh --skip-install --skip-setup
USAGE
            exit 0
            ;;
        *)
            printf "${RED}Unknown option: %s${NC}\n" "$1" >&2
            exit 1
            ;;
    esac
    shift
done

if [ "$(id -u)" -eq 0 ]; then
    printf "${YELLOW}⚠ Running as root is not recommended. Continue? (y/N): ${NC}"
    read answer
    case "$answer" in
        y|Y|yes|YES) ;;
        *)
            printf "${RED}Aborting install. Re-run without sudo.${NC}\n"
            exit 1
            ;;
    esac
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

log() { printf "${BLUE}%s${NC}\n" "$1"; }
ok() { printf "${GREEN}✓ %s${NC}\n" "$1"; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$1"; }
err() { printf "${RED}✗ %s${NC}\n" "$1"; }

log "Vibecode WebGUI installer"
log "Project root: $PROJECT_ROOT"

check_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        err "Missing dependency: $1"
        printf "Install the dependency and re-run this script.\n"
        exit 1
    fi
    ok "$1 available"
}

log "Checking required tooling..."
check_command node
check_command npm

if command -v docker >/dev/null 2>&1; then
    ok "docker available"
else
    warn "docker not found. Container workflows will be skipped."
fi

NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR=$(printf "%s" "$NODE_VERSION" | cut -d. -f1)
NODE_MINOR=$(printf "%s" "$NODE_VERSION" | cut -d. -f2)

MIN_MAJOR=18
MIN_MINOR=18

if [ "$NODE_MAJOR" -lt "$MIN_MAJOR" ] || { [ "$NODE_MAJOR" -eq "$MIN_MAJOR" ] && [ "$NODE_MINOR" -lt "$MIN_MINOR" ]; }; then
    err "Node.js $NODE_VERSION detected. Require >= ${MIN_MAJOR}.${MIN_MINOR}."
    printf "Update Node.js and retry.\n"
    exit 1
fi
ok "Node.js version ${NODE_VERSION} compatible"

log "Ensuring env files..."
if [ ! -f .env.local ]; then
    if [ -f env.development.example ]; then
        cp env.development.example .env.local
        warn ".env.local created from env.development.example. Review placeholder values."
    else
        warn "env.development.example missing. Skipping env bootstrap."
    fi
else
    ok ".env.local already present"
fi

log "Verifying Prisma schema (optional)..."
if [ -f prisma/schema.prisma ]; then
    ok "Prisma schema detected"
else
    warn "Prisma schema not found; skipping database validation"
fi

if [ "$SKIP_INSTALL" -eq 0 ]; then
    log "Installing npm dependencies..."
    npm install
    ok "npm install complete"
else
    warn "Skipping dependency install (--skip-install)"
fi

if [ "$SKIP_SETUP" -eq 0 ]; then
    if npm run setup >/dev/null 2>&1; then
        ok "npm run setup completed"
    else
        warn "npm run setup exited with non-zero status. Inspect logs above."
    fi
else
    warn "Skipping project setup (--skip-setup)"
fi

log "Running quick health checks..."
if npm run check >/dev/null 2>&1; then
    ok "Lint + type-check passed"
else
    warn "npm run check failed. Review output for details."
fi

log "Install complete. Next steps:"
printf "  1. Update .env.local with real credentials.\n"
printf "  2. Start development server via 'npm run dev'.\n"
printf "  3. Optional: run validation script scripts/vibecode-cli/validate-config.sh\n"

