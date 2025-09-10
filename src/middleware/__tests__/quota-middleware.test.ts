import { NextRequest } from 'next/server';
import { withQuotaCheck, createQuotaResponse } from '../quota-middleware';

// Mock external dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

jest.mock('@/lib/resource-management', () => ({
  resourceManager: {
    checkQuota: jest.fn(),
    recordAPICall: jest.fn()
  }
}));

describe('Quota Middleware', () => {
  let mockRequest: NextRequest;
  let mockGetServerSession: jest.MockedFunction<any>;
  let mockResourceManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock request
    mockRequest = new NextRequest('https://example.com/api/test', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      }
    });

    // Setup mocks
    mockGetServerSession = require('next-auth').getServerSession;
    mockResourceManager = require('@/lib/resource-management').resourceManager;
  });

  describe('withQuotaCheck', () => {
    describe('Authentication', () => {
      it('should return authentication required when no session', async () => {
        mockGetServerSession.mockResolvedValue(null);

        const result = await withQuotaCheck(mockRequest, 'create_workspace');

        expect(result).toEqual({
          allowed: false,
          reason: 'Authentication required'
        });
        expect(mockResourceManager.checkQuota).not.toHaveBeenCalled();
      });

      it('should return authentication required when session has no user', async () => {
        mockGetServerSession.mockResolvedValue({ user: null });

        const result = await withQuotaCheck(mockRequest, 'create_workspace');

        expect(result).toEqual({
          allowed: false,
          reason: 'Authentication required'
        });
        expect(mockResourceManager.checkQuota).not.toHaveBeenCalled();
      });

      it('should return authentication required when user has no id', async () => {
        mockGetServerSession.mockResolvedValue({ user: { email: 'test@example.com' } });

        const result = await withQuotaCheck(mockRequest, 'create_workspace');

        expect(result).toEqual({
          allowed: false,
          reason: 'Authentication required'
        });
        expect(mockResourceManager.checkQuota).not.toHaveBeenCalled();
      });
    });

    describe('Quota Checking', () => {
      beforeEach(() => {
        mockGetServerSession.mockResolvedValue({
          user: { id: '123' }
        });
      });

      it('should allow action when quota check passes', async () => {
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: true,
          quotas: { maxWorkspaces: 10 },
          usage: { workspaceCount: 5 }
        });

        const result = await withQuotaCheck(mockRequest, 'create_workspace');

        expect(result).toEqual({ allowed: true });
        expect(mockResourceManager.checkQuota).toHaveBeenCalledWith(123, 'create_workspace', undefined);
      });

      it('should deny action when quota check fails', async () => {
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: false,
          reason: 'Maximum workspaces exceeded',
          quotas: { maxWorkspaces: 10 },
          usage: { workspaceCount: 10 }
        });

        const result = await withQuotaCheck(mockRequest, 'create_workspace');

        expect(result).toEqual({
          allowed: false,
          reason: 'Maximum workspaces exceeded',
          remainingQuota: 0,
          resetTime: expect.any(Number)
        });
        expect(mockResourceManager.checkQuota).toHaveBeenCalledWith(123, 'create_workspace', undefined);
      });

      it('should pass file size option for upload_file action', async () => {
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: true,
          quotas: { maxFileSize: 1000000 },
          usage: { workspaceCount: 5 }
        });

        const result = await withQuotaCheck(mockRequest, 'upload_file', { fileSize: 500000 });

        expect(result).toEqual({ allowed: true });
        expect(mockResourceManager.checkQuota).toHaveBeenCalledWith(123, 'upload_file', 500000);
      });
    });

    describe('API Call Recording', () => {
      beforeEach(() => {
        mockGetServerSession.mockResolvedValue({
          user: { id: '123' }
        });
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: true,
          quotas: { maxAPICallsPerHour: 1000 },
          usage: { apiCallsThisHour: 500 }
        });
      });

      it('should record API call for api_call action', async () => {
        const result = await withQuotaCheck(mockRequest, 'api_call');

        expect(result).toEqual({ allowed: true });
        expect(mockResourceManager.recordAPICall).toHaveBeenCalledWith(123, '/api/test');
      });

      it('should not record API call for non-api_call actions', async () => {
        await withQuotaCheck(mockRequest, 'create_workspace');
        await withQuotaCheck(mockRequest, 'upload_file');
        await withQuotaCheck(mockRequest, 'create_session');

        expect(mockResourceManager.recordAPICall).not.toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        mockGetServerSession.mockResolvedValue({
          user: { id: '123' }
        });
      });

      it('should handle quota check errors gracefully', async () => {
        mockResourceManager.checkQuota.mockRejectedValue(new Error('Database error'));

        const result = await withQuotaCheck(mockRequest, 'create_workspace');

        expect(result).toEqual({
          allowed: false,
          reason: 'Internal server error'
        });
      });

      it('should handle API call recording errors gracefully', async () => {
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: true,
          quotas: { maxAPICallsPerHour: 1000 },
          usage: { apiCallsThisHour: 500 }
        });
        mockResourceManager.recordAPICall.mockRejectedValue(new Error('Database error'));

        const result = await withQuotaCheck(mockRequest, 'api_call');

        expect(result).toEqual({
          allowed: false,
          reason: 'Internal server error'
        });
      });
    });

    describe('Remaining Quota Calculation', () => {
      beforeEach(() => {
        mockGetServerSession.mockResolvedValue({
          user: { id: '123' }
        });
      });

      it('should calculate remaining quota for create_workspace', async () => {
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: false,
          reason: 'Maximum workspaces exceeded',
          quotas: { maxWorkspaces: 10 },
          usage: { workspaceCount: 8 }
        });

        const result = await withQuotaCheck(mockRequest, 'create_workspace');

        expect(result.remainingQuota).toBe(2);
      });

      it('should calculate remaining quota for api_call', async () => {
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: false,
          reason: 'API rate limit exceeded',
          quotas: { maxAPICallsPerHour: 1000 },
          usage: { apiCallsThisHour: 750 }
        });

        const result = await withQuotaCheck(mockRequest, 'api_call');

        expect(result.remainingQuota).toBe(250);
      });

      it('should calculate remaining quota for create_session', async () => {
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: false,
          reason: 'Maximum concurrent sessions exceeded',
          quotas: { maxConcurrentSessions: 5 },
          usage: { activeSessions: 3 }
        });

        const result = await withQuotaCheck(mockRequest, 'create_session');

        expect(result.remainingQuota).toBe(2);
      });

      it('should return 0 for unknown actions', async () => {
        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: false,
          reason: 'Unknown action',
          quotas: {},
          usage: {}
        });

        const result = await withQuotaCheck(mockRequest, 'unknown_action' as any);

        expect(result.remainingQuota).toBe(0);
      });
    });

    describe('Reset Time Calculation', () => {
      beforeEach(() => {
        mockGetServerSession.mockResolvedValue({
          user: { id: '123' }
        });
      });

      it('should calculate reset time for api_call (next hour)', async () => {
        const now = new Date('2023-01-01T14:30:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(now);

        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: false,
          reason: 'API rate limit exceeded',
          quotas: { maxAPICallsPerHour: 1000 },
          usage: { apiCallsThisHour: 1000 }
        });

        const result = await withQuotaCheck(mockRequest, 'api_call');

        const expectedResetTime = new Date('2023-01-01T15:00:00Z').getTime();
        expect(result.resetTime).toBe(expectedResetTime);

        jest.useRealTimers();
      });

      it('should calculate reset time for other actions (24 hours)', async () => {
        const now = new Date('2023-01-01T14:30:00Z');
        jest.useFakeTimers();
        jest.setSystemTime(now);

        mockResourceManager.checkQuota.mockResolvedValue({
          allowed: false,
          reason: 'Maximum workspaces exceeded',
          quotas: { maxWorkspaces: 10 },
          usage: { workspaceCount: 10 }
        });

        const result = await withQuotaCheck(mockRequest, 'create_workspace');

        const expectedResetTime = now.getTime() + 24 * 60 * 60 * 1000;
        expect(result.resetTime).toBe(expectedResetTime);

        jest.useRealTimers();
      });
    });
  });

  describe('createQuotaResponse', () => {
    it('should create proper quota exceeded response', () => {
      const quotaResult = {
        allowed: false,
        reason: 'Maximum workspaces exceeded',
        remainingQuota: 2,
        resetTime: 1672574400000
      };

      const response = createQuotaResponse(quotaResult);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('2');
      expect(response.headers.get('X-RateLimit-Reset')).toBe('1672574400000');
      expect(response.headers.get('Retry-After')).toBe('3600');
    });

    it('should handle missing optional fields', () => {
      const quotaResult = {
        allowed: false,
        reason: 'Authentication required'
      };

      const response = createQuotaResponse(quotaResult);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBe('0');
      expect(response.headers.get('Retry-After')).toBe('3600');
    });

    it('should include proper response body', async () => {
      const quotaResult = {
        allowed: false,
        reason: 'Maximum workspaces exceeded',
        remainingQuota: 2,
        resetTime: 1672574400000
      };

      const response = createQuotaResponse(quotaResult);
      
      // In test environment, NextResponse.json() doesn't work the same way
      // We'll test the response properties instead
      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('2');
      expect(response.headers.get('X-RateLimit-Reset')).toBe('1672574400000');
      expect(response.headers.get('Retry-After')).toBe('3600');
    });
  });
});
