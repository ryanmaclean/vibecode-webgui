/**
 * React hook for using the model orchestrator in components
 */

import { useState, useEffect, useCallback } from 'react'
import { 
modelOrchestrator, 
  ModelConfig, 
  ModelSelection, 
  TaskType, 
  RequestContext,
  TaskDetector 
} from '@/lib/ai/model-orchestration'
// import { logger } from '@/lib/logger';

interface UseModelOrchestratorOptions {
  autoDetectTaskType?: boolean
  defaultTaskType?: TaskType
  defaultPriority?: 'low' | 'medium' | 'high'
  budgetConstraints?: {
    maxCostPerRequest: number
  }
}

export function useModelOrchestrator(options: UseModelOrchestratorOptions = {}) {
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    autoDetectTaskType = true,
    defaultTaskType = TaskType.GENERAL_CHAT,
    defaultPriority = 'medium',
    budgetConstraints
  } = options

  useEffect(() => {
    loadAvailableModels()
  }, [])

  const loadAvailableModels = useCallback(() => {
    try {
      const models = modelOrchestrator.getAvailableModels()
      setAvailableModels(models)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load models')
    }
  }, [])

  const selectBestModel = useCallback(async (
    prompt: string,
    context: Partial<RequestContext> = {}
  ): Promise<ModelSelection | null> => {
    setIsLoading(true)
    setError(null)

    try {
      // Auto-detect task type if enabled
      const taskType = autoDetectTaskType 
        ? TaskDetector.detectTaskType(prompt, context)
        : context.taskType || defaultTaskType

      // Build complete context
      const requestContext: RequestContext = {
        taskType,
        priority: context.priority || defaultPriority,
        expectedTokens: context.expectedTokens || estimateTokens(prompt),
        requiresStreaming: context.requiresStreaming || false,
        requiresJsonMode: context.requiresJsonMode || false,
        requiresFunctionCalling: context.requiresFunctionCalling || false,
        requiresMultimodal: context.requiresMultimodal || false,
        userId: context.userId,
        budgetConstraints: context.budgetConstraints || budgetConstraints
      }

      const selection = modelOrchestrator.selectModel(requestContext)
      setSelectedModel(selection)
      return selection
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select model'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [autoDetectTaskType, defaultTaskType, defaultPriority, budgetConstraints])

  const getModelRecommendations = useCallback((
    context: RequestContext,
    count: number = 3
  ): ModelSelection[] => {
    try {
      return modelOrchestrator.recommendModels(context, count)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to get recommendations')
      return []
    }
  }, [])

  const getModelsByCapability = useCallback((
    capability: keyof ModelConfig['capabilities'],
    minValue?: number
  ): ModelConfig[] => {
    return modelOrchestrator.getModelsByCapability(capability, minValue)
  }, [])

  const reportModelUsage = useCallback((
    modelId: string,
    tokens: number,
    latency: number,
    success: boolean
  ) => {
    try {
      modelOrchestrator.updateUsageStats(modelId, tokens, latency, success)
    } catch (error) {
      console.error('Failed to report model usage:', error)
    }
  }, [])

  const getModelStats = useCallback(() => {
    try {
      return modelOrchestrator.getModelStats()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to get model stats')
      return {}
    }
  }, [])

  const toggleModel = useCallback((modelId: string, enabled: boolean) => {
    try {
      modelOrchestrator.toggleModel(modelId, enabled)
      loadAvailableModels() // Refresh the list
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to toggle model')
    }
  }, [loadAvailableModels])

  const addModel = useCallback((model: ModelConfig) => {
    try {
      modelOrchestrator.addModel(model)
      loadAvailableModels() // Refresh the list
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add model')
    }
  }, [loadAvailableModels])

  return {
    // Data
    availableModels,
    selectedModel,
    isLoading,
    error,

    // Actions
    selectBestModel,
    getModelRecommendations,
    getModelsByCapability,
    reportModelUsage,
    getModelStats,
    toggleModel,
    addModel,
    refresh: loadAvailableModels,

    // Utilities
    clearError: () => setError(null),
    clearSelection: () => setSelectedModel(null)
  }
}

// Utility function to estimate token count from text
function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4)
}

// Hook for specific model capabilities
export function useModelCapabilities() {
  const [capabilities, setCapabilities] = useState<{
    codeGeneration: ModelConfig[]
    multimodal: ModelConfig[]
    functionCalling: ModelConfig[]
    jsonMode: ModelConfig[]
    streaming: ModelConfig[]
    highReasoning: ModelConfig[]
    creative: ModelConfig[]
    fast: ModelConfig[]
    costEffective: ModelConfig[]
  } | null>(null)

  useEffect(() => {
    const models = modelOrchestrator.getAvailableModels()
    
    setCapabilities({
      codeGeneration: models
        .filter(m => m.capabilities.codeGeneration >= 8)
        .sort((a, b) => b.capabilities.codeGeneration - a.capabilities.codeGeneration),
      multimodal: models.filter(m => m.capabilities.multimodal),
      functionCalling: models.filter(m => m.capabilities.functionCalling),
      jsonMode: models.filter(m => m.capabilities.jsonMode),
      streaming: models.filter(m => m.capabilities.streaming),
      highReasoning: models
        .filter(m => m.capabilities.reasoning >= 8)
        .sort((a, b) => b.capabilities.reasoning - a.capabilities.reasoning),
      creative: models
        .filter(m => m.capabilities.creativity >= 8)
        .sort((a, b) => b.capabilities.creativity - a.capabilities.creativity),
      fast: models
        .filter(m => m.capabilities.speed >= 100)
        .sort((a, b) => b.capabilities.speed - a.capabilities.speed),
      costEffective: models
        .sort((a, b) => a.capabilities.costPerToken - b.capabilities.costPerToken)
        .slice(0, 5)
    })
  }, [])

  return capabilities
}

// Hook for task-specific model recommendations
export function useTaskSpecificModels(taskType: TaskType) {
  const [recommendations, setRecommendations] = useState<ModelSelection[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (taskType) {
      loadRecommendations()
    }
  }, [taskType])

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const context: RequestContext = {
        taskType,
        priority: 'medium',
        expectedTokens: 2000,
        requiresStreaming: false,
        requiresJsonMode: false,
        requiresFunctionCalling: false,
        requiresMultimodal: false
      }

      const recs = modelOrchestrator.recommendModels(context, 5)
      setRecommendations(recs)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load recommendations')
    } finally {
      setIsLoading(false)
    }
  }, [taskType])

  return {
    recommendations,
    isLoading,
    error,
    refresh: loadRecommendations
  }
}

// Hook for model performance monitoring
export function useModelPerformance() {
  const [stats, setStats] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(false)

  const loadStats = useCallback(() => {
    setIsLoading(true)
    try {
      const modelStats = modelOrchestrator.getModelStats()
      setStats(modelStats)
    } catch (error) {
      console.error('Failed to load model stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    
    // Set up periodic refresh
    const interval = setInterval(loadStats, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [loadStats])

  return {
    stats,
    isLoading,
    refresh: loadStats
  }
}