# Git Integration Guide

VibeCode provides comprehensive Git integration through OpenVSCode Server and GitHub API integration.

## Overview

Git functionality in VibeCode is available through two primary mechanisms:

1. **OpenVSCode Server IDE** (Recommended for users) - Full VS Code Git experience
2. **GitHub API Integration** (For developers/automation) - Programmatic Git operations

## Using Git in OpenVSCode Server IDE

### Accessing Git Features

OpenVSCode Server runs in your VM environment and provides the complete VS Code Source Control experience:

1. **Open your workspace** in VibeCode
2. **Launch the IDE** (OpenVSCode Server will start automatically)
3. **Access Source Control** via the sidebar icon (usually 3rd icon) or `Ctrl+Shift+G` / `Cmd+Shift+G`

### Core Git Operations

#### Branch Management

**Create a New Branch:**
1. Click the branch name in the status bar (bottom-left)
2. Select "Create new branch..."
3. Enter branch name and press Enter

**Switch Branches:**
1. Click the branch name in the status bar
2. Select the branch you want to switch to from the list

**Merge Branches:**
1. Switch to the target branch (e.g., `main`)
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Type "Git: Merge Branch"
4. Select the branch to merge

#### Committing Changes

1. **View Changes:** Open Source Control panel to see modified files
2. **Stage Changes:** Click the `+` icon next to files you want to commit
3. **Write Commit Message:** Enter your message in the text box at the top
4. **Commit:** Click the checkmark icon or press `Ctrl+Enter` / `Cmd+Enter`

#### Push and Pull

**Push Changes:**
- Click the sync icon in the status bar, or
- Open Command Palette → "Git: Push"

**Pull Changes:**
- Click the sync icon in the status bar, or
- Open Command Palette → "Git: Pull"

#### Visual Diff

**View File Differences:**
1. In Source Control panel, click on a modified file
2. Split view shows original (left) vs. modified (right)
3. Use inline controls to stage/unstage specific changes

**Compare with Previous Commits:**
1. Open Command Palette
2. Type "Git: View History" or "Git: View File History"
3. Select commit to compare

### Advanced Features

#### GitLens Extension

If GitLens is installed in your OpenVSCode Server:

- **Blame annotations:** See who modified each line
- **Code lens:** View recent commits above functions/classes
- **Interactive rebase:** Visual rebase editor
- **File history:** Rich commit history visualization

#### Terminal Git Commands

For advanced operations, use the integrated terminal:

```bash
# Open terminal in IDE (Ctrl+` or Cmd+`)
git status
git log --oneline --graph
git rebase -i HEAD~3
git cherry-pick <commit-hash>
```

### Authentication

#### GitHub Authentication

**Configure Git credentials:**
1. Open terminal in OpenVSCode Server
2. Set your Git identity:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

**Authenticate with GitHub:**
- OpenVSCode Server supports GitHub authentication
- On first push/pull, you'll be prompted to authenticate
- Follow the device flow or personal access token flow

#### SSH Keys (Alternative)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub: Settings → SSH Keys → New SSH Key
```

## GitHub API Integration (Developers)

For programmatic operations and automation, use the GitHub API integration.

### Creating a Repository

```typescript
import { GitHubIntegration } from '@/lib/github/integration'

const github = new GitHubIntegration(accessToken)
await github.initialize()

const result = await github.createRepository({
  name: 'my-project',
  description: 'My awesome project',
  private: false,
  accessToken: accessToken
})

console.log('Repository created:', result.repository.htmlUrl)
```

### Branch Operations via API

```typescript
// Create a branch
await octokit.rest.git.createRef({
  owner: 'your-username',
  repo: 'your-repo',
  ref: 'refs/heads/new-feature',
  sha: baseCommitSha
})

// Get branch reference
const { data: ref } = await octokit.rest.git.getRef({
  owner: 'your-username',
  repo: 'your-repo',
  ref: 'heads/main'
})
```

### Automated Workflows

The CI Self-Healing system uses GitHub API for automated branch operations:

```typescript
// Automatically creates fix branches
// Pattern: ci-fix/{headBranch}-{timestamp}
// Creates PR with fixes
// See: src/lib/ci-self-healing/fix-generator.ts
```

## Limitations

### Web UI Does Not Include Git Controls

The VibeCode web interface does **not** provide standalone Git UI components. This is intentional:

- ✅ **Use OpenVSCode Server IDE** for Git operations (recommended)
- ✅ **Use GitHub API** for programmatic operations
- ❌ **Web UI** does not duplicate IDE functionality

**Rationale:** OpenVSCode Server provides a mature, feature-complete Git experience that would be difficult and redundant to replicate in the web UI.

### Remote Operations Only (GitHub API)

GitHub API integration works with remote repositories only:

- ✅ Create/manage GitHub repositories
- ✅ Branch operations on GitHub repos
- ❌ Local-only repositories (use IDE terminal instead)

## Troubleshooting

### "Git not found" Error

If you see this error in OpenVSCode Server:

```bash
# In IDE terminal, verify Git is installed
git --version

# If not installed (Alpine Linux VM):
apk add git
```

### Authentication Issues

**Personal Access Token (PAT):**
1. Generate PAT on GitHub: Settings → Developer settings → Personal access tokens
2. Use PAT as password when prompted
3. Grant appropriate scopes: `repo`, `workflow`

**SSH Authentication:**
1. Ensure SSH key is added to GitHub
2. Use SSH clone URL: `git@github.com:user/repo.git`
3. Test connection: `ssh -T git@github.com`

### Merge Conflicts

**Resolve in IDE:**
1. OpenVSCode Server shows conflict markers
2. Use integrated merge editor (3-way merge)
3. Stage resolved files
4. Continue merge/rebase

**Alternative (Terminal):**
```bash
# View conflicts
git status

# Edit files to resolve
# Stage resolved files
git add <file>

# Continue merge
git merge --continue
# OR continue rebase
git rebase --continue
```

## Best Practices

### Branch Naming Conventions

```
feature/user-authentication
bugfix/login-error
hotfix/security-patch
release/v1.2.0
```

### Commit Messages

Follow conventional commits:
```
feat: add user authentication
fix: resolve login error on Safari
docs: update Git integration guide
refactor: simplify branch creation logic
test: add tests for GitHub integration
```

### Workflow Recommendations

1. **Create feature branches** for new work
2. **Commit frequently** with descriptive messages
3. **Pull before push** to avoid conflicts
4. **Use PRs** for code review (GitHub web UI)
5. **Keep branches short-lived** (merge or delete)

## Additional Resources

### VS Code Git Documentation
- [VS Code Source Control](https://code.visualstudio.com/docs/sourcecontrol/overview)
- [VS Code GitHub Integration](https://code.visualstudio.com/docs/sourcecontrol/github)

### GitHub Documentation
- [GitHub API - Git References](https://docs.github.com/en/rest/git/refs)
- [GitHub Authentication](https://docs.github.com/en/authentication)

### Internal Documentation
- **Branch Management Audit:** `docs/feature-audits/feature-audit-branch-management.md`
- **Git Integration Audit:** `docs/feature-audits/feature-audit-1437-git-integration.md`
- **GitHub Integration Code:** `src/lib/github/integration.ts`
- **CI Self-Healing:** `src/lib/ci-self-healing/`

## Support

For issues with Git integration:

1. **IDE Git issues:** Check OpenVSCode Server logs in VM
2. **GitHub API issues:** Verify token permissions and rate limits
3. **Authentication issues:** Confirm credentials and network access
4. **General help:** Refer to VS Code Git documentation

---

**Note:** Git integration in VibeCode leverages industry-standard tools (VS Code, GitHub API) to provide a familiar, powerful experience without reinventing the wheel.
