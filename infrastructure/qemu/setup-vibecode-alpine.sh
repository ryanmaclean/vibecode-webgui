#!/bin/sh
# VibeCode Setup Script for Alpine Linux ARM64
# Run this inside the Alpine VM after installation

set -e

echo "═══════════════════════════════════════════════════════"
echo "  VibeCode Setup for Alpine Linux ARM64"
echo "═══════════════════════════════════════════════════════"
echo

# Step 1: System Update
echo "=== Step 1: System Update ==="
apk update
apk upgrade
echo "✓ System updated"
echo

# Step 2: Install Base Packages
echo "=== Step 2: Installing Base Packages ==="
apk add curl wget git vim bash sudo shadow
echo "✓ Base packages installed"
echo

# Step 3: Install Node.js 20
echo "=== Step 3: Installing Node.js 20 ==="
apk add nodejs npm
node --version
npm --version
echo "✓ Node.js installed"
echo

# Step 4: Install PostgreSQL 16
echo "=== Step 4: Installing PostgreSQL 16 ==="
apk add postgresql16 postgresql16-contrib
rc-update add postgresql
mkdir -p /var/lib/postgresql/data
chown postgres:postgres /var/lib/postgresql/data
su - postgres -c 'initdb -D /var/lib/postgresql/data'
echo "✓ PostgreSQL installed"
echo

# Step 5: Install Redis
echo "=== Step 5: Installing Redis ==="
apk add redis
rc-update add redis
echo "✓ Redis installed"
echo

# Step 6: Create VibeCode User
echo "=== Step 6: Creating VibeCode User ==="
adduser -D -s /bin/bash vibecode || echo "User already exists"
echo 'vibecode:vibecode' | chpasswd
echo "✓ VibeCode user created"
echo

# Step 7: Clone VibeCode Repository
echo "=== Step 7: Cloning VibeCode Repository ==="
mkdir -p /opt/vibecode
cd /opt/vibecode
if [ ! -d ".git" ]; then
    git clone https://github.com/ryanmaclean/vibecode-webgui.git .
else
    git pull
fi
chown -R vibecode:vibecode /opt/vibecode
echo "✓ Repository cloned"
echo

# Step 8: Install Dependencies
echo "=== Step 8: Installing VibeCode Dependencies ==="
cd /opt/vibecode
su - vibecode -c 'cd /opt/vibecode && npm install'
echo "✓ Dependencies installed"
echo

# Step 9: Build VibeCode
echo "=== Step 9: Building VibeCode ==="
su - vibecode -c 'cd /opt/vibecode && npm run build'
echo "✓ VibeCode built"
echo

# Step 10: Create OpenRC Service
echo "=== Step 10: Creating VibeCode Service ==="
cat > /etc/init.d/vibecode <<'EOF'
#!/sbin/openrc-run

name="vibecode"
description="VibeCode Application"

command="/usr/bin/npm"
command_args="start"
command_user="vibecode:vibecode"
directory="/opt/vibecode"

pidfile="/run/vibecode.pid"
command_background="yes"

depend() {
    need net postgresql redis
    after postgresql redis
}
EOF
chmod +x /etc/init.d/vibecode
echo "✓ Service created"
echo

# Step 11: Final Configuration
echo "=== Step 11: Final Configuration ==="
rc-update add vibecode default
echo

echo "═══════════════════════════════════════════════════════"
echo "  ✅ VibeCode Setup Complete!"
echo "═══════════════════════════════════════════════════════"
echo
echo "To start services:"
echo "  rc-service postgresql start"
echo "  rc-service redis start"
echo "  rc-service vibecode start"
echo
echo "To access VibeCode:"
echo "  http://localhost:3000"
echo
echo "To enable services on boot:"
echo "  rc-update add postgresql default"
echo "  rc-update add redis default"
echo "  rc-update add vibecode default"
echo
