#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# MIT License - Setup IDE VM with openvscode-server

# Initialize log aggregation
init_log_aggregation


set -e

echo "🚀 Setting up IDE VM with OpenVSCode Server..."
echo ""

# Start VM
limactl start vibecode-nodejs

# Install openvscode-server
echo "📦 Installing OpenVSCode Server..."
limactl shell vibecode-nodejs sudo apk add --no-cache wget tar

limactl shell vibecode-nodejs 'cd /tmp && wget -q https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v1.95.3/openvscode-server-v1.95.3-linux-alpine-arm64.tar.gz && tar xzf openvscode-server-v1.95.3-linux-alpine-arm64.tar.gz && sudo mv openvscode-server-v1.95.3-linux-alpine-arm64 /opt/openvscode-server'

# Create startup script
limactl shell vibecode-nodejs 'cat > /tmp/start-ide.sh << "EOF"
#!/bin/sh
/opt/openvscode-server/bin/openvscode-server --host 0.0.0.0 --port 8080 --without-connection-token
EOF'

limactl shell vibecode-nodejs 'sudo mv /tmp/start-ide.sh /usr/local/bin/start-ide && sudo chmod +x /usr/local/bin/start-ide'

# Start the IDE
echo "🚀 Starting OpenVSCode Server..."
limactl shell vibecode-nodejs 'nohup /usr/local/bin/start-ide > /tmp/openvscode.log 2>&1 &'

sleep 5

# Test it
echo ""
echo "✅ Testing IDE..."
limactl shell vibecode-nodejs 'curl -s http://localhost:8080' | head -10

echo ""
echo "🎉 SUCCESS! OpenVSCode Server running in VM!"
echo ""
echo "Access at: http://127.0.0.1:8080"
echo ""

# Save the disk image
echo "💾 Saving VM disk image for distribution..."
limactl stop vibecode-nodejs
sleep 3

mkdir -p /Users/ryan.maclean/vibecode-webgui/dist/vm-images
cp ~/.lima/vibecode-nodejs/diffdisk /Users/ryan.maclean/vibecode-webgui/dist/vm-images/vibecode-ide.img
cp ~/.lima/vibecode-nodejs/vz-efi /Users/ryan.maclean/vibecode-webgui/dist/vm-images/vibecode-ide-efi.nvram

echo "✅ VM image saved!"
ls -lh /Users/ryan.maclean/vibecode-webgui/dist/vm-images/vibecode-ide*

echo ""
echo "🎯 Now boot with Swift launcher:"
echo "   dist/vibecode-vm vibecode-ide"

