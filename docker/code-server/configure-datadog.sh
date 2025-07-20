#!/bin/bash
set -e

# Create Datadog configuration directory
mkdir -p /home/coder/workspace/.datadog/templates

# 1. Datadog Agent Configuration
cat > /home/coder/workspace/.datadog/templates/agent-config.yaml << 'EOL'
# Datadog Agent Configuration
api_key: ${DD_API_KEY:-"your_api_key_here"}
site: ${DD_SITE:-"datadoghq.com"}

# Enable APM
apm_config:
  enabled: true
  env: ${DD_ENV:-"development"}
  apm_non_local_traffic: true

# Logs configuration
logs_enabled: true

# Process monitoring
process_config:
  enabled: true
  process_collection:
    enabled: true
  container_collection:
    enabled: true

tags:
  - env:${DD_ENV:-"development"}
  - service:${DD_SERVICE:-"vibecode"}
  - version:${DD_VERSION:-"1.0.0"}
EOL

# 2. Datadog CI Configuration
cat > /home/coder/workspace/.datadog/templates/datadog-ci.json << 'EOL'
{
  "apiKey": "${DD_API_KEY}",
  "appKey": "${DD_APP_KEY}",
  "site": "${DD_SITE:-"datadoghq.com"}",
  "env": "${DD_ENV:-"development"}",
  "service": "${DD_SERVICE:-"vibecode"}",
  "version": "${DD_VERSION:-"1.0.0"}"
}
EOL

# 3. Vector Configuration
cat > /home/coder/workspace/.datadog/templates/vector.toml << 'EOL'
[api]
enabled = true

[sources.logs]
type = "file"
include = [
  "/var/log/**/*.log",
  "/home/coder/workspace/logs/*.log"
]

[sinks.datadog_logs]
inputs = ["logs"]
type = "datadog_logs"
endpoint = "https://http-intake.logs.datadoghq.com"
api_key = "${DD_API_KEY}"
compression = "gzip"
EOL

# 4. Create a script to verify installations
cat > /home/coder/workspace/verify-datadog-tools.sh << 'EOL'
#!/bin/bash
set -e

echo "=== Verifying Datadog Tools ==="

# Check Datadog Agent
if command -v datadog-agent &> /dev/null; then
  echo "✅ Datadog Agent is installed"
  datadog-agent version
else
  echo "❌ Datadog Agent is not installed"
fi

# Check Datadog CLI
if command -v dd-scm &> /dev/null; then
  echo -e "\n✅ Datadog CLI is installed"
  dd-scm --version
else
  echo -e "\n❌ Datadog CLI is not installed"
fi

# Check Vector
if command -v vector &> /dev/null; then
  echo -e "\n✅ Vector is installed"
  vector --version
else
  echo -e "\n❌ Vector is not installed"
fi

# Check KubeHound
if command -v kubehound &> /dev/null; then
  echo -e "\n✅ KubeHound is installed"
  kubehound version
else
  echo -e "\n❌ KubeHound is not installed"
fi

# Check Stratus Red Team
if command -v stratus &> /dev/null; then
  echo -e "\n✅ Stratus Red Team is installed"
  stratus version
else
  echo -e "\n❌ Stratus Red Team is not installed"
fi

echo -e "\n=== Verification Complete ==="
EOL

# Make scripts executable
chmod +x /home/coder/workspace/verify-datadog-tools.sh

# Create a README file with instructions
cat > /home/coder/workspace/.datadog/README.md << 'EOL'
# Datadog Tools Configuration

This directory contains configuration templates for various Datadog tools.

## Available Tools

1. **Datadog Agent**
   - Configuration: `.datadog/templates/agent-config.yaml`
   - Documentation: [Datadog Agent Docs](https://docs.datadoghq.com/agent/)

2. **Datadog CI**
   - Configuration: `.datadog/templates/datadog-ci.json`
   - Documentation: [Datadog CI Docs](https://docs.datadoghq.com/continuous_integration/)

3. **Vector** (Log Collection)
   - Configuration: `.datadog/templates/vector.toml`
   - Documentation: [Vector Docs](https://vector.dev/docs/)

4. **KubeHound** (Kubernetes Security)
   - Documentation: [KubeHound Docs](https://github.com/DataDog/kubehound)

5. **Stratus Red Team** (Security Testing)
   - Documentation: [Stratus Red Team Docs](https://stratus-red-team.cloud/)

## Verification

Run the verification script to check all tools:

```bash
./verify-datadog-tools.sh
```

## Environment Variables

Set these in your environment or `.env` file:

```bash
# Required for Datadog
DD_API_KEY=your_api_key_here
DD_APP_KEY=your_app_key_here
DD_SITE=datadoghq.com

# Optional
DD_ENV=development
DD_SERVICE=vibecode
DD_VERSION=1.0.0
```
EOL

echo "✅ Datadog tools configuration complete"
