/**
 * @jest-environment node
 */

/**
 * Unit tests for User Preferences API Route
 * Tests preference loading and saving
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/user/preferences/route';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn()
    }
  }
}));

jest.mock('@/lib/server/user-preferences', () => ({
  loadUserPreferences: jest.fn(),
  saveUserPreferences: jest.fn()
}));

jest.mock('@/lib/user-preferences', () => ({
  userPreferencesInputSchema: {
    parse: jest.fn((data) => data)
  }
}));

// Import after mocking to get the mocked versions
import { prisma } from '@/lib/prisma';
import { loadUserPreferences, saveUserPreferences } from '@/lib/server/user-preferences';

const mockPrismaUser = prisma.user as jest.Mocked<typeof prisma.user>;
const mockLoadUserPreferences = loadUserPreferences as jest.MockedFunction<typeof loadUserPreferences>;
const mockSaveUserPreferences = saveUserPreferences as jest.MockedFunction<typeof saveUserPreferences>;

// Helper function to create a mock NextRequest
function createMockRequest(url: string, method: string, body?: any): NextRequest {
  const options: any = {
    method,
    headers: {
      'content-type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return new NextRequest(url, options);
}

describe('/api/user/preferences', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValue(mockSession);
    mockPrismaUser.findUnique.mockResolvedValue({ id: 'user-123' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/user/preferences', () => {
    const validPreferences = {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: false
      },
      editorSettings: {
        fontSize: 14,
        tabSize: 2
      }
    };

    it('should save user preferences successfully', async () => {
      mockSaveUserPreferences.mockResolvedValue(validPreferences);

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'POST', validPreferences);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Preferences saved successfully');
      expect(data.preferences).toEqual(validPreferences);
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'POST', validPreferences);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'POST', validPreferences);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should validate preferences schema', async () => {
      const { userPreferencesInputSchema } = require('@/lib/user-preferences');

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'POST', validPreferences);
      await POST(request);

      expect(userPreferencesInputSchema.parse).toHaveBeenCalledWith(validPreferences);
    });

    it('should call saveUserPreferences with user ID and preferences', async () => {
      mockSaveUserPreferences.mockResolvedValue(validPreferences);

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'POST', validPreferences);
      await POST(request);

      expect(mockSaveUserPreferences).toHaveBeenCalledWith('user-123', validPreferences);
    });

    it('should handle save errors gracefully', async () => {
      mockSaveUserPreferences.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'POST', validPreferences);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save preferences');
    });

    it('should handle validation errors', async () => {
      const { userPreferencesInputSchema } = require('@/lib/user-preferences');
      userPreferencesInputSchema.parse.mockImplementationOnce(() => {
        throw new Error('Validation failed');
      });

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'POST', validPreferences);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save preferences');
    });

    it('should handle Prisma errors', async () => {
      mockPrismaUser.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'POST', validPreferences);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to save preferences');
    });
  });

  describe('GET /api/user/preferences', () => {
    const mockPreferences = {
      theme: 'light',
      language: 'es',
      notifications: {
        email: true,
        push: true
      }
    };

    it('should load user preferences successfully', async () => {
      mockLoadUserPreferences.mockResolvedValue(mockPreferences);

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockPreferences);
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should call loadUserPreferences with user ID', async () => {
      mockLoadUserPreferences.mockResolvedValue(mockPreferences);

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'GET');
      await GET(request);

      expect(mockLoadUserPreferences).toHaveBeenCalledWith('user-123');
    });

    it('should handle load errors gracefully', async () => {
      mockLoadUserPreferences.mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch preferences');
    });

    it('should handle Prisma errors', async () => {
      mockPrismaUser.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch preferences');
    });

    it('should return default preferences when none exist', async () => {
      mockLoadUserPreferences.mockResolvedValue({});

      const request = createMockRequest('http://localhost:3000/api/user/preferences', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({});
    });
  });
});
