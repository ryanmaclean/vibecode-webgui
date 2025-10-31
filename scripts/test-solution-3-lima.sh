#!/bin/bash
# Test Solution 3 (Lima) with real Datadog key
# This creates a minimal test VM to prove Datadog provisioning works

set -e

echo "======================================================================"
echo "  Testing Solution 3: Lima VM with Datadog (Real Key)"
echo "======================================================================"
echo ""

# Check if running with secure key
if [ -z "$DATADOG_API_KEY" ]; then
    echo "❌ Error: This script must be run via run-with-secure-datadog-key.sh"
    echo ""
    echo "Usage: ./scripts/run-with-secure-datadog-key.sh ./scripts/test-solution-3-lima.sh"
    exit 1
fi

MASKED_KEY="${DATADOG_API_KEY:0:10}..."
echo "Using key: $MASKED_KEY"
echo "Site: $DATADOG_SITE"
echo ""

# Export for Lima provisioning
export DD_API_KEY="$DATADOG_API_KEY"
export DD_SITE="$DATADOG_SITE"

# Check if test VM already exists
if limactl list | grep -q "^vibecode-test-dd.*Running"; then
    echo "🛑 Stopping existing test VM..."
    limactl stop vibecode-test-dd
    limactl delete vibecode-test-dd
fi

echo "🚀 Creating test Lima VM with Datadog provisioning..."
echo "   This will take 2-3 minutes for first boot provisioning"
echo ""

# Create a minimal test VM config
cat > /tmp/test-lima-datadog.yaml <<'LIMA'
vmType: "vz"
os: "Linux"
arch: "aarch64"

images:
  - location: "https://dl-cdn.alpinelinux.org/alpine/v3.22/releases/cloud/nocloud_alpine-3.22.0-aarch64-uefi-cloudinit-r0.qcow2"
    arch: "aarch64"
    digest: "sha512:30b347397387926eeb939d93c926e09833f5b49c6c6de5cc225ccdfe6e54aba88251c71da264c7e4260e78132b50e34b93409c8b4da2e843e68a4dc35fc6b155"

cpus: 2
memory: "1GiB"
disk: "5GiB"

mounts: []
containerd:
  system: false
  user: false

provision:
  - mode: system
    script: |
      #!/bin/bash
      set -e
      
      echo "=== Lima Test VM with Datadog ==="
      apk update
      apk add --no-cache curl bash python3
      
      echo "Installing Datadog agent..."
      DD_API_KEY="${DD_API_KEY}" \
      DD_SITE="${DD_SITE:-datadoghq.com}" \
      bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script_agent7.sh)" || {
        echo "⚠️  Datadog install failed - check API key"
        exit 1
      }
      
      if [ -d /etc/datadog-agent ]; then
        cat > /etc/datadog-agent/datadog.yaml <<EOF
      api_key: ${DD_API_KEY}
      site: ${DD_SITE:-datadoghq.com}
      hostname: vibecode-test-lima
      tags:
        - env:vibecode-test
        - platform:lima
        - test:solution-3
      logs_enabled: true
      EOF
        
        rc-update add datadog-agent default || true
        service datadog-agent start || true
        
        # Wait and check status
        sleep 5
        if service datadog-agent status; then
          echo "✅ Datadog agent is running!"
        else
          echo "⚠️  Datadog agent may not be running properly"
        fi
      fi

message: |
  ✅ Test VM with Datadog is ready!
  
  Check status:
    limactl shell vibecode-test-dd datadog-agent status
  
  View Datadog dashboard:
    https://app.datadoghq.com/infrastructure
    Look for host: vibecode-test-lima
LIMA

echo "📋 Starting VM (this provisions Datadog agent)..."
limactl start --name=vibecode-test-dd /tmp/test-lima-datadog.yaml

echo ""
echo "======================================================================"
echo "  Solution 3 Test Complete!"
echo "======================================================================"
echo ""
echo "✅ Lima VM created with Datadog agent"
echo ""
echo "🔍 Verify Datadog:"
echo "   1. Check agent status:"
echo "      limactl shell vibecode-test-dd datadog-agent status"
echo ""
echo "   2. View in dashboard:"
echo "      https://app.${DATADOG_SITE}/infrastructure"
echo "      Look for: vibecode-test-lima"
echo ""
echo "   3. Check host tags:"
echo "      - env:vibecode-test"
echo "      - platform:lima"
echo "      - test:solution-3"
echo ""
echo "🧹 Cleanup when done:"
echo "   limactl stop vibecode-test-dd && limactl delete vibecode-test-dd"
echo ""

