/**
 * Thread Manager for OpenAI Agents
 * Manages conversation threads, sessions, and context persistence
 *
 * Features:
 * - Thread lifecycle management
 * - Session tracking and expiration
 * - Context caching and retrieval
 * - Message history management
 * - Multi-user thread isolation
 * - Automatic cleanup of expired threads
 */

import {
  Thread,
  ThreadCreateParams,
  ThreadMessage,
  ConversationContext,
  ThreadSession,
} from '@/types/openai-agents'
import { OpenAIAgentsClient } from './openai-client'
// import { createLogger } from '@/lib/logger'

const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  log: console.log
}

export interface ThreadManagerConfig {
  client: OpenAIAgentsClient
  sessionTTL?: number // Time-to-live for sessions in milliseconds
  maxMessagesPerThread?: number
  enableAutoCleanup?: boolean
  cleanupInterval?: number
}

export class ThreadManager {
  private client: OpenAIAgentsClient
  private sessions: Map<string, ThreadSession> = new Map()
  private threadContextCache: Map<string, ConversationContext> = new Map()
  private sessionTTL: number
  private maxMessagesPerThread: number
  private cleanupInterval: number
  private cleanupTimer?: NodeJS.Timeout

  constructor(config: ThreadManagerConfig) {
    this.client = config.client
    this.sessionTTL = config.sessionTTL || 24 * 60 * 60 * 1000 // 24 hours default
    this.maxMessagesPerThread = config.maxMessagesPerThread || 100
    this.cleanupInterval = config.cleanupInterval || 60 * 60 * 1000 // 1 hour

    if (config.enableAutoCleanup !== false) {
      this.startAutoCleanup()
    }

    console.info('Thread manager initialized', {
      sessionTTL: this.sessionTTL,
      maxMessagesPerThread: this.maxMessagesPerThread,
      cleanupInterval: this.cleanupInterval,
    })
  }

  /**
   * Create a new conversation thread
   */
  async createThread(
    userId: string,
    assistantId: string,
    params?: Omit<ThreadCreateParams, 'metadata'> & {
      metadata?: Record<string, string>
    }
  ): Promise<ThreadSession> {
    console.info('Creating thread', { userId, assistantId })

    const threadMetadata = {
      userId,
      assistantId,
      createdAt: new Date().toISOString(),
      ...params?.metadata,
    }

    const thread = await this.client.createThread({
      ...params,
      metadata: threadMetadata,
    })

    const session: ThreadSession = {
      threadId: thread.id,
      assistantId,
      userId,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      metadata: threadMetadata,
    }

    this.sessions.set(thread.id, session)

    console.info('Thread created', {
      threadId: thread.id,
      userId,
      assistantId,
    })

    return session
  }

  /**
   * Get or create a thread for a user and assistant
   */
  async getOrCreateThread(
    userId: string,
    assistantId: string,
    options?: {
      reuseExisting?: boolean
      maxAge?: number
    }
  ): Promise<ThreadSession> {
    if (options?.reuseExisting !== false) {
      // Try to find an existing active thread
      const existing = this.findActiveThread(userId, assistantId, options?.maxAge)
      if (existing) {
        console.debug('Reusing existing thread', {
          threadId: existing.threadId,
          userId,
          assistantId,
        })
        this.updateSessionActivity(existing.threadId)
        return existing
      }
    }

    // Create a new thread
    return this.createThread(userId, assistantId)
  }

  /**
   * Get a thread session
   */
  getSession(threadId: string): ThreadSession | undefined {
    const session = this.sessions.get(threadId)

    if (session && this.isSessionExpired(session)) {
      console.info('Session expired', { threadId })
      this.sessions.delete(threadId)
      this.threadContextCache.delete(threadId)
      return undefined
    }

    return session
  }

  /**
   * Update session last active time
   */
  updateSessionActivity(threadId: string): void {
    const session = this.sessions.get(threadId)
    if (session) {
      session.lastActiveAt = new Date()
    }
  }

  /**
   * Add a message to a thread
   */
  async addMessage(
    threadId: string,
    role: 'user' | 'assistant',
    content: string,
    attachments?: ThreadMessage['attachments']
  ): Promise<ThreadMessage> {
    console.info('Adding message to thread', { threadId, role })

    const message = await this.client.createMessage(threadId, {
      role,
      content,
      attachments: attachments || undefined,
    })

    // Update session activity
    this.updateSessionActivity(threadId)

    // Invalidate context cache
    this.threadContextCache.delete(threadId)

    return message
  }

  /**
   * Get conversation context for a thread
   */
  async getContext(
    threadId: string,
    options?: {
      limit?: number
      fromCache?: boolean
    }
  ): Promise<ConversationContext> {
    // Check cache first
    if (options?.fromCache !== false) {
      const cached = this.threadContextCache.get(threadId)
      if (cached) {
        console.debug('Using cached context', { threadId })
        return cached
      }
    }

    console.debug('Fetching thread context', { threadId })

    const [thread, messagesResponse] = await Promise.all([
      this.client.getThread(threadId),
      this.client.listMessages(threadId, {
        limit: options?.limit || this.maxMessagesPerThread,
        order: 'desc',
      }),
    ])

    const context: ConversationContext = {
      threadId: thread.id,
      messages: messagesResponse.data.reverse(), // Oldest first
      vectorStoreIds: this.extractVectorStoreIds(thread),
      fileIds: this.extractFileIds(thread),
    }

    // Cache the context
    this.threadContextCache.set(threadId, context)

    return context
  }

  /**
   * Get message history for a thread
   */
  async getMessageHistory(
    threadId: string,
    options?: {
      limit?: number
      before?: string
      after?: string
    }
  ): Promise<ThreadMessage[]> {
    console.debug('Fetching message history', { threadId, ...options })

    const response = await this.client.listMessages(threadId, {
      limit: options?.limit || 50,
      before: options?.before,
      after: options?.after,
      order: 'desc',
    })

    return (response.data || []).reverse() // Return in chronological order
  }

  /**
   * Delete a thread and clean up session
   */
  async deleteThread(threadId: string): Promise<void> {
    console.info('Deleting thread', { threadId })

    try {
      await this.client.deleteThread(threadId)
    } catch (error) {
      console.error('Failed to delete thread', { threadId, error })
      throw error
    } finally {
      this.sessions.delete(threadId)
      this.threadContextCache.delete(threadId)
    }
  }

  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId: string): ThreadSession[] {
    const sessions = Array.from(this.sessions.values()).filter(
      (session) => session.userId === userId && !this.isSessionExpired(session)
    )

    console.debug('Retrieved user sessions', { userId, count: sessions.length })

    return sessions
  }

  /**
   * Get all active sessions for an assistant
   */
  getAssistantSessions(assistantId: string): ThreadSession[] {
    const sessions = Array.from(this.sessions.values()).filter(
      (session) =>
        session.assistantId === assistantId && !this.isSessionExpired(session)
    )

    console.debug('Retrieved assistant sessions', {
      assistantId,
      count: sessions.length,
    })

    return sessions
  }

  /**
   * Clear expired sessions
   */
  clearExpiredSessions(): number {
    const now = Date.now()
    let cleared = 0

    for (const [threadId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(threadId)
        this.threadContextCache.delete(threadId)
        cleared++
      }
    }

    if (cleared > 0) {
      console.info('Cleared expired sessions', { count: cleared })
    }

    return cleared
  }

  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number
    activeSessions: number
    expiredSessions: number
    cachedContexts: number
  } {
    let expired = 0
    for (const session of this.sessions.values()) {
      if (this.isSessionExpired(session)) {
        expired++
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: this.sessions.size - expired,
      expiredSessions: expired,
      cachedContexts: this.threadContextCache.size,
    }
  }

  /**
   * Stop the thread manager and cleanup
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    console.info('Thread manager stopped')
  }

  // Private Helper Methods

  /**
   * Find an active thread for a user and assistant
   */
  private findActiveThread(
    userId: string,
    assistantId: string,
    maxAge?: number
  ): ThreadSession | undefined {
    const now = Date.now()
    const maxAgeMs = maxAge || this.sessionTTL

    for (const session of this.sessions.values()) {
      if (
        session.userId === userId &&
        session.assistantId === assistantId &&
        !this.isSessionExpired(session) &&
        now - session.lastActiveAt.getTime() < maxAgeMs
      ) {
        return session
      }
    }

    return undefined
  }

  /**
   * Check if a session is expired
   */
  private isSessionExpired(session: ThreadSession): boolean {
    const now = Date.now()
    return now - session.lastActiveAt.getTime() > this.sessionTTL
  }

  /**
   * Extract vector store IDs from thread
   */
  private extractVectorStoreIds(thread: Thread): string[] | undefined {
    const vectorStoreIds =
      thread.tool_resources?.file_search?.vector_store_ids
    return vectorStoreIds && vectorStoreIds.length > 0
      ? vectorStoreIds
      : undefined
  }

  /**
   * Extract file IDs from thread
   */
  private extractFileIds(thread: Thread): string[] | undefined {
    const fileIds = thread.tool_resources?.code_interpreter?.file_ids
    return fileIds && fileIds.length > 0 ? fileIds : undefined
  }

  /**
   * Start automatic cleanup of expired sessions
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      console.debug('Running automatic session cleanup')
      this.clearExpiredSessions()
    }, this.cleanupInterval)

    console.info('Auto cleanup started', {
      interval: this.cleanupInterval,
    })
  }
}

// Global singleton instance
let globalThreadManager: ThreadManager | null = null

/**
 * Get the global thread manager instance
 */
export function getThreadManager(
  config?: ThreadManagerConfig
): ThreadManager {
  if (!globalThreadManager && config) {
    globalThreadManager = new ThreadManager(config)
    console.info('Global thread manager created')
  }

  if (!globalThreadManager) {
    throw new Error(
      'ThreadManager not initialized. Call getThreadManager with config first.'
    )
  }

  return globalThreadManager
}

/**
 * Initialize the global thread manager
 */
export function initializeThreadManager(
  config: ThreadManagerConfig
): ThreadManager {
  if (globalThreadManager) {
    globalThreadManager.stop()
  }

  globalThreadManager = new ThreadManager(config)
  return globalThreadManager
}
