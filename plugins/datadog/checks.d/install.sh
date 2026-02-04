#!/bin/bash
# Install Gas Town Datadog custom check
# Run with: sudo ./install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DD_CHECKS_DIR="/opt/datadog-agent/checks.d"
DD_CONF_DIR="/opt/datadog-agent/etc/conf.d"

echo "Installing Gas Town Datadog check..."

# Create checks directory if needed
mkdir -p "$DD_CHECKS_DIR"

# Copy check
cp "$SCRIPT_DIR/gastown.py" "$DD_CHECKS_DIR/gastown.py"
echo "✓ Installed gastown.py to $DD_CHECKS_DIR"

# Create conf directory if needed
mkdir -p "$DD_CONF_DIR/gastown.d"

# Copy config if not exists or if template is newer
if [[ ! -f "$DD_CONF_DIR/gastown.d/conf.yaml" ]] || [[ "$SCRIPT_DIR/conf.yaml.example" -nt "$DD_CONF_DIR/gastown.d/conf.yaml" ]]; then
    cp "$SCRIPT_DIR/conf.yaml.example" "$DD_CONF_DIR/gastown.d/conf.yaml"
    echo "✓ Installed conf.yaml to $DD_CONF_DIR/gastown.d"
else
    echo "⏭ conf.yaml already exists, skipping"
fi

# Set permissions
chmod 644 "$DD_CHECKS_DIR/gastown.py"
chmod 644 "$DD_CONF_DIR/gastown.d/conf.yaml"

echo ""
echo "Restarting Datadog agent..."
if [[ "$(uname)" == "Darwin" ]]; then
    launchctl stop com.datadoghq.agent 2>/dev/null || true
    sleep 2
    launchctl start com.datadoghq.agent
else
    systemctl restart datadog-agent
fi

echo ""
echo "✓ Installation complete!"
echo ""
echo "Verify with: datadog-agent check gastown"
