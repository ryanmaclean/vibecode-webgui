/**
 * React hook for managing the model switcher quick access panel
 * Provides state management for opening/closing the panel, searching models,
 * and integrating with model selection functionality.
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useModelSelection } from './useModelSelection'
import { intelligentModelSelection } from '@/lib/services/intelligent-model-selection'
import type { ModelCapability } from '@/lib/services/intelligent-model-selection'

interface UseModelSwitcherOptions {
  /** Auto-close panel after model selection */
  autoCloseOnSelect?: boolean
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean
}

export function useModelSwitcher(options: UseModelSwitcherOptions = {}) {
  const {
    autoCloseOnSelect = true,
    enableKeyboardShortcuts = true,
  } = options

  // Panel state
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Integrate with model selection hook
  const modelSelection = useModelSelection()

  /**
   * Get all available models
   */
  const allModels = useMemo(() => {
    return intelligentModelSelection.getAllModels()
  }, [])

  /**
   * Filter models based on search query
   */
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) {
      return allModels
    }

    const query = searchQuery.toLowerCase()
    return allModels.filter((model: ModelCapability) => {
      return (
        model.name.toLowerCase().includes(query) ||
        model.id.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query) ||
        model.strengths.some((strength: string) => strength.toLowerCase().includes(query))
      )
    })
  }, [allModels, searchQuery])

  /**
   * Get favorite models
   */
  const favoriteModels = useMemo(() => {
    return allModels.filter((model: ModelCapability) => modelSelection.isFavorite(model.id))
  }, [allModels, modelSelection])

  /**
   * Get recent models
   */
  const recentModels = useMemo(() => {
    return modelSelection.recentModels
      .map((modelId: string) => intelligentModelSelection.getModelById(modelId))
      .filter((model: ModelCapability | undefined): model is ModelCapability => model !== undefined)
  }, [modelSelection.recentModels])

  /**
   * Open the model switcher panel
   */
  const openPanel = useCallback(() => {
    setIsOpen(true)
  }, [])

  /**
   * Close the model switcher panel
   */
  const closePanel = useCallback(() => {
    setIsOpen(false)
    setSearchQuery('')
  }, [])

  /**
   * Toggle the model switcher panel
   */
  const togglePanel = useCallback(() => {
    if (isOpen) {
      closePanel()
    } else {
      openPanel()
    }
  }, [isOpen, openPanel, closePanel])

  /**
   * Select a model and optionally close the panel
   */
  const selectModel = useCallback((modelId: string) => {
    modelSelection.selectModel(modelId)

    if (autoCloseOnSelect) {
      closePanel()
    }
  }, [modelSelection, autoCloseOnSelect, closePanel])

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enableKeyboardShortcuts) return

    // Ignore shortcuts when typing in inputs/textareas/contenteditable
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return
    }

    const mod = e.metaKey || e.ctrlKey

    // Cmd+M or Ctrl+M - toggle model switcher panel
    if (mod && e.key === 'm') {
      e.preventDefault()
      togglePanel()
      return
    }

    // Escape - close panel (only if it's open)
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault()
      closePanel()
      return
    }
  }, [enableKeyboardShortcuts, isOpen, togglePanel, closePanel])

  /**
   * Register keyboard event listeners
   */
  useEffect(() => {
    if (!enableKeyboardShortcuts) return

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enableKeyboardShortcuts])

  return {
    // Panel state
    isOpen,
    openPanel,
    closePanel,
    togglePanel,

    // Search state
    searchQuery,
    setSearchQuery,

    // Model lists
    allModels,
    filteredModels,
    favoriteModels,
    recentModels,

    // Current selection
    selectedModel: modelSelection.selectedModel,
    previousModel: modelSelection.previousModel,

    // Model selection actions
    selectModel,
    toggleFavorite: modelSelection.toggleFavorite,
    isFavorite: modelSelection.isFavorite,

    // Model selection state
    isLoading: modelSelection.isLoading,
    error: modelSelection.error,
    notification: modelSelection.notification,
    dismissNotification: modelSelection.dismissNotification,
    revertToPreviousModel: modelSelection.revertToPreviousModel,
  }
}
