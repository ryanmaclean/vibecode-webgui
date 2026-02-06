#!/bin/bash
set -e

# Proxy to Go CLI usage-insights command
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/datadog-monitoring.sh" 2>/dev/null || true
source "$SCRIPT_DIR/lib/go-cli.sh" 2>/dev/null || true
init_monitoring "$(basename "$0")"
trap 'finalize_monitoring $?' EXIT INT TERM

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    cat << 'EOF'
Usage Insights (Go CLI proxy)

Usage:
  usage-insights.sh [options]

This script proxies to the Go CLI command:
  dd usage-insights

Set DD_SKILL_GO_CLI to override the Go CLI path.
EOF
    resolve_go_cli "$SCRIPT_DIR" >/dev/null 2>&1 && "$(resolve_go_cli "$SCRIPT_DIR")" usage-insights --help || true
    exit 0
fi

run_go_cli "$SCRIPT_DIR" "usage-insights" "$@"
