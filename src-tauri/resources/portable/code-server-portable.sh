#!/bin/bash

# VibeCode Portable Code Server Launcher
# This script provides a portable way to run code-server without external dependencies

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$SCRIPT_DIR/node"
CODE_SERVER_DIR="$SCRIPT_DIR/code-server"

# Check if we have bundled Node.js
if [ -f "$NODE_BIN" ]; then
    NODE_CMD="$NODE_BIN"
    echo "Using bundled Node.js runtime"
else
    # Fallback to system Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_CMD="node"
        echo "Using system Node.js runtime"
    else
        echo "Error: Node.js not found. Please install Node.js or ensure the bundled version is available."
        exit 1
    fi
fi

# Check if we have bundled code-server
if [ -f "$CODE_SERVER_DIR/out/node/entry.js" ]; then
    echo "Using bundled code-server"
    CODE_SERVER_ENTRY="$CODE_SERVER_DIR/out/node/entry.js"
else
    echo "Error: Bundled code-server not found"
    exit 1
fi

# Default arguments for code-server
DEFAULT_ARGS=(
    "--bind-addr" "0.0.0.0:8080"
    "--auth" "none"
    "--disable-telemetry"
    "--disable-update-check"
    "--disable-workspace-trust"
    "--disable-getting-started-override"
    "--user-data-dir" "$SCRIPT_DIR/user-data"
    "--extensions-dir" "$SCRIPT_DIR/extensions"
)

# Merge with command line arguments
ARGS=("${DEFAULT_ARGS[@]}" "$@")

# Set working directory to current directory
WORK_DIR="${PWD:-$(pwd)}"

echo "Starting VibeCode Portable Code Server..."
echo "Node.js: $NODE_CMD"
echo "Code-server: $CODE_SERVER_ENTRY"
echo "Working directory: $WORK_DIR"
echo "Arguments: ${ARGS[*]}"

# Set Datadog tracing environment variables
export DD_TRACE_ENABLED=true
export DD_TRACE_AGENT_URL=http://localhost:8126
export DD_DOGSTATSD_URL=localhost:8125
export DD_SERVICE=vibecode-portable-codeserver
export DD_ENV=development
export DD_VERSION=1.0.0
export DD_TRACE_SAMPLE_RATE=1.0
export DD_TRACE_ANALYTICS_ENABLED=true
export DD_TRACE_DEBUG=true
export DD_TRACE_STARTUP_LOGS=true
export DD_RUNTIME_METRICS_ENABLED=true
export DD_LOGS_ENABLED=true
export DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true

# Spawn code-server
exec "$NODE_CMD" "$CODE_SERVER_ENTRY" "${ARGS[@]}"
