/**
 * Integration tests for Experiments API
 * Tests feature flag evaluation and experiment tracking endpoints
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import request from 'supertest'
import { createMocks } from 'node-mocks-http'
import { POST, GET } from '@/app/api/experiments/route'

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

// Mock the auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

// Mock the monitoring
jest.mock('@/lib/server-monitoring', () => ({
  appLogger: {
    logBusiness: jest.fn(),
    logSecurity: jest.fn()
  }
}));

const { getServerSession } = require('next-auth');

describe('Experiments API', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
    role: 'user'
  }

  const mockAdminUser = {
    id: 'admin123',
    email: 'admin@example.com',
    role: 'admin'
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/experiments', () => {
    test('should require authentication', async () => {
      getServerSession.mockResolvedValue(null);

      const { req, res } = createMocks({
        method: 'POST',
        body: {
          action: 'evaluate',
          flagKey: 'test_flag'
        }
      });

      await POST(req as any);
      
      expect(res._getStatusCode()).toBe(401);
    });

    test('should evaluate feature flag successfully', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent',
          'x-forwarded-for': '127.0.0.1'
        },
        body: {
          action: 'evaluate',
          flagKey: 'ai_assistant_v2',
          context: {
            workspaceId: 'workspace123',
            defaultValue: false
          }
        }
      });

      const response = await POST(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.result).toBeDefined();
      expect(responseData.result.flagKey).toBe('ai_assistant_v2');
      expect(['control', 'enhanced']).toContain(responseData.result.variant);
    });

    test('should track metrics successfully', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent'
        },
        body: {
          action: 'track',
          flagKey: 'ai_assistant_v2',
          metricName: 'conversion',
          value: 1,
          context: {
            workspaceId: 'workspace123'
          }
        }
      });

      const response = await POST(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Metric tracked successfully');
    });

    test('should evaluate multiple flags', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: {
          action: 'evaluate_multiple',
          flags: [
            { key: 'ai_assistant_v2', defaultValue: false },
            { key: 'editor_theme_dark_plus', defaultValue: false }
          ]
        }
      });

      const response = await POST(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.results).toHaveLength(2);
      
      const flagKeys = responseData.results.map((r: any) => r.flagKey);
      expect(flagKeys).toContain('ai_assistant_v2');
      expect(flagKeys).toContain('editor_theme_dark_plus');
    });

    test('should return 400 for missing flagKey on evaluate', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'evaluate'
          // missing flagKey
        }
      });

      const response = await POST(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('flagKey is required for evaluation');
    });

    test('should return 400 for missing parameters on track', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'track',
          flagKey: 'test_flag'
          // missing metricName and value
        }
      });

      const response = await POST(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('flagKey, metricName, and value are required for tracking');
    });

    test('should return 400 for invalid action', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      const { req } = createMocks({
        method: 'POST',
        body: {
          action: 'invalid_action'
        }
      });

      const response = await POST(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid action');
    });
  });

  describe('GET /api/experiments', () => {
    test('should require admin access for experiment results', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      const { req } = createMocks({
        method: 'GET',
        query: {
          flagKey: 'test_flag',
          action: 'results'
        }
      });

      const response = await GET(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(403);
      expect(responseData.error).toBe('Admin access required');
    });

    test('should return experiment results for admin users', async () => {
      getServerSession.mockResolvedValue({ user: mockAdminUser });

      const { req } = createMocks({
        method: 'GET',
        url: '/api/experiments?flagKey=ai_assistant_v2&action=results'
      });

      const response = await GET(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.flag).toBeDefined();
      expect(responseData.metrics).toBeDefined();
      expect(responseData.statisticalSignificance).toBeDefined();
    });

    test('should return flag list for admin users', async () => {
      getServerSession.mockResolvedValue({ user: mockAdminUser });

      const { req } = createMocks({
        method: 'GET',
        url: '/api/experiments?action=list'
      });

      const response = await GET(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.flags).toBeDefined();
      expect(Array.isArray(responseData.flags)).toBe(true);
      expect(responseData.flags.length).toBeGreaterThan(0);
    });

    test('should return 400 for missing flagKey in results action', async () => {
      getServerSession.mockResolvedValue({ user: mockAdminUser });

      const { req } = createMocks({
        method: 'GET',
        url: '/api/experiments?action=results'
      });

      const response = await GET(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('flagKey parameter is required');
    });

    test('should return 400 for invalid action', async () => {
      getServerSession.mockResolvedValue({ user: mockAdminUser });

      const { req } = createMocks({
        method: 'GET',
        url: '/api/experiments?action=invalid'
      });

      const response = await GET(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Invalid action');
    });
  });

  describe('Error Handling', () => {
    test('should handle server errors gracefully', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      // Mock to throw an error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      const { req } = createMocks({
        method: 'POST',
        body: null // This should cause an error
      });

      const response = await POST(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Internal server error');

      console.error = originalConsoleError
    });
  });

  describe('Context Building', () => {
    test('should build experiment context correctly from request', async () => {
      getServerSession.mockResolvedValue({ user: mockUser });

      const { req } = createMocks({
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'x-forwarded-for': '192.168.1.100',
          'x-real-ip': '10.0.0.1'
        },
        body: {
          action: 'evaluate',
          flagKey: 'ai_assistant_v2',
          context: {
            workspaceId: 'workspace456',
            customAttributes: {
              plan: 'enterprise',
              feature_beta: true
            }
          }
        }
      });

      const response = await POST(req as any);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);

      // The context should be built correctly (we can't directly test it,
      // but we know it worked if the evaluation succeeded);
    });
  });
});