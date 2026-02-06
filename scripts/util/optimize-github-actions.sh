#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# GitHub Actions Cost Optimization Script
# Disables expensive workflows and implements release branch strategy

# Initialize log aggregation
init_log_aggregation


echo "🚀 Optimizing GitHub Actions for cost control..."

# Create backup directory
mkdir -p .github/workflows/disabled-expensive

# List of expensive workflows to disable
EXPENSIVE_WORKFLOWS=(
    "ci-complex.yml"
    "ci-enhancements.yml" 
    "ci-cd.yml"
    "ci.yml"
    "docker-multiarch.yml"
    "k8s-deploy.yml"
    "kind-testing.yml"
    "performance-gates.yml"
    "production-deployment.yml"
    "synthetic-test.yml"
    "working-ci.yml"
)

echo "📦 Moving expensive workflows to disabled directory..."
for workflow in "${EXPENSIVE_WORKFLOWS[@]}"; do
    if [ -f ".github/workflows/$workflow" ]; then
        echo "  Moving $workflow"
        mv ".github/workflows/$workflow" ".github/workflows/disabled-expensive/"
    fi
done

# Keep essential lightweight workflows
KEEP_WORKFLOWS=(
    "deploy-docs.yml"
    "secret-scanning.yml" 
    "dependabot.yml"
    "main-branch-ci.yml"
    "release-branch-ci.yml"
)

echo "✅ Keeping essential workflows:"
for workflow in "${KEEP_WORKFLOWS[@]}"; do
    if [ -f ".github/workflows/$workflow" ]; then
        echo "  ✓ $workflow"
    fi
done

# Create cost monitoring workflow
cat > .github/workflows/cost-monitor.yml << 'EOF'
name: GitHub Actions Cost Monitor

on:
  schedule:
    - cron: '0 9 * * MON'  # Weekly on Monday
  workflow_dispatch:

jobs:
  cost-report:
    runs-on: ubuntu-latest
    steps:
      - name: Weekly cost reminder
        run: |
          echo "📊 GitHub Actions Cost Optimization Active"
          echo "Current strategy:"
          echo "  ✅ Main branch: Lightweight CI only (~$0.05 per run)"
          echo "  🚀 Release branches: Full CI/CD (~$2-4 per run)"
          echo ""
          echo "💡 To run full tests:"
          echo "  1. Create branch: git checkout -b release/v1.x.x"
          echo "  2. Push: git push origin release/v1.x.x"
          echo "  3. Full CI/CD will run automatically"
          echo ""
          echo "Expected monthly savings: ~70-80% ($100 → $20-30)"
EOF

# Create release branch helper script
cat > create-release-branch.sh << 'EOF'
#!/bin/bash

# Helper script to create release branches for full CI/CD testing

if [ -z "$1" ]; then
    echo "Usage: ./create-release-branch.sh <version>"
    echo "Example: ./create-release-branch.sh v1.2.0"
    exit 1
fi

VERSION=$1
BRANCH_NAME="release/$VERSION"

echo "🚀 Creating release branch: $BRANCH_NAME"

# Create and switch to release branch
git checkout -b "$BRANCH_NAME"

# Push to trigger full CI/CD
git push -u origin "$BRANCH_NAME"

echo "✅ Release branch created and pushed"
echo "🔄 Full CI/CD pipeline will run automatically"
echo "📊 Monitor progress at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
EOF

chmod +x create-release-branch.sh

# Update README with new workflow
if [ -f "README.md" ]; then
    echo "" >> README.md
    echo "## 🚀 GitHub Actions Cost Optimization" >> README.md
    echo "" >> README.md
    echo "To control costs, we use a two-tier CI/CD strategy:" >> README.md
    echo "" >> README.md
    echo "### Main Branch (Lightweight)" >> README.md
    echo "- Fast linting and basic unit tests only" >> README.md
    echo "- ~$0.05 per run" >> README.md
    echo "" >> README.md
    echo "### Release Branches (Comprehensive)" >> README.md
    echo "- Full test suite (unit, integration, E2E)" >> README.md
    echo "- Security scans and performance testing" >> README.md
    echo "- Production deployment pipelines" >> README.md
    echo "- ~$2-4 per run" >> README.md
    echo "" >> README.md
    echo "### Creating Release Branches" >> README.md
    echo '```bash' >> README.md
    echo "# Create release branch for full testing" >> README.md
    echo "./create-release-branch.sh v1.2.0" >> README.md
    echo '```' >> README.md
fi

echo ""
echo "✅ GitHub Actions optimization complete!"
echo ""
echo "📊 Cost Impact:"
echo "  Before: ~$100/month (full CI on every commit)"
echo "  After:  ~$20-30/month (70-80% reduction)"
echo ""
echo "🚀 How to use:"
echo "  Main branch: Automatic lightweight CI"
echo "  Full testing: ./create-release-branch.sh v1.x.x"
echo ""
echo "📁 Disabled workflows moved to: .github/workflows/disabled-expensive/"
echo "🔄 Active workflows: main-branch-ci.yml, release-branch-ci.yml"
