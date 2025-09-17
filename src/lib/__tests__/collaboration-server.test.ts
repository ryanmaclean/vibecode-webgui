/**
 * Unit tests for CollaborationServer
 * Tests the actual public API methods
 */

import { CollaborationServer } from '../collaboration-server';

// Mock external dependencies
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    sockets: {
      sockets: new Map()
    }
  }))
}));

jest.mock('yjs', () => ({
  Doc: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockReturnValue({
      insert: jest.fn(),
      delete: jest.fn(),
      length: 0,
      toString: jest.fn().mockReturnValue('')
    }),
    getMap: jest.fn().mockReturnValue({
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn()
    }),
    getArray: jest.fn().mockReturnValue({
      insert: jest.fn(),
      delete: jest.fn(),
      length: 0
    }),
    on: jest.fn(),
    off: jest.fn(),
    destroy: jest.fn()
  })),
  encodeStateAsUpdate: jest.fn(),
  applyUpdate: jest.fn()
}));

jest.mock('y-leveldb', () => ({
  LeveldbPersistence: jest.fn().mockImplementation(() => ({
    whenSynced: Promise.resolve(),
    destroy: jest.fn()
  }))
}));

describe('CollaborationServer', () => {
  let server: CollaborationServer;
  let mockIO: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Socket.IO server
    mockIO = {
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      sockets: {
        sockets: new Map()
      }
    };

    server = new CollaborationServer(mockIO);
  });

  describe('getStats', () => {
    it('should return collaboration statistics', () => {
      const stats = server.getStats();

      expect(stats).toBeDefined();
      expect(typeof stats.activeDocuments).toBe('number');
      expect(typeof stats.totalUsers).toBe('number');
      expect(typeof stats.documentsPerProject).toBe('object');
      expect(stats.activeDocuments).toBe(0);
      expect(stats.totalUsers).toBe(0);
    });
  });

  describe('getDocument', () => {
    it('should return null for non-existent document', () => {
      const document = server.getDocument('nonexistent');

      expect(document).toBeNull();
    });
  });

  describe('saveAllDocuments', () => {
    it('should save all documents without error', async () => {
      await expect(server.saveAllDocuments()).resolves.toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should destroy server resources without error', async () => {
      await expect(server.destroy()).resolves.toBeUndefined();
    });
  });
});