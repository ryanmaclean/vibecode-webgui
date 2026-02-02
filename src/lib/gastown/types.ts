export interface RepositorySummary {
  id: number
  name: string
  fullName: string
  url: string
  defaultBranch?: string
  visibility?: string
}

export interface PullRequestSummary {
  number: number
  headRef: string
  baseRef: string
  url: string
}

export interface WorkflowFailurePayload {
  runId: number
  runNumber: number
  runAttempt: number
  workflowId: number
  workflowName: string
  workflowPath?: string
  status: string
  conclusion: string
  event: string
  htmlUrl: string
  logsUrl?: string
  jobsUrl?: string
  checkSuiteUrl?: string
  artifactsUrl?: string
  rerunUrl?: string
  actor?: string
  repository: RepositorySummary
  branch: string
  commitSha: string
  commitMessage?: string
  commitUrl?: string
  triggeredBy?: string
  failureTimestamp: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
  queuedDurationMs?: number
  pullRequest?: PullRequestSummary
}

export interface GastownWebhookRequest {
  type: 'ci_failure'
  version: string
  rig?: string
  priority?: 'P0' | 'P1' | 'P2' | 'P3'
  source: 'github_actions'
  traceId: string
  payload: WorkflowFailurePayload
  metadata?: Record<string, unknown>
}

export interface GastownWebhookResponse {
  status: 'queued' | 'dispatched' | 'ignored' | 'error'
  beadId?: string
  polecat?: string
  message?: string
  hookId?: string
  retryAfterSeconds?: number
}

export interface GastownClientOptions {
  endpoint: string
  token?: string
  rig?: string
  priority?: 'P0' | 'P1' | 'P2' | 'P3'
  timeoutMs?: number
}
