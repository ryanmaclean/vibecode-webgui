/**
 * Tests for GitHub Integration commit history features
 */

import { GitHubIntegration } from '@/lib/github/integration'

// Mock @octokit/rest
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      users: {
        getAuthenticated: jest.fn().mockResolvedValue({
          data: {
            login: 'testuser',
            name: 'Test User',
            email: 'test@example.com',
          },
        }),
      },
      repos: {
        listCommits: jest.fn().mockResolvedValue({
          data: [
            {
              sha: 'abc123',
              commit: {
                message: 'Initial commit',
                author: {
                  name: 'Test User',
                  email: 'test@example.com',
                  date: '2024-01-01T00:00:00Z',
                },
                committer: {
                  name: 'Test User',
                  email: 'test@example.com',
                  date: '2024-01-01T00:00:00Z',
                },
              },
              html_url: 'https://github.com/test/repo/commit/abc123',
              stats: {
                additions: 10,
                deletions: 5,
                total: 15,
              },
            },
          ],
        }),
        getCommit: jest.fn().mockResolvedValue({
          data: {
            sha: 'abc123',
            commit: {
              message: 'Initial commit\n\nDetailed description',
              author: {
                name: 'Test User',
                email: 'test@example.com',
                date: '2024-01-01T00:00:00Z',
              },
              committer: {
                name: 'Test User',
                email: 'test@example.com',
                date: '2024-01-01T00:00:00Z',
              },
            },
            author: {
              avatar_url: 'https://github.com/testuser.png',
            },
            html_url: 'https://github.com/test/repo/commit/abc123',
            stats: {
              additions: 10,
              deletions: 5,
              total: 15,
            },
            files: [
              {
                filename: 'test.ts',
                status: 'modified',
                additions: 10,
                deletions: 5,
                changes: 15,
                patch: '@@ -1,5 +1,10 @@',
              },
            ],
            parents: [
              {
                sha: 'parent123',
                html_url: 'https://github.com/test/repo/commit/parent123',
              },
            ],
          },
        }),
        compareCommits: jest.fn().mockResolvedValue({
          data: {
            status: 'ahead',
            ahead_by: 5,
            behind_by: 0,
            total_commits: 5,
            commits: [
              {
                sha: 'abc123',
                commit: {
                  message: 'Test commit',
                  author: {
                    name: 'Test User',
                    date: '2024-01-01T00:00:00Z',
                  },
                },
              },
            ],
            files: [
              {
                filename: 'test.ts',
                status: 'modified',
                additions: 10,
                deletions: 5,
                changes: 15,
              },
            ],
          },
        }),
      },
      search: {
        commits: jest.fn().mockResolvedValue({
          data: {
            total_count: 1,
            incomplete_results: false,
            items: [
              {
                sha: 'abc123',
                commit: {
                  message: 'Search result commit',
                  author: {
                    name: 'Test User',
                    email: 'test@example.com',
                    date: '2024-01-01T00:00:00Z',
                  },
                },
                repository: {
                  name: 'test-repo',
                  full_name: 'testuser/test-repo',
                  html_url: 'https://github.com/testuser/test-repo',
                },
                html_url: 'https://github.com/testuser/test-repo/commit/abc123',
                score: 1.0,
              },
            ],
          },
        }),
      },
    },
  })),
}))

describe('GitHubIntegration - Commit History Features', () => {
  let github: GitHubIntegration

  beforeEach(async () => {
    github = new GitHubIntegration('test-token')
    await github.initialize()
  })

  describe('getCommitHistory', () => {
    it('should fetch commit history for a repository', async () => {
      const commits = await github.getCommitHistory('test-repo')

      expect(commits).toHaveLength(1)
      expect(commits[0]).toMatchObject({
        sha: 'abc123',
        message: 'Initial commit',
        author: {
          name: 'Test User',
          email: 'test@example.com',
        },
      })
    })

    it('should support pagination options', async () => {
      const commits = await github.getCommitHistory('test-repo', {
        per_page: 10,
        page: 2,
      })

      expect(commits).toBeDefined()
    })

    it('should support branch filtering', async () => {
      const commits = await github.getCommitHistory('test-repo', {
        branch: 'main',
      })

      expect(commits).toBeDefined()
    })

    it('should support author filtering', async () => {
      const commits = await github.getCommitHistory('test-repo', {
        author: 'testuser',
      })

      expect(commits).toBeDefined()
    })

    it('should support path filtering', async () => {
      const commits = await github.getCommitHistory('test-repo', {
        path: 'src/index.ts',
      })

      expect(commits).toBeDefined()
    })

    it('should support date range filtering', async () => {
      const commits = await github.getCommitHistory('test-repo', {
        since: '2024-01-01T00:00:00Z',
        until: '2024-12-31T23:59:59Z',
      })

      expect(commits).toBeDefined()
    })
  })

  describe('getCommitDetails', () => {
    it('should fetch detailed information for a specific commit', async () => {
      const commit = await github.getCommitDetails('test-repo', 'abc123')

      expect(commit).toMatchObject({
        sha: 'abc123',
        message: 'Initial commit\n\nDetailed description',
        author: {
          name: 'Test User',
          email: 'test@example.com',
          avatarUrl: 'https://github.com/testuser.png',
        },
        stats: {
          additions: 10,
          deletions: 5,
          total: 15,
        },
      })
    })

    it('should include file changes and patches', async () => {
      const commit = await github.getCommitDetails('test-repo', 'abc123')

      expect(commit.files).toHaveLength(1)
      expect(commit.files[0]).toMatchObject({
        filename: 'test.ts',
        status: 'modified',
        additions: 10,
        deletions: 5,
        patch: '@@ -1,5 +1,10 @@',
      })
    })

    it('should include parent commits', async () => {
      const commit = await github.getCommitDetails('test-repo', 'abc123')

      expect(commit.parents).toHaveLength(1)
      expect(commit.parents[0]).toMatchObject({
        sha: 'parent123',
      })
    })
  })

  describe('searchCommits', () => {
    it('should search commits globally', async () => {
      const results = await github.searchCommits('fix bug')

      expect(results.total).toBe(1)
      expect(results.items).toHaveLength(1)
      expect(results.items[0]).toMatchObject({
        sha: 'abc123',
        message: 'Search result commit',
      })
    })

    it('should support sorting options', async () => {
      const results = await github.searchCommits('test', {
        sort: 'author-date',
        order: 'desc',
      })

      expect(results).toBeDefined()
    })

    it('should support pagination', async () => {
      const results = await github.searchCommits('test', {
        per_page: 20,
        page: 1,
      })

      expect(results).toBeDefined()
    })
  })

  describe('compareCommits', () => {
    it('should compare two commits', async () => {
      const comparison = await github.compareCommits('test-repo', 'base', 'head')

      expect(comparison).toMatchObject({
        status: 'ahead',
        aheadBy: 5,
        behindBy: 0,
        totalCommits: 5,
      })
    })

    it('should include commit list', async () => {
      const comparison = await github.compareCommits('test-repo', 'base', 'head')

      expect(comparison.commits).toHaveLength(1)
      expect(comparison.commits[0]).toMatchObject({
        sha: 'abc123',
        message: 'Test commit',
      })
    })

    it('should include file changes', async () => {
      const comparison = await github.compareCommits('test-repo', 'base', 'head')

      expect(comparison.files).toHaveLength(1)
      expect(comparison.files[0]).toMatchObject({
        filename: 'test.ts',
        status: 'modified',
      })
    })
  })

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      // Override the mock to throw for this test
      const { Octokit } = require('@octokit/rest')
      Octokit.mockImplementationOnce(() => ({
        rest: {
          users: {
            getAuthenticated: jest.fn().mockRejectedValue(new Error('Bad credentials'))
          }
        }
      }))

      const errorGithub = new GitHubIntegration('invalid-token')

      await expect(errorGithub.initialize()).rejects.toThrow()
    })

    it('should handle missing repository errors', async () => {
      const mockError = new Error('Not Found')
      const { Octokit } = require('@octokit/rest')
      Octokit.mockImplementationOnce(() => ({
        rest: {
          users: {
            getAuthenticated: jest.fn().mockResolvedValue({
              data: { login: 'testuser' },
            }),
          },
          repos: {
            listCommits: jest.fn().mockRejectedValue(mockError),
          },
        },
      }))

      const github2 = new GitHubIntegration('test-token')
      await github2.initialize()

      await expect(github2.getCommitHistory('nonexistent-repo')).rejects.toThrow()
    })
  })
})
