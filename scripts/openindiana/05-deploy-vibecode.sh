#!/bin/bash
#
# Deploy VibeCode Application
# Clone, configure, and deploy VibeCode in lx zone
#

set -euo pipefail

REPO_URL="https://github.com/your-org/vibecode-webgui.git"
INSTALL_DIR="/opt/vibecode-webgui"
APP_USER="vibecode"
APP_PORT="3000"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check environment
check_environment() {
    if [ ! -f /etc/debian_version ]; then
        log_error "This script must be run inside the Debian lx zone"
        exit 1
    fi

    if [ "$(id -u)" -ne 0 ]; then
        log_error "This script must be run as root"
        exit 1
    fi

    log_info "Running in Debian lx zone as root"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js not found. Run: ./03-install-node24.sh"
        exit 1
    fi

    NODE_VERSION=$(node --version)
    log_info "Node.js: $NODE_VERSION"

    # Check PostgreSQL
    if ! systemctl is-active postgresql >/dev/null 2>&1; then
        log_error "PostgreSQL not running. Run: ./04-setup-postgres-pgvector.sh"
        exit 1
    fi

    log_info "PostgreSQL: running"

    # Check database credentials
    if [ ! -f /root/postgres-credentials.txt ]; then
        log_error "PostgreSQL credentials not found"
        exit 1
    fi

    log_info "Prerequisites check passed"
}

# Create application user
create_app_user() {
    log_info "Creating application user..."

    if id "$APP_USER" >/dev/null 2>&1; then
        log_info "User $APP_USER already exists"
    else
        useradd -m -s /bin/bash "$APP_USER"
        log_info "User $APP_USER created"
    fi
}

# Clone repository
clone_repository() {
    log_info "Cloning VibeCode repository..."

    if [ -d "$INSTALL_DIR" ]; then
        log_warn "Directory $INSTALL_DIR already exists"
        log_info "Pulling latest changes..."
        cd "$INSTALL_DIR"
        sudo -u "$APP_USER" git pull
    else
        log_info "Cloning from: $REPO_URL"
        sudo -u "$APP_USER" git clone "$REPO_URL" "$INSTALL_DIR"
    fi

    cd "$INSTALL_DIR"
    log_info "Current branch: $(git branch --show-current)"
    log_info "Latest commit: $(git log -1 --oneline)"
}

# Install dependencies
install_dependencies() {
    log_info "Installing application dependencies..."

    cd "$INSTALL_DIR"

    # Install Node.js dependencies
    log_info "Running npm install..."
    sudo -u "$APP_USER" npm install

    log_info "Dependencies installed"
}

# Configure environment
configure_environment() {
    log_info "Configuring environment..."

    cd "$INSTALL_DIR"

    # Read PostgreSQL credentials
    DB_URL=$(grep "DATABASE_URL=" /root/postgres-credentials.txt | cut -d'"' -f2)

    if [ -z "$DB_URL" ]; then
        log_error "Failed to read DATABASE_URL from credentials file"
        exit 1
    fi

    # Generate secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    API_KEY=$(openssl rand -hex 32)

    # Create .env file
    cat > .env <<EOF
# VibeCode Environment Configuration
# Generated on: $(date)

# Database
DATABASE_URL="$DB_URL"

# NextAuth
NEXTAUTH_URL="http://localhost:${APP_PORT}"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"

# Application
NODE_ENV="production"
PORT="$APP_PORT"

# API Keys
API_KEY="$API_KEY"

# OpenAI (configure with your keys)
# OPENAI_API_KEY="your-openai-api-key"

# Anthropic (configure with your keys)
# ANTHROPIC_API_KEY="your-anthropic-api-key"

# Redis (optional)
# REDIS_URL="redis://localhost:6379"

# Monitoring
# DATADOG_API_KEY="your-datadog-api-key"

# Security
ALLOWED_ORIGINS="http://localhost:${APP_PORT}"
EOF

    chown "$APP_USER:$APP_USER" .env
    chmod 600 .env

    log_info "Environment configured"
    log_warn "IMPORTANT: Update .env with your API keys before starting"
}

# Build application
build_application() {
    log_info "Building application..."

    cd "$INSTALL_DIR"

    # Run database migrations
    log_info "Running database migrations..."
    sudo -u "$APP_USER" npx prisma migrate deploy || log_warn "Migration failed or no migrations pending"

    # Generate Prisma client
    log_info "Generating Prisma client..."
    sudo -u "$APP_USER" npx prisma generate

    # Build Next.js application
    log_info "Building Next.js application (this may take a few minutes)..."
    sudo -u "$APP_USER" npm run build

    log_info "Build complete"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."

    cat > /etc/systemd/system/vibecode.service <<EOF
[Unit]
Description=VibeCode Application Server
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="PORT=$APP_PORT"
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/vibecode/app.log
StandardError=append:/var/log/vibecode/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR

# Resource limits
LimitNOFILE=65536
LimitNPROC=512

[Install]
WantedBy=multi-user.target
EOF

    # Create log directory
    mkdir -p /var/log/vibecode
    chown "$APP_USER:$APP_USER" /var/log/vibecode

    # Reload systemd
    systemctl daemon-reload

    log_info "Systemd service created"
}

# Configure firewall
configure_firewall() {
    log_info "Configuring firewall..."

    # Install ufw if not present
    if ! command -v ufw >/dev/null 2>&1; then
        apt install -y ufw
    fi

    # Allow SSH and application port
    ufw allow 22/tcp
    ufw allow "$APP_PORT/tcp"

    # Enable firewall
    echo "y" | ufw enable || true

    log_info "Firewall configured"
}

# Setup log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."

    cat > /etc/logrotate.d/vibecode <<EOF
/var/log/vibecode/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $APP_USER $APP_USER
    sharedscripts
    postrotate
        systemctl reload vibecode > /dev/null 2>&1 || true
    endscript
}
EOF

    log_info "Log rotation configured"
}

# Create maintenance scripts
create_maintenance_scripts() {
    log_info "Creating maintenance scripts..."

    # Health check script
    cat > /usr/local/bin/vibecode-health <<'EOF'
#!/bin/bash
# Health check for VibeCode

URL="http://localhost:3000"

if curl -sf "$URL" > /dev/null; then
    echo "✓ VibeCode is healthy"
    exit 0
else
    echo "✗ VibeCode is not responding"
    exit 1
fi
EOF

    # Restart script
    cat > /usr/local/bin/vibecode-restart <<'EOF'
#!/bin/bash
# Restart VibeCode application

echo "Restarting VibeCode..."
systemctl restart vibecode

sleep 5

if systemctl is-active vibecode > /dev/null; then
    echo "✓ VibeCode restarted successfully"
else
    echo "✗ VibeCode failed to start"
    journalctl -u vibecode -n 50
    exit 1
fi
EOF

    # Update script
    cat > /usr/local/bin/vibecode-update <<'EOF'
#!/bin/bash
# Update VibeCode to latest version

set -e

cd /opt/vibecode-webgui

echo "Pulling latest changes..."
sudo -u vibecode git pull

echo "Installing dependencies..."
sudo -u vibecode npm install

echo "Running migrations..."
sudo -u vibecode npx prisma migrate deploy

echo "Building application..."
sudo -u vibecode npm run build

echo "Restarting service..."
systemctl restart vibecode

sleep 5

if systemctl is-active vibecode > /dev/null; then
    echo "✓ Update complete"
else
    echo "✗ Service failed to start after update"
    exit 1
fi
EOF

    # Make executable
    chmod +x /usr/local/bin/vibecode-{health,restart,update}

    log_info "Maintenance scripts created"
}

# Start application
start_application() {
    log_info "Starting VibeCode application..."

    # Enable service
    systemctl enable vibecode

    # Start service
    systemctl start vibecode

    # Wait for startup
    log_info "Waiting for application to start..."
    sleep 10

    # Check status
    if systemctl is-active vibecode >/dev/null 2>&1; then
        log_info "VibeCode started successfully!"
    else
        log_error "VibeCode failed to start"
        log_error "Check logs: journalctl -u vibecode -n 50"
        exit 1
    fi
}

# Test application
test_application() {
    log_info "Testing application..."

    # Wait a bit more for full startup
    sleep 5

    # Test HTTP endpoint
    if curl -sf "http://localhost:${APP_PORT}" > /dev/null; then
        log_info "Application is responding on port ${APP_PORT}"
    else
        log_warn "Application not responding yet (may still be starting)"
    fi
}

# Display summary
show_summary() {
    # Get zone IP
    ZONE_IP=$(ip addr show net0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1 || echo "N/A")

    cat <<EOF

${GREEN}VibeCode Deployment Complete!${NC}
================================

Installation Directory: $INSTALL_DIR
User: $APP_USER
Port: $APP_PORT

Access URLs:
  Local:    http://localhost:${APP_PORT}
  Network:  http://${ZONE_IP}:${APP_PORT}

Service Management:
  Status:   systemctl status vibecode
  Start:    systemctl start vibecode
  Stop:     systemctl stop vibecode
  Restart:  systemctl restart vibecode
  Logs:     journalctl -u vibecode -f

Maintenance Commands:
  Health:   vibecode-health
  Restart:  vibecode-restart
  Update:   vibecode-update

Log Files:
  App:      /var/log/vibecode/app.log
  Error:    /var/log/vibecode/error.log
  System:   journalctl -u vibecode

Configuration:
  .env:     $INSTALL_DIR/.env

IMPORTANT:
  1. Update .env with your API keys:
       - OPENAI_API_KEY
       - ANTHROPIC_API_KEY
       - DATADOG_API_KEY (optional)

  2. After updating .env:
       systemctl restart vibecode

  3. Setup SSL/TLS for production:
       Install Caddy or nginx as reverse proxy

Next Steps:
  1. Run: ./06-configure-dtrace.sh (for monitoring)
  2. Configure API keys in .env
  3. Setup reverse proxy for HTTPS
  4. Configure backup strategy

Documentation:
  https://docs.vibecode.com/platforms/openindiana/

EOF
}

# Main
main() {
    log_info "VibeCode Deployment"
    log_info "==================="

    check_environment
    check_prerequisites
    create_app_user
    clone_repository
    install_dependencies
    configure_environment
    build_application
    create_systemd_service
    configure_firewall
    setup_log_rotation
    create_maintenance_scripts
    start_application
    test_application
    show_summary
}

main "$@"
