#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'EOF'
Usage: run-roundtable.sh [--agents codex,cursor,gemini] [--working-dir PATH]

Runs the roundtable-ai CLI availability check (via uvx) with the desired subagents.
Availability results are written to ~/.roundtable/availability_check.json.

Examples:
  ./scripts/roundtable/run-roundtable.sh
  ./scripts/roundtable/run-roundtable.sh --agents codex
EOF
}

agents_arg="codex,cursor,gemini"
working_dir="${CLI_MCP_WORKING_DIR:-$HOME/vibecode-webgui}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agents)
      agents_arg="${2:-}"
      shift 2
      ;;
    --working-dir)
      working_dir="${2:-}"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_usage
      exit 1
      ;;
  esac
done

if ! command -v uvx >/dev/null 2>&1; then
  echo "Error: uvx is required but not found in PATH." >&2
  exit 1
fi

python_cmd="${PYTHON_CMD:-python3.13}"

echo "🔁 Running roundtable-ai availability check..."
echo "   Working dir: ${working_dir}"
echo "   Agents: ${agents_arg}"

CLI_MCP_WORKING_DIR="${working_dir}" \
CLI_MCP_SUBAGENTS="${agents_arg}" \
uvx --python "${python_cmd}" roundtable-ai@latest --check

results_path="${HOME}/.roundtable/availability_check.json"
if [[ -f "${results_path}" ]]; then
  echo "✅ Availability written to ${results_path}"
else
  echo "⚠️ Expected availability file not found at ${results_path}" >&2
  exit 1
fi
