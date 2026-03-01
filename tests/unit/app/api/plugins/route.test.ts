/**
 * @jest-environment node
 */

/**
 * Unit tests for Plugins API Route
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
  listAllPlugins: jest.fn(),
  findPlugins: jest.fn(),
  enablePlugin: jest.fn(),
  disablePlugin: jest.fn(),
  getPluginManager: jest.fn(() => ({
    initialize: jest.fn(),
    uninstall: jest.fn(),
  })),
}));

// Import mocked functions after mocking
import {
  listAllPlugins,
  findPlugins,
  enablePlugin,
  disablePlugin,
  getPluginManager,
} from '@/lib/plugins/plugin-manager';

const mockListAllPlugins = listAllPlugins as jest.MockedFunction<typeof listAllPlugins>;
const mockFindPlugins = findPlugins as jest.MockedFunction<typeof findPlugins>;
const mockEnablePlugin = enablePlugin as jest.MockedFunction<typeof enablePlugin>;
const mockDisablePlugin = disablePlugin as jest.MockedFunction<typeof disablePlugin>;
const mockGetPluginManager = getPluginManager as jest.MockedFunction<typeof getPluginManager>;

// Import route handlers after mocks are set up
import { GET, POST, DELETE } from '@/app/api/plugins/route';

// Helper function to create a mock NextRequest
function createMockRequest(
  url: string = 'http://localhost:3000/api/plugins',
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  }
): NextRequest {
  const { method = 'GET', headers = {}, body } = options || {};
  return new NextRequest(url, {
    method,
    headers: {
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('/api/plugins', () => {
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
      uninstall: jest.fn().mockResolvedValue({ success: true }),
    };

    mockGetPluginManager.mockReturnValue(mockPluginManager);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/plugins', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should filter plugins when query parameters are provided', async () => {
      const mockFilteredPlugins = [
        {
          manifest: {
            id: 'plugin-ai',
            name: 'AI Plugin',
            version: '1.0.0',
            type: 'ai-model',
          },
          capabilities: ['chat'],
          status: 'active',
          installedAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          enabledAt: new Date('2024-01-03'),
          lastError: null,
        },
      ];

      mockFindPlugins.mockResolvedValueOnce(mockFilteredPlugins);

      const requestWithParams = createMockRequest(
        'http://localhost:3000/api/plugins?type=ai-model&status=active'
      );

      const response = await GET(requestWithParams);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.plugins).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(mockFindPlugins).toHaveBeenCalledWith({
        type: 'ai-model',
        status: 'active',
      });
    });

    it('should handle keyword search', async () => {
      const { findPlugins } = require('@/lib/plugins/plugin-manager');

      mockFindPlugins.mockResolvedValueOnce([]);

      const requestWithKeyword = createMockRequest(
        'http://localhost:3000/api/plugins?keyword=test'
      );

      const response = await GET(requestWithKeyword);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockFindPlugins).toHaveBeenCalledWith({
        keyword: 'test',
      });
    });

    it('should handle author filter', async () => {
      const { findPlugins } = require('@/lib/plugins/plugin-manager');

      mockFindPlugins.mockResolvedValueOnce([]);

      const requestWithAuthor = createMockRequest(
        'http://localhost:3000/api/plugins?author=acme'
      );

      const response = await GET(requestWithAuthor);

      expect(response.status).toBe(200);
      expect(mockFindPlugins).toHaveBeenCalledWith({
        author: 'acme',
      });
    });

    it('should return 429 when rate limit is exceeded', async () => {
      mockRateLimitResult = {
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      };

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should handle errors gracefully', async () => {
      mockGetPluginManager.mockImplementationOnce(() => {
        throw new Error('Plugin manager error');
      });

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should return JSON content type', async () => {
      mockListAllPlugins.mockResolvedValueOnce([]);

      const response = await GET(mockRequest);

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should gracefully handle invalid query parameters', async () => {
      mockListAllPlugins.mockResolvedValueOnce([]);

      const requestWithInvalidParams = createMockRequest(
        'http://localhost:3000/api/plugins?type=invalid-type'
      );

      const response = await GET(requestWithInvalidParams);
      const data = await response.json();

      // Should fallback to listing all plugins with invalid query params
      expect(response.status).toBe(200);
      expect(mockListAllPlugins).toHaveBeenCalled();
    });
  });

  describe('POST /api/plugins', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const postRequest = createMockRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        body: { action: 'enable', pluginId: 'test-plugin' },
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should enable a plugin successfully', async () => {
      mockEnablePlugin.mockResolvedValueOnce({ success: true });

      const postRequest = createMockRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        body: { action: 'enable', pluginId: 'test-plugin' },
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('enabled successfully');
      expect(mockEnablePlugin).toHaveBeenCalledWith('test-plugin');
      expect(mockPluginManager.initialize).toHaveBeenCalled();
    });

    it('should disable a plugin successfully', async () => {
      mockDisablePlugin.mockResolvedValueOnce({ success: true });

      const postRequest = createMockRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        body: { action: 'disable', pluginId: 'test-plugin' },
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('disabled successfully');
      expect(mockDisablePlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should return 400 for invalid JSON body', async () => {
      const postRequest = new NextRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
    });

    it('should return 400 for invalid request body schema', async () => {
      const postRequest = createMockRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        body: { action: 'invalid-action', pluginId: 'test' },
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
      expect(data.details).toBeDefined();
    });

    it('should return 400 when enable fails', async () => {
      mockEnablePlugin.mockResolvedValueOnce({
        success: false,
        error: 'Plugin not found',
      });

      const postRequest = createMockRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        body: { action: 'enable', pluginId: 'nonexistent' },
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Plugin not found');
    });

    it('should return 400 when disable fails', async () => {
      mockDisablePlugin.mockResolvedValueOnce({
        success: false,
        error: 'Plugin is locked',
      });

      const postRequest = createMockRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        body: { action: 'disable', pluginId: 'locked-plugin' },
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Plugin is locked');
    });

    it('should return 429 when rate limit is exceeded', async () => {
      mockRateLimitResult = {
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      };

      const postRequest = createMockRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        body: { action: 'enable', pluginId: 'test' },
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockGetPluginManager.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const postRequest = createMockRequest('http://localhost:3000/api/plugins', {
        method: 'POST',
        body: { action: 'enable', pluginId: 'test' },
      });

      const response = await POST(postRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('DELETE /api/plugins', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const deleteRequest = createMockRequest(
        'http://localhost:3000/api/plugins?pluginId=test-plugin',
        { method: 'DELETE' }
      );

      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should uninstall a plugin successfully', async () => {
      mockPluginManager.uninstall.mockResolvedValueOnce({ success: true });

      const deleteRequest = createMockRequest(
        'http://localhost:3000/api/plugins?pluginId=test-plugin',
        { method: 'DELETE' }
      );

      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('uninstalled successfully');
      expect(mockPluginManager.uninstall).toHaveBeenCalledWith('test-plugin');
    });

    it('should return 400 when pluginId is missing', async () => {
      const deleteRequest = createMockRequest(
        'http://localhost:3000/api/plugins',
        { method: 'DELETE' }
      );

      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing pluginId parameter');
    });

    it('should return 400 when uninstall fails', async () => {
      mockPluginManager.uninstall.mockResolvedValueOnce({
        success: false,
        error: 'Plugin is in use',
      });

      const deleteRequest = createMockRequest(
        'http://localhost:3000/api/plugins?pluginId=in-use-plugin',
        { method: 'DELETE' }
      );

      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Plugin is in use');
    });

    it('should return 429 when rate limit is exceeded', async () => {
      mockRateLimitResult = {
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60,
      };

      const deleteRequest = createMockRequest(
        'http://localhost:3000/api/plugins?pluginId=test-plugin',
        { method: 'DELETE' }
      );

      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockGetPluginManager.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const deleteRequest = createMockRequest(
        'http://localhost:3000/api/plugins?pluginId=test-plugin',
        { method: 'DELETE' }
      );

      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});
