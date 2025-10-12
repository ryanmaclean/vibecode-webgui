/**
 * Chat Service with MongoDB
 * Handles chat message storage, retrieval, and conversation management
 */

import { Collection, ObjectId } from 'mongodb';

export interface ChatMessage {
  _id?: ObjectId;
  workspaceId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    confidence?: number;
    functionCalls?: any[];
    [key: string]: any;
  };
}

export interface ChatConversation {
  _id?: ObjectId;
  workspaceId: string;
  userId: string;
  title?: string;
  messages: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface ChatStats {
  totalMessages: number;
  totalConversations: number;
  averageMessagesPerConversation: number;
  mostActiveUser: string;
  messagesByRole: {
    user: number;
    assistant: number;
    system: number;
  };
  averageResponseTime: number;
}

export interface ChatSearchOptions {
  workspaceId?: string;
  userId?: string;
  role?: 'user' | 'assistant' | 'system';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  searchTerm?: string;
}

/**
 * Chat Service for MongoDB-based chat functionality
 */
export class ChatMongoDBService {
  private messagesCollection: Collection<ChatMessage> | null = null;
  private conversationsCollection: Collection<ChatConversation> | null = null;

  /**
   * Initialize the chat service with MongoDB collections
   */
  initialize(
    messagesCollection: Collection<ChatMessage>,
    conversationsCollection: Collection<ChatConversation>
  ): void {
    this.messagesCollection = messagesCollection;
    this.conversationsCollection = conversationsCollection;
  }

  /**
   * Save a chat message
   */
  async saveMessage(message: Omit<ChatMessage, '_id'>): Promise<ObjectId> {
    if (!this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    const messageDoc: ChatMessage = {
      ...message,
      timestamp: new Date()
    };

    const result = await this.messagesCollection.insertOne(messageDoc);

    // Update conversation if it exists
    await this.updateConversation(message.workspaceId, result.insertedId);

    return result.insertedId;
  }

  /**
   * Get messages for a workspace
   */
  async getWorkspaceMessages(
    workspaceId: string,
    options: {
      limit?: number;
      offset?: number;
      before?: Date;
      after?: Date;
    } = {}
  ): Promise<ChatMessage[]> {
    if (!this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    const { limit = 50, offset = 0, before, after } = options;

    const query: any = { workspaceId };

    if (before || after) {
      query.timestamp = {};
      if (after) query.timestamp.$gte = after;
      if (before) query.timestamp.$lte = before;
    }

    const messages = await this.messagesCollection
      .find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return messages.reverse(); // Return in chronological order
  }

  /**
   * Search messages across workspaces
   */
  async searchMessages(options: ChatSearchOptions): Promise<{
    messages: ChatMessage[];
    total: number;
  }> {
    if (!this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    const {
      workspaceId,
      userId,
      role,
      startDate,
      endDate,
      limit = 20,
      offset = 0,
      searchTerm
    } = options;

    const searchCriteria: any = {};

    if (workspaceId) searchCriteria.workspaceId = workspaceId;
    if (userId) searchCriteria.userId = userId;
    if (role) searchCriteria.role = role;

    if (startDate || endDate) {
      searchCriteria.timestamp = {};
      if (startDate) searchCriteria.timestamp.$gte = startDate;
      if (endDate) searchCriteria.timestamp.$lte = endDate;
    }

    // Text search in message content
    if (searchTerm) {
      searchCriteria.$text = { $search: searchTerm };
    }

    const total = await this.messagesCollection.countDocuments(searchCriteria);

    const messages = await this.messagesCollection
      .find(searchCriteria)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return {
      messages: messages.reverse(),
      total
    };
  }

  /**
   * Delete messages by ID
   */
  async deleteMessages(messageIds: ObjectId[]): Promise<number> {
    if (!this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    const result = await this.messagesCollection.deleteMany({
      _id: { $in: messageIds }
    });

    return result.deletedCount || 0;
  }

  /**
   * Clear all messages for a workspace
   */
  async clearWorkspaceMessages(workspaceId: string): Promise<number> {
    if (!this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    const result = await this.messagesCollection.deleteMany({ workspaceId });
    return result.deletedCount || 0;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: ObjectId): Promise<ChatConversation | null> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    return await this.conversationsCollection.findOne({ _id: conversationId });
  }

  /**
   * Get conversations for a workspace
   */
  async getWorkspaceConversations(workspaceId: string): Promise<ChatConversation[]> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    return await this.conversationsCollection
      .find({ workspaceId })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    workspaceId: string,
    userId: string,
    title?: string
  ): Promise<ObjectId> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    const conversation: Omit<ChatConversation, '_id'> = {
      workspaceId,
      userId,
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    const result = await this.conversationsCollection.insertOne(conversation);
    return result.insertedId;
  }

  /**
   * Update conversation with new message
   */
  private async updateConversation(workspaceId: string, messageId: ObjectId): Promise<void> {
    if (!this.conversationsCollection) return;

    // Find the most recent active conversation for this workspace
    const conversation = await this.conversationsCollection.findOne(
      { workspaceId, isActive: true },
      { sort: { updatedAt: -1 } }
    );

    if (conversation) {
      // Add message to existing conversation
      await this.conversationsCollection.updateOne(
        { _id: conversation._id },
        {
          $push: { messages: messageId },
          $set: { updatedAt: new Date() }
        }
      );
    } else {
      // Create new conversation
      await this.createConversation(workspaceId, 'system');
      // Then add the message (simplified for this example)
    }
  }

  /**
   * Get chat statistics
   */
  async getChatStats(workspaceId?: string): Promise<ChatStats> {
    if (!this.messagesCollection || !this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    const matchCriteria: any = {};
    if (workspaceId) matchCriteria.workspaceId = workspaceId;

    // Get message statistics
    const messageStats = await this.messagesCollection.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          userMessages: { $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] } },
          assistantMessages: { $sum: { $cond: [{ $eq: ['$role', 'assistant'] }, 1, 0] } },
          systemMessages: { $sum: { $cond: [{ $eq: ['$role', 'system'] }, 1, 0] } }
        }
      }
    ]).toArray();

    // Get conversation statistics
    const conversationStats = await this.conversationsCollection.aggregate([
      { $match: workspaceId ? { workspaceId } : {} },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          avgMessagesPerConversation: { $avg: { $size: '$messages' } }
        }
      }
    ]).toArray();

    const stats = messageStats[0] || { totalMessages: 0, userMessages: 0, assistantMessages: 0, systemMessages: 0 };
    const convStats = conversationStats[0] || { totalConversations: 0, avgMessagesPerConversation: 0 };

    return {
      totalMessages: stats.totalMessages,
      totalConversations: convStats.totalConversations,
      averageMessagesPerConversation: convStats.avgMessagesPerConversation || 0,
      mostActiveUser: 'system', // Would need more complex aggregation
      messagesByRole: {
        user: stats.userMessages,
        assistant: stats.assistantMessages,
        system: stats.systemMessages
      },
      averageResponseTime: 0 // Would need timing data
    };
  }

  /**
   * Export conversation data
   */
  async exportConversationData(
    workspaceId: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const messages = await this.getWorkspaceMessages(workspaceId);

    if (format === 'json') {
      return JSON.stringify({
        workspaceId,
        exportDate: new Date().toISOString(),
        messages,
        count: messages.length
      }, null, 2);
    } else {
      // CSV format
      const headers = ['timestamp', 'userId', 'role', 'content'];
      const csvRows = [
        headers.join(','),
        ...messages.map(msg => [
          msg.timestamp.toISOString(),
          msg.userId,
          msg.role,
          `"${msg.content.replace(/"/g, '""')}"`
        ].join(','))
      ];

      return csvRows.join('\n');
    }
  }

  /**
   * Archive old conversations
   */
  async archiveOldConversations(daysOld: number = 30): Promise<number> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.conversationsCollection.updateMany(
      {
        updatedAt: { $lt: cutoffDate },
        isActive: true
      },
      {
        $set: {
          isActive: false,
          archivedAt: new Date()
        }
      }
    );

    return result.modifiedCount || 0;
  }

  /**
   * Clean up orphaned messages (messages not in any conversation)
   */
  async cleanupOrphanedMessages(): Promise<number> {
    if (!this.messagesCollection || !this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    // Get all message IDs that are referenced in conversations
    const referencedMessageIds = await this.conversationsCollection.distinct('messages');

    // Delete messages that are not referenced
    const result = await this.messagesCollection.deleteMany({
      _id: { $nin: referencedMessageIds.map(id => new ObjectId(id)) }
    });

    return result.deletedCount || 0;
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId: ObjectId): Promise<ChatMessage | null> {
    if (!this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    return await this.messagesCollection.findOne({ _id: messageId });
  }

  /**
   * Update message metadata
   */
  async updateMessageMetadata(
    messageId: ObjectId,
    metadata: Partial<ChatMessage['metadata']>
  ): Promise<boolean> {
    if (!this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    const result = await this.messagesCollection.updateOne(
      { _id: messageId },
      {
        $set: {
          metadata: { ...metadata },
          timestamp: new Date() // Update timestamp for modified messages
        }
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Get conversations for a user
   */
  async getUserConversations(userId: string): Promise<ChatConversation[]> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    return await this.conversationsCollection
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * Delete conversation and all its messages
   */
  async deleteConversation(conversationId: ObjectId): Promise<boolean> {
    if (!this.conversationsCollection || !this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    // Get conversation to find associated messages
    const conversation = await this.conversationsCollection.findOne({ _id: conversationId });
    if (!conversation) {
      return false;
    }

    // Delete all messages in the conversation
    if (conversation.messages.length > 0) {
      await this.messagesCollection.deleteMany({
        _id: { $in: conversation.messages.map(id => new ObjectId(id)) }
      });
    }

    // Delete the conversation
    const result = await this.conversationsCollection.deleteOne({ _id: conversationId });
    return result.deletedCount > 0;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    messageCount: number;
    conversationCount: number;
    lastActivity: Date | null;
  }> {
    if (!this.messagesCollection || !this.conversationsCollection) {
      return {
        isHealthy: false,
        messageCount: 0,
        conversationCount: 0,
        lastActivity: null
      };
    }

    try {
      const messageCount = await this.messagesCollection.countDocuments();
      const conversationCount = await this.conversationsCollection.countDocuments();

      // Get last activity
      const lastMessage = await this.messagesCollection.findOne(
        {},
        { sort: { timestamp: -1 } }
      );

      return {
        isHealthy: true,
        messageCount,
        conversationCount,
        lastActivity: lastMessage?.timestamp || null
      };
    } catch (error) {
      console.error('Failed to get chat service health:', error);
      return {
        isHealthy: false,
        messageCount: 0,
        conversationCount: 0,
        lastActivity: null
      };
    }
  }

  /**
   * Get collections for external access
   */
  getCollections() {
    return {
      messages: this.messagesCollection,
      conversations: this.conversationsCollection
    };
  }
}

// Export singleton instance for global use
export const chatMongoDBService = new ChatMongoDBService();
