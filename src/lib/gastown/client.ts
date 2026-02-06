import { logger } from '@/lib/logger'
import {
  GastownClientOptions,
  GastownWebhookRequest,
  GastownWebhookResponse,
  WorkflowFailurePayload,
} from './types'
import { incrementGastownMetric, recordBeadFlow, recordBeadStage } from '@/lib/monitoring/gastown-metrics'

const DEFAULT_TIMEOUT_MS = 10_000

export class GastownClient {
  private readonly endpoint: string
  private readonly token?: string
  private readonly rig?: string
  private readonly priority?: 'P0' | 'P1' | 'P2' | 'P3'
  private readonly timeoutMs: number

  constructor(options: GastownClientOptions) {
    if (!options.endpoint) {
      throw new Error('Gastown endpoint is required')
    }

    this.endpoint = options.endpoint
    this.token = options.token
    this.rig = options.rig
    this.priority = options.priority
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async reportWorkflowFailure(
    traceId: string,
    payload: WorkflowFailurePayload,
    metadata?: Record<string, unknown>
  ): Promise<GastownWebhookResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    const body: GastownWebhookRequest = {
      type: 'ci_failure',
      version: '2025-01-01',
      source: 'github_actions',
      traceId,
      rig: this.rig,
      priority: this.priority,
      payload,
      metadata,
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      const responseText = await response.text()
      let json: GastownWebhookResponse | undefined

      if (responseText) {
        try {
          json = JSON.parse(responseText)
        } catch (error) {
          logger.warn('Gastown webhook returned non-JSON response', {
            traceId,
            responseText,
            error: error instanceof Error ? error.message : error,
          })
        }
      }

      if (!response.ok) {
        throw new Error(
          `Gastown webhook failed with status ${response.status}: ${responseText || 'no body'}`
        )
      }

      const result: GastownWebhookResponse = json || {
        status: 'queued',
        message: 'No response body returned from Gastown',
      }

      logger.info('Reported GitHub Actions failure to Gastown', {
        traceId,
        beadId: result.beadId,
        status: result.status,
        polecat: result.polecat,
      })

      // Emit real host metrics for dashboards
      incrementGastownMetric('gastown.handoff.count', 1, {
        source: 'github_actions',
        status: result.status ?? 'unknown',
        priority: this.priority,
      })
      recordBeadStage('created', {
        source: 'github_actions',
        priority: this.priority,
        role: 'mayor',
      })
      recordBeadFlow('created', 'in_progress', {
        source: 'github_actions',
        role: result.polecat ? 'polecat' : 'unknown',
        priority: this.priority,
      })

      logger.info('bead_provenance', {
        event_type: 'bead_provenance',
        bead_id: result.beadId,
        from: 'created',
        to: 'in_progress',
        stage: 'in_progress',
        source: 'github_actions',
        role: result.polecat ? 'polecat' : 'unknown',
        polecat: result.polecat,
        priority: this.priority,
        rig: this.rig,
        status: result.status ?? 'unknown',
      })

      return result
    } catch (error) {
      logger.error('Failed to notify Gastown webhook', {
        traceId,
        error: error instanceof Error ? error.message : error,
      })
      incrementGastownMetric('gastown.failures.count', 1, {
        source: 'github_actions',
        reason: 'webhook_failed',
        priority: this.priority,
      })
      logger.info('bead_provenance', {
        event_type: 'bead_provenance',
        bead_id: traceId,
        from: 'created',
        to: 'failed',
        stage: 'failed',
        source: 'github_actions',
        role: 'mayor',
        priority: this.priority,
        rig: this.rig,
        status: 'failed',
      })
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export function createGastownClientFromEnv(): GastownClient {
  const endpoint =
    process.env.GASTOWN_WEBHOOK_URL || process.env.GASTOWN_WEBHOOK || ''

  const configuredPriority = (process.env.GASTOWN_DEFAULT_PRIORITY || 'P1').toUpperCase()
  const allowedPriorities = ['P0', 'P1', 'P2', 'P3'] as const
  const priority =
    (allowedPriorities.find((value) => value === configuredPriority) ?? 'P1') as
      | 'P0'
      | 'P1'
      | 'P2'
      | 'P3'

  const timeoutFromEnv = process.env.GASTOWN_TIMEOUT_MS
    ? Number(process.env.GASTOWN_TIMEOUT_MS)
    : undefined
  const timeoutMs = Number.isFinite(timeoutFromEnv ?? NaN)
    ? timeoutFromEnv
    : undefined

  return new GastownClient({
    endpoint,
    token: process.env.GASTOWN_API_TOKEN,
    rig: process.env.GASTOWN_RIG,
    priority,
    timeoutMs,
  })
}
