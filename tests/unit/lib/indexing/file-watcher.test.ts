/**
 * Unit tests for file-watcher.ts
 * Tests file watching operations, event handling, and debouncing
 */

// Mock modules BEFORE imports
jest.mock('chokidar', () => ({
  watch: jest.fn(),
}));
jest.mock('fs/promises');
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('test-hash-123'),
  })),
}));

import { FileWatcher, FileWatcherConfig, FileChangeEvent, FileChangeType } from '@/lib/indexing/file-watcher';
import fs from 'fs/promises';
import crypto from 'crypto';
import { EventEmitter } from 'events';

// Get the mocked chokidar module
const chokidar = require('chokidar');

describe('FileWatcher', () => {
  let mockWatcher: any;
  let fileWatcher: FileWatcher;
  const testConfig: FileWatcherConfig = {
    watchPath: '/test/project',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    ignorePatterns: ['test/**'],
    debounceMs: 10, // Very short debounce for testing
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock chokidar watcher
    mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    (chokidar.watch as jest.Mock).mockReturnValue(mockWatcher);

    // Mock fs.stat
    (fs.stat as jest.Mock).mockResolvedValue({
      isDirectory: () => true,
    });

    // Mock fs.readFile
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('test content'));
  });

  afterEach(async () => {
    if (fileWatcher) {
      await fileWatcher.dispose();
    }
  });

  describe('constructor', () => {
    it('should create FileWatcher with valid config', () => {
      fileWatcher = new FileWatcher(testConfig);
      expect(fileWatcher).toBeDefined();
    });

    it('should throw error if watchPath is missing', () => {
      const invalidConfig = { ...testConfig, watchPath: '' };
      expect(() => new FileWatcher(invalidConfig as any)).toThrow(
        'watchPath is required and must be a string'
      );
    });

    it('should throw error if watchPath is not a string', () => {
      const invalidConfig = { ...testConfig, watchPath: 123 };
      expect(() => new FileWatcher(invalidConfig as any)).toThrow(
        'watchPath is required and must be a string'
      );
    });

    it('should throw error if workspaceId is missing', () => {
      const invalidConfig = { ...testConfig, workspaceId: '' };
      expect(() => new FileWatcher(invalidConfig as any)).toThrow(
        'workspaceId is required and must be a string'
      );
    });

    it('should throw error if projectId is missing', () => {
      const invalidConfig = { ...testConfig, projectId: '' };
      expect(() => new FileWatcher(invalidConfig as any)).toThrow(
        'projectId is required and must be a string'
      );
    });

    it('should normalize watchPath to absolute path', () => {
      const config = { ...testConfig, watchPath: './relative/path' };
      fileWatcher = new FileWatcher(config);
      const normalizedConfig = fileWatcher.getConfig();
      expect(normalizedConfig.watchPath).not.toContain('./');
    });

    it('should merge default ignore patterns with custom patterns', () => {
      fileWatcher = new FileWatcher(testConfig);
      const config = fileWatcher.getConfig();
      expect(config.ignorePatterns).toContain('**/node_modules/**');
      expect(config.ignorePatterns).toContain('**/.git/**');
      expect(config.ignorePatterns).toContain('test/**');
    });

    it('should set default debounce time to 500ms', () => {
      const configWithoutDebounce = { ...testConfig };
      delete configWithoutDebounce.debounceMs;
      fileWatcher = new FileWatcher(configWithoutDebounce);
      const config = fileWatcher.getConfig();
      expect(config.debounceMs).toBe(500);
    });

    it('should set default watch flags to true', () => {
      fileWatcher = new FileWatcher(testConfig);
      const config = fileWatcher.getConfig();
      expect(config.watchAdd).toBe(true);
      expect(config.watchChange).toBe(true);
      expect(config.watchUnlink).toBe(true);
    });

    it('should respect custom watch flags', () => {
      const customConfig = {
        ...testConfig,
        watchAdd: false,
        watchChange: true,
        watchUnlink: false,
      };
      fileWatcher = new FileWatcher(customConfig);
      const config = fileWatcher.getConfig();
      expect(config.watchAdd).toBe(false);
      expect(config.watchChange).toBe(true);
      expect(config.watchUnlink).toBe(false);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      fileWatcher = new FileWatcher(testConfig);
    });

    it('should start watching the directory', async () => {
      // Trigger ready event
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();

      expect(chokidar.watch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ignored: expect.arrayContaining(['**/node_modules/**']),
          persistent: true,
          ignoreInitial: true,
        })
      );
      expect(fileWatcher.isActive()).toBe(true);
    });

    it('should verify watch path exists before starting', async () => {
      (fs.stat as jest.Mock).mockRejectedValue(new Error('Directory not found'));

      await expect(fileWatcher.start()).rejects.toThrow(
        'Failed to start FileWatcher'
      );
    });

    it('should throw error if watch path is not a directory', async () => {
      (fs.stat as jest.Mock).mockResolvedValue({
        isDirectory: () => false,
      });

      await expect(fileWatcher.start()).rejects.toThrow(
        'Watch path is not a directory'
      );
    });

    it('should throw error if already watching', async () => {
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();
      await expect(fileWatcher.start()).rejects.toThrow(
        'FileWatcher is already watching'
      );
    });

    it('should emit ready event when watcher is ready', async () => {
      const readyCallback = jest.fn();
      fileWatcher.on('ready', readyCallback);

      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();

      expect(readyCallback).toHaveBeenCalled();
    });

    it('should register add handler if watchAdd is true', async () => {
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();

      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
    });

    it('should not register add handler if watchAdd is false', async () => {
      const customConfig = { ...testConfig, watchAdd: false };
      fileWatcher = new FileWatcher(customConfig);

      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();

      const addCalls = (mockWatcher.on as jest.Mock).mock.calls.filter(
        call => call[0] === 'add'
      );
      expect(addCalls.length).toBe(0);
    });

    it('should register error handler', async () => {
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();

      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      fileWatcher = new FileWatcher(testConfig);
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });
      await fileWatcher.start();
    });

    it('should stop watching the directory', async () => {
      await fileWatcher.stop();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(fileWatcher.isActive()).toBe(false);
    });

    it('should clear all debounce timers', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

      // Trigger a file change to create a debounce timer
      const addHandler = (mockWatcher.on as jest.Mock).mock.calls.find(
        call => call[0] === 'add'
      )?.[1];
      if (addHandler) {
        addHandler('/test/file.ts');
      }

      await fileWatcher.stop();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should do nothing if not watching', async () => {
      await fileWatcher.stop();
      const closeCallsBefore = (mockWatcher.close as jest.Mock).mock.calls.length;

      await fileWatcher.stop();
      const closeCallsAfter = (mockWatcher.close as jest.Mock).mock.calls.length;

      expect(closeCallsAfter).toBe(closeCallsBefore);
    });
  });

  describe('file change events', () => {
    let addHandler: (path: string) => void;
    let changeHandler: (path: string) => void;
    let unlinkHandler: (path: string) => void;

    beforeEach(async () => {
      fileWatcher = new FileWatcher(testConfig);

      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'add') addHandler = callback;
        if (event === 'change') changeHandler = callback;
        if (event === 'unlink') unlinkHandler = callback;
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();
    });

    it('should emit file-added event on file addition', async () => {
      const fileAddedCallback = jest.fn();
      fileWatcher.on('file-added', fileAddedCallback);

      addHandler('/test/project/new-file.ts');

      // Wait for debounce to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(fileAddedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'add',
          filePath: '/test/project/new-file.ts',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should emit file-changed event on file modification', async () => {
      const fileChangedCallback = jest.fn();
      fileWatcher.on('file-changed', fileChangedCallback);

      // First change to establish hash
      changeHandler('/test/project/existing-file.ts');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second change with different content
      (crypto.createHash as jest.Mock).mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('new-hash-456'),
      });

      changeHandler('/test/project/existing-file.ts');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(fileChangedCallback).toHaveBeenCalled();
    });

    it('should emit file-deleted event on file deletion', async () => {
      const fileDeletedCallback = jest.fn();
      fileWatcher.on('file-deleted', fileDeletedCallback);

      unlinkHandler('/test/project/deleted-file.ts');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(fileDeletedCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'unlink',
          filePath: '/test/project/deleted-file.ts',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should debounce rapid consecutive changes', async () => {
      const fileChangedCallback = jest.fn();
      fileWatcher.on('file-changed', fileChangedCallback);

      // Trigger multiple rapid changes
      changeHandler('/test/project/file.ts');
      await new Promise(resolve => setTimeout(resolve, 5));
      changeHandler('/test/project/file.ts');
      await new Promise(resolve => setTimeout(resolve, 5));
      changeHandler('/test/project/file.ts');

      // Wait for debounce to complete after last change
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should only emit once after debounce
      expect(fileChangedCallback).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate changes with same file hash', async () => {
      const fileChangedCallback = jest.fn();
      fileWatcher.on('file-changed', fileChangedCallback);

      // First change
      changeHandler('/test/project/file.ts');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second change with same hash
      changeHandler('/test/project/file.ts');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should only emit once (hash hasn't changed)
      expect(fileChangedCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle file read errors gracefully', async () => {
      const fileChangedCallback = jest.fn();
      fileWatcher.on('file-changed', fileChangedCallback);

      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      changeHandler('/test/project/file.ts');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not emit event if file cannot be read
      expect(fileChangedCallback).not.toHaveBeenCalled();
    });

    it('should remove file hash on deletion', async () => {
      // Add file first
      addHandler('/test/project/file.ts');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Delete file
      unlinkHandler('/test/project/file.ts');
      await new Promise(resolve => setTimeout(resolve, 50));

      // Add same file again - should trigger event
      const fileAddedCallback = jest.fn();
      fileWatcher.on('file-added', fileAddedCallback);

      addHandler('/test/project/file.ts');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(fileAddedCallback).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      fileWatcher = new FileWatcher(testConfig);
    });

    it('should emit error event on watcher errors', async () => {
      const errorCallback = jest.fn();
      let errorHandler: (error: Error) => void;

      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'error') errorHandler = callback;
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      fileWatcher.on('error', errorCallback);
      await fileWatcher.start();

      const testError = new Error('Watcher error');
      errorHandler!(testError);

      expect(errorCallback).toHaveBeenCalledWith(testError);
    });
  });

  describe('isActive', () => {
    beforeEach(() => {
      fileWatcher = new FileWatcher(testConfig);
    });

    it('should return false before starting', () => {
      expect(fileWatcher.isActive()).toBe(false);
    });

    it('should return true after starting', async () => {
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();

      expect(fileWatcher.isActive()).toBe(true);
    });

    it('should return false after stopping', async () => {
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });

      await fileWatcher.start();
      await fileWatcher.stop();

      expect(fileWatcher.isActive()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      fileWatcher = new FileWatcher(testConfig);
      const config = fileWatcher.getConfig();

      expect(config).toMatchObject({
        workspaceId: 'workspace-1',
        projectId: 'project-1',
        debounceMs: 10,
      });
    });

    it('should return readonly configuration', () => {
      fileWatcher = new FileWatcher(testConfig);
      const config = fileWatcher.getConfig();

      // Modifying the returned config should not affect internal config
      (config as any).workspaceId = 'modified';

      const config2 = fileWatcher.getConfig();
      expect(config2.workspaceId).toBe('workspace-1');
    });
  });

  describe('dispose', () => {
    beforeEach(async () => {
      fileWatcher = new FileWatcher(testConfig);
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });
      await fileWatcher.start();
    });

    it('should stop watching when disposed', async () => {
      await fileWatcher.dispose();

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(fileWatcher.isActive()).toBe(false);
    });

    it('should remove all event listeners', async () => {
      const removeAllListenersSpy = jest.spyOn(fileWatcher, 'removeAllListeners');

      await fileWatcher.dispose();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });

    it('should be safe to call multiple times', async () => {
      await fileWatcher.dispose();
      await expect(fileWatcher.dispose()).resolves.not.toThrow();
    });
  });

  describe('event type safety', () => {
    beforeEach(async () => {
      fileWatcher = new FileWatcher(testConfig);
      mockWatcher.on.mockImplementation((event: string, callback: any) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
        return mockWatcher;
      });
      await fileWatcher.start();
    });

    it('should enforce correct event types', () => {
      // These should compile without errors due to type-safe event interface
      fileWatcher.on('file-added', (event: FileChangeEvent) => {
        expect(event.type).toBe('add');
      });

      fileWatcher.on('file-changed', (event: FileChangeEvent) => {
        expect(event.type).toBe('change');
      });

      fileWatcher.on('file-deleted', (event: FileChangeEvent) => {
        expect(event.type).toBe('unlink');
      });

      fileWatcher.on('error', (error: Error) => {
        expect(error).toBeInstanceOf(Error);
      });

      fileWatcher.on('ready', () => {
        // 'ready' event fires with no arguments - registration verified by callback being called
      });
    });
  });
});
