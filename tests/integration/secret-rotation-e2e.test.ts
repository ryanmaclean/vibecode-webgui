/**
 * End-to-End Integration Tests for Secret Rotation System
 *
 * Tests the complete secret lifecycle from registration to rotation.
 * Validates integration between SecretManager, API endpoints, database, and CLI tools.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  createChildLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Mock the macOS keychain module
jest.mock('@/lib/security/macos-keychain', () => ({
  setSecret: jest.fn().mockResolvedValue(undefined),
  getSecret: jest.fn().mockResolvedValue('mock-secret-value'),
  deleteSecret: jest.fn().mockResolvedValue(undefined),
  getSecretWithMetadata: jest.fn().mockResolvedValue({
    value: 'mock-secret-value',
    metadata: {
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      lastRotatedAt: null,
      rotationPolicy: 'api_keys',
      status: 'active',
    },
  }),
}));

// Skip tests if PostgreSQL is not available (set by jest.globalSetup.js)
const SKIP_E2E = process.env.SKIP_POSTGRES_TESTS === '1';
const describeIf = SKIP_E2E ? describe.skip : describe;

const prisma = new PrismaClient();

// Test data
const TEST_SECRET_PREFIX = 'e2e_test_secret_';
let testSecretCounter = 0;

function getTestSecretName(): string {
  testSecretCounter++;
  return `${TEST_SECRET_PREFIX}${testSecretCounter}_${Date.now()}`;
}

describeIf('Secret Rotation E2E Tests', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.secretRotationHistory.deleteMany({
      where: {
        secret: {
          key_name: { startsWith: TEST_SECRET_PREFIX },
        },
      },
    });
    await prisma.secretMetadata.deleteMany({
      where: { key_name: { startsWith: TEST_SECRET_PREFIX } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.secretRotationHistory.deleteMany({
      where: {
        secret: {
          key_name: { startsWith: TEST_SECRET_PREFIX },
        },
      },
    });
    await prisma.secretMetadata.deleteMany({
      where: { key_name: { startsWith: TEST_SECRET_PREFIX } },
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Secret Lifecycle', () => {
    let testSecretName: string;

    test('1. Register a test secret via SecretManager', async () => {
      testSecretName = getTestSecretName();

      const { SecretManager } = await import('@/lib/security/secret-manager');
      const secretManager = new SecretManager(prisma);

      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

      await secretManager.registerSecret(testSecretName, 'test-secret-value-123', {
        expiresAt,
        rotationPolicy: 'api_keys',
        metadata: { source: 'e2e-test', environment: 'test' },
      });

      // Verify secret was registered in database
      const secret = await prisma.secretMetadata.findUnique({
        where: { key_name: testSecretName },
      });

      expect(secret).toBeDefined();
      expect(secret!.key_name).toBe(testSecretName);
      expect(secret!.rotation_policy).toBe('api_keys');
      expect(secret!.status).toBe('active');
      expect(secret!.expires_at).toBeDefined();
    });

    test('2. Check expiration status via GET /api/secrets/status', async () => {
      // Authenticate the request
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { GET } = await import('@/app/api/secrets/status/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBeDefined();
      expect(data.secrets).toBeDefined();
      expect(data.secrets.total).toBeGreaterThan(0);
    });

    test('3. Trigger rotation via POST /api/secrets/rotate', async () => {
      // Authenticate the request
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { POST } = await import('@/app/api/secrets/rotate/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
        method: 'POST',
        body: JSON.stringify({
          secret_name: testSecretName,
          reason: 'E2E test rotation',
          dry_run: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.secretName).toBe(testSecretName);
      expect(data.rotatedAt).toBeDefined();
    });

    test('4. Verify new expiration date in database', async () => {
      const secret = await prisma.secretMetadata.findUnique({
        where: { key_name: testSecretName },
      });

      expect(secret).toBeDefined();
      expect(secret!.expires_at).toBeDefined();
      expect(secret!.last_rotated_at).toBeDefined();

      // Verify expiration is in the future (90 days for api_keys policy)
      const now = Date.now();
      const expiresAt = secret!.expires_at!.getTime();
      const daysUntilExpiration = (expiresAt - now) / (24 * 60 * 60 * 1000);

      expect(daysUntilExpiration).toBeGreaterThan(80); // Allow some margin
      expect(daysUntilExpiration).toBeLessThan(95);
    });

    test('5. Verify rotation history recorded', async () => {
      const secret = await prisma.secretMetadata.findUnique({
        where: { key_name: testSecretName },
      });

      const rotationHistory = await prisma.secretRotationHistory.findMany({
        where: { secret_id: secret!.id },
        orderBy: { rotated_at: 'desc' },
      });

      expect(rotationHistory.length).toBeGreaterThan(0);

      const latestRotation = rotationHistory[0];
      expect(latestRotation.rotated_by).toBe('test@example.com');
      expect(latestRotation.reason).toContain('test');
      expect(latestRotation.rotated_at).toBeDefined();
      expect(latestRotation.new_expires_at).toBeDefined();
    });

    test('6. Verify all components work together', async () => {
      // Final integration check: verify secret manager can retrieve the rotated secret
      const { SecretManager } = await import('@/lib/security/secret-manager');
      const secretManager = new SecretManager(prisma);

      const secretWithMetadata = await secretManager.getSecretWithMetadata(testSecretName);

      expect(secretWithMetadata).toBeDefined();
      expect(secretWithMetadata!.keyName).toBe(testSecretName);
      expect(secretWithMetadata!.metadata.rotationPolicy).toBe('api_keys');
      expect(secretWithMetadata!.metadata.status).toBe('active');
      expect(secretWithMetadata!.metadata.lastRotatedAt).toBeDefined();
    });
  });

  describe('Multiple Secret Management', () => {
    const testSecrets: string[] = [];

    test('Register multiple secrets with different policies', async () => {
      const { SecretManager } = await import('@/lib/security/secret-manager');
      const secretManager = new SecretManager(prisma);

      const policies = [
        { policy: 'api_keys', days: 90 },
        { policy: 'auth_tokens', days: 30 },
        { policy: 'db_credentials', days: 180 },
      ];

      for (const { policy, days } of policies) {
        const secretName = getTestSecretName();
        testSecrets.push(secretName);

        await secretManager.registerSecret(secretName, 'test-value', {
          expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          rotationPolicy: policy,
        });
      }

      // Verify all secrets were created
      const secrets = await prisma.secretMetadata.findMany({
        where: { key_name: { in: testSecrets } },
      });

      expect(secrets.length).toBe(policies.length);
    });

    test('List all secrets via SecretManager', async () => {
      const { SecretManager } = await import('@/lib/security/secret-manager');
      const secretManager = new SecretManager(prisma);

      const allSecrets = await secretManager.listAllSecrets({ status: 'active' });

      expect(allSecrets.length).toBeGreaterThanOrEqual(testSecrets.length);

      const ourSecrets = allSecrets.filter((s) =>
        testSecrets.includes(s.keyName)
      );

      expect(ourSecrets.length).toBe(testSecrets.length);
    });

    test('Check expiration status for multiple secrets', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { GET } = await import('@/app/api/secrets/status/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/status');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.secrets.total).toBeGreaterThanOrEqual(testSecrets.length);
      expect(data.policyCompliance).toBeDefined();
      expect(data.policyCompliance.withPolicy).toBeGreaterThanOrEqual(testSecrets.length);
    });
  });

  describe('Expiration Detection', () => {
    let expiredSecretName: string;
    let expiringSoonSecretName: string;

    beforeAll(async () => {
      const { SecretManager } = await import('@/lib/security/secret-manager');
      const secretManager = new SecretManager(prisma);

      // Create an expired secret
      expiredSecretName = getTestSecretName();
      await secretManager.registerSecret(expiredSecretName, 'expired-value', {
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        rotationPolicy: 'api_keys',
      });

      // Create a secret expiring soon
      expiringSoonSecretName = getTestSecretName();
      await secretManager.registerSecret(expiringSoonSecretName, 'expiring-soon-value', {
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        rotationPolicy: 'api_keys',
      });
    });

    test('API reports degraded status when secrets are expired', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { GET } = await import('@/app/api/secrets/status/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/status');

      const response = await GET(request);
      const data = await response.json();

      expect(data.secrets.expired).toBeGreaterThan(0);
      expect(['degraded', 'unhealthy']).toContain(data.status);
    });

    test('API includes alerts for expiring secrets', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { GET } = await import('@/app/api/secrets/status/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/status');

      const response = await GET(request);
      const data = await response.json();

      expect(data.alerts).toBeDefined();
      expect(Array.isArray(data.alerts)).toBe(true);
      expect(data.alerts.length).toBeGreaterThan(0);

      // Find alert for our expiring secret
      const expiringAlert = data.alerts.find((alert: any) =>
        alert.keyName === expiringSoonSecretName
      );

      if (expiringAlert) {
        expect(expiringAlert.severity).toBe('critical');
        expect(expiringAlert.daysUntilExpiration).toBeLessThan(7);
      }
    });

    test('ExpirationChecker identifies expired secrets', async () => {
      const { ExpirationChecker } = await import('@/lib/security/expiration-checker');
      const checker = new ExpirationChecker(prisma);

      const expiredSecrets = await checker.getExpired();

      const ourExpiredSecret = expiredSecrets.find(
        (s) => s.keyName === expiredSecretName
      );

      expect(ourExpiredSecret).toBeDefined();
    });

    test('ExpirationChecker identifies secrets expiring soon', async () => {
      const { ExpirationChecker } = await import('@/lib/security/expiration-checker');
      const checker = new ExpirationChecker(prisma);

      const expiringSoon = await checker.getExpiringSoon({ thresholdDays: 7 }); // Within 7 days

      const ourExpiringSoonSecret = expiringSoon.find(
        (s) => s.keyName === expiringSoonSecretName
      );

      expect(ourExpiringSoonSecret).toBeDefined();
    });

    test('ExpirationChecker generates comprehensive summary', async () => {
      const { ExpirationChecker } = await import('@/lib/security/expiration-checker');
      const checker = new ExpirationChecker(prisma);

      const summary = await checker.getSummary();

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.expired).toBeGreaterThan(0);
      expect(summary.expiringSoon).toBeGreaterThan(0);
      expect(summary.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Rotation Policy Enforcement', () => {
    test('Cannot rotate secret without policy', async () => {
      const { SecretManager } = await import('@/lib/security/secret-manager');
      const secretManager = new SecretManager(prisma);

      const noPolicySecret = getTestSecretName();
      await secretManager.registerSecret(noPolicySecret, 'no-policy-value', {
        // No rotation policy
      });

      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { POST } = await import('@/app/api/secrets/rotate/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
        method: 'POST',
        body: JSON.stringify({
          secret_name: noPolicySecret,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No rotation policy');
    });

    test('Dry run mode does not make changes', async () => {
      const { SecretManager } = await import('@/lib/security/secret-manager');
      const secretManager = new SecretManager(prisma);

      const dryRunSecret = getTestSecretName();
      await secretManager.registerSecret(dryRunSecret, 'dry-run-value', {
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        rotationPolicy: 'api_keys',
      });

      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { POST } = await import('@/app/api/secrets/rotate/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
        method: 'POST',
        body: JSON.stringify({
          secret_name: dryRunSecret,
          dry_run: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dryRun).toBe(true);

      // Verify no rotation history was created
      const secret = await prisma.secretMetadata.findUnique({
        where: { key_name: dryRunSecret },
      });

      const rotationHistory = await prisma.secretRotationHistory.findMany({
        where: { secret_id: secret!.id },
      });

      expect(rotationHistory.length).toBe(0);
    });

    test('Rotation respects cooldown period', async () => {
      const { SecretManager } = await import('@/lib/security/secret-manager');
      const secretManager = new SecretManager(prisma);

      const cooldownSecret = getTestSecretName();
      await secretManager.registerSecret(cooldownSecret, 'cooldown-value', {
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        rotationPolicy: 'api_keys',
      });

      // First rotation should succeed
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { POST } = await import('@/app/api/secrets/rotate/route');
      const request1 = new NextRequest('http://localhost:3000/api/secrets/rotate', {
        method: 'POST',
        body: JSON.stringify({
          secret_name: cooldownSecret,
          dry_run: false,
        }),
      });

      const response1 = await POST(request1);
      expect(response1.status).toBe(200);

      // Immediate second rotation should fail due to cooldown
      const request2 = new NextRequest('http://localhost:3000/api/secrets/rotate', {
        method: 'POST',
        body: JSON.stringify({
          secret_name: cooldownSecret,
          dry_run: false,
        }),
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      // Should indicate cooldown in response
      expect(data2.success).toBe(false);
      expect(data2.error || data2.message).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('Rotation fails for non-existent secret', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { POST } = await import('@/app/api/secrets/rotate/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
        method: 'POST',
        body: JSON.stringify({
          secret_name: 'non_existent_secret_12345',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Secret not found');
    });

    test('API requires authentication', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const { POST } = await import('@/app/api/secrets/rotate/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
        method: 'POST',
        body: JSON.stringify({
          secret_name: 'test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    test('Database errors are handled gracefully', async () => {
      // Temporarily mock prisma to throw an error
      const originalFindUnique = prisma.secretMetadata.findUnique;
      (prisma.secretMetadata.findUnique as any) = jest
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));

      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValue({
        user: { email: 'test@example.com' },
      });

      const { POST } = await import('@/app/api/secrets/rotate/route');
      const request = new NextRequest('http://localhost:3000/api/secrets/rotate', {
        method: 'POST',
        body: JSON.stringify({
          secret_name: 'test',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();

      // Restore original
      prisma.secretMetadata.findUnique = originalFindUnique;
    });
  });

  describe('Python CLI Integration (Optional)', () => {
    test('check_expiration.py script can be executed', async () => {
      // This test is optional and will skip if Python is not available
      try {
        const { stdout, stderr } = await execAsync(
          'cd scripts/security && python check_expiration.py --help'
        );

        expect(stdout).toContain('usage:');
        expect(stderr).toBe('');
      } catch (error: any) {
        // Skip test if Python is not available
        if (error.message.includes('python: command not found')) {
          console.log('Skipping Python CLI test: Python not available');
          return;
        }
        throw error;
      }
    }, 10000);

    test('check_expiration.py can check test secrets', async () => {
      // This test is optional and will skip if Python/database is not available
      try {
        const { stdout } = await execAsync(
          `cd scripts/security && DATABASE_URL="${process.env.DATABASE_URL}" python check_expiration.py --format json --no-color`
        );

        const result = JSON.parse(stdout);

        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
        expect(result.secrets).toBeDefined();
      } catch (error: any) {
        // Skip test if environment is not suitable
        if (
          error.message.includes('python: command not found') ||
          error.message.includes('DATABASE_URL')
        ) {
          console.log('Skipping Python CLI integration test: Environment not suitable');
          return;
        }
        throw error;
      }
    }, 15000);
  });
});
