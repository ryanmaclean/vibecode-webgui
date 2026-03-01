#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Prerequisites validation script for VibeCode
# Validates all required dependencies for development environment setup
# Checks: Docker 20.10+, Docker Compose V2, Node.js 18+, kubectl, KIND

# Initialize log aggregation
init_log_aggregation

set -e

echo "🔍 VibeCode Prerequisites Validation"
echo "====================================="
echo ""

PASS=0
FAIL=0

# Helper function to compare semantic versions
version_gte() {
  # Returns 0 if $1 >= $2, otherwise returns 1
  printf '%s\n%s' "$2" "$1" | sort -V -C
}

# Check Docker
echo -n "✓ Docker installed: "
if command -v docker &> /dev/null; then
  echo "yes"
  ((PASS++))

  # Check Docker version
  echo -n "✓ Docker version (>= 20.10): "
  DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [ -n "$DOCKER_VERSION" ]; then
    echo "$DOCKER_VERSION"
    if version_gte "$DOCKER_VERSION" "20.10.0"; then
      ((PASS++))
    else
      echo "  ⚠️  Warning: Docker version is below 20.10"
      ((FAIL++))
    fi
  else
    echo "unknown"
    ((FAIL++))
  fi

  # Check Docker daemon is running
  echo -n "✓ Docker daemon running: "
  if docker ps &> /dev/null; then
    echo "yes"
    ((PASS++))
  else
    echo "no"
    ((FAIL++))
  fi
else
  echo "no"
  ((FAIL+=3))
fi

# Check Docker Compose V2
echo -n "✓ Docker Compose V2: "
if command -v docker &> /dev/null; then
  if docker compose version &> /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    echo "v$COMPOSE_VERSION"
    ((PASS++))
  elif command -v docker-compose &> /dev/null; then
    echo "found docker-compose (V1 legacy)"
    echo "  ⚠️  Warning: Docker Compose V2 recommended (use 'docker compose' instead of 'docker-compose')"
    ((FAIL++))
  else
    echo "no"
    ((FAIL++))
  fi
else
  echo "no (Docker not installed)"
  ((FAIL++))
fi

# Check Node.js
echo -n "✓ Node.js installed: "
if command -v node &> /dev/null; then
  echo "yes"
  ((PASS++))

  # Check Node.js version
  echo -n "✓ Node.js version (>= 18): "
  NODE_VERSION=$(node --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
  if [ -n "$NODE_VERSION" ]; then
    echo "v$NODE_VERSION"
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -ge 18 ]; then
      ((PASS++))
    else
      echo "  ⚠️  Warning: Node.js version is below 18"
      ((FAIL++))
    fi
  else
    echo "unknown"
    ((FAIL++))
  fi
else
  echo "no"
  ((FAIL+=2))
fi

# Check npm
echo -n "✓ npm installed: "
if command -v npm &> /dev/null; then
  NPM_VERSION=$(npm --version)
  echo "v$NPM_VERSION"
  ((PASS++))
else
  echo "no"
  ((FAIL++))
fi

# Check kubectl
echo -n "✓ kubectl installed: "
if command -v kubectl &> /dev/null; then
  # Try different kubectl version formats
  KUBECTL_VERSION=$(kubectl version --client -o json 2>/dev/null | grep -oE '"gitVersion":"v[0-9]+\.[0-9]+\.[0-9]+"' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [ -z "$KUBECTL_VERSION" ]; then
    KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  fi
  if [ -z "$KUBECTL_VERSION" ]; then
    KUBECTL_VERSION=$(kubectl version --client 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  fi
  if [ -n "$KUBECTL_VERSION" ]; then
    echo "v$KUBECTL_VERSION"
    ((PASS++))
  else
    echo "yes (version unknown)"
    ((PASS++))
  fi
else
  echo "no"
  ((FAIL++))
fi

# Check KIND
echo -n "✓ KIND installed: "
if command -v kind &> /dev/null; then
  KIND_VERSION=$(kind version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  echo "v$KIND_VERSION"
  ((PASS++))
else
  echo "no"
  ((FAIL++))
fi

echo ""
echo "====================================="
echo "Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✅ All prerequisites validated! Your environment is ready."
  exit 0
else
  echo "⚠️  Some prerequisites are missing or outdated."
  echo ""
  echo "📖 For installation instructions, see:"
  echo "   - Docker: https://docs.docker.com/get-docker/"
  echo "   - Docker Compose: https://docs.docker.com/compose/install/"
  echo "   - Node.js: https://nodejs.org/ (use LTS version)"
  echo "   - kubectl: https://kubernetes.io/docs/tasks/tools/"
  echo "   - KIND: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  echo ""
  exit 1
fi
