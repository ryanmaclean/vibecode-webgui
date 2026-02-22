/**
 * Secret Management API Integration Tests
 * Tests for /api/secrets/status and /api/secrets/rotate endpoints
 */

import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

// Mock next-auth for authentication testing
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock the auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock the logging
jest.mock('@/lib/logging', () => ({
  createServiceLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Secret Management API Routes', () => {
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock Prisma client
    mockPrisma = {
      secretMetadata: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      secretRotationHistory: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $disconnect: jest.fn(),
    } as any;

    // Mock PrismaClient constructor
    jest.spyOn(require('@prisma/client'), 'PrismaClient').mockImplementation(() => mockPrisma);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  describe('GET /api/secrets/status', () => {
    describe('Authentication', () => {
      it('should return limited info for unauthenticated requests', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue(null);

        // Mock empty secrets
        (mockPrisma.secretMetadata.findMany as jest.Mock).mockResolvedValue([]);
        (mockPrisma.secretRotationHistory.findMany as jest.Mock).mockResolvedValue([]);

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe('ok');
        expect(data.timestamp).toBeDefined();
        // Should not include detailed information
        expect(data.secrets).toBeUndefined();
        expect(data.alerts).toBeUndefined();
        expect(data.policyCompliance).toBeUndefined();
      });

      it('should return full details for authenticated requests', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });

        // Mock secrets data
        (mockPrisma.secretMetadata.findMany as jest.Mock).mockResolvedValue([
          {
            id: 1,
            key_name: 'TEST_API_KEY',
            expires_at: new Date(Date.now() + 86400000 * 60), // 60 days from now
            rotation_policy: 'api_keys',
            status: 'active',
            last_rotated_at: null,
          },
        ]);
        (mockPrisma.secretRotationHistory.findMany as jest.Mock).mockResolvedValue([]);

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe('healthy');
        expect(data.secrets).toBeDefined();
        expect(data.secrets.total).toBe(1);
        expect(data.policyCompliance).toBeDefined();
        expect(data.lastRotations).toBeDefined();
        expect(data.requestId).toBeDefined();
      });
    });

    describe('Secret Status Monitoring', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should report healthy status when no secrets are expired', async () => {
        (mockPrisma.secretMetadata.findMany as jest.Mock).mockResolvedValue([
          {
            id: 1,
            key_name: 'TEST_API_KEY',
            expires_at: new Date(Date.now() + 86400000 * 60),
            rotation_policy: 'api_keys',
            status: 'active',
            last_rotated_at: null,
          },
        ]);
        (mockPrisma.secretRotationHistory.findMany as jest.Mock).mockResolvedValue([]);

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.status).toBe('healthy');
        expect(data.secrets.expired).toBe(0);
      });

      it('should report degraded status when secrets are expired', async () => {
        (mockPrisma.secretMetadata.findMany as jest.Mock).mockResolvedValue([
          {
            id: 1,
            key_name: 'EXPIRED_KEY',
            expires_at: new Date(Date.now() - 86400000), // Yesterday
            rotation_policy: 'api_keys',
            status: 'active',
            last_rotated_at: null,
          },
        ]);
        (mockPrisma.secretRotationHistory.findMany as jest.Mock).mockResolvedValue([]);

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.status).toBe('degraded');
        expect(data.secrets.expired).toBeGreaterThan(0);
      });

      it('should include secrets expiring soon', async () => {
        (mockPrisma.secretMetadata.findMany as jest.Mock).mockResolvedValue([
          {
            id: 1,
            key_name: 'EXPIRING_SOON',
            expires_at: new Date(Date.now() + 86400000 * 5), // 5 days from now
            rotation_policy: 'api_keys',
            status: 'active',
            last_rotated_at: null,
          },
        ]);
        (mockPrisma.secretRotationHistory.findMany as jest.Mock).mockResolvedValue([]);

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(data.secrets.expiringSoon).toBeGreaterThan(0);
        expect(data.alerts.length).toBeGreaterThan(0);
        expect(data.alerts[0].severity).toBe('critical');
      });
    });

    describe('Policy Compliance', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should calculate policy compliance rate', async () => {
        (mockPrisma.secretMetadata.findMany as jest.Mock).mockResolvedValue([
          {
            id: 1,
            key_name: 'WITH_POLICY',
            expires_at: new Date(Date.now() + 86400000 * 60),
            rotation_policy: 'api_keys',
            status: 'active',
            last_rotated_at: null,
          },
          {
            id: 2,
            key_name: 'WITHOUT_POLICY',
            expires_at: null,
            rotation_policy: null,
            status: 'active',
            last_rotated_at: null,
          },
        ]);
        (mockPrisma.secretRotationHistory.findMany as jest.Mock).mockResolvedValue([]);

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(data.policyCompliance.total).toBe(2);
        expect(data.policyCompliance.withPolicy).toBe(1);
        expect(data.policyCompliance.withoutPolicy).toBe(1);
        expect(data.policyCompliance.complianceRate).toBeDefined();
      });
    });

    describe('Rotation History', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should include recent rotation history', async () => {
        (mockPrisma.secretMetadata.findMany as jest.Mock).mockResolvedValue([]);
        (mockPrisma.secretRotationHistory.findMany as jest.Mock).mockResolvedValue([
          {
            secret_id: 1,
            rotated_at: new Date(),
            rotated_by: 'test@example.com',
            reason: 'Manual rotation',
          },
        ]);

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(data.lastRotations).toBeDefined();
        expect(data.lastRotations.length).toBe(1);
        expect(data.lastRotations[0].rotatedBy).toBe('test@example.com');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully for authenticated users', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });

        (mockPrisma.secretMetadata.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.status).toBe('unhealthy');
        expect(data.error).toBeDefined();
      });

      it('should return limited error info for unauthenticated users', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue(null);

        (mockPrisma.secretMetadata.findMany as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.status).toBe('unhealthy');
        expect(data.error).toBeUndefined();
      });
    });
  });

  describe('POST /api/secrets/rotate', () => {
    describe('Authentication', () => {
      it('should reject unauthenticated requests', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue(null);

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({ secret_name: 'TEST_KEY' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');
      });

      it('should accept authenticated requests', async () => {
        const { getServerSession } = await import('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });

        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: new Date(Date.now() + 86400000 * 60),
          rotation_policy: 'api_keys',
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({ secret_name: 'TEST_KEY', dry_run: true }),
        });

        const response = await POST(request);

        expect(response.status).not.toBe(401);
      });
    });

    describe('Request Validation', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should validate required secret_name field', async () => {
        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({}),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid request');
      });

      it('should accept valid request with secret_name', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: new Date(Date.now() + 86400000 * 60),
          rotation_policy: 'api_keys',
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({ secret_name: 'TEST_KEY', dry_run: true }),
        });

        const response = await POST(request);

        expect(response.status).not.toBe(400);
      });

      it('should accept optional reason field', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: new Date(Date.now() + 86400000 * 60),
          rotation_policy: 'api_keys',
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({
            secret_name: 'TEST_KEY',
            reason: 'Security audit',
            dry_run: true,
          }),
        });

        const response = await POST(request);

        expect(response.status).not.toBe(400);
      });
    });

    describe('Secret Lookup', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should return 404 for non-existent secret', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue(null);

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({ secret_name: 'NON_EXISTENT' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Secret not found');
      });

      it('should return 400 for secret without rotation policy', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: null,
          rotation_policy: null,
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({ secret_name: 'TEST_KEY' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('No rotation policy');
      });
    });

    describe('Dry Run Mode', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should support dry run without making changes', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: new Date(Date.now() + 86400000 * 60),
          rotation_policy: 'api_keys',
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({
            secret_name: 'TEST_KEY',
            dry_run: true,
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.dryRun).toBe(true);
        // Should not create rotation history in dry run mode
        expect(mockPrisma.secretRotationHistory.create).not.toHaveBeenCalled();
      });
    });

    describe('Rotation Execution', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should return rotation result with timestamps', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: new Date(Date.now() + 86400000 * 60),
          rotation_policy: 'api_keys',
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({
            secret_name: 'TEST_KEY',
            dry_run: true,
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.secretName).toBe('TEST_KEY');
        expect(data.rotatedAt).toBeDefined();
        expect(data.responseTime).toBeDefined();
        expect(data.requestId).toBeDefined();
      });

      it('should include next steps in response', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: new Date(Date.now() + 86400000 * 60),
          rotation_policy: 'api_keys',
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({
            secret_name: 'TEST_KEY',
            dry_run: true,
          }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.nextSteps).toBeDefined();
        expect(Array.isArray(data.nextSteps)).toBe(true);
      });
    });

    describe('Error Handling', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should handle database errors gracefully', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockRejectedValue(
          new Error('Database connection failed')
        );

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({ secret_name: 'TEST_KEY' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Rotation failed');
        expect(data.message).toBeDefined();
      });

      it('should handle malformed JSON gracefully', async () => {
        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: 'invalid json',
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBeDefined();
      });
    });
  });

  describe('Response Format Validation', () => {
    describe('Status Endpoint', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
        (mockPrisma.secretMetadata.findMany as jest.Mock).mockResolvedValue([]);
        (mockPrisma.secretRotationHistory.findMany as jest.Mock).mockResolvedValue([]);
      });

      it('should return JSON content type', async () => {
        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);

        expect(response.headers.get('content-type')).toContain('application/json');
      });

      it('should include response time metric', async () => {
        const { GET } = await import('@/app/api/secrets/status/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/status');

        const response = await GET(request);
        const data = await response.json();

        expect(data.responseTime).toBeDefined();
        expect(data.responseTime).toMatch(/\d+ms/);
      });
    });

    describe('Rotate Endpoint', () => {
      beforeEach(() => {
        const { getServerSession } = require('next-auth');
        (getServerSession as jest.Mock).mockResolvedValue({
          user: { email: 'test@example.com' },
        });
      });

      it('should return JSON content type', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: new Date(Date.now() + 86400000 * 60),
          rotation_policy: 'api_keys',
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({ secret_name: 'TEST_KEY', dry_run: true }),
        });

        const response = await POST(request);

        expect(response.headers.get('content-type')).toContain('application/json');
      });

      it('should include response time metric', async () => {
        (mockPrisma.secretMetadata.findUnique as jest.Mock).mockResolvedValue({
          id: 1,
          key_name: 'TEST_KEY',
          expires_at: new Date(Date.now() + 86400000 * 60),
          rotation_policy: 'api_keys',
          status: 'active',
          last_rotated_at: null,
        });

        const { POST } = await import('@/app/api/secrets/rotate/route');
        const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
          method: 'POST',
          body: JSON.stringify({ secret_name: 'TEST_KEY', dry_run: true }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(data.responseTime).toBeDefined();
        expect(data.responseTime).toMatch(/\d+ms/);
      });
    });
  });
});
