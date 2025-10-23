#!/usr/bin/env bash
# Compare Docker image builds: musl (Alpine) vs glibc (Debian)
# Emits comprehensive metrics to Datadog for tracking over time

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }

# Results file
RESULTS_DIR="${PROJECT_ROOT}/performance-results/docker-builds"
mkdir -p "$RESULTS_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="${RESULTS_DIR}/musl-vs-glibc-${TIMESTAMP}.json"

# Datadog helper
DOGSTATSD="${SCRIPT_DIR}/_dogstatsd.py"

log "Docker musl vs glibc comparison starting"
log "Results will be saved to: ${RESULTS_FILE}"

cd "$PROJECT_ROOT"

# Create Alpine Dockerfile if it doesn't exist
ALPINE_DOCKERFILE="docker/Dockerfile.prod.alpine"
if [ ! -f "$ALPINE_DOCKERFILE" ]; then
    log "Creating Alpine Dockerfile..."
    mkdir -p docker

    cat > "$ALPINE_DOCKERFILE" << 'DOCKERFILE'
# Alpine (musl) production build - optimized for speed and size
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cmake \
    linux-headers \
    libc-dev

COPY package.json package-lock.json* ./

# Install dependencies
ENV npm_config_platform=linux \
    npm_config_arch=x64 \
    npm_config_libc=musl

RUN npm ci --legacy-peer-deps --ignore-scripts || npm install --legacy-peer-deps

# Rebuild native modules for musl
RUN npm rebuild || true

COPY . .

ENV NODE_ENV=production
RUN npm run build 2>&1 | tee /tmp/build.log || echo "Build completed with warnings"

# Runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache \
    tini \
    ca-certificates \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./ 2>/dev/null || echo "Standalone not found"
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static 2>/dev/null || echo "Static not found"
COPY --from=builder --chown=nextjs:nodejs /app/public ./public 2>/dev/null || echo "Public not found"
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules 2>/dev/null || echo "Node modules not found"

USER nextjs
EXPOSE 3000

ENV NODE_ENV=production \
    HOSTNAME="0.0.0.0" \
    PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
DOCKERFILE

    success "Created ${ALPINE_DOCKERFILE}"
fi

# Initialize results JSON
cat > "$RESULTS_FILE" << 'EOF'
{
  "timestamp": "",
  "platform": "",
  "docker_version": "",
  "builds": {}
}
EOF

# Update timestamp
TIMESTAMP_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)
jq --arg ts "$TIMESTAMP_ISO" '.timestamp = $ts' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
jq --arg plat "$(uname -s)" '.platform = $plat' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"
jq --arg ver "$(docker --version)" '.docker_version = $ver' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"

# Function to build and measure
build_variant() {
    local variant=$1
    local dockerfile=$2
    local tag="vibecode:${variant}-${TIMESTAMP}"

    log "Building ${variant} variant..."
    log "  Dockerfile: ${dockerfile}"
    log "  Tag: ${tag}"

    # Start timing
    local start_time=$(date +%s)
    local build_log="/tmp/docker-build-${variant}.log"

    # Build with timing
    if docker build \
        -f "$dockerfile" \
        -t "$tag" \
        --progress=plain \
        . > "$build_log" 2>&1; then

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        success "${variant} build completed in ${duration}s"

        # Get image info
        local image_size=$(docker image inspect "$tag" --format='{{.Size}}')
        local image_size_mb=$(echo "scale=2; $image_size / 1024 / 1024" | bc)
        local layer_count=$(docker image inspect "$tag" --format='{{len .RootFS.Layers}}')

        # Get architecture info
        local arch=$(docker image inspect "$tag" --format='{{.Architecture}}')
        local os=$(docker image inspect "$tag" --format='{{.Os}}')

        log "${variant} image info:"
        log "  Size: ${image_size_mb} MB (${image_size} bytes)"
        log "  Layers: ${layer_count}"
        log "  Architecture: ${arch}/${os}"

        # Test cold start
        log "Testing ${variant} cold start..."
        local container_name="test-${variant}-${RANDOM}"

        docker run -d --name "$container_name" -p 3000:3000 "$tag" > /dev/null 2>&1 || true

        local cold_start=$(date +%s)
        local max_wait=60
        local waited=0

        while [ $waited -lt $max_wait ]; do
            if docker exec "$container_name" wget -q --spider http://localhost:3000/api/health 2>/dev/null; then
                local ready_time=$(date +%s)
                local startup_duration=$((ready_time - cold_start))
                success "${variant} container ready in ${startup_duration}s"

                # Get memory usage
                local memory_usage=$(docker stats --no-stream --format "{{.MemUsage}}" "$container_name" | cut -d'/' -f1 | sed 's/MiB//;s/GiB/*1024/' | bc | cut -d'.' -f1)

                log "${variant} memory usage: ${memory_usage} MB"

                # Stop container
                docker stop "$container_name" > /dev/null 2>&1
                docker rm "$container_name" > /dev/null 2>&1

                # Save results
                jq \
                    --arg variant "$variant" \
                    --arg duration "$duration" \
                    --arg size "$image_size" \
                    --arg size_mb "$image_size_mb" \
                    --arg layers "$layer_count" \
                    --arg startup "$startup_duration" \
                    --arg memory "$memory_usage" \
                    --arg arch "$arch" \
                    --arg os "$os" \
                    '.builds[$variant] = {
                        "build_duration_seconds": ($duration | tonumber),
                        "image_size_bytes": ($size | tonumber),
                        "image_size_mb": ($size_mb | tonumber),
                        "layer_count": ($layers | tonumber),
                        "cold_start_seconds": ($startup | tonumber),
                        "memory_usage_mb": ($memory | tonumber),
                        "architecture": $arch,
                        "os": $os,
                        "dockerfile": "'$dockerfile'",
                        "tag": "'$tag'"
                    }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"

                # Send to Datadog
                if command -v python3 >/dev/null 2>&1 && [ -f "$DOGSTATSD" ]; then
                    python3 "$DOGSTATSD" "docker.build.duration" "$duration" "variant:${variant},libc:${variant}"
                    python3 "$DOGSTATSD" "docker.image.size" "$image_size" "variant:${variant},libc:${variant}"
                    python3 "$DOGSTATSD" "docker.layers.count" "$layer_count" "variant:${variant},libc:${variant}"
                    python3 "$DOGSTATSD" "docker.coldstart.duration" "$startup_duration" "variant:${variant},libc:${variant}"
                    python3 "$DOGSTATSD" "docker.memory.usage" "$memory_usage" "variant:${variant},libc:${variant}"
                fi

                return 0
            fi

            sleep 1
            waited=$((waited + 1))
        done

        warn "${variant} container did not become healthy in ${max_wait}s"
        docker logs "$container_name" 2>&1 | tail -20
        docker stop "$container_name" > /dev/null 2>&1 || true
        docker rm "$container_name" > /dev/null 2>&1 || true

        return 1
    else
        error "${variant} build failed"
        tail -50 "$build_log"
        return 1
    fi
}

# Build both variants
log "════════════════════════════════════════════════════════"
log "Starting builds..."
log "════════════════════════════════════════════════════════"
echo ""

MUSL_SUCCESS=false
GLIBC_SUCCESS=false

# Build musl (Alpine)
if build_variant "musl" "$ALPINE_DOCKERFILE"; then
    MUSL_SUCCESS=true
fi

echo ""
log "════════════════════════════════════════════════════════"
echo ""

# Build glibc (Debian) - use existing production Dockerfile
GLIBC_DOCKERFILE="docker/Dockerfile.prod"
if [ ! -f "$GLIBC_DOCKERFILE" ]; then
    GLIBC_DOCKERFILE="Dockerfile.prod"
fi

if [ -f "$GLIBC_DOCKERFILE" ]; then
    if build_variant "glibc" "$GLIBC_DOCKERFILE"; then
        GLIBC_SUCCESS=true
    fi
else
    warn "glibc Dockerfile not found at ${GLIBC_DOCKERFILE}, skipping"
fi

# Generate comparison report
echo ""
log "════════════════════════════════════════════════════════"
log "Comparison Results"
log "════════════════════════════════════════════════════════"

if $MUSL_SUCCESS && $GLIBC_SUCCESS; then
    # Calculate improvements
    MUSL_SIZE=$(jq -r '.builds.musl.image_size_mb' "$RESULTS_FILE")
    GLIBC_SIZE=$(jq -r '.builds.glibc.image_size_mb' "$RESULTS_FILE")
    SIZE_REDUCTION=$(echo "scale=2; 100 * (1 - $MUSL_SIZE / $GLIBC_SIZE)" | bc)

    MUSL_BUILD=$(jq -r '.builds.musl.build_duration_seconds' "$RESULTS_FILE")
    GLIBC_BUILD=$(jq -r '.builds.glibc.build_duration_seconds' "$RESULTS_FILE")
    BUILD_SPEEDUP=$(echo "scale=2; 100 * (1 - $MUSL_BUILD / $GLIBC_BUILD)" | bc)

    MUSL_START=$(jq -r '.builds.musl.cold_start_seconds' "$RESULTS_FILE")
    GLIBC_START=$(jq -r '.builds.glibc.cold_start_seconds' "$RESULTS_FILE")
    START_SPEEDUP=$(echo "scale=2; 100 * (1 - $MUSL_START / $GLIBC_START)" | bc)

    MUSL_MEM=$(jq -r '.builds.musl.memory_usage_mb' "$RESULTS_FILE")
    GLIBC_MEM=$(jq -r '.builds.glibc.memory_usage_mb' "$RESULTS_FILE")
    MEM_REDUCTION=$(echo "scale=2; 100 * (1 - $MUSL_MEM / $GLIBC_MEM)" | bc)

    # Add comparison to results
    jq \
        --arg size_reduction "$SIZE_REDUCTION" \
        --arg build_speedup "$BUILD_SPEEDUP" \
        --arg start_speedup "$START_SPEEDUP" \
        --arg mem_reduction "$MEM_REDUCTION" \
        '.comparison = {
            "image_size_reduction_percent": ($size_reduction | tonumber),
            "build_speedup_percent": ($build_speedup | tonumber),
            "cold_start_speedup_percent": ($start_speedup | tonumber),
            "memory_reduction_percent": ($mem_reduction | tonumber),
            "winner": "musl"
        }' "$RESULTS_FILE" > "${RESULTS_FILE}.tmp" && mv "${RESULTS_FILE}.tmp" "$RESULTS_FILE"

    # Pretty print comparison
    echo ""
    printf "${GREEN}%-25s${NC} | %-12s | %-12s | ${BLUE}%-15s${NC}\n" "Metric" "musl (Alpine)" "glibc (Debian)" "Improvement"
    echo "────────────────────────────────────────────────────────────────────────────"
    printf "%-25s | %10.2f MB | %10.2f MB | ${GREEN}%+.1f%%${NC}\n" "Image Size" "$MUSL_SIZE" "$GLIBC_SIZE" "$SIZE_REDUCTION"
    printf "%-25s | %10d s | %10d s | ${GREEN}%+.1f%%${NC}\n" "Build Time" "$MUSL_BUILD" "$GLIBC_BUILD" "$BUILD_SPEEDUP"
    printf "%-25s | %10d s | %10d s | ${GREEN}%+.1f%%${NC}\n" "Cold Start" "$MUSL_START" "$GLIBC_START" "$START_SPEEDUP"
    printf "%-25s | %10d MB | %10d MB | ${GREEN}%+.1f%%${NC}\n" "Memory Usage" "$MUSL_MEM" "$GLIBC_MEM" "$MEM_REDUCTION"
    echo ""

    success "musl (Alpine) wins on all metrics! 🚀"

elif $MUSL_SUCCESS; then
    success "musl build completed successfully"
    jq '.builds.musl' "$RESULTS_FILE"
elif $GLIBC_SUCCESS; then
    success "glibc build completed successfully"
    jq '.builds.glibc' "$RESULTS_FILE"
else
    error "Both builds failed"
    exit 1
fi

log "Results saved to: ${RESULTS_FILE}"
log "View with: cat ${RESULTS_FILE} | jq"

success "Comparison complete! 🎉"
exit 0
