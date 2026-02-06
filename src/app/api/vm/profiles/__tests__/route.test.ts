/**
 * @jest-environment node
 */

/**
 * Unit tests for VM Profiles API Route
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

// Mock next-auth
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: jest.fn(),
}));

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: { providers: [] },
}));

// Mock service logger
jest.mock('@/lib/logging', () => ({
  createServiceLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock rate limiting with a function we can access via require
jest.mock('@/lib/rate-limiting', () => {
  const fn = jest.fn().mockResolvedValue({
    success: true,
    limit: 60,
    remaining: 59,
    reset: Date.now() + 60000,
  });
  return {
    createAPIRateLimit: () => fn,
    __mockRateLimitFn: fn,
  };
});

import { GET } from '../route';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

// Get reference to the shared rate limit mock
const { __mockRateLimitFn: mockRateLimitFn } = jest.requireMock('@/lib/rate-limiting');

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('/api/vm/profiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default rate limit behavior after clearAllMocks
    mockRateLimitFn.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    });
  });

  describe('GET - list all profiles', () => {
    it('returns all profiles when authenticated', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'test-user', email: 'test@example.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const response = await GET(createRequest('/api/vm/profiles'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profiles).toBeDefined();
      expect(Array.isArray(data.profiles)).toBe(true);
      expect(data.profiles.length).toBe(4);
      expect(data.total).toBe(4);
    });

    it('returns profiles with expected structure', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'test-user', email: 'test@example.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const response = await GET(createRequest('/api/vm/profiles'));
      const data = await response.json();

      const profile = data.profiles[0];
      expect(profile).toHaveProperty('id');
      expect(profile).toHaveProperty('name');
      expect(profile).toHaveProperty('description');
      expect(profile).toHaveProperty('resources');
      expect(profile).toHaveProperty('services');
      expect(profile).toHaveProperty('isBuiltIn', true);
    });

    it('includes all four built-in profile IDs', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'test-user', email: 'test@example.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const response = await GET(createRequest('/api/vm/profiles'));
      const data = await response.json();

      const ids = data.profiles.map((p: any) => p.id);
      expect(ids).toContain('minimal');
      expect(ids).toContain('development');
      expect(ids).toContain('testing');
      expect(ids).toContain('performance');
    });
  });

  describe('GET - single profile by id', () => {
    it('returns a specific profile when id query param is provided', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'test-user', email: 'test@example.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const response = await GET(createRequest('/api/vm/profiles?id=development'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.profile).toBeDefined();
      expect(data.profile.id).toBe('development');
      expect(data.profile.name).toBe('Development');
      expect(data.profile.resources.cpuCores).toBe(2);
      expect(data.profile.resources.memoryMB).toBe(2048);
    });

    it('returns 404 when profile id is not found', async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: 'test-user', email: 'test@example.com' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const response = await GET(createRequest('/api/vm/profiles?id=nonexistent'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('Authentication', () => {
    it('returns 401 when no session exists', async () => {
      mockGetServerSession.mockResolvedValue(null);

      const response = await GET(createRequest('/api/vm/profiles'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 when rate limited', async () => {
      mockRateLimitFn.mockResolvedValueOnce({
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 60000,
        retryAfter: 30,
      });

      const response = await GET(createRequest('/api/vm/profiles'));
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe('Too many requests');
    });
  });
});
