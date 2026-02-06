#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Agent 9: Monitoring & Observability Setup

# Initialize log aggregation
init_log_aggregation

set -e

echo "=== Agent 9: Creating Monitoring Setup ==="

mkdir -p scripts/vz config/datadog

# Datadog setup script
cat > scripts/vz/setup-datadog-vm.sh << 'SCRIPTEOF'
#!/bin/bash
# Setup Datadog Monitoring in VM
set -e

DD_API_KEY="${DD_API_KEY:-}"
DD_SITE="${DD_SITE:-datadoghq.com}"

echo "=== Datadog Setup for OpenClaw VM ==="

if [ -z "$DD_API_KEY" ]; then
    echo "⚠️  DD_API_KEY not set"
    echo "Get from: https://app.datadoghq.com/organization-settings/api-keys"
    exit 1
fi

# Install Datadog agent
echo "Installing Datadog agent..."
DD_API_KEY="$DD_API_KEY" DD_SITE="$DD_SITE" DD_INSTALL_ONLY=true bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)"

# Configure dd-trace for OpenClaw
echo "Configuring dd-trace..."
export DD_SERVICE=openclaw
export DD_ENV=production
export DD_VERSION=$(openclaw --version 2>&1 | head -1)

# Update OpenClaw launchd to use dd-trace
cat > ~/Library/LaunchAgents/ai.openclaw.mac.plist << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>EnvironmentVariables</key>
    <dict>
        <key>DD_SERVICE</key>
        <string>openclaw</string>
        <key>DD_ENV</key>
        <string>production</string>
    </dict>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>--require</string>
        <string>dd-trace/init</string>
        <string>/opt/homebrew/bin/openclaw</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
PLISTEOF

echo "✅ Datadog configured"
SCRIPTEOF

# Dashboard config
cat > config/datadog/openclaw-dashboard.json << 'DASHBOARDEOF'
{
  "title": "OpenClaw Gateway Dashboard",
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "requests": [{
          "q": "avg:openclaw.gateway.requests{*}"
        }],
        "title": "Gateway Requests"
      }
    },
    {
      "definition": {
        "type": "query_value",
        "requests": [{
          "q": "avg:openclaw.gateway.health{*}"
        }],
        "title": "Gateway Health"
      }
    }
  ]
}
DASHBOARDEOF

chmod +x scripts/vz/setup-datadog-vm.sh
echo "✅ Monitoring setup scripts created"
