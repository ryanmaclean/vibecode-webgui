/**
 * React hook for detecting model changes and deprecations
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getModelSyncService } from '@/lib/ai/models/model-sync-service'
import type {
  ModelSyncService,
  SyncEvent,
  ModelChange,
  ModelChangeType,
} from '@/lib/ai/models/model-sync-service'
import type { ModelProfile } from '@/types/model-comparison'

interface UseModelChangeDetectionOptions {
  /** LocalStorage key prefix for persistence */
  storagePrefix?: string
  /** Auto-save seen changes to localStorage */
  autoSave?: boolean
  /** Enable sync service on mount */
  enableSync?: boolean
  /** Callback when changes are detected */
  onChangesDetected?: (changes: ModelChange[]) => void
}

interface ModelChangeNotification {
  id: string
  change: ModelChange
  timestamp: number
  dismissed: boolean
  seen: boolean
}

const DEFAULT_STORAGE_PREFIX = 'vibecode_model_changes'

export function useModelChangeDetection(options: UseModelChangeDetectionOptions = {}) {
  const {
    storagePrefix = DEFAULT_STORAGE_PREFIX,
    autoSave = true,
    enableSync = true,
    onChangesDetected,
  } = options

  const [syncService, setSyncService] = useState<ModelSyncService | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
  const [notifications, setNotifications] = useState<ModelChangeNotification[]>([])
  const [error, setError] = useState<string | null>(null)

  // Use ref to track if we've initialized to prevent double-init in strict mode
  const initRef = useRef(false)

  // LocalStorage keys
  const STORAGE_KEYS = {
    notifications: `${storagePrefix}_notifications`,
    lastSyncTime: `${storagePrefix}_last_sync`,
    dismissedIds: `${storagePrefix}_dismissed`,
  }

  // Load persisted state from localStorage
  useEffect(() => {
    if (!autoSave) return

    try {
      // Load notifications
      const savedNotifications = localStorage.getItem(STORAGE_KEYS.notifications)
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications))
      }

      // Load last sync time
      const savedSyncTime = localStorage.getItem(STORAGE_KEYS.lastSyncTime)
      if (savedSyncTime) {
        setLastSyncTime(Number(savedSyncTime))
      }
    } catch (error) {
      console.error('Failed to load model change detection from localStorage:', error)
      setError(error instanceof Error ? error.message : 'Failed to load saved state')
    }
  }, [STORAGE_KEYS.notifications, STORAGE_KEYS.lastSyncTime, autoSave])

  // Save to localStorage when state changes
  useEffect(() => {
    if (!autoSave) return

    try {
      localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(notifications))
    } catch (error) {
      console.error('Failed to save notifications:', error)
    }
  }, [notifications, autoSave, STORAGE_KEYS.notifications])

  useEffect(() => {
    if (!autoSave || lastSyncTime === null) return

    try {
      localStorage.setItem(STORAGE_KEYS.lastSyncTime, lastSyncTime.toString())
    } catch (error) {
      console.error('Failed to save last sync time:', error)
    }
  }, [lastSyncTime, autoSave, STORAGE_KEYS.lastSyncTime])

  // Initialize sync service and event listeners
  useEffect(() => {
    // Prevent double initialization in React strict mode
    if (initRef.current) return undefined
    initRef.current = true

    try {
      const service = getModelSyncService()
      setSyncService(service)

      // Set up event listeners
      const handleSyncStarted = (event: SyncEvent) => {
        setIsSyncing(true)
        setError(null)
      }

      const handleSyncCompleted = (event: SyncEvent) => {
        setIsSyncing(false)
        setLastSyncTime(event.timestamp)
      }

      const handleSyncFailed = (event: SyncEvent) => {
        setIsSyncing(false)
        setError(event.error?.message || 'Sync failed')
      }

      const handleModelsChanged = (event: SyncEvent) => {
        if (!event.changes || event.changes.length === 0) return

        // Create notifications for changes
        const newNotifications: ModelChangeNotification[] = event.changes.map(change => ({
          id: `${change.type}-${change.modelId}-${event.timestamp}`,
          change,
          timestamp: event.timestamp,
          dismissed: false,
          seen: false,
        }))

        setNotifications(prev => [...newNotifications, ...prev])

        // Call callback if provided
        if (onChangesDetected) {
          onChangesDetected(event.changes)
        }
      }

      service.on('sync_started', handleSyncStarted)
      service.on('sync_completed', handleSyncCompleted)
      service.on('sync_failed', handleSyncFailed)
      service.on('models_changed', handleModelsChanged)

      // Start sync if enabled
      if (enableSync && !service.getStatus().isRunning) {
        service.start()
      }

      // Cleanup function
      return () => {
        service.off('sync_started', handleSyncStarted)
        service.off('sync_completed', handleSyncCompleted)
        service.off('sync_failed', handleSyncFailed)
        service.off('models_changed', handleModelsChanged)
      }
    } catch (error) {
      console.error('Failed to initialize model change detection:', error)
      setError(error instanceof Error ? error.message : 'Failed to initialize')
      return undefined
    }
  }, [enableSync, onChangesDetected])

  /**
   * Manually trigger a sync
   */
  const triggerSync = useCallback(async () => {
    if (!syncService) {
      setError('Sync service not initialized')
      return
    }

    try {
      await syncService.sync()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync'
      setError(errorMessage)
    }
  }, [syncService])

  /**
   * Dismiss a notification
   */
  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, dismissed: true } : n
      )
    )
  }, [])

  /**
   * Mark a notification as seen
   */
  const markNotificationSeen = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, seen: true } : n
      )
    )
  }, [])

  /**
   * Mark all notifications as seen
   */
  const markAllSeen = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, seen: true }))
    )
  }, [])

  /**
   * Clear all dismissed notifications
   */
  const clearDismissed = useCallback(() => {
    setNotifications(prev => prev.filter(n => !n.dismissed))
  }, [])

  /**
   * Clear all notifications
   */
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  /**
   * Get notifications by change type
   */
  const getNotificationsByType = useCallback((type: ModelChangeType) => {
    return notifications.filter(n => n.change.type === type && !n.dismissed)
  }, [notifications])

  /**
   * Get active (not dismissed) notifications
   */
  const getActiveNotifications = useCallback(() => {
    return notifications.filter(n => !n.dismissed)
  }, [notifications])

  /**
   * Get unseen notifications
   */
  const getUnseenNotifications = useCallback(() => {
    return notifications.filter(n => !n.seen && !n.dismissed)
  }, [notifications])

  /**
   * Check if there are any deprecations for a specific model
   */
  const hasDeprecation = useCallback((modelId: string) => {
    return notifications.some(
      n => n.change.modelId === modelId && n.change.type === 'deprecated' && !n.dismissed
    )
  }, [notifications])

  /**
   * Check if there are any price changes for a specific model
   */
  const hasPriceChange = useCallback((modelId: string) => {
    return notifications.some(
      n => n.change.modelId === modelId && n.change.type === 'price_changed' && !n.dismissed
    )
  }, [notifications])

  /**
   * Get replacement model for deprecated model
   */
  const getReplacementModel = useCallback((modelId: string): string | undefined => {
    const deprecationNotification = notifications.find(
      n => n.change.modelId === modelId && n.change.type === 'deprecated' && !n.dismissed
    )

    return deprecationNotification?.change.model?.replacementModelId
  }, [notifications])

  /**
   * Get sync status
   */
  const getSyncStatus = useCallback(() => {
    if (!syncService) {
      return {
        isRunning: false,
        lastSyncTime: lastSyncTime || 0,
        modelCount: 0,
        syncIntervalMs: 0,
      }
    }

    return syncService.getStatus()
  }, [syncService, lastSyncTime])

  return {
    // State
    isSyncing,
    lastSyncTime,
    notifications,
    error,
    syncService,

    // Notification queries
    activeNotifications: getActiveNotifications(),
    unseenNotifications: getUnseenNotifications(),
    newModels: getNotificationsByType('added'),
    deprecatedModels: getNotificationsByType('deprecated'),
    priceChanges: getNotificationsByType('price_changed'),
    updatedModels: getNotificationsByType('updated'),
    removedModels: getNotificationsByType('removed'),

    // Counts
    unseenCount: getUnseenNotifications().length,
    activeCount: getActiveNotifications().length,

    // Methods
    triggerSync,
    dismissNotification,
    markNotificationSeen,
    markAllSeen,
    clearDismissed,
    clearAll,
    getNotificationsByType,
    hasDeprecation,
    hasPriceChange,
    getReplacementModel,
    getSyncStatus,
  }
}
