#!/bin/bash
<<<<<<< HEAD

# Helper script to create release branches for full CI/CD testing

if [ -z "$1" ]; then
    echo "Usage: ./create-release-branch.sh <version>"
    echo "Example: ./create-release-branch.sh v1.2.0"
    exit 1
fi

VERSION=$1
=======
set -euo pipefail

VERSION=${1:-""}
if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 v1.0.0"
  exit 1
fi

>>>>>>> merge-conflict-cleanup
BRANCH_NAME="release/$VERSION"

echo "🚀 Creating release branch: $BRANCH_NAME"

<<<<<<< HEAD
# Create and switch to release branch
git checkout -b "$BRANCH_NAME"

# Push to trigger full CI/CD
git push -u origin "$BRANCH_NAME"

echo "✅ Release branch created and pushed"
echo "🔄 Full CI/CD pipeline will run automatically"
echo "📊 Monitor progress at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
=======
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
>>>>>>> merge-conflict-cleanup
