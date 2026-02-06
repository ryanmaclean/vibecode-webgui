#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Verification script for Docker Go installation fix
# Issue: #506 - Docker build pipeline broken

# Initialize log aggregation
init_log_aggregation


set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "============================================"
echo "Docker Go Installation Fix Verification"
echo "Issue: #506"
echo "Date: $(date +%Y-%m-%d)"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Docker availability
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon not running. Please start Docker.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker daemon is running${NC}"
echo ""

# Check for buildx support
if docker buildx version &> /dev/null; then
    echo -e "${GREEN}✅ Docker Buildx available (multi-arch support)${NC}"
    HAS_BUILDX=true
else
    echo -e "${YELLOW}⚠️  Docker Buildx not available (single arch only)${NC}"
    HAS_BUILDX=false
fi
echo ""

# Function to test build
test_build() {
    local dockerfile=$1
    local profile=$2
    local platform=$3
    local tag=$4

    echo "Testing: $dockerfile (profile: $profile, platform: $platform)"
    echo "-------------------------------------------"

    if docker build \
        --platform "$platform" \
        -f "$PROJECT_ROOT/$dockerfile" \
        --build-arg PROFILE="$profile" \
        --build-arg GO_VERSION=1.22.4 \
        -t "$tag" \
        "$PROJECT_ROOT" 2>&1 | grep -E "(Step|Successfully|go version)"; then

        echo -e "${GREEN}✅ Build successful: $dockerfile${NC}"

        # Verify Go installation
        if docker run --rm "$tag" go version 2>&1 | grep -q "go version go1.22.4"; then
            echo -e "${GREEN}✅ Go verification passed${NC}"
        else
            echo -e "${RED}❌ Go verification failed${NC}"
            return 1
        fi

        # Verify goose tool
        if docker run --rm "$tag" goose -version 2>&1 | grep -qi "goose"; then
            echo -e "${GREEN}✅ Goose verification passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Goose verification failed (may be optional)${NC}"
        fi

        echo ""
        return 0
    else
        echo -e "${RED}❌ Build failed: $dockerfile${NC}"
        echo ""
        return 1
    fi
}

# Main build tests
BUILD_SUCCESS=0
BUILD_FAIL=0

echo "============================================"
echo "Starting Build Tests"
echo "============================================"
echo ""

# Test 1: Main Dockerfile with minimal profile
echo "Test 1: Main Dockerfile (minimal profile, amd64)"
if test_build "docker/code-server/Dockerfile" "minimal" "linux/amd64" "vibecode-test:main-minimal"; then
    ((BUILD_SUCCESS++))
else
    ((BUILD_FAIL++))
fi

# Test 2: Optimized Dockerfile with standard profile
echo "Test 2: Optimized Dockerfile (standard profile, amd64)"
if test_build "docker/code-server/Dockerfile.optimized" "standard" "linux/amd64" "vibecode-test:optimized-standard"; then
    ((BUILD_SUCCESS++))
else
    ((BUILD_FAIL++))
fi

# Test 3: Original Dockerfile with minimal profile
echo "Test 3: Original Dockerfile (minimal profile, amd64)"
if test_build "docker/code-server/Dockerfile.original" "minimal" "linux/amd64" "vibecode-test:original-minimal"; then
    ((BUILD_SUCCESS++))
else
    ((BUILD_FAIL++))
fi

# Test 4: Multi-arch build (if buildx available)
if [ "$HAS_BUILDX" = true ]; then
    echo "Test 4: Multi-arch build (amd64 + arm64)"
    echo "-------------------------------------------"

    if docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -f "$PROJECT_ROOT/docker/code-server/Dockerfile" \
        --build-arg PROFILE=minimal \
        --build-arg GO_VERSION=1.22.4 \
        -t vibecode-test:multiarch \
        "$PROJECT_ROOT" 2>&1 | grep -E "(Step|Successfully|go version)"; then

        echo -e "${GREEN}✅ Multi-arch build successful${NC}"
        ((BUILD_SUCCESS++))
    else
        echo -e "${RED}❌ Multi-arch build failed${NC}"
        ((BUILD_FAIL++))
    fi
    echo ""
fi

# Summary
echo "============================================"
echo "Verification Summary"
echo "============================================"
echo ""
echo "Tests passed: $BUILD_SUCCESS"
echo "Tests failed: $BUILD_FAIL"
echo ""

if [ $BUILD_FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! Docker Go installation is fixed.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test additional profiles (ai, web, full)"
    echo "2. Run in CI/CD pipeline"
    echo "3. Update issue #506 as resolved"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check Docker daemon is running properly"
    echo "2. Ensure adequate disk space"
    echo "3. Review Dockerfile syntax"
    echo "4. Check network connectivity"
    echo ""
    exit 1
fi
