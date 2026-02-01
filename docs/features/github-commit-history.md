# GitHub Commit History Browser

## Overview

The GitHub Commit History Browser feature provides a comprehensive interface for browsing, searching, and analyzing commit history from GitHub repositories directly within VibeCode.

## Features

### 1. Commit History Viewer
- **Paginated Commit List**: Browse through commits with pagination support
- **Filtering Options**:
  - Filter by author
  - Filter by file path
  - Filter by date range (since/until)
  - Filter by branch
- **Rich Display**:
  - Commit message (title)
  - Author name and email
  - Commit date (relative time)
  - Additions/deletions statistics
  - Short commit SHA with copy functionality
  - Direct link to GitHub

### 2. Commit Details Panel
- **Comprehensive Commit Information**:
  - Full commit message with description
  - Author and committer details
  - Commit timestamp
  - Parent commits with links
- **File Changes**:
  - List of all changed files
  - Status badges (added, modified, removed, renamed)
  - Line-by-line additions and deletions count
  - Unified diff patches for each file
- **Navigation**:
  - Direct links to GitHub
  - Copy commit SHA functionality

### 3. Commit Search
- **Global Search**: Search commits across all accessible repositories
- **Search Syntax Support**:
  - Free text search in commit messages
  - `author:username` - Filter by author
  - `repo:owner/name` - Filter by repository
  - Any GitHub commit search qualifier
- **Results Display**:
  - Repository name and link
  - Commit message
  - Author and date
  - Direct links to commits

### 4. Commit Comparison
- Compare two commits or branches
- View list of commits between references
- See file changes summary
- Track ahead/behind status

## API Endpoints

### List Commits
```
POST /api/github/commits/list
```

**Request Body:**
```json
{
  "repoName": "owner/repository",
  "accessToken": "ghp_...",
  "branch": "main",
  "author": "username",
  "path": "src/file.ts",
  "since": "2024-01-01T00:00:00Z",
  "until": "2024-12-31T23:59:59Z",
  "per_page": 30,
  "page": 1
}
```

**Response:**
```json
{
  "success": true,
  "commits": [
    {
      "sha": "abc123...",
      "message": "Commit message",
      "author": {
        "name": "John Doe",
        "email": "john@example.com",
        "date": "2024-01-01T00:00:00Z"
      },
      "htmlUrl": "https://github.com/...",
      "stats": {
        "additions": 10,
        "deletions": 5,
        "total": 15
      }
    }
  ],
  "page": 1,
  "per_page": 30
}
```

### Get Commit Details
```
POST /api/github/commits/details
```

**Request Body:**
```json
{
  "repoName": "owner/repository",
  "commitSha": "abc123...",
  "accessToken": "ghp_..."
}
```

**Response:**
```json
{
  "success": true,
  "commit": {
    "sha": "abc123...",
    "message": "Full commit message\n\nDetailed description",
    "author": {
      "name": "John Doe",
      "email": "john@example.com",
      "date": "2024-01-01T00:00:00Z",
      "avatarUrl": "https://github.com/..."
    },
    "stats": {
      "additions": 10,
      "deletions": 5,
      "total": 15
    },
    "files": [
      {
        "filename": "src/file.ts",
        "status": "modified",
        "additions": 10,
        "deletions": 5,
        "changes": 15,
        "patch": "@@ -1,5 +1,10 @@\n..."
      }
    ],
    "parents": [
      {
        "sha": "parent123...",
        "htmlUrl": "https://github.com/..."
      }
    ]
  }
}
```

### Search Commits
```
POST /api/github/commits/search
```

**Request Body:**
```json
{
  "query": "fix bug author:username",
  "accessToken": "ghp_...",
  "sort": "author-date",
  "order": "desc",
  "per_page": 20,
  "page": 1
}
```

**Response:**
```json
{
  "success": true,
  "total": 100,
  "incomplete": false,
  "items": [
    {
      "sha": "abc123...",
      "message": "Fix bug in parser",
      "author": {
        "name": "John Doe",
        "email": "john@example.com",
        "date": "2024-01-01T00:00:00Z"
      },
      "repository": {
        "name": "my-repo",
        "fullName": "owner/my-repo",
        "htmlUrl": "https://github.com/owner/my-repo"
      },
      "htmlUrl": "https://github.com/...",
      "score": 1.0
    }
  ]
}
```

### Compare Commits
```
POST /api/github/commits/compare
```

**Request Body:**
```json
{
  "repoName": "owner/repository",
  "base": "main",
  "head": "feature-branch",
  "accessToken": "ghp_..."
}
```

**Response:**
```json
{
  "success": true,
  "comparison": {
    "status": "ahead",
    "aheadBy": 5,
    "behindBy": 0,
    "totalCommits": 5,
    "commits": [...],
    "files": [...]
  }
}
```

## Components

### CommitHistoryViewer
React component for displaying paginated commit history with filters.

**Props:**
- `repoName: string` - Repository name (owner/repo)
- `accessToken: string` - GitHub Personal Access Token
- `branch?: string` - Branch to view (optional)
- `onCommitClick?: (commitSha: string) => void` - Callback when commit is clicked

**Usage:**
```tsx
import { CommitHistoryViewer } from '@/components/github'

<CommitHistoryViewer
  repoName="owner/repo"
  accessToken={token}
  branch="main"
  onCommitClick={(sha) => console.log('Clicked:', sha)}
/>
```

### CommitDetailsPanel
React component for displaying detailed commit information.

**Props:**
- `repoName: string` - Repository name
- `commitSha: string` - Commit SHA to display
- `accessToken: string` - GitHub PAT
- `onClose?: () => void` - Close callback

**Usage:**
```tsx
import { CommitDetailsPanel } from '@/components/github'

<CommitDetailsPanel
  repoName="owner/repo"
  commitSha="abc123..."
  accessToken={token}
  onClose={() => setSelectedCommit(null)}
/>
```

### CommitSearchBar
React component for searching commits globally.

**Props:**
- `accessToken: string` - GitHub PAT
- `onCommitClick?: (repo: string, commitSha: string) => void` - Callback for results

**Usage:**
```tsx
import { CommitSearchBar } from '@/components/github'

<CommitSearchBar
  accessToken={token}
  onCommitClick={(repo, sha) => {
    console.log('Found in', repo, ':', sha)
  }}
/>
```

## Setup

### 1. Generate GitHub Personal Access Token

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select the following scopes:
   - `repo` (Full control of private repositories)
   - Or just `public_repo` if only accessing public repos
4. Click "Generate token"
5. Copy the token (it won't be shown again)

### 2. Access the Feature

Navigate to `/github-commits` in your VibeCode instance:
```
http://localhost:3000/github-commits
```

### 3. Configure

1. Enter your GitHub Personal Access Token
2. Enter the repository name (e.g., `octocat/Hello-World`)
3. Optionally specify a branch (defaults to `main`)
4. Click "Start Browsing"

## Security Considerations

1. **Token Storage**: Access tokens are stored in component state only and never persisted
2. **API Routes**: All GitHub API calls are proxied through server-side routes
3. **Rate Limiting**: GitHub API rate limits apply (5000 requests/hour for authenticated users)
4. **Permissions**: Token must have appropriate scopes (`repo` or `public_repo`)

## Limitations

1. **Private Repositories**: Requires token with `repo` scope
2. **Rate Limits**: Subject to GitHub API rate limits
3. **Large Diffs**: Very large diffs may take longer to load
4. **Search**: Search is limited to GitHub's search API capabilities

## Troubleshooting

### "Failed to fetch commits"
- Verify your access token is valid
- Check repository name format (must be `owner/repo`)
- Ensure token has required permissions
- Check if repository exists and is accessible

### "Rate limit exceeded"
- Wait for rate limit to reset (shown in error message)
- Consider using a different token
- Reduce frequency of API calls

### Missing commit details
- Ensure commit SHA is correct
- Verify token has access to the repository
- Check if commit exists in the specified repository

## Future Enhancements

- [ ] Blame view integration
- [ ] Branch visualization
- [ ] Commit signing verification display
- [ ] Local git repository integration
- [ ] Commit comment support
- [ ] Pull request linkage
- [ ] Advanced filtering (by file type, commit type)
- [ ] Export commit history (CSV, JSON)
- [ ] Commit statistics and insights
- [ ] Integration with workspace file browser

## Related Documentation

- [GitHub Integration API](./github-integration-api.md)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [VibeCode Architecture](../ARCHITECTURE.md)

## Version History

### v1.0.0 (2024-02-01)
- Initial implementation
- Commit history viewer with pagination
- Commit details panel with diffs
- Global commit search
- Commit comparison feature
- API endpoints for all operations
- Comprehensive test coverage
