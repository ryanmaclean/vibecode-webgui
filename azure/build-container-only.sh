#!/bin/bash
# Build optimized OpenVSCode container (macOS compatible)
# Skips kernel/initramfs (use on Linux for full build)
# Result: ~120 MB container

set -e

WORK_DIR="/tmp/openvscode-container-$$"
OPENVSCODE_VERSION="1.95.3"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

check_deps() {
    log "Checking dependencies..."

    if ! command -v docker &>/dev/null; then
        error "Docker not found. Please install Docker Desktop for Mac."
    fi

    if ! command -v wget &>/dev/null; then
        error "wget not found. Run: brew install wget"
    fi

    log "✓ Dependencies OK"
}

download_openvscode() {
    log "=== Downloading OpenVSCode ==="

    mkdir -p "$WORK_DIR"
    cd "$WORK_DIR"

    local arch=$(uname -m)
    if [ "$arch" = "arm64" ]; then
        arch="arm64"
    else
        arch="x64"
    fi

    log "Downloading OpenVSCode ${OPENVSCODE_VERSION} for ${arch}..."
    wget -q "https://github.com/gitpod-io/openvscode-server/releases/download/openvscode-server-v${OPENVSCODE_VERSION}/openvscode-server-v${OPENVSCODE_VERSION}-linux-${arch}.tar.gz"

    log "Extracting..."
    tar xf "openvscode-server-v${OPENVSCODE_VERSION}-linux-${arch}.tar.gz"
    mv "openvscode-server-v${OPENVSCODE_VERSION}-linux-${arch}" openvscode

    local size=$(du -sh openvscode | cut -f1)
    log "✓ Downloaded: $size"
}

optimize_openvscode() {
    log "=== Optimizing OpenVSCode ==="

    cd "$WORK_DIR/openvscode"

    log "Removing unnecessary files..."
    rm -rf \
        extensions/ms-vscode.js-debug \
        extensions/ms-vscode.js-debug-companion \
        extensions/vscode-*test* \
        extensions/*/images \
        extensions/*/out/**/*.map \
        resources/app/out/**/*.map \
        resources/app/node_modules/@types \
        resources/app/node_modules/typescript/lib/*.d.ts \
        node_modules/@types \
        node_modules/typescript/lib/*.d.ts 2>/dev/null || true

    log "Stripping binaries..."
    find . -type f -perm +111 -exec strip --strip-unneeded {} + 2>/dev/null || true

    local size=$(du -sh . | cut -f1)
    log "✓ Optimized to: $size"
}

create_dockerfile() {
    log "=== Creating Dockerfile ==="

    cd "$WORK_DIR"

    cat > Dockerfile << 'EOF'
# Minimal OpenVSCode Server Container
FROM alpine:3.19

# Install minimal runtime
RUN apk add --no-cache \
    nodejs \
    libstdc++ \
    libgcc \
    ca-certificates \
    musl \
    && rm -rf /var/cache/apk/*

# Copy optimized OpenVSCode
COPY openvscode/ /opt/openvscode/

# Create workspace
RUN mkdir -p /workspace && \
    addgroup -g 1000 vscode && \
    adduser -u 1000 -G vscode -s /bin/sh -D vscode && \
    chown -R vscode:vscode /workspace

# Startup script
RUN cat > /start.sh << 'SCRIPT'
#!/bin/sh
exec /opt/openvscode/bin/openvscode-server \
    --host 0.0.0.0 \
    --port 3000 \
    --without-connection-token \
    --accept-server-license-terms
SCRIPT

RUN chmod +x /start.sh

USER vscode
WORKDIR /workspace
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget -q --spider http://localhost:3000/healthz || exit 1

CMD ["/bin/sh", "/start.sh"]
EOF

    log "✓ Dockerfile created"
}

build_container() {
    log "=== Building Docker Container ==="

    cd "$WORK_DIR"

    log "Building image (this may take a few minutes)..."
    docker build -t openvscode-minimal:latest . 2>&1 | grep -E "Step|Successfully|writing"

    local size=$(docker images openvscode-minimal:latest --format "{{.Size}}")
    log "✓ Container built: $size"

    log ""
    log "========================================="
    log "  Build Complete!"
    log "========================================="
    log "Image: openvscode-minimal:latest"
    log "Size: $size"
    log ""
    log "Test with:"
    log "  docker run --rm -p 3000:3000 openvscode-minimal:latest"
    log ""
    log "Access at:"
    log "  http://localhost:3000"
    log "========================================="
}

cleanup() {
    if [ "$KEEP_BUILD" != "1" ]; then
        log "Cleaning up..."
        rm -rf "$WORK_DIR"
    else
        log "Build files kept at: $WORK_DIR"
    fi
}

main() {
    log "=== Optimized OpenVSCode Container Build (macOS) ==="
    log "Target: ~120-150 MB"
    log ""

    check_deps
    download_openvscode
    optimize_openvscode
    create_dockerfile
    build_container
    cleanup

    log "✓ Done!"
}

trap 'error "Build interrupted"' INT TERM

main "$@"
