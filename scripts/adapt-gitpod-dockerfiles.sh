#!/bin/bash
# Adapt Gitpod Dockerfiles for ARM64
# Creates ARM64-specific versions of Gitpod workspace Dockerfiles

set -e

cd "$(dirname "$0")/.."

GITPOD_REPO_DIR="${GITPOD_REPO_DIR:-/tmp/gitpod-workspace-images}"
OUTPUT_DIR="docker/gitpod-arm64"

echo "=== Adapting Gitpod Dockerfiles for ARM64 ==="
echo ""

# Clone if needed
if [ ! -d "$GITPOD_REPO_DIR" ]; then
    echo "Cloning Gitpod workspace-images..."
    git clone https://github.com/gitpod-io/workspace-images.git "$GITPOD_REPO_DIR"
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to adapt a Dockerfile
adapt_dockerfile() {
    local source_file=$1
    local output_file=$2
    
    echo "Adapting: $source_file -> $output_file"
    
    # Copy and adapt
    sed -E '
        # Change base images to ARM64
        s/FROM ubuntu:22\.04/FROM --platform=linux\/arm64 ubuntu:22.04/g
        s/FROM ubuntu:([0-9]+\.[0-9]+)/FROM --platform=linux\/arm64 ubuntu:\1/g
        
        # Fix architecture-specific package installs
        s/apt-get install/apt-get install -o APT::Architecture=arm64/g
        
        # Add ARM64 architecture if needed
        /^RUN.*dpkg --add-architecture/ {
            a\
RUN dpkg --add-architecture arm64 || true
        }
        
        # Fix Node.js ARM64 installs
        s|https://deb.nodesource.com/setup_([0-9]+)\.x|https://deb.nodesource.com/setup_\1.x -o APT::Architecture=arm64|g
        
        # Fix Docker install (if present)
        s|https://download.docker.com/linux/ubuntu|https://download.docker.com/linux/ubuntu -o APT::Architecture=arm64|g
    ' "$source_file" > "$output_file"
    
    # Add ARM64 build arg at top
    if ! grep -q "ARG TARGETARCH" "$output_file"; then
        sed -i '' '1a\
ARG TARGETARCH=arm64\
ARG TARGETPLATFORM=linux/arm64
' "$output_file"
    fi
}

# Adapt base Dockerfile
if [ -f "$GITPOD_REPO_DIR/base/Dockerfile" ]; then
    adapt_dockerfile \
        "$GITPOD_REPO_DIR/base/Dockerfile" \
        "$OUTPUT_DIR/base.Dockerfile"
    echo "✅ Base Dockerfile adapted"
fi

# Adapt other Dockerfiles
for dir in node python go rust java; do
    if [ -f "$GITPOD_REPO_DIR/$dir/Dockerfile" ]; then
        adapt_dockerfile \
            "$GITPOD_REPO_DIR/$dir/Dockerfile" \
            "$OUTPUT_DIR/${dir}.Dockerfile"
        echo "✅ ${dir} Dockerfile adapted"
    fi
done

echo ""
echo "=== Adapted Dockerfiles ==="
ls -lh "$OUTPUT_DIR"/*.Dockerfile 2>/dev/null | awk '{print "  -", $9, "(" $5 ")"}'
echo ""
echo "Next: Build with: bash scripts/build-gitpod-arm64.sh"

