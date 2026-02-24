/**
 * Unit tests for useModelChangeDetection hook
 * Tests model change detection and notification management
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useModelChangeDetection } from '@/hooks/useModelChangeDetection'
import { getModelSyncService, resetModelSyncService } from '@/lib/ai/models/model-sync-service'
import type { ModelSyncService, SyncEvent, ModelChange } from '@/lib/ai/models/model-sync-service'

// Mock the model sync service
jest.mock('@/lib/ai/models/model-sync-service', () => {
  const mockService = {
    on: jest.fn(),
    off: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    sync: jest.fn(),
    getStatus: jest.fn(() => ({
      isRunning: false,
      lastSyncTime: 0,
      modelCount: 0,
      syncIntervalMs: 3600000,
    })),
    getCurrentModels: jest.fn(() => []),
  }

  return {
    getModelSyncService: jest.fn(() => mockService),
    resetModelSyncService: jest.fn(),
    ModelSyncService: jest.fn(() => mockService),
  }
})

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useModelChangeDetection', () => {
  let mockService: jest.Mocked<ModelSyncService>

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
    mockService = getModelSyncService() as jest.Mocked<ModelSyncService>

    // Reset mock implementations
    mockService.getStatus.mockReturnValue({
      isRunning: false,
      lastSyncTime: 0,
      modelCount: 0,
      syncIntervalMs: 3600000,
    })
  })

  afterEach(() => {
    resetModelSyncService()
  })

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useModelChangeDetection())

      expect(result.current.isSyncing).toBe(false)
      expect(result.current.lastSyncTime).toBeNull()
      expect(result.current.notifications).toEqual([])
      expect(result.current.error).toBeNull()
      expect(result.current.unseenCount).toBe(0)
      expect(result.current.activeCount).toBe(0)
    })

    it('should set up event listeners on mount', () => {
      renderHook(() => useModelChangeDetection())

      expect(mockService.on).toHaveBeenCalledWith('sync_started', expect.any(Function))
      expect(mockService.on).toHaveBeenCalledWith('sync_completed', expect.any(Function))
      expect(mockService.on).toHaveBeenCalledWith('sync_failed', expect.any(Function))
      expect(mockService.on).toHaveBeenCalledWith('models_changed', expect.any(Function))
    })

    it('should start sync service when enableSync is true', () => {
      mockService.getStatus.mockReturnValue({
        isRunning: false,
        lastSyncTime: 0,
        modelCount: 0,
        syncIntervalMs: 3600000,
      })

      renderHook(() => useModelChangeDetection({ enableSync: true }))

      expect(mockService.start).toHaveBeenCalled()
    })

    it('should not start sync service when enableSync is false', () => {
      renderHook(() => useModelChangeDetection({ enableSync: false }))

      expect(mockService.start).not.toHaveBeenCalled()
    })

    it('should clean up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useModelChangeDetection())

      unmount()

      expect(mockService.off).toHaveBeenCalledWith('sync_started', expect.any(Function))
      expect(mockService.off).toHaveBeenCalledWith('sync_completed', expect.any(Function))
      expect(mockService.off).toHaveBeenCalledWith('sync_failed', expect.any(Function))
      expect(mockService.off).toHaveBeenCalledWith('models_changed', expect.any(Function))
    })
  })

  describe('Sync Events', () => {
    it('should handle sync_started event', () => {
      const { result } = renderHook(() => useModelChangeDetection())

      // Get the sync_started handler
      const syncStartedCall = mockService.on.mock.calls.find(call => call[0] === 'sync_started')
      const syncStartedHandler = syncStartedCall?.[1]

      expect(syncStartedHandler).toBeDefined()

      act(() => {
        syncStartedHandler!({
          type: 'sync_started',
          timestamp: Date.now(),
        })
      })

      expect(result.current.isSyncing).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it('should handle sync_completed event', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Get the sync_completed handler
      const syncCompletedCall = mockService.on.mock.calls.find(call => call[0] === 'sync_completed')
      const syncCompletedHandler = syncCompletedCall?.[1]

      expect(syncCompletedHandler).toBeDefined()

      act(() => {
        syncCompletedHandler!({
          type: 'sync_completed',
          timestamp,
        })
      })

      expect(result.current.isSyncing).toBe(false)
      expect(result.current.lastSyncTime).toBe(timestamp)
    })

    it('should handle sync_failed event', () => {
      const { result } = renderHook(() => useModelChangeDetection())

      // Get the sync_failed handler
      const syncFailedCall = mockService.on.mock.calls.find(call => call[0] === 'sync_failed')
      const syncFailedHandler = syncFailedCall?.[1]

      expect(syncFailedHandler).toBeDefined()

      act(() => {
        syncFailedHandler!({
          type: 'sync_failed',
          timestamp: Date.now(),
          error: new Error('Sync failed'),
        })
      })

      expect(result.current.isSyncing).toBe(false)
      expect(result.current.error).toBe('Sync failed')
    })

    it('should handle models_changed event and create notifications', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      const changes: ModelChange[] = [
        {
          type: 'added',
          modelId: 'anthropic/claude-3-opus',
          model: {
            id: 'anthropic/claude-3-opus',
            name: 'Claude 3 Opus',
          } as any,
        },
        {
          type: 'deprecated',
          modelId: 'openai/gpt-3.5-turbo',
          model: {
            id: 'openai/gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            replacementModelId: 'openai/gpt-4',
          } as any,
        },
      ]

      // Get the models_changed handler
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      expect(modelsChangedHandler).toBeDefined()

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes,
        })
      })

      expect(result.current.notifications).toHaveLength(2)
      expect(result.current.notifications[0]).toMatchObject({
        change: changes[0],
        timestamp,
        dismissed: false,
        seen: false,
      })
      expect(result.current.notifications[1]).toMatchObject({
        change: changes[1],
        timestamp,
        dismissed: false,
        seen: false,
      })
    })

    it('should call onChangesDetected callback when changes are detected', () => {
      const onChangesDetected = jest.fn()
      const timestamp = Date.now()

      renderHook(() => useModelChangeDetection({ onChangesDetected }))

      const changes: ModelChange[] = [
        {
          type: 'price_changed',
          modelId: 'openai/gpt-4',
          model: {
            id: 'openai/gpt-4',
            name: 'GPT-4',
          } as any,
        },
      ]

      // Get the models_changed handler
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes,
        })
      })

      expect(onChangesDetected).toHaveBeenCalledWith(changes)
    })
  })

  describe('Notification Management', () => {
    it('should dismiss notification', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add a notification
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model',
              model: { id: 'test-model', name: 'Test Model' } as any,
            },
          ],
        })
      })

      const notificationId = result.current.notifications[0].id

      act(() => {
        result.current.dismissNotification(notificationId)
      })

      expect(result.current.notifications[0].dismissed).toBe(true)
    })

    it('should mark notification as seen', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add a notification
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model',
              model: { id: 'test-model', name: 'Test Model' } as any,
            },
          ],
        })
      })

      const notificationId = result.current.notifications[0].id

      act(() => {
        result.current.markNotificationSeen(notificationId)
      })

      expect(result.current.notifications[0].seen).toBe(true)
    })

    it('should mark all notifications as seen', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add notifications
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model-1',
              model: { id: 'test-model-1', name: 'Test Model 1' } as any,
            },
            {
              type: 'added',
              modelId: 'test-model-2',
              model: { id: 'test-model-2', name: 'Test Model 2' } as any,
            },
          ],
        })
      })

      act(() => {
        result.current.markAllSeen()
      })

      expect(result.current.notifications.every(n => n.seen)).toBe(true)
      expect(result.current.unseenCount).toBe(0)
    })

    it('should clear dismissed notifications', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add notifications
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model-1',
              model: { id: 'test-model-1', name: 'Test Model 1' } as any,
            },
            {
              type: 'added',
              modelId: 'test-model-2',
              model: { id: 'test-model-2', name: 'Test Model 2' } as any,
            },
          ],
        })
      })

      const firstNotificationId = result.current.notifications[0].id

      act(() => {
        result.current.dismissNotification(firstNotificationId)
      })

      expect(result.current.notifications).toHaveLength(2)

      act(() => {
        result.current.clearDismissed()
      })

      expect(result.current.notifications).toHaveLength(1)
      expect(result.current.notifications[0].dismissed).toBe(false)
    })

    it('should clear all notifications', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add notifications
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model-1',
              model: { id: 'test-model-1', name: 'Test Model 1' } as any,
            },
          ],
        })
      })

      expect(result.current.notifications).toHaveLength(1)

      act(() => {
        result.current.clearAll()
      })

      expect(result.current.notifications).toHaveLength(0)
    })
  })

  describe('Notification Queries', () => {
    it('should get notifications by type', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add notifications of different types
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model-1',
              model: { id: 'test-model-1', name: 'Test Model 1' } as any,
            },
            {
              type: 'deprecated',
              modelId: 'test-model-2',
              model: { id: 'test-model-2', name: 'Test Model 2' } as any,
            },
            {
              type: 'price_changed',
              modelId: 'test-model-3',
              model: { id: 'test-model-3', name: 'Test Model 3' } as any,
            },
          ],
        })
      })

      expect(result.current.newModels).toHaveLength(1)
      expect(result.current.deprecatedModels).toHaveLength(1)
      expect(result.current.priceChanges).toHaveLength(1)
    })

    it('should get active notifications', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add notifications
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model-1',
              model: { id: 'test-model-1', name: 'Test Model 1' } as any,
            },
            {
              type: 'added',
              modelId: 'test-model-2',
              model: { id: 'test-model-2', name: 'Test Model 2' } as any,
            },
          ],
        })
      })

      const firstNotificationId = result.current.notifications[0].id

      act(() => {
        result.current.dismissNotification(firstNotificationId)
      })

      expect(result.current.activeNotifications).toHaveLength(1)
      expect(result.current.activeCount).toBe(1)
    })

    it('should get unseen notifications', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add notifications
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model-1',
              model: { id: 'test-model-1', name: 'Test Model 1' } as any,
            },
            {
              type: 'added',
              modelId: 'test-model-2',
              model: { id: 'test-model-2', name: 'Test Model 2' } as any,
            },
          ],
        })
      })

      const firstNotificationId = result.current.notifications[0].id

      act(() => {
        result.current.markNotificationSeen(firstNotificationId)
      })

      expect(result.current.unseenNotifications).toHaveLength(1)
      expect(result.current.unseenCount).toBe(1)
    })

    it('should check if model has deprecation', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add deprecation notification
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'deprecated',
              modelId: 'deprecated-model',
              model: { id: 'deprecated-model', name: 'Deprecated Model' } as any,
            },
          ],
        })
      })

      expect(result.current.hasDeprecation('deprecated-model')).toBe(true)
      expect(result.current.hasDeprecation('other-model')).toBe(false)
    })

    it('should check if model has price change', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add price change notification
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'price_changed',
              modelId: 'price-changed-model',
              model: { id: 'price-changed-model', name: 'Price Changed Model' } as any,
            },
          ],
        })
      })

      expect(result.current.hasPriceChange('price-changed-model')).toBe(true)
      expect(result.current.hasPriceChange('other-model')).toBe(false)
    })

    it('should get replacement model for deprecated model', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add deprecation notification with replacement
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'deprecated',
              modelId: 'old-model',
              model: {
                id: 'old-model',
                name: 'Old Model',
                replacementModelId: 'new-model',
              } as any,
            },
          ],
        })
      })

      expect(result.current.getReplacementModel('old-model')).toBe('new-model')
      expect(result.current.getReplacementModel('other-model')).toBeUndefined()
    })
  })

  describe('Manual Sync', () => {
    it('should trigger manual sync', async () => {
      mockService.sync.mockResolvedValue(undefined)
      const { result } = renderHook(() => useModelChangeDetection())

      await act(async () => {
        await result.current.triggerSync()
      })

      expect(mockService.sync).toHaveBeenCalled()
    })

    it('should handle sync error', async () => {
      mockService.sync.mockRejectedValue(new Error('Sync error'))
      const { result } = renderHook(() => useModelChangeDetection())

      await act(async () => {
        await result.current.triggerSync()
      })

      expect(result.current.error).toBe('Sync error')
    })
  })

  describe('Local Storage Persistence', () => {
    it('should load notifications from localStorage on mount', () => {
      const savedNotifications = [
        {
          id: 'test-notification-1',
          change: {
            type: 'added',
            modelId: 'test-model',
            model: { id: 'test-model', name: 'Test Model' },
          },
          timestamp: Date.now(),
          dismissed: false,
          seen: false,
        },
      ]

      localStorageMock.setItem(
        'vibecode_model_changes_notifications',
        JSON.stringify(savedNotifications)
      )

      const { result } = renderHook(() => useModelChangeDetection())

      expect(result.current.notifications).toHaveLength(1)
      expect(result.current.notifications[0].id).toBe('test-notification-1')
    })

    it('should load last sync time from localStorage on mount', () => {
      const timestamp = Date.now()
      localStorageMock.setItem('vibecode_model_changes_last_sync', timestamp.toString())

      const { result } = renderHook(() => useModelChangeDetection())

      expect(result.current.lastSyncTime).toBe(timestamp)
    })

    it('should save notifications to localStorage when changed', async () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection())

      // Add a notification
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model',
              model: { id: 'test-model', name: 'Test Model' } as any,
            },
          ],
        })
      })

      // Wait for state update and localStorage save
      await waitFor(() => {
        const saved = localStorageMock.getItem('vibecode_model_changes_notifications')
        expect(saved).toBeTruthy()
        const parsed = JSON.parse(saved!)
        expect(parsed).toHaveLength(1)
      })
    })

    it('should not save to localStorage when autoSave is false', () => {
      const timestamp = Date.now()
      const { result } = renderHook(() => useModelChangeDetection({ autoSave: false }))

      // Add a notification
      const modelsChangedCall = mockService.on.mock.calls.find(call => call[0] === 'models_changed')
      const modelsChangedHandler = modelsChangedCall?.[1]

      act(() => {
        modelsChangedHandler!({
          type: 'models_changed',
          timestamp,
          changes: [
            {
              type: 'added',
              modelId: 'test-model',
              model: { id: 'test-model', name: 'Test Model' } as any,
            },
          ],
        })
      })

      // localStorage should not be updated
      const saved = localStorageMock.getItem('vibecode_model_changes_notifications')
      expect(saved).toBeNull()
    })

    it('should use custom storage prefix', () => {
      const customPrefix = 'custom_prefix'
      const savedNotifications = [
        {
          id: 'test-notification-1',
          change: {
            type: 'added',
            modelId: 'test-model',
            model: { id: 'test-model', name: 'Test Model' },
          },
          timestamp: Date.now(),
          dismissed: false,
          seen: false,
        },
      ]

      localStorageMock.setItem(
        `${customPrefix}_notifications`,
        JSON.stringify(savedNotifications)
      )

      const { result } = renderHook(() =>
        useModelChangeDetection({ storagePrefix: customPrefix })
      )

      expect(result.current.notifications).toHaveLength(1)
    })
  })

  describe('Sync Status', () => {
    it('should return sync status', () => {
      mockService.getStatus.mockReturnValue({
        isRunning: true,
        lastSyncTime: 12345,
        modelCount: 50,
        syncIntervalMs: 3600000,
      })

      const { result } = renderHook(() => useModelChangeDetection())

      const status = result.current.getSyncStatus()
      expect(status.isRunning).toBe(true)
      expect(status.lastSyncTime).toBe(12345)
      expect(status.modelCount).toBe(50)
      expect(status.syncIntervalMs).toBe(3600000)
    })

    it('should return current sync status from service', () => {
      mockService.getStatus.mockReturnValue({
        isRunning: false,
        lastSyncTime: 0,
        modelCount: 0,
        syncIntervalMs: 3600000,
      })

      const { result } = renderHook(() => useModelChangeDetection())

      const status = result.current.getSyncStatus()
      expect(status.isRunning).toBe(false)
      expect(status.modelCount).toBe(0)
      expect(status.syncIntervalMs).toBe(3600000)
    })
  })
})
