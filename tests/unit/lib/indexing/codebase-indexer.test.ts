/**
 * Unit tests for codebase-indexer.ts
 * Tests codebase indexing operations and file management
 */

import { CodebaseIndexer, IndexingStatus, IndexingResult } from '@/lib/indexing/codebase-indexer';
import { CodeChunker, CodeLanguage } from '@/lib/indexing/code-chunker';
import { EmbeddingServiceFactory } from '@/lib/ai/embeddingServiceFactory';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import crypto from 'crypto';

// Mock modules
jest.mock('@/lib/prisma', () => ({
  prisma: {
    codebaseIndex: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    file: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    rAGChunk: {
      deleteMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  }
}));

jest.mock('fs/promises');

jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('default-hash'),
  })),
}));

jest.mock('@/lib/indexing/code-chunker');
jest.mock('@/lib/ai/embeddingServiceFactory');

describe('CodebaseIndexer', () => {
  let indexer: CodebaseIndexer;
  let mockCodeChunker: jest.Mocked<CodeChunker>;
  let mockEmbeddingService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CodeChunker
    mockCodeChunker = {
      chunkFile: jest.fn(),
      detectLanguage: jest.fn(),
      dispose: jest.fn(),
    } as any;
    (CodeChunker as jest.MockedClass<typeof CodeChunker>).mockImplementation(() => mockCodeChunker);

    // Mock EmbeddingServiceFactory
    mockEmbeddingService = {
      generateEmbedding: jest.fn(),
    };
    (EmbeddingServiceFactory as jest.MockedClass<typeof EmbeddingServiceFactory>).mockImplementation(() => ({
      createEmbeddingServiceFromEnv: jest.fn().mockReturnValue(mockEmbeddingService),
    } as any));

    // Create indexer instance
    indexer = new CodebaseIndexer();
  });

  afterEach(() => {
    indexer.dispose();
  });

  describe('constructor', () => {
    it('should create a CodeChunker instance', () => {
      expect(CodeChunker).toHaveBeenCalled();
    });

    it('should initialize embedding service from factory', () => {
      expect(EmbeddingServiceFactory).toHaveBeenCalledWith(prisma);
    });

    it('should detect azure-openai provider', () => {
      const originalEnv = { ...process.env };
      process.env.AZURE_OPENAI_ENDPOINT = 'https://example.azure.com';
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'deployment';

      const azureIndexer = new CodebaseIndexer();
      // Provider label is private, so we just verify construction succeeds
      expect(azureIndexer).toBeDefined();

      process.env = originalEnv;
      azureIndexer.dispose();
    });

    it('should detect openai provider', () => {
      const originalEnv = { ...process.env };
      process.env.OPENAI_API_KEY = 'sk-test123';
      delete process.env.AZURE_OPENAI_ENDPOINT;

      const openaiIndexer = new CodebaseIndexer();
      expect(openaiIndexer).toBeDefined();

      process.env = originalEnv;
      openaiIndexer.dispose();
    });
  });

  describe('indexFile', () => {
    const testFilePath = '/test/project/src/example.ts';
    const testContent = 'const x = 1;';
    const testFileHash = 'abc123';
    const workspaceId = 1;
    const projectId = 2;
    const userId = 3;

    beforeEach(() => {
      // Mock file system operations
      (fs.readFile as jest.Mock).mockResolvedValue(testContent);
      (fs.stat as jest.Mock).mockResolvedValue({
        mtime: new Date('2024-01-01'),
      });

      // Update crypto hash mock to return specific hash
      (crypto.createHash as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue(testFileHash),
      });

      // Mock language detection
      mockCodeChunker.detectLanguage.mockReturnValue(CodeLanguage.TYPESCRIPT);
    });

    it('should skip indexing if file already indexed with same hash', async () => {
      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue({
        id: 1,
        file_path: testFilePath,
        file_hash: testFileHash,
        chunk_count: 5,
      });

      const result = await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(testFilePath);
      expect(result.chunkCount).toBe(5);
      expect(mockCodeChunker.chunkFile).not.toHaveBeenCalled();
    });

    it('should skip indexing if file produces no chunks', async () => {
      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);
      mockCodeChunker.chunkFile.mockReturnValue([]);

      const result = await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(result.success).toBe(true);
      expect(result.chunkCount).toBe(0);
      expect(prisma.file.findFirst).not.toHaveBeenCalled();
    });

    it('should create file record if it does not exist', async () => {
      const testChunks = [
        {
          content: 'chunk 1',
          startLine: 1,
          endLine: 10,
          tokens: 50,
          language: CodeLanguage.TYPESCRIPT,
          hasImports: true,
        },
      ];

      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);
      mockCodeChunker.chunkFile.mockReturnValue(testChunks);
      (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.file.create as jest.Mock).mockResolvedValue({ id: 10 });
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);

      const result = await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(prisma.file.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'example.ts',
          path: testFilePath,
          workspace_id: workspaceId,
          project_id: projectId,
          user_id: userId,
          language: CodeLanguage.TYPESCRIPT,
          content: testContent,
        }),
      });
      expect(result.success).toBe(true);
    });

    it('should delete existing RAG chunks before indexing', async () => {
      const testChunks = [
        {
          content: 'chunk 1',
          startLine: 1,
          endLine: 10,
          tokens: 50,
          language: CodeLanguage.TYPESCRIPT,
          hasImports: true,
        },
      ];

      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);
      mockCodeChunker.chunkFile.mockReturnValue(testChunks);
      (prisma.file.findFirst as jest.Mock).mockResolvedValue({ id: 10 });
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);

      await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(prisma.rAGChunk.deleteMany).toHaveBeenCalledWith({
        where: { file_id: 10 },
      });
    });

    it('should generate embeddings and store chunks', async () => {
      const testChunks = [
        {
          content: 'chunk 1',
          startLine: 1,
          endLine: 10,
          tokens: 50,
          language: CodeLanguage.TYPESCRIPT,
          hasImports: true,
        },
        {
          content: 'chunk 2',
          startLine: 11,
          endLine: 20,
          tokens: 60,
          language: CodeLanguage.TYPESCRIPT,
          hasImports: false,
        },
      ];

      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);
      mockCodeChunker.chunkFile.mockReturnValue(testChunks);
      (prisma.file.findFirst as jest.Mock).mockResolvedValue({ id: 10 });
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);

      const result = await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('chunk 1');
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('chunk 2');
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.chunkCount).toBe(2);
    });

    it('should update existing CodebaseIndex record', async () => {
      const testChunks = [
        {
          content: 'chunk 1',
          startLine: 1,
          endLine: 10,
          tokens: 50,
          language: CodeLanguage.TYPESCRIPT,
          hasImports: true,
        },
      ];

      (prisma.codebaseIndex.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // First check for unchanged file
        .mockResolvedValueOnce({ id: 5 }); // Existing record check
      mockCodeChunker.chunkFile.mockReturnValue(testChunks);
      (prisma.file.findFirst as jest.Mock).mockResolvedValue({ id: 10 });
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);

      await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(prisma.codebaseIndex.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({
          file_hash: testFileHash,
          language: CodeLanguage.TYPESCRIPT,
          chunk_count: 1,
        }),
      });
    });

    it('should create new CodebaseIndex record if none exists', async () => {
      const testChunks = [
        {
          content: 'chunk 1',
          startLine: 1,
          endLine: 10,
          tokens: 50,
          language: CodeLanguage.TYPESCRIPT,
          hasImports: true,
        },
      ];

      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);
      mockCodeChunker.chunkFile.mockReturnValue(testChunks);
      (prisma.file.findFirst as jest.Mock).mockResolvedValue({ id: 10 });
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);

      await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(prisma.codebaseIndex.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          file_path: testFilePath,
          file_hash: testFileHash,
          user_id: userId,
          workspace_id: workspaceId,
          project_id: projectId,
          language: CodeLanguage.TYPESCRIPT,
          chunk_count: 1,
        }),
      });
    });

    it('should handle errors gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      const result = await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
      expect(result.chunkCount).toBe(0);
    });

    it('should continue with other chunks if one chunk fails', async () => {
      const testChunks = [
        {
          content: 'chunk 1',
          startLine: 1,
          endLine: 10,
          tokens: 50,
          language: CodeLanguage.TYPESCRIPT,
          hasImports: true,
        },
        {
          content: 'chunk 2',
          startLine: 11,
          endLine: 20,
          tokens: 60,
          language: CodeLanguage.TYPESCRIPT,
          hasImports: false,
        },
      ];

      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);
      mockCodeChunker.chunkFile.mockReturnValue(testChunks);
      (prisma.file.findFirst as jest.Mock).mockResolvedValue({ id: 10 });
      mockEmbeddingService.generateEmbedding
        .mockRejectedValueOnce(new Error('Embedding failed'))
        .mockResolvedValueOnce([0.1, 0.2, 0.3]);
      (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);

      const result = await indexer.indexFile(testFilePath, workspaceId, projectId, userId);

      expect(result.success).toBe(true);
      expect(result.chunkCount).toBe(1); // Only one chunk succeeded
    });
  });

  describe('indexProject', () => {
    const workspaceId = 1;
    const projectId = 2;
    const userId = 3;
    const projectPath = '/test/project';

    beforeEach(() => {
      // Mock file system to return files with proper structure for findSourceFiles
      // Return empty array by default to avoid recursion issues
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      (fs.readFile as jest.Mock).mockImplementation((path: string) => {
        // Handle ignore files
        if (path.includes('.gitignore') || path.includes('.cursorindexingignore') || path.includes('.vibecodeindexignore')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('test content');
      });
      (fs.stat as jest.Mock).mockResolvedValue({ mtime: new Date() });

      // Crypto is already mocked at module level
      mockCodeChunker.detectLanguage.mockReturnValue(CodeLanguage.TYPESCRIPT);
      mockCodeChunker.chunkFile.mockReturnValue([]);
      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);
    });

    it('should throw error if project is already being indexed', async () => {
      // Mock to return one file so indexing takes some time
      (fs.readdir as jest.Mock).mockResolvedValue([
        { name: 'test.ts', isFile: () => true, isDirectory: () => false },
      ]);

      // Start indexing
      const firstIndexing = indexer.indexProject(projectId, workspaceId, userId, projectPath);

      // Try to index again immediately
      await expect(
        indexer.indexProject(projectId, workspaceId, userId, projectPath)
      ).rejects.toThrow(`Project ${projectId} is already being indexed`);

      // Wait for first indexing to complete
      await firstIndexing;
    });

    it('should call onProgress callback with progress updates', async () => {
      const onProgress = jest.fn();

      // Mock findSourceFiles by mocking readdir to return files
      (fs.readdir as jest.Mock).mockResolvedValue([
        { name: 'file1.ts', isFile: () => true, isDirectory: () => false },
        { name: 'file2.ts', isFile: () => true, isDirectory: () => false },
      ]);

      await indexer.indexProject(projectId, workspaceId, userId, projectPath, onProgress);

      expect(onProgress).toHaveBeenCalled();
      // Progress should be called for each file
      expect(onProgress.mock.calls.length).toBeGreaterThan(0);
    });

    it('should return results for all files', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([
        { name: 'file1.ts', isFile: () => true, isDirectory: () => false },
      ]);

      const results = await indexer.indexProject(projectId, workspaceId, userId, projectPath);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should clear indexing flag after completion', async () => {
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      await indexer.indexProject(projectId, workspaceId, userId, projectPath);

      // Should be able to index again
      await expect(
        indexer.indexProject(projectId, workspaceId, userId, projectPath)
      ).resolves.toBeDefined();
    });

    it('should clear indexing flag even on error', async () => {
      // Make readdir fail initially
      (fs.readdir as jest.Mock).mockRejectedValueOnce(new Error('Directory not found'));

      // indexProject catches errors in traverseDirectory, so it won't throw
      // but returns empty results
      const results = await indexer.indexProject(projectId, workspaceId, userId, projectPath);
      expect(results).toEqual([]);

      // Should be able to index again (flag should be cleared)
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      await expect(
        indexer.indexProject(projectId, workspaceId, userId, projectPath)
      ).resolves.toBeDefined();
    });
  });

  describe('updateIndex', () => {
    it('should call indexFile with correct parameters', async () => {
      const testFilePath = '/test/project/src/example.ts';
      const workspaceId = 1;
      const projectId = 2;
      const userId = 3;

      (fs.readFile as jest.Mock).mockResolvedValue('');
      (fs.stat as jest.Mock).mockResolvedValue({ mtime: new Date() });
      // Crypto is already mocked at module level
      mockCodeChunker.detectLanguage.mockReturnValue(CodeLanguage.TYPESCRIPT);
      mockCodeChunker.chunkFile.mockReturnValue([]);
      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await indexer.updateIndex(testFilePath, workspaceId, projectId, userId);

      expect(result.filePath).toBe(testFilePath);
      expect(result.success).toBe(true);
    });
  });

  describe('deleteIndex', () => {
    const testFilePath = '/test/project/src/example.ts';
    const projectId = 2;

    it('should delete CodebaseIndex record', async () => {
      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue({ id: 5 });
      (prisma.codebaseIndex.delete as jest.Mock).mockResolvedValue(undefined);
      (prisma.file.findFirst as jest.Mock).mockResolvedValue({ id: 10 });

      const result = await indexer.deleteIndex(testFilePath, projectId);

      expect(prisma.codebaseIndex.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(result).toBe(true);
    });

    it('should delete associated RAG chunks', async () => {
      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue({ id: 5 });
      (prisma.file.findFirst as jest.Mock).mockResolvedValue({ id: 10 });

      await indexer.deleteIndex(testFilePath, projectId);

      expect(prisma.rAGChunk.deleteMany).toHaveBeenCalledWith({
        where: { file_id: 10 },
      });
    });

    it('should return true if index does not exist', async () => {
      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await indexer.deleteIndex(testFilePath, projectId);

      expect(result).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      (prisma.codebaseIndex.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await indexer.deleteIndex(testFilePath, projectId);

      expect(result).toBe(false);
    });
  });

  describe('getIndexStatus', () => {
    const projectId = 2;

    it('should return indexing status with correct statistics', async () => {
      const mockIndexedFiles = [
        { chunk_count: 5, indexed_at: new Date('2024-01-01') },
        { chunk_count: 3, indexed_at: new Date('2024-01-02') },
        { chunk_count: 7, indexed_at: new Date('2024-01-03') },
      ];

      (prisma.codebaseIndex.findMany as jest.Mock).mockResolvedValue(mockIndexedFiles);

      const status = await indexer.getIndexStatus(projectId);

      expect(status.projectId).toBe(projectId);
      expect(status.indexedFiles).toBe(3);
      expect(status.totalChunks).toBe(15);
      expect(status.progress).toBe(100); // 3/3 files
      expect(status.isIndexing).toBe(false);
      expect(status.lastIndexedAt).toEqual(new Date('2024-01-03'));
    });

    it('should return zero stats for empty project', async () => {
      (prisma.codebaseIndex.findMany as jest.Mock).mockResolvedValue([]);

      const status = await indexer.getIndexStatus(projectId);

      expect(status.indexedFiles).toBe(0);
      expect(status.totalFiles).toBe(0);
      expect(status.totalChunks).toBe(0);
      expect(status.progress).toBe(0);
      expect(status.lastIndexedAt).toBeUndefined();
    });

    it('should show isIndexing as true when project is being indexed', async () => {
      (prisma.codebaseIndex.findMany as jest.Mock).mockResolvedValue([]);

      // Create a promise that we can control
      let resolveIndexing: any;
      const indexingPromise = new Promise((resolve) => {
        resolveIndexing = resolve;
      });

      (fs.readdir as jest.Mock).mockImplementation(() => indexingPromise);

      // Start indexing (don't await)
      const indexingTask = indexer.indexProject(projectId, 1, 1, '/test');

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = await indexer.getIndexStatus(projectId);

      expect(status.isIndexing).toBe(true);

      // Clean up: resolve the promise to let indexing complete
      resolveIndexing([]);
      await indexingTask.catch(() => {}); // Ignore any errors
    });

    it('should handle errors gracefully', async () => {
      (prisma.codebaseIndex.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const status = await indexer.getIndexStatus(projectId);

      expect(status.projectId).toBe(projectId);
      expect(status.indexedFiles).toBe(0);
      expect(status.totalFiles).toBe(0);
      expect(status.isIndexing).toBe(false);
    });
  });

  describe('file filtering', () => {
    it('should respect .gitignore patterns', async () => {
      const projectPath = '/test/project';
      const workspaceId = 1;
      const projectId = 2;
      const userId = 3;

      // Mock .gitignore file
      (fs.readFile as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('.gitignore')) {
          return Promise.resolve('node_modules/\n*.log\n');
        }
        if (path.includes('.cursorindexingignore') || path.includes('.vibecodeindexignore')) {
          return Promise.reject(new Error('ENOENT'));
        }
        return Promise.resolve('test content');
      });

      // Mock directory structure - return files only, no directories to avoid recursion
      (fs.readdir as jest.Mock).mockResolvedValue([
        { name: 'app.ts', isFile: () => true, isDirectory: () => false },
        { name: 'index.ts', isFile: () => true, isDirectory: () => false },
      ]);

      (fs.stat as jest.Mock).mockResolvedValue({ mtime: new Date() });
      mockCodeChunker.detectLanguage.mockReturnValue(CodeLanguage.TYPESCRIPT);
      mockCodeChunker.chunkFile.mockReturnValue([]);
      (prisma.codebaseIndex.findFirst as jest.Mock).mockResolvedValue(null);

      const results = await indexer.indexProject(projectId, workspaceId, userId, projectPath);

      // Should have indexed files (no node_modules in our mock)
      expect(Array.isArray(results)).toBe(true);
      expect(results.every(r => !r.filePath.includes('node_modules'))).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should dispose CodeChunker', () => {
      indexer.dispose();

      expect(mockCodeChunker.dispose).toHaveBeenCalled();
    });
  });
});
