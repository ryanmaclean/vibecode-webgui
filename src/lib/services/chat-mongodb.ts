/**
 * Chat Service with MongoDB
 * Handles chat message storage, retrieval, and conversation management
 */

import { Collection, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
// import { logger } from '@/lib/logger';
export interface ChatMessage {
  _id?: ObjectId;
  id?: string;
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
  id?: string;
  workspaceId: string;
  userId: string;
  title?: string;
  messages: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  sessionId?: string;
  model?: string;
}

export interface ChatSession {
  _id?: ObjectId;
  sessionId: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ChatAssistant {
  _id?: ObjectId;
  id?: string;
  name: string;
  description?: string;
  instructions?: string;
  model: string;
  userId: string;
  tools?: any[];
  files?: string[];
  createdAt: Date;
  updatedAt: Date;
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
  private sessionsCollection: Collection<ChatSession> | null = null;
  private assistantsCollection: Collection<ChatAssistant> | null = null;

  /**
   * Initialize the chat service with MongoDB collections
   */
  initialize(
    messagesCollection: Collection<ChatMessage>,
    conversationsCollection: Collection<ChatConversation>,
    sessionsCollection?: Collection<ChatSession>,
    assistantsCollection?: Collection<ChatAssistant>
  ): void {
    this.messagesCollection = messagesCollection;
    this.conversationsCollection = conversationsCollection;
    this.sessionsCollection = sessionsCollection || null;
    this.assistantsCollection = assistantsCollection || null;
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
  async getConversation(conversationId: ObjectId | string): Promise<ChatConversation | null> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    // Support both string and ObjectId
    const id = typeof conversationId === 'string' ? conversationId : conversationId.toString();
    return await this.conversationsCollection.findOne({ id });
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
    titleOrWorkspaceId: string,
    sessionIdOrUserId: string,
    modelOrTitle?: string,
    userId?: string,
    workspaceId?: string
  ): Promise<ObjectId | (ChatConversation & { id: string })> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    // Support both old (3 args) and new (5 args) signatures
    let conversationData: Omit<ChatConversation, '_id'>;

    const id = uuidv4();

    if (userId !== undefined && workspaceId !== undefined) {
      // New signature: (title, sessionId, model, userId, workspaceId)
      conversationData = {
        id,
        title: titleOrWorkspaceId,
        sessionId: sessionIdOrUserId,
        model: modelOrTitle,
        userId,
        workspaceId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      } as any;
    } else {
      // Old signature: (workspaceId, userId, title?)
      conversationData = {
        id,
        workspaceId: titleOrWorkspaceId,
        userId: sessionIdOrUserId,
        title: modelOrTitle,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      } as any;
    }

    const result = await this.conversationsCollection.insertOne(conversationData);

    // If called with new signature, return full conversation with id
    if (userId !== undefined && workspaceId !== undefined) {
      return {
        ...conversationData,
        _id: result.insertedId,
        id
      };
    }

    // Old signature returns just ObjectId
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
  async deleteConversation(conversationId: ObjectId | string): Promise<boolean> {
    if (!this.conversationsCollection || !this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    // Support both string and ObjectId
    const id = typeof conversationId === 'string' ? conversationId : conversationId.toString();

    // Get conversation to find associated messages
    const conversation = await this.conversationsCollection.findOne({ id });
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Delete all messages in the conversation
    if (conversation.messages.length > 0) {
      await this.messagesCollection.deleteMany({
        _id: { $in: conversation.messages.map(msgId => new ObjectId(msgId)) }
      });
    }

    // Delete the conversation
    const result = await this.conversationsCollection.deleteOne({ id });
    if (result.deletedCount === 0) {
      throw new Error('Conversation not found');
    }
    return true;
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
   * Create a new session
   */
  async createSession(
    userId: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<ChatSession> {
    if (!this.sessionsCollection) {
      // If sessions collection is not initialized, return a temporary session
      return {
        sessionId: `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId,
        userAgent,
        ipAddress,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };
    }

    const session: Omit<ChatSession, '_id'> = {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId,
      userAgent,
      ipAddress,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    const result = await this.sessionsCollection.insertOne(session);
    return { ...session, _id: result.insertedId };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    if (!this.sessionsCollection) {
      return null;
    }

    return await this.sessionsCollection.findOne({ sessionId });
  }

  /**
   * Validate session (check if it exists and is not expired)
   */
  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return false;
    }

    // Check if session is expired
    return session.expiresAt > new Date();
  }

  /**
   * Update message content
   */
  async updateMessage(
    conversationId: string,
    messageId: string,
    content: string
  ): Promise<void> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    // Update message in conversation using positional operator
    const result = await this.conversationsCollection.updateOne(
      { id: conversationId, 'messages.id': messageId },
      {
        $set: {
          'messages.$.content': content,
          'messages.$.updatedAt': new Date(),
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error('Conversation or message not found');
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    conversationId: string,
    message: {
      content: string;
      from: 'user' | 'assistant';
      files?: string[];
    }
  ): Promise<{ id: string; content: string; from: string; timestamp: Date }> {
    if (!this.messagesCollection || !this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    // Get the conversation using the id field
    const conversation = await this.conversationsCollection.findOne({ id: conversationId });
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messageId = uuidv4();

    // Create the message document
    const messageDoc: Omit<ChatMessage, '_id'> & { id: string } = {
      id: messageId,
      workspaceId: conversation.workspaceId,
      userId: conversation.userId,
      role: message.from === 'user' ? 'user' : 'assistant',
      content: message.content,
      timestamp: new Date(),
      metadata: message.files ? { files: message.files } : undefined
    } as any;

    const result = await this.messagesCollection.insertOne(messageDoc as any);

    // Add message reference to conversation
    await this.conversationsCollection.updateOne(
      { id: conversationId },
      {
        $push: { messages: result.insertedId },
        $set: { updatedAt: new Date() }
      }
    );

    return {
      id: messageId,
      content: message.content,
      from: message.from,
      timestamp: new Date()
    };
  }

  /**
   * Get conversations by workspace
   */
  async getConversationsByWorkspace(
    workspaceId: string,
    limit: number = 50
  ): Promise<Array<ChatConversation & { id: string }>> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    const conversations = await this.conversationsCollection
      .find({ workspaceId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return conversations.map(conv => ({
      ...conv,
      id: conv.id || conv._id?.toString() || ''
    }));
  }

  /**
   * Get conversations by user
   */
  async getConversationsByUser(
    userId: string,
    limit: number = 50
  ): Promise<Array<ChatConversation & { id: string }>> {
    if (!this.conversationsCollection) {
      throw new Error('Chat service not initialized');
    }

    const conversations = await this.conversationsCollection
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return conversations.map(conv => ({
      ...conv,
      id: conv.id || conv._id?.toString() || ''
    }));
  }

  /**
   * Search conversations
   */
  async searchConversations(
    query: string,
    userId: string,
    workspaceId?: string,
    limit: number = 20
  ): Promise<Array<ChatConversation & { id: string }>> {
    if (!this.conversationsCollection || !this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    // Search in messages first
    const searchCriteria: any = {
      userId,
      content: { $regex: query, $options: 'i' }
    };

    if (workspaceId) {
      searchCriteria.workspaceId = workspaceId;
    }

    const matchingMessages = await this.messagesCollection
      .find(searchCriteria)
      .limit(100)
      .toArray();

    // Get unique conversation IDs from matching messages
    const conversationIds = new Set<string>();

    // Find conversations that contain these messages
    const conversations = await this.conversationsCollection
      .find({
        userId,
        ...(workspaceId ? { workspaceId } : {}),
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { messages: { $in: matchingMessages.map(m => m._id!) } }
        ]
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return conversations.map(conv => ({
      ...conv,
      id: conv._id?.toString() || ''
    }));
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(
    userId: string,
    workspaceId?: string
  ): Promise<{
    totalConversations: number;
    totalMessages: number;
    activeConversations: number;
    averageMessagesPerConversation: number;
  }> {
    if (!this.conversationsCollection || !this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    const matchCriteria: any = { userId };
    if (workspaceId) matchCriteria.workspaceId = workspaceId;

    const totalConversations = await this.conversationsCollection.countDocuments(matchCriteria);
    const activeConversations = await this.conversationsCollection.countDocuments({
      ...matchCriteria,
      isActive: true
    });

    const totalMessages = await this.messagesCollection.countDocuments(matchCriteria);

    return {
      totalConversations,
      totalMessages,
      activeConversations,
      averageMessagesPerConversation: totalConversations > 0 ? totalMessages / totalConversations : 0
    };
  }

  /**
   * Create an assistant
   */
  async createAssistant(
    name: string,
    description: string,
    instructions: string,
    model: string,
    createdBy: string,
    tools?: any[],
    files?: string[]
  ): Promise<ChatAssistant & { id: string; createdBy: string }> {
    if (!this.assistantsCollection) {
      throw new Error('Assistants collection not initialized');
    }

    const id = uuidv4();

    const assistant: Omit<ChatAssistant, '_id'> & { createdBy: string } = {
      id,
      name,
      description,
      instructions,
      model,
      userId: createdBy,
      createdBy,
      tools: tools || [],
      files: files || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.assistantsCollection.insertOne(assistant as any);
    return {
      ...assistant,
      _id: result.insertedId,
      id
    };
  }

  /**
   * Get assistant by ID
   */
  async getAssistant(assistantId: string): Promise<ChatAssistant | null> {
    if (!this.assistantsCollection) {
      throw new Error('Assistants collection not initialized');
    }

    return await this.assistantsCollection.findOne({ id: assistantId });
  }

  /**
   * Get assistants by user
   */
  async getAssistantsByUser(userId: string): Promise<Array<ChatAssistant & { id: string }>> {
    if (!this.assistantsCollection) {
      throw new Error('Assistants collection not initialized');
    }

    const assistants = await this.assistantsCollection
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    return assistants.map(asst => ({
      ...asst,
      id: asst._id?.toString() || ''
    }));
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    if (!this.sessionsCollection) {
      return 0;
    }

    const result = await this.sessionsCollection.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    return result.deletedCount || 0;
  }

  /**
   * Get conversation by ID (with string support)
   */
  async getConversationById(
    conversationId: string
  ): Promise<(Omit<ChatConversation, 'messages'> & { id: string; messages: Array<{ content: string; from: string }> }) | null> {
    if (!this.conversationsCollection || !this.messagesCollection) {
      throw new Error('Chat service not initialized');
    }

    const conversation = await this.conversationsCollection.findOne({
      _id: new ObjectId(conversationId)
    });

    if (!conversation) {
      return null;
    }

    // Fetch the actual message documents
    const messages = await this.messagesCollection
      .find({ _id: { $in: conversation.messages } })
      .sort({ timestamp: 1 })
      .toArray();

    return {
      _id: conversation._id,
      workspaceId: conversation.workspaceId,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      isActive: conversation.isActive,
      sessionId: conversation.sessionId,
      model: conversation.model,
      id: conversation._id?.toString() || '',
      messages: messages.map(msg => ({
        content: msg.content,
        from: msg.role === 'user' ? 'user' : 'assistant'
      }))
    };
  }

  /**
   * Get collections for external access
   */
  getCollections() {
    return {
      messages: this.messagesCollection,
      conversations: this.conversationsCollection,
      sessions: this.sessionsCollection,
      assistants: this.assistantsCollection
    };
  }
}

// Export singleton instance for global use
export const chatMongoDBService = new ChatMongoDBService();
export const mongodbChatService = chatMongoDBService;

export default chatMongoDBService;
