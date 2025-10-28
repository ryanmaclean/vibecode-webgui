#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
DIST_DIR="$REPO_ROOT/dist"
APP_NAME="VibeCodeLima.app"
APP_DIR="$DIST_DIR/$APP_NAME"
LAUNCHER_BIN="$REPO_ROOT/swift/lima-launcher/.build/release/lima-launcher"
PROFILE_DIR="$HOME/Library/Application Support/VibeCodeLima"

log() {
  printf '[package-lima] %s\n' "$*"
}

log "Building lima-launcher (release)"
swift build -c release --package-path "$REPO_ROOT/swift/lima-launcher" >/dev/null

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"

cat > "$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>VibeCode Lima Kiosk</string>
  <key>CFBundleIdentifier</key>
  <string>com.vibecode.lima.kiosk</string>
  <key>CFBundleVersion</key>
  <string>1.0.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleExecutable</key>
  <string>VibeCodeLima</string>
</dict>
</plist>
PLIST

cat > "$APP_DIR/Contents/MacOS/VibeCodeLima" <<'LAUNCH'
#!/usr/bin/env bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES="$APP_ROOT/Resources"
export LIMA_LAUNCHER_BIN="$RESOURCES/lima-launcher"
export CHROMIUM_PROFILE_DIR="$HOME/Library/Application Support/VibeCodeLima/Profile"
export CODE_SERVER_VERSION="4.105.1"
"$RESOURCES/start-chromium-ide.sh"
LAUNCH
chmod +x "$APP_DIR/Contents/MacOS/VibeCodeLima"

cp "$REPO_ROOT/scripts/dev/start-chromium-ide.sh" "$APP_DIR/Contents/Resources/start-chromium-ide.sh"
chmod +x "$APP_DIR/Contents/Resources/start-chromium-ide.sh"
cp "$LAUNCHER_BIN" "$APP_DIR/Contents/Resources/lima-launcher"
chmod +x "$APP_DIR/Contents/Resources/lima-launcher"

log "Packaged $APP_NAME in $DIST_DIR"
