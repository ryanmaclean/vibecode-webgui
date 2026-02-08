/**
 * Tests for GitHub Integration
 */

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      users: {
        getAuthenticated: jest.fn(),
      },
      repos: {
        createForAuthenticatedUser: jest.fn(),
        get: jest.fn(),
        listForAuthenticatedUser: jest.fn(),
        listCommits: jest.fn(),
        getCommit: jest.fn(),
        compareCommits: jest.fn(),
        updateBranchProtection: jest.fn(),
      },
      git: {
        getRef: jest.fn(),
        createTree: jest.fn(),
        createCommit: jest.fn(),
        updateRef: jest.fn(),
        createRef: jest.fn(),
      },
      search: {
        commits: jest.fn(),
      },
    },
  })),
}));

import { GitHubIntegration, generateGitHubActionsWorkflow } from '../integration';
import { Octokit } from '@octokit/rest';

describe('GitHubIntegration', () => {
  let github: GitHubIntegration;
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    github = new GitHubIntegration('test-token', 'test-owner');
    mockOctokit = (Octokit as any).mock.results[0]?.value || (Octokit as unknown as jest.Mock).mock.results.slice(-1)[0]?.value;
  });

  // ==== Initialize ====

  describe('initialize', () => {
    it('authenticates and returns user info', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser', name: 'Test User', email: 'test@test.com' },
      });

      const result = await github.initialize();
      expect(result.login).toBe('testuser');
      expect(result.name).toBe('Test User');
      expect(result.email).toBe('test@test.com');
    });

    it('uses login as fallback for name', async () => {
      mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
        data: { login: 'testuser', name: null, email: null },
      });

      const result = await github.initialize();
      expect(result.name).toBe('testuser');
      expect(result.email).toBe('testuser@users.noreply.github.com');
    });

    it('throws on auth failure', async () => {
      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(new Error('401'));
      await expect(github.initialize()).rejects.toThrow('Failed to authenticate');
    });
  });

  // ==== Create Repository ====

  describe('createRepository', () => {
    it('creates repository and returns result', async () => {
      mockOctokit.rest.repos.createForAuthenticatedUser.mockResolvedValue({
        data: {
          id: 123,
          name: 'test-repo',
          full_name: 'test-owner/test-repo',
          html_url: 'https://github.com/test-owner/test-repo',
          clone_url: 'https://github.com/test-owner/test-repo.git',
          ssh_url: 'git@github.com:test-owner/test-repo.git',
          default_branch: 'main',
        },
      });

      const result = await github.createRepository({
        name: 'test-repo',
        accessToken: 'token',
      });

      expect(result.repository.name).toBe('test-repo');
      expect(result.repository.fullName).toBe('test-owner/test-repo');
      expect(result.setupInstructions).toHaveLength(5);
      expect(result.setupInstructions[0]).toContain('git clone');
    });

    it('validates name length', async () => {
      await expect(
        github.createRepository({ name: '', accessToken: 'token' })
      ).rejects.toThrow();
    });

    it('throws on API error', async () => {
      mockOctokit.rest.repos.createForAuthenticatedUser.mockRejectedValue(new Error('422'));
      await expect(
        github.createRepository({ name: 'test', accessToken: 'token' })
      ).rejects.toThrow('Failed to create repository');
    });
  });

  // ==== Upload Files ====

  describe('uploadFiles', () => {
    it('uploads files to existing repo', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: { default_branch: 'main' },
      });
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'abc123' } },
      });
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'tree-sha' },
      });
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: 'commit-sha' },
      });
      mockOctokit.rest.git.updateRef.mockResolvedValue({});

      await github.uploadFiles('test-repo', [
        { path: 'README.md', content: '# Test' },
      ]);

      expect(mockOctokit.rest.git.createTree).toHaveBeenCalled();
      expect(mockOctokit.rest.git.createCommit).toHaveBeenCalled();
      expect(mockOctokit.rest.git.updateRef).toHaveBeenCalled();
    });

    it('creates ref for empty repos', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: { default_branch: 'main' },
      });
      mockOctokit.rest.git.getRef.mockRejectedValue(new Error('404'));
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'tree-sha' },
      });
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: 'commit-sha' },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({});

      await github.uploadFiles('test-repo', [
        { path: 'file.txt', content: 'hello' },
      ]);

      expect(mockOctokit.rest.git.createRef).toHaveBeenCalled();
    });

    it('throws on upload error', async () => {
      mockOctokit.rest.repos.get.mockRejectedValue(new Error('404'));
      await expect(
        github.uploadFiles('missing-repo', [{ path: 'f.txt', content: 'x' }])
      ).rejects.toThrow('Failed to upload files');
    });
  });

  // ==== Commit History ====

  describe('getCommitHistory', () => {
    it('returns formatted commit list', async () => {
      mockOctokit.rest.repos.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'abc',
            commit: {
              message: 'Initial commit',
              author: { name: 'Dev', email: 'dev@test.com', date: '2024-01-01' },
              committer: { name: 'Dev', email: 'dev@test.com', date: '2024-01-01' },
            },
            html_url: 'https://github.com/test/commit/abc',
            stats: { additions: 10, deletions: 5, total: 15 },
          },
        ],
      });

      const commits = await github.getCommitHistory('test-repo');
      expect(commits).toHaveLength(1);
      expect(commits[0].sha).toBe('abc');
      expect(commits[0].message).toBe('Initial commit');
      expect(commits[0].stats?.additions).toBe(10);
    });

    it('handles missing author gracefully', async () => {
      mockOctokit.rest.repos.listCommits.mockResolvedValue({
        data: [
          {
            sha: 'abc',
            commit: { message: 'msg', author: null, committer: null },
            html_url: 'https://test',
          },
        ],
      });

      const commits = await github.getCommitHistory('test-repo');
      expect(commits[0].author.name).toBe('Unknown');
    });
  });

  // ==== Commit Details ====

  describe('getCommitDetails', () => {
    it('returns detailed commit info', async () => {
      mockOctokit.rest.repos.getCommit.mockResolvedValue({
        data: {
          sha: 'abc',
          commit: {
            message: 'Fix bug',
            author: { name: 'Dev', email: 'dev@test.com', date: '2024-01-01' },
            committer: { name: 'Dev', email: 'dev@test.com', date: '2024-01-01' },
          },
          author: { avatar_url: 'https://avatar.url' },
          html_url: 'https://test',
          stats: { additions: 1, deletions: 1, total: 2 },
          files: [
            { filename: 'file.ts', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '@@ -1 +1 @@' },
          ],
          parents: [{ sha: 'parent', html_url: 'https://parent' }],
        },
      });

      const detail = await github.getCommitDetails('test-repo', 'abc');
      expect(detail.sha).toBe('abc');
      expect(detail.files).toHaveLength(1);
      expect(detail.parents).toHaveLength(1);
      expect(detail.author.avatarUrl).toBe('https://avatar.url');
    });
  });

  // ==== Search Commits ====

  describe('searchCommits', () => {
    it('searches commits by query', async () => {
      mockOctokit.rest.search.commits.mockResolvedValue({
        data: {
          total_count: 1,
          incomplete_results: false,
          items: [
            {
              sha: 'abc',
              commit: {
                message: 'fix: bug',
                author: { name: 'Dev', email: 'dev@test.com', date: '2024-01-01' },
              },
              repository: { name: 'repo', full_name: 'owner/repo', html_url: 'https://test' },
              html_url: 'https://commit',
              score: 1.0,
            },
          ],
        },
      });

      const result = await github.searchCommits('fix');
      expect(result.total).toBe(1);
      expect(result.items[0].sha).toBe('abc');
    });
  });

  // ==== Compare Commits ====

  describe('compareCommits', () => {
    it('compares two commits', async () => {
      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: {
          status: 'ahead',
          ahead_by: 3,
          behind_by: 0,
          total_commits: 3,
          commits: [
            { sha: 'c1', commit: { message: 'feat', author: { name: 'Dev', date: '2024-01-01' } } },
          ],
          files: [
            { filename: 'file.ts', status: 'modified', additions: 1, deletions: 0, changes: 1 },
          ],
        },
      });

      const result = await github.compareCommits('test-repo', 'main', 'feature');
      expect(result.status).toBe('ahead');
      expect(result.aheadBy).toBe(3);
      expect(result.commits).toHaveLength(1);
      expect(result.files).toHaveLength(1);
    });
  });

  // ==== Repository Name Available ====

  describe('isRepositoryNameAvailable', () => {
    it('returns false when repo exists', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({ data: {} });
      const available = await github.isRepositoryNameAvailable('existing-repo');
      expect(available).toBe(false);
    });

    it('returns true when repo not found', async () => {
      mockOctokit.rest.repos.get.mockRejectedValue({ status: 404 });
      const available = await github.isRepositoryNameAvailable('new-repo');
      expect(available).toBe(true);
    });

    it('throws on other errors', async () => {
      mockOctokit.rest.repos.get.mockRejectedValue(new Error('500'));
      await expect(github.isRepositoryNameAvailable('repo')).rejects.toThrow();
    });
  });

  // ==== User Repositories ====

  describe('getUserRepositories', () => {
    it('returns formatted repo list', async () => {
      mockOctokit.rest.repos.listForAuthenticatedUser.mockResolvedValue({
        data: [
          {
            id: 1,
            name: 'repo1',
            full_name: 'user/repo1',
            description: 'A repo',
            html_url: 'https://github.com/user/repo1',
            private: false,
            created_at: '2024-01-01',
            updated_at: '2024-02-01',
            language: 'TypeScript',
            stargazers_count: 10,
            forks_count: 2,
          },
        ],
      });

      const repos = await github.getUserRepositories();
      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe('repo1');
      expect(repos[0].language).toBe('TypeScript');
    });
  });

  // ==== Branch Protection ====

  describe('setupBranchProtection', () => {
    it('sets up branch protection', async () => {
      mockOctokit.rest.repos.updateBranchProtection.mockResolvedValue({});
      await github.setupBranchProtection('test-repo', 'main', {
        requirePullRequestReviews: true,
        requiredReviewers: 2,
      });

      expect(mockOctokit.rest.repos.updateBranchProtection).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'main',
          required_pull_request_reviews: expect.objectContaining({
            required_approving_review_count: 2,
          }),
        })
      );
    });
  });
});

// ==== generateGitHubActionsWorkflow ====

describe('generateGitHubActionsWorkflow', () => {
  it('generates Node.js workflow for JavaScript', () => {
    const wf = generateGitHubActionsWorkflow('web', 'javascript');
    expect(wf).toContain('Node.js CI/CD');
    expect(wf).toContain('npm ci');
  });

  it('generates Node.js workflow for TypeScript', () => {
    const wf = generateGitHubActionsWorkflow('web', 'typescript');
    expect(wf).toContain('Node.js CI/CD');
  });

  it('generates Node.js workflow for nextjs framework', () => {
    const wf = generateGitHubActionsWorkflow('web', 'go', 'nextjs');
    expect(wf).toContain('Node.js CI/CD');
  });

  it('generates Python workflow', () => {
    const wf = generateGitHubActionsWorkflow('api', 'python');
    expect(wf).toContain('Python CI/CD');
    expect(wf).toContain('pytest');
  });

  it('generates Docker workflow for unknown languages', () => {
    const wf = generateGitHubActionsWorkflow('api', 'rust');
    expect(wf).toContain('Docker CI/CD');
    expect(wf).toContain('docker build');
  });
});
