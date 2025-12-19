#!/bin/bash
# Build pgvector extension for PostgreSQL 16 on ARM64 Alpine
# License: MIT (https://github.com/pgvector/pgvector)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/pgvector-arm64"
PGVECTOR_VERSION="0.8.0"

echo "🔨 Building pgvector ${PGVECTOR_VERSION} for ARM64 Alpine"
echo "Output: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create Dockerfile
cat > /tmp/Dockerfile.pgvector << 'EOF'
FROM alpine:3.21

# Install build dependencies
RUN apk add --no-cache \
    git \
    make \
    gcc \
    musl-dev \
    postgresql16-dev \
    clang \
    llvm

# Clone pgvector
WORKDIR /build
RUN git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git

# Build pgvector
WORKDIR /build/pgvector
RUN make
RUN make install

# List installed files
RUN find /usr/lib/postgresql16 -name "*vector*" -ls
RUN find /usr/share/postgresql16 -name "*vector*" -ls
EOF

echo "📦 Building Docker image..."
docker buildx build \
    --platform linux/arm64 \
    -t pgvector-alpine-arm64:latest \
    -f /tmp/Dockerfile.pgvector \
    /tmp

echo ""
echo "📤 Extracting pgvector files..."

# Extract the .so file
docker run --rm --platform linux/arm64 pgvector-alpine-arm64:latest \
    sh -c 'cat /usr/lib/postgresql16/vector.so' > "$OUTPUT_DIR/vector.so"

# Extract the .sql files
docker run --rm --platform linux/arm64 pgvector-alpine-arm64:latest \
    sh -c 'cat /usr/share/postgresql16/extension/vector.control' > "$OUTPUT_DIR/vector.control"

docker run --rm --platform linux/arm64 pgvector-alpine-arm64:latest \
    sh -c 'cat /usr/share/postgresql16/extension/vector--0.8.0.sql' > "$OUTPUT_DIR/vector--0.8.0.sql"

# Get update scripts if they exist
docker run --rm --platform linux/arm64 pgvector-alpine-arm64:latest \
    sh -c 'cat /usr/share/postgresql16/extension/vector--0.7.4--0.8.0.sql' > "$OUTPUT_DIR/vector--0.7.4--0.8.0.sql" 2>/dev/null || true

echo ""
echo "✅ pgvector built successfully!"
echo ""
echo "Files created in $OUTPUT_DIR:"
ls -lh "$OUTPUT_DIR"

echo ""
echo "📊 Binary info:"
file "$OUTPUT_DIR/vector.so"

echo ""
echo "🎯 Next step: Add these files to the initramfs build"

