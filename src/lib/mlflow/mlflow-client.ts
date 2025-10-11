/**
 * MLflow Integration Client
 * ML experiment tracking and model versioning for VibeCode AI features
 * Tracks AI model performance, experiments, and deployment metrics
 */

export interface MLflowExperiment {
  experimentId: string
  name: string
  artifactLocation: string
  lifecycleStage: 'active' | 'deleted'
  creationTime: number
  lastUpdateTime: number
  tags: Record<string, string>
}

export interface MLflowRun {
  runId: string
  runUuid: string
  experimentId: string
  status: 'RUNNING' | 'SCHEDULED' | 'FINISHED' | 'FAILED' | 'KILLED'
  startTime: number
  endTime?: number
  artifactUri: string
  lifecycleStage: 'active' | 'deleted'
  userId: string
  data: {
    metrics: Record<string, number>
    params: Record<string, string>
    tags: Record<string, string>
  }
}

export interface MLflowMetric {
  key: string
  value: number
  timestamp: number
  step?: number
}

export interface MLflowParam {
  key: string
  value: string
}

export interface MLflowArtifact {
  path: string
  isDir: boolean
  fileSize?: number
}

export interface ModelVersion {
  name: string
  version: string
  creationTimestamp: number
  lastUpdatedTimestamp: number
  userId: string
  currentStage: 'None' | 'Staging' | 'Production' | 'Archived'
  description?: string
  source: string
  runId?: string
  tags: Record<string, string>
}

export interface AIModelMetrics {
  modelName: string
  provider: string
  endpoint: string
  requestCount: number
  avgResponseTime: number
  errorRate: number
  tokenUsage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  costEstimate: number
  timestamp: number
}

export interface ExperimentConfig {
  name: string
  description?: string
  tags?: Record<string, string>
  artifactLocation?: string
}

export interface RunConfig {
  experimentId: string
  runName?: string
  tags?: Record<string, string>
  params?: Record<string, string>
}

export class MLflowClient {
  private baseURL: string
  private headers: Record<string, string>
  private isConnected: boolean = false

  constructor(config: {
    trackingUri?: string
    username?: string
    password?: string
    token?: string
  }) {
    const {
      trackingUri = process.env.MLFLOW_TRACKING_URI || 'http://localhost:5000',
      username = process.env.MLFLOW_USERNAME,
      password = process.env.MLFLOW_PASSWORD,
      token = process.env.MLFLOW_TOKEN
    } = config

    this.baseURL = trackingUri.replace(/\/+$/, '') // Remove trailing slashes
    this.headers = {
      'Content-Type': 'application/json'
    }

    // Setup authentication
    if (token) {
      this.headers['Authorization'] = `Bearer ${token}`
    } else if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString('base64')
      this.headers['Authorization'] = `Basic ${credentials}`
    }
  }

  /**
   * Test MLflow connection
   */
  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/experiments/list`, {
        method: 'GET',
        headers: this.headers
      })

      this.isConnected = response.ok
      
      if (this.isConnected) {
        // Debug log removed
      } else {
        console.warn(`❌ MLflow connection failed: ${response.status} ${response.statusText}`)
      }

      return this.isConnected
    } catch (error) {
      console.error('MLflow connection error:', error)
      this.isConnected = false
      return false
    }
  }

  /**
   * Check if MLflow is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isConnected) {
      return await this.connect()
    }
    return true
  }

  /**
   * Create a new experiment
   */
  async createExperiment(config: ExperimentConfig): Promise<string> {
    if (!await this.isAvailable()) {
      throw new Error('MLflow not available')
    }

    try {
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/experiments/create`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          name: config.name,
          artifact_location: config.artifactLocation,
          tags: config.tags ? Object.entries(config.tags).map(([key, value]) => ({ key, value })) : []
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create experiment: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      // Debug log removed`)
      return data.experiment_id
    } catch (error) {
      console.error('Failed to create MLflow experiment:', error)
      throw error
    }
  }

  /**
   * Get experiment by name or ID
   */
  async getExperiment(nameOrId: string): Promise<MLflowExperiment | null> {
    if (!await this.isAvailable()) {
      throw new Error('MLflow not available')
    }

    try {
      // First try to get by ID
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/experiments/get?experiment_id=${nameOrId}`, {
        headers: this.headers
      })

      if (!response.ok && !nameOrId.match(/^\d+$/)) {
        // If ID fails and looks like a name, search by name
        const listResponse = await fetch(`${this.baseURL}/api/2.0/mlflow/experiments/search`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            filter: `name = '${nameOrId}'`,
            max_results: 1
          })
        })

        if (listResponse.ok) {
          const listData = await listResponse.json()
          if (listData.experiments && listData.experiments.length > 0) {
            const experiment = listData.experiments[0]
            return this.formatExperiment(experiment)
          }
        }
        return null
      }

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return this.formatExperiment(data.experiment)
    } catch (error) {
      console.error('Failed to get MLflow experiment:', error)
      return null
    }
  }

  /**
   * Start a new run
   */
  async startRun(config: RunConfig): Promise<string> {
    if (!await this.isAvailable()) {
      throw new Error('MLflow not available')
    }

    try {
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/runs/create`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          experiment_id: config.experimentId,
          tags: config.tags ? Object.entries(config.tags).map(([key, value]) => ({ key, value })) : [],
          run_name: config.runName
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to start run: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const runId = data.run.info.run_id

      // Log initial parameters if provided
      if (config.params) {
        await this.logParams(runId, config.params)
      }

      // Debug log removed
      return runId
    } catch (error) {
      console.error('Failed to start MLflow run:', error)
      throw error
    }
  }

  /**
   * Log parameters for a run
   */
  async logParams(runId: string, params: Record<string, string>): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('MLflow not available')
    }

    try {
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/runs/log-batch`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          run_id: runId,
          params: Object.entries(params).map(([key, value]) => ({ key, value }))
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to log params: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to log MLflow params:', error)
      throw error
    }
  }

  /**
   * Log metrics for a run
   */
  async logMetrics(runId: string, metrics: Record<string, number>, step?: number): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('MLflow not available')
    }

    try {
      const timestamp = Date.now()
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/runs/log-batch`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          run_id: runId,
          metrics: Object.entries(metrics).map(([key, value]) => ({
            key,
            value,
            timestamp,
            step: step || 0
          }))
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to log metrics: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to log MLflow metrics:', error)
      throw error
    }
  }

  /**
   * Finish a run
   */
  async finishRun(runId: string, status: 'FINISHED' | 'FAILED' | 'KILLED' = 'FINISHED'): Promise<void> {
    if (!await this.isAvailable()) {
      throw new Error('MLflow not available')
    }

    try {
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/runs/update`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          run_id: runId,
          status,
          end_time: Date.now()
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to finish run: ${response.status} ${response.statusText}`)
      }

      // Debug log removed`)
    } catch (error) {
      console.error('Failed to finish MLflow run:', error)
      throw error
    }
  }

  /**
   * Track AI model usage and performance
   */
  async trackAIModelMetrics(metrics: AIModelMetrics): Promise<void> {
    try {
      // Get or create experiment for AI model tracking
      let experiment = await this.getExperiment('ai-model-tracking')
      if (!experiment) {
        const experimentId = await this.createExperiment({
          name: 'ai-model-tracking',
          description: 'Tracking AI model usage and performance metrics'
        })
        experiment = { experimentId } as MLflowExperiment
      }

      // Start run for this tracking session
      const runId = await this.startRun({
        experimentId: experiment.experimentId,
        runName: `${metrics.modelName}-${Date.now()}`,
        tags: {
          model_name: metrics.modelName,
          provider: metrics.provider,
          endpoint: metrics.endpoint
        },
        params: {
          model_name: metrics.modelName,
          provider: metrics.provider,
          endpoint: metrics.endpoint
        }
      })

      // Log performance metrics
      await this.logMetrics(runId, {
        request_count: metrics.requestCount,
        avg_response_time: metrics.avgResponseTime,
        error_rate: metrics.errorRate,
        prompt_tokens: metrics.tokenUsage.promptTokens,
        completion_tokens: metrics.tokenUsage.completionTokens,
        total_tokens: metrics.tokenUsage.totalTokens,
        cost_estimate: metrics.costEstimate
      })

      // Finish the run
      await this.finishRun(runId)
    } catch (error) {
      console.error('Failed to track AI model metrics:', error)
    }
  }

  /**
   * Get experiment runs with optional filtering
   */
  async getRuns(experimentId: string, limit: number = 100): Promise<MLflowRun[]> {
    if (!await this.isAvailable()) {
      throw new Error('MLflow not available')
    }

    try {
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/runs/search`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          experiment_ids: [experimentId],
          max_results: limit,
          order_by: ['start_time DESC']
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to get runs: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.runs?.map((run: any) => this.formatRun(run)) || []
    } catch (error) {
      console.error('Failed to get MLflow runs:', error)
      return []
    }
  }

  /**
   * Format experiment data
   */
  private formatExperiment(experiment: any): MLflowExperiment {
    return {
      experimentId: experiment.experiment_id,
      name: experiment.name,
      artifactLocation: experiment.artifact_location,
      lifecycleStage: experiment.lifecycle_stage,
      creationTime: parseInt(experiment.creation_time),
      lastUpdateTime: parseInt(experiment.last_update_time),
      tags: experiment.tags?.reduce((acc: Record<string, string>, tag: any) => {
        acc[tag.key] = tag.value
        return acc
      }, {}) || {}
    }
  }

  /**
   * Format run data
   */
  private formatRun(run: any): MLflowRun {
    const info = run.info
    const data = run.data || {}

    return {
      runId: info.run_id,
      runUuid: info.run_uuid || info.run_id,
      experimentId: info.experiment_id,
      status: info.status,
      startTime: parseInt(info.start_time),
      endTime: info.end_time ? parseInt(info.end_time) : undefined,
      artifactUri: info.artifact_uri,
      lifecycleStage: info.lifecycle_stage,
      userId: info.user_id,
      data: {
        metrics: data.metrics?.reduce((acc: Record<string, number>, metric: any) => {
          acc[metric.key] = metric.value
          return acc
        }, {}) || {},
        params: data.params?.reduce((acc: Record<string, string>, param: any) => {
          acc[param.key] = param.value
          return acc
        }, {}) || {},
        tags: data.tags?.reduce((acc: Record<string, string>, tag: any) => {
          acc[tag.key] = tag.value
          return acc
        }, {}) || {}
      }
    }
  }

  /**
   * Health check for MLflow instance
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy'
    details: {
      connected: boolean
      experimentCount?: number
      version?: string
    }
  }> {
    try {
      const available = await this.isAvailable()
      
      if (!available) {
        return {
          status: 'unhealthy',
          details: { connected: false }
        }
      }

      // Get experiment count as additional health indicator
      const response = await fetch(`${this.baseURL}/api/2.0/mlflow/experiments/list`, {
        headers: this.headers
      })

      if (response.ok) {
        const data = await response.json()
        return {
          status: 'healthy',
          details: {
            connected: true,
            experimentCount: data.experiments?.length || 0
          }
        }
      } else {
        return {
          status: 'unhealthy',
          details: { connected: false }
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { connected: false }
      }
    }
  }
}

// Export singleton instance
export const mlflowClient = new MLflowClient({
  trackingUri: process.env.MLFLOW_TRACKING_URI,
  username: process.env.MLFLOW_USERNAME,
  password: process.env.MLFLOW_PASSWORD,
  token: process.env.MLFLOW_TOKEN
})

export default mlflowClient