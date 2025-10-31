#!/bin/bash
# MIT License - Setup Datadog monitoring for VibeCode

set -e

echo "🐶 Setting up Datadog monitoring for VibeCode..."
echo ""

# Create logs directory
mkdir -p /Users/ryan.maclean/vibecode-webgui/logs
echo "✅ Created logs directory"

# Copy Datadog configuration (requires sudo)
echo "📝 Installing Datadog configuration (requires sudo)..."
sudo mkdir -p /opt/datadog-agent/etc/conf.d/vibecode.d
sudo cp /Users/ryan.maclean/vibecode-webgui/datadog/vibecode-logs.yaml /opt/datadog-agent/etc/conf.d/vibecode.d/conf.yaml
echo "✅ Datadog configuration installed"

# Restart Datadog agent
echo "🔄 Restarting Datadog agent..."
sudo launchctl stop com.datadoghq.agent
sudo launchctl start com.datadoghq.agent
echo "✅ Datadog agent restarted"

echo ""
echo "🎉 Datadog monitoring setup complete!"
echo ""
echo "Logs will be written to: /Users/ryan.maclean/vibecode-webgui/logs/vibecode.log"
echo "View logs in Datadog: https://app.datadoghq.com/logs"
echo ""
echo "To test, run the VibeCode app and check:"
echo "  tail -f /Users/ryan.maclean/vibecode-webgui/logs/vibecode.log"


