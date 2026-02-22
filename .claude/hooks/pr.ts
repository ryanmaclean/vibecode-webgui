import type {
  MergeRequest,
  MergeRequestAssignee,
  MergeRequestChange,
  MergeRequestDetails,
  MergeRequestReviewer,
  PullRequest,
  PullRequestAuthor,
  PullRequestDetails,
  PullRequestFile,
  PullRequestReviewer,
} from './lib'

// Cache for CLI availability checks to avoid repeated calls
let ghCliAvailable: boolean | null = null
let glabCliAvailable: boolean | null = null

/**
 * Check if the GitHub CLI (gh) is available and working.
 * Results are cached to avoid repeated CLI calls.
 * @returns Promise<boolean> - true if gh CLI is available
 */
export async function isGitHubCLIAvailable(): Promise<boolean> {
  if (ghCliAvailable !== null) {
    return ghCliAvailable
  }

  try {
    const result = await Bun.$`gh --version`.quiet()
    ghCliAvailable = result.exitCode === 0
  } catch {
    ghCliAvailable = false
  }

  return ghCliAvailable
}

/**
 * Check if the GitLab CLI (glab) is available and working.
 * Results are cached to avoid repeated CLI calls.
 * @returns Promise<boolean> - true if glab CLI is available
 */
export async function isGitLabCLIAvailable(): Promise<boolean> {
  if (glabCliAvailable !== null) {
    return glabCliAvailable
  }

  try {
    const result = await Bun.$`glab --version`.quiet()
    glabCliAvailable = result.exitCode === 0
  } catch {
    glabCliAvailable = false
  }

  return glabCliAvailable
}

/**
 * Clear the cached CLI availability results.
 * Useful for testing or when CLI installation status may have changed.
 */
export function clearCliCache(): void {
  ghCliAvailable = null
  glabCliAvailable = null
}

// GitHub PR list JSON field names for gh pr list command
const PR_LIST_FIELDS = 'number,title,state,author,body,url,createdAt,updatedAt'

// GitHub PR detail JSON field names for gh pr view command
const PR_DETAIL_FIELDS =
  'number,title,state,author,body,url,createdAt,updatedAt,reviewRequests,files,additions,deletions,headRefName,baseRefName,isDraft,mergeable,reviews'

/**
 * Raw author object from gh CLI JSON output
 */
interface GHAuthorRaw {
  login?: string
  name?: string
  avatarUrl?: string
}

/**
 * Raw PR object from gh pr list JSON output
 */
interface GHPullRequestRaw {
  number: number
  title: string
  state: string
  author?: GHAuthorRaw
  body: string
  url: string
  createdAt: string
  updatedAt: string
}

/**
 * Raw review request from gh CLI output
 */
interface GHReviewRequestRaw {
  login?: string
  name?: string
}

/**
 * Raw review from gh CLI output
 */
interface GHReviewRaw {
  author?: GHAuthorRaw
  state?: string
}

/**
 * Raw file from gh CLI output
 */
interface GHFileRaw {
  path?: string
  additions?: number
  deletions?: number
  status?: string
}

/**
 * Raw PR detail object from gh pr view JSON output
 */
interface GHPullRequestDetailRaw extends GHPullRequestRaw {
  reviewRequests?: GHReviewRequestRaw[]
  reviews?: GHReviewRaw[]
  files?: GHFileRaw[]
  additions?: number
  deletions?: number
  headRefName?: string
  baseRefName?: string
  isDraft?: boolean
  mergeable?: string
}

/**
 * Convert raw gh CLI author to PullRequestAuthor
 */
function parseAuthor(raw?: GHAuthorRaw): PullRequestAuthor {
  return {
    login: raw?.login ?? 'unknown',
    name: raw?.name,
    avatarUrl: raw?.avatarUrl,
  }
}

/**
 * Convert raw gh CLI state to typed state
 */
function parsePRState(state: string): 'open' | 'closed' | 'merged' {
  const normalized = state.toLowerCase()
  if (normalized === 'merged') return 'merged'
  if (normalized === 'closed') return 'closed'
  return 'open'
}

/**
 * Convert raw gh CLI file status to typed status
 */
function parseFileStatus(status?: string): 'added' | 'modified' | 'deleted' | 'renamed' {
  const normalized = (status ?? '').toLowerCase()
  if (normalized === 'added') return 'added'
  if (normalized === 'removed' || normalized === 'deleted') return 'deleted'
  if (normalized === 'renamed') return 'renamed'
  return 'modified'
}

/**
 * List open pull requests from the current GitHub repository.
 * Requires the gh CLI to be installed and authenticated.
 *
 * @returns Promise<PullRequest[]> - Array of pull requests, empty array on error
 */
export async function listPullRequests(): Promise<PullRequest[]> {
  // Check CLI availability first
  const available = await isGitHubCLIAvailable()
  if (!available) {
    return []
  }

  try {
    const result = await Bun.$`gh pr list --json ${PR_LIST_FIELDS}`.quiet()

    if (result.exitCode !== 0) {
      return []
    }

    const rawPRs = JSON.parse(result.stdout.toString()) as GHPullRequestRaw[]

    return rawPRs.map((raw) => ({
      number: raw.number,
      title: raw.title,
      state: parsePRState(raw.state),
      author: parseAuthor(raw.author),
      body: raw.body ?? '',
      url: raw.url,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    }))
  } catch {
    // Handle: not in git repo, auth errors, network errors, parse errors
    return []
  }
}

/**
 * Get detailed information for a specific pull request by number.
 * Requires the gh CLI to be installed and authenticated.
 *
 * @param prNumber - The PR number to fetch
 * @returns Promise<PullRequestDetails | null> - PR details or null if not found/error
 */
export async function getPullRequest(prNumber: number): Promise<PullRequestDetails | null> {
  // Check CLI availability first
  const available = await isGitHubCLIAvailable()
  if (!available) {
    return null
  }

  // Validate PR number
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    return null
  }

  try {
    const result = await Bun.$`gh pr view ${prNumber} --json ${PR_DETAIL_FIELDS}`.quiet()

    if (result.exitCode !== 0) {
      return null
    }

    const raw = JSON.parse(result.stdout.toString()) as GHPullRequestDetailRaw

    // Build reviewers list from both review requests and actual reviews
    const reviewers: PullRequestReviewer[] = []

    // Add pending review requests
    if (raw.reviewRequests) {
      for (const req of raw.reviewRequests) {
        if (req.login) {
          reviewers.push({
            login: req.login,
            name: req.name,
            state: 'PENDING',
          })
        }
      }
    }

    // Add reviewers who have submitted reviews
    if (raw.reviews) {
      for (const review of raw.reviews) {
        const login = review.author?.login
        if (login) {
          // Check if already in reviewers list
          const existing = reviewers.find((r) => r.login === login)
          if (existing) {
            // Update state with latest review state
            existing.state = (review.state as PullRequestReviewer['state']) ?? existing.state
          } else {
            reviewers.push({
              login,
              name: review.author?.name,
              state: (review.state as PullRequestReviewer['state']) ?? undefined,
            })
          }
        }
      }
    }

    // Build files list
    const files: PullRequestFile[] = (raw.files ?? [])
      .filter((f) => f.path)
      .map((f) => ({
        path: f.path!,
        additions: f.additions ?? 0,
        deletions: f.deletions ?? 0,
        status: parseFileStatus(f.status),
      }))

    // Parse mergeable state
    let mergeable: boolean | undefined
    if (raw.mergeable === 'MERGEABLE') {
      mergeable = true
    } else if (raw.mergeable === 'CONFLICTING' || raw.mergeable === 'UNKNOWN') {
      mergeable = false
    }

    return {
      number: raw.number,
      title: raw.title,
      state: parsePRState(raw.state),
      author: parseAuthor(raw.author),
      body: raw.body ?? '',
      url: raw.url,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      reviewers,
      files,
      additions: raw.additions ?? 0,
      deletions: raw.deletions ?? 0,
      headRef: raw.headRefName ?? '',
      baseRef: raw.baseRefName ?? '',
      isDraft: raw.isDraft ?? false,
      mergeable,
    }
  } catch {
    // Handle: not in git repo, auth errors, network errors, parse errors, invalid PR number
    return null
  }
}

// GitLab MR list JSON fields for glab mr list command
// glab uses --output json flag instead of --json field names

/**
 * Raw author object from glab CLI JSON output
 */
interface GLAuthorRaw {
  username?: string
  name?: string
  avatar_url?: string
}

/**
 * Raw MR object from glab mr list JSON output
 */
interface GLMergeRequestRaw {
  iid: number
  title: string
  state: string
  author?: GLAuthorRaw
  description: string
  web_url: string
  created_at: string
  updated_at: string
}

/**
 * Raw assignee from glab CLI output
 */
interface GLAssigneeRaw {
  username?: string
  name?: string
}

/**
 * Raw reviewer from glab CLI output
 */
interface GLReviewerRaw {
  username?: string
  name?: string
}

/**
 * Raw change/diff from glab CLI output
 */
interface GLChangeRaw {
  old_path?: string
  new_path?: string
  a_mode?: string
  b_mode?: string
  diff?: string
  new_file?: boolean
  renamed_file?: boolean
  deleted_file?: boolean
}

/**
 * Raw MR detail object from glab mr view JSON output
 */
interface GLMergeRequestDetailRaw extends GLMergeRequestRaw {
  assignees?: GLAssigneeRaw[]
  reviewers?: GLReviewerRaw[]
  labels?: string[]
  changes?: GLChangeRaw[]
  source_branch?: string
  target_branch?: string
  merge_status?: string
  draft?: boolean
  work_in_progress?: boolean
}

/**
 * Convert raw glab CLI state to typed state
 */
function parseMRState(state: string): 'opened' | 'closed' | 'merged' | 'locked' {
  const normalized = state.toLowerCase()
  if (normalized === 'merged') return 'merged'
  if (normalized === 'closed') return 'closed'
  if (normalized === 'locked') return 'locked'
  return 'opened'
}

/**
 * List open merge requests from the current GitLab repository.
 * Requires the glab CLI to be installed and authenticated.
 *
 * @returns Promise<MergeRequest[]> - Array of merge requests, empty array on error
 */
export async function listMergeRequests(): Promise<MergeRequest[]> {
  // Check CLI availability first
  const available = await isGitLabCLIAvailable()
  if (!available) {
    return []
  }

  try {
    const result = await Bun.$`glab mr list --output json`.quiet()

    if (result.exitCode !== 0) {
      return []
    }

    const rawMRs = JSON.parse(result.stdout.toString()) as GLMergeRequestRaw[]

    return rawMRs.map((raw) => ({
      iid: raw.iid,
      title: raw.title,
      state: parseMRState(raw.state),
      author: {
        username: raw.author?.username ?? 'unknown',
        name: raw.author?.name,
        avatarUrl: raw.author?.avatar_url,
      },
      description: raw.description ?? '',
      webUrl: raw.web_url,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    }))
  } catch {
    // Handle: not in git repo, auth errors, network errors, parse errors
    return []
  }
}

/**
 * Get detailed information for a specific merge request by IID.
 * Requires the glab CLI to be installed and authenticated.
 *
 * @param mrIid - The MR IID (internal ID) to fetch
 * @returns Promise<MergeRequestDetails | null> - MR details or null if not found/error
 */
export async function getMergeRequest(mrIid: number): Promise<MergeRequestDetails | null> {
  // Check CLI availability first
  const available = await isGitLabCLIAvailable()
  if (!available) {
    return null
  }

  // Validate MR IID
  if (!Number.isInteger(mrIid) || mrIid <= 0) {
    return null
  }

  try {
    const result = await Bun.$`glab mr view ${mrIid} --output json`.quiet()

    if (result.exitCode !== 0) {
      return null
    }

    const raw = JSON.parse(result.stdout.toString()) as GLMergeRequestDetailRaw

    // Build assignees list
    const assignees: MergeRequestAssignee[] = (raw.assignees ?? [])
      .filter((a) => a.username)
      .map((a) => ({
        username: a.username!,
        name: a.name,
      }))

    // Build reviewers list
    const reviewers: MergeRequestReviewer[] = (raw.reviewers ?? [])
      .filter((r) => r.username)
      .map((r) => ({
        username: r.username!,
        name: r.name,
        state: undefined, // glab doesn't provide review state in the same way
      }))

    // Build changes list
    const changes: MergeRequestChange[] = (raw.changes ?? []).map((c) => ({
      oldPath: c.old_path ?? '',
      newPath: c.new_path ?? '',
      aMode: c.a_mode ?? '',
      bMode: c.b_mode ?? '',
      diff: c.diff ?? '',
      newFile: c.new_file ?? false,
      renamedFile: c.renamed_file ?? false,
      deletedFile: c.deleted_file ?? false,
    }))

    return {
      iid: raw.iid,
      title: raw.title,
      state: parseMRState(raw.state),
      author: {
        username: raw.author?.username ?? 'unknown',
        name: raw.author?.name,
        avatarUrl: raw.author?.avatar_url,
      },
      description: raw.description ?? '',
      webUrl: raw.web_url,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      assignees,
      reviewers,
      labels: raw.labels ?? [],
      changes,
      sourceBranch: raw.source_branch ?? '',
      targetBranch: raw.target_branch ?? '',
      mergeStatus: raw.merge_status ?? '',
      draft: raw.draft ?? false,
      workInProgress: raw.work_in_progress ?? false,
    }
  } catch {
    // Handle: not in git repo, auth errors, network errors, parse errors, invalid MR IID
    return null
  }
}

/**
 * Format a GitHub Pull Request into a human-readable context summary.
 * This is useful for providing PR context to Claude in hooks.
 *
 * @param pr - The pull request details to format
 * @returns A formatted string summary of the PR
 */
export function formatPRContext(pr: PullRequestDetails): string {
  const lines: string[] = []

  // Header with PR number, title, and state
  const draftLabel = pr.isDraft ? ' [DRAFT]' : ''
  lines.push(`# PR #${pr.number}: ${pr.title}${draftLabel}`)
  lines.push('')

  // State and branch info
  lines.push(`**State:** ${pr.state}`)
  lines.push(`**Branch:** ${pr.headRef} → ${pr.baseRef}`)
  lines.push(`**Author:** ${pr.author.name ?? pr.author.login} (@${pr.author.login})`)

  // Mergeable status
  if (pr.mergeable !== undefined) {
    lines.push(`**Mergeable:** ${pr.mergeable ? 'Yes' : 'No (conflicts or checks failing)'}`)
  }

  lines.push('')

  // Description/body
  if (pr.body) {
    lines.push('## Description')
    lines.push(pr.body)
    lines.push('')
  }

  // Reviewers
  if (pr.reviewers.length > 0) {
    lines.push('## Reviewers')
    for (const reviewer of pr.reviewers) {
      const name = reviewer.name ?? reviewer.login
      const state = reviewer.state ?? 'PENDING'
      lines.push(`- ${name} (@${reviewer.login}): ${state}`)
    }
    lines.push('')
  }

  // Files changed summary
  lines.push('## Changes')
  lines.push(`**${pr.files.length} files changed** (+${pr.additions} -${pr.deletions})`)
  lines.push('')

  if (pr.files.length > 0) {
    // Group files by status for cleaner display
    const added = pr.files.filter((f) => f.status === 'added')
    const modified = pr.files.filter((f) => f.status === 'modified')
    const deleted = pr.files.filter((f) => f.status === 'deleted')
    const renamed = pr.files.filter((f) => f.status === 'renamed')

    if (added.length > 0) {
      lines.push('**Added:**')
      for (const f of added) {
        lines.push(`- ${f.path} (+${f.additions})`)
      }
    }

    if (modified.length > 0) {
      lines.push('**Modified:**')
      for (const f of modified) {
        lines.push(`- ${f.path} (+${f.additions} -${f.deletions})`)
      }
    }

    if (deleted.length > 0) {
      lines.push('**Deleted:**')
      for (const f of deleted) {
        lines.push(`- ${f.path} (-${f.deletions})`)
      }
    }

    if (renamed.length > 0) {
      lines.push('**Renamed:**')
      for (const f of renamed) {
        lines.push(`- ${f.path}`)
      }
    }
  }

  lines.push('')
  lines.push(`**URL:** ${pr.url}`)

  return lines.join('\n')
}

/**
 * Format a GitLab Merge Request into a human-readable context summary.
 * This is useful for providing MR context to Claude in hooks.
 *
 * @param mr - The merge request details to format
 * @returns A formatted string summary of the MR
 */
export function formatMRContext(mr: MergeRequestDetails): string {
  const lines: string[] = []

  // Header with MR IID, title, and state
  const draftLabel = mr.draft || mr.workInProgress ? ' [DRAFT/WIP]' : ''
  lines.push(`# MR !${mr.iid}: ${mr.title}${draftLabel}`)
  lines.push('')

  // State and branch info
  lines.push(`**State:** ${mr.state}`)
  lines.push(`**Branch:** ${mr.sourceBranch} → ${mr.targetBranch}`)
  lines.push(`**Author:** ${mr.author.name ?? mr.author.username} (@${mr.author.username})`)

  // Merge status
  if (mr.mergeStatus) {
    lines.push(`**Merge Status:** ${mr.mergeStatus}`)
  }

  lines.push('')

  // Labels
  if (mr.labels.length > 0) {
    lines.push(`**Labels:** ${mr.labels.join(', ')}`)
    lines.push('')
  }

  // Description
  if (mr.description) {
    lines.push('## Description')
    lines.push(mr.description)
    lines.push('')
  }

  // Assignees
  if (mr.assignees.length > 0) {
    lines.push('## Assignees')
    for (const assignee of mr.assignees) {
      const name = assignee.name ?? assignee.username
      lines.push(`- ${name} (@${assignee.username})`)
    }
    lines.push('')
  }

  // Reviewers
  if (mr.reviewers.length > 0) {
    lines.push('## Reviewers')
    for (const reviewer of mr.reviewers) {
      const name = reviewer.name ?? reviewer.username
      const state = reviewer.state ?? 'unreviewed'
      lines.push(`- ${name} (@${reviewer.username}): ${state}`)
    }
    lines.push('')
  }

  // Changes summary
  if (mr.changes.length > 0) {
    lines.push('## Changes')
    lines.push(`**${mr.changes.length} files changed**`)
    lines.push('')

    // Group changes by type
    const newFiles = mr.changes.filter((c) => c.newFile)
    const modified = mr.changes.filter((c) => !c.newFile && !c.deletedFile && !c.renamedFile)
    const deleted = mr.changes.filter((c) => c.deletedFile)
    const renamed = mr.changes.filter((c) => c.renamedFile)

    if (newFiles.length > 0) {
      lines.push('**Added:**')
      for (const c of newFiles) {
        lines.push(`- ${c.newPath}`)
      }
    }

    if (modified.length > 0) {
      lines.push('**Modified:**')
      for (const c of modified) {
        lines.push(`- ${c.newPath}`)
      }
    }

    if (deleted.length > 0) {
      lines.push('**Deleted:**')
      for (const c of deleted) {
        lines.push(`- ${c.oldPath}`)
      }
    }

    if (renamed.length > 0) {
      lines.push('**Renamed:**')
      for (const c of renamed) {
        lines.push(`- ${c.oldPath} → ${c.newPath}`)
      }
    }
  }

  lines.push('')
  lines.push(`**URL:** ${mr.webUrl}`)

  return lines.join('\n')
}
