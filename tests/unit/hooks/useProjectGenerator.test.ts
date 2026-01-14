/**
 * Unit tests for useProjectGenerator hook
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { useProjectGenerator, GenerationStatus, ProgressData } from '@/hooks/useProjectGenerator'
import { fetchWithRetry, streamResponse } from '@/lib/utils/fetch'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}))
jest.mock('@/lib/utils/fetch')

const mockPush = jest.fn()
const mockUseRouter = jest.mocked(useRouter)
const mockFetchWithRetry = jest.mocked(fetchWithRetry)
const mockStreamResponse = jest.mocked(streamResponse)

beforeEach(() => {
  jest.clearAllMocks()
  mockUseRouter.mockReturnValue({ push: mockPush } as any)
})

describe('useProjectGenerator', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useProjectGenerator())

    expect(result.current.isGenerating).toBe(false)
    expect(result.current.progress).toEqual({
      status: 'idle',
      message: 'Ready to generate project',
      progress: 0,
    })
  })

  it('should handle successful project generation', async () => {
    const onProgress = jest.fn()
    const onComplete = jest.fn()
    
    // Mock successful API response
    const mockResponse = {
      ok: true,
      status: 200,
    }
    
    const progressUpdates = [
      '{"status":"initializing","message":"Starting...","progress":10}',
      '{"status":"generating","message":"Generating...","progress":50}',
      '{"status":"completed","message":"Complete!","progress":100,"workspaceId":"test-123","projectName":"Test Project"}',
    ]

    mockFetchWithRetry.mockResolvedValue(mockResponse as any)
    mockStreamResponse.mockImplementation(async function* () {
      for (const update of progressUpdates) {
        yield update
      }
    })

    const { result } = renderHook(() => 
      useProjectGenerator({ onProgress, onComplete })
    )

    await act(async () => {
      await result.current.generateProject('Create a test app')
    })

    // Should call onComplete with correct data
    expect(onComplete).toHaveBeenCalledWith({
      workspaceId: 'test-123',
      projectName: 'Test Project',
    })

    // Should update progress throughout
    expect(onProgress).toHaveBeenCalledTimes(4) // initial + 3 updates
    expect(result.current.isGenerating).toBe(false)
  })

  it('should handle API errors', async () => {
    const onError = jest.fn()
    
    mockFetchWithRetry.mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => 
      useProjectGenerator({ onError })
    )

    await act(async () => {
      await result.current.generateProject('Create a test app')
    })

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(result.current.progress.status).toBe('error')
    expect(result.current.isGenerating).toBe(false)
  })

  it('should handle HTTP errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
    }
    
    mockFetchWithRetry.mockResolvedValue(mockResponse as any)

    const { result } = renderHook(() => useProjectGenerator())

    await act(async () => {
      await result.current.generateProject('Create a test app')
    })

    expect(result.current.progress.status).toBe('error')
    expect(result.current.progress.message).toContain('HTTP error')
  })

  it('should handle malformed JSON in stream', async () => {
    const mockResponse = { ok: true, status: 200 }
    const progressUpdates = [
      '{"status":"initializing","message":"Starting..."}',
      'invalid json',
      '{"status":"completed","message":"Complete!","workspaceId":"test-123"}',
    ]

    mockFetchWithRetry.mockResolvedValue(mockResponse as any)
    mockStreamResponse.mockImplementation(async function* () {
      for (const update of progressUpdates) {
        yield update
      }
    })

    const { result } = renderHook(() => useProjectGenerator())

    await act(async () => {
      await result.current.generateProject('Create a test app')
    })

    // Should continue processing despite malformed JSON
    expect(result.current.isGenerating).toBe(false)
  })

  it('should cancel generation', async () => {
    const mockResponse = { ok: true, status: 200 }
    mockFetchWithRetry.mockResolvedValue(mockResponse as any)
    mockStreamResponse.mockImplementation(async function* () {
      yield '{"status":"generating","message":"Generating...","progress":50}'
      // Simulate long-running process
      await new Promise(resolve => setTimeout(resolve, 1000))
      yield '{"status":"completed","message":"Complete!"}'
    })

    const { result } = renderHook(() => useProjectGenerator())

    // Start generation
    act(() => {
      result.current.generateProject('Create a test app')
    })

    expect(result.current.isGenerating).toBe(true)

    // Cancel generation
    act(() => {
      result.current.cancelGeneration()
    })

    expect(result.current.isGenerating).toBe(false)
    expect(result.current.progress.status).toBe('idle')
    expect(result.current.progress.message).toBe('Generation cancelled')
  })

  it('should not start generation if already generating', async () => {
    const { result } = renderHook(() => useProjectGenerator())

    // Mock ongoing generation
    act(() => {
      result.current.generateProject('First prompt')
    })

    const initialCallCount = mockFetchWithRetry.mock.calls.length

    // Try to start another generation
    await act(async () => {
      await result.current.generateProject('Second prompt')
    })

    // Should not make additional API calls
    expect(mockFetchWithRetry.mock.calls.length).toBe(initialCallCount)
  })

  it('should handle AbortError gracefully', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    
    mockFetchWithRetry.mockRejectedValue(abortError)

    const { result } = renderHook(() => useProjectGenerator())

    await act(async () => {
      await result.current.generateProject('Create a test app')
    })

    // Should not set error status for AbortError
    expect(result.current.progress.status).not.toBe('error')
    expect(result.current.isGenerating).toBe(false)
  })

  it('should include options in API request', async () => {
    const mockResponse = { ok: true, status: 200 }
    mockFetchWithRetry.mockResolvedValue(mockResponse as any)
    mockStreamResponse.mockImplementation(async function* () {
      yield '{"status":"completed","workspaceId":"test-123"}'
    })

    const { result } = renderHook(() => useProjectGenerator())

    const options = {
      language: 'typescript',
      framework: 'react',
      features: ['authentication', 'database'],
    }

    await act(async () => {
      await result.current.generateProject('Create a test app', options)
    })

    expect(mockFetchWithRetry).toHaveBeenCalledWith(
      '/api/ai/generate-project',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Create a test app',
          ...options,
        }),
      })
    )
  })

  it('should auto-redirect on completion', async () => {
    jest.useFakeTimers()
    
    const { result } = renderHook(() => useProjectGenerator())

    act(() => {
      result.current.handleComplete({ workspaceId: 'test-workspace-123' })
    })

    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/workspace/test-workspace-123')
    })

    jest.useRealTimers()
  })

  it('should trim whitespace from prompt', async () => {
    const mockResponse = { ok: true, status: 200 }
    mockFetchWithRetry.mockResolvedValue(mockResponse as any)
    mockStreamResponse.mockImplementation(async function* () {
      yield '{"status":"completed","workspaceId":"test-123"}'
    })

    const { result } = renderHook(() => useProjectGenerator())

    await act(async () => {
      await result.current.generateProject('  Create a test app  ')
    })

    expect(mockFetchWithRetry).toHaveBeenCalledWith(
      '/api/ai/generate-project',
      expect.objectContaining({
        body: JSON.stringify({
          prompt: 'Create a test app',
        }),
      })
    )
  })

  it('should handle progress updates correctly', () => {
    const onProgress = jest.fn()
    const { result } = renderHook(() => useProjectGenerator({ onProgress }))

    act(() => {
      result.current.updateProgress({
        status: 'generating',
        message: 'Generating files...',
        progress: 75,
      })
    })

    expect(result.current.progress).toEqual({
      status: 'generating',
      message: 'Generating files...',
      progress: 75,
    })

    expect(onProgress).toHaveBeenCalledWith({
      status: 'generating',
      message: 'Generating files...',
      progress: 75,
    })
  })

  it('should preserve previous progress when updating', () => {
    const { result } = renderHook(() => useProjectGenerator())

    act(() => {
      result.current.updateProgress({
        status: 'generating',
        message: 'Generating files...',
        progress: 50,
        workspaceId: 'test-123',
      })
    })

    act(() => {
      result.current.updateProgress({
        message: 'Installing dependencies...',
        progress: 75,
      })
    })

    expect(result.current.progress).toEqual({
      status: 'generating', // Preserved from previous
      message: 'Installing dependencies...',
      progress: 75,
      workspaceId: 'test-123', // Preserved from previous
    })
  })

  it('should provide recovery options on error', async () => {
    mockFetchWithRetry.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useProjectGenerator())

    await act(async () => {
      await result.current.generateProject('Create a test app')
    })

    expect(result.current.progress.recoveryOptions).toEqual([
      { label: 'Try Again', action: 'retry' },
      { label: 'Modify Prompt', action: 'modify' },
    ])
  })
})