#!/usr/bin/env bash
# Backup script for vibecode-webgui before major cleanup
# Run this BEFORE any destructive operations

set -euo pipefail

BACKUP_DIR="${HOME}/vibecode-backup-$(date +%Y%m%d-%H%M%S)"
REPO_ROOT="$(git rev-parse --show-toplevel)"

echo "================================================"
echo "VibCode Repository Backup Script"
echo "================================================"
echo "Backup directory: ${BACKUP_DIR}"
echo "Repository root: ${REPO_ROOT}"
echo ""

mkdir -p "${BACKUP_DIR}"
cd "${REPO_ROOT}"

echo "1. Creating git bundle with ALL branches and tags..."
git bundle create "${BACKUP_DIR}/vibecode-complete.bundle" --all
echo "   ✅ Bundle created: ${BACKUP_DIR}/vibecode-complete.bundle"

echo ""
echo "2. Exporting branch list..."
git branch -a > "${BACKUP_DIR}/all-branches.txt"
echo "   ✅ Branches saved: ${BACKUP_DIR}/all-branches.txt"

echo ""
echo "3. Exporting worktree list..."
git worktree list > "${BACKUP_DIR}/worktrees.txt"
echo "   ✅ Worktrees saved: ${BACKUP_DIR}/worktrees.txt"

echo ""
echo "4. Creating archives of important branches..."

# Core branches
IMPORTANT_BRANCHES=(
    "main"
    "fix/boot-time-testing"
    "fix/documentation"
    "fix/vm-stability"
    "agent-fix-openvscode-binary"
    "agent-fix-postgresql"
    "agent-fix-valkey"
    "agent-h-testing"
    "feat/unified-launcher-openvscode-vm"
    "feature/workspace-rag-mlx-ddtrace"
)

mkdir -p "${BACKUP_DIR}/branch-archives"

for branch in "${IMPORTANT_BRANCHES[@]}"; do
    safe_name="${branch//\//-}"
    if git rev-parse --verify "${branch}" >/dev/null 2>&1; then
        echo "   Archiving: ${branch}..."
        git archive --format=tar.gz --prefix="${safe_name}/" "${branch}" > "${BACKUP_DIR}/branch-archives/${safe_name}.tar.gz" 2>/dev/null || echo "   ⚠️  Skipped (not found locally): ${branch}"
    else
        echo "   ⚠️  Skipped (not found): ${branch}"
    fi
done

echo ""
echo "5. Backing up important config files..."
mkdir -p "${BACKUP_DIR}/config-backup"

# Copy important configs that might have local changes
cp -f .gitignore "${BACKUP_DIR}/config-backup/" 2>/dev/null || true
cp -f package.json "${BACKUP_DIR}/config-backup/" 2>/dev/null || true
cp -f tsconfig.json "${BACKUP_DIR}/config-backup/" 2>/dev/null || true
cp -f next.config.* "${BACKUP_DIR}/config-backup/" 2>/dev/null || true

echo "   ✅ Config files backed up"

echo ""
echo "6. Recording repository state..."
cat > "${BACKUP_DIR}/repo-state.txt" << EOF
Backup created: $(date)
Repository: ${REPO_ROOT}
Current HEAD: $(git rev-parse HEAD)
Current branch: $(git branch --show-current 2>/dev/null || echo "(detached)")

Git object count:
$(git count-objects -vH)

Disk usage:
$(du -sh .)

Recent commits (last 20):
$(git log --oneline -20)
EOF

echo "   ✅ Repository state recorded"

echo ""
echo "================================================"
echo "BACKUP COMPLETE!"
echo "================================================"
echo ""
echo "Backup location: ${BACKUP_DIR}"
echo ""
echo "Contents:"
ls -lah "${BACKUP_DIR}"
echo ""
echo "To restore from bundle:"
echo "  git clone ${BACKUP_DIR}/vibecode-complete.bundle restored-repo"
echo ""
echo "To verify bundle:"
echo "  git bundle verify ${BACKUP_DIR}/vibecode-complete.bundle"
echo ""
