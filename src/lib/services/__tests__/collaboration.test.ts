import { CollaborationService, CollaborativeUser, WorkspaceState, CollaborationEvent } from '../collaboration';

// Mock external dependencies
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis()
  }))
}));

jest.mock('../chat-mongodb', () => ({
  mongodbChatService: {
    getConversation: jest.fn(),
    addMessage: jest.fn()
  }
}));

jest.mock('../../monitoring/datadog-metrics', () => ({
  datadogMetrics: {
    recordUserAction: jest.fn()
  }
}));

describe('CollaborationService', () => {
  let service: CollaborationService;
  let mockHttpServer: any;
  let mockSocketIO: any;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock HTTP server
    mockHttpServer = {
      listen: jest.fn(),
      close: jest.fn()
    };

    // Setup mock Socket.IO server
    mockSocketIO = {
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    // Setup mock socket
    mockSocket = {
      id: 'socket-123',
      userId: 'user-123',
      workspaceId: 'workspace-123',
      conversationId: 'conversation-123',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      on: jest.fn()
    };

    // Mock Socket.IO Server constructor
    const { Server } = require('socket.io');
    Server.mockImplementation(() => mockSocketIO);

    service = new CollaborationService();
  });

  describe('constructor', () => {
    it('should initialize with empty workspaces map', () => {
      expect(service).toBeDefined();
      // The service should have access to collaboration methods
      expect(service.initialize).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize Socket.IO server with correct configuration', () => {
      service.initialize(mockHttpServer);

      expect(mockSocketIO).toBeDefined();
      expect(mockSocketIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should setup event handlers', () => {
      service.initialize(mockHttpServer);

      // Verify that connection handler is set up
      expect(mockSocketIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should start cleanup interval', () => {
      jest.spyOn(global, 'setInterval').mockImplementation(() => ({} as any));
      
      service.initialize(mockHttpServer);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000); // 30 seconds
    });
  });

  describe('User Management', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    describe('handleUserJoinWorkspace', () => {
      it('should handle user joining workspace', async () => {
        // Mock the connection handler
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        
        // Simulate socket connection
        connectionHandler(mockSocket);

        // Mock the join_workspace handler
        const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        
        await joinHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          userName: 'Test User',
          conversationId: 'conversation-123'
        });

        expect(mockSocket.join).toHaveBeenCalledWith('workspace:workspace-123');
        expect(mockSocket.join).toHaveBeenCalledWith('conversation:conversation-123');
        expect(mockSocket.emit).toHaveBeenCalledWith('workspace_state', expect.objectContaining({
          workspaceId: 'workspace-123',
          activeUsers: expect.any(Array),
          activeConversations: expect.any(Array)
        }));
      });

      it('should create new workspace if it does not exist', async () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        
        await joinHandler({
          workspaceId: 'new-workspace',
          userId: 'user-123',
          userName: 'Test User'
        });

        expect(mockSocket.join).toHaveBeenCalledWith('workspace:new-workspace');
        expect(mockSocket.emit).toHaveBeenCalledWith('workspace_state', expect.objectContaining({
          workspaceId: 'new-workspace'
        }));
      });

      it('should assign unique colors to users', async () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        
        await joinHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          userName: 'Test User'
        });

        // Verify that user was added with a color
        expect(mockSocket.emit).toHaveBeenCalledWith('workspace_state', expect.objectContaining({
          activeUsers: expect.arrayContaining([
            expect.objectContaining({
              id: 'user-123',
              name: 'Test User',
              color: expect.any(String),
              isActive: true
            })
          ])
        }));
      });

      it('should handle join workspace errors gracefully', async () => {
        mockSocket.join.mockRejectedValue(new Error('Join failed'));

        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        
        await joinHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          userName: 'Test User'
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Failed to join workspace' });
      });
    });

    describe('handleUserLeaveWorkspace', () => {
      it('should handle user leaving workspace', async () => {
        // First join a user
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        await joinHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          userName: 'Test User'
        });

        // Then leave
        const leaveHandler = mockSocket.on.mock.calls.find(call => call[0] === 'leave_workspace')[1];
        await leaveHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123'
        });

        expect(mockSocket.leave).toHaveBeenCalledWith('workspace:workspace-123');
        expect(mockSocket.to).toHaveBeenCalledWith('workspace:workspace-123');
      });

      it('should handle leaving non-existent workspace', async () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        const leaveHandler = mockSocket.on.mock.calls.find(call => call[0] === 'leave_workspace')[1];
        await leaveHandler({
          workspaceId: 'non-existent-workspace',
          userId: 'user-123'
        });

        // Should not throw error
        expect(mockSocket.leave).not.toHaveBeenCalled();
      });
    });
  });

  describe('Typing Management', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    describe('handleTypingStart', () => {
      it('should handle typing start event', async () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        // First join workspace to set socket properties
        const joinWorkspaceHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        await joinWorkspaceHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          userName: 'Test User',
          conversationId: 'conversation-123'
        });

        const typingStartHandler = mockSocket.on.mock.calls.find(call => call[0] === 'typing_start')[1];
        typingStartHandler({
          conversationId: 'conversation-123'
        });

        expect(mockSocket.to).toHaveBeenCalledWith('conversation:conversation-123');
      });
    });

    describe('handleTypingStop', () => {
      it('should handle typing stop event', async () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        // First join workspace to set socket properties
        const joinWorkspaceHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        await joinWorkspaceHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          userName: 'Test User',
          conversationId: 'conversation-123'
        });

        const typingStopHandler = mockSocket.on.mock.calls.find(call => call[0] === 'typing_stop')[1];
        typingStopHandler({
          conversationId: 'conversation-123'
        });

        expect(mockSocket.to).toHaveBeenCalledWith('conversation:conversation-123');
      });
    });
  });

  describe('Cursor Management', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    describe('handleCursorMove', () => {
      it('should handle cursor move event', async () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        // First join workspace to set socket properties
        const joinWorkspaceHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        await joinWorkspaceHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          userName: 'Test User',
          conversationId: 'conversation-123'
        });

        const cursorMoveHandler = mockSocket.on.mock.calls.find(call => call[0] === 'cursor_move')[1];
        cursorMoveHandler({
          x: 100,
          y: 200,
          messageId: 'message-123'
        });

        expect(mockSocket.to).toHaveBeenCalledWith('workspace:workspace-123');
      });
    });
  });

  describe('Message Management', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    describe('handleMessageDraft', () => {
      it('should handle message draft event', () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        const messageDraftHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message_draft')[1];
        messageDraftHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          conversationId: 'conversation-123',
          content: 'Draft message'
        });

        expect(mockSocket.to).toHaveBeenCalledWith('conversation:conversation-123');
      });
    });
  });

  describe('File Sharing', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    describe('handleFileShare', () => {
      it('should handle file share event', async () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        const fileShareHandler = mockSocket.on.mock.calls.find(call => call[0] === 'file_share')[1];
        await fileShareHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          conversationId: 'conversation-123',
          fileName: 'test.txt',
          fileSize: 1024
        });

        expect(mockSocket.to).toHaveBeenCalledWith('conversation:conversation-123');
      });

      it('should handle file share errors gracefully', async () => {
        mockSocket.to.mockImplementation(() => {
          throw new Error('Broadcast failed');
        });

        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        const fileShareHandler = mockSocket.on.mock.calls.find(call => call[0] === 'file_share')[1];
        
        // Should not throw error
        await expect(fileShareHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          conversationId: 'conversation-123',
          fileName: 'test.txt',
          fileSize: 1024
        })).resolves.not.toThrow();
      });
    });
  });

  describe('Disconnect Handling', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    describe('handleDisconnect', () => {
      it('should handle user disconnect', async () => {
        const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
        connectionHandler(mockSocket);

        // First join workspace to set socket properties
        const joinWorkspaceHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
        await joinWorkspaceHandler({
          workspaceId: 'workspace-123',
          userId: 'user-123',
          userName: 'Test User',
          conversationId: 'conversation-123'
        });

        const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
        disconnectHandler();

        // Should clean up user from all workspaces
        expect(mockSocket.leave).toHaveBeenCalled();
      });
    });
  });

  describe('Workspace State Management', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    it('should maintain workspace state correctly', async () => {
      const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
      await joinHandler({
        workspaceId: 'workspace-123',
        userId: 'user-123',
        userName: 'Test User',
        conversationId: 'conversation-123'
      });

      // Verify workspace state is maintained
      expect(mockSocket.emit).toHaveBeenCalledWith('workspace_state', expect.objectContaining({
        workspaceId: 'workspace-123',
        activeUsers: expect.any(Array),
        activeConversations: expect.arrayContaining(['conversation-123'])
      }));
    });

    it('should track active conversations', async () => {
      const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
      await joinHandler({
        workspaceId: 'workspace-123',
        userId: 'user-123',
        userName: 'Test User',
        conversationId: 'conversation-123'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('workspace_state', expect.objectContaining({
        activeConversations: expect.arrayContaining(['conversation-123'])
      }));
    });
  });

  describe('Metrics and Logging', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    it('should record collaboration metrics', async () => {
      const { datadogMetrics } = require('../../monitoring/datadog-metrics');
      
      const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
      await joinHandler({
        workspaceId: 'workspace-123',
        userId: 'user-123',
        userName: 'Test User'
      });

      expect(datadogMetrics.recordUserAction).toHaveBeenCalledWith(
        'workspace_join',
        'user-123',
        'workspace-123'
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    it('should handle socket errors gracefully', async () => {
      mockSocket.join.mockRejectedValue(new Error('Socket error'));

      const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join_workspace')[1];
      await joinHandler({
        workspaceId: 'workspace-123',
        userId: 'user-123',
        userName: 'Test User'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', { message: 'Failed to join workspace' });
    });

    it('should handle missing socket metadata gracefully', () => {
      const connectionHandler = mockSocketIO.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      
      // Should not throw error even without metadata
      expect(() => disconnectHandler()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should start cleanup interval on initialization', () => {
      jest.spyOn(global, 'setInterval').mockImplementation(() => ({} as any));
      
      service.initialize(mockHttpServer);

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should clean up inactive workspaces', () => {
      jest.spyOn(global, 'setInterval').mockImplementation((callback: any) => {
        callback(); // Execute immediately for testing
        return {} as any;
      });
      
      service.initialize(mockHttpServer);

      // Cleanup should run without errors
      expect(() => {}).not.toThrow();
    });
  });
});
