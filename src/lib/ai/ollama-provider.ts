// Ollama Provider Adapter - Integrates Ollama with the unified AI interface
// Provides seamless streaming support and type conversion for local models

import { OllamaClient, OllamaChatMessage, OllamaChatRequest, OllamaChatResponse } from '@/lib/ollama-client'
import { UnifiedChatMessage, UnifiedChatResponse, UnifiedStreamChunk } from '@/lib/unified-ai-client'
import { createServiceLogger } from '@/lib/logging'

// Service logger for Ollama provider
const log = createServiceLogger({
  service: 'vibecode-webgui',
  component: 'ollama-provider'
})

export interface OllamaProviderOptions {
  baseURL?: string
  timeout?: number
}

/**
 * Ollama Provider Adapter
 *
 * Bridges the native Ollama API with the unified AI client interface,
 * enabling seamless integration of local models with the platform's
 * provider-agnostic architecture.
 */
export class OllamaProvider {
  private client: OllamaClient
  private providerId = 'ollama'

  constructor(options: OllamaProviderOptions = {}) {
    this.client = new OllamaClient(
      options.baseURL || 'http://localhost:11434',
      options.timeout || 30000
    )
  }

  /**
   * Check if Ollama is available and responding
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.client.isAvailable()
    } catch (error) {
      log.warn('Ollama availability check failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      return false
    }
  }

  /**
   * List available models from Ollama
   */
  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.listModels()
      return models.map(m => m.name)
    } catch (error) {
      log.error('Failed to list Ollama models', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Convert unified messages to Ollama format
   */
  private convertMessagesToOllama(messages: UnifiedChatMessage[]): OllamaChatMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }

  /**
   * Convert Ollama response to unified format
   */
  private convertResponseToUnified(
    response: OllamaChatResponse,
    model: string
  ): UnifiedChatResponse {
    return {
      content: response.message.content,
      model,
      provider: this.providerId,
      usage: response.prompt_eval_count && response.eval_count ? {
        promptTokens: response.prompt_eval_count,
        completionTokens: response.eval_count,
        totalTokens: response.prompt_eval_count + response.eval_count
      } : undefined,
      finishReason: response.done ? 'stop' : undefined
    }
  }

  /**
   * Non-streaming chat completion
   */
  async chat(
    messages: UnifiedChatMessage[],
    model: string,
    options: {
      temperature?: number
      maxTokens?: number
      topP?: number
      topK?: number
      repeatPenalty?: number
      stop?: string[]
    } = {}
  ): Promise<UnifiedChatResponse> {
    try {
      const ollamaMessages = this.convertMessagesToOllama(messages)

      const request: OllamaChatRequest = {
        model,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: options.temperature,
          top_p: options.topP,
          top_k: options.topK,
          num_predict: options.maxTokens,
          repeat_penalty: options.repeatPenalty,
          stop: options.stop
        }
      }

      log.debug('Ollama chat request', { model, messageCount: messages.length })

      const response = await this.client.chat(request)

      log.debug('Ollama chat response received', {
        model,
        contentLength: response.message.content.length,
        done: response.done
      })

      return this.convertResponseToUnified(response, model)
    } catch (error) {
      log.error('Ollama chat request failed', {
        model,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Streaming chat completion
   */
  async *chatStream(
    messages: UnifiedChatMessage[],
    model: string,
    options: {
      temperature?: number
      maxTokens?: number
      topP?: number
      topK?: number
      repeatPenalty?: number
      stop?: string[]
    } = {}
  ): AsyncGenerator<UnifiedStreamChunk> {
    try {
      const ollamaMessages = this.convertMessagesToOllama(messages)

      const request: OllamaChatRequest = {
        model,
        messages: ollamaMessages,
        stream: true,
        options: {
          temperature: options.temperature,
          top_p: options.topP,
          top_k: options.topK,
          num_predict: options.maxTokens,
          repeat_penalty: options.repeatPenalty,
          stop: options.stop
        }
      }

      log.debug('Ollama stream request', { model, messageCount: messages.length })

      let totalPromptTokens = 0
      let totalCompletionTokens = 0

      for await (const chunk of this.client.chatStream(request)) {
        // Accumulate token counts
        if (chunk.prompt_eval_count) {
          totalPromptTokens = chunk.prompt_eval_count
        }
        if (chunk.eval_count) {
          totalCompletionTokens = chunk.eval_count
        }

        yield {
          content: chunk.message?.content || '',
          done: chunk.done,
          model,
          provider: this.providerId,
          usage: totalPromptTokens > 0 || totalCompletionTokens > 0 ? {
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            totalTokens: totalPromptTokens + totalCompletionTokens
          } : undefined
        }

        if (chunk.done) {
          log.debug('Ollama stream completed', {
            model,
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens
          })
          break
        }
      }
    } catch (error) {
      log.error('Ollama stream request failed', {
        model,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(model: string, onProgress?: (progress: string) => void): Promise<boolean> {
    try {
      log.info('Pulling Ollama model', { model })
      const result = await this.client.pullModel(model, onProgress)
      log.info('Ollama model pull completed', { model, success: result })
      return result
    } catch (error) {
      log.error('Failed to pull Ollama model', {
        model,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(model: string): Promise<any> {
    try {
      return await this.client.getModelInfo(model)
    } catch (error) {
      log.error('Failed to get Ollama model info', {
        model,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Delete a model from Ollama
   */
  async deleteModel(model: string): Promise<boolean> {
    try {
      log.info('Deleting Ollama model', { model })
      const result = await this.client.deleteModel(model)
      log.info('Ollama model deletion completed', { model, success: result })
      return result
    } catch (error) {
      log.error('Failed to delete Ollama model', {
        model,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  /**
   * Get recommended models for specific use cases
   */
  getRecommendedModels(category: 'coding' | 'general' | 'lightweight' | 'creative' = 'general'): string[] {
    return this.client.getRecommendedModels(category)
  }

  /**
   * Format model size in human-readable format
   */
  formatModelSize(bytes: number): string {
    return this.client.formatModelSize(bytes)
  }
}

// Export singleton instance
export const ollamaProvider = new OllamaProvider()

export default ollamaProvider
