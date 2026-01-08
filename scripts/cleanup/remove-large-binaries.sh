#!/usr/bin/env bash
# Remove large binary files from git tracking
# Run this AFTER backing up the repository

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

echo "================================================"
echo "Removing large binary files from git index"
echo "================================================"
echo ""

# Large binary files that should not be tracked
BINARY_PATTERNS=(
    "azure/*.cpio.gz"
    "azure/*.cpio.gz.*"
    "azure/*.img"
    "azure/*.img.gz"
    "azure/vmlinuz*"
    "azure/vmlinux*"
    "azure/linux-kernel*"
    "azure/bun-openvscode*"
    "azure/nodejs-complete*"
    "bench-images/"
    "artifacts/"
    "release-artifacts/"
    "demos/venv311/"
    "*.tar.gz"
    "vibecode-vm-*.tar.gz"
)

echo "Scanning for large tracked files..."
echo ""

# Find and display large tracked files
echo "Currently tracked large files (>1MB):"
git ls-files | while read -r file; do
    if [ -f "${file}" ]; then
        size=$(du -k "${file}" 2>/dev/null | cut -f1)
        if [ "${size:-0}" -gt 1024 ]; then
            printf "  %6s KB  %s\n" "${size}" "${file}"
        fi
    fi
done | sort -rn | head -30

echo ""
echo "Files matching binary patterns to untrack:"

for pattern in "${BINARY_PATTERNS[@]}"; do
    matches=$(git ls-files "${pattern}" 2>/dev/null || true)
    if [ -n "${matches}" ]; then
        echo "${matches}" | while read -r file; do
            if [ -n "${file}" ]; then
                echo "  - ${file}"
            fi
        done
    fi
done

echo ""
read -p "Proceed with untracking these files? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    for pattern in "${BINARY_PATTERNS[@]}"; do
        matches=$(git ls-files "${pattern}" 2>/dev/null || true)
        if [ -n "${matches}" ]; then
            echo "${matches}" | while read -r file; do
                if [ -n "${file}" ] && git ls-files --error-unmatch "${file}" >/dev/null 2>&1; then
                    echo "Untracking: ${file}"
                    git rm --cached "${file}" 2>/dev/null || true
                fi
            done
        fi
    done
    
    echo ""
    echo "✅ Binary files untracked."
    echo ""
    echo "Now commit this change:"
    echo "   git commit -m 'chore: remove large binary files from tracking'"
    echo ""
    echo "⚠️  These files still exist in git history!"
    echo "   For complete removal and size reduction, use:"
    echo "   git filter-repo --invert-paths --path <file>"
else
    echo "Aborted."
fi
