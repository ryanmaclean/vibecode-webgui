#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

# Determine repository root (handles execution from subdirectories)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

# Source Datadog logging (optional - doesn't fail if unavailable)
# shellcheck disable=SC1091
source "$REPO_ROOT/scripts/lib/datadog-logging.sh" 2>/dev/null || true

dd_info "Starting npm ci installation" "script:install-ci" 2>/dev/null || true

echo "📦 Running npm ci with repo defaults (legacy peer deps + consistent engine)..."
if npm ci --legacy-peer-deps "$@"; then
    dd_info "npm ci completed successfully" "script:install-ci,status:success" 2>/dev/null || true
else
    dd_error "npm ci failed" "script:install-ci,status:failure" 2>/dev/null || true
    exit 1
fi
