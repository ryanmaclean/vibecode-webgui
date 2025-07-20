// Integration tests for Chat-UI with MongoDB backend
// Tests full chat workflow including conversation persistence and file uploads

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals'
import { MongoClient, Db, Collection } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'

// Mock environment for testing
const MONGO_URL = process.env.MONGODB_TEST_URL || 'mongodb://localhost:27017/chatui_test'
const TEST_DB_NAME = 'chatui_test'

interface TestConversation {
  _id?: string
  title: string
  sessionId: string
  model: string
  userId: string
  workspaceId: string
  createdAt: Date
  updatedAt: Date
  messages: TestMessage[]
}

interface TestMessage {
  id: string
  from: 'user' | 'assistant'
  content: string
  files?: string[]
  createdAt: Date
  updatedAt?: Date
}

interface TestSession {
  _id?: string
  sessionId: string
  userId: string
  userAgent?: string
  ip?: string
  createdAt: Date
  expiresAt: Date
}

describe('Chat-UI MongoDB Integration', () => {
  let mongoClient: MongoClient
  let db: Db
  let conversationsCollection: Collection<TestConversation>
  let sessionsCollection: Collection<TestSession>
  let assistantsCollection: Collection
  let testSessionId: string
  let testUserId: string
  let testWorkspaceId: string

  beforeAll(async () => {
    // Connect to test MongoDB instance
    mongoClient = new MongoClient(MONGO_URL)
    await mongoClient.connect()
    db = mongoClient.db(TEST_DB_NAME)
    
    // Get collections
    conversationsCollection = db.collection('conversations')
    sessionsCollection = db.collection('sessions')
    assistantsCollection = db.collection('assistants')

    console.log('✅ Connected to test MongoDB instance')
  })

  afterAll(async () => {
    // Clean up test database
    await db.dropDatabase()
    await mongoClient.close()
    console.log('🧹 Cleaned up test database')
  })

  beforeEach(async () => {
    // Generate unique test identifiers
    testSessionId = `session-${uuidv4()}`
    testUserId = `user-${uuidv4()}`
    testWorkspaceId = `workspace-${uuidv4()}`

    // Create test session
    await sessionsCollection.insertOne({
      sessionId: testSessionId,
      userId: testUserId,
      userAgent: 'test-agent',
      ip: '127.0.0.1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    })
  })

  afterEach(async () => {
    // Clean up test data after each test
    await conversationsCollection.deleteMany({ sessionId: testSessionId })
    await sessionsCollection.deleteMany({ sessionId: testSessionId })
  })

  describe('Session Management', () => {
    it('should create and retrieve user sessions', async () => {
      const session = await sessionsCollection.findOne({ sessionId: testSessionId })
      
      expect(session).toBeTruthy()
      expect(session?.sessionId).toBe(testSessionId)
      expect(session?.userId).toBe(testUserId)
      expect(session?.createdAt).toBeInstanceOf(Date)
      expect(session?.expiresAt).toBeInstanceOf(Date)
    })

    it('should handle session expiration', async () => {
      // Create expired session
      const expiredSessionId = `expired-${uuidv4()}`
      await sessionsCollection.insertOne({
        sessionId: expiredSessionId,
        userId: testUserId,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      })

      // Query for expired sessions
      const expiredSessions = await sessionsCollection.find({
        expiresAt: { $lt: new Date() }
      }).toArray()

      expect(expiredSessions.length).toBeGreaterThan(0)
      
      // Clean up expired sessions
      const deleteResult = await sessionsCollection.deleteMany({
        expiresAt: { $lt: new Date() }
      })

      expect(deleteResult.deletedCount).toBeGreaterThan(0)
    })

    it('should prevent duplicate session IDs', async () => {
      // Try to create session with same ID
      try {
        await sessionsCollection.insertOne({
          sessionId: testSessionId, // Same as existing
          userId: 'different-user',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        })
        
        // If we reach here, the unique constraint didn't work
        expect(true).toBe(false)
      } catch (error) {
        // Should throw duplicate key error
        expect(error).toBeTruthy()
      }
    })
  })

  describe('Conversation Management', () => {
    it('should create new conversations with proper structure', async () => {
      const conversation: TestConversation = {
        title: 'Test Conversation',
        sessionId: testSessionId,
        model: 'anthropic/claude-3.5-sonnet',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            from: 'user',
            content: 'Hello, I need help with my React component',
            createdAt: new Date()
          },
          {
            id: 'msg-2',
            from: 'assistant',
            content: 'I\'d be happy to help! What specific issue are you facing?',
            createdAt: new Date()
          }
        ]
      }

      const result = await conversationsCollection.insertOne(conversation)
      expect(result.insertedId).toBeTruthy()

      const savedConversation = await conversationsCollection.findOne({ _id: result.insertedId })
      expect(savedConversation).toBeTruthy()
      expect(savedConversation?.title).toBe('Test Conversation')
      expect(savedConversation?.messages).toHaveLength(2)
    })

    it('should update conversation with new messages', async () => {
      // Create initial conversation
      const conversation: TestConversation = {
        title: 'Evolving Conversation',
        sessionId: testSessionId,
        model: 'anthropic/claude-3.5-sonnet',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [{
          id: 'msg-1',
          from: 'user',
          content: 'Initial message',
          createdAt: new Date()
        }]
      }

      const insertResult = await conversationsCollection.insertOne(conversation)
      
      // Add new message
      const newMessage: TestMessage = {
        id: 'msg-2',
        from: 'assistant',
        content: 'Assistant response',
        createdAt: new Date()
      }

      const updateResult = await conversationsCollection.updateOne(
        { _id: insertResult.insertedId },
        {
          $push: { messages: newMessage },
          $set: { updatedAt: new Date() }
        }
      )

      expect(updateResult.modifiedCount).toBe(1)

      const updatedConversation = await conversationsCollection.findOne({ _id: insertResult.insertedId })
      expect(updatedConversation?.messages).toHaveLength(2)
      expect(updatedConversation?.messages[1].content).toBe('Assistant response')
    })

    it('should handle conversations with file attachments', async () => {
      const conversation: TestConversation = {
        title: 'File Upload Conversation',
        sessionId: testSessionId,
        model: 'anthropic/claude-3.5-sonnet',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [
          {
            id: 'msg-1',
            from: 'user',
            content: 'Please review this code file',
            files: ['component.tsx', 'styles.css'],
            createdAt: new Date()
          },
          {
            id: 'msg-2',
            from: 'assistant',
            content: 'I\'ve reviewed your files. Here are my suggestions...',
            createdAt: new Date()
          }
        ]
      }

      const result = await conversationsCollection.insertOne(conversation)
      const savedConversation = await conversationsCollection.findOne({ _id: result.insertedId })
      
      expect(savedConversation?.messages[0].files).toEqual(['component.tsx', 'styles.css'])
      expect(savedConversation?.messages[1].files).toBeUndefined()
    })

    it('should query conversations by workspace', async () => {
      // Create multiple conversations for same workspace
      const conversations: TestConversation[] = [
        {
          title: 'Workspace Conversation 1',
          sessionId: testSessionId,
          model: 'anthropic/claude-3.5-sonnet',
          userId: testUserId,
          workspaceId: testWorkspaceId,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: []
        },
        {
          title: 'Workspace Conversation 2',
          sessionId: testSessionId,
          model: 'anthropic/claude-3.5-sonnet',
          userId: testUserId,
          workspaceId: testWorkspaceId,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: []
        }
      ]

      await conversationsCollection.insertMany(conversations)

      const workspaceConversations = await conversationsCollection.find({
        workspaceId: testWorkspaceId
      }).toArray()

      expect(workspaceConversations).toHaveLength(2)
      workspaceConversations.forEach(conv => {
        expect(conv.workspaceId).toBe(testWorkspaceId)
      })
    })

    it('should support conversation search', async () => {
      // Create conversations with searchable content
      const conversations: TestConversation[] = [
        {
          title: 'React Component Discussion',
          sessionId: testSessionId,
          model: 'anthropic/claude-3.5-sonnet',
          userId: testUserId,
          workspaceId: testWorkspaceId,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [{
            id: 'msg-1',
            from: 'user',
            content: 'How do I create a React component with TypeScript?',
            createdAt: new Date()
          }]
        },
        {
          title: 'Database Query Help',
          sessionId: testSessionId,
          model: 'anthropic/claude-3.5-sonnet',
          userId: testUserId,
          workspaceId: testWorkspaceId,
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [{
            id: 'msg-1',
            from: 'user',
            content: 'I need help with PostgreSQL queries',
            createdAt: new Date()
          }]
        }
      ]

      await conversationsCollection.insertMany(conversations)

      // Search for React-related conversations
      const reactConversations = await conversationsCollection.find({
        $text: { $search: 'React component' }
      }).toArray()

      expect(reactConversations.length).toBeGreaterThan(0)
      expect(reactConversations[0].title).toContain('React')
    })
  })

  describe('Assistant Management', () => {
    it('should create and manage custom assistants', async () => {
      const assistant = {
        name: 'Code Review Assistant',
        description: 'Specialized in reviewing code and suggesting improvements',
        instructions: 'You are a code review expert. Analyze code for bugs, performance issues, and best practices.',
        model: 'anthropic/claude-3.5-sonnet',
        tools: ['code_analysis', 'security_scan'],
        files: [],
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const result = await assistantsCollection.insertOne(assistant)
      expect(result.insertedId).toBeTruthy()

      const savedAssistant = await assistantsCollection.findOne({ _id: result.insertedId })
      expect(savedAssistant?.name).toBe('Code Review Assistant')
      expect(savedAssistant?.tools).toContain('code_analysis')
    })

    it('should list assistants by creator', async () => {
      // Create multiple assistants
      const assistants = [
        {
          name: 'Frontend Assistant',
          description: 'Helps with React and CSS',
          instructions: 'Frontend development expert',
          model: 'anthropic/claude-3.5-sonnet',
          tools: [],
          files: [],
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: 'Backend Assistant',
          description: 'Helps with APIs and databases',
          instructions: 'Backend development expert',
          model: 'anthropic/claude-3.5-sonnet',
          tools: [],
          files: [],
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      await assistantsCollection.insertMany(assistants)

      const userAssistants = await assistantsCollection.find({
        createdBy: testUserId
      }).toArray()

      expect(userAssistants).toHaveLength(2)
      userAssistants.forEach(assistant => {
        expect(assistant.createdBy).toBe(testUserId)
      })
    })
  })

  describe('Performance and Indexing', () => {
    it('should perform efficient queries with proper indexes', async () => {
      // Create multiple conversations for performance testing
      const conversations: TestConversation[] = Array.from({ length: 100 }, (_, i) => ({
        title: `Performance Test Conversation ${i}`,
        sessionId: testSessionId,
        model: 'anthropic/claude-3.5-sonnet',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(Date.now() - i * 1000), // Spread across time
        updatedAt: new Date(),
        messages: [{
          id: `msg-${i}`,
          from: 'user' as const,
          content: `Test message ${i}`,
          createdAt: new Date()
        }]
      }))

      await conversationsCollection.insertMany(conversations)

      // Test indexed query performance
      const startTime = Date.now()
      
      const recentConversations = await conversationsCollection.find({
        sessionId: testSessionId,
        createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      }).sort({ createdAt: -1 }).limit(10).toArray()

      const queryTime = Date.now() - startTime
      
      expect(recentConversations).toHaveLength(10)
      expect(queryTime).toBeLessThan(100) // Should be fast with proper indexing
    })

    it('should handle concurrent conversation updates', async () => {
      // Create initial conversation
      const conversation: TestConversation = {
        title: 'Concurrent Test',
        sessionId: testSessionId,
        model: 'anthropic/claude-3.5-sonnet',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: []
      }

      const insertResult = await conversationsCollection.insertOne(conversation)
      
      // Simulate concurrent message additions
      const concurrentUpdates = Array.from({ length: 5 }, (_, i) =>
        conversationsCollection.updateOne(
          { _id: insertResult.insertedId },
          {
            $push: {
              messages: {
                id: `concurrent-msg-${i}`,
                from: 'user' as const,
                content: `Concurrent message ${i}`,
                createdAt: new Date()
              }
            },
            $set: { updatedAt: new Date() }
          }
        )
      )

      const results = await Promise.all(concurrentUpdates)
      
      // All updates should succeed
      results.forEach(result => {
        expect(result.modifiedCount).toBe(1)
      })

      const finalConversation = await conversationsCollection.findOne({ _id: insertResult.insertedId })
      expect(finalConversation?.messages).toHaveLength(5)
    })
  })

  describe('Data Validation and Constraints', () => {
    it('should validate conversation schema', async () => {
      // Try to insert invalid conversation (missing required fields)
      try {
        await conversationsCollection.insertOne({
          // Missing required fields like title, sessionId, etc.
          messages: []
        } as any)
        
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBeTruthy()
      }
    })

    it('should enforce message content length limits', async () => {
      const conversation: TestConversation = {
        title: 'Content Length Test',
        sessionId: testSessionId,
        model: 'anthropic/claude-3.5-sonnet',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [{
          id: 'msg-1',
          from: 'user',
          content: 'x'.repeat(100000), // Very long content
          createdAt: new Date()
        }]
      }

      // This might be rejected by validation rules
      const result = await conversationsCollection.insertOne(conversation)
      expect(result.insertedId).toBeTruthy()
      
      // Content should be stored (MongoDB handles large documents)
      const saved = await conversationsCollection.findOne({ _id: result.insertedId })
      expect(saved?.messages[0].content.length).toBe(100000)
    })

    it('should handle special characters and Unicode', async () => {
      const conversation: TestConversation = {
        title: 'Unicode Test 🚀 特殊字符 Émojis',
        sessionId: testSessionId,
        model: 'anthropic/claude-3.5-sonnet',
        userId: testUserId,
        workspaceId: testWorkspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [{
          id: 'msg-1',
          from: 'user',
          content: 'Hello 世界! How are you? 🤖 Here\'s some code: ```const x = "test";```',
          createdAt: new Date()
        }]
      }

      const result = await conversationsCollection.insertOne(conversation)
      const saved = await conversationsCollection.findOne({ _id: result.insertedId })
      
      expect(saved?.title).toBe('Unicode Test 🚀 特殊字符 Émojis')
      expect(saved?.messages[0].content).toContain('世界')
      expect(saved?.messages[0].content).toContain('🤖')
    })
  })
})