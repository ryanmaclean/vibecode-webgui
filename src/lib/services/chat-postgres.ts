/**
 * Chat Service with PostgreSQL (Prisma)
 * Handles chat message storage, retrieval, and conversation management
 * using PostgreSQL as the persistence layer
 *
 * Optimized with:
 * - Query caching for frequently accessed data
 * - Batch operations to prevent N+1 queries
 * - Index-aware query patterns
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import type { Prisma, Conversation, Message, ChatSession } from '@prisma/client';
import { QueryCacheManager, CacheInvalidation } from '../database/query-cache-strategy';
import { metrics } from '../server-monitoring';
import {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  clampLimit,
  clampOffset,
} from '@/lib/api/pagination';

// Re-export enums for convenience
export { ConversationStatus, MessageRole } from '@prisma/client';

export interface ChatMessageInput {
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  tokens?: number;
  model?: string;
  provider?: string;
  durationMs?: number;
  files?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateConversationInput {
  userId: number;
  workspaceId?: number;
  title?: string;
  sessionId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationSearchOptions {
  userId?: number;
  workspaceId?: number;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface MessageSearchOptions {
  conversationId?: string;
  role?: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface ChatStats {
  totalMessages: number;
  totalConversations: number;
  activeConversations: number;
  averageMessagesPerConversation: number;
  messagesByRole: {
    user: number;
    assistant: number;
    system: number;
    tool: number;
  };
  totalTokens: number;
}

/**
 * Chat Service for PostgreSQL-based chat functionality using Prisma
 */
export class ChatPostgresService {
  /**
   * Create a new conversation
   */
  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const conversation = await prisma.conversation.create({
      data: {
        user_id: input.userId,
        workspace_id: input.workspaceId,
        title: input.title,
        session_id: input.sessionId,
        model: input.model,
        metadata: input.metadata as Prisma.InputJsonValue,
        status: 'ACTIVE',
        message_count: 0,
      },
    });

    return conversation;
  }

  /**
   * Get conversation by ID (with caching)
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    return QueryCacheManager.executeWithCache(
      'conversation',
      'getById',
      { conversationId },
      () => prisma.conversation.findUnique({
        where: { id: conversationId },
      })
    );
  }

  /**
   * Get conversation with messages
   */
  async getConversationWithMessages(
    conversationId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<(Conversation & { messages: Message[] }) | null> {
    // Validate and cap pagination parameters to prevent resource exhaustion
    const limit = clampLimit(options.limit ?? DEFAULT_PAGE_SIZE.MESSAGES, MAX_PAGE_SIZE.MESSAGES, DEFAULT_PAGE_SIZE.MESSAGES);
    const offset = clampOffset(options.offset ?? 0);

    return await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
          skip: offset,
          take: limit,
        },
      },
    });
  }

  /**
   * Update conversation (with cache invalidation)
   */
  async updateConversation(
    conversationId: string,
    data: {
      title?: string;
      model?: string;
      status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
      metadata?: Record<string, unknown>;
    }
  ): Promise<Conversation> {
    const updateData: Prisma.ConversationUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.metadata !== undefined) updateData.metadata = data.metadata as Prisma.InputJsonValue;

    if (data.status === 'ARCHIVED') {
      updateData.archived_at = new Date();
    }

    const result = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    // Invalidate cache for this conversation
    await CacheInvalidation.onConversationUpdate(conversationId);

    return result;
  }

  /**
   * Delete conversation (soft delete by setting status to DELETED)
   */
  async deleteConversation(conversationId: string, hard = false): Promise<void> {
    if (hard) {
      // Hard delete - removes conversation and all messages (cascaded)
      await prisma.conversation.delete({
        where: { id: conversationId },
      });
    } else {
      // Soft delete
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'DELETED',
          archived_at: new Date(),
        },
      });
    }
  }

  /**
   * Get conversations for a user (with caching for common queries)
   * Optimized: Uses composite index on (user_id, status, updated_at)
   */
  async getUserConversations(
    userId: number,
    options: {
      workspaceId?: number;
      status?: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Conversation[]> {
    const { workspaceId, status = 'ACTIVE' } = options;
    // Validate and cap pagination parameters to prevent resource exhaustion
    const limit = clampLimit(options.limit ?? DEFAULT_PAGE_SIZE.CONVERSATIONS, MAX_PAGE_SIZE.CONVERSATIONS, DEFAULT_PAGE_SIZE.CONVERSATIONS);
    const offset = clampOffset(options.offset ?? 0);

    const where: Prisma.ConversationWhereInput = {
      user_id: userId,
      status,
    };

    if (workspaceId) {
      where.workspace_id = workspaceId;
    }

    // Use caching for first page of common queries
    const shouldCache = offset === 0 && limit <= 50 && !workspaceId;

    if (shouldCache) {
      return QueryCacheManager.executeWithCache(
        'conversation',
        'getUserConversations',
        { userId, status, limit },
        () => prisma.conversation.findMany({
          where,
          orderBy: { updated_at: 'desc' },
          skip: offset,
          take: limit,
        }),
        { customTTL: 60 } // Short TTL for active data
      );
    }

    return await prisma.conversation.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Search conversations
   */
  async searchConversations(options: ConversationSearchOptions): Promise<{
    conversations: Conversation[];
    total: number;
  }> {
    const {
      userId,
      workspaceId,
      status,
      startDate,
      endDate,
      searchTerm,
    } = options;
    // Validate and cap pagination parameters to prevent resource exhaustion
    const limit = clampLimit(options.limit ?? DEFAULT_PAGE_SIZE.CONVERSATIONS, MAX_PAGE_SIZE.CONVERSATIONS, DEFAULT_PAGE_SIZE.CONVERSATIONS);
    const offset = clampOffset(options.offset ?? 0);

    const where: Prisma.ConversationWhereInput = {};

    if (userId) where.user_id = userId;
    if (workspaceId) where.workspace_id = workspaceId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = endDate;
    }

    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        {
          messages: {
            some: {
              content: { contains: searchTerm, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return { conversations, total };
  }

  /**
   * Add a message to a conversation (optimized with transaction)
   * Uses a transaction to ensure atomicity of message creation and count update
   */
  async addMessage(input: ChatMessageInput): Promise<Message> {
    const startTime = Date.now();

    // Use transaction for atomicity
    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversation_id: input.conversationId,
          role: input.role,
          content: input.content,
          tokens: input.tokens,
          model: input.model,
          provider: input.provider,
          duration_ms: input.durationMs,
          files: input.files as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue,
        },
      });

      // Update conversation message count and tokens in same transaction
      await tx.conversation.update({
        where: { id: input.conversationId },
        data: {
          message_count: { increment: 1 },
          total_tokens: input.tokens
            ? { increment: input.tokens }
            : undefined,
          updated_at: new Date(),
        },
      });

      return msg;
    });

    // Invalidate conversation cache
    await CacheInvalidation.onConversationUpdate(input.conversationId);

    // Track metrics
    metrics.histogram('chat.addMessage.duration', Date.now() - startTime);

    return message;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    options: { limit?: number; offset?: number; before?: Date; after?: Date } = {}
  ): Promise<Message[]> {
    const { before, after } = options;
    // Validate and cap pagination parameters to prevent resource exhaustion
    const limit = clampLimit(options.limit ?? DEFAULT_PAGE_SIZE.MESSAGES, MAX_PAGE_SIZE.MESSAGES, DEFAULT_PAGE_SIZE.MESSAGES);
    const offset = clampOffset(options.offset ?? 0);

    const where: Prisma.MessageWhereInput = {
      conversation_id: conversationId,
    };

    if (before || after) {
      where.created_at = {};
      if (after) where.created_at.gte = after;
      if (before) where.created_at.lte = before;
    }

    return await prisma.message.findMany({
      where,
      orderBy: { created_at: 'asc' },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: string): Promise<Message | null> {
    return await prisma.message.findUnique({
      where: { id: messageId },
    });
  }

  /**
   * Update message
   */
  async updateMessage(
    messageId: string,
    data: {
      content?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Message> {
    return await prisma.message.update({
      where: { id: messageId },
      data: {
        content: data.content,
        metadata: data.metadata as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Delete message (optimized with transaction)
   * Uses transaction to ensure atomicity of deletion and count update
   */
  async deleteMessage(messageId: string): Promise<void> {
    // First fetch the message to get conversation_id for cache invalidation
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversation_id: true, tokens: true },
    });

    if (!message) {
      return; // Message not found, nothing to delete
    }

    const conversationId = message.conversation_id;

    // Use transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Delete message and update counts in same transaction
      await tx.message.delete({
        where: { id: messageId },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          message_count: { decrement: 1 },
          total_tokens: message.tokens
            ? { decrement: message.tokens }
            : undefined,
        },
      });
    });

    // Invalidate cache after transaction commits
    await CacheInvalidation.onConversationUpdate(conversationId);
  }

  /**
   * Search messages
   */
  async searchMessages(options: MessageSearchOptions): Promise<{
    messages: Message[];
    total: number;
  }> {
    const {
      conversationId,
      role,
      startDate,
      endDate,
      searchTerm,
    } = options;
    // Validate and cap pagination parameters to prevent resource exhaustion
    const limit = clampLimit(options.limit ?? DEFAULT_PAGE_SIZE.MESSAGES, MAX_PAGE_SIZE.MESSAGES, DEFAULT_PAGE_SIZE.MESSAGES);
    const offset = clampOffset(options.offset ?? 0);

    const where: Prisma.MessageWhereInput = {};

    if (conversationId) where.conversation_id = conversationId;
    if (role) where.role = role;

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = endDate;
    }

    if (searchTerm) {
      where.content = { contains: searchTerm, mode: 'insensitive' };
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    return { messages, total };
  }

  /**
   * Create a chat session
   */
  async createSession(
    userId: number,
    userAgent?: string,
    ipAddress?: string,
    expiresInHours = 24
  ): Promise<ChatSession> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    return await prisma.chatSession.create({
      data: {
        session_id: sessionId,
        user_id: userId,
        user_agent: userAgent,
        ip_address: ipAddress,
        expires_at: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Get session by session ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    return await prisma.chatSession.findUnique({
      where: { session_id: sessionId },
    });
  }

  /**
   * Validate session (check if exists and not expired)
   */
  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;
    return session.expires_at > new Date();
  }

  /**
   * Delete expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.chatSession.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    });

    return result.count;
  }

  /**
   * Archive old conversations
   */
  async archiveOldConversations(daysOld = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.conversation.updateMany({
      where: {
        updated_at: { lt: cutoffDate },
        status: 'ACTIVE',
      },
      data: {
        status: 'ARCHIVED',
        archived_at: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Get chat statistics
   */
  async getChatStats(userId?: number, workspaceId?: number): Promise<ChatStats> {
    const conversationWhere: Prisma.ConversationWhereInput = {};
    const messageWhere: Prisma.MessageWhereInput = {};

    if (userId) {
      conversationWhere.user_id = userId;
    }
    if (workspaceId) {
      conversationWhere.workspace_id = workspaceId;
    }

    // If filtering by user/workspace, we need to filter messages through conversations
    if (userId || workspaceId) {
      messageWhere.conversation = conversationWhere;
    }

    const [
      totalConversations,
      activeConversations,
      totalMessages,
      userMessages,
      assistantMessages,
      systemMessages,
      toolMessages,
      tokenSum,
    ] = await Promise.all([
      prisma.conversation.count({ where: conversationWhere }),
      prisma.conversation.count({
        where: { ...conversationWhere, status: 'ACTIVE' },
      }),
      prisma.message.count({ where: messageWhere }),
      prisma.message.count({ where: { ...messageWhere, role: 'USER' } }),
      prisma.message.count({ where: { ...messageWhere, role: 'ASSISTANT' } }),
      prisma.message.count({ where: { ...messageWhere, role: 'SYSTEM' } }),
      prisma.message.count({ where: { ...messageWhere, role: 'TOOL' } }),
      prisma.conversation.aggregate({
        where: conversationWhere,
        _sum: { total_tokens: true },
      }),
    ]);

    return {
      totalMessages,
      totalConversations,
      activeConversations,
      averageMessagesPerConversation:
        totalConversations > 0 ? totalMessages / totalConversations : 0,
      messagesByRole: {
        user: userMessages,
        assistant: assistantMessages,
        system: systemMessages,
        tool: toolMessages,
      },
      totalTokens: tokenSum._sum.total_tokens || 0,
    };
  }

  /**
   * Export conversation data
   */
  async exportConversationData(
    conversationId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const conversation = await this.getConversationWithMessages(conversationId, {
      limit: 10000,
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (format === 'json') {
      return JSON.stringify(
        {
          id: conversation.id,
          title: conversation.title,
          model: conversation.model,
          exportDate: new Date().toISOString(),
          messages: conversation.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            tokens: msg.tokens,
            createdAt: msg.created_at.toISOString(),
          })),
          messageCount: conversation.messages.length,
        },
        null,
        2
      );
    } else {
      // CSV format
      const headers = ['timestamp', 'role', 'content', 'tokens'];
      const csvRows = [
        headers.join(','),
        ...conversation.messages.map((msg) =>
          [
            msg.created_at.toISOString(),
            msg.role,
            `"${msg.content.replace(/"/g, '""')}"`,
            msg.tokens || '',
          ].join(',')
        ),
      ];

      return csvRows.join('\n');
    }
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    messageCount: number;
    conversationCount: number;
    lastActivity: Date | null;
  }> {
    try {
      const [messageCount, conversationCount, lastConversation] = await Promise.all([
        prisma.message.count(),
        prisma.conversation.count(),
        prisma.conversation.findFirst({
          orderBy: { updated_at: 'desc' },
          select: { updated_at: true },
        }),
      ]);

      return {
        isHealthy: true,
        messageCount,
        conversationCount,
        lastActivity: lastConversation?.updated_at || null,
      };
    } catch (error) {
      console.error('Failed to get chat service health:', error);
      return {
        isHealthy: false,
        messageCount: 0,
        conversationCount: 0,
        lastActivity: null,
      };
    }
  }

  /**
   * Get conversations by workspace
   */
  async getConversationsByWorkspace(
    workspaceId: number,
    requestedLimit?: number
  ): Promise<Conversation[]> {
    // Validate and cap limit parameter to prevent resource exhaustion
    const limit = clampLimit(requestedLimit ?? DEFAULT_PAGE_SIZE.CONVERSATIONS, MAX_PAGE_SIZE.CONVERSATIONS, DEFAULT_PAGE_SIZE.CONVERSATIONS);

    return await prisma.conversation.findMany({
      where: {
        workspace_id: workspaceId,
        status: 'ACTIVE',
      },
      orderBy: { updated_at: 'desc' },
      take: limit,
    });
  }

  /**
   * Clear all messages in a conversation
   */
  async clearConversationMessages(conversationId: string): Promise<number> {
    const result = await prisma.message.deleteMany({
      where: { conversation_id: conversationId },
    });

    // Reset conversation counts
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        message_count: 0,
        total_tokens: 0,
      },
    });

    return result.count;
  }

  // =====================================================
  // Batch Operations (prevents N+1 queries)
  // =====================================================

  /**
   * Batch get multiple conversations by IDs
   * Prevents N+1 when loading conversation lists with details
   */
  async batchGetConversations(
    conversationIds: string[],
    options: { includeMessages?: boolean; messageLimit?: number } = {}
  ): Promise<Map<string, Conversation & { messages?: Message[] }>> {
    if (conversationIds.length === 0) {
      return new Map();
    }

    const startTime = Date.now();
    const { includeMessages = false } = options;
    // Validate and cap messageLimit to prevent resource exhaustion
    const messageLimit = clampLimit(options.messageLimit ?? 10, MAX_PAGE_SIZE.MESSAGES, 10);

    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      include: includeMessages
        ? {
            messages: {
              take: messageLimit,
              orderBy: { created_at: 'desc' },
            },
          }
        : undefined,
    });

    metrics.histogram('chat.batchGetConversations.duration', Date.now() - startTime, {
      count: conversationIds.length.toString(),
    });

    return new Map(conversations.map((conv) => [conv.id, conv]));
  }

  /**
   * Batch add multiple messages (for bulk operations)
   * More efficient than adding messages one-by-one
   */
  async batchAddMessages(
    messages: Array<ChatMessageInput>
  ): Promise<{ created: number; errors: string[] }> {
    if (messages.length === 0) {
      return { created: 0, errors: [] };
    }

    const startTime = Date.now();
    const errors: string[] = [];
    let created = 0;

    // Group messages by conversation for efficient count updates
    const messagesByConversation = new Map<string, ChatMessageInput[]>();
    for (const msg of messages) {
      const existing = messagesByConversation.get(msg.conversationId) ?? [];
      existing.push(msg);
      messagesByConversation.set(msg.conversationId, existing);
    }

    // Process in batches per conversation to maintain data integrity
    const conversationEntries = Array.from(messagesByConversation.entries());
    for (const [conversationId, conversationMessages] of conversationEntries) {
      try {
        await prisma.$transaction(async (tx) => {
          // Batch create all messages for this conversation
          await tx.message.createMany({
            data: conversationMessages.map((msg) => ({
              conversation_id: msg.conversationId,
              role: msg.role,
              content: msg.content,
              tokens: msg.tokens,
              model: msg.model,
              provider: msg.provider,
              duration_ms: msg.durationMs,
              files: msg.files as Prisma.InputJsonValue,
              metadata: msg.metadata as Prisma.InputJsonValue,
            })),
          });

          // Calculate total tokens to add
          const totalTokens = conversationMessages.reduce(
            (sum, msg) => sum + (msg.tokens ?? 0),
            0
          );

          // Update conversation counts once
          await tx.conversation.update({
            where: { id: conversationId },
            data: {
              message_count: { increment: conversationMessages.length },
              total_tokens: totalTokens > 0 ? { increment: totalTokens } : undefined,
              updated_at: new Date(),
            },
          });

          created += conversationMessages.length;
        });

        // Invalidate cache for this conversation
        await CacheInvalidation.onConversationUpdate(conversationId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Conversation ${conversationId}: ${errorMessage}`);
      }
    }

    metrics.histogram('chat.batchAddMessages.duration', Date.now() - startTime, {
      count: messages.length.toString(),
      conversations: messagesByConversation.size.toString(),
    });

    return { created, errors };
  }

  /**
   * Batch delete multiple messages
   * More efficient than deleting messages one-by-one
   */
  async batchDeleteMessages(messageIds: string[]): Promise<{ deleted: number; errors: string[] }> {
    if (messageIds.length === 0) {
      return { deleted: 0, errors: [] };
    }

    const startTime = Date.now();
    const errors: string[] = [];

    // First, fetch all messages to get conversation IDs and token counts
    const messages = await prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, conversation_id: true, tokens: true },
    });

    // Group by conversation for efficient count updates
    const messagesByConversation = new Map<
      string,
      Array<{ id: string; tokens: number | null }>
    >();
    for (const msg of messages) {
      const existing = messagesByConversation.get(msg.conversation_id) ?? [];
      existing.push({ id: msg.id, tokens: msg.tokens });
      messagesByConversation.set(msg.conversation_id, existing);
    }

    let deleted = 0;

    // Process each conversation's messages
    const deleteEntries = Array.from(messagesByConversation.entries());
    for (const [conversationId, conversationMessages] of deleteEntries) {
      try {
        const totalTokens = conversationMessages.reduce(
          (sum, msg) => sum + (msg.tokens ?? 0),
          0
        );

        await prisma.$transaction(async (tx) => {
          // Delete all messages for this conversation
          const result = await tx.message.deleteMany({
            where: {
              id: { in: conversationMessages.map((m) => m.id) },
            },
          });

          // Update conversation counts
          await tx.conversation.update({
            where: { id: conversationId },
            data: {
              message_count: { decrement: result.count },
              total_tokens: totalTokens > 0 ? { decrement: totalTokens } : undefined,
            },
          });

          deleted += result.count;
        });

        // Invalidate cache
        await CacheInvalidation.onConversationUpdate(conversationId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Conversation ${conversationId}: ${errorMessage}`);
      }
    }

    metrics.histogram('chat.batchDeleteMessages.duration', Date.now() - startTime, {
      requested: messageIds.length.toString(),
      deleted: deleted.toString(),
    });

    return { deleted, errors };
  }

  /**
   * Get messages for multiple conversations at once
   * Prevents N+1 when displaying conversation lists with previews
   */
  async batchGetConversationMessages(
    conversationIds: string[],
    options: { limit?: number } = {}
  ): Promise<Map<string, Message[]>> {
    if (conversationIds.length === 0) {
      return new Map();
    }

    const startTime = Date.now();
    // Validate and cap limit to prevent resource exhaustion
    const limit = clampLimit(options.limit ?? 10, MAX_PAGE_SIZE.MESSAGES, 10);

    // Fetch messages for all conversations in a single query
    const messages = await prisma.message.findMany({
      where: { conversation_id: { in: conversationIds } },
      orderBy: { created_at: 'desc' },
    });

    // Group by conversation and limit per conversation
    const grouped = new Map<string, Message[]>();
    const conversationCounts = new Map<string, number>();

    for (const msg of messages) {
      const count = conversationCounts.get(msg.conversation_id) ?? 0;
      if (count < limit) {
        const existing = grouped.get(msg.conversation_id) ?? [];
        existing.push(msg);
        grouped.set(msg.conversation_id, existing);
        conversationCounts.set(msg.conversation_id, count + 1);
      }
    }

    // Ensure all requested conversations have an entry (even if empty)
    for (const id of conversationIds) {
      if (!grouped.has(id)) {
        grouped.set(id, []);
      }
    }

    metrics.histogram('chat.batchGetConversationMessages.duration', Date.now() - startTime, {
      conversations: conversationIds.length.toString(),
    });

    return grouped;
  }
}

// Export singleton instance for global use
export const chatPostgresService = new ChatPostgresService();

export default chatPostgresService;
