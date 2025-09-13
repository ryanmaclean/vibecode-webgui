// vibecode-webgui/src/lib/mlflow/tracker.ts

/**
 * Simple MLflow client for the VibeCode project.
 *
 * It wraps the standard MLflow REST API endpoints:
 *   - /api/runs/create
 *   - /api/metrics/log
 *   - /api/params/log
 *   - /api/runs/update
 *
 * The client uses `fetch`. In Node ≥18, the native fetch is available;
 * for older versions you can install `node-fetch` and import it below.
 */

import fetch from 'node-fetch'

export interface MlflowRun {
  run_id: string
  status?: string
  info?: Record<string, unknown>
}

export class MlflowClient {
  private readonly baseUrl: string

  constructor(baseUrl?: string) {
    // MLFLOW_HOST env var is recommended for CI/CD pipelines
    this.baseUrl = baseUrl ?? process.env.MLFLOW_HOST ?? 'http://localhost:5000'
  }

  /**
   * Starts a new MLflow run.
   *
   * @param name Human‑readable run name
   */
  async startRun(name: string): Promise<MlflowRun> {
    const res = await fetch(`${this.baseUrl}/api/runs/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_name: name }),
    })
    if (!res.ok) {
      throw new Error(`MLflow startRun failed: ${await res.text()}`)
    }
    return res.json()
  }

  /**
   * Logs a metric for the given run.
   *
   * @param runId MLflow run ID
   * @param key Metric name
   * @param value Numeric metric value
   */
  async logMetric(runId: string, key: string, value: number): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/metrics/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId, key, value }),
    })
    if (!res.ok) {
      throw new Error(`MLflow logMetric failed: ${await res.text()}`)
    }
  }

  /**
   * Logs a parameter for the given run.
   *
   * @param runId MLflow run ID
   * @param key Param name
   * @param value Param value (string)
   */
  async logParam(runId: string, key: string, value: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/params/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId, key, value }),
    })
    if (!res.ok) {
      throw new Error(`MLflow logParam failed: ${await res.text()}`)
    }
  }

  /**
   * Marks a run as finished (or aborted).
   *
   * @param runId MLflow run ID
   * @param status One of `FINISHED`, `FAILED`, or `KILLED`
   */
  async endRun(runId: string, status: 'FINISHED' | 'FAILED' | 'KILLED' = 'FINISHED'): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/runs/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId, status }),
    })
    if (!res.ok) {
      throw new Error(`MLflow endRun failed: ${await res.text()}`)
    }
  }

  /**
   * Convenience wrapper that starts a run, runs an async function,
   * logs any metrics via the provided callback, and ends the run.
   *
   * @param name Run name
   * @param fn Async function that receives the runId to log metrics/params.
   */
  async withRun<T>(name: string, fn: (runId: string) => Promise<T>): Promise<T> {
    const { run_id } = await this.startRun(name)
    try {
      return await fn(run_id)
    } finally {
      await this.endRun(run_id)
    }
  }
}

/**
 * Singleton instance that can be imported elsewhere as `mlflowClient`.
 */
export const mlflowClient = new MlflowClient()
