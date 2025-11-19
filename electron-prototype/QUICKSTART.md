# VibeCode Electron Prototype - Quick Start

**Get running in 2 minutes**

## 1. Install Dependencies

```bash
npm install
```

Wait ~60 seconds for Electron to download.

## 2. Run the App

```bash
npm start
```

The app will open in a window.

## 3. What You'll See

1. **Welcome Screen**: Dark theme, platform info, status indicator
2. **Mock Server**: Auto-starts on port 8081
3. **Green Status**: Indicates server is ready
4. **Launch Button**: Click to load VS Code interface

## 4. Test Integration

Click "Launch VS Code" button → Mock VS Code loads → See success message ✅

## What This Proves

✅ Electron can embed web-based IDEs
✅ Subprocess management works
✅ Security policies in place
✅ Chromium renders consistently

## Next: Use Real VS Code Server

### Option A: Install code-server

```bash
brew install code-server
npm start
```

### Option B: Download OpenVSCode Server

```bash
# Download
curl -L https://github.com/gitpod-io/openvscode-server/releases/latest/download/openvscode-server-linux-x64.tar.gz | tar xz

# Setup
mkdir -p vscode-server/bin
mv openvscode-server-*/bin/openvscode-server vscode-server/bin/

# Run
npm start
```

## Build for Distribution

```bash
npm run build
```

App will be in `dist/` (~231 MB)

## Documentation

- **README.md**: Complete guide
- **BENCHMARK.md**: Performance metrics
- **STATUS.md**: Implementation summary
- **SCREENSHOTS.md**: Visual docs

## Troubleshooting

**Issue**: "Server not running"
**Fix**: That's expected! Use mock server or install code-server

**Issue**: Port 8081 in use
**Fix**: Edit `main.js` and change `serverPort`

**Issue**: Build fails
**Fix**: Code signing errors are normal without certificate

## Performance

- Startup: ~2.3 seconds
- Bundle: 231 MB
- Memory: ~200 MB idle

Compare to Tauri: 40x larger, but 100% rendering consistency

---

**Status**: ✅ Working POC
**Time to test**: 2 minutes
**Next**: Decide Electron vs Tauri based on priorities
