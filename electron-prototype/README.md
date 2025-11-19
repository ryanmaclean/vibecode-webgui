# VibeCode Electron Prototype

**Proof-of-concept Electron application embedding OpenVSCode Server for maximum rendering consistency.**

## Overview

This prototype demonstrates embedding a web-based VS Code instance (OpenVSCode Server) inside an Electron application. It serves as a "Plan B" alternative to Tauri if WebKit rendering issues prove too problematic.

### Key Features

- ✅ **Chromium Consistency**: Uses Electron's Chromium for 100% consistent rendering across platforms
- ✅ **Subprocess Management**: Launches VS Code Server as a managed subprocess
- ✅ **Security**: Implements proper context isolation and CSP policies
- ✅ **Cross-Platform**: Builds for macOS, Windows, and Linux
- ✅ **Mock Server**: Includes test server for development without VS Code Server

## Quick Start

### Prerequisites

- Node.js 18+ (for Electron)
- npm or yarn

### Installation

```bash
cd electron-prototype

# Install dependencies
npm install

# Run in development mode
npm start
```

### First Launch

On first launch, the app will use a **mock VS Code Server** that demonstrates the integration pattern. To use a real VS Code Server:

#### Option 1: Install code-server (Recommended)

```bash
# macOS
brew install code-server

# or via npm
npm install -g code-server
```

#### Option 2: Download OpenVSCode Server

```bash
# Download latest release (Linux build works via Rosetta on macOS)
curl -L https://github.com/gitpod-io/openvscode-server/releases/latest/download/openvscode-server-linux-x64.tar.gz | tar xz

# Move to vscode-server directory
mkdir -p vscode-server/bin
mv openvscode-server-*/bin/openvscode-server vscode-server/bin/

# Run the app
npm start
```

## Project Structure

```
electron-prototype/
├── main.js                  # Electron main process
├── preload.js               # Security bridge (IPC)
├── renderer.js              # Renderer process logic
├── index.html               # Main UI
├── styles.css               # UI styling
├── mock-vscode-server.js    # Mock server for testing
├── package.json             # Dependencies and build config
├── test-launch.sh           # Quick test script
├── README.md                # This file
└── BENCHMARK.md             # Performance benchmarks
```

## Development

### Running in Development

```bash
# With DevTools and logging
npm run dev

# Or standard development mode
npm start
```

### Building

```bash
# Build for current platform
npm run build

# Platform-specific builds
npm run build:mac     # macOS DMG and ZIP
npm run build:win     # Windows installer
npm run build:linux   # AppImage and deb
```

### Package (unsigned, for testing)

```bash
# Creates unpacked app in dist/
npm run package
```

## Architecture

### Process Flow

```
┌─────────────────────────────────────────────┐
│  Electron Main Process (main.js)            │
│  ├─ Window Management                       │
│  ├─ VS Code Server Subprocess               │
│  └─ IPC Handlers                             │
└─────────────────────────────────────────────┘
                    ↕ IPC
┌─────────────────────────────────────────────┐
│  Renderer Process (BrowserWindow)           │
│  ├─ Initial UI (index.html)                 │
│  ├─ Status Checking (renderer.js)           │
│  └─ VS Code Server View (after load)        │
└─────────────────────────────────────────────┘
                    ↕ HTTP
┌─────────────────────────────────────────────┐
│  VS Code Server (subprocess)                 │
│  ├─ HTTP Server (port 8081)                 │
│  ├─ Monaco Editor                            │
│  └─ VS Code Extensions                       │
└─────────────────────────────────────────────┘
```

### Security Model

- **Context Isolation**: Enabled (renderer can't access Node.js directly)
- **Node Integration**: Disabled
- **Preload Script**: Exposes only safe IPC APIs
- **CSP**: Restricts content sources
- **Process Separation**: Main process manages system resources

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run in development mode |
| `npm run dev` | Run with enhanced logging |
| `npm run build` | Build for current platform |
| `npm run build:mac` | Build macOS DMG/ZIP |
| `npm run build:win` | Build Windows installer |
| `npm run build:linux` | Build Linux AppImage/deb |
| `npm run package` | Create unpacked app (fast) |
| `npm run clean` | Remove dist and node_modules |

## Configuration

### Server Port

Default: `8081`. To change:

Edit `main.js`:
```javascript
let serverPort = 8081; // Change this
```

### Window Size

Edit `main.js` `createWindow()`:
```javascript
mainWindow = new BrowserWindow({
  width: 1400,  // Change these
  height: 900,
  // ...
});
```

### Build Configuration

Edit `package.json` `build` section for:
- App ID and product name
- Icon paths
- File inclusions/exclusions
- Platform-specific settings

## Troubleshooting

### "VS Code Server not running"

**Cause**: No VS Code Server binary found.

**Solutions**:
1. Install `code-server` via Homebrew or npm
2. Download OpenVSCode Server and place in `vscode-server/bin/`
3. Use the mock server (automatic fallback)

### Mock server doesn't load

**Check**:
```bash
node mock-vscode-server.js
```

Should show: `Server running at: http://127.0.0.1:8081`

### Build fails with signing errors

**Solution**: This is expected without a Developer ID. Unsigned builds work fine for local testing.

To distribute:
- Get Apple Developer ID (macOS)
- Get code signing certificate (Windows)
- Or use GitHub Actions with secrets

### Port already in use

**Solution**: Kill existing server:
```bash
lsof -ti:8081 | xargs kill -9
```

Or change port in `main.js`.

## Testing

### Manual Test Checklist

- [ ] App launches without errors
- [ ] Window appears with correct size
- [ ] Status indicator shows "Server Ready" (green dot)
- [ ] "Launch VS Code" button is enabled
- [ ] Clicking button loads VS Code interface
- [ ] VS Code UI renders correctly
- [ ] App closes cleanly (server stops)
- [ ] Logs show no errors

### Automated Tests

Run the test script:
```bash
./test-launch.sh
```

This will:
1. Launch the app
2. Display test instructions
3. Allow manual verification

## Performance Targets

See `BENCHMARK.md` for detailed metrics.

**Expected**:
- Cold start: < 3 seconds
- Memory usage: ~200-300 MB (idle)
- Bundle size: ~220-250 MB (packaged)

**Compare to**:
- Tauri: ~5-10 MB bundle, WebKit rendering issues
- VS Code: ~300-500 MB, feature-complete

## Integration with VibeCode

### Next Steps

1. **Add Rust Backend**: Integrate existing Tauri Rust commands via HTTP API
2. **Docker Integration**: Add Docker management UI
3. **VM Controls**: Lima VM start/stop/status
4. **Extension Management**: Pre-install workspace-rag and other extensions
5. **Settings Sync**: Persist user preferences
6. **Auto-Update**: Implement update checking

### Migration Path from Tauri

If Electron is chosen:

1. Port Tauri commands to HTTP/gRPC API
2. Create Electron IPC handlers
3. Update build scripts for Electron
4. Test on all platforms
5. Migrate CI/CD pipelines
6. Update documentation

## Known Issues

- [ ] OpenVSCode Server doesn't have official macOS ARM builds (use Linux build via Rosetta)
- [ ] Bundle size is ~40x larger than Tauri (trade-off for consistency)
- [ ] Memory usage higher than native apps
- [ ] No native performance benefits (all JavaScript/Chromium)

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server)
- [code-server](https://github.com/coder/code-server)
- [electron-builder](https://www.electron.build/)

## License

MIT

## Support

For issues or questions:
1. Check `BENCHMARK.md` for performance analysis
2. Review logs in DevTools (F12)
3. Check server logs in terminal
4. See main VibeCode repo documentation

---

**Status**: ✅ Functional POC
**Last Updated**: November 2024
**Version**: 1.0.0
