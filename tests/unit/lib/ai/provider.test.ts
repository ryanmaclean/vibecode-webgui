/**
 * Tests for AI Provider Factory
 */

import { getAIProvider, createAIProvider, AIProviderOptions } from '@/lib/ai/provider'
import { EnhancedAIManager } from '@/lib/ai/enhanced-ai-manager'

// Mock the enhanced AI manager
jest.mock('@/lib/ai/enhanced-ai-manager')

describe('AI Provider', () => {
  const mockExecuteWorkflow = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(EnhancedAIManager as jest.MockedClass<typeof EnhancedAIManager>).mockImplementation(() => ({
      executeWorkflow: mockExecuteWorkflow,
      selectBestModel: jest.fn(),
      generateEmbeddings: jest.fn()
    } as any))
  })

  describe('getAIProvider', () => {
    it('should create provider with default options', () => {
      const provider = getAIProvider()

      expect(provider).toHaveProperty('createChatCompletion')
      expect(provider).toHaveProperty('createEmbedding')
      expect(provider).toHaveProperty('getModelInfo')
    })

    it('should create provider with custom options', () => {
      const options: AIProviderOptions = {
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 2000
      }
      const provider = getAIProvider(options)

      expect(provider).toBeDefined()
      expect(typeof provider.createChatCompletion).toBe('function')
    })

    it('should accept workflow type in options', () => {
      const options: AIProviderOptions = {
        workflowType: 'code-generation'
      }
      const provider = getAIProvider(options)

      expect(provider).toBeDefined()
    })

    it('should support all workflow types', () => {
      const workflowTypes: Array<AIProviderOptions['workflowType']> = [
        'code-generation',
        'code-review',
        'documentation',
        'custom'
      ]

      workflowTypes.forEach(type => {
        const provider = getAIProvider({ workflowType: type })
        expect(provider).toBeDefined()
      })
    })

    describe('createChatCompletion', () => {
      it('should create chat completion with messages', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: { model: 'gpt-4o-mini' },
          results: ['Test response']
        })

        const provider = getAIProvider()
        const messages = [{ role: 'user', content: 'Hello' }]
        const stream = await provider.createChatCompletion(messages)

        expect(stream).toBeInstanceOf(ReadableStream)
        expect(mockExecuteWorkflow).toHaveBeenCalled()
      })

      it('should pass messages to workflow', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: {},
          results: []
        })

        const provider = getAIProvider()
        const messages = [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there' }
        ]
        await provider.createChatCompletion(messages)

        expect(mockExecuteWorkflow).toHaveBeenCalledWith(
          expect.objectContaining({
            requirements: expect.stringContaining('Hello')
          })
        )
      })

      it('should use workflow type from provider options', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: {},
          results: []
        })

        const provider = getAIProvider({ workflowType: 'code-generation' })
        const messages = [{ role: 'user', content: 'Generate code' }]
        await provider.createChatCompletion(messages)

        expect(mockExecuteWorkflow).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'code-generation'
          })
        )
      })

      it('should allow override of workflow type', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: {},
          results: []
        })

        const provider = getAIProvider({ workflowType: 'code-generation' })
        const messages = [{ role: 'user', content: 'Review this' }]
        await provider.createChatCompletion(messages, { workflowType: 'code-review' })

        expect(mockExecuteWorkflow).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'code-review'
          })
        )
      })

      it('should throw error on workflow failure', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: false,
          error: 'API key missing'
        })

        const provider = getAIProvider()
        const messages = [{ role: 'user', content: 'Hello' }]

        await expect(
          provider.createChatCompletion(messages)
        ).rejects.toThrow('API key missing')
      })

      it('should throw generic error if no error message', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: false
        })

        const provider = getAIProvider()
        const messages = [{ role: 'user', content: 'Hello' }]

        await expect(
          provider.createChatCompletion(messages)
        ).rejects.toThrow('AI workflow execution failed')
      })

      it('should return readable stream', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: { model: 'gpt-4o-mini' },
          results: ['Response text']
        })

        const provider = getAIProvider()
        const messages = [{ role: 'user', content: 'Test' }]
        const stream = await provider.createChatCompletion(messages)

        const reader = stream.getReader()
        const { value, done } = await reader.read()

        expect(done).toBe(false)
        expect(value).toBeInstanceOf(Uint8Array)
      })

      it('should encode response as JSON in stream', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: { model: 'gpt-4o-mini', tokens: 100 },
          results: ['Test response']
        })

        const provider = getAIProvider()
        const messages = [{ role: 'user', content: 'Test' }]
        const stream = await provider.createChatCompletion(messages)

        const reader = stream.getReader()
        const { value } = await reader.read()
        const text = new TextDecoder().decode(value)
        const data = JSON.parse(text)

        expect(data).toHaveProperty('metadata')
        expect(data).toHaveProperty('results')
        expect(data.results).toEqual(['Test response'])
      })

      it('should handle empty messages array', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: {},
          results: []
        })

        const provider = getAIProvider()
        await provider.createChatCompletion([])

        expect(mockExecuteWorkflow).toHaveBeenCalled()
      })

      it('should handle messages with various roles', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: {},
          results: []
        })

        const provider = getAIProvider()
        const messages = [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
          { role: 'user', content: 'How are you?' }
        ]
        await provider.createChatCompletion(messages)

        expect(mockExecuteWorkflow).toHaveBeenCalled()
      })
    })

    describe('createEmbedding', () => {
      it('should return empty array for mock implementation', async () => {
        const provider = getAIProvider()
        const embedding = await provider.createEmbedding!('test text')

        expect(embedding).toEqual([])
      })

      it('should be defined', () => {
        const provider = getAIProvider()

        expect(provider.createEmbedding).toBeDefined()
        expect(typeof provider.createEmbedding).toBe('function')
      })

      it('should handle any text input', async () => {
        const provider = getAIProvider()
        const texts = ['short', 'a longer piece of text', '', '12345', 'special @#$ chars']

        for (const text of texts) {
          const result = await provider.createEmbedding!(text)
          expect(Array.isArray(result)).toBe(true)
        }
      })
    })

    describe('getModelInfo', () => {
      it('should return model information', () => {
        const provider = getAIProvider()
        const info = provider.getModelInfo!('gpt-4')

        expect(info).toHaveProperty('model')
        expect(info).toHaveProperty('provider')
        expect(info).toHaveProperty('maxTokens')
        expect(info).toHaveProperty('supportsStreaming')
      })

      it('should return info for specified model', () => {
        const provider = getAIProvider()
        const info = provider.getModelInfo!('gpt-4-turbo')

        expect(info.model).toBe('gpt-4-turbo')
      })

      it('should indicate OpenAI provider', () => {
        const provider = getAIProvider()
        const info = provider.getModelInfo!('any-model')

        expect(info.provider).toBe('openai')
      })

      it('should indicate streaming support', () => {
        const provider = getAIProvider()
        const info = provider.getModelInfo!('gpt-4')

        expect(info.supportsStreaming).toBe(true)
      })

      it('should use default maxTokens', () => {
        const provider = getAIProvider()
        const info = provider.getModelInfo!('gpt-4')

        expect(info.maxTokens).toBe(4000)
      })

      it('should use custom maxTokens from options', () => {
        const provider = getAIProvider({ maxTokens: 8000 })
        const info = provider.getModelInfo!('gpt-4')

        expect(info.maxTokens).toBe(8000)
      })
    })
  })

  describe('createAIProvider', () => {
    it('should create provider with custom config', () => {
      const config = {
        openai: {
          apiKey: 'test-key',
          model: 'gpt-4',
          temperature: 0.8
        }
      }
      const provider = createAIProvider(config)

      expect(provider).toHaveProperty('createChatCompletion')
      expect(provider).toHaveProperty('createEmbedding')
      expect(provider).toHaveProperty('getModelInfo')
    })

    it('should create new manager instance', () => {
      const config = {
        openai: {
          apiKey: 'test-key',
          model: 'gpt-4',
          temperature: 0.5
        }
      }
      createAIProvider(config)

      expect(EnhancedAIManager).toHaveBeenCalledWith(config)
    })

    it('should not reuse global manager instance', () => {
      const config1 = {
        openai: { apiKey: 'key1', model: 'gpt-4', temperature: 0.5 }
      }
      const config2 = {
        openai: { apiKey: 'key2', model: 'gpt-4', temperature: 0.7 }
      }

      const initialCallCount = (EnhancedAIManager as jest.Mock).mock.calls.length
      createAIProvider(config1)
      createAIProvider(config2)
      const finalCallCount = (EnhancedAIManager as jest.Mock).mock.calls.length

      expect(finalCallCount - initialCallCount).toBe(2)
    })

    describe('createChatCompletion', () => {
      it('should work with custom provider', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: {},
          results: ['Custom response']
        })

        const config = {
          openai: { apiKey: 'test', model: 'gpt-4', temperature: 0.5 }
        }
        const provider = createAIProvider(config)
        const messages = [{ role: 'user', content: 'Hello' }]
        const stream = await provider.createChatCompletion(messages)

        expect(stream).toBeInstanceOf(ReadableStream)
      })

      it('should default to custom workflow type', async () => {
        mockExecuteWorkflow.mockResolvedValue({
          success: true,
          metadata: {},
          results: []
        })

        const config = {
          openai: { apiKey: 'test', model: 'gpt-4', temperature: 0.5 }
        }
        const provider = createAIProvider(config)
        const messages = [{ role: 'user', content: 'Test' }]
        await provider.createChatCompletion(messages)

        expect(mockExecuteWorkflow).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'custom'
          })
        )
      })
    })

    describe('getModelInfo', () => {
      it('should return default maxTokens', () => {
        const config = {
          openai: { apiKey: 'test', model: 'gpt-4', temperature: 0.5 }
        }
        const provider = createAIProvider(config)
        const info = provider.getModelInfo!('gpt-4')

        expect(info.maxTokens).toBe(4000)
      })

      it('should return provider info', () => {
        const config = {
          openai: { apiKey: 'test', model: 'gpt-4', temperature: 0.5 }
        }
        const provider = createAIProvider(config)
        const info = provider.getModelInfo!('gpt-4')

        expect(info.provider).toBe('openai')
        expect(info.supportsStreaming).toBe(true)
      })
    })
  })

  describe('provider reuse', () => {
    it('should reuse manager instance for getAIProvider', async () => {
      mockExecuteWorkflow.mockResolvedValue({
        success: true,
        metadata: {},
        results: []
      })

      const initialCallCount = (EnhancedAIManager as jest.Mock).mock.calls.length

      const provider1 = getAIProvider()
      const provider2 = getAIProvider()

      await provider1.createChatCompletion([{ role: 'user', content: 'Test 1' }])
      await provider2.createChatCompletion([{ role: 'user', content: 'Test 2' }])

      const finalCallCount = (EnhancedAIManager as jest.Mock).mock.calls.length

      // Should only create one manager instance
      expect(finalCallCount - initialCallCount).toBeLessThanOrEqual(1)
    })
  })

  describe('edge cases', () => {
    it('should handle very long message content', async () => {
      mockExecuteWorkflow.mockResolvedValue({
        success: true,
        metadata: {},
        results: []
      })

      const provider = getAIProvider()
      const longContent = 'a'.repeat(10000)
      const messages = [{ role: 'user', content: longContent }]

      await expect(
        provider.createChatCompletion(messages)
      ).resolves.toBeDefined()
    })

    it('should handle messages with special characters', async () => {
      mockExecuteWorkflow.mockResolvedValue({
        success: true,
        metadata: {},
        results: []
      })

      const provider = getAIProvider()
      const messages = [
        { role: 'user', content: 'Test with "quotes" and \'apostrophes\'' },
        { role: 'user', content: 'Test with\nnewlines\nand\ttabs' },
        { role: 'user', content: 'Test with unicode: 你好 🚀' }
      ]

      await expect(
        provider.createChatCompletion(messages)
      ).resolves.toBeDefined()
    })

    it('should handle undefined optional methods gracefully', () => {
      const provider = getAIProvider()

      expect(() => provider.getModelInfo?.('gpt-4')).not.toThrow()
      expect(() => provider.createEmbedding?.('text')).not.toThrow()
    })
  })
})
