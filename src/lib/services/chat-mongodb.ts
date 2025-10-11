import { Collection } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../mongodb'
import { Conversation, Message, ChatSession, Assistant } from '../models/chat'
import { logger } from '../monitoring'

interface ChatStats {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  modelsUsed: string[];
}

export class MongoDBChatService {
  private conversationsCollection?: Collection<Conversation>
  private sessionsCollection?: Collection<ChatSession>
  private assistantsCollection?: Collection<Assistant>

  private async getConversationsCollection(): Promise<Collection<Conversation>> {
    if (!this.conversationsCollection) {
      const db = await getDatabase()
      this.conversationsCollection = db.collection<Conversation>('conversations')
      
      // Ensure indexes exist
      await this.conversationsCollection.createIndex({ sessionId: 1 })
      await this.conversationsCollection.createIndex({ userId: 1 })
      await this.conversationsCollection.createIndex({ workspaceId: 1 })
      await this.conversationsCollection.createIndex({ createdAt: -1 })
      await this.conversationsCollection.createIndex({ updatedAt: -1 })
    }
    return this.conversationsCollection
  }

  private async getSessionsCollection(): Promise<Collection<ChatSession>> {
    if (!this.sessionsCollection) {
      const db = await getDatabase()
      this.sessionsCollection = db.collection<ChatSession>('sessions')
      
      // Ensure indexes exist
      await this.sessionsCollection.createIndex({ sessionId: 1 }, { unique: true })
      await this.sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    }
    return this.sessionsCollection
  }

  private async getAssistantsCollection(): Promise<Collection<Assistant>> {
    if (!this.assistantsCollection) {
      const db = await getDatabase()
      this.assistantsCollection = db.collection<Assistant>('assistants')
      
      // Ensure indexes exist
      await this.assistantsCollection.createIndex({ createdBy: 1 })
      await this.assistantsCollection.createIndex({ name: 1 })
    }
    return this.assistantsCollection
  }

  // Session Management
  async createSession(userId: string, userAgent?: string, ip?: string): Promise<ChatSession> {
    const sessions = await this.getSessionsCollection()
    
    const session: ChatSession = {
      sessionId: uuidv4(),
      userId,
      userAgent,
      ip,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }

    try {
      const result = await sessions.insertOne(session)
      session._id = result.insertedId
      
      // Debug log removed
      
      return session
    } catch (error) {
      console.error('Failed to create chat session:', error, userId)
      throw error
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    const sessions = await this.getSessionsCollection()
    return await sessions.findOne({ sessionId })
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId)
    return session ? session.expiresAt > new Date() : false
  }

  // Conversation Management  
  async createConversation(
    title: string,
    sessionId: string,
    model: string,
    userId: string,
    workspaceId: string
  ): Promise<Conversation> {
    const conversations = await this.getConversationsCollection()
    
    const conversation: Conversation = {
      id: uuidv4(),
      title,
      sessionId,
      model,
      userId,
      workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: []
    }

    try {
      const result = await conversations.insertOne(conversation)
      conversation._id = result.insertedId
      
      // Debug log removed
      
      return conversation
    } catch (error) {
      console.error('Failed to create conversation:', error, userId)
      throw error
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const conversations = await this.getConversationsCollection()
    return await conversations.findOne({ id: conversationId })
  }

  async getConversationsByWorkspace(workspaceId: string, limit = 50): Promise<Conversation[]> {
    const conversations = await this.getConversationsCollection()
    return await conversations
      .find({ workspaceId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray()
  }

  async getConversationsByUser(userId: string, limit = 50): Promise<Conversation[]> {
    const conversations = await this.getConversationsCollection()
    return await conversations
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray()
  }

  async addMessage(conversationId: string, message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const conversations = await this.getConversationsCollection()
    
    const newMessage: Message = {
      id: uuidv4(),
      ...message,
      createdAt: new Date()
    }

    try {
      const result = await conversations.updateOne(
        { id: conversationId },
        {
          $push: { messages: newMessage },
          $set: { updatedAt: new Date() }
        }
      )

      if (result.matchedCount === 0) {
        throw new Error('Conversation not found')
      }

      // Debug log removed

      return newMessage
    } catch (error) {
      console.error('Failed to add message:', error, conversationId)
      throw error
    }
  }

  async updateMessage(conversationId: string, messageId: string, content: string): Promise<void> {
    const conversations = await this.getConversationsCollection()
    
    try {
      const result = await conversations.updateOne(
        { id: conversationId, 'messages.id': messageId },
        {
          $set: { 
            'messages.$.content': content,
            'messages.$.updatedAt': new Date(),
            updatedAt: new Date()
          }
        }
      )

      if (result.matchedCount === 0) {
        throw new Error('Conversation or message not found')
      }

      logger.info('Message updated', {
        service: 'mongodb-chat',
        conversationId,
        messageId
      })
    } catch (error) {
      logger.error('Failed to update message', {
        service: 'mongodb-chat',
        error: error instanceof Error ? error.message : String(error),
        conversationId,
        messageId
      })
      throw error
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversations = await this.getConversationsCollection()
    
    try {
      const result = await conversations.deleteOne({ id: conversationId })
      
      if (result.deletedCount === 0) {
        throw new Error('Conversation not found')
      }

      logger.info('Conversation deleted', {
        service: 'mongodb-chat',
        conversationId
      })
    } catch (error) {
      logger.error('Failed to delete conversation', {
        service: 'mongodb-chat',
        error: error instanceof Error ? error.message : String(error),
        conversationId
      })
      throw error
    }
  }

  // Assistant Management
  async createAssistant(
    name: string,
    description: string,
    instructions: string,
    model: string,
    createdBy: string,
    tools?: string[],
    files?: string[]
  ): Promise<Assistant> {
    const assistants = await this.getAssistantsCollection()
    
    const assistant: Assistant = {
      id: uuidv4(),
      name,
      description,
      instructions,
      model,
      tools: tools || [],
      files: files || [],
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    try {
      const result = await assistants.insertOne(assistant)
      assistant._id = result.insertedId
      
      logger.info('Assistant created', {
        service: 'mongodb-chat',
        assistantId: assistant.id,
        createdBy
      })
      
      return assistant
    } catch (error) {
      logger.error('Failed to create assistant', {
        service: 'mongodb-chat',
        error: error instanceof Error ? error.message : String(error),
        createdBy
      })
      throw error
    }
  }

  async getAssistantsByUser(userId: string): Promise<Assistant[]> {
    const assistants = await this.getAssistantsCollection()
    return await assistants
      .find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .toArray()
  }

  async getAssistant(assistantId: string): Promise<Assistant | null> {
    const assistants = await this.getAssistantsCollection()
    return await assistants.findOne({ id: assistantId })
  }

  // Search and Analytics
  async searchConversations(
    query: string,
    userId: string,
    workspaceId?: string,
    limit = 20
  ): Promise<Conversation[]> {
    const conversations = await this.getConversationsCollection()
    
    const searchCriteria: Record<string, unknown> = {
      userId,
      $text: { $search: query }
    }
    
    if (workspaceId) {
      searchCriteria.workspaceId = workspaceId
    }

    return await conversations
      .find(searchCriteria)
      .sort({ score: { $meta: 'textScore' } })
      .limit(limit)
      .toArray()
  }

  async getConversationStats(userId: string, workspaceId?: string): Promise<{
    totalConversations: number
    totalMessages: number
    averageMessagesPerConversation: number
    modelsUsed: string[]
  }> {
    const conversations = await this.getConversationsCollection()
    
    const matchCriteria: Record<string, unknown> = { userId }
    if (workspaceId) {
      matchCriteria.workspaceId = workspaceId
    }

    const stats = await conversations.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          totalMessages: { $sum: { $size: '$messages' } },
          modelsUsed: { $addToSet: '$model' }
        }
      },
      {
        $addFields: {
          averageMessagesPerConversation: {
            $cond: {
              if: { $eq: ['$totalConversations', 0] },
              then: 0,
              else: { $divide: ['$totalMessages', '$totalConversations'] }
            }
          }
        }
      }
    ]).toArray()

    return (stats[0] as ChatStats) || {
      totalConversations: 0,
      totalMessages: 0,
      averageMessagesPerConversation: 0,
      modelsUsed: []
    }
  }

  // Cleanup operations
  async cleanupExpiredSessions(): Promise<number> {
    const sessions = await this.getSessionsCollection()
    const result = await sessions.deleteMany({
      expiresAt: { $lt: new Date() }
    })
    
    logger.info('Expired sessions cleaned up', {
      service: 'mongodb-chat',
      deletedCount: result.deletedCount
    })
    
    return result.deletedCount
  }
}

// Export singleton instance
export const mongodbChatService = new MongoDBChatService()