#!/usr/bin/env bash
set -euo pipefail

# Installs the optional pre-push TruffleHog hook without enabling it by default.
# To enable, run: touch .git/hooks/enable-security-scan

HOOK_SRC="scripts/git-hooks/pre-push"
HOOK_DST=".git/hooks/pre-push"

if [[ ! -d .git ]]; then
  echo "This does not appear to be a git repository (.git missing)."
  exit 1
fi

mkdir -p .git/hooks
cp -f "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"

echo "Installed pre-push hook at $HOOK_DST"
echo "This hook is DISABLED by default. Enable with: touch .git/hooks/enable-security-scan"
