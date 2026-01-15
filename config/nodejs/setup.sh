#!/bin/bash
#
# Node.js Development Environment Setup Script
# For: Debian 12 (Bookworm) ARM64 vfkit VM
# Purpose: Install Node.js 22 LTS with complete development toolchain
# Usage: sudo bash setup.sh
#
# This script installs:
# - Node.js 22 LTS via nvm (v22.22.0 recommended)
# - npm, pnpm, yarn package managers
# - Rust 1.90+ toolchain
# - Python 3.11+ for node-gyp
# - Build essentials and native module dependencies
# - Global development packages (TypeScript, nodemon, etc.)
#
# Tested on: Debian 12 ARM64 (vfkit VM on macOS Apple Silicon)
# Last Updated: 2025-10-28
#

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
NODE_VERSION="22.22.0"  # Updated to 22.22.0 LTS for security patches (fixes 8 CVEs)
NVM_VERSION="0.40.0"
RUST_VERSION="1.90.0"
PYTHON_VERSION="3.11"
PNPM_VERSION="9.12.0"
YARN_VERSION="1.22.22"

# User to install for (default: dev, fallback to sudo user)
TARGET_USER="${SUDO_USER:-dev}"
TARGET_HOME="/home/${TARGET_USER}"

log_info "Starting Node.js Development Environment setup for user: ${TARGET_USER}"
log_info "Target Node.js version: ${NODE_VERSION}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root or with sudo"
    exit 1
fi

# Update package lists
log_info "Updating package lists..."
apt-get update -qq

# Install system dependencies
log_info "Installing system dependencies..."
apt-get install -y \
    build-essential \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    pkg-config \
    libssl-dev \
    libffi-dev \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    llvm \
    libncurses5-dev \
    libncursesw5-dev \
    xz-utils \
    tk-dev \
    liblzma-dev \
    python3-openssl \
    jq \
    htop \
    tree \
    vim \
    nano

log_success "System dependencies installed"

# Install Python 3.11+ (required for node-gyp)
log_info "Installing Python ${PYTHON_VERSION}..."
apt-get install -y \
    python${PYTHON_VERSION} \
    python${PYTHON_VERSION}-dev \
    python${PYTHON_VERSION}-venv \
    python3-pip

# Set Python 3.11 as default python3
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python${PYTHON_VERSION} 1
update-alternatives --set python3 /usr/bin/python${PYTHON_VERSION}

PYTHON_ACTUAL=$(python3 --version | awk '{print $2}')
log_success "Python ${PYTHON_ACTUAL} installed"

# Install Rust via rustup (for native modules and CLI tools)
log_info "Installing Rust ${RUST_VERSION}..."
if [ ! -f "${TARGET_HOME}/.cargo/bin/rustc" ]; then
    su - "${TARGET_USER}" -c "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION}"
    log_success "Rust installed"
else
    log_warn "Rust already installed, updating..."
    su - "${TARGET_USER}" -c "rustup update stable"
fi

# Source Rust environment
su - "${TARGET_USER}" -c "source ${TARGET_HOME}/.cargo/env && rustc --version"
RUST_ACTUAL=$(su - "${TARGET_USER}" -c "source ${TARGET_HOME}/.cargo/env && rustc --version" | awk '{print $2}')
log_success "Rust ${RUST_ACTUAL} ready"

# Install nvm (Node Version Manager)
log_info "Installing nvm ${NVM_VERSION}..."
if [ ! -d "${TARGET_HOME}/.nvm" ]; then
    su - "${TARGET_USER}" -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | bash"
    log_success "nvm installed"
else
    log_warn "nvm already installed"
fi

# Configure nvm in shell profiles
for profile in .bashrc .zshrc .profile; do
    if [ -f "${TARGET_HOME}/${profile}" ]; then
        if ! grep -q 'NVM_DIR' "${TARGET_HOME}/${profile}"; then
            cat >> "${TARGET_HOME}/${profile}" << 'EOF'

# NVM configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
EOF
            log_info "Added nvm to ${profile}"
        fi
    fi
done

# Install Node.js 22 LTS
log_info "Installing Node.js ${NODE_VERSION}..."
su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    nvm install ${NODE_VERSION}
    nvm use ${NODE_VERSION}
    nvm alias default ${NODE_VERSION}
"

# Verify Node.js installation
NODE_ACTUAL=$(su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    node --version
" | tr -d 'v')
NPM_ACTUAL=$(su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    npm --version
")

log_success "Node.js ${NODE_ACTUAL} installed"
log_success "npm ${NPM_ACTUAL} installed"

# Configure npm for performance
log_info "Configuring npm..."
su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    npm config set fetch-retries 5
    npm config set fetch-retry-mintimeout 20000
    npm config set fetch-retry-maxtimeout 120000
    npm config set maxsockets 5
    npm config set progress false
    npm config set fund false
"
log_success "npm configured"

# Install pnpm (fast, disk-efficient package manager)
log_info "Installing pnpm ${PNPM_VERSION}..."
su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    npm install -g pnpm@${PNPM_VERSION}
"

PNPM_ACTUAL=$(su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    pnpm --version
")
log_success "pnpm ${PNPM_ACTUAL} installed"

# Install Yarn (for projects requiring it)
log_info "Installing Yarn ${YARN_VERSION}..."
su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    npm install -g yarn@${YARN_VERSION}
"

YARN_ACTUAL=$(su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    yarn --version
")
log_success "Yarn ${YARN_ACTUAL} installed"

# Install global development packages
log_info "Installing global Node.js packages..."
su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    npm install -g \
        typescript@5.9.3 \
        ts-node@10.9.2 \
        tsx@4.19.2 \
        nodemon@3.1.7 \
        @swc/core@1.13.5 \
        prettier@3.3.3 \
        eslint@9.15.0
"
log_success "Global packages installed"

# Configure pnpm store
log_info "Configuring pnpm store..."
mkdir -p "${TARGET_HOME}/.pnpm-store"
chown -R "${TARGET_USER}:${TARGET_USER}" "${TARGET_HOME}/.pnpm-store"
su - "${TARGET_USER}" -c "
    export NVM_DIR=\"${TARGET_HOME}/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
    pnpm config set store-dir ${TARGET_HOME}/.pnpm-store
"
log_success "pnpm store configured"

# Create npm cache directory (will be shared via virtiofs)
log_info "Setting up npm cache directory..."
mkdir -p "${TARGET_HOME}/.npm"
chown -R "${TARGET_USER}:${TARGET_USER}" "${TARGET_HOME}/.npm"
log_success "npm cache directory ready"

# Create Rust target cache directory
log_info "Setting up Rust target cache..."
mkdir -p "${TARGET_HOME}/.cargo/target-cache"
chown -R "${TARGET_USER}:${TARGET_USER}" "${TARGET_HOME}/.cargo/target-cache"
log_success "Rust cache directory ready"

# Add environment variables to shell profiles
log_info "Configuring environment variables..."
for profile in .bashrc .zshrc; do
    if [ -f "${TARGET_HOME}/${profile}" ]; then
        if ! grep -q 'NODE_OPTIONS' "${TARGET_HOME}/${profile}"; then
            cat >> "${TARGET_HOME}/${profile}" << 'EOF'

# Node.js development environment
export NODE_OPTIONS="--max-old-space-size=6144"
export CARGO_BUILD_JOBS="4"
export RUSTFLAGS="-C target-cpu=native"
export npm_config_jobs="4"

# Rust environment
source "$HOME/.cargo/env"
EOF
            log_info "Added environment variables to ${profile}"
        fi
    fi
done

# Fix permissions
log_info "Fixing permissions..."
chown -R "${TARGET_USER}:${TARGET_USER}" "${TARGET_HOME}/.nvm"
chown -R "${TARGET_USER}:${TARGET_USER}" "${TARGET_HOME}/.npm"
chown -R "${TARGET_USER}:${TARGET_USER}" "${TARGET_HOME}/.pnpm-store"
chown -R "${TARGET_USER}:${TARGET_USER}" "${TARGET_HOME}/.cargo"
log_success "Permissions fixed"

# Print summary
log_success "=========================================="
log_success "Node.js Development Environment Ready!"
log_success "=========================================="
echo ""
log_info "Installed versions:"
echo "  - Node.js: ${NODE_ACTUAL}"
echo "  - npm:     ${NPM_ACTUAL}"
echo "  - pnpm:    ${PNPM_ACTUAL}"
echo "  - Yarn:    ${YARN_ACTUAL}"
echo "  - Python:  ${PYTHON_ACTUAL}"
echo "  - Rust:    ${RUST_ACTUAL}"
echo ""
log_info "Global packages:"
echo "  - typescript, ts-node, tsx"
echo "  - nodemon, @swc/core"
echo "  - prettier, eslint"
echo ""
log_info "Next steps:"
echo "  1. Log out and log back in (or source ~/.bashrc)"
echo "  2. cd /workspace/vibecode-webgui"
echo "  3. npm install"
echo "  4. npm run dev"
echo ""
log_info "Alternative Node.js versions:"
echo "  - Switch to Node 24: nvm install 24 && nvm use 24"
echo "  - Switch back to 22: nvm use 22"
echo "  - List installed:    nvm list"
echo ""
log_info "Package managers:"
echo "  - npm:  Default, comes with Node.js"
echo "  - pnpm: Fast, disk-efficient (recommended)"
echo "  - yarn: Classic package manager"
echo ""
log_warn "Important: Node.js 24 NOT recommended (tree-sitter issues)"
log_info "Recommendation: Stay on Node.js 22 LTS (proven stable)"
echo ""
log_success "Setup complete! 🚀"
