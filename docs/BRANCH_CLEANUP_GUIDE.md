# Branch Cleanup Guide

This guide explains how to clean up merged branches in the vibecode-webgui repository.

## Problem

Over time, Git repositories accumulate many branches that have been merged into the main branch but still exist remotely. These branches take up space and make it harder to find active branches.

**Current Status**: 113 merged branches are still present in the remote repository.

## Solution

We provide three methods to clean up these branches:

### Method 1: GitHub Actions Workflow (Recommended)

The automated workflow is the easiest and safest method.

**Steps:**

1. Go to the **Actions** tab in the GitHub repository
2. Select **"Cleanup Merged Branches"** workflow
3. Click **"Run workflow"**
4. Select `dry_run=true` to preview changes (recommended first)
5. Review the output to see which branches will be deleted
6. Re-run with `dry_run=false` to actually delete the branches

**Features:**
- ✅ Dry-run mode for safe preview
- ✅ Automatic detection of merged branches
- ✅ Protection for main/master branches
- ✅ Summary of deleted/failed branches
- ✅ No local setup required

### Method 2: Shell Script

Use the provided shell script for manual cleanup with interactive confirmation.

**Prerequisites:**
```bash
# Install GitHub CLI if not already installed
# macOS
brew install gh

# Linux
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
  sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] \
  https://cli.github.com/packages stable main" | \
  sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Authenticate
gh auth login
```

**Steps:**
```bash
# 1. Review the list of branches to delete
cat docs/branches-to-delete.txt

# 2. Run the cleanup script
./scripts/cleanup-branches.sh docs/branches-to-delete.txt

# 3. Confirm when prompted
# The script will show progress and a summary
```

**Features:**
- ✅ Interactive confirmation
- ✅ Colored output for easy reading
- ✅ Progress indicators
- ✅ Summary statistics
- ✅ Protection for main/master branches

### Method 3: Manual Deletion via GitHub CLI

For deleting individual branches or small groups.

**Delete a single branch:**
```bash
gh api -X DELETE "repos/ryanmaclean/vibecode-webgui/git/refs/heads/BRANCH_NAME"
```

**Delete multiple branches:**
```bash
# From the list
while IFS= read -r branch; do
  echo "Deleting: $branch"
  gh api -X DELETE \
    "repos/ryanmaclean/vibecode-webgui/git/refs/heads/$branch"
done < docs/branches-to-delete.txt
```

## Branch Categories

The 113 branches to be deleted are organized as follows:

- **Chore branches**: 4 (maintenance and cleanup)
- **Copilot branches**: 2 (AI assistant generated)
- **Feature audit branches**: 82 (feature validation and testing)
- **Fix branches**: 18 (bug fixes and type corrections)
- **Polecat branches**: 6 (automated tooling)
- **Test branches**: 1 (test coverage)

## Safety Measures

All cleanup methods include these safety checks:

1. **Protected Branches**: Branches named `main`, `master`, `develop`, `staging`, or `production` are never deleted
2. **Merged Verification**: Only branches that have been merged via pull requests are considered for deletion
3. **Dry Run Option**: The GitHub Actions workflow defaults to dry-run mode
4. **Interactive Confirmation**: The shell script requires explicit confirmation
5. **No Data Loss**: The code from these branches is already in main

## What Happens After Cleanup?

- ✅ Repository becomes cleaner and easier to navigate
- ✅ List of branches becomes more manageable
- ✅ No code or history is lost (everything is in main)
- ✅ Pull requests remain accessible for reference
- ✅ Reduced storage usage

## Verification

After cleanup, verify the results:

```bash
# Check remaining branches
git fetch --prune
git branch -r | wc -l

# Should show ~292 branches instead of 405
```

## Troubleshooting

**Issue**: `gh` command not found
```bash
# Install GitHub CLI (see prerequisites above)
```

**Issue**: Authentication error
```bash
gh auth login
# Follow the prompts to authenticate
```

**Issue**: Permission denied
- Ensure you have write access to the repository
- Check that you're authenticated with the correct GitHub account

**Issue**: Branch not found
- The branch may have already been deleted
- Run `git fetch --prune` to update your local cache

## Regular Maintenance

To prevent branch accumulation in the future:

1. **Enable automatic branch deletion** in GitHub repository settings:
   - Settings → Options → Automatically delete head branches
2. **Run cleanup periodically** (e.g., quarterly) using the GitHub Actions workflow
3. **Review and delete branches** immediately after PR merge when possible

## Documentation

- Full documentation: [docs/branch-cleanup.md](../docs/branch-cleanup.md)
- List of branches: [docs/branches-to-delete.txt](../docs/branches-to-delete.txt)
- Cleanup script: [scripts/cleanup-branches.sh](cleanup-branches.sh)
- GitHub workflow: [.github/workflows/cleanup-merged-branches.yml](../.github/workflows/cleanup-merged-branches.yml)
