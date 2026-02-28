/**
 * @jest-environment node
 */

/**
 * Unit tests for Plugin Install API Route
 */

import { NextRequest } from 'next/server';

// Mock the auth module
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock the rate limiting module - use a factory function
let mockRateLimitResult = {
  success: true,
  limit: 60,
  remaining: 59,
  reset: Date.now() + 60000,
};

jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn(() => jest.fn(async () => mockRateLimitResult)),
}));

// Mock the logging module
jest.mock('@/lib/logging', () => ({
  createServiceLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock the auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock the plugin manager
jest.mock('@/lib/plugins/plugin-manager', () => ({
  getPluginManager: jest.fn(() => ({
    initialize: jest.fn(),
    install: jest.fn(),
  })),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  mkdir: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

// Import mocked functions after mocking
import { getPluginManager } from '@/lib/plugins/plugin-manager';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const mockGetPluginManager = getPluginManager as jest.MockedFunction<typeof getPluginManager>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

// Import route handlers after mocks are set up
import { POST } from '@/app/api/plugins/install/route';

// Helper function to create a mock NextRequest
function createMockRequest(
  url: string = 'http://localhost:3000/api/plugins/install',
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  }
): NextRequest {
  const { method = 'POST', headers = {}, body } = options || {};
  return new NextRequest(url, {
    method,
    headers: {
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// Helper function to create a mock File
function createMockFile(name: string, size: number, type: string): File {
  // Create a buffer of the specified size to ensure file.size matches
  const buffer = new ArrayBuffer(size);
  const blob = new Blob([buffer], { type });
  return new File([blob], name, { type });
}

// Helper function to create a mock NextRequest with FormData
function createMockRequestWithFormData(formData: FormData): NextRequest {
  const mockHeaders = new Map<string, string>();
  mockHeaders.set('x-forwarded-for', '127.0.0.1');
  mockHeaders.set('content-type', 'multipart/form-data; boundary=----WebKitFormBoundary');

  return {
    formData: async () => formData,
    headers: {
      get: (key: string) => mockHeaders.get(key.toLowerCase()) || null,
    },
  } as unknown as NextRequest;
}

describe('/api/plugins/install', () => {
  let mockRequest: NextRequest;
  let mockPluginManager: any;

  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = createMockRequest();

    // Set up session mock to return authenticated user by default
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValue(mockSession);

    // Reset rate limit mock to default success state
    mockRateLimitResult = {
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    };

    // Set up plugin manager mock
    mockPluginManager = {
      initialize: jest.fn().mockResolvedValue(undefined),
      install: jest.fn().mockResolvedValue({
        success: true,
        pluginId: 'test-plugin',
        warnings: [],
      }),
    };

    mockGetPluginManager.mockReturnValue(mockPluginManager);

    // Set up fs mocks
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/plugins/install', () => {
    describe('Authentication', () => {
      it('should return 401 when user is not authenticated', async () => {
        const { getServerSession } = require('next-auth');
        getServerSession.mockResolvedValueOnce(null);

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });
    });

    describe('Rate Limiting', () => {
      it('should return 429 when rate limit is exceeded', async () => {
        mockRateLimitResult = {
          success: false,
          limit: 60,
          remaining: 0,
          reset: Date.now() + 60000,
          retryAfter: 60,
        };

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toBe('Too many requests');
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
        expect(response.headers.get('Retry-After')).toBe('60');
      });
    });

    describe('JSON-based Installation', () => {
      it('should install plugin from URL successfully', async () => {
        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            source: 'https://example.com/plugin.zip',
            version: '1.0.0',
          },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain('installed successfully');
        expect(data.pluginId).toBe('test-plugin');
        expect(mockPluginManager.initialize).toHaveBeenCalled();
        expect(mockPluginManager.install).toHaveBeenCalledWith({
          source: 'https://example.com/plugin.zip',
          version: '1.0.0',
          force: undefined,
          skipValidation: undefined,
          autoEnable: undefined,
        });
      });

      it('should handle installation with all options', async () => {
        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            source: 'https://example.com/plugin.zip',
            version: '2.0.0',
            force: true,
            skipValidation: true,
            autoEnable: true,
          },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockPluginManager.install).toHaveBeenCalledWith({
          source: 'https://example.com/plugin.zip',
          version: '2.0.0',
          force: true,
          skipValidation: true,
          autoEnable: true,
        });
      });

      it('should return 400 when source is missing', async () => {
        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            version: '1.0.0',
          },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request parameters');
        expect(data.details).toBeDefined();
      });

      it('should return 400 when source is empty', async () => {
        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            source: '',
          },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request parameters');
      });

      it('should return 400 when installation fails', async () => {
        mockPluginManager.install.mockResolvedValueOnce({
          success: false,
          error: 'Plugin validation failed',
          warnings: ['Deprecated API usage'],
        });

        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            source: 'https://example.com/bad-plugin.zip',
          },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Plugin validation failed');
        expect(data.warnings).toContain('Deprecated API usage');
      });

      it('should include warnings in successful response', async () => {
        mockPluginManager.install.mockResolvedValueOnce({
          success: true,
          pluginId: 'test-plugin',
          warnings: ['This plugin uses deprecated features'],
        });

        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            source: 'https://example.com/plugin.zip',
          },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.warnings).toContain('This plugin uses deprecated features');
      });
    });

    describe('File Upload Installation', () => {
      it('should install plugin from uploaded file successfully', async () => {
        const mockFile = createMockFile('test-plugin.zip', 1024, 'application/zip');
        const formData = new FormData();
        formData.append('file', mockFile);

        const postRequest = createMockRequestWithFormData(formData);

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain('installed successfully');
        expect(mockWriteFile).toHaveBeenCalled();
        expect(mockPluginManager.install).toHaveBeenCalled();
      });

      it('should handle file upload with options', async () => {
        const mockFile = createMockFile('plugin.tar.gz', 2048, 'application/gzip');
        const formData = new FormData();
        formData.append('file', mockFile);
        formData.append('force', 'true');
        formData.append('autoEnable', 'true');

        const postRequest = createMockRequestWithFormData(formData);

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(mockPluginManager.install).toHaveBeenCalledWith(
          expect.objectContaining({
            force: true,
            autoEnable: true,
            skipValidation: false,
          })
        );
      });

      it('should return 400 when file is missing', async () => {
        const formData = new FormData();

        const postRequest = createMockRequestWithFormData(formData);

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing file parameter');
      });

      it('should return 413 when file exceeds size limit', async () => {
        const mockFile = createMockFile('huge-plugin.zip', 51 * 1024 * 1024, 'application/zip'); // 51MB
        const formData = new FormData();
        formData.append('file', mockFile);

        const postRequest = createMockRequestWithFormData(formData);

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(413);
        expect(data.error).toContain('exceeds');
        expect(data.details).toBeDefined();
      });

      it('should return 400 when filename contains directory traversal', async () => {
        const mockFile = createMockFile('../../../etc/passwd', 1024, 'application/zip');
        const formData = new FormData();
        formData.append('file', mockFile);

        const postRequest = createMockRequestWithFormData(formData);

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('directory traversal');
      });

      it('should return 400 when filename contains null bytes', async () => {
        const mockFile = createMockFile('plugin\0.zip', 1024, 'application/zip');
        const formData = new FormData();
        formData.append('file', mockFile);

        const postRequest = createMockRequestWithFormData(formData);

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('null byte');
      });

      it('should return 400 when filename is too long', async () => {
        const longName = 'a'.repeat(300) + '.zip';
        const mockFile = createMockFile(longName, 1024, 'application/zip');
        const formData = new FormData();
        formData.append('file', mockFile);

        const postRequest = createMockRequestWithFormData(formData);

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('too long');
      });

      it('should create temp directory if it does not exist', async () => {
        mockExistsSync.mockReturnValueOnce(false);

        const mockFile = createMockFile('plugin.zip', 1024, 'application/zip');
        const formData = new FormData();
        formData.append('file', mockFile);

        const postRequest = createMockRequestWithFormData(formData);

        await POST(postRequest);

        expect(mockMkdir).toHaveBeenCalledWith(
          expect.stringContaining('plugin-uploads'),
          { recursive: true }
        );
      });

      it('should accept various archive MIME types', async () => {
        const mimeTypes = [
          'application/zip',
          'application/x-zip-compressed',
          'application/x-tar',
          'application/gzip',
          'application/x-gzip',
        ];

        for (const mimeType of mimeTypes) {
          jest.clearAllMocks();

          const mockFile = createMockFile('plugin.zip', 1024, mimeType);
          const formData = new FormData();
          formData.append('file', mockFile);

          const postRequest = createMockRequestWithFormData(formData);

          const response = await POST(postRequest);

          expect(response.status).toBe(200);
        }
      });
    });

    describe('Content Type Handling', () => {
      it('should return 415 for unsupported content type', async () => {
        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(415);
        expect(data.error).toBe('Invalid content type');
        expect(data.details).toContain('multipart/form-data or application/json');
      });
    });

    describe('Error Handling', () => {
      it('should handle unexpected errors gracefully', async () => {
        mockGetPluginManager.mockImplementationOnce(() => {
          throw new Error('Unexpected plugin manager error');
        });

        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            source: 'https://example.com/plugin.zip',
          },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
        expect(data.details).toBe('Unexpected plugin manager error');
      });

      it('should handle filesystem errors gracefully', async () => {
        mockWriteFile.mockRejectedValueOnce(new Error('Disk full'));

        const mockFile = createMockFile('plugin.zip', 1024, 'application/zip');
        const formData = new FormData();
        formData.append('file', mockFile);

        const postRequest = createMockRequestWithFormData(formData);

        const response = await POST(postRequest);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Internal server error');
      });
    });

    describe('Response Format', () => {
      it('should return JSON content type', async () => {
        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            source: 'https://example.com/plugin.zip',
          },
        });

        const response = await POST(postRequest);

        expect(response.headers.get('Content-Type')).toContain('application/json');
      });

      it('should include all required fields in success response', async () => {
        const postRequest = createMockRequest('http://localhost:3000/api/plugins/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            source: 'https://example.com/plugin.zip',
          },
        });

        const response = await POST(postRequest);
        const data = await response.json();

        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('message');
        expect(data).toHaveProperty('pluginId');
        expect(data).toHaveProperty('warnings');
      });
    });
  });
});
