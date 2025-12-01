#!/bin/bash
# Build ARM64 versions of Gitpod workspace images
# Reference: https://github.com/gitpod-io/workspace-images

set -e

cd "$(dirname "$0")/.."

GITPOD_REPO_DIR="${GITPOD_REPO_DIR:-/tmp/gitpod-workspace-images}"
REGISTRY="${REGISTRY:-ghcr.io/ryanmaclean}"
BUILDX_BUILDER="${BUILDX_BUILDER:-multiarch-builder}"

echo "=== Building Gitpod Workspace Images for ARM64 ==="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Step 1: Clone Gitpod repo if needed
if [ ! -d "$GITPOD_REPO_DIR" ]; then
    log "Cloning Gitpod workspace-images repository..."
    git clone https://github.com/gitpod-io/workspace-images.git "$GITPOD_REPO_DIR"
    success "Repository cloned"
else
    log "Updating Gitpod repository..."
    cd "$GITPOD_REPO_DIR"
    git pull
    success "Repository updated"
fi

cd "$GITPOD_REPO_DIR"

# Step 2: Set up Docker buildx
log "Setting up Docker buildx for multi-arch builds..."
if ! docker buildx ls | grep -q "$BUILDX_BUILDER"; then
    docker buildx create --name "$BUILDX_BUILDER" --use --bootstrap
    success "Buildx builder created"
else
    docker buildx use "$BUILDX_BUILDER"
    docker buildx inspect --bootstrap
    success "Buildx builder ready"
fi

# Step 3: Build ARM64 base image
log "Building workspace-base for ARM64..."
docker buildx build \
    --platform linux/arm64 \
    --tag "${REGISTRY}/workspace-base:arm64" \
    --tag "${REGISTRY}/workspace-base:arm64-latest" \
    --file base/Dockerfile \
    --load \
    --progress=plain \
    . || {
    warn "Base image build failed, trying with build-arg..."
    # Some Dockerfiles might need build args
    docker buildx build \
        --platform linux/arm64 \
        --build-arg BASE_IMAGE=ubuntu:22.04 \
        --tag "${REGISTRY}/workspace-base:arm64" \
        --file base/Dockerfile \
        --load \
        --progress=plain \
        .
}

success "Base image built: ${REGISTRY}/workspace-base:arm64"

# Step 4: Build specific workspace images
IMAGES=(
    "workspace-node:node/Dockerfile"
    "workspace-python:python/Dockerfile"
    "workspace-go:go/Dockerfile"
    "workspace-rust:rust/Dockerfile"
)

for image_spec in "${IMAGES[@]}"; do
    IFS=':' read -r image_name dockerfile <<< "$image_spec"
    log "Building ${image_name} for ARM64..."
    
    docker buildx build \
        --platform linux/arm64 \
        --tag "${REGISTRY}/${image_name}:arm64" \
        --tag "${REGISTRY}/${image_name}:arm64-latest" \
        --file "$dockerfile" \
        --load \
        --progress=plain \
        . || {
        warn "Failed to build ${image_name}, skipping..."
        continue
    }
    
    success "${image_name} built: ${REGISTRY}/${image_name}:arm64"
done

# Step 5: Verify ARM64 builds
log "Verifying ARM64 images..."
for image_name in workspace-base workspace-node workspace-python workspace-go workspace-rust; do
    if docker images | grep -q "${REGISTRY}/${image_name}.*arm64"; then
        log "Testing ${image_name}..."
        docker run --rm --platform linux/arm64 "${REGISTRY}/${image_name}:arm64" uname -m | grep -q "aarch64" && \
            success "${image_name} is ARM64" || \
            warn "${image_name} architecture check failed"
    fi
done

# Step 6: Summary
echo ""
echo "=== Build Summary ==="
echo ""
echo "Built ARM64 images:"
docker images | grep "${REGISTRY}/workspace" | grep arm64 | awk '{print "  -", $1":"$2, "(" $5 ")"}'
echo ""
echo "To use in K3s VM:"
echo "  kubectl run workspace --image=${REGISTRY}/workspace-base:arm64"
echo ""
echo "To push to registry:"
echo "  docker push ${REGISTRY}/workspace-base:arm64"

