/**
 * OpenAI Agents API Client
 * Provides typed interface for interacting with OpenAI Assistants API
 *
 * Features:
 * - Agent CRUD operations
 * - Thread management
 * - Message handling
 * - Run execution with streaming support
 * - File operations
 * - Vector store management
 * - Automatic retry with exponential backoff
 * - Request/response logging for observability
 */

import {
  Agent,
  AgentConfig,
  Thread,
  ThreadCreateParams,
  ThreadMessage,
  ThreadMessageCreateParams,
  Run,
  RunCreateParams,
  RunStreamEvent,
  FileObject,
  VectorStore,
  ListResponse,
  DeleteResponse,
  APIError,
  OpenAIAgentsConfig,
  ToolOutput,
} from '@/types/openai-agents'
// import { createLogger } from '@/lib/logger'
import { loadSecret } from '@/lib/security/macos-keychain-server'

const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  log: console.log
}

export class OpenAIAgentsClient {
  private apiKey: string
  private organization?: string
  private baseURL: string
  private timeout: number
  private maxRetries: number
  private defaultHeaders: Record<string, string>

  constructor(config: OpenAIAgentsConfig) {
    this.apiKey = config.apiKey
    this.organization = config.organization
    this.baseURL = config.baseURL || 'https://api.openai.com/v1'
    this.timeout = config.timeout || 60000
    this.maxRetries = config.maxRetries || 3
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'OpenAI-Beta': 'assistants=v2',
      ...(this.organization && { 'OpenAI-Organization': this.organization }),
      ...config.defaultHeaders,
    }

    console.info('OpenAI Agents client initialized', {
      baseURL: this.baseURL,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
    })
  }

  // Agent Operations

  /**
   * Create a new agent (assistant)
   */
  async createAgent(config: AgentConfig): Promise<Agent> {
    console.info('Creating agent', { model: config.model, name: config.name })

    return this.request<Agent>('/assistants', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  /**
   * Retrieve an agent by ID
   */
  async getAgent(agentId: string): Promise<Agent> {
    console.debug('Retrieving agent', { agentId })

    return this.request<Agent>(`/assistants/${agentId}`, {
      method: 'GET',
    })
  }

  /**
   * Update an existing agent
   */
  async updateAgent(
    agentId: string,
    updates: Partial<AgentConfig>
  ): Promise<Agent> {
    console.info('Updating agent', { agentId })

    return this.request<Agent>(`/assistants/${agentId}`, {
      method: 'POST',
      body: JSON.stringify(updates),
    })
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<DeleteResponse> {
    console.info('Deleting agent', { agentId })

    return this.request<DeleteResponse>(`/assistants/${agentId}`, {
      method: 'DELETE',
    })
  }

  /**
   * List agents with pagination
   */
  async listAgents(params?: {
    limit?: number
    order?: 'asc' | 'desc'
    after?: string
    before?: string
  }): Promise<ListResponse<Agent>> {
    console.debug('Listing agents', params)

    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.order) query.set('order', params.order)
    if (params?.after) query.set('after', params.after)
    if (params?.before) query.set('before', params.before)

    const url = `/assistants${query.toString() ? `?${query}` : ''}`

    return this.request<ListResponse<Agent>>(url, {
      method: 'GET',
    })
  }

  // Thread Operations

  /**
   * Create a new conversation thread
   */
  async createThread(params?: ThreadCreateParams): Promise<Thread> {
    console.info('Creating thread')

    return this.request<Thread>('/threads', {
      method: 'POST',
      body: params ? JSON.stringify(params) : undefined,
    })
  }

  /**
   * Retrieve a thread by ID
   */
  async getThread(threadId: string): Promise<Thread> {
    console.debug('Retrieving thread', { threadId })

    return this.request<Thread>(`/threads/${threadId}`, {
      method: 'GET',
    })
  }

  /**
   * Update thread metadata
   */
  async updateThread(
    threadId: string,
    metadata: Record<string, string>
  ): Promise<Thread> {
    console.info('Updating thread', { threadId })

    return this.request<Thread>(`/threads/${threadId}`, {
      method: 'POST',
      body: JSON.stringify({ metadata }),
    })
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<DeleteResponse> {
    console.info('Deleting thread', { threadId })

    return this.request<DeleteResponse>(`/threads/${threadId}`, {
      method: 'DELETE',
    })
  }

  // Message Operations

  /**
   * Add a message to a thread
   */
  async createMessage(
    threadId: string,
    message: ThreadMessageCreateParams
  ): Promise<ThreadMessage> {
    console.info('Creating message', { threadId, role: message.role })

    return this.request<ThreadMessage>(`/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    })
  }

  /**
   * List messages in a thread
   */
  async listMessages(
    threadId: string,
    params?: {
      limit?: number
      order?: 'asc' | 'desc'
      after?: string
      before?: string
    }
  ): Promise<ListResponse<ThreadMessage>> {
    console.debug('Listing messages', { threadId, ...params })

    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.order) query.set('order', params.order)
    if (params?.after) query.set('after', params.after)
    if (params?.before) query.set('before', params.before)

    const url = `/threads/${threadId}/messages${
      query.toString() ? `?${query}` : ''
    }`

    return this.request<ListResponse<ThreadMessage>>(url, {
      method: 'GET',
    })
  }

  /**
   * Retrieve a specific message
   */
  async getMessage(threadId: string, messageId: string): Promise<ThreadMessage> {
    console.debug('Retrieving message', { threadId, messageId })

    return this.request<ThreadMessage>(
      `/threads/${threadId}/messages/${messageId}`,
      {
        method: 'GET',
      }
    )
  }

  // Run Operations

  /**
   * Create and execute a run
   */
  async createRun(threadId: string, params: RunCreateParams): Promise<Run> {
    console.info('Creating run', {
      threadId,
      assistantId: params.assistant_id,
      stream: params.stream,
    })

    return this.request<Run>(`/threads/${threadId}/runs`, {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Create a run with streaming response
   */
  async createRunStream(
    threadId: string,
    params: RunCreateParams
  ): Promise<ReadableStream<RunStreamEvent>> {
    console.info('Creating streaming run', {
      threadId,
      assistantId: params.assistant_id,
    })

    const response = await this.requestRaw(`/threads/${threadId}/runs`, {
      method: 'POST',
      body: JSON.stringify({ ...params, stream: true }),
    })

    if (!response.body) {
      throw new Error('Response body is null')
    }

    return this.parseSSEStream(response.body)
  }

  /**
   * Retrieve a run
   */
  async getRun(threadId: string, runId: string): Promise<Run> {
    console.debug('Retrieving run', { threadId, runId })

    return this.request<Run>(`/threads/${threadId}/runs/${runId}`, {
      method: 'GET',
    })
  }

  /**
   * Submit tool outputs to continue a run
   */
  async submitToolOutputs(
    threadId: string,
    runId: string,
    toolOutputs: ToolOutput[]
  ): Promise<Run> {
    console.info('Submitting tool outputs', {
      threadId,
      runId,
      outputCount: toolOutputs.length,
    })

    return this.request<Run>(
      `/threads/${threadId}/runs/${runId}/submit_tool_outputs`,
      {
        method: 'POST',
        body: JSON.stringify({ tool_outputs: toolOutputs }),
      }
    )
  }

  /**
   * Cancel a run
   */
  async cancelRun(threadId: string, runId: string): Promise<Run> {
    console.info('Cancelling run', { threadId, runId })

    return this.request<Run>(`/threads/${threadId}/runs/${runId}/cancel`, {
      method: 'POST',
    })
  }

  /**
   * Create a thread and run in one request
   */
  async createThreadAndRun(params: {
    assistant_id: string
    thread?: ThreadCreateParams
    model?: string
    instructions?: string
    tools?: RunCreateParams['tools']
    metadata?: Record<string, string>
  }): Promise<Run> {
    console.info('Creating thread and run', { assistantId: params.assistant_id })

    return this.request<Run>('/threads/runs', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // File Operations

  /**
   * Upload a file for use with assistants
   */
  async uploadFile(
    file: Blob,
    filename: string,
    purpose: 'assistants' | 'vision'
  ): Promise<FileObject> {
    console.info('Uploading file', { filename, purpose })

    const formData = new FormData()
    formData.append('file', file, filename)
    formData.append('purpose', purpose)

    const headers = { ...this.defaultHeaders }
    delete headers['Content-Type'] // Let browser set multipart boundary

    return this.request<FileObject>('/files', {
      method: 'POST',
      body: formData,
      headers,
    })
  }

  /**
   * Retrieve file metadata
   */
  async getFile(fileId: string): Promise<FileObject> {
    console.debug('Retrieving file', { fileId })

    return this.request<FileObject>(`/files/${fileId}`, {
      method: 'GET',
    })
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<Blob> {
    console.info('Downloading file', { fileId })

    const response = await this.requestRaw(`/files/${fileId}/content`, {
      method: 'GET',
    })

    return response.blob()
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<DeleteResponse> {
    console.info('Deleting file', { fileId })

    return this.request<DeleteResponse>(`/files/${fileId}`, {
      method: 'DELETE',
    })
  }

  // Vector Store Operations

  /**
   * Create a vector store
   */
  async createVectorStore(params: {
    name: string
    file_ids?: string[]
    expires_after?: { anchor: 'last_active_at'; days: number }
    metadata?: Record<string, string>
  }): Promise<VectorStore> {
    console.info('Creating vector store', { name: params.name })

    return this.request<VectorStore>('/vector_stores', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Retrieve a vector store
   */
  async getVectorStore(vectorStoreId: string): Promise<VectorStore> {
    console.debug('Retrieving vector store', { vectorStoreId })

    return this.request<VectorStore>(`/vector_stores/${vectorStoreId}`, {
      method: 'GET',
    })
  }

  /**
   * Delete a vector store
   */
  async deleteVectorStore(vectorStoreId: string): Promise<DeleteResponse> {
    console.info('Deleting vector store', { vectorStoreId })

    return this.request<DeleteResponse>(`/vector_stores/${vectorStoreId}`, {
      method: 'DELETE',
    })
  }

  // Private Helper Methods

  /**
   * Make an HTTP request with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit & { headers?: Record<string, string> }
  ): Promise<T> {
    const response = await this.requestRaw(endpoint, options)
    const data = await response.json()

    if (!response.ok) {
      const error = data as APIError
      console.error('API request failed', {
        endpoint,
        status: response.status,
        error: error.error,
      })
      throw new OpenAIAgentError(
        error.error.message,
        response.status,
        error.error.code || 'unknown'
      )
    }

    return data as T
  }

  /**
   * Make a raw HTTP request with retry and timeout
   */
  private async requestRaw(
    endpoint: string,
    options: RequestInit & { headers?: Record<string, string> }
  ): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`
    const headers = { ...this.defaultHeaders, ...options.headers }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Retry on 5xx errors or rate limits
        if (
          response.status >= 500 ||
          response.status === 429 ||
          response.status === 408
        ) {
          if (attempt < this.maxRetries) {
            const delay = this.calculateBackoff(attempt)
            console.warn('Request failed, retrying', {
              endpoint,
              status: response.status,
              attempt: attempt + 1,
              delay,
            })
            await this.sleep(delay)
            continue
          }
        }

        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < this.maxRetries) {
          const delay = this.calculateBackoff(attempt)
          console.warn('Request error, retrying', {
            endpoint,
            error: lastError.message,
            attempt: attempt + 1,
            delay,
          })
          await this.sleep(delay)
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  /**
   * Parse Server-Sent Events stream
   */
  private parseSSEStream(
    body: ReadableStream<Uint8Array>
  ): ReadableStream<RunStreamEvent> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    return new ReadableStream<RunStreamEvent>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read()

          if (done) {
            controller.close()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)

              if (data === '[DONE]') {
                controller.close()
                return
              }

              try {
                const parsed = JSON.parse(data)
                controller.enqueue(parsed as RunStreamEvent)
              } catch (error) {
                console.warn('Failed to parse SSE data', { data, error })
              }
            }
          }
        } catch (error) {
          console.error('Stream error', { error })
          controller.error(error)
        }
      },
    })
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000)
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Custom error class for OpenAI Agent errors
 */
export class OpenAIAgentError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message)
    this.name = 'OpenAIAgentError'
  }
}

/**
 * Factory function to create a configured client
 */
export function createOpenAIAgentsClient(
  config?: Partial<OpenAIAgentsConfig>
): OpenAIAgentsClient {
  // Load API key from keychain with fallback to environment variable
  const apiKey = config?.apiKey || loadSecret('OPENAI_API_KEY') || process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error(
      'OpenAI API key is required. Set OPENAI_API_KEY in keychain or environment variable or pass apiKey in config.'
    )
  }

  return new OpenAIAgentsClient({
    apiKey,
    organization: config?.organization || loadSecret('OPENAI_ORGANIZATION') || process.env.OPENAI_ORGANIZATION,
    ...config,
  })
}
