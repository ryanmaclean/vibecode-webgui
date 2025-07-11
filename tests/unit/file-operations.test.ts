/**
 * Comprehensive Unit Tests for File Operations
 * 
 * Tests for secure file system operations, real-time synchronization,
 * lazy loading, file watching optimization, and WebSocket connection pooling
 */

import { jest } from '@jest/globals'
import { EventEmitter } from 'events'
import { SecureFileSystemOperations } from '../../src/lib/file-system-operations'
import { LazyFileLoader, VirtualFileScroller } from '../../src/lib/lazy-loading'
import { OptimizedFileWatcher } from '../../src/lib/file-watching-optimization'
import { WebSocketConnectionPool } from '../../src/lib/websocket-connection-pooling'

// Mock dependencies
jest.mock('chokidar');
jest.mock('ws');
jest.mock('fs');
jest.mock('path');

describe('SecureFileSystemOperations', () => {
  let fileOps: SecureFileSystemOperations;
  const mockWorkspacePath = '/test/workspace';
  const mockUserId = 'user123';

  beforeEach(() => {
    fileOps = new SecureFileSystemOperations(mockWorkspacePath, mockUserId);
  });

  afterEach(async () => {
    await fileOps.destroy();
  });

  describe('File Path Validation', () => {
    it('should validate safe file paths', () => {
      const safePath = '/test/workspace/src/index.ts';
      expect((fileOps as any).validateFilePath(safePath)).toBe(true);
    });

    it('should reject path traversal attempts', () => {
      const maliciousPath = '/test/workspace/../../../etc/passwd';
      expect((fileOps as any).validateFilePath(maliciousPath)).toBe(false);
    });

    it('should reject paths outside workspace', () => {
      const outsidePath = '/other/workspace/file.ts';
      expect((fileOps as any).validateFilePath(outsidePath)).toBe(false);
    });

    it('should reject blocked file extensions', () => {
      const blockedPath = '/test/workspace/malware.exe';
      expect((fileOps as any).validateFilePath(blockedPath)).toBe(false);
    });

    it('should handle null and undefined paths', () => {
      expect((fileOps as any).validateFilePath(null)).toBe(false);
      expect((fileOps as any).validateFilePath(undefined)).toBe(false);
      expect((fileOps as any).validateFilePath('')).toBe(false);
    });
  });

  describe('File CRUD Operations', () => {
    const validFilePath = '/test/workspace/src/test.ts';
    const fileContent = 'console.log("Hello World");';

    it('should create file with valid content', async () => {
      const metadata = await fileOps.createFile(validFilePath, fileContent);
      
      expect(metadata).toMatchObject({
        path: validFilePath,
        size: expect.any(Number),
        created: expect.any(Number),
        modified: expect.any(Number),
        checksum: expect.any(String);
      });
    });

    it('should read existing file', async () => {
      // First create a file
      await fileOps.createFile(validFilePath, fileContent);
      
      const content = await fileOps.readFile(validFilePath);
      expect(content).toBe(fileContent);
    });

    it('should update file content', async () => {
      const newContent = 'console.log("Updated content");';
      
      // Create initial file
      await fileOps.createFile(validFilePath, fileContent);
      
      // Update content
      const metadata = await fileOps.updateFile(validFilePath, newContent);
      
      expect(metadata.size).toBe(newContent.length);
      expect(metadata.modified).toBeGreaterThan(metadata.created);
    });

    it('should delete file', async () => {
      // Create file first
      await fileOps.createFile(validFilePath, fileContent);
      
      // Delete file
      await fileOps.deleteFile(validFilePath);
      
      // Verify file is deleted
      await expect(fileOps.readFile(validFilePath)).rejects.toThrow();
    });

    it('should handle large files', async () => {
      const largeContent = 'A'.repeat(1024 * 1024); // 1MB content;
      
      const metadata = await fileOps.createFile(validFilePath, largeContent);
      expect(metadata.size).toBe(largeContent.length);
      
      const readContent = await fileOps.readFile(validFilePath);
      expect(readContent).toBe(largeContent);
    });
  });

  describe('File Synchronization', () => {
    const filePath = '/test/workspace/sync-test.ts';
    const originalContent = 'original content';
    const modifiedContent = 'modified content';

    it('should detect file conflicts', async () => {
      // Create initial file
      const metadata1 = await fileOps.createFile(filePath, originalContent);
      
      // Simulate external modification
      const conflictingMetadata = {
        ...metadata1,
        modified: Date.now() + 1000,
        checksum: 'different-checksum'
      };
      
      const conflict = await fileOps.checkForConflicts(filePath, conflictingMetadata);
      expect(conflict.hasConflict).toBe(true);
      expect(conflict.conflictType).toBe('content');
    });

    it('should resolve conflicts with user choice strategy', async () => {
      // Create file and simulate conflict
      await fileOps.createFile(filePath, originalContent);
      
      const resolution = await fileOps.resolveConflict(filePath, modifiedContent, 'user-choice');
      expect(resolution.strategy).toBe('user-choice');
      expect(resolution.resolvedContent).toBe(modifiedContent);
    });

    it('should create backup on conflict resolution', async () => {
      await fileOps.createFile(filePath, originalContent);
      
      const resolution = await fileOps.resolveConflict(filePath, modifiedContent, 'backup');
      expect(resolution.backupPath).toBeDefined();
      expect(resolution.backupPath).toContain('.backup');
    });

    it('should emit sync events', (done) => {
      const eventData = {
        type: 'create' as const,
        path: filePath,
        content: originalContent,
        userId: mockUserId
      }

      fileOps.on('file-sync', (data) => {
        expect(data).toMatchObject(eventData);
        done();
      });

      fileOps.handleSyncEvent(eventData);
    });
  });

  describe('File Locking', () => {
    const filePath = '/test/workspace/locked-file.ts';

    it('should acquire exclusive lock', async () => {
      const lock = await fileOps.acquireLock(filePath, 'exclusive');
      expect(lock.lockId).toBeDefined();
      expect(lock.type).toBe('exclusive');
      expect(lock.userId).toBe(mockUserId);
    });

    it('should prevent multiple exclusive locks', async () => {
      await fileOps.acquireLock(filePath, 'exclusive');
      
      await expect(
        fileOps.acquireLock(filePath, 'exclusive', 'other-user');
      ).rejects.toThrow('File is locked');
    });

    it('should release locks', async () => {
      const lock = await fileOps.acquireLock(filePath, 'exclusive');
      await fileOps.releaseLock(filePath, lock.lockId);
      
      // Should be able to acquire lock again
      const newLock = await fileOps.acquireLock(filePath, 'exclusive');
      expect(newLock.lockId).toBeDefined();
    });

    it('should handle lock timeouts', async () => {
      const shortTimeout = 100 // 100ms;
      await fileOps.acquireLock(filePath, 'exclusive', mockUserId, shortTimeout);
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be able to acquire lock after timeout
      const newLock = await fileOps.acquireLock(filePath, 'exclusive');
      expect(newLock.lockId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid file operations', async () => {
      const invalidPath = '/invalid/../path';
      
      await expect(fileOps.createFile(invalidPath, 'content')).rejects.toThrow('Invalid file path');
      await expect(fileOps.readFile(invalidPath)).rejects.toThrow('Invalid file path');
      await expect(fileOps.updateFile(invalidPath, 'content')).rejects.toThrow('Invalid file path');
      await expect(fileOps.deleteFile(invalidPath)).rejects.toThrow('Invalid file path');
    });

    it('should handle file system errors gracefully', async () => {
      // Mock file system error
      const fsMock = require('fs');
      fsMock.readFile.mockImplementation((path: string, callback: Function) => {
        callback(new Error('ENOENT: no such file or directory'));
      });

      const filePath = '/test/workspace/nonexistent.ts';
      await expect(fileOps.readFile(filePath)).rejects.toThrow('ENOENT');
    });

    it('should validate file size limits', async () => {
      const filePath = '/test/workspace/large-file.ts';
      const oversizedContent = 'A'.repeat(11 * 1024 * 1024) // > 10MB;
      
      await expect(
        fileOps.createFile(filePath, oversizedContent);
      ).rejects.toThrow('File size exceeds limit');
    });
  });
});

describe('LazyFileLoader', () => {
  let lazyLoader: LazyFileLoader;
  const mockFilePath = '/test/large-file.txt';

  beforeEach(() => {
    lazyLoader = new LazyFileLoader({
      chunkSize: 100,
      maxCachedChunks: 10,
      preloadChunks: 2
    });
  });

  afterEach(() => {
    lazyLoader.destroy();
  });

  describe('File Initialization', () => {
    it('should initialize file for lazy loading', async () => {
      // Mock file analysis API
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          filePath: mockFilePath,
          totalLines: 10000,
          totalSize: 500000,
          lineBreaks: []
        });
      });

      await expect(lazyLoader.initializeFile(mockFilePath)).resolves.not.toThrow();
    });

    it('should emit file-initialized event', (done) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          filePath: mockFilePath,
          totalLines: 1000,
          totalSize: 50000,
          lineBreaks: []
        });
      });

      lazyLoader.on('file-initialized', (data) => {
        expect(data.filePath).toBe(mockFilePath);
        expect(data.totalLines).toBe(1000);
        done();
      });

      lazyLoader.initializeFile(mockFilePath);
    });
  });

  describe('Chunk Loading', () => {
    beforeEach(async () => {
      global.fetch = jest.fn();
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            filePath: mockFilePath,
            totalLines: 1000,
            totalSize: 50000,
            lineBreaks: []
          });
        });
        .mockResolvedValue({
          ok: true,
          text: async () => 'line1\nline2\nline3\n'.repeat(33) // ~100 lines
        });

      await lazyLoader.initializeFile(mockFilePath);
    });

    it('should load line range', async () => {
      const lines = await lazyLoader.getLineRange(0, 10);
      expect(lines).toHaveLength(11) // inclusive range
      expect(lines[0]).toContain('line1');
    });

    it('should cache loaded chunks', async () => {
      await lazyLoader.getLineRange(0, 10);
      const stats = lazyLoader.getCacheStats();
      expect(stats.cachedChunks).toBeGreaterThan(0);
    });

    it('should manage cache size limits', async () => {
      // Load many chunks to exceed cache limit
      for (let i = 0; i < 15; i++) {
        await lazyLoader.getLineRange(i * 100, i * 100 + 10);
      }

      const stats = lazyLoader.getCacheStats();
      expect(stats.cachedChunks).toBeLessThanOrEqual(10) // maxCachedChunks
    });
  });

  describe('Virtual Scrolling', () => {
    let virtualScroller: VirtualFileScroller;
    let mockContainer: HTMLElement;

    beforeEach(() => {
      mockContainer = {
        clientHeight: 400,
        scrollTop: 0,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn();
      } as any

      virtualScroller = new VirtualFileScroller(mockContainer, lazyLoader, 20);
    });

    afterEach(() => {
      virtualScroller.destroy();
    });

    it('should initialize virtual scroller', async () => {
      await virtualScroller.initialize(1000);
      expect(mockContainer.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
    });

    it('should scroll to specific line', () => {
      const lineNumber = 100;
      virtualScroller.scrollToLine(lineNumber);
      expect(mockContainer.scrollTop).toBe(lineNumber * 20) // lineHeight = 20
    });

    it('should update line height', () => {
      const newLineHeight = 25;
      virtualScroller.updateLineHeight(newLineHeight);
      // Should not throw and should update internal state
      expect(() => virtualScroller.scrollToLine(10)).not.toThrow();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      global.fetch = jest.fn();
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            filePath: mockFilePath,
            totalLines: 1000,
            totalSize: 50000,
            lineBreaks: []
          });
        });
        .mockResolvedValue({
          ok: true,
          text: async () => 'function test() {\n  console.log("test");\n}\n'.repeat(33);
        });

      await lazyLoader.initializeFile(mockFilePath);
    });

    it('should search for text patterns', async () => {
      const results = await lazyLoader.searchInFile('function', { maxResults: 10 });
      expect(results).toHaveLength(10);
      expect(results[0].content).toContain('function');
    });

    it('should support regex search', async () => {
      const results = await lazyLoader.searchInFile('function\\s+\\w+', { ;
        regex: true, 
        maxResults: 5 
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].match).toBeInstanceOf(RegExp);
    });

    it('should support case-sensitive search', async () => {
      const caseSensitive = await lazyLoader.searchInFile('FUNCTION', { ;
        caseSensitive: true, 
        maxResults: 5 
      });
      const caseInsensitive = await lazyLoader.searchInFile('FUNCTION', { ;
        caseSensitive: false, 
        maxResults: 5 
      });
      
      expect(caseSensitive.length).toBeLessThanOrEqual(caseInsensitive.length);
    });
  });
});

describe('OptimizedFileWatcher', () => {
  let fileWatcher: OptimizedFileWatcher;
  const mockWatchPath = '/test/watch';

  beforeEach(() => {
    fileWatcher = new OptimizedFileWatcher({
      watchPath: mockWatchPath,
      batchDelay: 50,
      maxBatchSize: 10
    });
  });

  afterEach(async () => {
    await fileWatcher.destroy();
  });

  describe('Watcher Lifecycle', () => {
    it('should start watching', async () => {
      await expect(fileWatcher.start()).resolves.not.toThrow();
      expect(fileWatcher.isActive()).toBe(true);
    });

    it('should stop watching', async () => {
      await fileWatcher.start();
      await fileWatcher.stop();
      expect(fileWatcher.isActive()).toBe(false);
    });

    it('should prevent double start', async () => {
      await fileWatcher.start();
      await expect(fileWatcher.start()).rejects.toThrow('already running');
    });
  });

  describe('Event Batching', () => {
    it('should batch file events', (done) => {
      let batchCount = 0
      
      fileWatcher.on('batch', (batch) => {
        expect(batch.events).toBeInstanceOf(Array);
        expect(batch.batchId).toBeDefined();
        batchCount++
        
        if (batchCount === 1) {
          done();
        }
      });

      // Simulate multiple rapid events
      const event = {
        type: 'change' as const,
        path: '/test/watch/file.ts',
        timestamp: Date.now();
      }
      
      ;(fileWatcher as any).addToBatch(event);
    });

    it('should optimize duplicate events', () => {
      const events = [;
        { type: 'add', path: '/test/file.ts', timestamp: 1000 },
        { type: 'change', path: '/test/file.ts', timestamp: 1001 },
        { type: 'change', path: '/test/file.ts', timestamp: 1002 }
      ]

      const optimized = (fileWatcher as any).optimizeBatch(events);
      expect(optimized).toHaveLength(1) // Should keep only the latest event
      expect(optimized[0].type).toBe('change');
      expect(optimized[0].timestamp).toBe(1002);
    });

    it('should handle delete events correctly', () => {
      const events = [;
        { type: 'add', path: '/test/file.ts', timestamp: 1000 },
        { type: 'change', path: '/test/file.ts', timestamp: 1001 },
        { type: 'unlink', path: '/test/file.ts', timestamp: 1002 }
      ]

      const optimized = (fileWatcher as any).optimizeBatch(events);
      expect(optimized).toHaveLength(1);
      expect(optimized[0].type).toBe('unlink') // Only keep delete event
    });
  });

  describe('Event Filtering', () => {
    it('should ignore system files', () => {
      const systemFiles = [;
        '/test/watch/.DS_Store',
        '/test/watch/Thumbs.db',
        '/test/watch/file.tmp',
        '/test/watch/backup~'
      ]

      systemFiles.forEach(filePath => {
        const shouldIgnore = (fileWatcher as any).shouldIgnoreEvent(filePath, 'add');
        expect(shouldIgnore).toBe(true);
      });
    });

    it('should watch valid source files', () => {
      const validFiles = [;
        '/test/watch/src/index.ts',
        '/test/watch/components/Button.tsx',
        '/test/watch/styles/main.css',
        '/test/watch/README.md'
      ]

      validFiles.forEach(filePath => {
        const shouldIgnore = (fileWatcher as any).shouldIgnoreEvent(filePath, 'add');
        expect(shouldIgnore).toBe(false);
      });
    });

    it('should respect depth limits', () => {
      const deepPath = '/test/watch/' + 'deep/'.repeat(15) + 'file.ts';
      const shouldIgnore = (fileWatcher as any).shouldIgnoreEvent(deepPath, 'add');
      expect(shouldIgnore).toBe(true);
    });
  });

  describe('Performance Statistics', () => {
    it('should track watcher statistics', () => {
      const stats = fileWatcher.getStats();
      expect(stats).toMatchObject({
        totalEvents: expect.any(Number),
        batchesProcessed: expect.any(Number),
        averageBatchSize: expect.any(Number),
        eventsPerSecond: expect.any(Number),
        filteredEvents: expect.any(Number);
      });
    });

    it('should update statistics on batch processing', () => {
      const initialStats = fileWatcher.getStats();
      
      // Simulate batch processing
      const batch = {
        events: [
          { type: 'change', path: '/test/file.ts', timestamp: Date.now() }
        ],
        timestamp: Date.now(),
        batchId: 'test-batch'
      }
      
      ;(fileWatcher as any).updateStats(batch);
      
      const updatedStats = fileWatcher.getStats();
      expect(updatedStats.batchesProcessed).toBe(initialStats.batchesProcessed + 1);
    });
  });
});

describe('WebSocketConnectionPool', () => {
  let connectionPool: WebSocketConnectionPool;
  const mockWebSocketUrl = 'ws://localhost:8080';

  beforeEach(() => {
    connectionPool = new WebSocketConnectionPool({
      maxConnections: 5,
      maxConnectionsPerHost: 2,
      connectionTimeout: 1000
    });
  });

  afterEach(async () => {
    await connectionPool.destroy();
  });

  describe('Connection Management', () => {
    it('should create and manage connections', async () => {
      // Mock WebSocket
      const mockWebSocket = {
        readyState: 1, // OPEN
        addEventListener: jest.fn(),
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn();
      }
      
      const WebSocketMock = jest.fn().mockImplementation(() => mockWebSocket);
      global.WebSocket = WebSocketMock as any

      const connection = await connectionPool.getConnection(mockWebSocketUrl);
      expect(connection).toBeDefined();
      expect(connection.url).toBe(mockWebSocketUrl);
      expect(connection.state).toBe('connected');
    });

    it('should reuse existing connections', async () => {
      const mockWebSocket = {
        readyState: 1,
        addEventListener: jest.fn(),
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn();
      }
      
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any

      const connection1 = await connectionPool.getConnection(mockWebSocketUrl);
      const connection2 = await connectionPool.getConnection(mockWebSocketUrl);
      
      // Should reuse the same connection
      expect(connection1.id).toBe(connection2.id);
    });

    it('should respect connection limits', async () => {
      const mockWebSocket = {
        readyState: 1,
        addEventListener: jest.fn(),
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn();
      }
      
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any

      // Create connections up to the limit
      const connections = [];
      for (let i = 0; i < 5; i++) {
        connections.push(await connectionPool.getConnection(`ws://host${i}:8080`));
      }

      expect(connections).toHaveLength(5);
      
      // Additional connection should be queued or rejected
      const status = connectionPool.getStatus();
      expect(status.totalConnections).toBe(5);
    });
  });

  describe('Message Handling', () => {
    let mockConnection: any;

    beforeEach(async () => {
      const mockWebSocket = {
        readyState: 1,
        addEventListener: jest.fn(),
        on: jest.fn(),
        send: jest.fn((data, callback) => callback && callback()),
        close: jest.fn();
      }
      
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any
      mockConnection = await connectionPool.getConnection(mockWebSocketUrl);
    });

    it('should send messages', async () => {
      const message = 'test message';
      await expect(
        connectionPool.sendMessage(mockConnection.id, message);
      ).resolves.not.toThrow();
    });

    it('should handle send errors', async () => {
      // Mock send error
      const mockWebSocket = mockConnection.socket;
      mockWebSocket.send = jest.fn((data, callback) => {
        callback(new Error('Send failed'));
      });

      await expect(
        connectionPool.sendMessage(mockConnection.id, 'test');
      ).rejects.toThrow('Send failed');
    });

    it('should track message statistics', async () => {
      const message = 'test message';
      const initialMetrics = connectionPool.getMetrics();
      
      await connectionPool.sendMessage(mockConnection.id, message);
      
      const updatedMetrics = connectionPool.getMetrics();
      expect(updatedMetrics.totalMessages).toBe(initialMetrics.totalMessages + 1);
      expect(updatedMetrics.totalBytes).toBeGreaterThan(initialMetrics.totalBytes);
    });
  });

  describe('Connection Health Monitoring', () => {
    it('should monitor connection health', () => {
      const metrics = connectionPool.getMetrics();
      expect(metrics).toMatchObject({
        totalConnections: expect.any(Number),
        activeConnections: expect.any(Number),
        idleConnections: expect.any(Number),
        failedConnections: expect.any(Number),
        totalMessages: expect.any(Number),
        totalBytes: expect.any(Number),
        averageLatency: expect.any(Number),
        uptime: expect.any(Number);
      });
    });

    it('should handle connection failures gracefully', async () => {
      const errorEvents: any[] = [];
      connectionPool.on('connection-error', (event) => {
        errorEvents.push(event);
      });

      // Simulate connection error
      const mockWebSocket = {
        readyState: 3, // CLOSED
        addEventListener: jest.fn(),
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn();
      }
      
      global.WebSocket = jest.fn().mockImplementation(() => {
        setTimeout(() => {
          mockWebSocket.on.mock.calls
            .filter(call => call[0] === 'error');
            .forEach(call => call[1](new Error('Connection failed')));
        }, 10);
        return mockWebSocket
      }) as any

      try {
        await connectionPool.getConnection(mockWebSocketUrl);
      } catch (error) {
        // Expected to fail
      }

      // Wait for error event
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Connection Cleanup', () => {
    it('should clean up idle connections', async () => {
      const mockWebSocket = {
        readyState: 1,
        addEventListener: jest.fn(),
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn();
      }
      
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any

      const connection = await connectionPool.getConnection(mockWebSocketUrl);
      connectionPool.releaseConnection(connection.id, 'test-subscriber');
      
      // Should mark connection as idle
      expect(connection.state).toBe('idle');
    });

    it('should destroy all connections on cleanup', async () => {
      const mockWebSocket = {
        readyState: 1,
        addEventListener: jest.fn(),
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        once: jest.fn((event, callback) => {
          if (event === 'close') setTimeout(callback, 10);
        });
      }
      
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any

      await connectionPool.getConnection(mockWebSocketUrl);
      await connectionPool.destroy();
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });
});

describe('Integration Tests', () => {
  describe('File Operations with Lazy Loading', () => {
    it('should integrate file operations with lazy loading', async () => {
      const fileOps = new SecureFileSystemOperations('/test/workspace', 'user123');
      const lazyLoader = new LazyFileLoader({ chunkSize: 100 });
      
      try {
        // Mock large file content
        const largeContent = 'line content\n'.repeat(1000);
        const filePath = '/test/workspace/large-file.txt';
        
        // Create file through secure operations
        await fileOps.createFile(filePath, largeContent);
        
        // Initialize lazy loading
        global.fetch = jest.fn();
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              filePath,
              totalLines: 1000,
              totalSize: largeContent.length,
              lineBreaks: []
            });
          });
          .mockResolvedValue({
            ok: true,
            text: async () => 'line content\n'.repeat(100);
          });

        await lazyLoader.initializeFile(filePath);
        
        // Test lazy loading of file chunks
        const lines = await lazyLoader.getLineRange(0, 50);
        expect(lines).toHaveLength(51);
        
      } finally {
        await fileOps.destroy();
        lazyLoader.destroy();
      }
    });
  });

  describe('File Watching with Connection Pooling', () => {
    it('should coordinate file watching with WebSocket notifications', async () => {
      const fileWatcher = new OptimizedFileWatcher({
        watchPath: '/test/workspace',
        batchDelay: 50
      });
      
      const connectionPool = new WebSocketConnectionPool();
      
      try {
        // Start file watcher
        await fileWatcher.start();
        
        // Track events
        const fileEvents: any[] = [];
        fileWatcher.on('file-change', (event) => {
          fileEvents.push(event);
        });
        
        // Simulate file change
        const changeEvent = {
          type: 'change' as const,
          path: '/test/workspace/file.ts',
          timestamp: Date.now();
        }
        
        ;(fileWatcher as any).addToBatch(changeEvent);
        
        // Wait for event processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(fileEvents.length).toBeGreaterThan(0);
        expect(fileEvents[0].type).toBe('change');
        
      } finally {
        await fileWatcher.destroy();
        await connectionPool.destroy();
      }
    });
  });
});