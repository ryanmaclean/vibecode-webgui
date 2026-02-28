/**
 * @jest-environment node
 */

/**
 * Unit tests for MFA Verification API Route
 * Tests MFA challenge creation, verification, device management
 */

import { NextRequest } from 'next/server';

// Mock dependencies with mutable variables (must be before route import)
let mockSession: any = {
  user: { id: 'user-123', email: 'test@example.com' }
};

let mockApiRateLimitResult = {
  success: true,
  limit: 10,
  remaining: 9,
  reset: Date.now() + 60000,
  retryAfter: undefined as number | undefined
};

let mockLegacyRateLimitResult = {
  allowed: true,
  remaining: 5,
  reset: Date.now() + 300000
};

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(async () => mockSession)
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

jest.mock('@/lib/auth/mfa-provider', () => ({
  mfaProvider: {
    createChallenge: jest.fn(),
    verifyChallenge: jest.fn(),
    getUserDevices: jest.fn(),
    removeDevice: jest.fn()
  }
}));

jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn(() => {
    return jest.fn(async () => mockApiRateLimitResult);
  })
}));

jest.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: jest.fn(async () => mockLegacyRateLimitResult),
  createRateLimitedResponse: jest.fn(),
  applyRateLimitHeaders: jest.fn((response) => response),
  RateLimitPresets: {
    MFA_VERIFY: {
      maxRequests: 5,
      windowMs: 300000
    }
  }
}));

// Import route handlers AFTER mocks are defined
import { POST, PUT, GET, DELETE } from '@/app/api/auth/mfa/verify/route';

// Helper function to create a mock NextRequest
function createMockRequest(
  method: string = 'POST',
  body?: unknown,
  url: string = 'http://localhost:3000/api/auth/mfa/verify'
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
    },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init);
}

describe('/api/auth/mfa/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';

    // Reset mutable mock variables to default success state
    mockSession = {
      user: { id: 'user-123', email: 'test@example.com' }
    };

    mockApiRateLimitResult = {
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
      retryAfter: undefined
    };

    mockLegacyRateLimitResult = {
      allowed: true,
      remaining: 5,
      reset: Date.now() + 300000
    };

    // Setup mfaProvider mocks
    const { mfaProvider } = require('@/lib/auth/mfa-provider');

    mfaProvider.createChallenge.mockResolvedValue({
      challengeId: 'challenge-123',
      availableDevices: [
        { id: 'device-1', name: 'Authenticator App', type: 'totp' }
      ]
    });

    mfaProvider.verifyChallenge.mockResolvedValue({
      success: true,
      deviceId: 'device-1',
      deviceType: 'totp',
      remainingBackupCodes: 8
    });

    mfaProvider.getUserDevices.mockReturnValue([
      {
        id: 'device-1',
        name: 'Authenticator App',
        type: 'totp',
        isActive: true,
        lastUsed: '2024-01-01T00:00:00Z',
        createdAt: '2023-01-01T00:00:00Z'
      }
    ]);

    mfaProvider.removeDevice.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/auth/mfa/verify - Create MFA challenge', () => {
    it('should create MFA challenge successfully', async () => {
      const request = createMockRequest('POST', { preferredDeviceId: 'device-1' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.challengeId).toBe('challenge-123');
      expect(data.data.availableDevices).toHaveLength(1);
      expect(data.message).toBe('MFA challenge created');
    });

    it('should handle API rate limiting', async () => {
      // Modify mutable variable to simulate rate limit failure
      mockApiRateLimitResult = {
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60
      };

      const request = createMockRequest('POST', {});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('should handle legacy rate limiting', async () => {
      const { createRateLimitedResponse } = require('@/lib/rate-limiter');

      // Modify mutable variable to simulate legacy rate limit failure
      mockLegacyRateLimitResult = {
        allowed: false,
        remaining: 0,
        reset: Date.now() + 300000
      };

      createRateLimitedResponse.mockReturnValueOnce(
        new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429
        })
      );

      const request = createMockRequest('POST', {});
      const response = await POST(request);

      expect(createRateLimitedResponse).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      // Modify mutable variable to simulate no session
      mockSession = null;

      const request = createMockRequest('POST', {});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should validate request parameters', async () => {
      const request = createMockRequest('POST', { invalidField: 'test' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });

    it('should accept optional preferredDeviceId', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');

      const request = createMockRequest('POST', {});
      await POST(request);

      expect(mfaProvider.createChallenge).toHaveBeenCalledWith('user-123', undefined);
    });

    it('should pass preferredDeviceId to mfaProvider', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');

      const request = createMockRequest('POST', { preferredDeviceId: 'device-2' });
      await POST(request);

      expect(mfaProvider.createChallenge).toHaveBeenCalledWith('user-123', 'device-2');
    });

    it('should handle mfaProvider errors', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.createChallenge.mockRejectedValueOnce(new Error('MFA service unavailable'));

      const request = createMockRequest('POST', {});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('MFA challenge failed');
      expect(data.details).toBe('MFA service unavailable');
    });

    it('should apply rate limit headers to response', async () => {
      const { applyRateLimitHeaders } = require('@/lib/rate-limiter');

      const request = createMockRequest('POST', {});
      await POST(request);

      expect(applyRateLimitHeaders).toHaveBeenCalled();
    });

    it('should return JSON content type', async () => {
      const request = createMockRequest('POST', {});
      const response = await POST(request);

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('PUT /api/auth/mfa/verify - Verify MFA challenge', () => {
    it('should verify MFA challenge with token', async () => {
      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123',
        token: '123456'
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.deviceId).toBe('device-1');
      expect(data.data.deviceType).toBe('totp');
      expect(data.data.remainingBackupCodes).toBe(8);
      expect(data.message).toBe('MFA verification successful');
    });

    it('should verify MFA challenge with backup code', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');

      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123',
        backupCode: 'backup-code-123'
      });
      await PUT(request);

      expect(mfaProvider.verifyChallenge).toHaveBeenCalledWith(
        'challenge-123',
        '',
        'backup-code-123'
      );
    });

    it('should require either token or backup code', async () => {
      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123'
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request parameters');
      expect(data.details).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      const { createRateLimitedResponse } = require('@/lib/rate-limiter');

      // Modify mutable variable to simulate rate limit failure
      mockLegacyRateLimitResult = {
        allowed: false,
        remaining: 0,
        reset: Date.now() + 300000
      };

      createRateLimitedResponse.mockReturnValueOnce(
        new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429
        })
      );

      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123',
        token: '123456'
      });
      const response = await PUT(request);

      expect(createRateLimitedResponse).toHaveBeenCalled();
    });

    it('should handle verification failure', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.verifyChallenge.mockResolvedValueOnce({
        success: false,
        error: 'Invalid token'
      });

      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123',
        token: 'wrong-token'
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid token');
    });

    it('should handle missing challengeId', async () => {
      const request = createMockRequest('PUT', {
        token: '123456'
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should handle mfaProvider errors', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.verifyChallenge.mockRejectedValueOnce(new Error('Verification service error'));

      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123',
        token: '123456'
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('MFA verification failed');
      expect(data.details).toBe('Verification service error');
    });

    it('should apply rate limit headers to successful response', async () => {
      const { applyRateLimitHeaders } = require('@/lib/rate-limiter');

      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123',
        token: '123456'
      });
      await PUT(request);

      expect(applyRateLimitHeaders).toHaveBeenCalled();
    });

    it('should apply rate limit headers to failed response', async () => {
      const { applyRateLimitHeaders, mfaProvider } = require('@/lib/rate-limiter');
      const { mfaProvider: mfaProviderMock } = require('@/lib/auth/mfa-provider');

      mfaProviderMock.verifyChallenge.mockResolvedValueOnce({
        success: false,
        error: 'Invalid token'
      });

      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123',
        token: 'wrong-token'
      });
      await PUT(request);

      expect(applyRateLimitHeaders).toHaveBeenCalled();
    });

    it('should return JSON content type', async () => {
      const request = createMockRequest('PUT', {
        challengeId: 'challenge-123',
        token: '123456'
      });
      const response = await PUT(request);

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });

  describe('GET /api/auth/mfa/verify - Get user MFA devices', () => {
    it('should retrieve user MFA devices successfully', async () => {
      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.devices).toHaveLength(1);
      expect(data.data.devices[0].id).toBe('device-1');
      expect(data.data.devices[0].name).toBe('Authenticator App');
      expect(data.data.devices[0].type).toBe('totp');
    });

    it('should require authentication', async () => {
      // Modify mutable variable to simulate no session
      mockSession = null;

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should mask phone numbers', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.getUserDevices.mockReturnValueOnce([
        {
          id: 'device-1',
          name: 'SMS Device',
          type: 'sms',
          isActive: true,
          phoneNumber: '5551234567',
          lastUsed: '2024-01-01T00:00:00Z',
          createdAt: '2023-01-01T00:00:00Z'
        }
      ]);

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.devices[0].phoneNumber).toBe('555***4567');
    });

    it('should mask email addresses', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.getUserDevices.mockReturnValueOnce([
        {
          id: 'device-1',
          name: 'Email Device',
          type: 'email',
          isActive: true,
          email: 'test@example.com',
          lastUsed: '2024-01-01T00:00:00Z',
          createdAt: '2023-01-01T00:00:00Z'
        }
      ]);

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.devices[0].email).toBe('te***@example.com');
    });

    it('should handle devices without phone or email', async () => {
      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.devices[0].phoneNumber).toBeUndefined();
      expect(data.data.devices[0].email).toBeUndefined();
    });

    it('should handle mfaProvider errors', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.getUserDevices.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to retrieve MFA devices');
      expect(data.details).toBe('Database connection failed');
    });

    it('should call getUserDevices with user ID', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');

      const request = createMockRequest('GET');
      await GET(request);

      expect(mfaProvider.getUserDevices).toHaveBeenCalledWith('user-123');
    });

    it('should return JSON content type', async () => {
      const request = createMockRequest('GET');
      const response = await GET(request);

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should return empty array when no devices exist', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.getUserDevices.mockReturnValueOnce([]);

      const request = createMockRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.devices).toEqual([]);
    });
  });

  describe('DELETE /api/auth/mfa/verify - Remove MFA device', () => {
    it('should remove MFA device successfully', async () => {
      const request = createMockRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/auth/mfa/verify?deviceId=device-1'
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.message).toBe('MFA device removed');
    });

    it('should require authentication', async () => {
      // Modify mutable variable to simulate no session
      mockSession = null;

      const request = createMockRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/auth/mfa/verify?deviceId=device-1'
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should require deviceId parameter', async () => {
      const request = createMockRequest('DELETE');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Device ID required');
    });

    it('should handle device not found', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.removeDevice.mockResolvedValueOnce(false);

      const request = createMockRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/auth/mfa/verify?deviceId=nonexistent'
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Device not found or access denied');
    });

    it('should call removeDevice with deviceId and userId', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');

      const request = createMockRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/auth/mfa/verify?deviceId=device-1'
      );
      await DELETE(request);

      expect(mfaProvider.removeDevice).toHaveBeenCalledWith('device-1', 'user-123');
    });

    it('should handle mfaProvider errors', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');
      mfaProvider.removeDevice.mockRejectedValueOnce(new Error('Database error'));

      const request = createMockRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/auth/mfa/verify?deviceId=device-1'
      );
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to remove MFA device');
      expect(data.details).toBe('Database error');
    });

    it('should return JSON content type', async () => {
      const request = createMockRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/auth/mfa/verify?deviceId=device-1'
      );
      const response = await DELETE(request);

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });

    it('should handle multiple query parameters', async () => {
      const { mfaProvider } = require('@/lib/auth/mfa-provider');

      const request = createMockRequest(
        'DELETE',
        undefined,
        'http://localhost:3000/api/auth/mfa/verify?deviceId=device-1&extra=param'
      );
      await DELETE(request);

      expect(mfaProvider.removeDevice).toHaveBeenCalledWith('device-1', 'user-123');
    });
  });
});
