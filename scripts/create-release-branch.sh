#!/bin/bash
set -euo pipefail

VERSION=${1:-""}
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 v1.0.0"
  exit 1
fi

BRANCH_NAME="release/$VERSION"

echo "🚀 Creating release branch: $BRANCH_NAME"

# Ensure we're on main and up to date
git checkout main
git pull origin main

# Create and push release branch
git checkout -b "$BRANCH_NAME"
git push -u origin "$BRANCH_NAME"

echo "✅ Release branch created: $BRANCH_NAME"
echo "🔥 Comprehensive CI/CD will run on this branch"
echo "💰 Main branch continues to use lightweight CI"

echo ""
echo "Next steps:"
echo "1. Make your changes on this release branch"
echo "2. Push commits to trigger full CI/CD pipeline"
echo "3. Create PR to main when ready for release"
