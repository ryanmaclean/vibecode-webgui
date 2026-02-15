import { test, expect, describe, beforeEach } from 'bun:test'
import {
  isGitHubCLIAvailable,
  isGitLabCLIAvailable,
  clearCliCache,
  listPullRequests,
  getPullRequest,
  listMergeRequests,
  getMergeRequest,
  formatPRContext,
  formatMRContext,
} from './pr'
import type { PullRequestDetails, MergeRequestDetails } from './lib'

// Reset CLI cache before each test to ensure clean state
beforeEach(() => {
  clearCliCache()
})

describe('CLI Availability Functions', () => {
  describe('isGitHubCLIAvailable', () => {
    test('returns a boolean', async () => {
      const result = await isGitHubCLIAvailable()
      expect(typeof result).toBe('boolean')
    })

    test('caches result on subsequent calls', async () => {
      const first = await isGitHubCLIAvailable()
      const second = await isGitHubCLIAvailable()
      expect(first).toBe(second)
    })
  })

  describe('isGitLabCLIAvailable', () => {
    test('returns a boolean', async () => {
      const result = await isGitLabCLIAvailable()
      expect(typeof result).toBe('boolean')
    })

    test('caches result on subsequent calls', async () => {
      const first = await isGitLabCLIAvailable()
      const second = await isGitLabCLIAvailable()
      expect(first).toBe(second)
    })
  })

  describe('clearCliCache', () => {
    test('clears the cache without error', () => {
      // Should not throw
      expect(() => clearCliCache()).not.toThrow()
    })

    test('allows re-checking CLI availability after clearing', async () => {
      // First call to populate cache
      await isGitHubCLIAvailable()
      await isGitLabCLIAvailable()

      // Clear and check again
      clearCliCache()

      // These should work without error
      const gh = await isGitHubCLIAvailable()
      const glab = await isGitLabCLIAvailable()

      expect(typeof gh).toBe('boolean')
      expect(typeof glab).toBe('boolean')
    })
  })
})

describe('GitHub Pull Request Functions', () => {
  describe('listPullRequests', () => {
    test('returns an array', async () => {
      const result = await listPullRequests()
      expect(Array.isArray(result)).toBe(true)
    })

    test('returns empty array when gh CLI is not available', async () => {
      // If gh is not available, should gracefully return empty array
      const ghAvailable = await isGitHubCLIAvailable()
      if (!ghAvailable) {
        const result = await listPullRequests()
        expect(result).toEqual([])
      }
    })
  })

  describe('getPullRequest', () => {
    test('returns null for invalid PR number (0)', async () => {
      const result = await getPullRequest(0)
      expect(result).toBeNull()
    })

    test('returns null for invalid PR number (negative)', async () => {
      const result = await getPullRequest(-1)
      expect(result).toBeNull()
    })

    test('returns null for invalid PR number (non-integer)', async () => {
      const result = await getPullRequest(1.5)
      expect(result).toBeNull()
    })

    test('returns null or PullRequestDetails for valid PR number', async () => {
      const result = await getPullRequest(1)
      // Either null (not found or CLI unavailable) or a valid PR object
      expect(result === null || typeof result === 'object').toBe(true)
    })
  })
})

describe('GitLab Merge Request Functions', () => {
  describe('listMergeRequests', () => {
    test('returns an array', async () => {
      const result = await listMergeRequests()
      expect(Array.isArray(result)).toBe(true)
    })

    test('returns empty array when glab CLI is not available', async () => {
      // If glab is not available, should gracefully return empty array
      const glabAvailable = await isGitLabCLIAvailable()
      if (!glabAvailable) {
        const result = await listMergeRequests()
        expect(result).toEqual([])
      }
    })
  })

  describe('getMergeRequest', () => {
    test('returns null for invalid MR IID (0)', async () => {
      const result = await getMergeRequest(0)
      expect(result).toBeNull()
    })

    test('returns null for invalid MR IID (negative)', async () => {
      const result = await getMergeRequest(-1)
      expect(result).toBeNull()
    })

    test('returns null for invalid MR IID (non-integer)', async () => {
      const result = await getMergeRequest(1.5)
      expect(result).toBeNull()
    })

    test('returns null or MergeRequestDetails for valid MR IID', async () => {
      const result = await getMergeRequest(1)
      // Either null (not found or CLI unavailable) or a valid MR object
      expect(result === null || typeof result === 'object').toBe(true)
    })
  })
})

describe('Format Functions', () => {
  describe('formatPRContext', () => {
    const createMockPR = (overrides?: Partial<PullRequestDetails>): PullRequestDetails => ({
      number: 123,
      title: 'Test PR',
      state: 'open',
      author: {
        login: 'testuser',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      },
      body: 'This is a test pull request',
      url: 'https://github.com/owner/repo/pull/123',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      reviewers: [],
      files: [],
      additions: 10,
      deletions: 5,
      headRef: 'feature-branch',
      baseRef: 'main',
      isDraft: false,
      mergeable: true,
      ...overrides,
    })

    test('includes PR number and title in header', () => {
      const pr = createMockPR()
      const result = formatPRContext(pr)
      expect(result).toContain('# PR #123: Test PR')
    })

    test('includes DRAFT label when isDraft is true', () => {
      const pr = createMockPR({ isDraft: true })
      const result = formatPRContext(pr)
      expect(result).toContain('[DRAFT]')
    })

    test('does not include DRAFT label when isDraft is false', () => {
      const pr = createMockPR({ isDraft: false })
      const result = formatPRContext(pr)
      expect(result).not.toContain('[DRAFT]')
    })

    test('includes state', () => {
      const pr = createMockPR({ state: 'open' })
      const result = formatPRContext(pr)
      expect(result).toContain('**State:** open')
    })

    test('includes branch info', () => {
      const pr = createMockPR()
      const result = formatPRContext(pr)
      expect(result).toContain('**Branch:** feature-branch → main')
    })

    test('includes author info with name', () => {
      const pr = createMockPR()
      const result = formatPRContext(pr)
      expect(result).toContain('**Author:** Test User (@testuser)')
    })

    test('includes author login when name is not available', () => {
      const pr = createMockPR({
        author: { login: 'testuser', name: undefined },
      })
      const result = formatPRContext(pr)
      expect(result).toContain('**Author:** testuser (@testuser)')
    })

    test('includes mergeable status when true', () => {
      const pr = createMockPR({ mergeable: true })
      const result = formatPRContext(pr)
      expect(result).toContain('**Mergeable:** Yes')
    })

    test('includes mergeable status when false', () => {
      const pr = createMockPR({ mergeable: false })
      const result = formatPRContext(pr)
      expect(result).toContain('**Mergeable:** No')
    })

    test('omits mergeable status when undefined', () => {
      const pr = createMockPR({ mergeable: undefined })
      const result = formatPRContext(pr)
      expect(result).not.toContain('**Mergeable:**')
    })

    test('includes description when body is present', () => {
      const pr = createMockPR({ body: 'Test description here' })
      const result = formatPRContext(pr)
      expect(result).toContain('## Description')
      expect(result).toContain('Test description here')
    })

    test('omits description section when body is empty', () => {
      const pr = createMockPR({ body: '' })
      const result = formatPRContext(pr)
      expect(result).not.toContain('## Description')
    })

    test('includes reviewers section when reviewers exist', () => {
      const pr = createMockPR({
        reviewers: [
          { login: 'reviewer1', name: 'Reviewer One', state: 'APPROVED' },
          { login: 'reviewer2', name: undefined, state: 'PENDING' },
        ],
      })
      const result = formatPRContext(pr)
      expect(result).toContain('## Reviewers')
      expect(result).toContain('- Reviewer One (@reviewer1): APPROVED')
      expect(result).toContain('- reviewer2 (@reviewer2): PENDING')
    })

    test('omits reviewers section when no reviewers', () => {
      const pr = createMockPR({ reviewers: [] })
      const result = formatPRContext(pr)
      expect(result).not.toContain('## Reviewers')
    })

    test('includes changes summary', () => {
      const pr = createMockPR({ additions: 50, deletions: 20, files: [] })
      const result = formatPRContext(pr)
      expect(result).toContain('## Changes')
      expect(result).toContain('**0 files changed** (+50 -20)')
    })

    test('groups files by status', () => {
      const pr = createMockPR({
        files: [
          { path: 'new-file.ts', additions: 10, deletions: 0, status: 'added' },
          { path: 'modified-file.ts', additions: 5, deletions: 3, status: 'modified' },
          { path: 'deleted-file.ts', additions: 0, deletions: 15, status: 'deleted' },
          { path: 'renamed-file.ts', additions: 0, deletions: 0, status: 'renamed' },
        ],
      })
      const result = formatPRContext(pr)
      expect(result).toContain('**Added:**')
      expect(result).toContain('- new-file.ts (+10)')
      expect(result).toContain('**Modified:**')
      expect(result).toContain('- modified-file.ts (+5 -3)')
      expect(result).toContain('**Deleted:**')
      expect(result).toContain('- deleted-file.ts (-15)')
      expect(result).toContain('**Renamed:**')
      expect(result).toContain('- renamed-file.ts')
    })

    test('includes PR URL at the end', () => {
      const pr = createMockPR()
      const result = formatPRContext(pr)
      expect(result).toContain('**URL:** https://github.com/owner/repo/pull/123')
    })
  })

  describe('formatMRContext', () => {
    const createMockMR = (overrides?: Partial<MergeRequestDetails>): MergeRequestDetails => ({
      iid: 456,
      title: 'Test MR',
      state: 'opened',
      author: {
        username: 'testuser',
        name: 'Test User',
        avatarUrl: 'https://gitlab.com/avatar.png',
      },
      description: 'This is a test merge request',
      webUrl: 'https://gitlab.com/owner/repo/-/merge_requests/456',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      assignees: [],
      reviewers: [],
      labels: [],
      changes: [],
      sourceBranch: 'feature-branch',
      targetBranch: 'main',
      mergeStatus: 'can_be_merged',
      draft: false,
      workInProgress: false,
      ...overrides,
    })

    test('includes MR IID and title in header', () => {
      const mr = createMockMR()
      const result = formatMRContext(mr)
      expect(result).toContain('# MR !456: Test MR')
    })

    test('includes DRAFT/WIP label when draft is true', () => {
      const mr = createMockMR({ draft: true })
      const result = formatMRContext(mr)
      expect(result).toContain('[DRAFT/WIP]')
    })

    test('includes DRAFT/WIP label when workInProgress is true', () => {
      const mr = createMockMR({ workInProgress: true })
      const result = formatMRContext(mr)
      expect(result).toContain('[DRAFT/WIP]')
    })

    test('does not include DRAFT/WIP label when both are false', () => {
      const mr = createMockMR({ draft: false, workInProgress: false })
      const result = formatMRContext(mr)
      expect(result).not.toContain('[DRAFT/WIP]')
    })

    test('includes state', () => {
      const mr = createMockMR({ state: 'opened' })
      const result = formatMRContext(mr)
      expect(result).toContain('**State:** opened')
    })

    test('includes branch info', () => {
      const mr = createMockMR()
      const result = formatMRContext(mr)
      expect(result).toContain('**Branch:** feature-branch → main')
    })

    test('includes author info with name', () => {
      const mr = createMockMR()
      const result = formatMRContext(mr)
      expect(result).toContain('**Author:** Test User (@testuser)')
    })

    test('includes author username when name is not available', () => {
      const mr = createMockMR({
        author: { username: 'testuser', name: undefined },
      })
      const result = formatMRContext(mr)
      expect(result).toContain('**Author:** testuser (@testuser)')
    })

    test('includes merge status when present', () => {
      const mr = createMockMR({ mergeStatus: 'can_be_merged' })
      const result = formatMRContext(mr)
      expect(result).toContain('**Merge Status:** can_be_merged')
    })

    test('omits merge status when empty', () => {
      const mr = createMockMR({ mergeStatus: '' })
      const result = formatMRContext(mr)
      expect(result).not.toContain('**Merge Status:**')
    })

    test('includes labels when present', () => {
      const mr = createMockMR({ labels: ['bug', 'high-priority', 'frontend'] })
      const result = formatMRContext(mr)
      expect(result).toContain('**Labels:** bug, high-priority, frontend')
    })

    test('omits labels section when no labels', () => {
      const mr = createMockMR({ labels: [] })
      const result = formatMRContext(mr)
      expect(result).not.toContain('**Labels:**')
    })

    test('includes description when present', () => {
      const mr = createMockMR({ description: 'Test description here' })
      const result = formatMRContext(mr)
      expect(result).toContain('## Description')
      expect(result).toContain('Test description here')
    })

    test('omits description section when empty', () => {
      const mr = createMockMR({ description: '' })
      const result = formatMRContext(mr)
      expect(result).not.toContain('## Description')
    })

    test('includes assignees section when assignees exist', () => {
      const mr = createMockMR({
        assignees: [
          { username: 'assignee1', name: 'Assignee One' },
          { username: 'assignee2', name: undefined },
        ],
      })
      const result = formatMRContext(mr)
      expect(result).toContain('## Assignees')
      expect(result).toContain('- Assignee One (@assignee1)')
      expect(result).toContain('- assignee2 (@assignee2)')
    })

    test('omits assignees section when no assignees', () => {
      const mr = createMockMR({ assignees: [] })
      const result = formatMRContext(mr)
      expect(result).not.toContain('## Assignees')
    })

    test('includes reviewers section when reviewers exist', () => {
      const mr = createMockMR({
        reviewers: [
          { username: 'reviewer1', name: 'Reviewer One', state: 'reviewed' },
          { username: 'reviewer2', name: undefined, state: undefined },
        ],
      })
      const result = formatMRContext(mr)
      expect(result).toContain('## Reviewers')
      expect(result).toContain('- Reviewer One (@reviewer1): reviewed')
      expect(result).toContain('- reviewer2 (@reviewer2): unreviewed')
    })

    test('omits reviewers section when no reviewers', () => {
      const mr = createMockMR({ reviewers: [] })
      const result = formatMRContext(mr)
      expect(result).not.toContain('## Reviewers')
    })

    test('includes changes section when changes exist', () => {
      const mr = createMockMR({
        changes: [
          { oldPath: '', newPath: 'new-file.ts', aMode: '', bMode: '', diff: '', newFile: true, renamedFile: false, deletedFile: false },
          { oldPath: 'modified.ts', newPath: 'modified.ts', aMode: '', bMode: '', diff: '', newFile: false, renamedFile: false, deletedFile: false },
          { oldPath: 'deleted.ts', newPath: '', aMode: '', bMode: '', diff: '', newFile: false, renamedFile: false, deletedFile: true },
          { oldPath: 'old-name.ts', newPath: 'new-name.ts', aMode: '', bMode: '', diff: '', newFile: false, renamedFile: true, deletedFile: false },
        ],
      })
      const result = formatMRContext(mr)
      expect(result).toContain('## Changes')
      expect(result).toContain('**4 files changed**')
      expect(result).toContain('**Added:**')
      expect(result).toContain('- new-file.ts')
      expect(result).toContain('**Modified:**')
      expect(result).toContain('- modified.ts')
      expect(result).toContain('**Deleted:**')
      expect(result).toContain('- deleted.ts')
      expect(result).toContain('**Renamed:**')
      expect(result).toContain('- old-name.ts → new-name.ts')
    })

    test('omits changes section when no changes', () => {
      const mr = createMockMR({ changes: [] })
      const result = formatMRContext(mr)
      // Should not have the Changes header when no changes
      const lines = result.split('\n')
      const changesHeaderIndex = lines.findIndex((l) => l === '## Changes')
      expect(changesHeaderIndex).toBe(-1)
    })

    test('includes MR URL at the end', () => {
      const mr = createMockMR()
      const result = formatMRContext(mr)
      expect(result).toContain('**URL:** https://gitlab.com/owner/repo/-/merge_requests/456')
    })
  })
})

describe('Edge Cases and Error Handling', () => {
  test('listPullRequests handles empty state gracefully', async () => {
    const result = await listPullRequests()
    // Should return array (possibly empty), never throw
    expect(Array.isArray(result)).toBe(true)
  })

  test('listMergeRequests handles empty state gracefully', async () => {
    const result = await listMergeRequests()
    // Should return array (possibly empty), never throw
    expect(Array.isArray(result)).toBe(true)
  })

  test('formatPRContext handles PR with all optional fields undefined', () => {
    const minimalPR: PullRequestDetails = {
      number: 1,
      title: 'Minimal',
      state: 'open',
      author: { login: 'user' },
      body: '',
      url: 'https://example.com',
      createdAt: '',
      updatedAt: '',
      reviewers: [],
      files: [],
      additions: 0,
      deletions: 0,
      headRef: '',
      baseRef: '',
      isDraft: false,
      mergeable: undefined,
    }
    // Should not throw
    expect(() => formatPRContext(minimalPR)).not.toThrow()
    const result = formatPRContext(minimalPR)
    expect(result).toContain('# PR #1: Minimal')
  })

  test('formatMRContext handles MR with all optional fields undefined', () => {
    const minimalMR: MergeRequestDetails = {
      iid: 1,
      title: 'Minimal',
      state: 'opened',
      author: { username: 'user' },
      description: '',
      webUrl: 'https://example.com',
      createdAt: '',
      updatedAt: '',
      assignees: [],
      reviewers: [],
      labels: [],
      changes: [],
      sourceBranch: '',
      targetBranch: '',
      mergeStatus: '',
      draft: false,
      workInProgress: false,
    }
    // Should not throw
    expect(() => formatMRContext(minimalMR)).not.toThrow()
    const result = formatMRContext(minimalMR)
    expect(result).toContain('# MR !1: Minimal')
  })
})
