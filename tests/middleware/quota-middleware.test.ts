/**
 * Comprehensive tests for quota enforcement middleware
 * Tests for resource quota checking and enforcement
 */

// Mock dependencies BEFORE imports
jest.mock('next-auth');
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));
jest.mock('@/lib/resource-management', () => ({
  resourceManager: {
    checkQuota: jest.fn(),
    recordAPICall: jest.fn(),
  },
}));

import {
  withQuotaCheck,
  createQuotaResponse,
} from '@/middleware/quota-middleware';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { resourceManager } from '@/lib/resource-management';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('Quota Middleware', () => {
  let mockRequest: NextRequest;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  const mockedResourceManager = jest.mocked(resourceManager);

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks to default behavior
    mockGetServerSession.mockReset();
    mockedResourceManager.checkQuota.mockReset();
    mockedResourceManager.recordAPICall.mockReset();

    mockRequest = {
      url: 'http://localhost:3000/api/workspaces',
      method: 'POST',
      headers: new Map(),
    } as any;

    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('withQuotaCheck', () => {
    it('should deny access when user is not authenticated', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const result = await withQuotaCheck(mockRequest, 'create_workspace');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Authentication required');
    });

    it('should deny access when session has no user', async () => {
      mockGetServerSession.mockResolvedValue({ user: null } as any);

      const result = await withQuotaCheck(mockRequest, 'create_workspace');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Authentication required');
    });

    it('should deny access when session user has no id', async () => {
      mockGetServerSession.mockResolvedValue({ user: {} } as any);

      const result = await withQuotaCheck(mockRequest, 'create_workspace');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Authentication required');
    });

    it('should allow access when quota is not exceeded', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({ allowed: true } as any);

      const result = await withQuotaCheck(mockRequest, 'create_workspace');

      expect(result.allowed).toBe(true);
      expect(resourceManager.checkQuota).toHaveBeenCalledWith(123, 'create_workspace', undefined);
    });

    it('should deny access when quota is exceeded', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '456' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Maximum workspaces limit reached',
        quotas: { maxWorkspaces: 5, maxAPICallsPerHour: 1000, maxConcurrentSessions: 3 },
        usage: { workspaceCount: 5, apiCallsThisHour: 100, activeSessions: 2 },
      } as any);

      const result = await withQuotaCheck(mockRequest, 'create_workspace');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Maximum workspaces limit reached');
      expect(result.remainingQuota).toBe(0);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should log quota violation', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '789' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Quota exceeded',
        quotas: { maxWorkspaces: 5, maxAPICallsPerHour: 1000, maxConcurrentSessions: 3 },
        usage: { workspaceCount: 6, apiCallsThisHour: 100, activeSessions: 2 },
      } as any);

      await withQuotaCheck(mockRequest, 'create_workspace');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Quota exceeded for user 789')
      );
    });

    it('should record API calls when action is api_call', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({ allowed: true } as any);
      mockedResourceManager.recordAPICall.mockResolvedValue(undefined);

      await withQuotaCheck(mockRequest, 'api_call');

      expect(resourceManager.recordAPICall).toHaveBeenCalledWith(123, '/api/workspaces');
    });

    it('should not record API calls for non-api_call actions', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({ allowed: true } as any);

      await withQuotaCheck(mockRequest, 'create_workspace');

      expect(resourceManager.recordAPICall).not.toHaveBeenCalled();
    });

    it('should handle file size option for upload_file action', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({ allowed: true } as any);

      await withQuotaCheck(mockRequest, 'upload_file', { fileSize: 5242880 });

      expect(resourceManager.checkQuota).toHaveBeenCalledWith(123, 'upload_file', 5242880);
    });

    it('should handle errors gracefully', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockRejectedValue(new Error('Database error'));

      const result = await withQuotaCheck(mockRequest, 'create_workspace');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Internal server error');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Quota check error:', expect.any(Error));
    });

    it('should calculate remaining quota for create_workspace', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Limit reached',
        quotas: { maxWorkspaces: 10, maxAPICallsPerHour: 1000, maxConcurrentSessions: 5 },
        usage: { workspaceCount: 7, apiCallsThisHour: 500, activeSessions: 3 },
      } as any);

      const result = await withQuotaCheck(mockRequest, 'create_workspace');

      expect(result.remainingQuota).toBe(3); // 10 - 7
    });

    it('should calculate remaining quota for api_call', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Limit reached',
        quotas: { maxWorkspaces: 10, maxAPICallsPerHour: 1000, maxConcurrentSessions: 5 },
        usage: { workspaceCount: 5, apiCallsThisHour: 900, activeSessions: 3 },
      } as any);

      const result = await withQuotaCheck(mockRequest, 'api_call');

      expect(result.remainingQuota).toBe(100); // 1000 - 900
    });

    it('should calculate remaining quota for create_session', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Limit reached',
        quotas: { maxWorkspaces: 10, maxAPICallsPerHour: 1000, maxConcurrentSessions: 5 },
        usage: { workspaceCount: 5, apiCallsThisHour: 500, activeSessions: 4 },
      } as any);

      const result = await withQuotaCheck(mockRequest, 'create_session');

      expect(result.remainingQuota).toBe(1); // 5 - 4
    });

    it('should return 0 for unknown action types', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Limit reached',
        quotas: { maxWorkspaces: 10, maxAPICallsPerHour: 1000, maxConcurrentSessions: 5 },
        usage: { workspaceCount: 5, apiCallsThisHour: 500, activeSessions: 3 },
      } as any);

      const result = await withQuotaCheck(mockRequest, 'unknown_action' as any);

      expect(result.remainingQuota).toBe(0);
    });

    it('should calculate reset time for api_call action', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Limit reached',
        quotas: { maxWorkspaces: 10, maxAPICallsPerHour: 1000, maxConcurrentSessions: 5 },
        usage: { workspaceCount: 5, apiCallsThisHour: 1001, activeSessions: 3 },
      } as any);

      const result = await withQuotaCheck(mockRequest, 'api_call');

      // Reset time should be at the top of the next hour
      const now = new Date();
      const nextHour = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours() + 1,
        0,
        0
      );
      const expectedResetTime = nextHour.getTime();

      // Allow for small time differences (within 5 seconds)
      expect(Math.abs(result.resetTime! - expectedResetTime)).toBeLessThan(5000);
    });

    it('should calculate reset time for non-api_call actions', async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: '123' } } as any);
      mockedResourceManager.checkQuota.mockResolvedValue({
        allowed: false,
        reason: 'Limit reached',
        quotas: { maxWorkspaces: 10, maxAPICallsPerHour: 1000, maxConcurrentSessions: 5 },
        usage: { workspaceCount: 11, apiCallsThisHour: 500, activeSessions: 3 },
      } as any);

      const beforeTest = Date.now();
      const result = await withQuotaCheck(mockRequest, 'create_workspace');

      // Reset time should be approximately 24 hours from now
      const expectedResetTime = beforeTest + 24 * 60 * 60 * 1000;

      // Allow for execution time (within 10 seconds)
      expect(Math.abs(result.resetTime! - expectedResetTime)).toBeLessThan(10000);
    });
  });

  describe('createQuotaResponse', () => {
    it('should create proper quota exceeded response', async () => {
      const quotaResult = {
        allowed: false,
        reason: 'Workspace limit exceeded',
        remainingQuota: 0,
        resetTime: Date.now() + 3600000,
      };

      const response = createQuotaResponse(quotaResult);

      expect(response.status).toBe(429);

      const json = await response.json();
      expect(json).toEqual({
        error: 'Quota exceeded',
        message: 'Workspace limit exceeded',
        remaining: 0,
        resetTime: quotaResult.resetTime,
        code: 'QUOTA_EXCEEDED',
      });
    });

    it('should include rate limit headers', () => {
      const quotaResult = {
        allowed: false,
        reason: 'API call limit exceeded',
        remainingQuota: 5,
        resetTime: 1234567890,
      };

      const response = createQuotaResponse(quotaResult);

      expect(response.headers.get('X-RateLimit-Remaining')).toBe('5');
      expect(response.headers.get('X-RateLimit-Reset')).toBe('1234567890');
      expect(response.headers.get('Retry-After')).toBe('3600');
    });

    it('should handle missing remainingQuota', () => {
      const quotaResult = {
        allowed: false,
        reason: 'Quota exceeded',
      };

      const response = createQuotaResponse(quotaResult);

      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('should handle missing resetTime', () => {
      const quotaResult = {
        allowed: false,
        reason: 'Quota exceeded',
        remainingQuota: 10,
      };

      const response = createQuotaResponse(quotaResult);

      expect(response.headers.get('X-RateLimit-Reset')).toBe('0');
    });

    it('should return JSON with proper content type', async () => {
      const quotaResult = {
        allowed: false,
        reason: 'Test reason',
        remainingQuota: 3,
        resetTime: 999999,
      };

      const response = createQuotaResponse(quotaResult);

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });
});
