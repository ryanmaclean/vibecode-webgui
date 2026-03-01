#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Diagnostic script for common setup issues
# Analyzes the system and provides actionable recommendations

# Initialize log aggregation
init_log_aggregation

echo "🔍 VibeCode Setup Diagnostics"
echo "=============================="
echo "This script will analyze your system for common setup issues"
echo "and provide actionable recommendations."
echo ""

ISSUES_FOUND=0
WARNINGS_FOUND=0
RECOMMENDATIONS=()

# Helper function to add recommendation
add_recommendation() {
  RECOMMENDATIONS+=("$1")
}

# Helper function to report issue
report_issue() {
  echo "❌ ISSUE: $1"
  ((ISSUES_FOUND++))
}

# Helper function to report warning
report_warning() {
  echo "⚠️  WARNING: $1"
  ((WARNINGS_FOUND++))
}

# Helper function to report ok
report_ok() {
  echo "✅ OK: $1"
}

echo "=== Node.js Diagnostics ==="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  report_issue "Node.js is not installed"
  add_recommendation "Install Node.js 22.15.1+ using nvm: https://github.com/nvm-sh/nvm"
else
  NODE_VERSION=$(node --version | sed 's/v//')
  echo "Node.js version: $NODE_VERSION"

  # Check Node.js version (minimum 18.0.0, recommended 22.15.1+)
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  NODE_MINOR=$(echo "$NODE_VERSION" | cut -d. -f2)
  NODE_PATCH=$(echo "$NODE_VERSION" | cut -d. -f3)

  if [ "$NODE_MAJOR" -lt 18 ]; then
    report_issue "Node.js version $NODE_VERSION is too old (minimum: 18.0.0)"
    add_recommendation "Upgrade Node.js to 22.15.1+ using: nvm install 22.15.1 && nvm use 22.15.1"
  elif [ "$NODE_MAJOR" -eq 18 ] || [ "$NODE_MAJOR" -eq 19 ] || [ "$NODE_MAJOR" -eq 20 ] || [ "$NODE_MAJOR" -eq 21 ]; then
    report_warning "Node.js version $NODE_VERSION works but 22.15.1+ is recommended"
    add_recommendation "Consider upgrading to Node.js 22.15.1 for best compatibility: nvm install 22.15.1"
  else
    report_ok "Node.js version $NODE_VERSION meets requirements"
  fi
fi

# Check npm
if ! command -v npm &> /dev/null; then
  report_issue "npm is not installed"
  add_recommendation "npm should be installed with Node.js. Reinstall Node.js."
else
  NPM_VERSION=$(npm --version)
  echo "npm version: $NPM_VERSION"

  NPM_MAJOR=$(echo "$NPM_VERSION" | cut -d. -f1)
  NPM_MINOR=$(echo "$NPM_VERSION" | cut -d. -f2)

  if [ "$NPM_MAJOR" -lt 8 ]; then
    report_issue "npm version $NPM_VERSION is too old (minimum: 8.0.0)"
    add_recommendation "Update npm: npm install -g npm@latest"
  elif [ "$NPM_MAJOR" -lt 10 ]; then
    report_warning "npm version $NPM_VERSION works but 10.9.4+ is recommended"
    add_recommendation "Consider updating npm: npm install -g npm@latest"
  else
    report_ok "npm version $NPM_VERSION meets requirements"
  fi
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
  report_ok "node_modules directory exists"

  # Check node_modules size to detect potential corruption
  NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)
  echo "node_modules size: $NODE_MODULES_SIZE"
else
  report_warning "node_modules directory not found"
  add_recommendation "Run 'npm install' to install dependencies"
fi

echo ""
echo "=== Docker Diagnostics ==="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  report_issue "Docker is not installed"
  add_recommendation "Install Docker Desktop 20.10+ from https://www.docker.com/products/docker-desktop"
else
  DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  echo "Docker version: $DOCKER_VERSION"

  DOCKER_MAJOR=$(echo "$DOCKER_VERSION" | cut -d. -f1)
  DOCKER_MINOR=$(echo "$DOCKER_VERSION" | cut -d. -f2)

  if [ "$DOCKER_MAJOR" -lt 20 ] || ([ "$DOCKER_MAJOR" -eq 20 ] && [ "$DOCKER_MINOR" -lt 10 ]); then
    report_issue "Docker version $DOCKER_VERSION is too old (minimum: 20.10.0)"
    add_recommendation "Update Docker to version 20.10+ from https://www.docker.com/products/docker-desktop"
  else
    report_ok "Docker version $DOCKER_VERSION meets requirements"
  fi

  # Check if Docker daemon is running
  if ! docker info &> /dev/null; then
    report_issue "Docker daemon is not running"
    add_recommendation "Start Docker Desktop or run: sudo systemctl start docker (Linux)"
  else
    report_ok "Docker daemon is running"

    # Check Docker disk usage
    DOCKER_DISK_USAGE=$(docker system df 2>/dev/null | grep -i total | awk '{print $4}' || echo "unknown")
    echo "Docker disk usage: $DOCKER_DISK_USAGE"
  fi
fi

# Check Docker Compose
if ! command -v docker &> /dev/null; then
  # Skip if docker not installed
  :
elif docker compose version &> /dev/null; then
  COMPOSE_VERSION=$(docker compose version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  echo "Docker Compose version: $COMPOSE_VERSION (V2)"
  report_ok "Docker Compose V2 is installed"
elif command -v docker-compose &> /dev/null; then
  COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  echo "Docker Compose version: $COMPOSE_VERSION (V1)"
  report_warning "Docker Compose V1 detected - V2 is recommended"
  add_recommendation "Install Docker Compose V2 (comes with Docker Desktop) or upgrade: https://docs.docker.com/compose/install/"
else
  report_issue "Docker Compose is not installed"
  add_recommendation "Install Docker Compose V2 from https://docs.docker.com/compose/install/"
fi

echo ""
echo "=== Kubernetes (KIND) Diagnostics ==="
echo ""

# Check kubectl
if ! command -v kubectl &> /dev/null; then
  report_warning "kubectl is not installed (optional for Docker Compose mode)"
  add_recommendation "For KIND deployment, install kubectl: https://kubernetes.io/docs/tasks/tools/"
else
  KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || kubectl version --client -o json 2>/dev/null | grep -oE '"gitVersion":"v[0-9]+\.[0-9]+\.[0-9]+' | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  echo "kubectl version: $KUBECTL_VERSION"
  report_ok "kubectl is installed"
fi

# Check KIND
if ! command -v kind &> /dev/null; then
  report_warning "KIND is not installed (optional for Docker Compose mode)"
  add_recommendation "For Kubernetes deployment, install KIND 0.11+: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
else
  KIND_VERSION=$(kind version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  echo "KIND version: $KIND_VERSION"

  KIND_MAJOR=$(echo "$KIND_VERSION" | cut -d. -f1)
  KIND_MINOR=$(echo "$KIND_VERSION" | cut -d. -f2)

  if [ "$KIND_MAJOR" -eq 0 ] && [ "$KIND_MINOR" -lt 11 ]; then
    report_warning "KIND version $KIND_VERSION is old (recommended: 0.11+)"
    add_recommendation "Update KIND to 0.11+: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  else
    report_ok "KIND version $KIND_VERSION meets requirements"
  fi

  # Check for running KIND clusters
  if command -v kind &> /dev/null && command -v docker &> /dev/null; then
    KIND_CLUSTERS=$(kind get clusters 2>/dev/null || echo "")
    if [ -n "$KIND_CLUSTERS" ]; then
      echo "KIND clusters found: $KIND_CLUSTERS"
      report_ok "KIND clusters are configured"
    else
      echo "No KIND clusters found"
    fi
  fi
fi

echo ""
echo "=== System Resources ==="
echo ""

# Check available disk space
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
echo "Available disk space: $AVAILABLE_SPACE"

# Try to get numeric value for comparison
AVAILABLE_SPACE_GB=$(df -BG . 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G//' || echo "0")
# Remove any non-numeric characters and handle empty strings
AVAILABLE_SPACE_GB=$(echo "$AVAILABLE_SPACE_GB" | grep -oE '^[0-9]+' || echo "0")

if [ -n "$AVAILABLE_SPACE_GB" ] && [ "$AVAILABLE_SPACE_GB" -gt 0 ]; then
  if [ "$AVAILABLE_SPACE_GB" -lt 10 ]; then
    report_warning "Low disk space: ${AVAILABLE_SPACE}"
    add_recommendation "Free up disk space. Recommended: 20GB+ for development"
  elif [ "$AVAILABLE_SPACE_GB" -lt 20 ]; then
    report_warning "Disk space is adequate but more is recommended: ${AVAILABLE_SPACE}"
    add_recommendation "Consider freeing up more disk space for Docker images and builds"
  else
    report_ok "Sufficient disk space available: ${AVAILABLE_SPACE}"
  fi
else
  report_ok "Disk space check: ${AVAILABLE_SPACE}"
fi

# Check available memory (macOS and Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  if command -v sysctl &> /dev/null; then
    TOTAL_MEM_GB=$(sysctl -n hw.memsize 2>/dev/null | awk '{print int($1/1024/1024/1024)}' || echo "0")
    echo "Total memory: ${TOTAL_MEM_GB}GB"

    if [ -n "$TOTAL_MEM_GB" ] && [ "$TOTAL_MEM_GB" -gt 0 ]; then
      if [ "$TOTAL_MEM_GB" -lt 8 ]; then
        report_warning "Low system memory: ${TOTAL_MEM_GB}GB (recommended: 8GB+)"
        add_recommendation "Consider increasing available memory or closing other applications"
      else
        report_ok "Sufficient memory: ${TOTAL_MEM_GB}GB"
      fi
    fi
  fi
elif [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "linux"* ]]; then
  if command -v free &> /dev/null; then
    TOTAL_MEM_GB=$(free -g 2>/dev/null | awk '/^Mem:/ {print $2}' || echo "0")
    AVAILABLE_MEM_GB=$(free -g 2>/dev/null | awk '/^Mem:/ {print $7}' || echo "0")
    echo "Total memory: ${TOTAL_MEM_GB}GB (Available: ${AVAILABLE_MEM_GB}GB)"

    if [ -n "$TOTAL_MEM_GB" ] && [ "$TOTAL_MEM_GB" -gt 0 ]; then
      if [ "$TOTAL_MEM_GB" -lt 8 ]; then
        report_warning "Low system memory: ${TOTAL_MEM_GB}GB (recommended: 8GB+)"
        add_recommendation "Consider increasing available memory or closing other applications"
      else
        report_ok "Sufficient memory: ${TOTAL_MEM_GB}GB"
      fi
    fi
  fi
fi

echo ""
echo "=== Common Port Conflicts ==="
echo ""

# Check common ports used by VibeCode
check_port() {
  local port=$1
  local service=$2

  if command -v lsof &> /dev/null; then
    if lsof -Pi :$port -sTCP:LISTEN -t &> /dev/null; then
      local pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
      local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
      report_warning "Port $port ($service) is already in use by PID $pid ($process)"
      add_recommendation "Stop the process using port $port or configure $service to use a different port"
      return 1
    fi
  elif command -v netstat &> /dev/null; then
    if netstat -an | grep -q "[:.]$port.*LISTEN"; then
      report_warning "Port $port ($service) appears to be in use"
      add_recommendation "Stop the process using port $port or configure $service to use a different port"
      return 1
    fi
  fi

  return 0
}

# Common ports
check_port 3000 "Frontend" && echo "✅ Port 3000 (Frontend) is available"
check_port 5173 "Vite Dev Server" && echo "✅ Port 5173 (Vite) is available"
check_port 5432 "PostgreSQL" && echo "✅ Port 5432 (PostgreSQL) is available"
check_port 6379 "Redis" && echo "✅ Port 6379 (Redis) is available"
check_port 9092 "Kafka" && echo "✅ Port 9092 (Kafka) is available"

echo ""
echo "=== File Permissions ==="
echo ""

# Check if we can write to current directory
if [ -w "." ]; then
  report_ok "Current directory is writable"
else
  report_issue "Current directory is not writable"
  add_recommendation "Change directory permissions: chmod u+w ."
fi

# Check package.json permissions
if [ -f "package.json" ]; then
  if [ -r "package.json" ]; then
    report_ok "package.json is readable"
  else
    report_issue "package.json is not readable"
    add_recommendation "Fix package.json permissions: chmod u+r package.json"
  fi
fi

# Check npm cache
if command -v npm &> /dev/null; then
  NPM_CACHE_DIR=$(npm config get cache)
  if [ -d "$NPM_CACHE_DIR" ] && [ -w "$NPM_CACHE_DIR" ]; then
    report_ok "npm cache directory is writable"
  elif [ -d "$NPM_CACHE_DIR" ]; then
    report_warning "npm cache directory exists but may not be writable"
    add_recommendation "Try clearing npm cache: npm cache clean --force"
  fi
fi

echo ""
echo "=== Component Verification ==="
echo ""

# Check for key project files
check_file() {
  local file=$1
  local description=$2

  if [ -f "$file" ]; then
    report_ok "$description exists: $file"
    return 0
  else
    report_warning "$description not found: $file"
    return 1
  fi
}

check_file "package.json" "Project configuration"
check_file "docker-compose.yml" "Docker Compose configuration"
check_file ".env.example" "Environment template"

# Check if .env exists
if [ -f ".env" ]; then
  report_ok "Environment file (.env) exists"
else
  report_warning "Environment file (.env) not found"
  add_recommendation "Copy .env.example to .env and configure: cp .env.example .env"
fi

# Check MCP components
check_file "src/mcp/server.ts" "MCP server"

# Check if MCP server is executable (if on Unix-like system)
if [ -f "src/mcp/server.ts" ]; then
  if [ -x "src/mcp/server.ts" ]; then
    report_ok "MCP server is executable"
  else
    report_warning "MCP server may not be executable"
    add_recommendation "Make MCP server executable: chmod +x src/mcp/server.ts"
  fi
fi

echo ""
echo "=============================="
echo "=== Diagnostic Summary ==="
echo "=============================="
echo ""

if [ $ISSUES_FOUND -eq 0 ] && [ $WARNINGS_FOUND -eq 0 ]; then
  echo "✅ No issues found! Your system appears to be correctly configured."
  echo ""
  echo "Next steps:"
  echo "  1. Run 'npm install' to install dependencies"
  echo "  2. Run 'bash scripts/setup-wizard.sh' for guided setup"
  echo "  3. Or run 'bash scripts/quick-setup-docker-compose.sh' for quick Docker Compose setup"
  exit 0
else
  echo "Found $ISSUES_FOUND issue(s) and $WARNINGS_FOUND warning(s)"
  echo ""

  if [ ${#RECOMMENDATIONS[@]} -gt 0 ]; then
    echo "=== Recommended Actions ==="
    echo ""
    for i in "${!RECOMMENDATIONS[@]}"; do
      echo "$((i+1)). ${RECOMMENDATIONS[$i]}"
    done
    echo ""
  fi

  echo "For detailed troubleshooting, see:"
  echo "  - docs/setup/INSTALLATION_TROUBLESHOOTING.md"
  echo "  - docs/INSTALLATION_MASTER_GUIDE.md"
  echo ""

  if [ $ISSUES_FOUND -gt 0 ]; then
    echo "⚠️  Please resolve the issues above before proceeding with setup."
    exit 1
  else
    echo "⚠️  Warnings detected but setup may still work."
    echo "Consider addressing the warnings for best results."
    exit 0
  fi
fi
