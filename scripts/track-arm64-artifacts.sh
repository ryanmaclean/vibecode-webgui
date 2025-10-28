#!/usr/bin/env bash
# Track arm64 OpenVSCodium Artifacts
# Monitors GitHub releases for new arm64 builds
set -euo pipefail

REPO="gitpod-io/openvscode-server"
TRACKING_FILE="artifacts/arm64-artifacts.json"
ARCH="arm64"

mkdir -p "$(dirname "$TRACKING_FILE")"

# Initialize tracking file
if [[ ! -f "$TRACKING_FILE" ]]; then
  echo '{"artifacts": [], "last_check": null}' > "$TRACKING_FILE"
fi

echo "Fetching latest arm64 artifacts from ${REPO}..."

# Get latest release
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
TAG=$(echo "$LATEST_RELEASE" | jq -r '.tag_name')
PUBLISHED_AT=$(echo "$LATEST_RELEASE" | jq -r '.published_at')

echo "Latest release: $TAG (published: $PUBLISHED_AT)"

# Find arm64 assets
ARM64_ASSETS=$(echo "$LATEST_RELEASE" | jq -r '.assets[] | select(.name | contains("arm64") or contains("aarch64")) | {name: .name, size: .size, url: .browser_download_url, download_count: .download_count}')

if [[ -z "$ARM64_ASSETS" ]]; then
  echo "⚠️  No arm64 artifacts found in $TAG"
  exit 0
fi

echo ""
echo "arm64 artifacts found:"
echo "$ARM64_ASSETS" | jq -r '.name'

# Check if we've already tracked this version
CURRENT_VERSION=$(jq -r '.artifacts[-1].version // "none"' "$TRACKING_FILE")

if [[ "$CURRENT_VERSION" == "$TAG" ]]; then
  echo "✓ Already tracking $TAG"
  jq --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.last_check = $date' "$TRACKING_FILE" > "$TRACKING_FILE.tmp"
  mv "$TRACKING_FILE.tmp" "$TRACKING_FILE"
  exit 0
fi

# New version detected
echo "🆕 New arm64 artifacts detected: $TAG"

# Add to tracking
jq --arg tag "$TAG" \
   --arg published "$PUBLISHED_AT" \
   --argjson assets "$(echo "$ARM64_ASSETS" | jq -s '.')" \
   --arg check_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.artifacts += [{
      version: $tag,
      published_at: $published,
      detected_at: $check_date,
      assets: $assets
   }] | .last_check = $check_date' \
   "$TRACKING_FILE" > "$TRACKING_FILE.tmp"
mv "$TRACKING_FILE.tmp" "$TRACKING_FILE"

# Create GitHub issue if gh CLI available
if command -v gh &> /dev/null; then
  echo "Creating GitHub issue for new arm64 artifacts..."
  
  ASSET_LIST=$(echo "$ARM64_ASSETS" | jq -r '.name' | sed 's/^/- /')
  
  gh issue create \
    --title "New arm64 OpenVSCodium artifacts: $TAG" \
    --body "New arm64 build detected:

**Version**: $TAG
**Published**: $PUBLISHED_AT

**Artifacts**:
$ASSET_LIST

**Action Required**:
1. Download and verify artifacts
2. Test on M-Series hardware
3. Update microVM images if stable
4. Document any breaking changes

**Tracking**: artifacts/arm64-artifacts.json" \
    --label "enhancement,arm64,fast-openvscode" || echo "Failed to create issue"
fi

# Report stats
TOTAL_TRACKED=$(jq '.artifacts | length' "$TRACKING_FILE")
echo ""
echo "✓ Tracking updated: $TRACKING_FILE"
echo "✓ Total versions tracked: $TOTAL_TRACKED"
