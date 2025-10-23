#!/bin/sh
# Automates Lima VM provisioning and Vibecode smoke tests

set -e

VM_NAME="vibecode-dev"
CONFIG_PATH="infrastructure/lima/vibecode-dev.yaml"

if ! command -v limactl >/dev/null 2>&1; then
    echo "limactl not found. Install Lima: https://github.com/lima-vm/lima" >&2
    exit 1
fi

if [ ! -f "$CONFIG_PATH" ]; then
    echo "Lima config missing: $CONFIG_PATH" >&2
    exit 1
fi

echo "=== Starting Lima VM ($VM_NAME) ==="
if ! limactl list | grep -q "^$VM_NAME"; then
    limactl start "$CONFIG_PATH" --name "$VM_NAME"
else
    limactl start "$VM_NAME" >/dev/null 2>&1 || true
fi

echo "=== Syncing project files ==="
limactl shell "$VM_NAME" sudo mkdir -p /workspace
limactl shell "$VM_NAME" sudo chown -R ubuntu:ubuntu /workspace
limactl shell "$VM_NAME" mkdir -p /workspace/vibecode
rsync -az --delete --exclude node_modules --exclude .git ./ "$VM_NAME:/workspace/vibecode"

echo "=== Installing dependencies inside VM ==="
limactl shell "$VM_NAME" bash -lc 'cd /workspace/vibecode && npm install'

echo "=== Running lint + type-check inside VM ==="
limactl shell "$VM_NAME" bash -lc 'cd /workspace/vibecode && npm run check'

echo "=== Listing Playwright suites inside VM ==="
limactl shell "$VM_NAME" bash -lc 'cd /workspace/vibecode && npx playwright test --list'

echo "=== Lima automation complete ==="

