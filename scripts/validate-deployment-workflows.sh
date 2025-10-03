#!/bin/bash
# Deployment Workflows Validation Script
# Validates deployment workflow configurations and prerequisites

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Deployment Workflows Validation ==="
echo ""

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} Found: $1"
        return 0
    else
        echo -e "${RED}✗${NC} Missing: $1"
        return 1
    fi
}

# Function to check directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} Found: $1"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Missing: $1 (optional)"
        return 1
    fi
}

echo "1. Checking deployment workflow files..."
check_file ".github/workflows/deploy-docs.yml"
check_file ".github/workflows/deploy-next-docs.yml"
check_file ".github/workflows/db-monitoring-deployment.yml"
echo ""

echo "2. Checking Docker files..."
check_file "docker/Dockerfile.docs-next"
echo ""

echo "3. Checking documentation structure..."
check_dir "docs"
check_file "docs/package.json"
check_dir "content/wiki"
echo ""

echo "4. Checking monitoring structure..."
check_dir "monitoring/dashboards"
check_dir "monitoring/alerts"
echo ""

echo "5. Checking required scripts..."
check_file "scripts/benchmark-vector-search.js"
check_file "scripts/setup-datadog-dbm.ts"
missing_scripts=()
if ! check_file "scripts/update-datadog-baselines.js"; then
    missing_scripts+=("update-datadog-baselines.js")
fi
if ! check_file "scripts/verify-datadog-integration.js"; then
    missing_scripts+=("verify-datadog-integration.js")
fi
echo ""

echo "6. Validating package.json scripts..."
if command -v jq &> /dev/null; then
    if jq -e '.scripts.build' package.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} build script exists"
    else
        echo -e "${RED}✗${NC} build script missing"
    fi
else
    echo -e "${YELLOW}⚠${NC} jq not installed, skipping package.json validation"
fi
echo ""

echo "7. Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js version: $NODE_VERSION"
    REQUIRED_MAJOR=20
    CURRENT_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$CURRENT_MAJOR" -ge "$REQUIRED_MAJOR" ]; then
        echo -e "${GREEN}✓${NC} Node.js version meets requirements (>= v20)"
    else
        echo -e "${YELLOW}⚠${NC} Node.js version below v20 (workflows use v20/v22)"
    fi
else
    echo -e "${RED}✗${NC} Node.js not installed"
fi
echo ""

echo "=== Summary ==="
if [ ${#missing_scripts[@]} -gt 0 ]; then
    echo -e "${YELLOW}Missing optional scripts:${NC}"
    for script in "${missing_scripts[@]}"; do
        echo "  - scripts/$script"
    done
    echo ""
    echo "These scripts have fallbacks in the workflows and are not critical."
fi

echo ""
echo -e "${GREEN}Validation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Ensure required GitHub secrets are configured"
echo "2. Test workflows in a non-production environment"
echo "3. Monitor first production deployment"
echo ""
echo "For detailed fixes, see: claudedocs/deployment-workflows-fixes.md"
