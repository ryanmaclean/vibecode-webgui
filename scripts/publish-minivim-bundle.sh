#!/usr/bin/env bash
# Publish MiniVim Multi-Arch Release Bundle
# Creates and publishes kernel bundles for all architectures
set -euo pipefail

VERSION="${1:-6.17.14}"
RELEASE_TAG="${2:-minivim-${VERSION}}"
ARTIFACTS_DIR="artifacts/minivim"
BUNDLE_DIR="${ARTIFACTS_DIR}/release"

echo "=== MiniVim Multi-Arch Release ==="
echo "Version: $VERSION"
echo "Tag: $RELEASE_TAG"
echo ""

mkdir -p "$BUNDLE_DIR"

# Check for built kernels
ARCHES=("x86_64" "arm64" "armv7")
MISSING_ARCHES=()

for arch in "${ARCHES[@]}"; do
  KERNEL_FILE="bench-images/minivim/bzImage-${arch}"
  if [[ ! -f "$KERNEL_FILE" ]]; then
    echo "⚠️  Missing kernel for ${arch}: $KERNEL_FILE"
    MISSING_ARCHES+=("$arch")
  else
    echo "✓ Found kernel for ${arch}"
  fi
done

if [[ ${#MISSING_ARCHES[@]} -gt 0 ]]; then
  echo ""
  echo "Building missing architectures: ${MISSING_ARCHES[*]}"
  for arch in "${MISSING_ARCHES[@]}"; do
    echo "  Building $arch..."
    ./scripts/benchmarks/build-minivim-kernel.sh "$arch" "$VERSION" || {
      echo "❌ Build failed for $arch"
      exit 1
    }
  done
fi

# Create release bundle
echo ""
echo "Creating release bundle..."

BUNDLE_FILE="${BUNDLE_DIR}/minivim-${VERSION}-multi-arch.tar.gz"
METADATA_FILE="${BUNDLE_DIR}/minivim-${VERSION}.json"

# Generate metadata
cat > "$METADATA_FILE" <<EOF
{
  "version": "${VERSION}",
  "release_tag": "${RELEASE_TAG}",
  "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "architectures": [
EOF

FIRST=true
for arch in "${ARCHES[@]}"; do
  KERNEL_FILE="bench-images/minivim/bzImage-${arch}"
  
  if [[ ! -f "$KERNEL_FILE" ]]; then
    continue
  fi
  
  SIZE=$(stat -f%z "$KERNEL_FILE" 2>/dev/null || stat -c%s "$KERNEL_FILE" 2>/dev/null)
  SHA256=$(shasum -a 256 "$KERNEL_FILE" | awk '{print $1}')
  
  if [[ "$FIRST" == "true" ]]; then
    FIRST=false
  else
    echo "," >> "$METADATA_FILE"
  fi
  
  cat >> "$METADATA_FILE" <<EOF
    {
      "arch": "${arch}",
      "kernel_file": "bzImage-${arch}",
      "size_bytes": ${SIZE},
      "sha256": "${SHA256}"
    }
EOF
done

cat >> "$METADATA_FILE" <<EOF

  ],
  "boot_target": "<10s",
  "memory_target": "<512MB"
}
EOF

echo "✓ Metadata created: $METADATA_FILE"

# Create tarball
echo "Creating tarball..."
tar -czf "$BUNDLE_FILE" \
  -C bench-images/minivim bzImage-x86_64 bzImage-arm64 bzImage-armv7 2>/dev/null || \
  tar -czf "$BUNDLE_FILE" -C bench-images/minivim $(ls bench-images/minivim/bzImage-* 2>/dev/null | xargs -n1 basename)

echo "✓ Bundle created: $BUNDLE_FILE"

# Generate checksums
echo "Generating checksums..."
cd "$BUNDLE_DIR"
shasum -a 256 "minivim-${VERSION}-multi-arch.tar.gz" > "minivim-${VERSION}.sha256"
cd - > /dev/null

echo "✓ Checksums: ${BUNDLE_DIR}/minivim-${VERSION}.sha256"

# Display summary
BUNDLE_SIZE=$(du -h "$BUNDLE_FILE" | awk '{print $1}')

echo ""
echo "=== Release Summary ==="
echo "Version: $VERSION"
echo "Bundle: $BUNDLE_FILE ($BUNDLE_SIZE)"
echo "Architectures: ${ARCHES[*]}"
echo ""
jq . "$METADATA_FILE"

# Create GitHub release if gh CLI available
if command -v gh &> /dev/null; then
  echo ""
  read -p "Create GitHub release? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating GitHub release..."
    
    gh release create "$RELEASE_TAG" \
      --title "MiniVim ${VERSION} Multi-Arch" \
      --notes "MiniVim kernel release ${VERSION}

**Architectures**: x86_64, arm64, armv7
**Kernel Version**: ${VERSION}
**Performance Targets**: <10s boot, <512MB memory

**Files**:
- \`minivim-${VERSION}-multi-arch.tar.gz\` - Kernel bundle
- \`minivim-${VERSION}.json\` - Metadata
- \`minivim-${VERSION}.sha256\` - Checksums

**Verification**:
\`\`\`bash
shasum -a 256 -c minivim-${VERSION}.sha256
\`\`\`" \
      "${BUNDLE_FILE}" \
      "${METADATA_FILE}" \
      "${BUNDLE_DIR}/minivim-${VERSION}.sha256" || {
        echo "❌ Release creation failed"
        exit 1
      }
    
    echo "✅ Release published: $RELEASE_TAG"
  fi
fi

echo ""
echo "✓ Release bundle ready: $BUNDLE_DIR"
