#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

# Determine repository root (handles execution from subdirectories)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$REPO_ROOT"

echo "📦 Running npm ci with repo defaults (legacy peer deps + consistent engine)..."
npm ci --legacy-peer-deps "$@"
