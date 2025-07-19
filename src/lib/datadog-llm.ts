/**
 * Datadog LLM Observability Configuration
 * Provides monitoring for AI/LLM operations in VibeCode
 */

// Import ddtrace for LLM observability
// NOTE: This must be imported before any other modules that use AI services
const tracer = require('dd-trace')

interface LLMObservabilityConfig {
  enabled: boolean
  agentlessEnabled: boolean
  mlApp: string
  site: string
  apiKey?: string
  service: string
  environment: string
}

class LLMObservability {
  private static instance: LLMObservability
  private isInitialized = false
  private config: LLMObservabilityConfig

  private constructor() {
    this.config = {
      enabled: process.env.DD_LLMOBS_ENABLED === '1' || false,
      agentlessEnabled: process.env.DD_LLMOBS_AGENTLESS_ENABLED === '1' || true,
      mlApp: process.env.DD_LLMOBS_ML_APP || 'vibecode-ai',
      site: process.env.DD_SITE || process.env.DATADOG_SITE || 'datadoghq.com',
      apiKey: process.env.DD_API_KEY || process.env.DATADOG_API_KEY,
      service: process.env.DD_SERVICE || 'vibecode-webgui',
      environment: process.env.DD_ENV || process.env.NODE_ENV || 'development'
    }
  }

  public static getInstance(): LLMObservability {
    if (!LLMObservability.instance) {
      LLMObservability.instance = new LLMObservability()
    }
    return LLMObservability.instance
  }

  public initialize(): void {
    if (this.isInitialized) {
      console.log('LLM Observability already initialized')
      return
    }

    if (!this.config.enabled) {
      console.log('LLM Observability disabled via configuration')
      return
    }

    try {
      // Initialize tracer with LLM observability settings
      tracer.init({
        service: this.config.service,
        env: this.config.environment,
        version: process.env.npm_package_version || '1.0.0',
        logInjection: true,
        runtimeMetrics: true,
        ...(this.config.agentlessEnabled && {
          site: this.config.site,
          apiKey: this.config.apiKey,
        })
      })

      // Enable LLM Observability through tracer configuration
      // Note: LLM observability is enabled via environment variables
      console.log('LLM Observability enabled via environment configuration')

      // Patch supported integrations
      const { patch } = require('dd-trace')
      patch({
        openai: true,        // OpenAI integration
        anthropic: true,     // Anthropic/Claude integration
        langchain: true,     // LangChain if we use it
        fetch: true,         // HTTP requests
      })

      this.isInitialized = true
      
      console.log('🔍 Datadog LLM Observability initialized successfully', {
        mlApp: this.config.mlApp,
        service: this.config.service,
        environment: this.config.environment,
        agentlessEnabled: this.config.agentlessEnabled,
        site: this.config.site
      })

    } catch (error) {
      console.error('Failed to initialize LLM Observability:', error)
      // Don't throw - continue without observability if it fails
    }
  }

  public createWorkflowSpan<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.isInitialized) {
      console.warn('LLM Observability not initialized, executing operation without tracing')
      return operation()
    }

    try {
      const span = tracer.startSpan(`llm.workflow.${name}`, {
        tags: {
          'llm.operation': 'workflow',
          'llm.name': name,
          'service.name': this.config.service,
          'ml.app': this.config.mlApp,
          ...(metadata?.tags?.reduce((acc, tag) => ({ ...acc, [`tag.${tag}`]: true }), {}) || {})
        }
      })

      return tracer.scope().activate(span, async () => {
        try {
          if (metadata?.input) {
            span.setTag('llm.input.data', JSON.stringify(metadata.input))
          }
          
          if (metadata?.context) {
            Object.entries(metadata.context).forEach(([key, value]) => {
              span.setTag(`llm.metadata.${key}`, String(value))
            })
          }

          const result = await operation()

          if (metadata?.output !== undefined) {
            span.setTag('llm.output.data', JSON.stringify(metadata.output))
          }

          span.setTag('llm.status', 'success')
          return result
        } catch (error) {
          span.setTag('llm.status', 'error')
          span.setTag('error.message', error instanceof Error ? error.message : String(error))
          throw error
        } finally {
          span.finish()
        }
      })
    } catch (error) {
      console.error('Error in LLM workflow span:', error)
      return operation()
    }
  }

  public createTaskSpan<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.isInitialized) {
      console.warn('LLM Observability not initialized, executing operation without tracing')
      return operation()
    }

    try {
      const span = tracer.startSpan(`llm.task.${name}`, {
        tags: {
          'llm.operation': 'task',
          'llm.name': name,
          'service.name': this.config.service,
          'ml.app': this.config.mlApp,
          ...(metadata?.tags?.reduce((acc, tag) => ({ ...acc, [`tag.${tag}`]: true }), {}) || {})
        }
      })

      return tracer.scope().activate(span, async () => {
        try {
          if (metadata?.input) {
            span.setTag('llm.input.data', JSON.stringify(metadata.input))
          }
          
          if (metadata?.context) {
            Object.entries(metadata.context).forEach(([key, value]) => {
              span.setTag(`llm.metadata.${key}`, String(value))
            })
          }

          const result = await operation()

          if (metadata?.output !== undefined) {
            span.setTag('llm.output.data', JSON.stringify(metadata.output))
          }

          span.setTag('llm.status', 'success')
          return result
        } catch (error) {
          span.setTag('llm.status', 'error')
          span.setTag('error.message', error instanceof Error ? error.message : String(error))
          throw error
        } finally {
          span.finish()
        }
      })
    } catch (error) {
      console.error('Error in LLM task span:', error)
      return operation()
    }
  }

  public annotate(data: {
    input_data?: any
    output_data?: any
    metadata?: Record<string, any>
    tags?: string[]
  }): void {
    if (!this.isInitialized) return

    try {
      const activeSpan = tracer.scope().active()
      if (!activeSpan) {
        console.warn('No active span to annotate')
        return
      }

      if (data.input_data) {
        activeSpan.setTag('llm.input.data', JSON.stringify(data.input_data))
      }
      
      if (data.output_data) {
        activeSpan.setTag('llm.output.data', JSON.stringify(data.output_data))
      }
      
      if (data.metadata) {
        Object.entries(data.metadata).forEach(([key, value]) => {
          activeSpan.setTag(`llm.metadata.${key}`, String(value))
        })
      }
      
      if (data.tags) {
        data.tags.forEach(tag => {
          activeSpan.setTag(`tag.${tag}`, true)
        })
      }
    } catch (error) {
      console.error('Error annotating LLM span:', error)
    }
  }

  public flush(): Promise<void> {
    if (!this.isInitialized) return Promise.resolve()

    try {
      return new Promise((resolve) => {
        tracer.tracer._writer.flush(() => {
          console.log('LLM observability data flushed to Datadog')
          resolve()
        })
      })
    } catch (error) {
      console.error('Error flushing LLM observability data:', error)
      return Promise.resolve()
    }
  }

  public getConfig(): LLMObservabilityConfig {
    return { ...this.config }
  }
}

// Export singleton instance
export const llmObservability = LLMObservability.getInstance()

// Auto-initialize if in server environment
if (typeof window === 'undefined') {
  llmObservability.initialize()
}

export default llmObservability