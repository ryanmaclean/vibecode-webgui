#!/bin/sh
# Build/Install TINY Node.js 24 on Alpine ARM64 musl
# Uses Alpine's optimized musl build

set -e

echo "======================================================================"
echo "  Installing TINY Node.js 24 (musl ARM64)"
echo "======================================================================"
echo ""

# System info
echo "📊 System:"
uname -m
ldd --version 2>&1 | head -1 || echo "musl libc"
echo ""

# Install Node.js 24 from Alpine edge (has latest Node)
echo "📦 Installing Node.js 24..."
apk update
apk add --no-cache \
    nodejs \
    npm \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community

echo ""
echo "✅ Installed versions:"
node --version
npm --version
echo ""

# Verify it's using musl
echo "🔍 Verifying musl linkage:"
ldd $(which node) 2>&1 | head -5 || file $(which node)
echo ""

# Test Node.js performance
echo "🧪 Testing Node.js..."
node -e "console.log('✅ Node.js works!')"
node -e "console.log('Platform:', process.platform)"
node -e "console.log('Arch:', process.arch)"
node -e "console.log('V8:', process.versions.v8)"
echo ""

# Install common packages for tiny footprint
echo "📦 Installing minimal npm packages..."
npm install -g --production \
    pnpm \
    pm2

echo ""
echo "✅ Installed global packages:"
pnpm --version
pm2 --version
echo ""

# Configure npm for minimal disk usage
npm config set cache /tmp/npm-cache
npm config set prefer-offline true
npm config set audit false
npm config set fund false

# Show sizes
echo "💾 Installation sizes:"
du -sh /usr/lib/node_modules 2>/dev/null || echo "Node modules: minimal"
du -sh $(dirname $(which node))
echo ""

# Strip binaries
echo "🔪 Stripping Node.js binary..."
strip --strip-unneeded $(which node) 2>/dev/null || true
echo ""

echo "======================================================================"
echo "  ✅ Node.js 24 Installation Complete!"
echo "======================================================================"
echo ""
echo "Runtime: Node.js $(node --version)"
echo "Package Manager: pnpm $(pnpm --version)"
echo "Process Manager: pm2 $(pm2 --version)"
echo "C Library: musl ✅"
echo ""
echo "Test:"
echo "  node -e 'console.log(\"Hello from musl Node.js!\")'"
echo ""

# Show total sizes
echo "📊 Binary sizes:"
ls -lh $(which node) $(which npm) $(which pnpm) 2>/dev/null | awk '{print $9, $5}'
echo ""
echo "Total footprint:"
df -h / | tail -1

