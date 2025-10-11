#!/bin/bash

# Helper script to create release branches for full CI/CD testing

if [ -z "$1" ]; then
    echo "Usage: ./create-release-branch.sh <version>"
    echo "Example: ./create-release-branch.sh v1.2.0"
    exit 1
fi

VERSION=$1
BRANCH_NAME="release/$VERSION"

echo "🚀 Creating release branch: $BRANCH_NAME"

# Create and switch to release branch
git checkout -b "$BRANCH_NAME"

# Push to trigger full CI/CD
git push -u origin "$BRANCH_NAME"

echo "✅ Release branch created and pushed"
echo "🔄 Full CI/CD pipeline will run automatically"
echo "📊 Monitor progress at: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"
