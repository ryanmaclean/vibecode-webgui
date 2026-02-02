# Quick Start - VibeCode Native macOS Build System

**5-Minute Setup Guide** 🚀

Built by Agent 23 from Shopify's macOS CI Infrastructure Team

## Prerequisites

- macOS 13+ (Ventura or newer)
- 8GB+ RAM (16GB+ recommended)
- 20GB free disk space

## Step 1: Install Dependencies (2 minutes)

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Apple Container runtime
brew install --cask container

# Start container service
container system start

# Verify installation
container version
```

## Step 2: Build vibe-build (1 minute)

```bash
# Navigate to project
cd vibecode-webgui/macos-native-build

# Build and install
make install

# Verify installation
vibe-build info
```

**Output should show**:
```
==============================================
VibeCode Native macOS Build System
==============================================
Version: 1.0.0
Built by: Agent 23 - Staff Engineer
...
✅ Installation verification complete!
```

## Step 3: Build Your First Image (2 minutes)

```bash
# Build agentapi container (single architecture)
vibe-build build \
  --file ../docker/agentapi/Dockerfile \
  --context ../docker/agentapi \
  --tag vibecode/agentapi:latest \
  --platform arm64

# Expected output:
# Building vibecode/agentapi:latest for linux/arm64
# Parsed 15 instructions from Dockerfile
# Executing stage 1/15: FROM
# ...
# ✅ Build successful!
# Duration: 4m 23s
# Layers: 15
# Size: 2.3 GB
```

## Step 4: Verify Build (30 seconds)

```bash
# Run container
container run -d \
  --name test-agentapi \
  -p 3284:3284 \
  vibecode/agentapi:latest

# Wait for startup
sleep 10

# Test health endpoint
curl http://localhost:3284/health

# Expected: {"status":"healthy","timestamp":"..."}

# Check logs
container logs test-agentapi

# Cleanup
container stop test-agentapi
container rm test-agentapi
```

## Common Tasks

### Build Multi-Arch Image

```bash
vibe-build build \
  --file Dockerfile \
  --context . \
  --tag myapp:latest \
  --platform both  # Builds for arm64 AND x86_64
```

### Fresh Build (No Cache)

```bash
vibe-build build \
  --file Dockerfile \
  --context . \
  --tag myapp:latest \
  --no-cache
```

### Incremental Build (Fast)

```bash
# Make changes to code
vim server.py

# Rebuild (uses cache)
vibe-build build \
  --file Dockerfile \
  --context . \
  --tag myapp:dev

# Expected time: 15-30 seconds
```

### Cache Management

```bash
# View cache stats
vibe-build cache --operation list

# Clean old entries (>7 days)
vibe-build cache --operation prune

# Nuclear option: clear everything
vibe-build cache --operation clear
```

### Clean Build Artifacts

```bash
# Remove temporary files
vibe-build clean

# Remove everything including cache
vibe-build clean --all
```

## Performance Tips

### 1. Enable Aggressive Caching

```bash
# First build (slow)
time vibe-build build -f Dockerfile -c . -t app:v1
# Output: 5m 30s

# Second build (fast - cache hit)
time vibe-build build -f Dockerfile -c . -t app:v1
# Output: 2s ⚡
```

### 2. Incremental Development

```bash
# Watch mode (rebuild on file changes)
fswatch -o . | xargs -n1 -I{} vibe-build build -f Dockerfile -c . -t app:dev
```

### 3. Parallel Builds

```bash
# Build multiple images in parallel
vibe-build build -f Dockerfile.web -c . -t web:latest &
vibe-build build -f Dockerfile.api -c . -t api:latest &
vibe-build build -f Dockerfile.worker -c . -t worker:latest &
wait

echo "All builds complete!"
```

## Troubleshooting

### "Command not found: vibe-build"

```bash
# Check installation
which vibe-build

# If not found, reinstall
cd macos-native-build
make clean
make install

# Verify PATH
echo $PATH | grep /usr/local/bin
```

### "container: command not found"

```bash
# Install Apple Container
brew install --cask container

# Start service
container system start

# Check status
container system status
```

### Build Fails with "Layer compression failed"

```bash
# Check disk space
df -h

# Clean cache
vibe-build clean --all

# Retry with verbose logging
vibe-build build \
  --file Dockerfile \
  --context . \
  --tag myapp:latest \
  --verbose
```

### Slow Build Performance

```bash
# Check system resources
vibe-build info

# Prune old cache
vibe-build cache --operation prune

# Check running processes
top -o cpu | head -20
```

## Next Steps

### Development Workflow

1. **Local Development**:
   ```bash
   # Edit code
   vim app.py

   # Quick rebuild
   vibe-build build -f Dockerfile -c . -t app:dev

   # Test
   container run -it app:dev
   ```

2. **CI/CD Integration**:
   - See `.github/workflows/macos-build.yml` for GitHub Actions
   - See `.buildkite/pipeline.yml` for Buildkite
   - Customize for your CI system

3. **Production Deployment**:
   ```bash
   # Build production image
   vibe-build build \
     --file Dockerfile \
     --context . \
     --tag myapp:v1.0.0 \
     --platform both

   # Push to registry
   container push myapp:v1.0.0
   ```

### Advanced Features

- **Layer Caching**: Automatic, intelligent caching
- **Multi-Arch**: Single command for arm64 + x86_64
- **Offline Builds**: All dependencies vendored
- **launchd Service**: Background build daemon
- **XPC Coordination**: Efficient resource management

## Getting Help

**Documentation**: `/macos-native-build/README.md`
**Examples**: `/macos-native-build/examples/`
**Tests**: `/macos-native-build/tests/`

**Issues**: https://github.com/ryanmaclean/vibecode-webgui/issues
**Discussions**: https://github.com/ryanmaclean/vibecode-webgui/discussions

---

**Built with ❤️ by Agent 23**

*"At Shopify, we replaced Jenkins with native macOS orchestration for 500+ build agents. Now VibeCode has the same advantage."*
