#!/bin/sh
# Vibecode WebGUI - Cleanup helper
# Removes local build artifacts and optionally environment files.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DRY_RUN=0
KEEP_ENV=0
KEEP_NODE_MODULES=0

usage() {
    cat <<'USAGE'
Usage: scripts/vibecode-cli/uninstall.sh [options]

Cleans local Vibecode WebGUI artifacts. Designed for developer workstations —
does not affect remote deployments.

Options:
    --dry-run            Show actions without removing files
    --keep-env           Preserve .env.* files
    --keep-node-modules  Preserve node_modules
    -h, --help           Display this help text

Examples:
    scripts/vibecode-cli/uninstall.sh
    scripts/vibecode-cli/uninstall.sh --dry-run
USAGE
}

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=1
            ;;
        --keep-env)
            KEEP_ENV=1
            ;;
        --keep-node-modules)
            KEEP_NODE_MODULES=1
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

if [ "$(id -u)" -eq 0 ]; then
    printf "${YELLOW}⚠ This script should run without sudo. Aborting.${NC}\n" >&2
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

log_rm() {
    if [ "$DRY_RUN" -eq 1 ]; then
        printf "${YELLOW}DRY RUN${NC} would remove %s\n" "$1"
    else
        if [ -e "$1" ]; then
            if [ -d "$1" ]; then
                rm -rf "$1"
            else
                rm -f "$1"
            fi
            printf "${GREEN}Removed%s${NC}\n" " $1"
        fi
    fi
}

printf "${GREEN}Vibecode cleanup utility${NC}\n"
printf "Project: %s\n\n" "$PROJECT_ROOT"

TARGETS=".next dist .turbo playwright-report coverage .cache reports tmp-codeium-example"

for path in $TARGETS; do
    log_rm "$path"
done

if [ "$KEEP_NODE_MODULES" -eq 0 ]; then
    log_rm "node_modules"
else
    printf "${YELLOW}Preserving node_modules (--keep-node-modules)${NC}\n"
fi

printf "\n"

ENV_FILES=".env.local .env.development .env.test"
if [ "$KEEP_ENV" -eq 0 ]; then
    for file in $ENV_FILES; do
        log_rm "$file"
    done
else
    printf "${YELLOW}Preserving environment files (--keep-env)${NC}\n"
fi

printf "\n${GREEN}Cleanup complete.${NC}\n"
if [ "$DRY_RUN" -eq 1 ]; then
    printf "No files were deleted (dry-run mode).\n"
fi

