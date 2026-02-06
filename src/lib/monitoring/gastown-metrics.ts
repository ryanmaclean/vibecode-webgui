import os from 'node:os'

type TagMap = Record<string, string | number | boolean | undefined>

let dogstatsd: undefined | {
  increment: (metric: string, value?: number, tags?: string[]) => void
  gauge: (metric: string, value: number, tags?: string[]) => void
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ddTrace = require('dd-trace')
  dogstatsd = ddTrace?.dogstatsd || ddTrace?.default?.dogstatsd
} catch {
  dogstatsd = undefined
}

function formatTags(tags?: TagMap): string[] {
  if (!tags) return []
  return Object.entries(tags)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}:${String(v)}`)
}

function baseTags(): TagMap {
  return {
    env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
    service: process.env.DD_SERVICE || 'vibecode-webgui',
    rig: process.env.GASTOWN_RIG || 'unknown',
    host: os.hostname(),
  }
}

export function incrementGastownMetric(metric: string, value = 1, tags?: TagMap): void {
  if (!dogstatsd) return
  dogstatsd.increment(metric, value, formatTags({ ...baseTags(), ...tags }))
}

export function gaugeGastownMetric(metric: string, value: number, tags?: TagMap): void {
  if (!dogstatsd) return
  dogstatsd.gauge(metric, value, formatTags({ ...baseTags(), ...tags }))
}

export function recordBeadStage(stage: string, tags?: TagMap): void {
  const map: Record<string, string> = {
    created: 'gastown.beads.created',
    in_progress: 'gastown.beads.in_progress',
    completed: 'gastown.beads.completed',
    escalated: 'gastown.beads.escalated',
    failed: 'gastown.polecats.failed',
  }
  const metric = map[stage]
  if (!metric) return
  incrementGastownMetric(metric, 1, tags)
  incrementGastownMetric('gastown.beads.stage', 1, { stage, ...tags })
}

export function recordBeadFlow(from: string, to: string, tags?: TagMap): void {
  incrementGastownMetric('gastown.flow.edge', 1, {
    from,
    to,
    ...tags,
  })
}
