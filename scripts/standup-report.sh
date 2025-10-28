#!/bin/bash
# Standup report generator for GitHub Actions

set -euo pipefail

# Configuration
REPO_OWNER="$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f1)"
REPO_NAME="$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f2)"
DAYS_BACK=1

# Get current date
DATE=$(date +"%Y-%m-%d")

# Get repository URL
REPO_URL="https://github.com/${GITHUB_REPOSITORY}"

# Start report
echo "## 📅 Standup Report for ${DATE}"
echo ""

# Get recent commits
echo "### 🔄 Recent Changes"
echo ""
COMMIT_COUNT=$(git log --since="${DAYS_BACK} days ago" --oneline | wc -l)

if [ "$COMMIT_COUNT" -gt 0 ]; then
    echo "\`\`\`"
    git log --since="${DAYS_BACK} days ago" --pretty=format:"%h - %s (%an)" --abbrev-commit
    echo -e "\n\`\`\`"
else
    echo "No commits in the last ${DAYS_BACK} day(s)"
fi

echo ""

# Get open PRs
echo "### 📌 Open Pull Requests"
echo ""

PR_OUTPUT=$(gh pr list --json number,title,author,updatedAt --limit 10 2>/dev/null || echo "[]")

if [ "$PR_OUTPUT" != "[]" ] && [ -n "$PR_OUTPUT" ]; then
    echo "$PR_OUTPUT" | jq -r '.[] | "* [#\(.number)](\(env.REPO_URL)/pull/\(.number)) \(.title) - @\(.author.login)"'
else
    echo "No open pull requests"
fi

echo ""

# Get recent workflow runs
echo "### ⚙️ Recent Workflow Runs"
echo ""

WORKFLOW_OUTPUT=$(gh run list --limit 5 --json status,conclusion,event,headBranch,updatedAt,url 2>/dev/null || echo "[]")

if [ "$WORKFLOW_OUTPUT" != "[]" ] && [ -n "$WORKFLOW_OUTPUT" ]; then
    echo "$WORKFLOW_OUTPUT" | jq -r '.[] | "* [\(.event)] \(.headBranch) - \(.status) \(if .conclusion then .conclusion else "" end) ([View](\(.url)))"'
else
    echo "No recent workflow runs"
fi

echo ""

# Get issues requiring review
echo "### 📊 Issues & Reviews"
echo ""

REVIEW_COUNT=$(gh pr list --search "review-requested:@me" --json number 2>/dev/null | jq '. | length' || echo "0")
ASSIGNED_ISSUES=$(gh issue list --assignee "@me" --json number 2>/dev/null | jq '. | length' || echo "0")

echo "* Pull requests requiring review: **${REVIEW_COUNT}**"
echo "* Issues assigned to me: **${ASSIGNED_ISSUES}**"

if [ "$REVIEW_COUNT" -gt 0 ]; then
    echo ""
    echo "**Reviews needed:**"
    gh pr list --search "review-requested:@me" --json title,number,author 2>/dev/null | \
        jq -r '.[] | "* [PR #\(.number)](\(env.REPO_URL)/pull/\(.number)) - \(.title) (@\(.author.login))"' || echo "Unable to fetch review details"
fi

echo ""
echo "---"
echo "_Generated automatically by GitHub Actions on ${DATE}_"
