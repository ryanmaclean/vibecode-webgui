#!/bin/bash
# Securely extract and use Datadog API key without displaying it
# The key will NEVER be printed or logged

set -e

# Extract API key from Datadog agent config (without displaying it)
if [ -f /opt/datadog-agent/etc/datadog.yaml ]; then
    export DATADOG_API_KEY=$(grep '^api_key:' /opt/datadog-agent/etc/datadog.yaml | awk '{print $2}' | tr -d ' ')
    export DATADOG_SITE=$(grep '^site:' /opt/datadog-agent/etc/datadog.yaml | awk '{print $2}' | tr -d ' ')
elif [ -f /etc/datadog-agent/datadog.yaml ]; then
    export DATADOG_API_KEY=$(grep '^api_key:' /etc/datadog-agent/datadog.yaml | awk '{print $2}' | tr -d ' ')
    export DATADOG_SITE=$(grep '^site:' /etc/datadog-agent/datadog.yaml | awk '{print $2}' | tr -d ' ')
fi

# Fallback to datadoghq.com if site not found
export DATADOG_SITE="${DATADOG_SITE:-datadoghq.com}"

# Verify key exists (without displaying it)
if [ -z "$DATADOG_API_KEY" ]; then
    echo "❌ Error: Could not extract Datadog API key from agent config"
    exit 1
fi

# Show masked key for verification (only first 10 chars + ...)
MASKED_KEY="${DATADOG_API_KEY:0:10}..."
echo "✅ Datadog API key loaded securely: $MASKED_KEY"
echo "✅ Datadog site: $DATADOG_SITE"
echo ""

# Run the requested command with the secure key
"$@"

