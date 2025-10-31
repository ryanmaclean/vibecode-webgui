#!/bin/bash
# Experiment 2: Prepare SSH Infrastructure
# Agent 4: SSH & Security Engineer - Prep Work

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=================================="
echo "SSH Infrastructure Setup"
echo "=================================="
echo ""

# Create SSH directory
mkdir -p "$HOME/.ssh/vibecode"

# Generate SSH key if not exists
if [ ! -f "$HOME/.ssh/vibecode/id_ed25519" ]; then
    echo "[1/5] Generating SSH key..."
    ssh-keygen -t ed25519 -f "$HOME/.ssh/vibecode/id_ed25519" -N "" -C "vibecode-vm-access"
    echo "  ✅ SSH key generated"
else
    echo "[1/5] SSH key already exists"
fi

# Create cloud-init template
echo ""
echo "[2/5] Creating cloud-init SSH template..."
PUBKEY=$(cat "$HOME/.ssh/vibecode/id_ed25519.pub")

cat > "$PROJECT_ROOT/config/cloud-init/ssh-user-data.yaml" << CLOUDEOF
#cloud-config

# SSH Configuration for VibeCode VMs
users:
  - name: vibecode
    groups: wheel
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/ash
    ssh_authorized_keys:
      - $PUBKEY

# Install and configure SSH
packages:
  - openssh
  - openssh-server

runcmd:
  - rc-update add sshd default
  - rc-service sshd start
  - echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
  - echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
  - rc-service sshd restart
CLOUDEOF

echo "  ✅ Cloud-init template created"

# Create SSH config
echo ""
echo "[3/5] Creating SSH config..."
cat > "$HOME/.ssh/vibecode/config" << SSHEOF
# VibeCode VM SSH Configuration

Host vibecode-*
    User vibecode
    IdentityFile ~/.ssh/vibecode/id_ed25519
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel ERROR

# Specific VM hosts (update IPs after boot)
Host vibecode-postgresql
    HostName 192.168.64.2

Host vibecode-valkey
    HostName 192.168.64.3

Host vibecode-nodejs
    HostName 192.168.64.4

Host vibecode-codeserver
    HostName 192.168.64.5

Host vibecode-ide
    HostName 192.168.64.6

Host vibecode-pgvector
    HostName 192.168.64.7
SSHEOF

echo "  ✅ SSH config created"

# Create test script
echo ""
echo "[4/5] Creating SSH test script..."
cat > "$SCRIPT_DIR/test-vm-ssh.sh" << 'TESTEOF'
#!/bin/bash
# Test SSH connectivity to VMs

echo "Testing SSH to all VMs..."
echo ""

for vm in postgresql valkey nodejs codeserver ide pgvector; do
    echo -n "Testing vibecode-$vm... "
    if ssh -F ~/.ssh/vibecode/config -o ConnectTimeout=2 "vibecode-$vm" "hostname" 2>/dev/null; then
        echo "✅ Connected"
    else
        echo "❌ Not accessible"
    fi
done
TESTEOF

chmod +x "$SCRIPT_DIR/test-vm-ssh.sh"
echo "  ✅ SSH test script created"

# Create rebuild script with SSH
echo ""
echo "[5/5] Creating VM rebuild script with SSH..."
cat > "$SCRIPT_DIR/rebuild-vms-with-ssh.sh" << 'REBUILDEOF'
#!/bin/bash
# Rebuild VMs with SSH pre-configured
# Uses cloud-init to inject SSH keys

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Rebuilding VMs with SSH configuration..."
echo ""

# This would use the cloud-init/ssh-user-data.yaml
# Combined with build-vz-vms-with-datadog.sh approach

echo "Not yet implemented - requires VM rebuild workflow"
echo "See: config/cloud-init/ssh-user-data.yaml"
REBUILDEOF

chmod +x "$SCRIPT_DIR/rebuild-vms-with-ssh.sh"
echo "  ✅ Rebuild script template created"

echo ""
echo "=================================="
echo "SSH Infrastructure Ready"
echo "=================================="
echo ""
echo "Created:"
echo "  - SSH keys: ~/.ssh/vibecode/id_ed25519"
echo "  - Cloud-init: config/cloud-init/ssh-user-data.yaml"
echo "  - SSH config: ~/.ssh/vibecode/config"
echo "  - Test script: scripts/test-vm-ssh.sh"
echo "  - Rebuild script: scripts/rebuild-vms-with-ssh.sh"
echo ""
echo "To use:"
echo "  1. Rebuild VMs with SSH cloud-init"
echo "  2. Update SSH config with actual IPs"
echo "  3. Run: ./scripts/test-vm-ssh.sh"
echo ""
echo "Or connect directly:"
echo "  ssh -F ~/.ssh/vibecode/config vibecode-postgresql"

