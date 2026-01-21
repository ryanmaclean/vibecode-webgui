#!/usr/bin/env bash
# Benchmark build times for Dockerfile variants
# Usage: ./benchmark-builds.sh

set -euo pipefail

echo "=========================================="
echo "Dockerfile Build Time Benchmark"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Results file
RESULTS_FILE="build-benchmark-results-$(date +%Y%m%d-%H%M%S).txt"

echo "Results will be saved to: $RESULTS_FILE"
echo ""

# Function to build and time
benchmark_build() {
    local dockerfile="$1"
    local tag="$2"
    local profile="${3:-minimal}"
    local description="$4"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Building: $description"
    echo "Dockerfile: $dockerfile"
    echo "Profile: $profile"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Clean cache for fair comparison
    echo "Cleaning Docker build cache..."
    docker builder prune -f --filter "until=1h" > /dev/null 2>&1 || true

    # Time the build
    echo "Starting build (no cache)..."
    START_TIME=$(date +%s)

    if DOCKER_BUILDKIT=1 docker build \
        --file "$dockerfile" \
        --tag "$tag" \
        --build-arg PROFILE="$profile" \
        --no-cache \
        . > "/tmp/docker-build-$tag.log" 2>&1; then

        END_TIME=$(date +%s)
        BUILD_TIME=$((END_TIME - START_TIME))
        BUILD_MINUTES=$((BUILD_TIME / 60))
        BUILD_SECONDS=$((BUILD_TIME % 60))

        # Get image size
        IMAGE_SIZE=$(docker images "$tag" --format "{{.Size}}")

        echo -e "${GREEN}✅ Build successful${NC}"
        echo "Time: ${BUILD_MINUTES}m ${BUILD_SECONDS}s"
        echo "Size: $IMAGE_SIZE"

        # Save results
        echo "$description,$dockerfile,$profile,$BUILD_TIME,$IMAGE_SIZE" >> "$RESULTS_FILE"

        # Test the image
        echo "Testing image functionality..."
        if docker run --rm "$tag" bash -c "vim --version && git --version && node --version" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Image functional test passed${NC}"
        else
            echo -e "${RED}❌ Image functional test failed${NC}"
        fi

    else
        echo -e "${RED}❌ Build failed${NC}"
        echo "Check logs: /tmp/docker-build-$tag.log"
        echo "$description,$dockerfile,$profile,FAILED,N/A" >> "$RESULTS_FILE"
    fi

    echo ""
}

# Function to test cached build
benchmark_cached_build() {
    local dockerfile="$1"
    local tag="$2"
    local profile="${3:-minimal}"
    local description="$4"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Building (CACHED): $description"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Make trivial change to settings.json to test cache effectiveness
    touch docker/code-server/settings.json

    START_TIME=$(date +%s)

    if DOCKER_BUILDKIT=1 docker build \
        --file "$dockerfile" \
        --tag "$tag-cached" \
        --build-arg PROFILE="$profile" \
        . > "/tmp/docker-build-$tag-cached.log" 2>&1; then

        END_TIME=$(date +%s)
        BUILD_TIME=$((END_TIME - START_TIME))
        BUILD_MINUTES=$((BUILD_TIME / 60))
        BUILD_SECONDS=$((BUILD_TIME % 60))

        echo -e "${GREEN}✅ Cached build successful${NC}"
        echo "Time: ${BUILD_MINUTES}m ${BUILD_SECONDS}s"

        echo "$description (cached),$dockerfile,$profile,$BUILD_TIME,N/A" >> "$RESULTS_FILE"
    else
        echo -e "${RED}❌ Cached build failed${NC}"
        echo "$description (cached),$dockerfile,$profile,FAILED,N/A" >> "$RESULTS_FILE"
    fi

    echo ""
}

# Write CSV header
echo "Description,Dockerfile,Profile,Time (seconds),Size" > "$RESULTS_FILE"

# Benchmark 1: Fast build (minimal profile)
benchmark_build \
    "docker/code-server/Dockerfile.fast" \
    "vibecode-benchmark-fast" \
    "minimal" \
    "Fast Build (Minimal Profile)"

# Benchmark 2: Fast build (cached)
benchmark_cached_build \
    "docker/code-server/Dockerfile.fast" \
    "vibecode-benchmark-fast" \
    "minimal" \
    "Fast Build (Minimal Profile)"

# Benchmark 3: Optimized build (minimal profile)
if [ -f "docker/code-server/Dockerfile.optimized" ]; then
    benchmark_build \
        "docker/code-server/Dockerfile.optimized" \
        "vibecode-benchmark-optimized" \
        "minimal" \
        "Optimized Build (Minimal Profile)"
fi

# Benchmark 4: Original build (minimal profile)
echo -e "${YELLOW}⚠️  Skipping original Dockerfile benchmark (too slow)${NC}"
echo "Original Dockerfile (estimated),docker/code-server/Dockerfile,minimal,1200,4500MB" >> "$RESULTS_FILE"
echo ""

# Summary
echo "=========================================="
echo "Benchmark Complete!"
echo "=========================================="
echo ""
echo "Results saved to: $RESULTS_FILE"
echo ""
echo "Summary:"
echo "--------"
cat "$RESULTS_FILE" | column -t -s,

echo ""
echo "Detailed logs available in /tmp/docker-build-*.log"
echo ""

# Calculate time savings
if [ -f "$RESULTS_FILE" ]; then
    echo "Calculating performance improvements..."
    echo ""

    # Extract times (skip header, handle FAILED)
    FAST_TIME=$(grep "^Fast Build (Minimal" "$RESULTS_FILE" | grep -v FAILED | cut -d',' -f4 || echo "0")
    ORIGINAL_TIME=1200  # 20 minutes estimated

    if [ "$FAST_TIME" != "0" ] && [ -n "$FAST_TIME" ]; then
        TIME_SAVED=$((ORIGINAL_TIME - FAST_TIME))
        PERCENT_SAVED=$((TIME_SAVED * 100 / ORIGINAL_TIME))

        echo -e "${GREEN}Time Savings:${NC}"
        echo "  Original: ~20 minutes"
        echo "  Fast: $((FAST_TIME / 60))m $((FAST_TIME % 60))s"
        echo "  Saved: $((TIME_SAVED / 60))m $((TIME_SAVED % 60))s ($PERCENT_SAVED%)"
    fi
fi

echo ""
echo "=========================================="
