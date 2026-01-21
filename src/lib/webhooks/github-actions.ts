import crypto from 'crypto'
import type { WorkflowFailurePayload } from '@/lib/gastown/types'

export interface WorkflowRunEventPayload {
  action?: string
  workflow_run?: {
    id: number
    name: string
    path?: string
    workflow_id: number
    run_number: number
    run_attempt: number
    actor?: { login?: string }
    triggering_actor?: { login?: string }
    html_url: string
    url?: string
    logs_url?: string
    jobs_url?: string
    check_suite_url?: string
    artifacts_url?: string
    rerun_url?: string
    pull_requests?: Array<{
      number: number
      head: { ref: string }
      base: { ref: string }
      url: string
    }>
    head_branch: string
    head_sha: string
    head_commit?: {
      id?: string
      message?: string
      url?: string
    }
    event: string
    status: string
    conclusion?: string
    created_at?: string
    updated_at?: string
    run_started_at?: string
    actor_id?: number
  }
  repository?: {
    id: number
    name: string
    full_name: string
    html_url?: string
    url?: string
    default_branch?: string
    visibility?: string
  }
  sender?: {
    login?: string
  }
}

export interface WorkflowFailureEvaluation {
  shouldProcess: boolean
  reason?: string
  payload?: WorkflowFailurePayload
}

export function verifyGitHubSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) {
    return false
  }

  const signature = Buffer.from(signatureHeader)
  const hmac = crypto.createHmac('sha256', secret)
  const digest = Buffer.from('sha256=' + hmac.update(rawBody).digest('hex'))

  if (signature.length !== digest.length) {
    return false
  }

  return crypto.timingSafeEqual(signature, digest)
}

export function evaluateWorkflowRunFailure(
  payload: WorkflowRunEventPayload
): WorkflowFailureEvaluation {
  if (!payload.workflow_run) {
    return { shouldProcess: false, reason: 'workflow_run payload missing' }
  }

  if (!payload.action || payload.action !== 'completed') {
    return { shouldProcess: false, reason: 'workflow run not completed' }
  }

  if (!payload.workflow_run.conclusion) {
    return { shouldProcess: false, reason: 'workflow conclusion missing' }
  }

  if (payload.workflow_run.conclusion !== 'failure') {
    return {
      shouldProcess: false,
      reason: `workflow concluded with ${payload.workflow_run.conclusion}`,
    }
  }

  const failurePayload = mapWorkflowRunToFailurePayload(payload)
  if (!failurePayload) {
    return { shouldProcess: false, reason: 'unable to map workflow payload' }
  }

  return {
    shouldProcess: true,
    payload: failurePayload,
  }
}

export function mapWorkflowRunToFailurePayload(
  payload: WorkflowRunEventPayload
): WorkflowFailurePayload | null {
  const run = payload.workflow_run
  const repo = payload.repository

  if (!run || !repo) {
    return null
  }

  const startedAt = run.run_started_at || run.created_at
  const completedAt = run.updated_at
  const durationMs = calculateDuration(startedAt, completedAt)
  const queuedDurationMs = calculateDuration(run.created_at, run.run_started_at)

  const firstPullRequest = run.pull_requests && run.pull_requests[0]

  return {
    runId: run.id,
    runNumber: run.run_number,
    runAttempt: run.run_attempt,
    workflowId: run.workflow_id,
    workflowName: run.name,
    workflowPath: run.path,
    status: run.status,
    conclusion: run.conclusion || 'failure',
    event: run.event,
    htmlUrl: run.html_url,
    logsUrl: run.logs_url,
    jobsUrl: run.jobs_url,
    checkSuiteUrl: run.check_suite_url,
    artifactsUrl: run.artifacts_url,
    rerunUrl: run.rerun_url,
    actor: run.actor?.login || payload.sender?.login,
    repository: {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      url: repo.html_url || repo.url || '',
      visibility: repo.visibility,
    },
    branch: run.head_branch,
    commitSha: run.head_sha,
    commitMessage: run.head_commit?.message,
    commitUrl: run.head_commit?.url,
    triggeredBy: run.triggering_actor?.login || payload.sender?.login,
    failureTimestamp: run.updated_at || new Date().toISOString(),
    startedAt,
    completedAt,
    durationMs,
    queuedDurationMs,
    pullRequest: firstPullRequest
      ? {
          number: firstPullRequest.number,
          headRef: firstPullRequest.head.ref,
          baseRef: firstPullRequest.base.ref,
          url: firstPullRequest.url,
        }
      : undefined,
  }
}

function calculateDuration(start?: string, end?: string): number | undefined {
  if (!start || !end) {
    return undefined
  }

  const startTime = Date.parse(start)
  const endTime = Date.parse(end)

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return undefined
  }

  return Math.max(0, endTime - startTime)
}
