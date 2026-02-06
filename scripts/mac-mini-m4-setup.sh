#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Mac Mini M4 Complete Setup Script
# Run this on a fresh Mac Mini M4 to get full Tundra Dome environment
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/your-repo/scripts/mac-mini-m4-setup.sh | bash
#   OR
#   ./mac-mini-m4-setup.sh
#
# Prerequisites: macOS with admin access

# Initialize log aggregation
init_log_aggregation


set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "==========================================="
echo "Mac Mini M4 Tundra Dome Setup"
echo "==========================================="
echo ""

# Check for Homebrew
if ! command -v brew &>/dev/null; then
    log_info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add to path for Apple Silicon
    if [[ -f /opt/homebrew/bin/brew ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    fi
fi

log_success "Homebrew installed"

# Install Docker Desktop (if not installed)
if ! command -v docker &>/dev/null; then
    log_info "Installing Docker Desktop..."
    brew install --cask docker
    log_warn "Please open Docker Desktop and complete setup, then re-run this script"
    open -a Docker
    exit 0
fi

# Wait for Docker to be ready
if ! docker info &>/dev/null; then
    log_warn "Docker is not running. Starting Docker..."
    open -a Docker
    log_info "Waiting for Docker to start (this may take a minute)..."
    while ! docker info &>/dev/null; do
        sleep 2
    done
fi
log_success "Docker is running"

# Configure Docker resources (need at least 40GB disk)
log_info "Checking Docker resources..."
log_warn "Ensure Docker Desktop has at least 40GB disk allocated"
log_warn "Settings -> Resources -> Disk image size >= 40GB"

# Install KIND
if ! command -v kind &>/dev/null; then
    log_info "Installing KIND..."
    brew install kind
fi
log_success "KIND installed: $(kind version)"

# Install kubectl
if ! command -v kubectl &>/dev/null; then
    log_info "Installing kubectl..."
    brew install kubectl
fi
log_success "kubectl installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"

# Install Helm
if ! command -v helm &>/dev/null; then
    log_info "Installing Helm..."
    brew install helm
fi
log_success "Helm installed: $(helm version --short)"

# Install jq (useful for debugging)
if ! command -v jq &>/dev/null; then
    log_info "Installing jq..."
    brew install jq
fi

# Setup Datadog API key
if [[ -z "$DD_API_KEY" ]]; then
    if [[ -f "$HOME/.datadog/api_key" ]]; then
        export DD_API_KEY=$(cat "$HOME/.datadog/api_key")
        log_success "Using DD_API_KEY from ~/.datadog/api_key"
    else
        log_warn "DD_API_KEY not set"
        echo ""
        echo "To enable Datadog monitoring, set your API key:"
        echo "  mkdir -p ~/.datadog"
        echo "  echo 'your-api-key' > ~/.datadog/api_key"
        echo "  export DD_API_KEY=\$(cat ~/.datadog/api_key)"
        echo ""
        read -p "Enter Datadog API key (or press Enter to skip): " api_key
        if [[ -n "$api_key" ]]; then
            mkdir -p "$HOME/.datadog"
            echo "$api_key" > "$HOME/.datadog/api_key"
            chmod 600 "$HOME/.datadog/api_key"
            export DD_API_KEY="$api_key"
            log_success "API key saved to ~/.datadog/api_key"
        fi
    fi
fi

# Clone repo if not present
REPO_DIR="$HOME/gt/tundra-dome"
if [[ ! -d "$REPO_DIR" ]]; then
    log_info "Cloning Tundra Dome repository..."
    mkdir -p "$HOME/gt"
    git clone https://github.com/your-org/tundra-dome.git "$REPO_DIR" 2>/dev/null || {
        log_warn "Could not clone repo. Using local scripts only."
        REPO_DIR="$(pwd)"
    }
fi

# Add DD_API_KEY to shell profile
if [[ -n "$DD_API_KEY" ]] && ! grep -q "DD_API_KEY" ~/.zprofile 2>/dev/null; then
    echo 'export DD_API_KEY=$(cat ~/.datadog/api_key 2>/dev/null)' >> ~/.zprofile
    log_success "Added DD_API_KEY to ~/.zprofile"
fi

echo ""
echo "==========================================="
log_success "Mac Mini M4 Setup Complete!"
echo "==========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Ensure Docker Desktop has 40GB+ disk allocated"
echo "   Docker Desktop -> Settings -> Resources -> Disk image size"
echo ""
echo "2. Run the Tundra Dome bootstrap:"
echo "   cd $REPO_DIR"
echo "   ./scripts/kind-tundra-bootstrap.sh tundra-dome"
echo ""
echo "3. For multiple clusters on this machine:"
echo "   ./scripts/kind-tundra-bootstrap.sh gastown"
echo "   ./scripts/kind-tundra-bootstrap.sh vibecode-local"
echo ""
echo "The bootstrap script will:"
echo "  - Create KIND cluster with proper config"
echo "  - Install Datadog with DSM enabled"
echo "  - Setup APM connectivity (fixes headless service issue)"
echo "  - Configure OpenLineage with unique namespace"
echo "  - Deploy Kafka, Airflow, and Observer services"
echo ""
echo "Everything will work out of the box!"
echo ""
