#!/bin/bash
set -e

# Code-Server Extension Version Verification Script
# Verifies that Cline 3.32.6 and Continue 1.3.15 are installed correctly

# Configuration
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/ryanmaclean/vibecode-codeserver:latest}"
EXPECTED_CLINE_VERSION="3.32.6"
EXPECTED_CONTINUE_VERSION="1.3.15"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'  # Used for warning messages
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

echo -e "${BLUE}🔍 Code-Server Extension Verification${NC}"
echo "========================================"
echo "Image: $IMAGE_NAME"
echo "Expected Cline: $EXPECTED_CLINE_VERSION"
echo "Expected Continue: $EXPECTED_CONTINUE_VERSION"
echo ""

# Function to print test result
print_result() {
    local test_name="$1"
    local result="$2"
    local message="$3"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name: $message"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name: $message"
        ((FAILED++))
    fi
}

# Test 1: Image exists and is pullable
echo -e "${BLUE}Test 1: Pulling image${NC}"
if docker pull "$IMAGE_NAME" > /dev/null 2>&1; then
    print_result "Image Pull" "PASS" "Successfully pulled $IMAGE_NAME"
else
    print_result "Image Pull" "FAIL" "Failed to pull $IMAGE_NAME"
    exit 1
fi
echo ""

# Test 2: List all extensions
echo -e "${BLUE}Test 2: Listing installed extensions${NC}"
EXTENSIONS=$(docker run --rm "$IMAGE_NAME" code-server --list-extensions --show-versions 2>/dev/null || echo "")
if [ -n "$EXTENSIONS" ]; then
    print_result "Extension List" "PASS" "Successfully retrieved extension list"
    echo "Extensions found:"
    echo "$EXTENSIONS" | grep -E "saoudrizwan|continue" || echo "  No Cline or Continue extensions found"
else
    print_result "Extension List" "FAIL" "Failed to retrieve extension list"
fi
echo ""

# Test 3: Verify Cline version
echo -e "${BLUE}Test 3: Verifying Cline version${NC}"
CLINE_VERSION=$(echo "$EXTENSIONS" | grep "saoudrizwan.claude-dev" | sed 's/.*@//' || echo "")
if [ "$CLINE_VERSION" = "$EXPECTED_CLINE_VERSION" ]; then
    print_result "Cline Version" "PASS" "Version $CLINE_VERSION matches expected $EXPECTED_CLINE_VERSION"
elif [ -z "$CLINE_VERSION" ]; then
    print_result "Cline Version" "FAIL" "Cline extension not found"
else
    print_result "Cline Version" "FAIL" "Version $CLINE_VERSION does not match expected $EXPECTED_CLINE_VERSION"
fi
echo ""

# Test 4: Verify Continue version
echo -e "${BLUE}Test 4: Verifying Continue version${NC}"
CONTINUE_VERSION=$(echo "$EXTENSIONS" | grep "continue.continue" | sed 's/.*@//' || echo "")
if [ "$CONTINUE_VERSION" = "$EXPECTED_CONTINUE_VERSION" ]; then
    print_result "Continue Version" "PASS" "Version $CONTINUE_VERSION matches expected $EXPECTED_CONTINUE_VERSION"
elif [ -z "$CONTINUE_VERSION" ]; then
    print_result "Continue Version" "FAIL" "Continue extension not found"
else
    print_result "Continue Version" "FAIL" "Version $CONTINUE_VERSION does not match expected $EXPECTED_CONTINUE_VERSION"
fi
echo ""

# Test 5: Verify AMD64 architecture
echo -e "${BLUE}Test 5: Verifying AMD64 architecture${NC}"
AMD64_EXTENSIONS=$(docker run --rm --platform linux/amd64 "$IMAGE_NAME" code-server --list-extensions 2>/dev/null | grep -E "saoudrizwan|continue" || echo "")
if echo "$AMD64_EXTENSIONS" | grep -q "saoudrizwan.claude-dev" && echo "$AMD64_EXTENSIONS" | grep -q "continue.continue"; then
    print_result "AMD64 Extensions" "PASS" "Both extensions found on AMD64 platform"
else
    print_result "AMD64 Extensions" "FAIL" "Extensions not found on AMD64 platform"
fi
echo ""

# Test 6: Verify ARM64 architecture
echo -e "${BLUE}Test 6: Verifying ARM64 architecture${NC}"
ARM64_EXTENSIONS=$(docker run --rm --platform linux/arm64 "$IMAGE_NAME" code-server --list-extensions 2>/dev/null | grep -E "saoudrizwan|continue" || echo "")
if echo "$ARM64_EXTENSIONS" | grep -q "saoudrizwan.claude-dev" && echo "$ARM64_EXTENSIONS" | grep -q "continue.continue"; then
    print_result "ARM64 Extensions" "PASS" "Both extensions found on ARM64 platform"
else
    print_result "ARM64 Extensions" "FAIL" "Extensions not found on ARM64 platform"
fi
echo ""

# Test 7: Container startup test
echo -e "${BLUE}Test 7: Container startup test${NC}"
CONTAINER_ID=$(docker run -d --rm "$IMAGE_NAME" 2>/dev/null || echo "")
if [ -n "$CONTAINER_ID" ]; then
    sleep 3
    if docker ps | grep -q "$CONTAINER_ID"; then
        print_result "Container Startup" "PASS" "Container started successfully"
        docker stop "$CONTAINER_ID" > /dev/null 2>&1 || true
    else
        print_result "Container Startup" "FAIL" "Container failed to stay running"
    fi
else
    print_result "Container Startup" "FAIL" "Failed to start container"
fi
echo ""

# Summary
echo "========================================"
echo -e "${BLUE}Summary${NC}"
echo "========================================"
echo -e "Tests Passed: ${GREEN}$PASSED${NC}"
echo -e "Tests Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Extension verification complete:"
    echo "  ✓ Cline $EXPECTED_CLINE_VERSION installed"
    echo "  ✓ Continue $EXPECTED_CONTINUE_VERSION installed"
    echo "  ✓ Multi-arch support verified (AMD64 + ARM64)"
    echo "  ✓ Container starts successfully"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Please check the following:"
    echo "  - Verify build completed successfully"
    echo "  - Check extension installation logs"
    echo "  - Ensure image was pushed to registry"
    echo "  - Review GitHub Actions workflow logs"
    exit 1
fi
