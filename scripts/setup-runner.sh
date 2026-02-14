#!/usr/bin/env bash
# Setup self-hosted GitHub Actions runner for VM testing
# Target: AMD Ryzen 9 5950x/7950x, 128GB RAM, Linux
#
# This script prepares a Linux workstation to run VibeCode VM integration tests
# as a self-hosted GitHub Actions runner with QEMU/KVM support.

set -euo pipefail

echo "=== VibeCode Self-Hosted Runner Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "ERROR: Do not run this script as root. It will use sudo when needed."
  exit 1
fi

# Step 1: Install QEMU/KVM
echo "Step 1: Installing QEMU/KVM packages..."
sudo apt-get update
sudo apt-get install -y \
  qemu-system-x86 \
  qemu-system-aarch64 \
  qemu-utils \
  qemu-efi-aarch64 \
  ovmf \
  libvirt-daemon-system \
  bridge-utils \
  cpu-checker

echo ""
echo "Step 2: Verifying KVM support..."

# Check CPU virtualization support
if kvm-ok; then
  echo "CPU virtualization: OK"
else
  echo "WARNING: CPU virtualization not fully supported"
  echo "Enable AMD-V/SVM in BIOS settings"
fi

# Check KVM device
if [ -e /dev/kvm ]; then
  echo "KVM acceleration: OK"
  echo "Adding $USER to kvm group..."
  sudo usermod -aG kvm "$USER"
  echo "Added. Log out and back in for group membership to take effect."
else
  echo "WARNING: /dev/kvm not available"
  echo "Enable virtualization in BIOS (AMD-V/SVM)"
fi

# Check QEMU versions
echo ""
echo "Installed QEMU versions:"
qemu-system-x86_64 --version | head -1
qemu-system-aarch64 --version | head -1

# Step 3: Install GitHub Actions runner
echo ""
echo "Step 3: Setting up GitHub Actions runner..."

RUNNER_VERSION="2.314.1"
RUNNER_DIR="/opt/actions-runner"

if [ -d "$RUNNER_DIR" ]; then
  echo "WARNING: $RUNNER_DIR already exists. Skipping download."
else
  echo "Creating $RUNNER_DIR..."
  sudo mkdir -p "$RUNNER_DIR"
  sudo chown "$USER:$USER" "$RUNNER_DIR"

  cd "$RUNNER_DIR"

  echo "Downloading GitHub Actions runner v${RUNNER_VERSION}..."
  curl -sL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" | tar xz

  echo "Runner files extracted to $RUNNER_DIR"
fi

# Step 4: Print next steps
echo ""
echo "=========================================="
echo "Setup complete! Next steps:"
echo "=========================================="
echo ""
echo "1. Get a runner registration token:"
echo "   Visit: https://github.com/ryanmaclean/vibecode-webgui/settings/actions/runners/new"
echo ""
echo "2. Configure the runner:"
echo "   cd $RUNNER_DIR"
echo "   ./config.sh --url https://github.com/ryanmaclean/vibecode-webgui \\"
echo "               --token <YOUR_TOKEN> \\"
echo "               --labels 'self-hosted,linux,x64,vm-testing,qemu-kvm'"
echo ""
echo "3. Install and start the runner service:"
echo "   sudo ./svc.sh install"
echo "   sudo ./svc.sh start"
echo ""
echo "4. Verify the runner is online:"
echo "   Visit: https://github.com/ryanmaclean/vibecode-webgui/settings/actions/runners"
echo ""
echo "IMPORTANT: Log out and back in for KVM group membership to take effect!"
echo "=========================================="
