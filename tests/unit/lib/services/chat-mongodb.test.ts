// Mock uuid before importing the service
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

// Mock MongoDB ObjectId
jest.mock('mongodb', () => ({
<<<<<<< HEAD
  ObjectId: class MockObjectId {
    private _id: string;

    constructor(id?: string) {
      this._id = id || Math.random().toString(36).substring(7);
    }

    toString() {
      return this._id;
    }

    toHexString() {
      return this._id;
    }
  }
=======
  ObjectId: jest.fn((id?: string) => id || 'mock-object-id')
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
}));

import { ChatMongoDBService } from '@/lib/services/chat-mongodb';
import { v4 as uuidv4 } from 'uuid';
<<<<<<< HEAD
import { getDatabase } from '@/lib/mongodb';

// Mock external dependencies
jest.mock('@/lib/mongodb', () => ({
  getDatabase: jest.fn()
}));

jest.mock('@/lib/monitoring', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));
=======
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)

describe('ChatMongoDBService', () => {
  let service: ChatMongoDBService;
  let mockDb: any;
  let mockConversationsCollection: any;
  let mockSessionsCollection: any;
  let mockAssistantsCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset uuid mock
    (uuidv4 as jest.Mock).mockReturnValue('test-uuid-123');

    // Setup mock collections
    const mockMessagesCollection = {
      createIndex: jest.fn(),
      insertOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      countDocuments: jest.fn(),
      distinct: jest.fn(),
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
      toArray: jest.fn()
    };

    mockConversationsCollection = {
      createIndex: jest.fn(),
      insertOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      countDocuments: jest.fn(),
<<<<<<< HEAD
      distinct: jest.fn(),
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      }),
=======
      aggregate: jest.fn(),
      distinct: jest.fn(),
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
      toArray: jest.fn()
    };

    mockSessionsCollection = {
      createIndex: jest.fn(),
      insertOne: jest.fn(),
      findOne: jest.fn(),
      deleteMany: jest.fn()
    };

    mockAssistantsCollection = {
      createIndex: jest.fn(),
      insertOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      toArray: jest.fn()
    };

<<<<<<< HEAD
    // Setup mock database
    mockDb = {
      collection: jest.fn((name: string) => {
        switch (name) {
          case 'messages': return mockMessagesCollection;
          case 'conversations': return mockConversationsCollection;
          case 'sessions': return mockSessionsCollection;
          case 'assistants': return mockAssistantsCollection;
          default: return mockConversationsCollection;
        }
      })
=======
    const mockMessagesCollection = {
      createIndex: jest.fn(),
      insertOne: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
      toArray: jest.fn()
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    };

    service = new ChatMongoDBService();

<<<<<<< HEAD
    service = new ChatMongoDBService();
    // Initialize the service with mock collections
    service.initialize(
      mockMessagesCollection,
      mockConversationsCollection,
      mockSessionsCollection,
      mockAssistantsCollection
=======
    // Initialize the service with mock collections
    service.initialize(
      mockMessagesCollection as any,
      mockConversationsCollection as any,
      mockSessionsCollection as any,
      mockAssistantsCollection as any
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    );
  });

  describe('constructor', () => {
    it('should initialize service', () => {
      expect(service).toBeDefined();
      expect(typeof service.createSession).toBe('function');
    });
  });

  describe('Session Management', () => {
    describe('createSession', () => {
      it('should create a new chat session', async () => {
        mockSessionsCollection.insertOne.mockResolvedValue({
          insertedId: 'session-id-123',
          acknowledged: true,
          insertedCount: 1
        });

        const result = await service.createSession('user123', 'Mozilla/5.0', '192.168.1.1');

        expect(result.sessionId).toBeDefined();
        expect(result.userId).toBe('user123');
        expect(result.userAgent).toBe('Mozilla/5.0');
        expect(result.ipAddress).toBe('192.168.1.1');
        expect(result._id).toBe('session-id-123');
        expect(mockSessionsCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
          userId: 'user123'
        }));
      });

      it('should create session with minimal parameters', async () => {
        mockSessionsCollection.insertOne.mockResolvedValue({
          insertedId: 'session-id-123'
        });

        const result = await service.createSession('user123');

        expect(result.sessionId).toBeDefined();
        expect(result.userId).toBe('user123');
        expect(result.userAgent).toBeUndefined();
        expect(result.ipAddress).toBeUndefined();
      });

      it('should handle session creation errors', async () => {
        mockSessionsCollection.insertOne.mockRejectedValue(new Error('Database error'));

        await expect(service.createSession('user123')).rejects.toThrow('Database error');
      });
    });

    describe('cleanupExpiredSessions', () => {
      it('should remove expired sessions', async () => {
        mockSessionsCollection.deleteMany.mockResolvedValue({
          deletedCount: 5
        });

        const result = await service.cleanupExpiredSessions();

        expect(result).toBe(5);
        expect(mockSessionsCollection.deleteMany).toHaveBeenCalledWith({
          expiresAt: { $lt: expect.any(Date) }
        });
      });

      it('should return 0 when no expired sessions', async () => {
        mockSessionsCollection.deleteMany.mockResolvedValue({
          deletedCount: 0
        });

        const result = await service.cleanupExpiredSessions();

        expect(result).toBe(0);
      });
    });
  });

  describe('Conversation Management', () => {
    describe('createConversation', () => {
      it('should create a new conversation', async () => {
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();

        mockConversationsCollection.insertOne.mockResolvedValue({
          insertedId: mockId
        });

        const result = await service.createConversation(
          'Test Conversation',
          'session-123',
          'gpt-4',
          'user123',
          'workspace-123'
        );

        expect(result.id).toBe(mockId.toString());
        expect(result.title).toBe('Test Conversation');
        expect(result.sessionId).toBe('session-123');
        expect(result.model).toBe('gpt-4');
        expect(result.userId).toBe('user123');
        expect(result.workspaceId).toBe('workspace-123');
        expect(result.messages).toEqual([]);
        expect(mockConversationsCollection.insertOne).toHaveBeenCalled();
      });

      it('should handle conversation creation errors', async () => {
        mockConversationsCollection.insertOne.mockRejectedValue(new Error('Database error'));

        await expect(service.createConversation(
          'Test Conversation',
          'session-123',
          'gpt-4',
          'user123',
          'workspace-123'
        )).rejects.toThrow('Database error');
      });
    });

    describe('getConversation', () => {
      it('should retrieve an existing conversation', async () => {
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();

        mockConversationsCollection.findOne.mockResolvedValue({
          _id: mockId,
          title: 'Test Conversation',
          messages: []
        });

        const result = await service.getConversation(mockId);

        expect(result).toEqual({
          _id: mockId,
          title: 'Test Conversation',
          messages: []
        });
        expect(mockConversationsCollection.findOne).toHaveBeenCalledWith({ _id: mockId });
      });

      it('should return null for non-existent conversation', async () => {
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();

        mockConversationsCollection.findOne.mockResolvedValue(null);

        const result = await service.getConversation(mockId);

        expect(result).toBeNull();
      });
    });

    describe('getConversationsByWorkspace', () => {
      it('should retrieve conversations by workspace', async () => {
        const { ObjectId } = require('mongodb');
        const mockId1 = new ObjectId();
        const mockId2 = new ObjectId();

        const mockConversations = [
          { _id: mockId1, title: 'Conversation 1' },
          { _id: mockId2, title: 'Conversation 2' }
        ];

        const mockFind = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          toArray: jest.fn().mockResolvedValue(mockConversations)
        };

        mockConversationsCollection.find.mockReturnValue(mockFind);

        const result = await service.getConversationsByWorkspace('workspace-123', 10);

        expect(result.length).toBe(2);
        expect(result[0].id).toBe(mockId1.toString());
        expect(result[0].title).toBe('Conversation 1');
        expect(result[1].id).toBe(mockId2.toString());
        expect(result[1].title).toBe('Conversation 2');
        expect(mockConversationsCollection.find).toHaveBeenCalledWith({ workspaceId: 'workspace-123' });
        expect(mockFind.sort).toHaveBeenCalledWith({ updatedAt: -1 });
        expect(mockFind.limit).toHaveBeenCalledWith(10);
      });

      it('should use default limit when not specified', async () => {
        const mockFind = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          toArray: jest.fn().mockResolvedValue([])
        };

        mockConversationsCollection.find.mockReturnValue(mockFind);

        await service.getConversationsByWorkspace('workspace-123');

        expect(mockFind.limit).toHaveBeenCalledWith(50);
      });
    });

    describe('getConversationsByUser', () => {
      it('should retrieve conversations by user', async () => {
        const { ObjectId } = require('mongodb');
        const mockId1 = new ObjectId();
        const mockId2 = new ObjectId();

        const mockConversations = [
          { _id: mockId1, title: 'Conversation 1' },
          { _id: mockId2, title: 'Conversation 2' }
        ];

        const mockFind = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          toArray: jest.fn().mockResolvedValue(mockConversations)
        };

        mockConversationsCollection.find.mockReturnValue(mockFind);

        const result = await service.getConversationsByUser('user123', 20);

        expect(result.length).toBe(2);
        expect(result[0].id).toBe(mockId1.toString());
        expect(result[0].title).toBe('Conversation 1');
        expect(result[1].id).toBe(mockId2.toString());
        expect(result[1].title).toBe('Conversation 2');
        expect(mockConversationsCollection.find).toHaveBeenCalledWith({ userId: 'user123' });
        expect(mockFind.sort).toHaveBeenCalledWith({ updatedAt: -1 });
        expect(mockFind.limit).toHaveBeenCalledWith(20);
      });
    });
  });

  describe('Message Management', () => {
    describe('addMessage', () => {
      it('should add a message to a conversation', async () => {
        const { ObjectId } = require('mongodb');
        const mockConvId = new ObjectId();
        const mockMsgId = new ObjectId();

        mockConversationsCollection.findOne.mockResolvedValue({
          _id: mockConvId,
          workspaceId: 'workspace-123',
          userId: 'user-123',
          messages: []
        });

        const mockMessagesCollection = service.getCollections().messages;
        mockMessagesCollection.insertOne = jest.fn().mockResolvedValue({
          insertedId: mockMsgId
        });

        // Mock findOne to return a conversation
        mockConversationsCollection.findOne.mockResolvedValue({
          id: 'conversation-123',
          workspaceId: 'workspace-123',
          userId: 'user123',
          messages: []
        });

        // Mock insertOne for messages
        const mockMessagesCollection = service.getCollections().messages;
        if (mockMessagesCollection) {
          (mockMessagesCollection.insertOne as jest.Mock).mockResolvedValue({
            insertedId: 'message-id-123'
          });
        }

        mockConversationsCollection.updateOne.mockResolvedValue({
          matchedCount: 1
        });

        const messageData = {
          from: 'user' as 'user' | 'assistant',
          content: 'Hello, world!'
        };

        const result = await service.addMessage(mockConvId.toString(), messageData);

        expect(result.id).toBeDefined();
        expect(result.from).toBe('user');
        expect(result.content).toBe('Hello, world!');
        expect(result.timestamp).toBeInstanceOf(Date);
<<<<<<< HEAD
=======
        expect(mockConversationsCollection.updateOne).toHaveBeenCalled();
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
      });

      it('should handle adding message to non-existent conversation', async () => {
        const { ObjectId } = require('mongodb');
        const mockConvId = new ObjectId();

        mockConversationsCollection.findOne.mockResolvedValue(null);

        const messageData = {
          from: 'user' as 'user' | 'assistant',
          content: 'Hello, world!'
        };

<<<<<<< HEAD
        await expect(service.addMessage(mockConvId.toString(), messageData))
          .rejects.toThrow('Conversation not found');
      });
=======
        mockConversationsCollection.findOne.mockResolvedValue(null);

        await expect(service.addMessage('non-existent-conversation', messageData))
          .rejects.toThrow('Conversation not found');
      });

      it('should handle message addition errors', async () => {
        const messageData = {
          from: 'user' as 'user' | 'assistant',
          content: 'Hello, world!'
        };

        // Mock findOne to return a conversation
        mockConversationsCollection.findOne.mockResolvedValue({
          id: 'conversation-123',
          workspaceId: 'workspace-123',
          userId: 'user123',
          messages: []
        });

        // Mock messages collection insertOne to succeed
        const mockMessagesCollection = service.getCollections().messages;
        if (mockMessagesCollection) {
          (mockMessagesCollection.insertOne as jest.Mock).mockResolvedValue({
            insertedId: 'message-id-123'
          });
        }

        // Mock updateOne to throw error
        mockConversationsCollection.updateOne.mockRejectedValue(new Error('Database error'));

        await expect(service.addMessage('conversation-123', messageData))
          .rejects.toThrow('Database error');
      });
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
    });

  });

  describe('Conversation Deletion', () => {
    describe('deleteConversation', () => {
      it('should delete an existing conversation', async () => {
<<<<<<< HEAD
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();

        mockConversationsCollection.findOne.mockResolvedValue({
          _id: mockId,
=======
        // Mock findOne to return a conversation
        mockConversationsCollection.findOne.mockResolvedValue({
          id: 'conversation-123',
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
          messages: []
        });

        mockConversationsCollection.deleteOne.mockResolvedValue({
          deletedCount: 1
        });

        const result = await service.deleteConversation(mockId);

<<<<<<< HEAD
        expect(result).toBe(true);
        expect(mockConversationsCollection.deleteOne).toHaveBeenCalledWith({ _id: mockId });
      });

      it('should handle deleting non-existent conversation', async () => {
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();
=======
        expect(mockConversationsCollection.findOne).toHaveBeenCalledWith({ id: 'conversation-123' });
        expect(mockConversationsCollection.deleteOne).toHaveBeenCalledWith({ id: 'conversation-123' });
      });

      it('should handle deleting non-existent conversation', async () => {
        // Mock findOne to return null
        mockConversationsCollection.findOne.mockResolvedValue(null);
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)

        mockConversationsCollection.findOne.mockResolvedValue(null);

        const result = await service.deleteConversation(mockId);

        expect(result).toBe(false);
      });

      it('should handle conversation deletion errors', async () => {
<<<<<<< HEAD
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();

        mockConversationsCollection.findOne.mockResolvedValue({
          _id: mockId,
=======
        // Mock findOne to return a conversation
        mockConversationsCollection.findOne.mockResolvedValue({
          id: 'conversation-123',
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
          messages: []
        });

        mockConversationsCollection.deleteOne.mockRejectedValue(new Error('Database error'));

        await expect(service.deleteConversation(mockId))
          .rejects.toThrow('Database error');
      });
    });
  });

  describe('Assistant Management', () => {
    describe('createAssistant', () => {
      it('should create a new assistant', async () => {
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();

        const assistantData = {
          name: 'Test Assistant',
          description: 'A test assistant',
          instructions: 'You are a helpful assistant',
          model: 'gpt-4',
          userId: 'user123',
          tools: ['web_search', 'calculator']
        };

        mockAssistantsCollection.insertOne.mockResolvedValue({
          insertedId: mockId
        });

        const result = await service.createAssistant(
          assistantData.name,
          assistantData.description,
          assistantData.instructions,
          assistantData.model,
          assistantData.userId,
          assistantData.tools
        );

        expect(result.id).toBeDefined();
        expect(result.name).toBe('Test Assistant');
        expect(result.description).toBe('A test assistant');
        expect(result.instructions).toBe('You are a helpful assistant');
        expect(result.model).toBe('gpt-4');
        expect(result.userId).toBe('user123');
        expect(result.tools).toEqual(['web_search', 'calculator']);
        expect(mockAssistantsCollection.insertOne).toHaveBeenCalled();
      });

      it('should create assistant without tools', async () => {
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();

        mockAssistantsCollection.insertOne.mockResolvedValue({
          insertedId: mockId
        });

        const result = await service.createAssistant(
          'Test Assistant',
          'A test assistant',
          'You are a helpful assistant',
          'gpt-4',
          'user123'
        );

        expect(result.tools).toBeUndefined();
      });

      it('should handle assistant creation errors', async () => {
        mockAssistantsCollection.insertOne.mockRejectedValue(new Error('Database error'));

        await expect(service.createAssistant(
          'Test Assistant',
          'A test assistant',
          'You are a helpful assistant',
          'gpt-4',
          'user123'
        )).rejects.toThrow('Database error');
      });
    });

    describe('getAssistantsByUser', () => {
      it('should retrieve assistants by user', async () => {
        const { ObjectId } = require('mongodb');
        const mockId = new ObjectId();

        const mockAssistants = [
          {
            _id: mockId,
            name: 'Test Assistant',
            description: 'A test assistant',
            userId: 'user123'
          }
        ];

        const mockFind = {
          sort: jest.fn().mockReturnThis(),
          toArray: jest.fn().mockResolvedValue(mockAssistants)
        };

        mockAssistantsCollection.find.mockReturnValue(mockFind);

        const result = await service.getAssistantsByUser('user123');

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Test Assistant');
        expect(mockAssistantsCollection.find).toHaveBeenCalledWith({ userId: 'user123' });
      });

      it('should return empty array for user with no assistants', async () => {
        const mockFind = {
          sort: jest.fn().mockReturnThis(),
          toArray: jest.fn().mockResolvedValue([])
        };

        mockAssistantsCollection.find.mockReturnValue(mockFind);

        const result = await service.getAssistantsByUser('user123');

        expect(result).toEqual([]);
      });
    });
  });

  describe('Statistics', () => {
    describe('getChatStats', () => {
      it('should calculate chat statistics', async () => {
        const mockMessageStats = [{
          totalMessages: 100,
          userMessages: 60,
          assistantMessages: 35,
          systemMessages: 5
        }];

        const mockConvStats = [{
          totalConversations: 10,
          avgMessagesPerConversation: 10
        }];

        const mockMessagesCollection = service.getCollections().messages;
        mockMessagesCollection.aggregate = jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockMessageStats)
        });

        mockConversationsCollection.aggregate.mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockConvStats)
        });

        const result = await service.getChatStats('workspace-123');

        expect(result.totalMessages).toBe(100);
        expect(result.totalConversations).toBe(10);
        expect(result.messagesByRole.user).toBe(60);
        expect(result.messagesByRole.assistant).toBe(35);
        expect(result.messagesByRole.system).toBe(5);
      });

      it('should handle empty conversations', async () => {
        const mockMessagesCollection = service.getCollections().messages;
        mockMessagesCollection.aggregate = jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        });

        mockConversationsCollection.aggregate.mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        });

        const result = await service.getChatStats();

        expect(result.totalMessages).toBe(0);
        expect(result.totalConversations).toBe(0);
      });
    });
  });

<<<<<<< HEAD
  describe('Health Status', () => {
    it('should get health status', async () => {
      const mockMessagesCollection = service.getCollections().messages;
      mockMessagesCollection.countDocuments = jest.fn().mockResolvedValue(100);
      mockMessagesCollection.findOne = jest.fn().mockResolvedValue({
        timestamp: new Date()
      });

      mockConversationsCollection.countDocuments.mockResolvedValue(10);

      const result = await service.getHealthStatus();

      expect(result.isHealthy).toBe(true);
      expect(result.messageCount).toBe(100);
      expect(result.conversationCount).toBe(10);
      expect(result.lastActivity).toBeInstanceOf(Date);
    });

    it('should handle health check errors', async () => {
      const mockMessagesCollection = service.getCollections().messages;
      mockMessagesCollection.countDocuments = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await service.getHealthStatus();

      expect(result.isHealthy).toBe(false);
    });
  });
=======
  describe('Error Handling', () => {
    it('should handle database operation errors gracefully', async () => {
      mockSessionsCollection.insertOne.mockRejectedValue(new Error('Database operation failed'));

      await expect(service.createSession('user123')).rejects.toThrow('Database operation failed');
    });
  });

>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
});
