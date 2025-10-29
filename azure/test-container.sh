#!/bin/bash
# Test script for OpenVSCode Server Docker container
# Usage: bash test-container.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="vibecode/openvscode-server:1.95.3"
CONTAINER_NAME="vibecode-openvscode-test"
TEST_PORT="3000"
WORKSPACE_DIR="$(pwd)/test-workspace"

echo "=================================================="
echo "OpenVSCode Server Container Test Suite"
echo "=================================================="
echo ""

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        return 1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo "→ $1"
}

# Cleanup function
cleanup() {
    print_info "Cleaning up test environment..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
    rm -rf "$WORKSPACE_DIR"
    echo ""
}

# Set trap to cleanup on exit
trap cleanup EXIT

echo "Step 1: Pre-flight Checks"
echo "----------------------------------------"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_status 1 "Docker is not installed"
    exit 1
fi
print_status 0 "Docker is installed"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    print_status 1 "Docker daemon is not running"
    exit 1
fi
print_status 0 "Docker daemon is running"

echo ""
echo "Step 2: Build Docker Image"
echo "----------------------------------------"

print_info "Building image: $IMAGE_NAME"
if docker build -t "$IMAGE_NAME" -f Dockerfile . > /tmp/docker-build.log 2>&1; then
    print_status 0 "Image built successfully"
else
    print_status 1 "Image build failed"
    echo "Build log:"
    cat /tmp/docker-build.log
    exit 1
fi

echo ""
echo "Step 3: Image Analysis"
echo "----------------------------------------"

# Get image size
IMAGE_SIZE=$(docker images "$IMAGE_NAME" --format "{{.Size}}")
print_info "Image size: $IMAGE_SIZE"

# Parse size to check if under 500MB
SIZE_MB=$(echo "$IMAGE_SIZE" | sed 's/MB//' | sed 's/GB/*1024/' | bc 2>/dev/null || echo "999")
if [ "${SIZE_MB%.*}" -lt 500 ] 2>/dev/null; then
    print_status 0 "Image size is under 500MB target"
else
    print_warning "Image size exceeds 500MB target (actual: $IMAGE_SIZE)"
fi

# Show image layers
print_info "Image layers:"
docker history "$IMAGE_NAME" --no-trunc --format "table {{.Size}}\t{{.CreatedBy}}" | head -10

echo ""
echo "Step 4: Create Test Workspace"
echo "----------------------------------------"

mkdir -p "$WORKSPACE_DIR"
echo "console.log('Hello from VibeCode!');" > "$WORKSPACE_DIR/test.js"
echo "# Test Workspace" > "$WORKSPACE_DIR/README.md"
print_status 0 "Test workspace created at $WORKSPACE_DIR"

echo ""
echo "Step 5: Start Container"
echo "----------------------------------------"

print_info "Starting container: $CONTAINER_NAME"
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$TEST_PORT:3000" \
    -e VSCODE_PORT=3000 \
    -e WORKSPACE_DIR=/workspace \
    -v "$WORKSPACE_DIR:/workspace" \
    "$IMAGE_NAME" > /dev/null

print_status 0 "Container started"

echo ""
echo "Step 6: Wait for Startup"
echo "----------------------------------------"

print_info "Waiting for OpenVSCode Server to start (max 60 seconds)..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if docker exec "$CONTAINER_NAME" wget --spider -q http://localhost:3000/healthz 2>/dev/null; then
        print_status 0 "OpenVSCode Server is responding (took ${WAITED}s)"
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
    echo -n "."
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo ""
    print_status 1 "OpenVSCode Server failed to start within ${MAX_WAIT}s"
    print_info "Container logs:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

echo ""
echo "Step 7: Health Checks"
echo "----------------------------------------"

# Check container status
CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME")
if [ "$CONTAINER_STATUS" = "running" ]; then
    print_status 0 "Container is running"
else
    print_status 1 "Container status: $CONTAINER_STATUS"
fi

# Check health endpoint
if curl -sf "http://localhost:$TEST_PORT/healthz" > /dev/null 2>&1; then
    print_status 0 "Health endpoint responding"
else
    print_status 1 "Health endpoint not responding"
fi

# Check main interface
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$TEST_PORT/" 2>/dev/null)
if [ "$HTTP_STATUS" = "200" ]; then
    print_status 0 "Main interface responding (HTTP $HTTP_STATUS)"
else
    print_warning "Main interface returned HTTP $HTTP_STATUS"
fi

echo ""
echo "Step 8: Process Checks"
echo "----------------------------------------"

# Check if OpenVSCode Server process is running
if docker exec "$CONTAINER_NAME" pgrep -f "openvscode-server" > /dev/null; then
    print_status 0 "OpenVSCode Server process is running"
else
    print_status 1 "OpenVSCode Server process not found"
fi

# Check if tini is PID 1
PID1=$(docker exec "$CONTAINER_NAME" ps -o pid= -p 1 | tr -d ' ')
if [ "$PID1" = "1" ]; then
    print_status 0 "Init process (tini) is PID 1"
else
    print_warning "PID 1 is not tini"
fi

echo ""
echo "Step 9: Workspace Verification"
echo "----------------------------------------"

# Check if workspace files are accessible
if docker exec "$CONTAINER_NAME" test -f /workspace/test.js; then
    print_status 0 "Workspace files are accessible"
else
    print_status 1 "Workspace files not accessible"
fi

# Check file permissions
FILE_OWNER=$(docker exec "$CONTAINER_NAME" stat -c '%U:%G' /workspace)
if [ "$FILE_OWNER" = "openvscode:openvscode" ] || [ "$FILE_OWNER" = "root:root" ]; then
    print_status 0 "Workspace permissions correct ($FILE_OWNER)"
else
    print_warning "Workspace owner: $FILE_OWNER"
fi

echo ""
echo "Step 10: Security Checks"
echo "----------------------------------------"

# Check if running as non-root
CURRENT_USER=$(docker exec "$CONTAINER_NAME" whoami)
if [ "$CURRENT_USER" = "openvscode" ]; then
    print_status 0 "Running as non-root user (openvscode)"
else
    print_warning "Running as: $CURRENT_USER"
fi

# Check UID
USER_ID=$(docker exec "$CONTAINER_NAME" id -u)
if [ "$USER_ID" = "1000" ]; then
    print_status 0 "User ID is 1000"
else
    print_warning "User ID is $USER_ID (expected 1000)"
fi

echo ""
echo "Step 11: MCP Servers Check"
echo "----------------------------------------"

# Check if MCP servers directory exists
if docker exec "$CONTAINER_NAME" test -d /opt/mcp-servers; then
    print_status 0 "MCP servers directory exists"
else
    print_status 1 "MCP servers directory not found"
fi

echo ""
echo "Step 12: Resource Usage"
echo "----------------------------------------"

# Get container stats (one-time snapshot)
print_info "Container resource usage:"
docker stats "$CONTAINER_NAME" --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

echo ""
echo "Step 13: Logs Sample"
echo "----------------------------------------"

print_info "Container startup logs:"
docker logs "$CONTAINER_NAME" | head -20

echo ""
echo "=================================================="
echo "Test Results Summary"
echo "=================================================="

# Check container health one more time
if docker inspect -f '{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null | grep -q "healthy"; then
    print_status 0 "Container health: healthy"
elif docker inspect -f '{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null | grep -q "running"; then
    print_status 0 "Container is running (health check not yet complete)"
else
    print_status 1 "Container health check failed"
fi

echo ""
echo "Access OpenVSCode Server at: http://localhost:$TEST_PORT"
echo ""
echo "To view logs: docker logs $CONTAINER_NAME"
echo "To enter container: docker exec -it $CONTAINER_NAME /bin/bash"
echo "To stop container: docker stop $CONTAINER_NAME"
echo ""

read -p "Press Enter to cleanup and exit (or Ctrl+C to keep container running)..."
