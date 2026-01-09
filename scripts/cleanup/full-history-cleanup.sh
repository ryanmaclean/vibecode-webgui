#!/usr/bin/env bash
# Full history cleanup using git-filter-repo
# ⚠️ DESTRUCTIVE OPERATION - Run backup-before-cleanup.sh first!
#
# This script removes large files and secrets from git history.
# After running, you MUST force push and all collaborators must re-clone.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

echo "================================================"
echo "⚠️  GIT HISTORY REWRITE SCRIPT"
echo "================================================"
echo ""
echo "This script will PERMANENTLY rewrite git history to remove:"
echo "  - Large binary files (kernels, cpio, disk images)"
echo "  - Secret/environment files"
echo "  - Build artifacts committed by mistake"
echo ""
echo "Prerequisites:"
echo "  1. Run backup-before-cleanup.sh first"
echo "  2. Install git-filter-repo: brew install git-filter-repo"
echo "  3. Coordinate with all team members"
echo ""

# Check for git-filter-repo
if ! command -v git-filter-repo &> /dev/null; then
    echo "❌ git-filter-repo is not installed."
    echo "   Install with: brew install git-filter-repo"
    exit 1
fi

# Check for clean working directory
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "❌ Working directory is not clean."
    echo "   Please commit or stash changes first."
    exit 1
fi

echo ""
read -p "Have you created a full backup? (yes/no) " -r backup_confirm
if [[ "${backup_confirm}" != "yes" ]]; then
    echo "Please run: ./scripts/cleanup/backup-before-cleanup.sh"
    exit 1
fi

echo ""
echo "Creating paths-to-remove.txt..."

cat > /tmp/vibecode-paths-to-remove.txt << 'PATHS'
# Large binary files
azure/bun-openvscode.cpio.gz
azure/nodejs-complete.cpio.gz
azure/nodejs-complete.cpio.gz.backup-20251202-095734
azure/nodejs-complete.backup
azure/unified-services-static.cpio.gz
azure/unified-services-static.cpio.gz.broken
azure/unified-services-static.cpio.gz.january
azure/linux-kernel-arm64
azure/linux-kernel-arm64.5.15-backup
azure/vmlinux-raw
azure/vmlinuz-arm64
azure/vibecode-services-disk.img.gz

# VM images  
VibeCodeSwift/Resources/vms/vibecode-postgresql.img

# Entire directories with build artifacts
artifacts/
bench-images/
demos/venv311/
release-artifacts/
src-tauri/target/
VibeCode-VMs/.build/
macos-vm/.build/
docs/node_modules/
extensions/vibecode-ai-assistant/node_modules/

# Large vfkit binary
src-tauri/resources/vfkit

# Secret files
.env.docker.fixed
.env.docker
.env.test-db
.env.test-external-db
.env.local.backup
.env.azure
.env.valkey
config/env/.env.docker.fixed
config/env/.env.docker
config/env/.env.test-db
config/env/.env.test-external-db
config/env/.env.local.backup
config/env/.env.azure
config/env/.env.valkey
PATHS

echo ""
echo "Files/directories to be removed from ALL history:"
cat /tmp/vibecode-paths-to-remove.txt | grep -v '^#' | grep -v '^$'

echo ""
echo "================================================"
echo "⚠️  FINAL WARNING"
echo "================================================"
echo ""
echo "This will PERMANENTLY modify git history."
echo "After this operation:"
echo "  1. You must force push: git push --force --all"
echo "  2. All team members must re-clone the repository"
echo "  3. All open PRs will need to be recreated"
echo ""
read -p "Type 'REWRITE HISTORY' to proceed: " -r confirm

if [[ "${confirm}" != "REWRITE HISTORY" ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Starting git-filter-repo..."
echo ""

# Run git-filter-repo
git filter-repo \
    --invert-paths \
    --paths-from-file /tmp/vibecode-paths-to-remove.txt \
    --force

echo ""
echo "================================================"
echo "✅ History rewrite complete!"
echo "================================================"
echo ""
echo "New repository stats:"
git count-objects -vH
echo ""
echo "Next steps:"
echo "  1. Verify the repository works correctly"
echo "  2. Force push all branches:"
echo "     git push --force --all origin"
echo "     git push --force --tags origin"
echo "  3. Notify team to re-clone"
echo ""
echo "To verify no secrets remain:"
echo "  git log --all -p | grep -E 'sk-[a-zA-Z0-9]{20}' | head -10"
echo ""
