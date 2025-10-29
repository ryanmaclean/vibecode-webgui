#!/usr/bin/env bash
# Start Node.js Development VM - Full-featured dev environment
# Ports: 3000 (API), 5173 (Vite), 8080 (code-server), 9229 (debugger)
# Memory: 4GB
# Features: Node.js 22 LTS, npm, pnpm, yarn, TypeScript

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec "$SCRIPT_DIR/vm-manager.sh" start nodejs-dev
