#!/bin/bash
# Standup report generator for GitHub Actions

# Configuration
REPO_OWNER="$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f1)"
REPO_NAME="$(echo "$GITHUB_REPOSITORY" | cut -d'/' -f2)"
DAYS_BACK=1

# Get current date
DATE=$(date +"%Y-%m-%d")

# Get recent commits
echo "## 📅 Standup Report for ${DATE}"
echo "### 🔄 Recent Changes"
echo "\`\`\`"
git log --since="${DAYS_BACK} days ago" --pretty=format:"%h - %s (%an)" --abbrev-commit

echo -e "\n\`\`\`"

# Get open PRs
echo "### 📌 Open Pull Requests"
gh pr list --json number,title,author,updatedAt --template '{{range .}}\* [#{{.number}}]({{$.repo.html_url}}/pull/{{.number}}) {{.title}} - {{.author.login}} ({{.updatedAt | timeago}})\n{{end}}' --repo "$GITHUB_REPOSITORY"

# Get recent workflow runs
echo -e "\n### ⚙️ Recent Workflow Runs"
gh run list --limit 3 --json status,conclusion,event,headBranch,updatedAt,url --template '{{range .}}\* [{{.event}}] {{.headBranch}} - {{.status}} {{if eq .status "completed"}}{{.conclusion}}{{end}} ([View]({{.url}}))\n{{end}}' --repo "$GITHUB_REPOSITORY"

echo -e "\n### 📊 Code Review Status"
gh pr list --search "review-requested:@me" --json title,number,author --template '{{range .}}\* [PR #{{.number}}]({{$.repo.html_url}}/pull/{{.number}}) - {{.title}} ({{.author.login}})\n{{end}}' --repo "$GITHUB_REPOSITORY"
