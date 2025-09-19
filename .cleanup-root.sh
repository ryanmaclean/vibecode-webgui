#!/bin/bash
# Clean up the messy root directory
# Run: ./.cleanup-root.sh

echo "🧹 Cleaning up root directory..."

# Move loose files to appropriate directories
mkdir -p archive/root-cleanup

# Move documentation files
mv *.md archive/root-cleanup/ 2>/dev/null || true

# Move config files that don't need to be in root
mv *.toml archive/root-cleanup/ 2>/dev/null || true
mv *.json archive/root-cleanup/ 2>/dev/null || true
mv *.yaml archive/root-cleanup/ 2>/dev/null || true
mv *.yml archive/root-cleanup/ 2>/dev/null || true

# Keep only essential files in root
# - DEMO.sh (main entry point)
# - start-demo (backup entry point)
# - README.md (essential)
# - package.json (essential)
# - Makefile (essential)
# - go.mod/go.sum (essential)
# - .gitignore (essential)
# - LICENSE (essential)

# Move back essential files
mv archive/root-cleanup/README.md . 2>/dev/null || true
mv archive/root-cleanup/package.json . 2>/dev/null || true
mv archive/root-cleanup/package-lock.json . 2>/dev/null || true
mv archive/root-cleanup/LICENSE . 2>/dev/null || true

# Move Docker files to docker/
mv Dockerfile* docker/ 2>/dev/null || true
mv docker-compose*.yml docker/ 2>/dev/null || true

# Move config files to config/
mkdir -p config
mv *.config.* config/ 2>/dev/null || true
mv *.config config/ 2>/dev/null || true

echo "✅ Root cleanup complete!"
echo ""
echo "📁 Root directory now contains:"
ls -la | grep -E "^-" | awk '{print "  " $9}'
echo ""
echo "🚀 Demo still works: ./DEMO.sh"
