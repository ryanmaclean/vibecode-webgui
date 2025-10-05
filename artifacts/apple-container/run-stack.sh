#!/bin/bash
# Run VibeCode stack on Apple Container

set -e

echo "=== VibeCode Apple Container Stack ==="
echo ""

# Check if DD_API_KEY is set
if [[ -z "$DD_API_KEY" ]]; then
  echo "⚠️  Warning: DD_API_KEY not set. Datadog monitoring will not work."
  echo "   Export it: export DD_API_KEY=your_key_here"
  echo ""
fi

# Create volume
echo "Creating volume..."
container volume create vibecode-data || true

# Start code-server
echo "Starting code-server..."
container run -d \
  --name vibecode-code-server \
  -p 8080:8080 \
  -e PASSWORD="${CODE_SERVER_PASSWORD:-vibecode123}" \
  -v vibecode-data:/home/coder \
  codercom/code-server:latest

echo "✅ code-server started on http://localhost:8080"
echo "   Password: ${CODE_SERVER_PASSWORD:-vibecode123}"
echo ""

# Start Datadog agent if API key is set
if [[ -n "$DD_API_KEY" ]]; then
  echo "Starting Datadog agent..."
  container run -d \
    --name vibecode-datadog \
    -p 8126:8126 \
    -e DD_API_KEY="$DD_API_KEY" \
    -e DD_SITE="${DD_SITE:-datadoghq.com}" \
    -e DD_HOSTNAME="${HOSTNAME:-vibecode-macos}" \
    -e DD_TAGS="platform:macos,runtime:apple_container,service:vibecode" \
    -e DD_APM_ENABLED=true \
    -e DD_LOGS_ENABLED=true \
    datadog/agent:latest
  
  echo "✅ Datadog agent started"
  echo ""
fi

echo "=== Stack Running ==="
echo ""
container list
echo ""
echo "View logs: container logs vibecode-code-server"
echo "Stop stack: container stop vibecode-code-server vibecode-datadog"
