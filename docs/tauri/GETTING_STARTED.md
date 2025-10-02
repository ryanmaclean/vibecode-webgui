# Getting Started with Tauri Development

This guide will help you set up your environment, build, and run the VibeCode desktop application.

## Prerequisites

### Required Software

#### All Platforms

- **Node.js**: v18.18.0 or higher
- **npm**: v9.0.0 or higher
- **Rust**: v1.70 or higher
- **Tauri CLI**: Latest version
- **Git**: For source control

#### macOS Specific

- **Xcode Command Line Tools**: Required for Rust compilation
- **Xcode**: Recommended for full development (v14+)
- **Developer ID Certificate**: For code signing (release builds only)

#### Windows Specific (Future)

- **Microsoft Visual C++ Build Tools**: Required for Rust
- **WebView2**: Usually pre-installed on Windows 10+
- **Code Signing Certificate**: For release builds

#### Linux Specific (Future)

- **WebKitGTK**: System webview
- **Build dependencies**: gcc, pkg-config, libssl-dev

### System Requirements

**Development**:
- RAM: 8GB minimum, 16GB recommended
- Disk: 5GB free space for dependencies and builds
- macOS: 10.13 (High Sierra) or later
- Processor: Intel or Apple Silicon

**Runtime**:
- RAM: 2GB minimum
- Disk: 200MB for application
- Same OS requirements as development

## Installation

### Step 1: Install System Dependencies

#### macOS

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Verify installation
xcode-select -p
# Expected output: /Library/Developer/CommandLineTools
```

#### Rust Installation

```bash
# Install Rust via rustup (all platforms)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Follow prompts to complete installation
# Source the environment (or restart shell)
source $HOME/.cargo/env

# Verify installation
rustc --version
cargo --version
```

Expected output:
```
rustc 1.75.0 (or higher)
cargo 1.75.0 (or higher)
```

### Step 2: Install Tauri CLI

```bash
# Install Tauri CLI via cargo
cargo install tauri-cli

# Verify installation
cargo tauri --version
```

Expected output:
```
tauri-cli 2.x.x
```

Alternatively, use the npm package (if preferred):
```bash
npm install -g @tauri-apps/cli
```

### Step 3: Clone and Setup Repository

```bash
# Clone repository
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Install Node.js dependencies
npm install

# This will also run postinstall scripts
```

### Step 4: Verify Docker (Optional but Recommended)

The application includes Docker integration features:

```bash
# Check if Docker is installed
docker --version

# Check if Docker daemon is running
docker ps
```

If Docker is not installed:
- **macOS**: Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
- **Windows**: Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- **Linux**: Follow [Docker Engine installation](https://docs.docker.com/engine/install/)

## Development

### Running in Development Mode

Development mode provides hot-reload for both frontend and backend changes.

#### Option 1: Separate Terminal Approach (Recommended)

**Terminal 1**: Start Next.js dev server
```bash
npm run dev
```

Wait for Next.js to be ready (you'll see "Ready" in the terminal).

**Terminal 2**: Start Tauri dev window
```bash
cd src-tauri
cargo tauri dev
```

#### Option 2: Single Command (Automated)

```bash
cargo tauri dev
```

This will:
1. Automatically start the Next.js dev server
2. Wait for it to be ready
3. Launch the Tauri window

### Development Features

**Automatic DevTools**: In debug mode, Chrome DevTools opens automatically for debugging the frontend.

**Hot Reload**:
- Frontend changes (React, CSS) reload automatically
- Backend changes (Rust) require stopping and restarting `cargo tauri dev`

**Console Access**:
- Frontend logs appear in DevTools console
- Backend logs appear in terminal running `cargo tauri dev`

### Project Structure

```
vibecode-webgui/
├── src/                    # Next.js frontend source
│   ├── app/               # App router pages
│   ├── components/        # React components
│   └── lib/              # Utilities and libraries
├── src-tauri/             # Tauri backend
│   ├── src/
│   │   ├── main.rs       # Application entry point
│   │   ├── commands.rs   # Tauri command handlers
│   │   └── docker.rs     # Docker integration
│   ├── icons/            # Application icons
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
├── out/                   # Next.js static export (generated)
└── package.json          # Node.js dependencies
```

## Building for Production

### Step 1: Build Next.js

The Tauri app requires a static export of the Next.js application:

```bash
# Build and export Next.js
npm run build:export
```

This creates a static site in the `out/` directory.

**Important**: Ensure your Next.js configuration supports static export:
- No server-side rendering (SSR) features
- No API routes that require Node.js runtime
- All dynamic routes pre-rendered at build time

### Step 2: Build Tauri Application

```bash
cd src-tauri
cargo tauri build
```

This will:
1. Compile Rust code in release mode
2. Bundle the Next.js frontend
3. Create platform-specific bundles
4. Generate installers (DMG on macOS)

**Build Output** (macOS):
```
src-tauri/target/release/
├── bundle/
│   ├── dmg/
│   │   └── VibeCode_0.1.0_universal.dmg
│   └── macos/
│       └── VibeCode.app
└── vibecode               # Executable binary
```

### Step 3: Test the Build

```bash
# Run the production build
./src-tauri/target/release/vibecode

# Or open the .app bundle
open src-tauri/target/release/bundle/macos/VibeCode.app
```

## Configuration

### Tauri Configuration

Edit `src-tauri/tauri.conf.json`:

```json
{
  "productName": "VibeCode",
  "version": "0.1.0",
  "identifier": "com.vibecode.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build:export",
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000"
  },
  "app": {
    "windows": [
      {
        "title": "VibeCode",
        "width": 1400,
        "height": 900,
        "resizable": true
      }
    ]
  }
}
```

Key configuration options:

- `beforeDevCommand`: Command to start dev server
- `beforeBuildCommand`: Command to build frontend
- `frontendDist`: Path to static frontend build
- `devUrl`: URL of dev server
- `windows`: Default window configuration

### Environment Variables

Create `.env` file in project root:

```bash
# Next.js configuration
NEXT_PUBLIC_APP_MODE=desktop
NEXT_PUBLIC_TAURI_ENABLED=true

# API endpoints (if needed)
NEXT_PUBLIC_API_URL=http://localhost:3000

# Feature flags
NEXT_PUBLIC_DOCKER_INTEGRATION=true
```

### Icon Configuration

Application icons are located in `src-tauri/icons/`:

Required icon sizes:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

Generate icons from a source image:
```bash
npm install -g @tauri-apps/cli
cargo tauri icon path/to/source.png
```

This automatically generates all required icon sizes.

## Testing

### Unit Tests (Rust)

```bash
cd src-tauri
cargo test
```

Run specific test:
```bash
cargo test test_docker_check
```

Run with output:
```bash
cargo test -- --nocapture
```

### Integration Tests (Frontend)

```bash
# Run Next.js tests
npm test

# Run specific test suite
npm test -- editor.test.ts
```

### End-to-End Tests

```bash
# Run Playwright E2E tests
npm run test:e2e

# Run in headed mode (see browser)
npm run test:e2e:headed
```

## Common Commands

### Development

```bash
# Start dev environment
cargo tauri dev

# Run frontend only
npm run dev

# Type checking
npm run type-check

# Lint code
npm run lint
```

### Building

```bash
# Build everything
npm run build:export && cargo tauri build

# Build frontend only
npm run build:export

# Build backend only
cd src-tauri && cargo build --release
```

### Debugging

```bash
# Run with Rust backtrace
RUST_BACKTRACE=1 cargo tauri dev

# Run with full backtrace
RUST_BACKTRACE=full cargo tauri dev

# Run with verbose cargo output
cargo tauri dev -v
```

### Cleaning

```bash
# Clean Rust build artifacts
cd src-tauri && cargo clean

# Clean Next.js build
rm -rf .next out

# Clean node modules
rm -rf node_modules

# Full clean and reinstall
rm -rf node_modules .next out && cd src-tauri && cargo clean && cd .. && npm install
```

## Troubleshooting

### Issue: Tauri CLI Not Found

**Symptoms**: `cargo: 'tauri' is not a cargo command`

**Solution**:
```bash
# Reinstall Tauri CLI
cargo install tauri-cli --force

# Verify installation
which cargo-tauri
cargo tauri --version
```

### Issue: Build Fails - Missing Dependencies

**Symptoms**: Compilation errors about missing libraries

**Solution (macOS)**:
```bash
# Ensure Xcode Command Line Tools are installed
xcode-select --install

# Update Xcode Command Line Tools
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install
```

### Issue: Frontend Not Loading in Dev Mode

**Symptoms**: Blank window or "Failed to load" error

**Solution**:
```bash
# Ensure Next.js dev server is running first
npm run dev

# Wait for "Ready" message, then in another terminal:
cargo tauri dev

# Or check the devUrl in tauri.conf.json matches your dev server
```

### Issue: Changes Not Reflecting

**Symptoms**: Code changes don't appear in running app

**Solution**:
- **Frontend changes**: Should hot-reload automatically (check DevTools console for errors)
- **Backend changes**: Stop `cargo tauri dev` and restart
- **Config changes**: Always requires full restart

### Issue: Docker Commands Not Working

**Symptoms**: `check_docker` returns false or errors

**Solution**:
```bash
# Check if Docker is running
docker ps

# Start Docker Desktop
open -a Docker  # macOS

# Verify Docker socket
ls -la /var/run/docker.sock

# Test Docker connection
docker version
```

### Issue: Build Artifacts Too Large

**Symptoms**: DMG or .app bundle is unexpectedly large

**Solution**:
```bash
# Ensure building in release mode (not debug)
cargo tauri build --release

# Strip debug symbols
cd src-tauri/target/release
strip vibecode

# Check Next.js is using production build
NODE_ENV=production npm run build:export
```

## Next Steps

After successfully setting up your development environment:

1. **Explore the Architecture**: Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand system design
2. **Review API Documentation**: Check [API_REFERENCE.md](API_REFERENCE.md) for Tauri commands
3. **Development Guide**: See [DEVELOPMENT.md](DEVELOPMENT.md) for advanced development topics
4. **Make Changes**: Start developing! See [Contributing Guidelines](../../CONTRIBUTING.md)

## Additional Resources

### Official Documentation

- [Tauri Getting Started](https://tauri.app/v2/guides/getting-started/)
- [Tauri Configuration](https://tauri.app/v2/reference/configuration/)
- [Rust Book](https://doc.rust-lang.org/book/)

### VibeCode Resources

- [Main README](../../README.md)
- [Architecture Overview](../ARCHITECTURE.md)
- [Development Guide](../DEVELOPMENT.md)
- [Troubleshooting](../TROUBLESHOOTING.md)

## Getting Help

If you encounter issues:

1. Check [Troubleshooting](TROUBLESHOOTING.md) section
2. Search [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
3. Review [Tauri Documentation](https://tauri.app/v2/)
4. Open new issue with `tauri` label

---

**Last Updated**: 2025-10-01
**Tauri Version**: 2.x
**Status**: Active Development
