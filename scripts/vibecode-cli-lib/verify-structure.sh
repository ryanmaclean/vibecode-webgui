#!/usr/bin/env bash
# Verify the TUI framework structure

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Verifying VibeCode TUI Framework Structure..."
echo ""

# Check main script
if [[ -x "${SCRIPT_DIR}/../vibecode-tui" ]]; then
    echo "✓ Main script (vibecode-tui) exists and is executable"
else
    echo "✗ Main script (vibecode-tui) missing or not executable"
    exit 1
fi

# Check library files
required_libs=(
    "common.sh"
    "menu-development.sh"
    "menu-testing.sh"
    "menu-deployment.sh"
    "menu-vm.sh"
    "menu-security.sh"
    "menu-database.sh"
    "menu-monitoring.sh"
)

for lib in "${required_libs[@]}"; do
    if [[ -f "${SCRIPT_DIR}/${lib}" ]]; then
        echo "✓ Library: ${lib}"
    else
        echo "✗ Library missing: ${lib}"
        exit 1
    fi
done

# Check for syntax errors
echo ""
echo "Checking for syntax errors..."

for script in "${SCRIPT_DIR}"/*.sh; do
    if bash -n "${script}" 2>/dev/null; then
        echo "✓ Syntax OK: $(basename ${script})"
    else
        echo "✗ Syntax error in: $(basename ${script})"
        exit 1
    fi
done

# Verify main script syntax
if bash -n "${SCRIPT_DIR}/../vibecode-tui" 2>/dev/null; then
    echo "✓ Syntax OK: vibecode-tui"
else
    echo "✗ Syntax error in: vibecode-tui"
    exit 1
fi

# Check log directory
VIBECODE_LOGS="${SCRIPT_DIR}/../../logs"
if [[ -d "${VIBECODE_LOGS}" ]]; then
    echo "✓ Log directory exists: ${VIBECODE_LOGS}"
else
    echo "✓ Log directory will be created on first run"
fi

echo ""
echo "✓ All checks passed! TUI framework is ready."
echo ""
echo "To launch the TUI, run:"
echo "  ${SCRIPT_DIR}/../vibecode-tui"
