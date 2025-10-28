#!/usr/bin/env bash
# Track fast-openvscode package versions automatically
set -euo pipefail

GITHUB_REPO="gitpod-io/openvscode-server"
TRACKING_FILE="artifacts/openvscode-versions.json"
NOTIFY_SLACK="${SLACK_WEBHOOK_URL:-}"

# Ensure artifacts directory exists
mkdir -p "$(dirname "$TRACKING_FILE")"

# Initialize tracking file if it doesn't exist
if [[ ! -f "$TRACKING_FILE" ]]; then
  echo '{"versions": [], "last_check": null}' > "$TRACKING_FILE"
fi

# Fetch latest release info from GitHub
echo "Fetching latest OpenVSCode release..."
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$GITHUB_REPO/releases/latest")
LATEST_VERSION=$(echo "$LATEST_RELEASE" | jq -r '.tag_name')
RELEASE_DATE=$(echo "$LATEST_RELEASE" | jq -r '.published_at')
RELEASE_URL=$(echo "$LATEST_RELEASE" | jq -r '.html_url')

echo "Latest version: $LATEST_VERSION (published: $RELEASE_DATE)"

# Check if this version is already tracked
CURRENT_TRACKED=$(jq -r '.versions[-1].version // "none"' "$TRACKING_FILE")

if [[ "$CURRENT_TRACKED" == "$LATEST_VERSION" ]]; then
  echo "✓ Already tracking latest version: $LATEST_VERSION"
  jq --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.last_check = $date' "$TRACKING_FILE" > "$TRACKING_FILE.tmp"
  mv "$TRACKING_FILE.tmp" "$TRACKING_FILE"
  exit 0
fi

# New version detected!
echo "🆕 New version detected: $LATEST_VERSION (previous: $CURRENT_TRACKED)"

# Add to tracking file
jq --arg version "$LATEST_VERSION" \
   --arg date "$RELEASE_DATE" \
   --arg url "$RELEASE_URL" \
   --arg check_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.versions += [{
      version: $version,
      release_date: $date,
      url: $url,
      detected_at: $check_date
   }] | .last_check = $check_date' \
   "$TRACKING_FILE" > "$TRACKING_FILE.tmp"
mv "$TRACKING_FILE.tmp" "$TRACKING_FILE"

# Create GitHub issue for new version
if command -v gh &> /dev/null; then
  echo "Creating GitHub issue for version update..."
  gh issue create \
    --title "Update fast-openvscode to $LATEST_VERSION" \
    --body "New OpenVSCode Server release detected:

**Version**: $LATEST_VERSION
**Released**: $RELEASE_DATE
**URL**: $RELEASE_URL

**Action Required**:
1. Review release notes
2. Update build configuration
3. Test new version
4. Deploy to insiders channel
5. Monitor for issues

**Automated by**: scripts/track-openvscode-version.sh" \
    --label "enhancement,automation,fast-openvscode" || echo "Failed to create issue (continuing...)"
fi

# Notify Slack if webhook configured
if [[ -n "$NOTIFY_SLACK" ]]; then
  echo "Sending Slack notification..."
  curl -X POST "$NOTIFY_SLACK" \
    -H 'Content-Type: application/json' \
    -d "{\"text\": \"🆕 New OpenVSCode release: $LATEST_VERSION\n<$RELEASE_URL|View Release>\"}" \
    || echo "Failed to send Slack notification (continuing...)"
fi

echo "✓ Version tracking updated: $TRACKING_FILE"
echo "✓ GitHub issue created (if gh CLI available)"
echo "✓ Slack notification sent (if webhook configured)"
