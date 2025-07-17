/**
 * Integration Tests for File Operations
 *
 * Tests real-world scenarios combining file operations, lazy loading,
 * file watching, and WebSocket connection pooling
 */

import { jest } from '@jest/globals'
import { SecureFileSystemOperations } from '../../src/lib/file-system-operations'
import { LazyFileLoader } from '../../src/lib/lazy-loading'
import { OptimizedFileWatcher, WorkspaceWatcherManager } from '../../src/lib/file-watching-optimization'
import { WebSocketConnectionPool } from '../../src/lib/websocket-connection-pooling'
import fs from 'fs/promises'
import path from 'path'
import { EventEmitter } from 'events'

describe('File Operations Integration Tests', () => {
  const testWorkspacePath = path.join(__dirname, '../../test-workspace')
  const testUserId = 'integration-test-user';
  let fileOps: SecureFileSystemOperations;
  let lazyLoader: LazyFileLoader;
  let fileWatcher: OptimizedFileWatcher;
  let connectionPool: WebSocketConnectionPool;

  beforeAll(async () => {
    // Create test workspace directory
    try {
      await fs.mkdir(testWorkspacePath, { recursive: true })} catch (error) {
      // Directory might already exist
    }
  });

  beforeEach(async () => {
    fileOps = new SecureFileSystemOperations(testWorkspacePath, testUserId);
    lazyLoader = new LazyFileLoader({
      chunkSize: 50,
      maxCachedChunks: 5,
      preloadChunks: 1
    });
    fileWatcher = new OptimizedFileWatcher({
      watchPath: testWorkspacePath,
      batchDelay: 100,
      maxBatchSize: 10
    });
    connectionPool = new WebSocketConnectionPool({
      maxConnections: 10,
      connectionTimeout: 5000
    })});

  afterEach(async () => {
    await fileOps?.destroy();
    lazyLoader?.destroy();
    await fileWatcher?.destroy();
    await connectionPool?.destroy()})

  afterAll(async () => {
    // Clean up test workspace
    try {
      await fs.rmdir(testWorkspacePath, { recursive: true })} catch (error) {
      // Directory cleanup might fail, that's okay
    }
  });

  describe('End-to-End File Management', () => {
    it('should handle complete file lifecycle with all components', async () => {
      const fileName = 'integration-test.ts';
      const filePath = path.join(testWorkspacePath, fileName);
      const fileContent = [
        'export interface TestInterface {',
        '  id: string',
        '  name: string',
        '  value: number',
        '}',
        '',
        'export class TestClass implements TestInterface {',
        '  constructor(',
        '    public id: string,',
        '    public name: string,',
        '    public value: number',
        '  ) {}',
        '',
        '  public getValue(): number {',
        '    return this.value * 2',
        '  }',
        '}',
        ''
      ].join('\n');

      // 1. Create file using secure file operations
      const metadata = await fileOps.createFile(filePath, fileContent);
      expect(metadata.path).toBe(filePath);
      expect(metadata.size).toBe(fileContent.length);

      // 2. Start file watcher and track changes
      const watchEvents: any[] = []
      fileWatcher.on('file-change', (event) => {
        watchEvents.push(event)});

      await fileWatcher.start()

      // 3. Initialize lazy loading for the file
      // Mock the file analysis API since we're in a test environment
      global.fetch = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            filePath,
            totalLines: fileContent.split('\n').length,
            totalSize: fileContent.length,
            lineBreaks: fileContent.split('').map((char, index) => char === '\n' ? index : -1).filter(i => i !== -1)
          })
        }))
        .mockImplementation(() => Promise.resolve({
          ok: true,
          text: () => Promise.resolve(fileContent.split('\n').slice(0, 50).join('\n'))
        }));

      await lazyLoader.initializeFile(filePath);

      // 4. Read file content through lazy loading
      const lines = await lazyLoader.getLineRange(0, 10)
      expect(lines[0]).toBe('export interface TestInterface {')
      expect(lines[1]).toBe('  id: string')

      // 5. Update file and verify change detection
      const updatedContent = fileContent.replace('value: number', 'value: number | string');
      await fileOps.updateFile(filePath, updatedContent);

      // Wait for file watcher to detect changes
      await new Promise(resolve => setTimeout(resolve, 200))

      // 6. Search in the updated file
      global.fetch = jest.fn().mockImplementation(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(updatedContent.split('\n').slice(0, 50).join('\n'))}))

      const searchResults = await lazyLoader.searchInFile('string', { maxResults: 5 });
      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults.some(result => result.content.includes('value: number | string'))).toBe(true)

      // 7. Test file locking during concurrent operations
      const lock = await fileOps.acquireLock(filePath, 'exclusive');
      expect(lock.lockId).toBeDefined()

      // Concurrent lock should fail
      await expect(
        fileOps.acquireLock(filePath, 'exclusive', 'other-user')).rejects.toThrow('File is locked');

      await fileOps.releaseLock(filePath, lock.lockId);

      // 8. Delete file and verify cleanup
      await fileOps.deleteFile(filePath)

      await expect(fileOps.readFile(filePath)).rejects.toThrow()}, 10000) // Extended timeout for integration test

    it('should handle large file operations with chunked loading', async () => {
      const largeFileName = 'large-integration-test.txt';
      const largeFilePath = path.join(testWorkspacePath, largeFileName);

      // Generate large content (10,000 lines);
      const largeContent = Array.from({ length: 10000 }, (_, i) =>
        `Line ${i + 1}: This is a test line with some content that makes the file larger.`
      ).join('\n');

      // Create large file
      const metadata = await fileOps.createFile(largeFilePath, largeContent);
      expect(metadata.size).toBe(largeContent.length)

      // Initialize lazy loading
      global.fetch = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            filePath: largeFilePath,
            totalLines: 10000,
            totalSize: largeContent.length,
            lineBreaks: []
          })
        }))
        .mockImplementation((url) => {
          // Extract start and end from URL params
          const urlObj = new URL(url, 'http://localhost')
          const start = parseInt(urlObj.searchParams.get('start') || '0')
          const end = parseInt(urlObj.searchParams.get('end') || '50')

          const lines = largeContent.split('\n').slice(start, end + 1)
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(lines.join('\n'))
          })});

      await lazyLoader.initializeFile(largeFilePath);

      // Test lazy loading performance
      const start = Date.now();

      // Load different chunks
      const chunk1 = await lazyLoader.getLineRange(0, 100);
      const chunk2 = await lazyLoader.getLineRange(5000, 5100);
      const chunk3 = await lazyLoader.getLineRange(9900, 9999);

      const loadTime = Date.now() - start;

      expect(chunk1).toHaveLength(101);
      expect(chunk2).toHaveLength(101);
      expect(chunk3).toHaveLength(100) // Last chunk might be smaller
      expect(loadTime).toBeLessThan(1000) // Should be fast due to chunking

      // Verify cache statistics
      const cacheStats = lazyLoader.getCacheStats();
      expect(cacheStats.cachedChunks).toBeGreaterThan(0);
      expect(cacheStats.cachedChunks).toBeLessThanOrEqual(5) // maxCachedChunks

      // Test search performance on large file
      const searchStart = Date.now()
      const searchResults = await lazyLoader.searchInFile('Line 5000:', { maxResults: 1 });
      const searchTime = Date.now() - searchStart;

      expect(searchResults).toHaveLength(1)
      expect(searchResults[0].content).toContain('Line 5000:');
      expect(searchTime).toBeLessThan(2000) // Reasonable search time

      // Clean up
      await fileOps.deleteFile(largeFilePath)}, 15000)})

  describe('Real-time Collaboration Simulation', () => {
    it('should handle concurrent file operations from multiple users', async () => {
      const collaborativeFile = 'collaborative-test.md';
      const filePath = path.join(testWorkspacePath, collaborativeFile)
      const initialContent = '# Collaborative Document\n\nThis is a shared document.\n';

      // Create initial file
      await fileOps.createFile(filePath, initialContent)

      // Simulate multiple users with different file operation instances
      const user1Ops = new SecureFileSystemOperations(testWorkspacePath, 'user1')
      const user2Ops = new SecureFileSystemOperations(testWorkspacePath, 'user2')

      try {
        // User 1 acquires lock and makes changes
        const user1Lock = await user1Ops.acquireLock(filePath, 'exclusive')
        const user1Content = initialContent + '\n## User 1 Changes\n\nSome content from user 1.\n';
        await user1Ops.updateFile(filePath, user1Content);

        // User 2 tries to acquire lock (should fail)
        await expect(
          user2Ops.acquireLock(filePath, 'exclusive')).rejects.toThrow('File is locked');

        // User 1 releases lock
        await user1Ops.releaseLock(filePath, user1Lock.lockId)

        // User 2 can now acquire lock
        const user2Lock = await user2Ops.acquireLock(filePath, 'exclusive')

        // User 2 makes conflicting changes
        const user2Content = initialContent + '\n## User 2 Changes\n\nDifferent content from user 2.\n';

        // This should create a conflict since file was modified by user 1
        const currentMetadata = await user2Ops.getFileMetadata(filePath);
        const user1Metadata = {
          ...currentMetadata,
          modified: currentMetadata.modified - 1000,
          checksum: 'different-checksum'
        };
        const conflict = await user2Ops.checkForConflicts(filePath, user1Metadata);
        expect(conflict.hasConflict).toBe(true)

        // Resolve conflict with merge strategy
        const resolution = await user2Ops.resolveConflict(filePath, user2Content, 'user-choice')
        expect(resolution.strategy).toBe('user-choice');

        await user2Ops.releaseLock(filePath, user2Lock.lockId)} finally {
        await user1Ops.destroy();
        await user2Ops.destroy()}
    })

    it('should coordinate file watching with WebSocket notifications', async () => {
      const notificationFile = 'notification-test.js';
      const filePath = path.join(testWorkspacePath, notificationFile);

      // Track all events
      const fileEvents: any[] = [];
      const connectionEvents: any[] = []

      // Setup file watcher
      fileWatcher.on('batch', (batch) => {
        fileEvents.push(...batch.events)});

      await fileWatcher.start();

      // Setup WebSocket connection (mocked);
      const mockWebSocket = new EventEmitter();
      Object.assign(mockWebSocket, {
        readyState: 1, // OPEN
        send: jest.fn(),
        close: jest.fn(),
        ping: jest.fn()
      })

      global.WebSocket = jest.fn().mockImplementation(() => {
        setTimeout(() => mockWebSocket.emit('open'), 10);
        return mockWebSocket}) as any

      const connection = await connectionPool.getConnection('ws://localhost:8080/notifications')

      // Subscribe to connection events
      connectionPool.subscribeToConnection(connection.id, 'test-subscriber', {
        onMessage: (data) => {
          connectionEvents.push(JSON.parse(data))}
      });

      // Create file (should trigger file watcher)
      const content = 'console.log("Hello from notification test");';
      await fileOps.createFile(filePath, content)

      // Simulate WebSocket message about the file change
      const notificationMessage = {
        type: 'file-change',
        path: filePath,
        action: 'create',
        userId: 'remote-user',
        timestamp: Date.now()}

      // Send message through connection
      await connectionPool.sendMessage(connection.id, JSON.stringify(notificationMessage))

      // Simulate receiving the message
      mockWebSocket.emit('message', JSON.stringify(notificationMessage));

      // Wait for events to be processed
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify file watcher detected the change
      expect(fileEvents.length).toBeGreaterThan(0);

      // Verify connection received notification
      expect(connectionEvents.length).toBeGreaterThan(0)
      expect(connectionEvents[0].type).toBe('file-change');
      expect(connectionEvents[0].path).toBe(filePath);

      // Test performance metrics
      const watcherStats = fileWatcher.getStats();
      expect(watcherStats.totalEvents).toBeGreaterThan(0);

      const connectionMetrics = connectionPool.getMetrics();
      expect(connectionMetrics.totalMessages).toBeGreaterThan(0)})})

  describe('Workspace Management Integration', () => {
    it('should manage multiple workspace watchers', async () => {
      const workspaceManager = new WorkspaceWatcherManager()

      try {
        // Create multiple workspace directories
        const workspace1Path = path.join(testWorkspacePath, 'workspace1')
        const workspace2Path = path.join(testWorkspacePath, 'workspace2');

        await fs.mkdir(workspace1Path, { recursive: true });
        await fs.mkdir(workspace2Path, { recursive: true })

        // Create watchers for each workspace
        const watcher1 = await workspaceManager.createWatcher('ws1', workspace1Path)
        const watcher2 = await workspaceManager.createWatcher('ws2', workspace2Path);

        expect(watcher1.isActive()).toBe(true);
        expect(watcher2.isActive()).toBe(true)

        // Create files in each workspace
        const file1Path = path.join(workspace1Path, 'file1.ts')
        const file2Path = path.join(workspace2Path, 'file2.ts')

        const fileOps1 = new SecureFileSystemOperations(workspace1Path, 'user1')
        const fileOps2 = new SecureFileSystemOperations(workspace2Path, 'user2')

        try {
          await fileOps1.createFile(file1Path, 'console.log("workspace 1");')
          await fileOps2.createFile(file2Path, 'console.log("workspace 2");');

          // Wait for file watcher events
          await new Promise(resolve => setTimeout(resolve, 200));

          // Check global statistics
          const globalStats = workspaceManager.getGlobalStats();
          expect(globalStats.totalWorkspaces).toBe(2);
          expect(globalStats.totalEvents).toBeGreaterThan(0)

          // Get individual workspace watchers
          const retrievedWatcher1 = workspaceManager.getWatcher('ws1')
          const retrievedWatcher2 = workspaceManager.getWatcher('ws2');

          expect(retrievedWatcher1).toBe(watcher1);
          expect(retrievedWatcher2).toBe(watcher2)

          // Remove one workspace
          await workspaceManager.removeWatcher('ws1')
          expect(workspaceManager.getWatcher('ws1')).toBeUndefined()
          expect(workspaceManager.getWatcher('ws2')).toBeDefined()} finally {
          await fileOps1.destroy();
          await fileOps2.destroy()}

      } finally {
        await workspaceManager.destroy()}
    })})

  describe('Error Recovery and Resilience', () => {
    it('should recover from file system errors gracefully', async () => {
      const errorFile = 'error-test.txt';
      const filePath = path.join(testWorkspacePath, errorFile)

      // Create file
      await fileOps.createFile(filePath, 'test content');

      // Simulate file system error by removing file externally
      await fs.unlink(filePath);

      // Attempt to read should handle error gracefully
      await expect(fileOps.readFile(filePath)).rejects.toThrow()

      // File operations should still work for other files
      const otherFile = path.join(testWorkspacePath, 'other-file.txt')
      await expect(
        fileOps.createFile(otherFile, 'other content')).resolves.not.toThrow();

      // Clean up
      await fileOps.deleteFile(otherFile)})

    it('should handle WebSocket connection failures', async () => {
      const connectionErrors: any[] = []
      connectionPool.on('connection-error', (error) => {
        connectionErrors.push(error)});

      // Mock failing WebSocket
      global.WebSocket = jest.fn().mockImplementation(() => {
        const mockSocket = new EventEmitter();
        Object.assign(mockSocket, {
          readyState: 3, // CLOSED
          send: jest.fn(),
          close: jest.fn(),
          ping: jest.fn()
        })

        setTimeout(() => {
          mockSocket.emit('error', new Error('Connection failed'))}, 10);

        return mockSocket}) as any

      // Attempt connection
      try {
        await connectionPool.getConnection('ws://invalid-url:8080')} catch (error) {
        // Expected to fail
      }

      // Wait for error event
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(connectionErrors.length).toBeGreaterThan(0);

      // Pool should still be functional for other connections
      const metrics = connectionPool.getMetrics();
      expect(metrics.failedConnections).toBeGreaterThan(0)})

    it('should handle lazy loading errors gracefully', async () => {
      const errorFile = 'lazy-error-test.txt';
      const filePath = path.join(testWorkspacePath, errorFile)

      // Mock fetch to return error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      // Should handle initialization error
      await expect(lazyLoader.initializeFile(filePath)).rejects.toThrow('Network error');

      // Lazy loader should still be functional after error
      expect(() => lazyLoader.getCacheStats()).not.toThrow()})})

  describe('Performance and Resource Management', () => {
    it('should manage memory usage effectively', async () => {
      const performanceFile = 'performance-test.txt';
      const filePath = path.join(testWorkspacePath, performanceFile)

      // Create moderately large file
      const content = 'line content\n'.repeat(5000) // 5000 lines;
      await fileOps.createFile(filePath, content);

      // Configure lazy loader with smaller cache
      const memoryLazyLoader = new LazyFileLoader({
        chunkSize: 100,
        maxCachedChunks: 3, // Small cache
        preloadChunks: 1
      })

      try {
        // Mock file analysis
        global.fetch = jest.fn()
          .mockImplementationOnce(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              filePath,
              totalLines: 5000,
              totalSize: content.length,
              lineBreaks: []
            })
          }))
          .mockImplementation(() => Promise.resolve({
            ok: true,
            text: () => Promise.resolve('line content\n'.repeat(100))
          }));

        await memoryLazyLoader.initializeFile(filePath);

        // Load many chunks to test cache management
        for (let i = 0; i < 10; i++) {
          await memoryLazyLoader.getLineRange(i * 100, i * 100 + 50)}

        // Cache should respect size limits
        const stats = memoryLazyLoader.getCacheStats();
        expect(stats.cachedChunks).toBeLessThanOrEqual(3);
        expect(stats.totalCacheSize).toBeGreaterThan(0)} finally {
        memoryLazyLoader.destroy();
        await fileOps.deleteFile(filePath)}
    })

    it('should handle high-frequency file changes efficiently', async () => {
      const highFreqFile = 'high-frequency-test.txt';
      const filePath = path.join(testWorkspacePath, highFreqFile);

      // Configure watcher for high-frequency events
      const fastWatcher = new OptimizedFileWatcher({
        watchPath: testWorkspacePath,
        batchDelay: 50,
        maxBatchSize: 5,
        throttleDelay: 25
      });

      try {
        const batchEvents: any[] = []
        fastWatcher.on('batch', (batch) => {
          batchEvents.push(batch)});

        await fastWatcher.start()

        // Create file
        await fileOps.createFile(filePath, 'initial content');

        // Simulate rapid changes
        for (let i = 0; i < 20; i++) {
          await fileOps.updateFile(filePath, `content update ${i}`);
          await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
        }

        // Wait for batching
        await new Promise(resolve => setTimeout(resolve, 200));

        // Should have batched events efficiently
        const stats = fastWatcher.getStats();
        expect(stats.totalEvents).toBeGreaterThan(0);
        expect(stats.batchesProcessed).toBeGreaterThan(0);
        expect(stats.averageBatchSize).toBeGreaterThan(1) // Events should be batched

        // Batch count should be less than total events (proving batching works);
        expect(stats.batchesProcessed).toBeLessThan(stats.totalEvents)} finally {
        await fastWatcher.destroy();
        await fileOps.deleteFile(filePath)}
    })})});
