#!/bin/bash
# Dockerfile validation script (without requiring Docker)
# Usage: bash validate-dockerfile.sh

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=================================================="
echo "Dockerfile Validation (Static Analysis)"
echo "=================================================="
echo ""

DOCKERFILE="Dockerfile"
ISSUES=0

check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        ISSUES=$((ISSUES + 1))
    fi
}

check_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo "→ $1"
}

# Check if Dockerfile exists
echo "Step 1: File Existence"
echo "----------------------------------------"
if [ -f "$DOCKERFILE" ]; then
    check 0 "Dockerfile exists"
else
    check 1 "Dockerfile not found"
    exit 1
fi

# Check file size
FILE_SIZE=$(wc -c < "$DOCKERFILE")
print_info "Dockerfile size: $FILE_SIZE bytes"

echo ""
echo "Step 2: Multi-stage Build"
echo "----------------------------------------"

# Check for multi-stage build
BUILDER_STAGES=$(grep -c "^FROM.*AS builder" "$DOCKERFILE" || echo 0)
if [ "$BUILDER_STAGES" -ge 1 ]; then
    check 0 "Multi-stage build detected ($BUILDER_STAGES builder stage(s))"
else
    check 1 "No multi-stage build found"
fi

# Check for Alpine base
ALPINE_COUNT=$(grep -c "FROM alpine:3.19" "$DOCKERFILE" || echo 0)
if [ "$ALPINE_COUNT" -ge 2 ]; then
    check 0 "Alpine Linux 3.19 base image used"
else
    check 1 "Alpine Linux 3.19 not found in expected stages"
fi

echo ""
echo "Step 3: Required Components"
echo "----------------------------------------"

# Check for OpenVSCode Server
if grep -q "openvscode-server-v1.95.3" "$DOCKERFILE"; then
    check 0 "OpenVSCode Server 1.95.3 download found"
else
    check 1 "OpenVSCode Server 1.95.3 not found"
fi

# Check for Datadog
if grep -q "datadog" "$DOCKERFILE"; then
    check 0 "Datadog agent installation found"
else
    check 1 "Datadog agent not found"
fi

# Check for Node.js
if grep -q "nodejs" "$DOCKERFILE"; then
    check 0 "Node.js installation found"
else
    check 1 "Node.js installation not found"
fi

# Check for Python
if grep -q "python3" "$DOCKERFILE"; then
    check 0 "Python 3 installation found"
else
    check 1 "Python 3 installation not found"
fi

echo ""
echo "Step 4: Directory Structure"
echo "----------------------------------------"

# Check for required directories
REQUIRED_DIRS=(
    "/opt/openvscode-server"
    "/opt/datadog-agent"
    "/opt/mcp-servers"
    "/workspace"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if grep -q "$dir" "$DOCKERFILE"; then
        check 0 "Directory $dir configured"
    else
        check 1 "Directory $dir not found"
    fi
done

echo ""
echo "Step 5: Security"
echo "----------------------------------------"

# Check for non-root user
if grep -q "adduser.*openvscode" "$DOCKERFILE"; then
    check 0 "Non-root user 'openvscode' creation found"
else
    check 1 "Non-root user creation not found"
fi

# Check for USER directive
if grep -q "^USER openvscode" "$DOCKERFILE"; then
    check 0 "USER directive switches to non-root"
else
    check 1 "USER directive not found"
fi

# Check UID 1000
if grep -q "1000" "$DOCKERFILE"; then
    check 0 "UID 1000 specified"
else
    check 1 "UID 1000 not found"
fi

echo ""
echo "Step 6: Network Configuration"
echo "----------------------------------------"

# Check for EXPOSE
if grep -q "^EXPOSE 3000" "$DOCKERFILE"; then
    check 0 "Port 3000 exposed"
else
    check 1 "Port 3000 not exposed"
fi

# Check for host binding
if grep -q "0.0.0.0" "$DOCKERFILE"; then
    check 0 "Host binding to 0.0.0.0 configured"
else
    check_warning "Host binding not explicitly set"
fi

echo ""
echo "Step 7: Startup Configuration"
echo "----------------------------------------"

# Check for startup script
if grep -q "/opt/startup.sh" "$DOCKERFILE"; then
    check 0 "Startup script (/opt/startup.sh) found"
else
    check 1 "Startup script not found"
fi

# Check for ENTRYPOINT
if grep -q "^ENTRYPOINT" "$DOCKERFILE"; then
    check 0 "ENTRYPOINT directive found"
    if grep -q "tini" "$DOCKERFILE"; then
        check 0 "Using tini for signal handling"
    else
        check_warning "Not using tini for signal handling"
    fi
else
    check 1 "ENTRYPOINT directive not found"
fi

# Check for CMD
if grep -q "^CMD" "$DOCKERFILE"; then
    check 0 "CMD directive found"
else
    check 1 "CMD directive not found"
fi

echo ""
echo "Step 8: Health Check"
echo "----------------------------------------"

# Check for HEALTHCHECK
if grep -q "^HEALTHCHECK" "$DOCKERFILE"; then
    check 0 "HEALTHCHECK directive found"
    if grep -q "3000" "$DOCKERFILE" | grep -q "HEALTHCHECK" ; then
        check 0 "Health check on port 3000"
    fi
else
    check 1 "HEALTHCHECK directive not found"
fi

echo ""
echo "Step 9: Optimization"
echo "----------------------------------------"

# Check for layer optimization
NO_CACHE_COUNT=$(grep -c "no-cache" "$DOCKERFILE" || echo 0)
if [ "$NO_CACHE_COUNT" -ge 2 ]; then
    check 0 "APK cache cleanup found ($NO_CACHE_COUNT instances)"
else
    check_warning "Limited APK cache cleanup"
fi

# Check for cleanup commands
if grep -q "rm -rf" "$DOCKERFILE"; then
    check 0 "Cleanup commands found"
else
    check_warning "No explicit cleanup commands"
fi

# Check for WORKDIR
if grep -q "^WORKDIR /workspace" "$DOCKERFILE"; then
    check 0 "WORKDIR set to /workspace"
else
    check 1 "WORKDIR not set correctly"
fi

echo ""
echo "Step 10: Supporting Files"
echo "----------------------------------------"

# Check for .dockerignore
if [ -f ".dockerignore" ]; then
    check 0 ".dockerignore file exists"
    IGNORE_COUNT=$(wc -l < ".dockerignore")
    print_info ".dockerignore has $IGNORE_COUNT entries"
else
    check_warning ".dockerignore file not found"
fi

# Check for docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    check 0 "docker-compose.yml exists"
else
    check_warning "docker-compose.yml not found"
fi

# Check for .env.example
if [ -f ".env.example" ]; then
    check 0 ".env.example exists"
else
    check_warning ".env.example not found"
fi

# Check for README
if [ -f "README.md" ]; then
    check 0 "README.md exists"
else
    check_warning "README.md not found"
fi

echo ""
echo "Step 11: Content Analysis"
echo "----------------------------------------"

# Count total lines
TOTAL_LINES=$(wc -l < "$DOCKERFILE")
print_info "Total lines: $TOTAL_LINES"

# Count stages
STAGE_COUNT=$(grep -c "^FROM" "$DOCKERFILE")
print_info "Build stages: $STAGE_COUNT"

# Count RUN commands
RUN_COUNT=$(grep -c "^RUN" "$DOCKERFILE")
print_info "RUN commands: $RUN_COUNT"

# Count COPY commands
COPY_COUNT=$(grep -c "^COPY" "$DOCKERFILE")
print_info "COPY commands: $COPY_COUNT"

# Count ENV commands
ENV_COUNT=$(grep -c "^ENV" "$DOCKERFILE")
print_info "ENV variables: $ENV_COUNT"

echo ""
echo "=================================================="
echo "Validation Summary"
echo "=================================================="

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your Dockerfile is ready to build."
    echo "Run: docker build -t vibecode/openvscode-server:1.95.3 -f Dockerfile ."
    exit 0
else
    echo -e "${RED}✗ Found $ISSUES issue(s)${NC}"
    echo ""
    echo "Please review the issues above before building."
    exit 1
fi
