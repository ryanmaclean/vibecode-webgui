/**
 * Unit tests for db-pool.ts
 * Tests connection pool management functionality
 */

import {
  connectionPool,
  poolConfig,
  incrementWaitingAcquires,
  decrementWaitingAcquires,
  getWaitingAcquires,
  findLeastRecentlyUsedConnection,
  getConnectionPoolStatus,
  getDetailedConnectionPoolInfo
} from '@/lib/db/db-pool';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }])
  }))
}));

describe('db-pool', () => {
  // Store original state
  let originalClients: Map<string, PrismaClient>;
  let originalInUse: number;
  let originalWaitingAcquires: number;
  let originalLastValidated: Map<string, number>;
  let originalLastUsed: Map<string, number>;
  let originalCreationTimes: Map<string, number>;
  let originalInUseConnections: Map<string, number>;
  let originalUsage: typeof connectionPool.usage;

  beforeEach(() => {
    // Store original state
    originalClients = new Map(connectionPool.clients);
    originalInUse = connectionPool.inUse;
    originalWaitingAcquires = connectionPool.waitingAcquires;
    originalLastValidated = new Map(connectionPool.lastValidated);
    originalLastUsed = new Map(connectionPool.lastUsed);
    originalCreationTimes = new Map(connectionPool.creationTimes);
    originalInUseConnections = new Map(connectionPool.inUseConnections);
    originalUsage = { ...connectionPool.usage };

    // Reset pool state for tests
    connectionPool.clients.clear();
    connectionPool.inUse = 0;
    connectionPool.waitingAcquires = 0;
    connectionPool.lastValidated.clear();
    connectionPool.lastUsed.clear();
    connectionPool.creationTimes.clear();
    connectionPool.inUseConnections.clear();
    connectionPool.usage = {
      totalConnections: 0,
      peakConnections: 0,
      totalAcquires: 0,
      acquireSuccesses: 0,
      acquireFailures: 0,
      acquireTimeTotal: 0,
      acquireTimeAvg: 0,
      connectionValidations: 0,
      connectionValidationFailures: 0,
      dynamicPoolAdjustments: 0,
      peakWaitingAcquires: 0
    };
  });

  afterEach(() => {
    // Restore original state
    connectionPool.clients = originalClients;
    connectionPool.inUse = originalInUse;
    connectionPool.waitingAcquires = originalWaitingAcquires;
    connectionPool.lastValidated = originalLastValidated;
    connectionPool.lastUsed = originalLastUsed;
    connectionPool.creationTimes = originalCreationTimes;
    connectionPool.inUseConnections = originalInUseConnections;
    connectionPool.usage = originalUsage;
  });

  describe('poolConfig', () => {
    it('should have valid default configuration values', () => {
      expect(poolConfig.minSize).toBeGreaterThanOrEqual(1);
      expect(poolConfig.maxSize).toBeGreaterThanOrEqual(poolConfig.minSize);
      expect(poolConfig.idleTimeout).toBeGreaterThan(0);
      expect(poolConfig.connectionTimeout).toBeGreaterThan(0);
      expect(poolConfig.acquireTimeout).toBeGreaterThan(0);
      expect(typeof poolConfig.enableDynamicSizing).toBe('boolean');
      expect(typeof poolConfig.enableConnectionValidation).toBe('boolean');
    });

    it('should have reasonable timeout values', () => {
      // Idle timeout should be reasonable (at least 1 second, at most 10 minutes)
      expect(poolConfig.idleTimeout).toBeGreaterThanOrEqual(1000);
      expect(poolConfig.idleTimeout).toBeLessThanOrEqual(600000);

      // Connection timeout should be reasonable
      expect(poolConfig.connectionTimeout).toBeGreaterThanOrEqual(1000);
      expect(poolConfig.connectionTimeout).toBeLessThanOrEqual(60000);

      // Acquire timeout should be reasonable
      expect(poolConfig.acquireTimeout).toBeGreaterThanOrEqual(1000);
      expect(poolConfig.acquireTimeout).toBeLessThanOrEqual(120000);
    });
  });

  describe('incrementWaitingAcquires', () => {
    it('should increment waiting acquires counter', () => {
      expect(connectionPool.waitingAcquires).toBe(0);

      incrementWaitingAcquires();
      expect(connectionPool.waitingAcquires).toBe(1);

      incrementWaitingAcquires();
      expect(connectionPool.waitingAcquires).toBe(2);
    });

    it('should update peak waiting acquires when exceeded', () => {
      expect(connectionPool.usage.peakWaitingAcquires).toBe(0);

      incrementWaitingAcquires();
      expect(connectionPool.usage.peakWaitingAcquires).toBe(1);

      incrementWaitingAcquires();
      expect(connectionPool.usage.peakWaitingAcquires).toBe(2);

      // Decrement and increment again - peak should not decrease
      decrementWaitingAcquires();
      incrementWaitingAcquires();
      expect(connectionPool.usage.peakWaitingAcquires).toBe(2);

      // Increment beyond previous peak
      incrementWaitingAcquires();
      expect(connectionPool.usage.peakWaitingAcquires).toBe(3);
    });
  });

  describe('decrementWaitingAcquires', () => {
    it('should decrement waiting acquires counter', () => {
      connectionPool.waitingAcquires = 3;

      decrementWaitingAcquires();
      expect(connectionPool.waitingAcquires).toBe(2);

      decrementWaitingAcquires();
      expect(connectionPool.waitingAcquires).toBe(1);
    });

    it('should not go below zero', () => {
      connectionPool.waitingAcquires = 0;

      decrementWaitingAcquires();
      expect(connectionPool.waitingAcquires).toBe(0);

      // Call multiple times to ensure it stays at 0
      decrementWaitingAcquires();
      decrementWaitingAcquires();
      expect(connectionPool.waitingAcquires).toBe(0);
    });
  });

  describe('getWaitingAcquires', () => {
    it('should return current waiting acquires count', () => {
      expect(getWaitingAcquires()).toBe(0);

      connectionPool.waitingAcquires = 5;
      expect(getWaitingAcquires()).toBe(5);
    });
  });

  describe('findLeastRecentlyUsedConnection', () => {
    it('should return null when no connections exist', () => {
      const result = findLeastRecentlyUsedConnection();
      expect(result).toBeNull();
    });

    it('should return null when there are connections in use', () => {
      const mockClient = new PrismaClient();
      connectionPool.clients.set('conn-1', mockClient);
      connectionPool.lastUsed.set('conn-1', Date.now() - 5000);
      // Mark this specific connection as in use (per-connection tracking)
      connectionPool.inUseConnections.set('conn-1', 1);

      const result = findLeastRecentlyUsedConnection();
      expect(result).toBeNull();
    });

    it('should return the oldest connection key when no connections in use', () => {
      const now = Date.now();
      const mockClient1 = new PrismaClient();
      const mockClient2 = new PrismaClient();
      const mockClient3 = new PrismaClient();

      connectionPool.clients.set('conn-1', mockClient1);
      connectionPool.clients.set('conn-2', mockClient2);
      connectionPool.clients.set('conn-3', mockClient3);

      connectionPool.lastUsed.set('conn-1', now - 3000); // 3 seconds ago
      connectionPool.lastUsed.set('conn-2', now - 5000); // 5 seconds ago (oldest)
      connectionPool.lastUsed.set('conn-3', now - 1000); // 1 second ago

      connectionPool.inUse = 0; // No connections in use

      const result = findLeastRecentlyUsedConnection();
      expect(result).toBe('conn-2');
    });
  });

  describe('getConnectionPoolStatus', () => {
    it('should return correct status when pool is empty', () => {
      const status = getConnectionPoolStatus();

      expect(status.size).toBe(0);
      expect(status.inUse).toBe(0);
      expect(status.maxSize).toBe(connectionPool.maxSize);
      expect(status.minSize).toBe(connectionPool.minSize);
      expect(status.available).toBe(connectionPool.maxSize);
      expect(status.utilization).toBe(0);
    });

    it('should return correct status with active connections', () => {
      const mockClient = new PrismaClient();
      connectionPool.clients.set('conn-1', mockClient);
      connectionPool.clients.set('conn-2', mockClient);
      connectionPool.inUse = 1;

      const status = getConnectionPoolStatus();

      expect(status.size).toBe(2);
      expect(status.inUse).toBe(1);
      expect(status.utilization).toBe(0.5); // 1 in use out of 2
    });

    it('should include configuration in status', () => {
      const status = getConnectionPoolStatus();

      expect(status.configuration).toBeDefined();
      expect(status.configuration.idleTimeout).toBe(poolConfig.idleTimeout);
      expect(status.configuration.connectionTimeout).toBe(poolConfig.connectionTimeout);
      expect(status.configuration.acquireTimeout).toBe(poolConfig.acquireTimeout);
      expect(status.configuration.enableDynamicSizing).toBe(poolConfig.enableDynamicSizing);
      expect(status.configuration.enableConnectionValidation).toBe(poolConfig.enableConnectionValidation);
    });

    it('should include metrics in status', () => {
      connectionPool.usage.totalConnections = 10;
      connectionPool.usage.peakConnections = 8;
      connectionPool.usage.totalAcquires = 100;
      connectionPool.usage.acquireSuccesses = 95;
      connectionPool.usage.acquireFailures = 5;
      connectionPool.usage.acquireTimeAvg = 50;
      connectionPool.usage.connectionValidations = 200;
      connectionPool.usage.connectionValidationFailures = 3;
      connectionPool.usage.dynamicPoolAdjustments = 2;

      const status = getConnectionPoolStatus();

      expect(status.metrics).toBeDefined();
      expect(status.metrics.totalConnections).toBe(10);
      expect(status.metrics.peakConnections).toBe(8);
      expect(status.metrics.totalAcquires).toBe(100);
      expect(status.metrics.acquireSuccesses).toBe(95);
      expect(status.metrics.acquireFailures).toBe(5);
      expect(status.metrics.acquireTimeAvg).toBe(50);
      expect(status.metrics.connectionValidations).toBe(200);
      expect(status.metrics.connectionValidationFailures).toBe(3);
      expect(status.metrics.dynamicPoolAdjustments).toBe(2);
    });
  });

  describe('getDetailedConnectionPoolInfo', () => {
    it('should return status and empty connections array when pool is empty', () => {
      const info = getDetailedConnectionPoolInfo();

      expect(info.status).toBeDefined();
      expect(info.connections).toEqual([]);
    });

    it('should return detailed connection information', () => {
      const now = Date.now();
      const mockClient = new PrismaClient();

      connectionPool.clients.set('conn-1', mockClient);
      connectionPool.creationTimes.set('conn-1', now - 10000); // Created 10 seconds ago
      connectionPool.lastUsed.set('conn-1', now - 5000); // Used 5 seconds ago
      connectionPool.lastValidated.set('conn-1', now - 2000); // Validated 2 seconds ago

      const info = getDetailedConnectionPoolInfo();

      expect(info.connections).toHaveLength(1);
      expect(info.connections[0].key).toBe('conn-1');
      // Allow some tolerance for timing (test execution time variance)
      expect(info.connections[0].ageMs).toBeGreaterThanOrEqual(9900);
      expect(info.connections[0].idleTimeMs).toBeGreaterThanOrEqual(4900);
      expect(info.connections[0].timeSinceValidationMs).toBeGreaterThanOrEqual(1900);
      expect(info.connections[0].inUse).toBe(false);
    });

    it('should sort connections by age (oldest first)', () => {
      const now = Date.now();
      const mockClient = new PrismaClient();

      // Add connections with different ages
      connectionPool.clients.set('conn-new', mockClient);
      connectionPool.clients.set('conn-old', mockClient);
      connectionPool.clients.set('conn-mid', mockClient);

      connectionPool.creationTimes.set('conn-new', now - 1000); // 1 second old
      connectionPool.creationTimes.set('conn-old', now - 10000); // 10 seconds old
      connectionPool.creationTimes.set('conn-mid', now - 5000); // 5 seconds old

      connectionPool.lastUsed.set('conn-new', now);
      connectionPool.lastUsed.set('conn-old', now);
      connectionPool.lastUsed.set('conn-mid', now);

      connectionPool.lastValidated.set('conn-new', now);
      connectionPool.lastValidated.set('conn-old', now);
      connectionPool.lastValidated.set('conn-mid', now);

      const info = getDetailedConnectionPoolInfo();

      expect(info.connections).toHaveLength(3);
      // Sorted by age descending (oldest first)
      expect(info.connections[0].key).toBe('conn-old');
      expect(info.connections[1].key).toBe('conn-mid');
      expect(info.connections[2].key).toBe('conn-new');
    });

    it('should use creation time as fallback for missing lastUsed and lastValidated', () => {
      const now = Date.now();
      const mockClient = new PrismaClient();

      connectionPool.clients.set('conn-1', mockClient);
      connectionPool.creationTimes.set('conn-1', now - 5000);
      // Don't set lastUsed or lastValidated

      const info = getDetailedConnectionPoolInfo();

      expect(info.connections).toHaveLength(1);
      // idleTimeMs and timeSinceValidationMs should be based on creation time
      // Allow some tolerance for test execution time variance
      expect(info.connections[0].idleTimeMs).toBeGreaterThanOrEqual(4900);
      expect(info.connections[0].timeSinceValidationMs).toBeGreaterThanOrEqual(4900);
    });
  });

  describe('connectionPool state', () => {
    it('should have correct initial state properties', () => {
      // These tests verify the structure exists
      expect(connectionPool.clients).toBeInstanceOf(Map);
      expect(connectionPool.lastValidated).toBeInstanceOf(Map);
      expect(connectionPool.lastUsed).toBeInstanceOf(Map);
      expect(connectionPool.creationTimes).toBeInstanceOf(Map);
      expect(typeof connectionPool.maxSize).toBe('number');
      expect(typeof connectionPool.minSize).toBe('number');
      expect(typeof connectionPool.inUse).toBe('number');
      expect(typeof connectionPool.waitingAcquires).toBe('number');
    });

    it('should have usage tracking properties', () => {
      expect(typeof connectionPool.usage.totalConnections).toBe('number');
      expect(typeof connectionPool.usage.peakConnections).toBe('number');
      expect(typeof connectionPool.usage.totalAcquires).toBe('number');
      expect(typeof connectionPool.usage.acquireSuccesses).toBe('number');
      expect(typeof connectionPool.usage.acquireFailures).toBe('number');
      expect(typeof connectionPool.usage.acquireTimeTotal).toBe('number');
      expect(typeof connectionPool.usage.acquireTimeAvg).toBe('number');
      expect(typeof connectionPool.usage.connectionValidations).toBe('number');
      expect(typeof connectionPool.usage.connectionValidationFailures).toBe('number');
      expect(typeof connectionPool.usage.dynamicPoolAdjustments).toBe('number');
      expect(typeof connectionPool.usage.peakWaitingAcquires).toBe('number');
    });
  });
});
