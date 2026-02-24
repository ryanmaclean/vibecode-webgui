/**
 * React hook for managing model selection state in UI components
 */

import { useState, useEffect, useCallback } from 'react'
import { intelligentModelSelection, ModelCapability } from '@/lib/services/intelligent-model-selection'
import type { ModelProfile } from '@/types/model-comparison'
import { useModelChangeDetection } from './useModelChangeDetection'

interface UseModelSelectionOptions {
  /** Initial model ID to select */
  initialModelId?: string
  /** Maximum number of recent models to track */
  maxRecentModels?: number
  /** LocalStorage key prefix for persistence */
  storagePrefix?: string
  /** Auto-save selection to localStorage */
  autoSave?: boolean
}

const DEFAULT_STORAGE_PREFIX = 'vibecode_model_selection'
const DEFAULT_MAX_RECENT = 5

export function useModelSelection(options: UseModelSelectionOptions = {}) {
  const {
    initialModelId,
    maxRecentModels = DEFAULT_MAX_RECENT,
    storagePrefix = DEFAULT_STORAGE_PREFIX,
    autoSave = true,
  } = options

  const [selectedModel, setSelectedModel] = useState<ModelCapability | null>(null)
  const [previousModel, setPreviousModel] = useState<ModelCapability | null>(null)
  const [favoriteModels, setFavoriteModels] = useState<string[]>([])
  const [recentModels, setRecentModels] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<{
    message: string
    type: 'info' | 'success' | 'error'
    show: boolean
  } | null>(null)

  // Integrate model change detection
  const modelChanges = useModelChangeDetection({
    storagePrefix: `${storagePrefix}_changes`,
    autoSave,
    enableSync: false, // Let the app control when to start sync
  })

  // LocalStorage keys
  const STORAGE_KEYS = {
    selectedModel: `${storagePrefix}_selected`,
    favorites: `${storagePrefix}_favorites`,
    recent: `${storagePrefix}_recent`,
  }

  // Load persisted state from localStorage
  useEffect(() => {
    try {
      // Load favorites
      const savedFavorites = localStorage.getItem(STORAGE_KEYS.favorites)
      if (savedFavorites) {
        setFavoriteModels(JSON.parse(savedFavorites))
      }

      // Load recent models
      const savedRecent = localStorage.getItem(STORAGE_KEYS.recent)
      if (savedRecent) {
        setRecentModels(JSON.parse(savedRecent))
      }

      // Load selected model
      const savedSelectedId = localStorage.getItem(STORAGE_KEYS.selectedModel)
      const modelId = initialModelId || savedSelectedId

      if (modelId) {
        const model = intelligentModelSelection.getModelById(modelId)
        if (model) {
          setSelectedModel(model)
        } else {
          // Fallback to Claude 3.5 Sonnet if saved model not found
          const fallback = intelligentModelSelection.getModelById('anthropic/claude-3.5-sonnet')
          setSelectedModel(fallback || null)
        }
      } else {
        // Default to Claude 3.5 Sonnet
        const defaultModel = intelligentModelSelection.getModelById('anthropic/claude-3.5-sonnet')
        setSelectedModel(defaultModel || null)
      }
    } catch (error) {
      console.error('Failed to load model selection from localStorage:', error)
      setError(error instanceof Error ? error.message : 'Failed to load saved preferences')
    }
  }, [initialModelId, STORAGE_KEYS.favorites, STORAGE_KEYS.recent, STORAGE_KEYS.selectedModel])

  // Save to localStorage when state changes
  useEffect(() => {
    if (!autoSave) return

    try {
      if (selectedModel) {
        localStorage.setItem(STORAGE_KEYS.selectedModel, selectedModel.id)
      }
    } catch (error) {
      console.error('Failed to save selected model:', error)
    }
  }, [selectedModel, autoSave, STORAGE_KEYS.selectedModel])

  useEffect(() => {
    if (!autoSave) return

    try {
      localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favoriteModels))
    } catch (error) {
      console.error('Failed to save favorite models:', error)
    }
  }, [favoriteModels, autoSave, STORAGE_KEYS.favorites])

  useEffect(() => {
    if (!autoSave) return

    try {
      localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(recentModels))
    } catch (error) {
      console.error('Failed to save recent models:', error)
    }
  }, [recentModels, autoSave, STORAGE_KEYS.recent])

  /**
   * Detect if a model change represents a downgrade
   */
  const isModelDowngrade = useCallback((fromModel: ModelCapability | null, toModel: ModelCapability) => {
    if (!fromModel) return false

    const qualityOrder = { basic: 1, good: 2, excellent: 3 }
    const fromQuality = qualityOrder[fromModel.qualityTier]
    const toQuality = qualityOrder[toModel.qualityTier]

    return toQuality < fromQuality
  }, [])

  /**
   * Select a model by ID
   */
  const selectModel = useCallback((modelId: string, skipDowngradeCheck = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const model = intelligentModelSelection.getModelById(modelId)

      if (!model) {
        throw new Error(`Model not found: ${modelId}`)
      }

      // Check for downgrade
      if (!skipDowngradeCheck && isModelDowngrade(selectedModel, model)) {
        setNotification({
          message: `Model changed from ${selectedModel?.name} to ${model.name} (lower quality tier). You can revert this change.`,
          type: 'info',
          show: true,
        })
      }

      // Store previous model before updating
      if (selectedModel) {
        setPreviousModel(selectedModel)
      }

      setSelectedModel(model)

      // Add to recent models (remove duplicates, keep most recent first)
      setRecentModels(prev => {
        const filtered = prev.filter(id => id !== modelId)
        return [modelId, ...filtered].slice(0, maxRecentModels)
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to select model'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [maxRecentModels, selectedModel, isModelDowngrade])

  /**
   * Toggle a model in favorites
   */
  const toggleFavorite = useCallback((modelId: string) => {
    setFavoriteModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId)
      } else {
        return [...prev, modelId]
      }
    })
  }, [])

  /**
   * Check if a model is favorited
   */
  const isFavorite = useCallback((modelId: string) => {
    return favoriteModels.includes(modelId)
  }, [favoriteModels])

  /**
   * Get all available models
   */
  const getAllModels = useCallback(() => {
    return intelligentModelSelection.getAllModels()
  }, [])

  /**
   * Get models by provider
   */
  const getModelsByProvider = useCallback((provider: 'openrouter' | 'huggingface') => {
    return intelligentModelSelection.getModelsByProvider(provider)
  }, [])

  /**
   * Get favorite model objects
   */
  const getFavoriteModels = useCallback(() => {
    return favoriteModels
      .map(id => intelligentModelSelection.getModelById(id))
      .filter((model): model is ModelCapability => model !== undefined)
  }, [favoriteModels])

  /**
   * Get recent model objects
   */
  const getRecentModels = useCallback(() => {
    return recentModels
      .map(id => intelligentModelSelection.getModelById(id))
      .filter((model): model is ModelCapability => model !== undefined)
  }, [recentModels])

  /**
   * Clear recent models history
   */
  const clearRecent = useCallback(() => {
    setRecentModels([])
  }, [])

  /**
   * Clear all favorites
   */
  const clearFavorites = useCallback(() => {
    setFavoriteModels([])
  }, [])

  /**
   * Reset to default model
   */
  const resetToDefault = useCallback(() => {
    const defaultModel = intelligentModelSelection.getModelById('anthropic/claude-3.5-sonnet')
    if (defaultModel) {
      setSelectedModel(defaultModel)
    }
  }, [])

  /**
   * Get model by ID
   */
  const getModelById = useCallback((modelId: string) => {
    return intelligentModelSelection.getModelById(modelId)
  }, [])

  /**
   * Revert to previous model
   */
  const revertToPreviousModel = useCallback(() => {
    if (!previousModel) {
      setError('No previous model to revert to')
      return
    }

    const modelToRevert = previousModel
    setPreviousModel(selectedModel)
    setSelectedModel(modelToRevert)
    setNotification(null)

    // Add to recent models
    setRecentModels(prev => {
      const filtered = prev.filter(id => id !== modelToRevert.id)
      return [modelToRevert.id, ...filtered].slice(0, maxRecentModels)
    })
  }, [previousModel, selectedModel, maxRecentModels])

  /**
   * Dismiss notification
   */
  const dismissNotification = useCallback(() => {
    setNotification(null)
  }, [])

  return {
    // State
    selectedModel,
    previousModel,
    favoriteModels,
    recentModels,
    isLoading,
    error,
    notification,

    // Actions
    selectModel,
    toggleFavorite,
    isFavorite,
    clearRecent,
    clearFavorites,
    resetToDefault,
    revertToPreviousModel,
    dismissNotification,

    // Queries
    getAllModels,
    getModelsByProvider,
    getFavoriteModels,
    getRecentModels,
    getModelById,

    // Utilities
    clearError: () => setError(null),

    // Model change detection
    modelChanges: {
      isSyncing: modelChanges.isSyncing,
      lastSyncTime: modelChanges.lastSyncTime,
      notifications: modelChanges.notifications,
      activeNotifications: modelChanges.activeNotifications,
      unseenNotifications: modelChanges.unseenNotifications,
      unseenCount: modelChanges.unseenCount,
      activeCount: modelChanges.activeCount,
      newModels: modelChanges.newModels,
      deprecatedModels: modelChanges.deprecatedModels,
      priceChanges: modelChanges.priceChanges,
      updatedModels: modelChanges.updatedModels,
      removedModels: modelChanges.removedModels,
      triggerSync: modelChanges.triggerSync,
      dismissNotification: modelChanges.dismissNotification,
      markNotificationSeen: modelChanges.markNotificationSeen,
      markAllSeen: modelChanges.markAllSeen,
      clearDismissed: modelChanges.clearDismissed,
      clearAll: modelChanges.clearAll,
      hasDeprecation: modelChanges.hasDeprecation,
      hasPriceChange: modelChanges.hasPriceChange,
      getReplacementModel: modelChanges.getReplacementModel,
      getSyncStatus: modelChanges.getSyncStatus,
    },
  }
}

/**
 * Hook for filtering models by criteria
 */
export function useModelFilters() {
  const [filters, setFilters] = useState<{
    costTier?: 'free' | 'low' | 'medium' | 'high'
    speedTier?: 'slow' | 'medium' | 'fast'
    qualityTier?: 'basic' | 'good' | 'excellent'
    provider?: 'openrouter' | 'huggingface'
    capabilities?: Array<'streaming' | 'images' | 'code' | 'function_calling'>
    searchQuery?: string
  }>({})

  const applyFilters = useCallback((models: ModelCapability[]) => {
    return models.filter(model => {
      // Cost tier filter
      if (filters.costTier && model.costTier !== filters.costTier) {
        return false
      }

      // Speed tier filter
      if (filters.speedTier && model.speedTier !== filters.speedTier) {
        return false
      }

      // Quality tier filter
      if (filters.qualityTier && model.qualityTier !== filters.qualityTier) {
        return false
      }

      // Provider filter
      if (filters.provider && model.provider !== filters.provider) {
        return false
      }

      // Capabilities filter
      if (filters.capabilities) {
        for (const capability of filters.capabilities) {
          switch (capability) {
            case 'streaming':
              if (!model.supportsStreaming) return false
              break
            case 'images':
              if (!model.supportsImages) return false
              break
            case 'code':
              if (!model.supportsCode) return false
              break
            case 'function_calling':
              if (!model.supportsFunctionCalling) return false
              break
          }
        }
      }

      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        const matchesName = model.name.toLowerCase().includes(query)
        const matchesId = model.id.toLowerCase().includes(query)
        const matchesStrengths = model.strengths.some(s => s.toLowerCase().includes(query))

        if (!matchesName && !matchesId && !matchesStrengths) {
          return false
        }
      }

      return true
    })
  }, [filters])

  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
  }, [])

  return {
    filters,
    applyFilters,
    updateFilters,
    clearFilters,
  }
}
