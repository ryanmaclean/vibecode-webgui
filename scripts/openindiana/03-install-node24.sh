#!/bin/bash
#
# Install Node.js 24 in LX Zone
# Uses NodeSource repository for latest Node.js
#

set -euo pipefail

NODE_VERSION="24"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running in lx zone
check_environment() {
    if [ ! -f /etc/debian_version ]; then
        log_error "This script must be run inside the Debian lx zone"
        log_info "Run: zlogin vibecode-zone"
        exit 1
    fi

    log_info "Running in Debian lx zone"
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    apt update
    apt upgrade -y
}

# Install dependencies
install_dependencies() {
    log_info "Installing build dependencies..."

    apt install -y \
        ca-certificates \
        curl \
        gnupg \
        build-essential \
        python3 \
        python3-pip \
        git \
        wget
}

# Install Node.js from NodeSource
install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION} from NodeSource..."

    # Download and run NodeSource setup script
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -

    # Install Node.js
    apt install -y nodejs

    # Verify installation
    NODE_VERSION_INSTALLED=$(node --version)
    NPM_VERSION_INSTALLED=$(npm --version)

    log_info "Node.js installed: $NODE_VERSION_INSTALLED"
    log_info "npm installed: $NPM_VERSION_INSTALLED"

    # Check if version is correct
    if [[ ! "$NODE_VERSION_INSTALLED" =~ ^v${NODE_VERSION}\. ]]; then
        log_error "Node.js version mismatch. Expected v${NODE_VERSION}.x, got $NODE_VERSION_INSTALLED"
        exit 1
    fi
}

# Configure npm
configure_npm() {
    log_info "Configuring npm..."

    # Set npm global directory to user-writable location
    mkdir -p ~/.npm-global
    npm config set prefix ~/.npm-global

    # Add to PATH
    if ! grep -q ".npm-global/bin" ~/.bashrc; then
        echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
        export PATH=~/.npm-global/bin:$PATH
    fi

    # Update npm to latest
    npm install -g npm@latest

    log_info "npm version: $(npm --version)"
}

# Install useful global packages
install_global_packages() {
    log_info "Installing useful global npm packages..."

    npm install -g \
        pnpm \
        yarn \
        pm2 \
        typescript \
        tsx

    log_info "Global packages installed:"
    npm list -g --depth=0
}

# Optimize Node.js settings
optimize_nodejs() {
    log_info "Optimizing Node.js settings..."

    # Create systemwide Node.js configuration
    cat > /etc/profile.d/nodejs.sh <<'EOF'
# Node.js optimizations for VibeCode

# Increase V8 heap size
export NODE_OPTIONS="--max-old-space-size=4096"

# Use more libuv threads for better I/O performance
export UV_THREADPOOL_SIZE=16

# Enable V8 optimizations
export NODE_OPTIONS="$NODE_OPTIONS --optimize-for-size"

# Disable V8 warnings in production
export NODE_NO_WARNINGS=1
EOF

    chmod +x /etc/profile.d/nodejs.sh
    source /etc/profile.d/nodejs.sh

    log_info "Node.js optimizations configured"
}

# Create test application
create_test_app() {
    log_info "Creating test application..."

    mkdir -p /tmp/nodejs-test
    cd /tmp/nodejs-test

    cat > test.js <<'EOF'
const http = require('http');
const os = require('os');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Node.js is working!',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    memory: Math.round(os.totalmem() / 1024 / 1024) + ' MB'
  }, null, 2));
});

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}/`);
  console.log('Node.js installation verified!');
});

// Auto-shutdown after 5 seconds
setTimeout(() => {
  console.log('Test complete. Shutting down...');
  server.close();
  process.exit(0);
}, 5000);
EOF

    log_info "Testing Node.js installation..."
    node test.js &
    sleep 2

    # Test HTTP request
    if curl -s http://localhost:8080/ | grep -q "Node.js is working"; then
        log_info "Node.js test successful!"
    else
        log_warn "Node.js test failed, but installation may still be valid"
    fi

    sleep 4
    cd -
}

# Display installation summary
show_summary() {
    cat <<EOF

${GREEN}Node.js Installation Complete!${NC}
================================

Versions Installed:
  Node.js: $(node --version)
  npm: $(npm --version)
  pnpm: $(pnpm --version)
  yarn: $(yarn --version)
  pm2: $(pm2 --version)

Configuration:
  Global packages: ~/.npm-global
  Node.js options: /etc/profile.d/nodejs.sh

Environment Variables:
  NODE_OPTIONS: $NODE_OPTIONS
  UV_THREADPOOL_SIZE: $UV_THREADPOOL_SIZE

Next Steps:
  1. Run: ./04-setup-postgres-pgvector.sh
  2. Then: ./05-deploy-vibecode.sh

Test Commands:
  node --version
  npm --version
  node -e "console.log('Hello from Node.js', process.version)"

EOF
}

# Main
main() {
    log_info "Node.js ${NODE_VERSION} Installation"
    log_info "================================="

    check_environment
    update_system
    install_dependencies
    install_nodejs
    configure_npm
    install_global_packages
    optimize_nodejs
    create_test_app
    show_summary
}

main "$@"
