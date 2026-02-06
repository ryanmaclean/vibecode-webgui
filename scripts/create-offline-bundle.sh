#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Create offline installation bundle for code-server

# Initialize log aggregation
init_log_aggregation

set -e

BUNDLE_DIR="vibecode-codeserver-offline-$(date +%Y%m%d)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}📦 Creating offline bundle: ${BUNDLE_DIR}${NC}"
echo ""

# Create bundle structure
mkdir -p "${BUNDLE_DIR}"/{images,scripts,k8s,docs}

# Export images
echo -e "${BLUE}📥 Exporting Docker images...${NC}"
mkdir -p "${BUNDLE_DIR}/images"

if docker image inspect vibecode-codeserver:latest-arm64 > /dev/null 2>&1; then
    echo "  Exporting ARM64 image..."
    docker save vibecode-codeserver:latest-arm64 | \
      gzip -9 > "${BUNDLE_DIR}/images/vibecode-codeserver-arm64.tar.gz"
    echo -e "${GREEN}  ✓ ARM64 exported${NC}"
else
    echo -e "${YELLOW}  ⚠️  ARM64 image not found, skipping${NC}"
fi

if docker image inspect vibecode-codeserver:latest-amd64 > /dev/null 2>&1; then
    echo "  Exporting AMD64 image..."
    docker save vibecode-codeserver:latest-amd64 | \
      gzip -9 > "${BUNDLE_DIR}/images/vibecode-codeserver-amd64.tar.gz"
    echo -e "${GREEN}  ✓ AMD64 exported${NC}"
else
    echo -e "${YELLOW}  ⚠️  AMD64 image not found, skipping${NC}"
fi

# Create checksums
echo ""
echo -e "${BLUE}🔐 Creating checksums...${NC}"
cd "${BUNDLE_DIR}/images"
sha256sum *.tar.gz > checksums.txt 2>/dev/null || true
cd - > /dev/null

# Create metadata
echo -e "${BLUE}📝 Creating metadata...${NC}"
cat > "${BUNDLE_DIR}/metadata.json" <<EOF
{
  "image": "vibecode-codeserver",
  "version": "$(date +%Y%m%d)",
  "platforms": ["linux/amd64", "linux/arm64"],
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "files": {
    "arm64": "$(ls -lh ${BUNDLE_DIR}/images/*arm64.tar.gz 2>/dev/null | awk '{print $5}' || echo 'N/A')",
    "amd64": "$(ls -lh ${BUNDLE_DIR}/images/*amd64.tar.gz 2>/dev/null | awk '{print $5}' || echo 'N/A')"
  }
}
EOF

# Copy deployment files
echo -e "${BLUE}📄 Copying deployment files...${NC}"
cp "${PROJECT_ROOT}/docker-compose.yml" "${BUNDLE_DIR}/" 2>/dev/null || true
cp "${PROJECT_ROOT}/.env.example" "${BUNDLE_DIR}/.env.template" 2>/dev/null || true
cp -r "${PROJECT_ROOT}/k8s" "${BUNDLE_DIR}/" 2>/dev/null || true

# Copy documentation
echo -e "${BLUE}📚 Copying documentation...${NC}"
cp "${PROJECT_ROOT}/docker/code-server"/*.md "${BUNDLE_DIR}/docs/" 2>/dev/null || true
cp "${PROJECT_ROOT}/README.md" "${BUNDLE_DIR}/docs/" 2>/dev/null || true

# Create import script
cat > "${BUNDLE_DIR}/scripts/import-offline.sh" <<'IMPORT_EOF'
#!/bin/bash
set -e

INPUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/images"

echo "📥 Importing images from ${INPUT_DIR}"

# Verify checksums
cd "${INPUT_DIR}"
if [ -f checksums.txt ]; then
    echo "🔐 Verifying checksums..."
    sha256sum -c checksums.txt || {
        echo "❌ Checksum verification failed!"
        exit 1
    }
    echo "✅ Checksums verified"
fi

# Detect platform
ARCH=$(uname -m)
case "${ARCH}" in
    x86_64)
        TARBALL="vibecode-codeserver-amd64.tar.gz"
        ;;
    aarch64|arm64)
        TARBALL="vibecode-codeserver-arm64.tar.gz"
        ;;
    *)
        echo "❌ Unsupported architecture: ${ARCH}"
        exit 1
        ;;
esac

if [ ! -f "${TARBALL}" ]; then
    echo "❌ Image not found: ${TARBALL}"
    exit 1
fi

echo "📦 Loading ${TARBALL}..."
gunzip -c "${TARBALL}" | docker load

echo "✅ Image imported successfully!"
echo ""
docker images vibecode-codeserver
IMPORT_EOF

chmod +x "${BUNDLE_DIR}/scripts/import-offline.sh"

# Create installation script
cat > "${BUNDLE_DIR}/install.sh" <<'INSTALL_EOF'
#!/bin/bash
set -e

echo "🚀 Installing VibeCode Code-Server (Offline)"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

# Import image
echo "📥 Importing Docker image..."
./scripts/import-offline.sh

# Configure environment
if [ ! -f .env ]; then
    echo "📝 Creating .env from template..."
    cp .env.template .env
    echo "⚠️  Please edit .env with your configuration"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Edit .env with your configuration:"
echo "     nano .env"
echo ""
echo "  2. Start with Docker Compose:"
echo "     docker compose up -d"
echo ""
echo "  3. Or start with Docker:"
echo "     docker run -d -p 8765:8765 -p 46203:46203 \\"
echo "       -e PASSWORD=your_password \\"
echo "       -v \$(pwd)/workspace:/home/coder/workspace \\"
echo "       vibecode-codeserver:latest"
echo ""
echo "  4. Access at: http://localhost:8765"
echo ""
INSTALL_EOF

chmod +x "${BUNDLE_DIR}/install.sh"

# Create README
cat > "${BUNDLE_DIR}/README.md" <<'README_EOF'
# VibeCode Code-Server Offline Installation

This bundle contains everything needed to run VibeCode Code-Server in an offline/air-gapped environment.

## Contents

- `images/` - Docker images (ARM64 and AMD64, compressed)
- `scripts/` - Installation and import scripts
- `k8s/` - Kubernetes manifests
- `docs/` - Documentation files
- `docker-compose.yml` - Docker Compose configuration
- `.env.template` - Environment variable template
- `install.sh` - Quick installation script
- `metadata.json` - Bundle metadata

## System Requirements

- Docker 20.10+ or Podman 3.0+
- 8GB RAM minimum (16GB recommended)
- 20GB disk space
- Linux, macOS, or Windows with WSL2

## Quick Installation

1. Transfer this entire directory to the target system
2. Run the installation script:
   ```bash
   ./install.sh
   ```
3. Edit `.env` with your configuration
4. Deploy:
   ```bash
   docker compose up -d
   ```

## Platform Support

The bundle includes images for both architectures:

- **ARM64**: Apple Silicon (M1/M2/M3/M4), Raspberry Pi 4/5, ARM servers
- **AMD64**: x86_64 servers, workstations, Intel Macs

The installation script automatically detects your platform and loads the correct image.

## Manual Installation

If you prefer manual installation:

### 1. Import Image

```bash
cd images

# Verify checksums
sha256sum -c checksums.txt

# Import for your platform
# For ARM64:
gunzip -c vibecode-codeserver-arm64.tar.gz | docker load

# For AMD64:
gunzip -c vibecode-codeserver-amd64.tar.gz | docker load
```

### 2. Configure

```bash
cp .env.template .env
nano .env  # Edit with your settings
```

### 3. Deploy

**Option A: Docker Compose**
```bash
docker compose up -d
```

**Option B: Docker Run**
```bash
docker run -d \
  --name vibecode-codeserver \
  -p 8765:8765 \
  -p 46203:46203 \
  -e PASSWORD=your_password \
  -v $(pwd)/workspace:/home/coder/workspace \
  vibecode-codeserver:latest
```

**Option C: Kubernetes**
```bash
kubectl create namespace vibecode-platform
kubectl apply -f k8s/code-server-custom.yaml
```

## Features

### Pre-installed AI Extensions (9)

- **Anthropic Claude Code** (v2.0.1) - Official Claude AI assistant
- **OpenAI ChatGPT** (v0.4.15) - Official ChatGPT/Codex integration
- **GitHub Copilot** - AI pair programmer
- **GitHub Copilot Chat** - Conversational AI coding
- **Codeium** - Free AI code completion
- **Cline** (Claude Dev) - Advanced Claude integration
- **VibeCode AI Assistant** - Custom VibeCode features
- **VibeCode Inline Edit** - In-editor AI editing
- **VibeCode Codebase Chat** - Chat with your codebase

### Pre-installed Development Tools

- **LSP Servers**: Python, TypeScript, Rust, Java, C/C++, Bash, Docker
- **Languages**: Node.js 18, Python 3, Go 1.22
- **Tools**: Git, Fish shell, npm, yarn, pnpm, prettier, eslint

### Ports

- **8765**: Main code-server interface
- **46203**: OAuth callback (for Claude Code & OpenAI ChatGPT)

## Configuration

### Environment Variables

Edit `.env` with your settings:

```bash
# Authentication
PASSWORD=your_secure_password

# AI Extension API Keys (optional)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
CODEIUM_API_KEY=...

# Datadog Monitoring (optional)
DD_API_KEY=...
DD_SITE=datadoghq.com
DD_ENV=production
```

### Post-Installation

After first login, configure AI extensions:

1. **Claude Code**: Command Palette → "Claude Code: Set API Key"
2. **OpenAI ChatGPT**: Command Palette → "ChatGPT: Set API Key"
3. **GitHub Copilot**: Click Copilot icon → Sign in
4. **Codeium**: Command Palette → "Codeium: Login"

## Troubleshooting

### Image import fails

```bash
# Check Docker is running
docker info

# Verify checksums
cd images && sha256sum -c checksums.txt

# Check disk space
df -h
```

### Port already in use

```bash
# Change ports in docker-compose.yml or use different ports:
docker run -d -p 9000:8765 -p 9001:46203 vibecode-codeserver:latest
```

### Extension not working

```bash
# Check extension logs
docker exec vibecode-codeserver cat /home/coder/.local/share/code-server/logs/*.log

# Reinstall extension
docker exec vibecode-codeserver code-server --install-extension anthropic.claude-code --force
```

## Documentation

See the `docs/` directory for detailed documentation:

- `DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `DATADOG_INTEGRATION.md` - Monitoring and observability
- `PORTABILITY_GUIDE.md` - Multi-platform deployment
- `MULTIARCH_BUILD.md` - Building from source
- `README.md` - Main project documentation

## Security

- Always set a strong `PASSWORD`
- Use HTTPS in production (via reverse proxy)
- Keep API keys secure (use secrets management)
- Regularly update the image for security patches
- Enable Datadog security monitoring in production

## Support

For issues or questions:
- Check documentation in `docs/`
- Review troubleshooting section above
- GitHub: https://github.com/ryanmaclean/vibecode-webgui

## License

See LICENSE file in the documentation directory.

---

**Bundle Version**: See `metadata.json` for version and build information.
README_EOF

# Create tarball
echo ""
echo -e "${BLUE}📦 Creating tarball...${NC}"
tar czf "${BUNDLE_DIR}.tar.gz" "${BUNDLE_DIR}"

# Calculate sizes
BUNDLE_SIZE=$(du -h "${BUNDLE_DIR}.tar.gz" | cut -f1)
ARM64_SIZE=$(ls -lh "${BUNDLE_DIR}/images"/*arm64.tar.gz 2>/dev/null | awk '{print $5}' || echo "N/A")
AMD64_SIZE=$(ls -lh "${BUNDLE_DIR}/images"/*amd64.tar.gz 2>/dev/null | awk '{print $5}' || echo "N/A")

echo ""
echo -e "${GREEN}✅ Offline bundle created successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Bundle Information:${NC}"
echo "  Bundle: ${BUNDLE_DIR}.tar.gz"
echo "  Size: ${BUNDLE_SIZE}"
echo "  ARM64 Image: ${ARM64_SIZE}"
echo "  AMD64 Image: ${AMD64_SIZE}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "  1. Transfer ${BUNDLE_DIR}.tar.gz to target system"
echo "  2. Extract: tar xzf ${BUNDLE_DIR}.tar.gz"
echo "  3. Install: cd ${BUNDLE_DIR} && ./install.sh"
echo ""
echo -e "${BLUE}📝 Bundle contents:${NC}"
ls -lh "${BUNDLE_DIR}.tar.gz"
echo ""
