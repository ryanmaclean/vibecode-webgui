#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Enhanced OpenClaw Installation with Error Handling

# Initialize log aggregation
init_log_aggregation

set -e

LOG_FILE="/tmp/openclaw-install.log"
ERRORS=0

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    log "ERROR: $1"
    ((ERRORS++))
    return 1
}

rollback() {
    log "Rolling back changes..."
    # Add rollback logic here
    exit 1
}

trap rollback ERR

log "=== OpenClaw Installation Started ==="

# 1. Check prerequisites
log "Checking prerequisites..."
command -v brew >/dev/null 2>&1 || error "Homebrew not found" || {
    log "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || error "Homebrew installation failed"
}

# 2. Install OpenClaw
log "Installing OpenClaw..."
brew install openclaw || error "OpenClaw installation failed"

# 3. Verify installation
log "Verifying OpenClaw installation..."
openclaw --version >/dev/null 2>&1 || error "OpenClaw not working after installation"

# 4. Install Tailscale
log "Installing Tailscale..."
brew install tailscale || error "Tailscale installation failed"

# 5. Install certbot
log "Installing certbot..."
brew install certbot || error "Certbot installation failed"

# 6. Install OpenClaw gateway
log "Installing OpenClaw gateway..."
openclaw gateway install || error "Gateway installation failed"

# 7. Start services
log "Starting services..."
sudo launchctl bootstrap system /Library/LaunchDaemons/com.tailscale.tailscaled.plist 2>/dev/null || log "Tailscale already running"
launchctl bootstrap gui/$UID/ai.openclaw.gateway.plist 2>/dev/null || log "Gateway already running"

# 8. Health check
log "Running health check..."
sleep 3
curl -s http://localhost:18789/health >/dev/null 2>&1 || error "Gateway health check failed"

log "=== Installation Complete ==="
log "Errors: $ERRORS"
[ $ERRORS -eq 0 ] && exit 0 || exit 1
