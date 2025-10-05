#!/bin/bash
set -e

echo "📦 Installing VibeCode VM for macOS..."

# Download kernel components
./scripts/macos-vm/download-kernel.sh

# Build the binary
./scripts/macos-vm/build.sh

# Create launchd plist for auto-start (optional)
PLIST="$HOME/Library/LaunchAgents/com.vibecode.vm.plist"
mkdir -p "$(dirname "$PLIST")"

cat > "$PLIST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.vibecode.vm</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(pwd)/bin/vibecode-vm</string>
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$HOME/.vibecode/vm/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/.vibecode/vm/stderr.log</string>
</dict>
</plist>
EOF

echo "✅ Installation complete!"
echo ""
echo "🚀 Usage:"
echo "   Manual:    ./bin/vibecode-vm"
echo "   Service:   launchctl load $PLIST"
echo "              launchctl start com.vibecode.vm"
echo ""
echo "🛑 Stop service:"
echo "   launchctl stop com.vibecode.vm"
echo "   launchctl unload $PLIST"
