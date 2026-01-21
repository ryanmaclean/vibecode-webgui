/**
 * Comprehensive tests for /api/upload endpoint
 *
 * Test coverage:
 * - File upload validation (type, size, count)
 * - Security checks (path traversal, null bytes, etc.)
 * - Multiple file uploads
 * - Error handling
 * - CORS support
 * - Response format validation
 */

import { NextRequest } from 'next/server';
import { POST, OPTIONS } from '@/app/api/upload/route';

// Mock rate limiter to prevent rate limiting during tests
jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    limit: 10,
    remaining: 9,
    reset: Math.floor(Date.now() / 1000) + 300,
    current: 1,
  }),
  createRateLimitedResponse: jest.fn(),
  applyRateLimitHeaders: jest.fn((response) => response),
  RateLimitPresets: {
    UPLOAD: {
      maxRequests: 10,
      windowSeconds: 300,
      message: 'Too many upload attempts. Please wait before trying again.',
    },
  },
}));

/**
 * Helper to create a mock NextRequest with proper headers
 */
function createMockRequest(formData: FormData): NextRequest {
  const mockHeaders = new Map<string, string>();
  mockHeaders.set('x-forwarded-for', '127.0.0.1');

  return {
    formData: async () => formData,
    headers: {
      get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
    },
  } as unknown as NextRequest;
}

describe('API: /api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Uploads', () => {
    it('should accept valid text file upload', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace-123');
      formData.append(
        'files',
        new Blob(['Hello World'], { type: 'text/plain' }),
        'test.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.filesUploaded).toBe(1);
      expect(data.workspaceId).toBe('test-workspace-123');
      expect(data.files).toHaveLength(1);
      expect(data.files[0].name).toBe('test.txt');
      expect(data.files[0].type).toBe('text/plain');
      expect(data.analysis).toBeDefined();
    });

    it('should accept JSON file', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['{"key": "value"}'], { type: 'application/json' }),
        'data.json'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.files[0].type).toBe('application/json');
    });

    it('should accept JavaScript file', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['const x = 1;'], { type: 'text/javascript' }),
        'script.js'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should accept TypeScript file', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['const x: number = 1;'], { type: 'text/typescript' }),
        'script.ts'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should accept multiple files', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['file 1'], { type: 'text/plain' }),
        'file1.txt'
      );
      formData.append(
        'files',
        new Blob(['file 2'], { type: 'text/plain' }),
        'file2.txt'
      );
      formData.append(
        'files',
        new Blob(['file 3'], { type: 'text/plain' }),
        'file3.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.filesUploaded).toBe(3);
      expect(data.files).toHaveLength(3);
    });
  });

  describe('Workspace ID Validation', () => {
    it('should reject missing workspace ID', async () => {
      const formData = new FormData();
      formData.append(
        'files',
        new Blob(['test'], { type: 'text/plain' }),
        'test.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Workspace ID is required');
    });

    it('should reject invalid workspace ID with special characters', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test/../admin');
      formData.append(
        'files',
        new Blob(['test'], { type: 'text/plain' }),
        'test.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid workspace ID format');
    });

    it('should accept valid workspace ID formats', async () => {
      const validIds = [
        'workspace-123',
        'WORKSPACE_ABC',
        'ws_test_001',
        'project-name-v1',
      ];

      for (const workspaceId of validIds) {
        const formData = new FormData();
        formData.append('workspaceId', workspaceId);
        formData.append(
          'files',
          new Blob(['test'], { type: 'text/plain' }),
          'test.txt'
        );

        const mockRequest = createMockRequest(formData);

        const response = await POST(mockRequest);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('File Count Validation', () => {
    it('should reject empty file list', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('No files provided');
    });

    it('should accept maximum allowed files (10)', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');

      for (let i = 1; i <= 10; i++) {
        formData.append(
          'files',
          new Blob([`file ${i}`], { type: 'text/plain' }),
          `file${i}.txt`
        );
      }

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.filesUploaded).toBe(10);
    });

    it('should reject more than 10 files', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');

      for (let i = 1; i <= 11; i++) {
        formData.append(
          'files',
          new Blob([`file ${i}`], { type: 'text/plain' }),
          `file${i}.txt`
        );
      }

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Maximum 10 files');
    });
  });

  describe('Filename Security Validation', () => {
    it('should reject directory traversal in filename', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['malicious'], { type: 'text/plain' }),
        '../../../etc/passwd'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('directory traversal');
    });

    it('should reject null bytes in filename', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['test'], { type: 'text/plain' }),
        'test\0.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('null byte');
    });

    it('should reject path separators in filename', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['test'], { type: 'text/plain' }),
        'folder/file.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('path separators');
    });

    it('should reject overly long filenames', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      const longName = 'a'.repeat(300) + '.txt';
      formData.append(
        'files',
        new Blob(['test'], { type: 'text/plain' }),
        longName
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('too long');
    });

    it('should accept filenames at boundary (255 chars)', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      const boundaryName = 'a'.repeat(251) + '.txt'; // 255 total
      formData.append(
        'files',
        new Blob(['test'], { type: 'text/plain' }),
        boundaryName
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });
  });

  describe('File Size Validation', () => {
    it('should reject file over 10MB limit', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');

      // Create 11MB file
      const largeContent = new Uint8Array(11 * 1024 * 1024);
      formData.append(
        'files',
        new Blob([largeContent], { type: 'text/plain' }),
        'large.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(413);

      const data = await response.json();
      expect(data.error).toContain('exceeds 10MB limit');
    });

    it('should reject total upload over 50MB', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');

      // Create 10 files of 6MB each (60MB total)
      for (let i = 0; i < 10; i++) {
        const content = new Uint8Array(6 * 1024 * 1024);
        formData.append(
          'files',
          new Blob([content], { type: 'text/plain' }),
          `file${i}.txt`
        );
      }

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(413);

      const data = await response.json();
      expect(data.error).toContain('exceeds 50MB limit');
    });

    it('should accept file at size limit (10MB)', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');

      // Create exactly 10MB file
      const content = new Uint8Array(10 * 1024 * 1024);
      formData.append(
        'files',
        new Blob([content], { type: 'text/plain' }),
        'limit.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });
  });

  describe('MIME Type Validation', () => {
    it('should reject executable files', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['fake exe'], { type: 'application/x-msdownload' }),
        'virus.exe'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(415);

      const data = await response.json();
      expect(data.error).toContain('Invalid file type');
    });

    it('should reject PDF files', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['pdf content'], { type: 'application/pdf' }),
        'document.pdf'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(415);
    });

    it('should reject image files', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['png data'], { type: 'image/png' }),
        'image.png'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      expect(response.status).toBe(415);
    });

    it('should list allowed MIME types in error', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['test'], { type: 'application/octet-stream' }),
        'file.bin'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.error).toContain('text/plain');
      expect(data.error).toContain('application/json');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed form data', async () => {
      const mockHeaders = new Map<string, string>();
      mockHeaders.set('x-forwarded-for', '127.0.0.1');

      const mockRequest = {
        formData: async () => {
          throw new Error('Failed to parse form data');
        },
        headers: {
          get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toContain('Failed to process file upload');
    });

    it('should provide detailed error messages', async () => {
      const mockHeaders = new Map<string, string>();
      mockHeaders.set('x-forwarded-for', '127.0.0.1');

      const mockRequest = {
        formData: async () => {
          throw new Error('Network timeout');
        },
        headers: {
          get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('details');
      expect(data.details).toBe('Network timeout');
    });
  });

  describe('CORS Support', () => {
    it('should handle OPTIONS preflight request', async () => {
      const response = await OPTIONS();
      expect(response.status).toBe(200);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });
  });

  describe('Response Format', () => {
    it('should return correct response structure', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['test'], { type: 'text/plain' }),
        'test.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('filesUploaded');
      expect(data).toHaveProperty('files');
      expect(data).toHaveProperty('workspaceId');
      expect(data).toHaveProperty('analysis');

      expect(data.files[0]).toHaveProperty('name');
      expect(data.files[0]).toHaveProperty('size');
      expect(data.files[0]).toHaveProperty('type');
    });

    it('should include AI analysis in response', async () => {
      const formData = new FormData();
      formData.append('workspaceId', 'test-workspace');
      formData.append(
        'files',
        new Blob(['test'], { type: 'text/plain' }),
        'test.txt'
      );

      const mockRequest = createMockRequest(formData);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.analysis).toBeDefined();
      expect(typeof data.analysis).toBe('string');
      expect(data.analysis.length).toBeGreaterThan(0);
    });
  });
});
