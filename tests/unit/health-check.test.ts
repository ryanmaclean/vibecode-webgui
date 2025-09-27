/**
 * Health Check Validation Test
 * Tests the improved database and Redis connection health checks
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn() as unknown as typeof fetch;

describe('Health Check Improvements', () => {
  beforeEach(() => {
    // Clear any existing environment variables
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    
    // Mock fetch responses
    (global.fetch as jest.Mock).mockClear();
    
    // Ensure we're in a server-side environment for these tests
    // Remove window to simulate server-side
    if (typeof window !== 'undefined') {
      delete (global as any).window;
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Reset modules to clear any cached imports
    jest.resetModules();
  });

  describe('Database Health Check', () => {
    test('should handle missing DATABASE_URL gracefully', async () => {
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const result = await monitoring.checkDatabase();
      
      expect(result.status).toBe('healthy');
      expect(result.details).toBe('Database not configured (using file storage)');
    });

    test('should attempt PostgreSQL connection with fallbacks', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const result = await monitoring.checkDatabase();
      
      // Should return error status when actual connection fails, but with detailed error info
      expect(result.status).toBe('error');
      expect(result.details).toBeDefined();
      
      if (result.details && typeof result.details === 'object') {
        expect(result.details).toHaveProperty('host');
        expect(result.details).toHaveProperty('database');
        expect(result.details).toHaveProperty('note');
      }
    });

    test('should handle malformed DATABASE_URL', async () => {
      process.env.DATABASE_URL = 'invalid-url';
      
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const result = await monitoring.checkDatabase();
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Invalid URL');
    });

    test('should use environment variables for connection timeout', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
      process.env.DB_POOL_CONNECTION_TIMEOUT = '1000';
      
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const result = await monitoring.checkDatabase();
      
      // Should fail quickly with the timeout setting
      expect(result.status).toBe('error');
    });
  });

  describe('Redis Health Check', () => {
    test('should handle missing REDIS_URL gracefully', async () => {
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const result = await monitoring.checkValkey();
      
      expect(result.status).toBe('healthy');
      expect(result.details).toBe('Valkey not configured (using memory storage)');
    });

    test('should attempt Redis connection with fallbacks', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const result = await monitoring.checkValkey();
      
      // Should return error status when actual connection fails, but with detailed error info
      expect(result.status).toBe('error');
      expect(result.details).toBeDefined();
      
      if (result.details && typeof result.details === 'object') {
        expect(result.details).toHaveProperty('host');
        expect(result.details).toHaveProperty('port');
        expect(result.details).toHaveProperty('error');
        expect(result.details).toHaveProperty('note');
      }
    });

    test('should handle Redis URL with authentication', async () => {
      process.env.REDIS_URL = 'redis://:password@localhost:6379/1';
      
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const result = await monitoring.checkValkey();
      
      expect(result.status).toBe('error');
      
      if (result.details && typeof result.details === 'object') {
        expect(result.details).toHaveProperty('database', '1');
      }
    });

    test('should use environment variables for connection timeout', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.REDIS_CONNECT_TIMEOUT = '1000';
      
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const result = await monitoring.checkValkey();
      
      // Should fail quickly with the timeout setting
      expect(result.status).toBe('error');
    });
  });

  describe('Connection Configuration', () => {
    test('should load database pool configuration from environment', async () => {
      process.env.DB_POOL_MAX = '20';
      process.env.DB_POOL_MIN = '5';
      process.env.DB_POOL_CONNECTION_TIMEOUT = '8000';
      
      const { getDatabasePoolConfig } = await import('../../src/lib/db/connection-config');
      
      const config = getDatabasePoolConfig();
      
      expect(config.max).toBe(20);
      expect(config.min).toBe(5);
      expect(config.connectionTimeoutMillis).toBe(8000);
    });

    test('should load Redis connection configuration from environment', async () => {
      process.env.REDIS_CONNECT_TIMEOUT = '3000';
      process.env.REDIS_MAX_RETRIES = '5';
      
      const { getRedisConnectionConfig } = await import('../../src/lib/db/connection-config');
      
      const config = getRedisConnectionConfig();
      
      expect(config.connectTimeout).toBe(3000);
      expect(config.maxRetriesPerRequest).toBe(5);
    });

    test('should provide connection status summary', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
      process.env.REDIS_URL = 'redis://localhost:6379';
      
      const { getConnectionStatus } = await import('../../src/lib/db/connection-config');
      
      const status = getConnectionStatus();
      
      expect(status.database.configured).toBe(true);
      expect(status.redis.configured).toBe(true);
      expect(status.database.url).toContain('localhost:5432/testdb');
      expect(status.redis.url).toContain('redis://localhost:6379');
    });
  });

  describe('Error Handling', () => {
    test('should not throw unhandled promise rejections', async () => {
      process.env.DATABASE_URL = 'postgresql://invalid:invalid@nonexistent:5432/test';
      process.env.REDIS_URL = 'redis://nonexistent:6379';
      
      const { monitoring } = await import('../../src/lib/monitoring');
      
      // These should not throw, even with invalid connections
      await expect(monitoring.checkDatabase()).resolves.toBeDefined();
      await expect(monitoring.checkValkey()).resolves.toBeDefined();
    });

    test('should handle network timeouts gracefully', async () => {
      process.env.DATABASE_URL = 'postgresql://test:test@192.0.2.0:5432/test'; // Non-routable IP
      process.env.REDIS_URL = 'redis://192.0.2.0:6379'; // Non-routable IP
      process.env.DB_POOL_CONNECTION_TIMEOUT = '100'; // Very short timeout
      process.env.REDIS_CONNECT_TIMEOUT = '100'; // Very short timeout
      
      const { monitoring } = await import('../../src/lib/monitoring');
      
      const [dbResult, redisResult] = await Promise.all([
        monitoring.checkDatabase(),
        monitoring.checkValkey()
      ]);
      
      expect(dbResult.status).toBe('error');
      expect(redisResult.status).toBe('error');
    });
  });
});