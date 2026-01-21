/**
 * Multi-model orchestration system with intelligent routing
 * Manages multiple AI providers and automatically selects the best model for each task
 */

import { z } from 'zod'

// Model capability definitions
export interface ModelCapabilities {
  codeGeneration: number // 0-10 scale
  reasoning: number
  creativity: number
  speed: number // requests per minute
  contextLength: number // tokens
  multimodal: boolean
  functionCalling: boolean
  jsonMode: boolean
  streaming: boolean
  costPerToken: number // cost per 1K tokens
}

// Model configuration
export interface ModelConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'meta' | 'mistral' | 'cohere'
  model: string
  capabilities: ModelCapabilities
  enabled: boolean
  rateLimits: {
    requestsPerMinute: number
    tokensPerMinute: number
  }
  fallbackModels: string[]
}

// Task type definitions
export enum TaskType {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  DEBUGGING = 'debugging',
  DOCUMENTATION = 'documentation',
  EXPLANATION = 'explanation',
  PLANNING = 'planning',
  CREATIVE_WRITING = 'creative_writing',
  DATA_ANALYSIS = 'data_analysis',
  GENERAL_CHAT = 'general_chat',
  FUNCTION_CALLING = 'function_calling',
  JSON_GENERATION = 'json_generation',
  MULTIMODAL = 'multimodal',
  REASONING = 'reasoning'
}

// Request context for model selection
export interface RequestContext {
  taskType: TaskType
  priority: 'low' | 'medium' | 'high'
  expectedTokens: number
  requiresStreaming: boolean
  requiresJsonMode: boolean
  requiresFunctionCalling: boolean
  requiresMultimodal: boolean
  userId?: string
  budgetConstraints?: {
    maxCostPerRequest: number
  }
}

// Model selection result
export interface ModelSelection {
  primaryModel: ModelConfig
  fallbackModels: ModelConfig[]
  confidence: number
  reasoning: string
  estimatedCost: number
  estimatedLatency: number
}

// Default model configurations
export const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    capabilities: {
      codeGeneration: 9.5,
      reasoning: 9.8,
      creativity: 8.5,
      speed: 60,
      contextLength: 200000,
      multimodal: true,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      costPerToken: 0.003
    },
    enabled: true,
    rateLimits: {
      requestsPerMinute: 1000,
      tokensPerMinute: 80000
    },
    fallbackModels: ['gpt-4-turbo', 'claude-3-haiku']
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    model: 'gpt-4-turbo-preview',
    capabilities: {
      codeGeneration: 9.0,
      reasoning: 9.5,
      creativity: 9.0,
      speed: 80,
      contextLength: 128000,
      multimodal: true,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      costPerToken: 0.01
    },
    enabled: true,
    rateLimits: {
      requestsPerMinute: 500,
      tokensPerMinute: 150000
    },
    fallbackModels: ['gpt-3.5-turbo', 'claude-3-sonnet']
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    model: 'gpt-3.5-turbo-1106',
    capabilities: {
      codeGeneration: 7.5,
      reasoning: 7.0,
      creativity: 8.0,
      speed: 150,
      contextLength: 16384,
      multimodal: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      costPerToken: 0.001
    },
    enabled: true,
    rateLimits: {
      requestsPerMinute: 3500,
      tokensPerMinute: 90000
    },
    fallbackModels: ['claude-3-haiku']
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    capabilities: {
      codeGeneration: 7.0,
      reasoning: 7.5,
      creativity: 7.0,
      speed: 200,
      contextLength: 200000,
      multimodal: false,
      functionCalling: false,
      jsonMode: false,
      streaming: true,
      costPerToken: 0.0005
    },
    enabled: true,
    rateLimits: {
      requestsPerMinute: 1000,
      tokensPerMinute: 100000
    },
    fallbackModels: ['gpt-3.5-turbo']
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    model: 'gemini-pro',
    capabilities: {
      codeGeneration: 8.0,
      reasoning: 8.5,
      creativity: 8.0,
      speed: 100,
      contextLength: 30720,
      multimodal: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      costPerToken: 0.0005
    },
    enabled: true,
    rateLimits: {
      requestsPerMinute: 60,
      tokensPerMinute: 32000
    },
    fallbackModels: ['gpt-3.5-turbo', 'claude-3-haiku']
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'mistral',
    model: 'mistral-large-latest',
    capabilities: {
      codeGeneration: 8.5,
      reasoning: 8.0,
      creativity: 7.5,
      speed: 90,
      contextLength: 32000,
      multimodal: false,
      functionCalling: true,
      jsonMode: true,
      streaming: true,
      costPerToken: 0.008
    },
    enabled: true,
    rateLimits: {
      requestsPerMinute: 1000,
      tokensPerMinute: 100000
    },
    fallbackModels: ['gpt-4-turbo', 'claude-3-sonnet']
  }
]

/**
 * Model orchestration engine for intelligent model selection and routing
 */
export class ModelOrchestrator {
  private models: Map<string, ModelConfig> = new Map()
  private usageStats: Map<string, {
    requests: number
    tokens: number
    errors: number
    averageLatency: number
    lastUsed: Date
  }> = new Map()

  constructor(models: ModelConfig[] = DEFAULT_MODELS) {
    this.loadModels(models)
    this.initializeUsageStats()
  }

  private loadModels(models: ModelConfig[]): void {
    models.forEach(model => {
      this.models.set(model.id, model)
    })
  }

  private initializeUsageStats(): void {
    this.models.forEach((_, modelId) => {
      this.usageStats.set(modelId, {
        requests: 0,
        tokens: 0,
        errors: 0,
        averageLatency: 0,
        lastUsed: new Date()
      })
    })
  }

  /**
   * Select the best model for a given context
   */
  selectModel(context: RequestContext): ModelSelection {
    const availableModels = Array.from(this.models.values()).filter(model => 
      model.enabled && this.meetsRequirements(model, context)
    )

    if (availableModels.length === 0) {
      throw new Error('No suitable models available for the given context')
    }

    // Score each model based on the context
    const scoredModels = availableModels.map(model => ({
      model,
      score: this.calculateModelScore(model, context)
    }))

    // Sort by score (highest first)
    scoredModels.sort((a, b) => b.score - a.score)

    const selectedModel = scoredModels[0].model
    const fallbackModels = scoredModels.slice(1, 4).map(sm => sm.model)

    return {
      primaryModel: selectedModel,
      fallbackModels,
      confidence: scoredModels[0].score / 10, // Normalize to 0-1
      reasoning: this.generateSelectionReasoning(selectedModel, context),
      estimatedCost: this.estimateCost(selectedModel, context.expectedTokens),
      estimatedLatency: this.estimateLatency(selectedModel, context.expectedTokens)
    }
  }

  private meetsRequirements(model: ModelConfig, context: RequestContext): boolean {
    // Check hard requirements
    if (context.requiresJsonMode && !model.capabilities.jsonMode) return false
    if (context.requiresFunctionCalling && !model.capabilities.functionCalling) return false
    if (context.requiresMultimodal && !model.capabilities.multimodal) return false
    if (context.expectedTokens > model.capabilities.contextLength) return false

    // Check budget constraints
    if (context.budgetConstraints) {
      const estimatedCost = this.estimateCost(model, context.expectedTokens)
      if (estimatedCost > context.budgetConstraints.maxCostPerRequest) return false
    }

    // Check rate limits
    const stats = this.usageStats.get(model.id)
    if (stats && this.isRateLimited(model, stats)) return false

    return true
  }

  private calculateModelScore(model: ModelConfig, context: RequestContext): number {
    let score = 0

    // Task-specific scoring
    switch (context.taskType) {
      case TaskType.CODE_GENERATION:
        score = model.capabilities.codeGeneration * 0.6 + 
                model.capabilities.reasoning * 0.3 + 
                model.capabilities.speed * 0.1
        break
      case TaskType.CODE_REVIEW:
      case TaskType.DEBUGGING:
        score = model.capabilities.reasoning * 0.7 + 
                model.capabilities.codeGeneration * 0.3
        break
      case TaskType.CREATIVE_WRITING:
        score = model.capabilities.creativity * 0.8 + 
                model.capabilities.reasoning * 0.2
        break
      case TaskType.DATA_ANALYSIS:
        score = model.capabilities.reasoning * 0.8 + 
                model.capabilities.codeGeneration * 0.2
        break
      default:
        score = (model.capabilities.codeGeneration + 
                model.capabilities.reasoning + 
                model.capabilities.creativity) / 3
    }

    // Priority adjustments
    if (context.priority === 'high') {
      score += model.capabilities.speed * 0.2
    } else if (context.priority === 'low') {
      score += (10 - model.capabilities.costPerToken * 1000) * 0.2
    }

    // Reliability bonus based on historical performance
    const stats = this.usageStats.get(model.id)
    if (stats) {
      const errorRate = stats.errors / Math.max(stats.requests, 1)
      score *= (1 - errorRate * 0.3) // Reduce score for unreliable models
    }

    // Streaming bonus if required
    if (context.requiresStreaming && model.capabilities.streaming) {
      score += 0.5
    }

    return Math.min(score, 10) // Cap at 10
  }

  private generateSelectionReasoning(model: ModelConfig, context: RequestContext): string {
    const reasons: string[] = []

    switch (context.taskType) {
      case TaskType.CODE_GENERATION:
        reasons.push(`Selected ${model.name} for excellent code generation capabilities (${model.capabilities.codeGeneration}/10)`)
        break
      case TaskType.REASONING:
        reasons.push(`Selected ${model.name} for superior reasoning abilities (${model.capabilities.reasoning}/10)`)
        break
      case TaskType.CREATIVE_WRITING:
        reasons.push(`Selected ${model.name} for strong creative capabilities (${model.capabilities.creativity}/10)`)
        break
      default:
        reasons.push(`Selected ${model.name} as the best balanced model for this task`)
    }

    if (context.priority === 'high') {
      reasons.push(`High priority task - selected for speed (${model.capabilities.speed} req/min)`)
    }

    if (context.budgetConstraints) {
      reasons.push(`Cost-effective choice at $${model.capabilities.costPerToken}/1K tokens`)
    }

    return reasons.join('; ')
  }

  private estimateCost(model: ModelConfig, tokens: number): number {
    return (tokens / 1000) * model.capabilities.costPerToken
  }

  private estimateLatency(model: ModelConfig, tokens: number): number {
    // Base latency + processing time based on tokens
    const baseLatency = 1000 // 1 second base
    const processingTime = (tokens / model.capabilities.speed) * 60 * 1000 // Convert to ms
    return baseLatency + processingTime
  }

  private isRateLimited(model: ModelConfig, stats: any): boolean {
    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60000)
    
    // Simple rate limiting check - in production, this would be more sophisticated
    return stats.lastUsed > oneMinuteAgo && stats.requests >= model.rateLimits.requestsPerMinute
  }

  /**
   * Update usage statistics after a request
   */
  updateUsageStats(modelId: string, tokens: number, latency: number, success: boolean): void {
    const stats = this.usageStats.get(modelId)
    if (!stats) return

    stats.requests++
    stats.tokens += tokens
    if (!success) stats.errors++
    
    // Update average latency with exponential moving average
    stats.averageLatency = stats.averageLatency * 0.9 + latency * 0.1
    stats.lastUsed = new Date()
    
    this.usageStats.set(modelId, stats)
  }

  /**
   * Get model performance statistics
   */
  getModelStats(): Record<string, any> {
    const stats: Record<string, any> = {}
    this.usageStats.forEach((stat, modelId) => {
      const model = this.models.get(modelId)
      stats[modelId] = {
        name: model?.name,
        ...stat,
        errorRate: stat.errors / Math.max(stat.requests, 1),
        successRate: 1 - (stat.errors / Math.max(stat.requests, 1))
      }
    })
    return stats
  }

  /**
   * Add or update a model configuration
   */
  addModel(model: ModelConfig): void {
    this.models.set(model.id, model)
    if (!this.usageStats.has(model.id)) {
      this.usageStats.set(model.id, {
        requests: 0,
        tokens: 0,
        errors: 0,
        averageLatency: 0,
        lastUsed: new Date()
      })
    }
  }

  /**
   * Enable or disable a model
   */
  toggleModel(modelId: string, enabled: boolean): void {
    const model = this.models.get(modelId)
    if (model) {
      model.enabled = enabled
      this.models.set(modelId, model)
    }
  }

  /**
   * Get all available models
   */
  getAvailableModels(): ModelConfig[] {
    return Array.from(this.models.values())
  }

  /**
   * Get models filtered by capabilities
   */
  getModelsByCapability(capability: keyof ModelCapabilities, minValue?: number): ModelConfig[] {
    return Array.from(this.models.values()).filter(model => {
      if (typeof model.capabilities[capability] === 'boolean') {
        return model.capabilities[capability]
      }
      return minValue ? model.capabilities[capability] >= minValue : true
    })
  }

  /**
   * Recommend models for a specific use case
   */
  recommendModels(context: RequestContext, count: number = 3): ModelSelection[] {
    const availableModels = Array.from(this.models.values()).filter(model => 
      model.enabled && this.meetsRequirements(model, context)
    )

    const selections = availableModels
      .map(model => ({
        primaryModel: model,
        fallbackModels: [],
        confidence: this.calculateModelScore(model, context) / 10,
        reasoning: this.generateSelectionReasoning(model, context),
        estimatedCost: this.estimateCost(model, context.expectedTokens),
        estimatedLatency: this.estimateLatency(model, context.expectedTokens)
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, count)

    return selections
  }
}

// Export singleton instance
export const modelOrchestrator = new ModelOrchestrator()

// Task type detection utilities
export const TaskDetector = {
  detectTaskType(prompt: string, context?: any): TaskType {
    const lowerPrompt = prompt.toLowerCase()

    // Code-related patterns
    if (this.matchesPatterns(lowerPrompt, [
      /write.*code/, /create.*function/, /implement.*class/, /build.*application/,
      /generate.*script/, /code.*for/, /programming/, /algorithm/
    ])) {
      return TaskType.CODE_GENERATION
    }

    if (this.matchesPatterns(lowerPrompt, [
      /review.*code/, /check.*code/, /analyze.*code/, /code.*review/,
      /find.*bug/, /debug/, /optimize.*code/
    ])) {
      return TaskType.CODE_REVIEW
    }

    if (this.matchesPatterns(lowerPrompt, [
      /explain.*code/, /document/, /comment.*code/, /write.*documentation/
    ])) {
      return TaskType.DOCUMENTATION
    }

    // Creative patterns
    if (this.matchesPatterns(lowerPrompt, [
      /write.*story/, /create.*content/, /creative/, /blog.*post/,
      /marketing/, /copywriting/
    ])) {
      return TaskType.CREATIVE_WRITING
    }

    // Analysis patterns
    if (this.matchesPatterns(lowerPrompt, [
      /analyze.*data/, /statistics/, /chart/, /graph/, /trend/,
      /data.*analysis/, /sql.*query/
    ])) {
      return TaskType.DATA_ANALYSIS
    }

    // Planning patterns
    if (this.matchesPatterns(lowerPrompt, [
      /plan/, /strategy/, /roadmap/, /architecture/, /design.*system/
    ])) {
      return TaskType.PLANNING
    }

    return TaskType.GENERAL_CHAT
  },

  matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text))
  }
}