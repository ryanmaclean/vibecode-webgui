import type {
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
