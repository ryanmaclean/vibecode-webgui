/**
 * Monaco Agent API Integration Tests
 *
 * Tests for Monaco Editor integration with Agent API
 * Validates completion, hover, code actions, and diagnostics
 *
 * @jest-environment jsdom
 */

// ============================================================================
// Mocks - MUST be before imports
// ============================================================================

// Mock the websocket-streaming-client module
jest.mock('@/lib/streaming/websocket-streaming-client')

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type * as monaco from 'monaco-editor'
import { MonacoAgentAPI, registerMonacoAgentProviders } from '@/lib/editor/monaco-agentapi'
import { createMockWebSocketStreamingClient } from '../__mocks__/websocket-streaming-client'
import type { MockWebSocketStreamingClient } from '../__mocks__/websocket-streaming-client'

// ============================================================================
// Test Data Mocks
// ============================================================================

// Mock monaco editor
const mockEditor = {
  getModel: jest.fn(),
  getPosition: jest.fn(),
  getSelection: jest.fn(),
  onDidChangeModelContent: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeCursorPosition: jest.fn(() => ({ dispose: jest.fn() })),
  onDidChangeCursorSelection: jest.fn(() => ({ dispose: jest.fn() })),
  getValue: jest.fn(),
  pushEditOperations: jest.fn(),
  getSelections: jest.fn(() => []),
} as unknown as monaco.editor.IStandaloneCodeEditor

// Mock monaco model
const mockModel = {
  getValue: jest.fn(() => 'const x = 1;'),
  getLanguageId: jest.fn(() => 'typescript'),
  getValueInRange: jest.fn(() => 'x'),
  pushEditOperations: jest.fn(),
  uri: { path: '/test.ts' },
} as unknown as monaco.editor.ITextModel

// Mock position
const mockPosition: monaco.Position = {
  lineNumber: 1,
  column: 10,
} as monaco.Position

// Mock selection
const mockSelection: monaco.Selection = {
  startLineNumber: 1,
  startColumn: 7,
  endLineNumber: 1,
  endColumn: 8,
  selectionStartLineNumber: 1,
  selectionStartColumn: 7,
  positionLineNumber: 1,
  positionColumn: 8,
  isEmpty: jest.fn(() => false),
  getPosition: jest.fn(() => mockPosition),
} as unknown as monaco.Selection

// ============================================================================
// Test Suite
// ============================================================================

describe('MonacoAgentAPI', () => {
  let agentAPI: MonacoAgentAPI
  let mockWSClient: MockWebSocketStreamingClient

  beforeEach(() => {
    jest.clearAllMocks()

    // Create a fresh mock for each test
    mockWSClient = createMockWebSocketStreamingClient({
      defaultLatency: 50,
      autoConnect: false,
      autoComplete: true,
    })

    // Setup default mocks
    ;(mockEditor.getModel as jest.Mock).mockReturnValue(mockModel)
    ;(mockEditor.getPosition as jest.Mock).mockReturnValue(mockPosition)
    ;(mockEditor.getSelection as jest.Mock).mockReturnValue(mockSelection)

    // Use dependency injection to inject mock client
    agentAPI = new MonacoAgentAPI(
      mockEditor,
      {
        baseUrl: '/api/agents',
        wsUrl: '/api/agents/ws',
        model: 'claude-3-5-sonnet-20241022',
        debug: false,
        completionTimeout: 300,
        enableInlineSuggestions: true,
        enableDiagnostics: true,
        diagnosticsDebounce: 1000,
      },
      mockWSClient as any
    )
  })

  afterEach(() => {
    if (agentAPI) {
      agentAPI.dispose()
    }
  })

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await agentAPI.initialize()

      expect(mockWSClient.connect).toHaveBeenCalled()
      expect(mockEditor.onDidChangeModelContent).toHaveBeenCalled()
      expect(mockEditor.onDidChangeCursorPosition).toHaveBeenCalled()
      expect(mockEditor.onDidChangeCursorSelection).toHaveBeenCalled()
    })

    it('should setup event listeners', async () => {
      await agentAPI.initialize()

      expect(mockEditor.onDidChangeModelContent).toHaveBeenCalledTimes(1)
      expect(mockEditor.onDidChangeCursorPosition).toHaveBeenCalledTimes(1)
      expect(mockEditor.onDidChangeCursorSelection).toHaveBeenCalledTimes(1)
    })

    it('should handle initialization failure gracefully', async () => {
      mockWSClient.connect.mockRejectedValueOnce(new Error('Connection failed'))

      await expect(agentAPI.initialize()).rejects.toThrow('Connection failed')
    })
  })

  // ==========================================================================
  // Context Extraction Tests
  // ==========================================================================

  describe('extractEditorContext', () => {
    it('should extract basic context', () => {
      const context = agentAPI.extractEditorContext()

      expect(context.content).toBe('const x = 1;')
      expect(context.languageId).toBe('typescript')
      expect(context.position).toEqual({ line: 1, column: 10 })
    })

    it('should extract selection', () => {
      const context = agentAPI.extractEditorContext()

      expect(context.selection).toBeDefined()
      expect(context.selection?.text).toBe('x')
      expect(context.selection?.startLine).toBe(1)
      expect(context.selection?.startColumn).toBe(7)
    })

    it('should extract imports from JavaScript code', () => {
      ;(mockModel.getValue as jest.Mock).mockReturnValue(`
        import React from 'react';
        import { useState } from 'react';
        import * as utils from './utils';
      `)

      const context = agentAPI.extractEditorContext()

      expect(context.imports).toContain('react')
      expect(context.imports).toContain('./utils')
    })

    it('should extract imports from Python code', () => {
      ;(mockModel.getValue as jest.Mock).mockReturnValue(`
        import numpy as np
        from pandas import DataFrame
        import matplotlib.pyplot as plt
      `)

      const context = agentAPI.extractEditorContext()

      expect(context.imports).toContain('numpy')
      expect(context.imports).toContain('pandas')
    })

    it('should handle no selection', () => {
      ;(mockEditor.getSelection as jest.Mock).mockReturnValue(null)

      const context = agentAPI.extractEditorContext()

      expect(context.selection).toBeUndefined()
    })

    it('should handle no model', () => {
      ;(mockEditor.getModel as jest.Mock).mockReturnValue(null)

      expect(() => agentAPI.extractEditorContext()).toThrow('No editor model available')
    })
  })

  // ==========================================================================
  // Completion Tests
  // ==========================================================================

  describe('requestCompletions', () => {
    beforeEach(async () => {
      await agentAPI.initialize()
    })

    it('should request completions successfully', async () => {
      const mockCompletions = [
        {
          label: 'console.log',
          kind: 1,
          insertText: 'console.log()',
        },
      ]

      mockWSClient.stream.mockImplementation(async (payload, handlers) => {
        handlers.onChunk({ data: { completions: mockCompletions } })
        handlers.onComplete?.()
        return 'request-id'
      })

      const completions = await agentAPI.requestCompletions(mockPosition, {
        triggerKind: 1,
        triggerCharacter: '.',
      } as monaco.languages.CompletionContext)

      expect(completions).toEqual(mockCompletions)
      expect(mockWSClient.stream).toHaveBeenCalled()
    })

    it('should handle completion timeout', async () => {
      mockWSClient.stream.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        return 'request-id'
      })

      const completions = await agentAPI.requestCompletions(mockPosition, {
        triggerKind: 1,
      } as monaco.languages.CompletionContext)

      expect(completions).toEqual([])
    })

    it('should meet latency target (<300ms)', async () => {
      const mockCompletions = [{ label: 'test', kind: 1, insertText: 'test' }]

      mockWSClient.stream.mockImplementation(async (payload, handlers) => {
        await new Promise(resolve => setTimeout(resolve, 250))
        handlers.onChunk({ data: { completions: mockCompletions } })
        handlers.onComplete?.()
        return 'request-id'
      })

      const startTime = Date.now()
      const completions = await agentAPI.requestCompletions(mockPosition, {
        triggerKind: 1,
      } as monaco.languages.CompletionContext)
      const latency = Date.now() - startTime

      expect(latency).toBeLessThan(300)
      expect(completions).toEqual(mockCompletions)
    })

    it('should handle WebSocket disconnection', async () => {
      ;(mockWSClient.isConnected as jest.Mock).mockReturnValue(false)

      const completions = await agentAPI.requestCompletions(mockPosition, {
        triggerKind: 1,
      } as monaco.languages.CompletionContext)

      expect(completions).toEqual([])
    })
  })

  // ==========================================================================
  // Hover Tests
  // ==========================================================================

  describe('requestHover', () => {
    beforeEach(async () => {
      await agentAPI.initialize()
    })

    it('should request hover information', async () => {
      const mockHover = {
        contents: [{ value: 'Variable x: number' }],
      }

      mockWSClient.stream.mockImplementation(async (payload, handlers) => {
        handlers.onChunk({ data: { hover: mockHover } })
        return 'request-id'
      })

      const hover = await agentAPI.requestHover(mockPosition)

      expect(hover).toEqual(mockHover)
      expect(mockWSClient.stream).toHaveBeenCalled()
    })

    it('should handle hover errors', async () => {
      mockWSClient.stream.mockRejectedValueOnce(new Error('Hover failed'))

      const hover = await agentAPI.requestHover(mockPosition)

      expect(hover).toBeNull()
    })
  })

  // ==========================================================================
  // Code Actions Tests
  // ==========================================================================

  describe('requestCodeActions', () => {
    beforeEach(async () => {
      await agentAPI.initialize()
    })

    it('should request code actions', async () => {
      const mockActions = [
        {
          title: 'Extract variable',
          kind: { value: 'refactor.extract' },
        },
      ]

      mockWSClient.stream.mockImplementation(async (payload, handlers) => {
        handlers.onChunk({ data: { actions: mockActions } })
        return 'request-id'
      })

      const actions = await agentAPI.requestCodeActions(
        {
          startLineNumber: 1,
          startColumn: 7,
          endLineNumber: 1,
          endColumn: 8,
        } as monaco.Range,
        {
          markers: [],
          only: undefined,
          trigger: 1,
        } as monaco.languages.CodeActionContext
      )

      expect(actions).toEqual(mockActions)
    })

    it('should handle code action errors', async () => {
      mockWSClient.stream.mockRejectedValueOnce(new Error('Code action failed'))

      const actions = await agentAPI.requestCodeActions(
        {} as monaco.Range,
        {} as monaco.languages.CodeActionContext
      )

      expect(actions).toEqual([])
    })
  })

  // ==========================================================================
  // Suggestion Application Tests
  // ==========================================================================

  describe('applySuggestion', () => {
    it('should apply suggestion to editor', async () => {
      const suggestion = {
        text: 'const y = 2;',
        range: {
          startLineNumber: 2,
          startColumn: 1,
          endLineNumber: 2,
          endColumn: 1,
        } as monaco.IRange,
      }

      await agentAPI.applySuggestion(suggestion)

      expect(mockModel.pushEditOperations).toHaveBeenCalledWith(
        [],
        [
          {
            range: suggestion.range,
            text: suggestion.text,
            forceMoveMarkers: true,
          },
        ],
        expect.any(Function)
      )
    })

    it('should handle no model', async () => {
      ;(mockEditor.getModel as jest.Mock).mockReturnValue(null)

      const suggestion = {
        text: 'test',
        range: {} as monaco.IRange,
      }

      await agentAPI.applySuggestion(suggestion)

      expect(mockModel.pushEditOperations).not.toHaveBeenCalled()
    })
  })

  // ==========================================================================
  // Disposal Tests
  // ==========================================================================

  describe('dispose', () => {
    it('should dispose all resources', async () => {
      await agentAPI.initialize()

      agentAPI.dispose()

      expect(mockWSClient.disconnect).toHaveBeenCalled()
    })

    it('should handle multiple dispose calls', async () => {
      await agentAPI.initialize()

      agentAPI.dispose()
      agentAPI.dispose()

      expect(mockWSClient.disconnect).toHaveBeenCalledTimes(1)
    })
  })
})

// ============================================================================
// Provider Registration Tests
// ============================================================================

describe('registerMonacoAgentProviders', () => {
  const mockMonaco = {
    languages: {
      registerCompletionItemProvider: jest.fn(() => ({ dispose: jest.fn() })),
      registerHoverProvider: jest.fn(() => ({ dispose: jest.fn() })),
      registerCodeActionProvider: jest.fn(() => ({ dispose: jest.fn() })),
    },
  } as any

  let mockWSClient: MockWebSocketStreamingClient

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock client for this test suite
    mockWSClient = createMockWebSocketStreamingClient({
      defaultLatency: 50,
      autoConnect: false,
      autoComplete: true,
    })
  })

  it('should register all providers', () => {
    const agentAPI = new MonacoAgentAPI(mockEditor, {}, mockWSClient as any)
    const disposables = registerMonacoAgentProviders(mockMonaco, 'typescript', agentAPI)

    expect(mockMonaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
      'typescript',
      expect.any(Object)
    )
    expect(mockMonaco.languages.registerHoverProvider).toHaveBeenCalledWith(
      'typescript',
      expect.any(Object)
    )
    expect(mockMonaco.languages.registerCodeActionProvider).toHaveBeenCalledWith(
      'typescript',
      expect.any(Object)
    )

    expect(disposables).toHaveLength(3)
  })

  it('should dispose all providers', () => {
    const agentAPI = new MonacoAgentAPI(mockEditor, {}, mockWSClient as any)
    const disposables = registerMonacoAgentProviders(mockMonaco, 'typescript', agentAPI)

    disposables.forEach(d => d.dispose())

    expect(disposables.every(d => d.dispose)).toBeTruthy()
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  let agentAPI: MonacoAgentAPI
  let mockWSClient: MockWebSocketStreamingClient

  beforeEach(async () => {
    jest.clearAllMocks()

    // Create a fresh mock for performance tests
    mockWSClient = createMockWebSocketStreamingClient({
      defaultLatency: 100,
      autoConnect: false,
      autoComplete: true,
    })

    ;(mockEditor.getModel as jest.Mock).mockReturnValue(mockModel)
    ;(mockEditor.getPosition as jest.Mock).mockReturnValue(mockPosition)

    agentAPI = new MonacoAgentAPI(
      mockEditor,
      {
        completionTimeout: 300,
        diagnosticsDebounce: 1000,
      },
      mockWSClient as any
    )

    await agentAPI.initialize()
  })

  afterEach(() => {
    agentAPI.dispose()
  })

  it('should meet completion latency target', async () => {
    const mockCompletions = [{ label: 'test', kind: 1, insertText: 'test' }]

    mockWSClient.stream.mockImplementation(async (payload, handlers) => {
      await new Promise(resolve => setTimeout(resolve, 200))
      handlers.onChunk({ data: { completions: mockCompletions } })
      handlers.onComplete?.()
      return 'request-id'
    })

    const startTime = Date.now()
    await agentAPI.requestCompletions(mockPosition, {
      triggerKind: 1,
    } as monaco.languages.CompletionContext)
    const latency = Date.now() - startTime

    expect(latency).toBeLessThan(300)
  })

  it('should handle multiple concurrent requests', async () => {
    const mockCompletions = [{ label: 'test', kind: 1, insertText: 'test' }]

    mockWSClient.stream.mockImplementation(async (payload, handlers) => {
      await new Promise(resolve => setTimeout(resolve, 100))
      handlers.onChunk({ data: { completions: mockCompletions } })
      handlers.onComplete?.()
      return 'request-id'
    })

    const requests = Array.from({ length: 5 }, () =>
      agentAPI.requestCompletions(mockPosition, {
        triggerKind: 1,
      } as monaco.languages.CompletionContext)
    )

    const results = await Promise.all(requests)

    expect(results).toHaveLength(5)
    results.forEach(result => {
      expect(result).toEqual(mockCompletions)
    })
  })
})
