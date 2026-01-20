/**
 * Chat Service with PostgreSQL (Prisma)
 * Handles chat message storage, retrieval, and conversation management
 * using PostgreSQL as the persistence layer
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import type { Prisma, Conversation, Message, ChatSession } from '@prisma/client';

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
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    return await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
  }

  /**
   * Get conversation with messages
   */
  async getConversationWithMessages(
    conversationId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<(Conversation & { messages: Message[] }) | null> {
    const { limit = 100, offset = 0 } = options;

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
   * Update conversation
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

    return await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });
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
   * Get conversations for a user
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
    const { workspaceId, status = 'ACTIVE', limit = 50, offset = 0 } = options;

    const where: Prisma.ConversationWhereInput = {
      user_id: userId,
      status,
    };

    if (workspaceId) {
      where.workspace_id = workspaceId;
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
      limit = 20,
      offset = 0,
    } = options;

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
   * Add a message to a conversation
   */
  async addMessage(input: ChatMessageInput): Promise<Message> {
    const message = await prisma.message.create({
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

    // Update conversation message count and tokens
    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: {
        message_count: { increment: 1 },
        total_tokens: input.tokens
          ? { increment: input.tokens }
          : undefined,
        updated_at: new Date(),
      },
    });

    return message;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    options: { limit?: number; offset?: number; before?: Date; after?: Date } = {}
  ): Promise<Message[]> {
    const { limit = 100, offset = 0, before, after } = options;

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
   * Delete message
   */
  async deleteMessage(messageId: string): Promise<void> {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (message) {
      await prisma.message.delete({
        where: { id: messageId },
      });

      // Update conversation message count
      await prisma.conversation.update({
        where: { id: message.conversation_id },
        data: {
          message_count: { decrement: 1 },
          total_tokens: message.tokens
            ? { decrement: message.tokens }
            : undefined,
        },
      });
    }
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
      limit = 50,
      offset = 0,
    } = options;

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
    limit = 50
  ): Promise<Conversation[]> {
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
}

// Export singleton instance for global use
export const chatPostgresService = new ChatPostgresService();

export default chatPostgresService;
