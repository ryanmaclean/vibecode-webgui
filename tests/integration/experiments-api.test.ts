/**
 * Integration tests for Experiments API
 * Tests feature flag evaluation and experiment tracking endpoints
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user'
    }
  })
}))

// Mock the auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {}
}))

// Mock the monitoring
jest.mock('@/lib/server-monitoring', () => ({
  appLogger: {
    logBusiness: jest.fn(),
    logSecurity: jest.fn()
  }
}))

// Mock the feature flag engine
jest.mock('@/lib/feature-flags', () => ({
  featureFlagEngine: {
    evaluateFlag: jest.fn().mockResolvedValue({
      flagKey: 'ai_assistant_v2',
      variant: 'enhanced',
      isExperiment: true,
      experimentId: 'exp_123'
    }),
    trackMetric: jest.fn().mockResolvedValue(undefined),
    getExperimentResults: jest.fn().mockResolvedValue({
      flag: {
        key: 'ai_assistant_v2',
        name: 'AI Assistant V2'
      },
      metrics: [
        { name: 'conversion', count: 10, value: 0.85 }
      ],
      statisticalSignificance: 0.95
    })
  }
}))

const { getServerSession } = require('next-auth')

// Dynamic import to ensure mocks are applied
let POST: any;
let GET: any;

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
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Dynamic import to ensure mocks are applied
    const routeModule = await import('@/app/api/experiments/route');
    POST = routeModule.POST;
    GET = routeModule.GET;
  });

  describe('POST /api/experiments', () => {
    test('should require authentication', async () => {
      // Override the default mock to return null (no session)
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'evaluate',
          flagKey: 'test_flag'
        }),
        headers: {
          'content-type': 'application/json'
        }
      });

      const response = await POST(mockRequest as any);

      expect(response.status).toBe(401)})

    test('should evaluate feature flag successfully', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'evaluate',
          flagKey: 'ai_assistant_v2',
          context: {
            workspaceId: 'workspace123',
            defaultValue: false
          }
        }),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent',
          'x-forwarded-for': '127.0.0.1'
        }
      });

      const response = await POST(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      // Following the same pattern as ai-chat-stream.test.ts
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      // Verify the mock was called correctly
      const { featureFlagEngine } = require('@/lib/feature-flags');
      expect(featureFlagEngine.evaluateFlag).toHaveBeenCalledWith(
        'ai_assistant_v2',
        expect.objectContaining({
          userId: 'user123',
          workspaceId: 'workspace123'
        }),
        false
      );})

    test('should track metrics successfully', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'track',
          flagKey: 'ai_assistant_v2',
          metricName: 'conversion',
          value: 1,
          context: {
            workspaceId: 'workspace123'
          }
        }),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-agent'
        }
      });

      const response = await POST(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      // Verify the mock was called correctly
      const { featureFlagEngine } = require('@/lib/feature-flags');
      expect(featureFlagEngine.trackMetric).toHaveBeenCalledWith(
        'ai_assistant_v2',
        'conversion',
        1,
        expect.objectContaining({
          userId: 'user123',
          workspaceId: 'workspace123'
        })
      );})

    test('should evaluate multiple flags', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'evaluate_multiple',
          flags: [
            { key: 'ai_assistant_v2', defaultValue: false },
            { key: 'editor_theme_dark_plus', defaultValue: false }
          ]
        }),
        headers: {
          'content-type': 'application/json'
        }
      });

      const response = await POST(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      // Verify the mock was called correctly for each flag
      const { featureFlagEngine } = require('@/lib/feature-flags');
      expect(featureFlagEngine.evaluateFlag).toHaveBeenCalledTimes(2);})

    test('should return 400 for missing flagKey on evaluate', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'evaluate'
          // missing flagKey
        }),
        headers: {
          'content-type': 'application/json'
        }
      });

      const response = await POST(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(400);})

    test('should return 400 for missing parameters on track', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'track',
          flagKey: 'test_flag'
          // missing metricName and value
        }),
        headers: {
          'content-type': 'application/json'
        }
      });

      const response = await POST(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(400);})

    test('should return 400 for invalid action', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid_action'
        }),
        headers: {
          'content-type': 'application/json'
        }
      });

      const response = await POST(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(400);})})

  describe('GET /api/experiments', () => {
    test('should require admin access for experiment results', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments?flagKey=test_flag&action=results', {
        method: 'GET'
      });

      const response = await GET(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(403);})

    test('should return experiment results for admin users', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockAdminUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments?flagKey=ai_assistant_v2&action=results', {
        method: 'GET'
      });

      const response = await GET(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      // Verify the mock was called correctly
      const { featureFlagEngine } = require('@/lib/feature-flags');
      expect(featureFlagEngine.getExperimentResults).toHaveBeenCalledWith('ai_assistant_v2');})

    test('should return flag list for admin users', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockAdminUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments?action=list', {
        method: 'GET'
      });

      const response = await GET(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');})

    test('should return 400 for missing flagKey in results action', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockAdminUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments?action=results', {
        method: 'GET'
      });

      const response = await GET(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(400);})

    test('should return 400 for invalid action', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockAdminUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments?action=invalid', {
        method: 'GET'
      });

      const response = await GET(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(400);})})

  describe('Error Handling', () => {
    test('should handle server errors gracefully', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      // Mock to throw an error
      const originalConsoleError = console.error;
      console.error = jest.fn()

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: 'invalid json', // This should cause an error
        headers: {
          'content-type': 'application/json'
        }
      });

      const response = await POST(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(500);

      console.error = originalConsoleError
    })})

  describe('Context Building', () => {
    test('should build experiment context correctly from request', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce({ user: mockUser });

      const mockRequest = new Request('http://localhost:3000/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          action: 'evaluate',
          flagKey: 'ai_assistant_v2',
          context: {
            workspaceId: 'workspace456',
            customAttributes: {
              plan: 'enterprise',
              feature_beta: true
            }
          }
        }),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Macintosh Intel Mac OS X 10_15_7)',
          'x-forwarded-for': '192.168.1.100',
          'x-real-ip': '10.0.0.1'
        }
      });

      const response = await POST(mockRequest as any);

      // Note: Response body reading not supported in Jest environment
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');

      // Verify context was passed correctly by checking the mock call
      const { featureFlagEngine } = require('@/lib/feature-flags');
      expect(featureFlagEngine.evaluateFlag).toHaveBeenCalledWith(
        'ai_assistant_v2',
        expect.objectContaining({
          userId: 'user123',
          workspaceId: 'workspace456',
          userAgent: 'Mozilla/5.0 (Macintosh Intel Mac OS X 10_15_7)',
          ipAddress: '192.168.1.100',
          customAttributes: {
            plan: 'enterprise',
            feature_beta: true
          }
        }),
        undefined
      );
    });
  });
});
