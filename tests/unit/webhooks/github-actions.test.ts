/** @jest-environment node */

import crypto from 'crypto'
import {
  evaluateWorkflowRunFailure,
  mapWorkflowRunToFailurePayload,
  verifyGitHubSignature,
  type WorkflowRunEventPayload,
} from '@/lib/webhooks/github-actions'

describe('verifyGitHubSignature', () => {
  const secret = 'test-secret'

  it('returns true for valid payloads', () => {
    const body = JSON.stringify({ hello: 'world' })
    const digest = createSignature(body, secret)

    expect(verifyGitHubSignature(body, digest, secret)).toBe(true)
  })

  it('returns false when signature is missing or invalid', () => {
    const body = JSON.stringify({ hello: 'world' })
    const digest = createSignature(body, secret)

    expect(verifyGitHubSignature(body, null, secret)).toBe(false)
    expect(verifyGitHubSignature(body, `${digest}-tampered`, secret)).toBe(false)
  })
})

describe('evaluateWorkflowRunFailure', () => {
  const basePayload: WorkflowRunEventPayload = {
    action: 'completed',
    workflow_run: {
      id: 123,
      name: 'CI',
      workflow_id: 987,
      run_number: 42,
      run_attempt: 1,
      html_url: 'https://github.com/acme/repo/actions/runs/123',
      logs_url: 'https://api.github.com/repos/acme/repo/actions/runs/123/logs',
      jobs_url: 'https://api.github.com/repos/acme/repo/actions/runs/123/jobs',
      check_suite_url: 'https://api.github.com/repos/acme/repo/check-suites/1',
      artifacts_url: 'https://api.github.com/repos/acme/repo/actions/runs/123/artifacts',
      rerun_url: 'https://api.github.com/repos/acme/repo/actions/runs/123/rerun',
      head_branch: 'main',
      head_sha: 'abcdef',
      event: 'push',
      status: 'completed',
      conclusion: 'failure',
      created_at: '2025-01-01T00:00:00Z',
      run_started_at: '2025-01-01T00:01:00Z',
      updated_at: '2025-01-01T00:05:00Z',
      path: '.github/workflows/ci.yml',
      actor: { login: 'octocat' },
      head_commit: {
        id: 'abcdef',
        message: 'Fix tests',
        url: 'https://github.com/acme/repo/commit/abcdef',
      },
      pull_requests: [
        {
          number: 77,
          head: { ref: 'feature/example' },
          base: { ref: 'main' },
          url: 'https://api.github.com/repos/acme/repo/pulls/77',
        },
      ],
    },
    repository: {
      id: 555,
      name: 'repo',
      full_name: 'acme/repo',
      html_url: 'https://github.com/acme/repo',
      default_branch: 'main',
      visibility: 'public',
    },
    sender: { login: 'workflow-bot' },
  }

  it('returns payload for failure events', () => {
    const { shouldProcess, payload, reason } = evaluateWorkflowRunFailure(basePayload)

    expect(shouldProcess).toBe(true)
    expect(reason).toBeUndefined()
    expect(payload).toBeDefined()
    expect(payload?.branch).toBe('main')
    expect(payload?.pullRequest?.number).toBe(77)
    expect(payload?.durationMs).toBe(4 * 60 * 1000)
    expect(payload?.queuedDurationMs).toBe(60 * 1000)
  })

  it('ignores successful workflows', () => {
    const payload: WorkflowRunEventPayload = {
      ...basePayload,
      workflow_run: {
        ...basePayload.workflow_run!,
        conclusion: 'success',
      },
    }

    const result = evaluateWorkflowRunFailure(payload)
    expect(result.shouldProcess).toBe(false)
    expect(result.reason).toContain('concluded')
  })

  it('maps workflow runs even without optional fields', () => {
    const payload: WorkflowRunEventPayload = {
      action: 'completed',
      workflow_run: {
        id: 1,
        name: 'CI',
        workflow_id: 2,
        run_number: 3,
        run_attempt: 1,
        html_url: 'https://example.com',
        head_branch: 'dev',
        head_sha: 'abc',
        event: 'push',
        status: 'completed',
        conclusion: 'failure',
      },
      repository: {
        id: 10,
        name: 'repo',
        full_name: 'acme/repo',
      },
    }

    const mapped = mapWorkflowRunToFailurePayload(payload)
    expect(mapped?.repository.fullName).toBe('acme/repo')
    expect(mapped?.branch).toBe('dev')
  })
})

function createSignature(body: string, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return `sha256=${digest}`
}
