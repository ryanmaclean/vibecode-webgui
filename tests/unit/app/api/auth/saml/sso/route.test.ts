/**
 * @jest-environment node
 */

/**
 * Unit tests for SAML SSO API Routes
 */

import { NextRequest } from 'next/server';
import { GET, POST, PUT } from '@/app/api/auth/saml/sso/route';

// Mock the SAML provider
jest.mock('@/lib/auth/saml-provider', () => ({
  createSAMLProvider: jest.fn((provider: string) => ({
    generateAuthRequest: jest.fn(({ relayState, forceAuthn }: any) => ({
      url: `https://${provider}.example.com/sso`,
      samlRequest: 'base64-encoded-saml-request',
      relayState: relayState || 'default-relay-state'
    })),
    processResponse: jest.fn(async (samlResponse: string, relayState?: string) => ({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
      provider: provider,
      groups: ['users', 'admins'],
      roles: ['admin']
    }))
  }))
}));

// Mock rate limiting with a mutable handler
let mockRateLimitResult = {
  success: true,
  limit: 20,
  remaining: 19,
  reset: Date.now() + 60000,
  retryAfter: undefined as number | undefined
};

jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn(() => {
    return jest.fn(async () => mockRateLimitResult);
  })
}));

// Helper function to create a mock NextRequest
function createMockRequest(
  url: string = 'http://localhost:3000/api/auth/saml/sso',
  options: RequestInit = {}
): NextRequest {
  return new NextRequest(url, {
    method: options.method || 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      'content-type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    },
    body: options.body
  });
}

describe('/api/auth/saml/sso', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset rate limit mock to success state
    mockRateLimitResult = {
      success: true,
      limit: 20,
      remaining: 19,
      reset: Date.now() + 60000,
      retryAfter: undefined
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/auth/saml/sso - Initiate SAML authentication', () => {
    it('should initiate SAML authentication with default provider', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'okta' })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data).toHaveProperty('redirectUrl');
      expect(data.data).toHaveProperty('samlRequest');
      expect(data.data.redirectUrl).toContain('okta.example.com');
    });

    it('should support multiple SAML providers', async () => {
      const providers = ['okta', 'azure', 'google', 'onelogin', 'auth0'];

      for (const provider of providers) {
        const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
          method: 'POST',
          body: JSON.stringify({ provider })
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.redirectUrl).toContain(`${provider}.example.com`);
      }
    });

    it('should handle relay state parameter', async () => {
      const relayState = '/dashboard';
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'okta', relayState })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.relayState).toBe(relayState);
    });

    it('should handle forceAuthn parameter', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'okta', forceAuthn: true })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });

    it('should reject invalid provider names', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'invalid-provider' })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject provider names with invalid characters', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'okta@evil' })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      // Set rate limit to fail
      mockRateLimitResult = {
        success: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60
      };

      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'okta' })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('20');
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('should validate relay state length', async () => {
      const longRelayState = 'a'.repeat(501);
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'okta', relayState: longRelayState })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle missing provider configuration', async () => {
      const { createSAMLProvider } = require('@/lib/auth/saml-provider');
      createSAMLProvider.mockReturnValueOnce(null);

      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'okta' })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not configured');
    });

    it('should handle unexpected errors gracefully', async () => {
      const { createSAMLProvider } = require('@/lib/auth/saml-provider');
      createSAMLProvider.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'POST',
        body: JSON.stringify({ provider: 'okta' })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('SAML SSO initiation failed');
    });
  });

  describe('PUT /api/auth/saml/sso - Process SAML response', () => {
    const validSAMLResponse = '<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">test</samlp:Response>';

    it('should process valid SAML response (JSON)', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: validSAMLResponse })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.user).toHaveProperty('id');
      expect(data.data.user).toHaveProperty('email');
      expect(data.data).toHaveProperty('sessionId');
    });

    // Note: Form-encoded test omitted due to NextRequest mock limitations
    // The form-encoded path is covered by integration tests

    it('should include user groups and roles', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: validSAMLResponse })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.user.groups).toEqual(['users', 'admins']);
      expect(data.data.user.roles).toEqual(['admin']);
    });

    it('should handle relay state in response', async () => {
      const relayState = '/dashboard';
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: validSAMLResponse, RelayState: relayState })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.relayState).toBe(relayState);
    });

    it('should reject invalid SAML response format', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: 'not-a-saml-response' })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid SAML response format');
    });

    it('should reject empty SAML response', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: '' })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should reject oversized SAML response', async () => {
      const hugeSAMLResponse = '<saml:Response>' + 'a'.repeat(50001) + '</saml:Response>';
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: hugeSAMLResponse })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      // Set rate limit to fail
      mockRateLimitResult = {
        success: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60
      };

      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: validSAMLResponse })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
    });

    it('should handle missing provider configuration', async () => {
      const { createSAMLProvider } = require('@/lib/auth/saml-provider');
      createSAMLProvider.mockReturnValueOnce(null);

      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: validSAMLResponse })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not configured');
    });

    it('should handle authentication processing errors', async () => {
      const { createSAMLProvider } = require('@/lib/auth/saml-provider');
      createSAMLProvider.mockReturnValueOnce({
        processResponse: jest.fn(async () => {
          throw new Error('Invalid assertion');
        })
      });

      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso', {
        method: 'PUT',
        body: JSON.stringify({ SAMLResponse: validSAMLResponse })
      });

      const response = await PUT(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('SAML authentication failed');
    });
  });

  describe('GET /api/auth/saml/sso - Get SAML configuration', () => {
    beforeEach(() => {
      // Set up environment variables for testing
      process.env.SAML_OKTA_ENTITY_ID = 'https://okta.example.com/entity';
    });

    afterEach(() => {
      delete process.env.SAML_OKTA_ENTITY_ID;
    });

    it('should return SAML configuration for default provider', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data).toHaveProperty('provider');
      expect(data.data).toHaveProperty('entityId');
      expect(data.data).toHaveProperty('endpoints');
    });

    it('should return configuration for specified provider', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso?provider=azure');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.provider).toBe('azure');
    });

    it('should include metadata endpoint', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso?provider=okta');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.endpoints.metadata).toBe('/api/auth/saml/metadata?provider=okta');
    });

    it('should include SSO endpoints', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.endpoints).toHaveProperty('sso');
      expect(data.data.endpoints).toHaveProperty('acs');
      expect(data.data.endpoints).toHaveProperty('sls');
    });

    it('should indicate provider availability', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso?provider=okta');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('available');
      expect(typeof data.data.available).toBe('boolean');
    });

    it('should handle rate limiting', async () => {
      // Set rate limit to fail
      mockRateLimitResult = {
        success: false,
        limit: 20,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 60
      };

      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
    });

    it('should handle unexpected errors gracefully', async () => {
      // Force an error by making URL parsing fail
      const mockRequest = {
        ...createMockRequest('http://localhost:3000/api/auth/saml/sso'),
        url: null as any
      };

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get SAML configuration');
    });

    it('should return JSON content type', async () => {
      const mockRequest = createMockRequest('http://localhost:3000/api/auth/saml/sso');

      const response = await GET(mockRequest);

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });
});
