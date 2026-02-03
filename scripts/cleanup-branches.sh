#!/bin/bash
# Script to delete merged branches that are no longer needed
# This script identifies and deletes remote branches that have been merged into main

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Branch Cleanup Script${NC}"
echo "This script will delete merged branches from the remote repository"
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

# Get the list of branches to delete
BRANCHES_FILE="${1:-/tmp/branches_to_delete.txt}"

if [ ! -f "$BRANCHES_FILE" ]; then
    echo -e "${RED}Error: Branches file not found: $BRANCHES_FILE${NC}"
    exit 1
fi

# Read branches into array
mapfile -t BRANCHES < "$BRANCHES_FILE"

echo -e "${YELLOW}Found ${#BRANCHES[@]} branches to delete${NC}"
echo ""

# Confirm before proceeding
read -p "Do you want to proceed with deleting these branches? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Delete each branch
DELETED=0
FAILED=0
SKIPPED=0

for branch in "${BRANCHES[@]}"; do
    # Skip empty lines
    if [ -z "$branch" ]; then
        continue
    fi
    
    # Skip main/master branches as protection
    if [[ "$branch" == "main" || "$branch" == "master" ]]; then
        echo -e "${YELLOW}Skipping protected branch: $branch${NC}"
        ((SKIPPED++))
        continue
    fi
    
    echo -n "Deleting branch: $branch ... "
    
    # Try to delete using GitHub CLI
    if gh api -X DELETE "repos/:owner/:repo/git/refs/heads/$branch" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((DELETED++))
    else
        echo -e "${RED}✗${NC}"
        ((FAILED++))
    fi
done

echo ""
echo "Summary:"
echo -e "${GREEN}Deleted: $DELETED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
