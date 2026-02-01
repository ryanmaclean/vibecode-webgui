#!/bin/bash
# Script to update the list of merged branches that can be deleted
# This script queries GitHub to find branches that have been merged
# and generates an updated list of branches to delete

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Branch Analysis Script${NC}"
echo "This script identifies merged branches that can be deleted"
echo ""

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

# Output file
OUTPUT_FILE="${1:-docs/branches-to-delete.txt}"
OUTPUT_DIR=$(dirname "$OUTPUT_FILE")

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo -e "${YELLOW}Fetching merged pull requests...${NC}"
# Get all merged PRs and extract branch names
MERGED_BRANCHES=$(gh pr list --repo ryanmaclean/vibecode-webgui \
    --state merged \
    --limit 1000 \
    --json headRefName \
    --jq '.[].headRefName' | sort -u)

if [ -z "$MERGED_BRANCHES" ]; then
    echo -e "${RED}Error: Could not fetch merged branches${NC}"
    exit 1
fi

MERGED_COUNT=$(echo "$MERGED_BRANCHES" | wc -l)
echo -e "${GREEN}Found $MERGED_COUNT merged branches${NC}"

echo -e "${YELLOW}Fetching current remote branches...${NC}"
# Get current remote branches
git fetch --all --prune 2>&1 | grep -v "From " || true
REMOTE_BRANCHES=$(git branch -r | \
    grep -v '\->' | \
    sed 's/origin\///' | \
    sed 's/^[ \t]*//' | \
    sort -u)

REMOTE_COUNT=$(echo "$REMOTE_BRANCHES" | wc -l)
echo -e "${GREEN}Found $REMOTE_COUNT remote branches${NC}"

echo -e "${YELLOW}Finding branches to delete...${NC}"
# Find branches that are both merged and still exist remotely
DELETABLE_BRANCHES=$(comm -12 \
    <(echo "$MERGED_BRANCHES") \
    <(echo "$REMOTE_BRANCHES"))

# Filter out protected branches
DELETABLE_BRANCHES=$(echo "$DELETABLE_BRANCHES" | \
    grep -v -E '^(main|master|develop|staging|production)$' || true)

DELETABLE_COUNT=$(echo "$DELETABLE_BRANCHES" | grep -v '^$' | wc -l)

echo ""
echo -e "${GREEN}Analysis Complete${NC}"
echo "═══════════════════════════════════════════"
echo -e "Total remote branches:     ${BLUE}$REMOTE_COUNT${NC}"
echo -e "Merged branches:           ${BLUE}$MERGED_COUNT${NC}"
echo -e "Branches to delete:        ${YELLOW}$DELETABLE_COUNT${NC}"
echo "═══════════════════════════════════════════"
echo ""

if [ "$DELETABLE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ No branches to delete!${NC}"
    exit 0
fi

# Save to file
echo "$DELETABLE_BRANCHES" > "$OUTPUT_FILE"
echo -e "${GREEN}✓ Saved list to: $OUTPUT_FILE${NC}"
echo ""

# Show sample of branches
echo -e "${YELLOW}Sample of branches to delete (first 20):${NC}"
echo "$DELETABLE_BRANCHES" | head -20
if [ "$DELETABLE_COUNT" -gt 20 ]; then
    echo "... and $((DELETABLE_COUNT - 20)) more"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Review the list: cat $OUTPUT_FILE"
echo "2. Run cleanup script: ./scripts/cleanup-branches.sh $OUTPUT_FILE"
echo "3. Or use GitHub Actions workflow in dry-run mode first"
