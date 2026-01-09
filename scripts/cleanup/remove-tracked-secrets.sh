#!/usr/bin/env bash
# Remove tracked secret files from git index (not from working directory)
# Run this AFTER backing up the repository

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

echo "================================================"
echo "Removing tracked secret files from git index"
echo "================================================"
echo ""
echo "⚠️  This will untrack files but NOT delete them from disk."
echo "    The files will remain in your working directory."
echo ""

# Files with secrets that should not be tracked
SECRET_FILES=(
    ".env.docker.fixed"
    ".env.docker"
    ".env.test-db"
    ".env.test-external-db"
    ".env.local.backup"
    ".env.azure"
    ".env.valkey"
    "config/env/.env.docker.fixed"
    "config/env/.env.docker"
    "config/env/.env.test-db"
    "config/env/.env.test-external-db"
    "config/env/.env.local.backup"
    "config/env/.env.azure"
    "config/env/.env.valkey"
)

echo "Files to untrack:"
for file in "${SECRET_FILES[@]}"; do
    if git ls-files --error-unmatch "${file}" >/dev/null 2>&1; then
        echo "  - ${file} (tracked)"
    else
        echo "  - ${file} (not tracked, skipping)"
    fi
done

echo ""
read -p "Proceed with untracking? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    for file in "${SECRET_FILES[@]}"; do
        if git ls-files --error-unmatch "${file}" >/dev/null 2>&1; then
            echo "Untracking: ${file}"
            git rm --cached "${file}" 2>/dev/null || true
        fi
    done
    
    echo ""
    echo "✅ Files untracked. Now commit this change:"
    echo "   git commit -m 'chore: remove tracked secret files'"
    echo ""
    echo "⚠️  Remember: secrets are still in git history!"
    echo "   For complete removal, use git-filter-repo"
else
    echo "Aborted."
fi
