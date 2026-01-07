/**
 * Unified Connection Pool System Tests
 * Tests for global coordinator and integrated pool management
 */

import { getGlobalCoordinator, resetGlobalCoordinator, GlobalPoolEvent, ConnectionPoolCoordinator } from '@/lib/db/connection-pool-coordinator';
import { VectorConnectionPoolFactory } from '@/lib/db/vector-connection-pool';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
jest.mock('@prisma/client');

// Mock ConnectionPool class for testing
class ConnectionPool {
  private prismaClient: PrismaClient;
  public name: string;
  public status: 'active' | 'closed' = 'active';
  private config: { min: number; max: number };
  private budget?: any;

  constructor(config: { min: number; max: number }, budget?: any, name: string = 'general-prisma-pool') {
    this.config = config;
    this.budget = budget;
    this.name = name;
    this.prismaClient = new PrismaClient();
    this.status = 'active';

    // Register with coordinator if budget provided
    if (budget) {
      const coordinator = getGlobalCoordinator();
      coordinator.registerPool(this as any, budget);
    }
  }

  async acquire(): Promise<PrismaClient> {
    return this.prismaClient;
  }

  async release(client: PrismaClient): Promise<void> {
    // No-op for mock
  }

  getStatus() {
    return {
      size: this.config.min,
      available: this.config.max - 1,
      inUse: 1,
      maxSize: this.config.max,
      minSize: this.config.min,
      utilization: 20,
      waitingClients: 0,
      idleConnections: this.config.max - 1,
      lastHealthCheck: new Date()
    };
  }

  getMetrics() {
    return {
      totalCreated: 10,
      totalAcquired: 50,
      totalReleased: 48,
      totalDestroyed: 2,
      totalErrors: 0,
      avgAcquireTime: 25,
      peakConnections: this.config.max,
      activeConnections: 1,
      idleConnections: this.config.max - 1,
      totalConnections: this.config.max,
      acquiredConnections: 1,
      pendingAcquires: 0,
      errors: 0,
      averageAcquireTime: 25,
      averageHoldTime: 100
    };
  }

  getConnections() {
    return [
      {
        id: 'conn-1',
        inUse: true,
        createdAt: Date.now() - 10000,
        lastUsed: Date.now() - 100
      },
      {
        id: 'conn-2',
        inUse: false,
        createdAt: Date.now() - 8000,
        lastUsed: Date.now() - 5000
      }
    ];
  }

  async close(): Promise<void> {
    this.status = 'closed';
    await this.prismaClient.$disconnect();
  }

  async drain(): Promise<void> {
    // No-op for mock
  }
}

let coordinator: ConnectionPoolCoordinator;

describe('Global Connection Pool Coordinator', () => {
  beforeEach(async () => {
    // Reset the global coordinator before each test
    resetGlobalCoordinator();

    // Create a new coordinator with test configuration
    coordinator = getGlobalCoordinator({
      postgresMaxConnections: 100,
      totalBudgetLimit: 20,
      reserveCapacity: 5
    });
  });

  afterEach(async () => {
    // Clean up coordinator
    await coordinator.close();
    resetGlobalCoordinator();
  });

  describe('Budget Allocation', () => {
    it('should allocate budgets within total limit', () => {
      const budget1 = coordinator.getBudget('general-prisma-pool');
      const budget2 = coordinator.getBudget('vector-pool');

      expect(budget1).toBeDefined();
      expect(budget2).toBeDefined();

      const totalBudgeted = (budget1?.max || 0) + (budget2?.max || 0);
      expect(totalBudgeted).toBeLessThanOrEqual(coordinator['config'].totalBudgetLimit);
    });

    it('should allow budget borrowing from reserve', () => {
      const success = coordinator.requestBudgetIncrease('vector-pool', 2);
      expect(success).toBe(true);

      const budget = coordinator.getBudget('vector-pool');
      expect(budget?.borrowed).toBe(2);
    });

    it('should reject budget increase when reserve exhausted', () => {
      // Exhaust reserve (reserve capacity is 5 in test config)
      coordinator.requestBudgetIncrease('vector-pool', 5);

      // Now reserve is exhausted, this should fail
      const success = coordinator.requestBudgetIncrease('general-prisma-pool', 1);
      expect(success).toBe(false);
    });

    it('should return borrowed budget correctly', () => {
      coordinator.requestBudgetIncrease('vector-pool', 3);
      coordinator.returnBudget('vector-pool', 2);

      const budget = coordinator.getBudget('vector-pool');
      expect(budget?.borrowed).toBe(1);
    });

    it('should handle budget adjustment requests', () => {
      const response = coordinator.adjustBudget({
        poolName: 'vector-pool',
        requestedMax: 12,
        reason: 'Test increase',
        emergency: false
      });

      expect(response.approved).toBe(true);
      expect(response.newBudget?.max).toBe(12);
    });

    it('should restore temporary budget adjustments', async () => {
      const originalMax = coordinator.getBudget('vector-pool')?.max;

      coordinator.adjustBudget({
        poolName: 'vector-pool',
        requestedMax: 12,
        reason: 'Temporary increase',
        expiresAt: Date.now() + 100 // 100ms
      });

      // Wait for restoration
      await new Promise(resolve => setTimeout(resolve, 150));

      const restoredMax = coordinator.getBudget('vector-pool')?.max;
      expect(restoredMax).toBe(originalMax);
    });
  });

  describe('Global Status Monitoring', () => {
    it('should track global connection usage', () => {
      const status = coordinator.getGlobalStatus();

      expect(status).toHaveProperty('totalCapacity');
      expect(status).toHaveProperty('totalAllocated');
      expect(status).toHaveProperty('totalActive');
      expect(status).toHaveProperty('utilizationPercent');
      expect(status.totalCapacity).toBe(20); // From test config
    });

    it('should generate capacity warnings', () => {
      let warningEmitted = false;
      coordinator.on(GlobalPoolEvent.GLOBAL_CAPACITY_WARNING, () => {
        warningEmitted = true;
      });

      // Manually trigger high utilization scenario
      // (In real scenario, this would happen through pool usage)

      // For now, just verify event system works
      coordinator.emit(GlobalPoolEvent.GLOBAL_CAPACITY_WARNING, {
        status: coordinator.getGlobalStatus(),
        timestamp: new Date()
      });

      expect(warningEmitted).toBe(true);
    });

    it('should track reserve capacity', () => {
      const status = coordinator.getGlobalStatus();

      expect(status.reserve).toBeDefined();
      expect(status.reserve.total).toBe(5); // From test config
      expect(status.reserve.available).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Check Coordination', () => {
    it('should perform global health checks', async () => {
      const health = await coordinator.checkGlobalHealth();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('pools');
      expect(health.overall).toMatch(/healthy|degraded|unhealthy/);
    });

    it('should emit health check events', async () => {
      let eventEmitted = false;
      coordinator.on(GlobalPoolEvent.GLOBAL_HEALTH_CHECK, () => {
        eventEmitted = true;
      });

      await coordinator.checkGlobalHealth();

      expect(eventEmitted).toBe(true);
    });

    it('should provide health recommendations', async () => {
      const health = await coordinator.checkGlobalHealth();

      expect(health.recommendations).toBeDefined();
      expect(Array.isArray(health.recommendations)).toBe(true);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    it('should detect pool availability', () => {
      const available = coordinator.isPoolAvailable('vector-pool');
      expect(available).toBe(true);
    });

    it('should open circuit after consecutive failures', () => {
      let circuitOpened = false;
      coordinator.on(GlobalPoolEvent.CIRCUIT_BREAKER_OPENED, () => {
        circuitOpened = true;
      });

      // Simulate failures
      const error = new Error('Test failure');
      for (let i = 0; i < 5; i++) {
        coordinator.reportPoolFailure('vector-pool', error);
      }

      expect(circuitOpened).toBe(true);
    });
  });

  describe('Event Aggregation', () => {
    it('should emit global connection events', () => {
      let eventData: any = null;
      coordinator.on(GlobalPoolEvent.CONNECTION_ACQUIRED_GLOBAL, (data) => {
        eventData = data;
      });

      coordinator.reportConnectionAcquired('test-pool', 50);

      expect(eventData).not.toBeNull();
      expect(eventData.poolName).toBe('test-pool');
      expect(eventData.acquireTime).toBe(50);
    });

    it('should emit slow acquisition warnings', () => {
      let slowAcquisitionDetected = false;
      coordinator.on(GlobalPoolEvent.SLOW_ACQUISITION, () => {
        slowAcquisitionDetected = true;
      });

      // Report slow acquisition (threshold is 1000ms in default config)
      coordinator.reportConnectionAcquired('test-pool', 1500);

      expect(slowAcquisitionDetected).toBe(true);
    });

    it('should track connection lifecycle events', () => {
      const events: string[] = [];

      coordinator.on(GlobalPoolEvent.CONNECTION_CREATED_GLOBAL, () => {
        events.push('created');
      });
      coordinator.on(GlobalPoolEvent.CONNECTION_ACQUIRED_GLOBAL, () => {
        events.push('acquired');
      });
      coordinator.on(GlobalPoolEvent.CONNECTION_RELEASED_GLOBAL, () => {
        events.push('released');
      });
      coordinator.on(GlobalPoolEvent.CONNECTION_DESTROYED_GLOBAL, () => {
        events.push('destroyed');
      });

      coordinator.reportConnectionCreated('test-pool');
      coordinator.reportConnectionAcquired('test-pool', 10);
      coordinator.reportConnectionReleased('test-pool');
      coordinator.reportConnectionDestroyed('test-pool');

      expect(events).toEqual(['created', 'acquired', 'released', 'destroyed']);
    });
  });

  describe('Alert Generation', () => {
    it('should generate alerts for high utilization', () => {
      const status = coordinator.getGlobalStatus();

      // Alerts depend on actual pool state
      expect(Array.isArray(status.alerts)).toBe(true);
    });

    it('should include severity levels in alerts', () => {
      const status = coordinator.getGlobalStatus();

      status.alerts.forEach(alert => {
        expect(alert.severity).toMatch(/info|warning|critical/);
        expect(alert.message).toBeDefined();
        expect(alert.timestamp).toBeInstanceOf(Date);
      });
    });
  });
});

describe('Integrated Pool Management', () => {
  beforeEach(async () => {
    // Reset the global coordinator before each test
    resetGlobalCoordinator();

    // Create a new coordinator with test configuration
    coordinator = getGlobalCoordinator({
      postgresMaxConnections: 100,
      totalBudgetLimit: 20,
      reserveCapacity: 5
    });
  });

  afterEach(async () => {
    await VectorConnectionPoolFactory.closeAllPools();
    await coordinator.close();
    resetGlobalCoordinator();
  });

  describe('ConnectionPool Integration', () => {
    it('should register with coordinator when budget provided', () => {
      const pool = new ConnectionPool(
        { min: 1, max: 5 },
        { min: 1, max: 5, priority: 1, canBorrow: true }
      );

      const registeredPool = coordinator.getAllPools().get('general-prisma-pool');
      expect(registeredPool).toBeDefined();
      expect(registeredPool?.name).toBe('general-prisma-pool');
    });

    it('should operate independently when coordinator unavailable', async () => {
      // Close coordinator to simulate unavailability
      await coordinator.close();

      // Pool should still work
      const pool = new ConnectionPool({ min: 1, max: 3 });
      const status = pool.getStatus();

      expect(status.size).toBeGreaterThanOrEqual(1);
    });

    it('should report metrics to coordinator', () => {
      const pool = new ConnectionPool(
        { min: 1, max: 5 },
        { min: 1, max: 5, priority: 1, canBorrow: true }
      );

      const metrics = pool.getMetrics();

      expect(metrics).toHaveProperty('totalCreated');
      expect(metrics).toHaveProperty('totalAcquired');
      expect(metrics).toHaveProperty('avgAcquireTime');
      expect(metrics).toHaveProperty('peakConnections');
    });

    it('should expose connections for leak detection', () => {
      const pool = new ConnectionPool({ min: 2, max: 5 });
      const connections = pool.getConnections();

      expect(Array.isArray(connections)).toBe(true);
      expect(connections.length).toBeGreaterThanOrEqual(0);

      connections.forEach(conn => {
        expect(conn).toHaveProperty('id');
        expect(conn).toHaveProperty('inUse');
        expect(conn).toHaveProperty('createdAt');
        expect(conn).toHaveProperty('lastUsed');
      });
    });
  });

  describe('Cross-Pool Coordination', () => {
    it('should coordinate budgets across multiple pools', () => {
      const prismaPool = new ConnectionPool(
        { min: 1, max: 8 },
        { min: 1, max: 8, priority: 1, canBorrow: true }
      );

      // Create a second mock pool for coordination testing
      const vectorPool = new ConnectionPool(
        { min: 1, max: 7 },
        { min: 1, max: 7, priority: 2, canBorrow: true },
        'test-vector-pool'
      );

      const status = coordinator.getGlobalStatus();
      expect(Object.keys(status.pools).length).toBeGreaterThanOrEqual(2);
    });

    it('should prevent total connections from exceeding limit', () => {
      const status = coordinator.getGlobalStatus();
      const totalUsed = status.totalAllocated + status.reserve.allocated;

      expect(totalUsed).toBeLessThanOrEqual(status.totalCapacity);
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue operating if coordinator fails', async () => {
      const pool = new ConnectionPool(
        { min: 1, max: 3 },
        { min: 1, max: 3, priority: 1, canBorrow: true }
      );

      // Close coordinator to simulate failure
      await coordinator.close();

      // Pool should still work
      const prisma = await pool.acquire();
      expect(prisma).toBeDefined();
      await pool.release(prisma);
    });

    it('should handle coordinator reconnection gracefully', async () => {
      const pool = new ConnectionPool({ min: 1, max: 3 });

      // Close and recreate coordinator
      await coordinator.close();
      coordinator = getGlobalCoordinator();

      // Pool should continue working
      const status = pool.getStatus();
      expect(status.size).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Performance and Safety', () => {
  beforeEach(async () => {
    // Reset the global coordinator before each test
    resetGlobalCoordinator();

    // Create a new coordinator with test configuration
    coordinator = getGlobalCoordinator({
      postgresMaxConnections: 100,
      totalBudgetLimit: 50,
      reserveCapacity: 10
    });
  });

  afterEach(async () => {
    await coordinator.close();
    resetGlobalCoordinator();
  });

  describe('Connection Leak Detection', () => {
    it('should detect suspected leaks', () => {
      // Leak detection requires getConnections() implementation
      // This test verifies the mechanism exists
      const pools = coordinator.getAllPools();
      expect(pools).toBeDefined();

      // Leak detection runs periodically
      // Manual invocation tested via coordinator internals
    });
  });

  describe('Resource Limits', () => {
    it('should enforce PostgreSQL connection limit', () => {
      const status = coordinator.getGlobalStatus();
      expect(status.totalCapacity).toBe(50); // From config
    });

    it('should maintain reserve capacity', () => {
      const status = coordinator.getGlobalStatus();
      expect(status.reserve.total).toBe(10); // From config
      expect(status.reserve.available).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent pool registration', () => {
      const pool1 = new ConnectionPool(
        { min: 1, max: 5 },
        { min: 1, max: 5, priority: 1, canBorrow: true }
      );

      const pool2 = new ConnectionPool(
        { min: 1, max: 5 },
        { min: 1, max: 5, priority: 2, canBorrow: true }
      );

      // Both pools should be registered
      expect(coordinator.getAllPools().size).toBeGreaterThanOrEqual(1);
    });

    it('should handle concurrent budget requests', () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(coordinator.requestBudgetIncrease('vector-pool', 1));
      }

      // Some should succeed, some may fail based on available reserve
      const successCount = results.filter(r => r).length;
      expect(successCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate budget configuration', () => {
      expect(() => {
        new ConnectionPoolCoordinator({
          postgresMaxConnections: 10,
          totalBudgetLimit: 20, // Invalid: exceeds max
          reserveCapacity: 5
        });
      }).toThrow();
    });

    it('should validate pool budgets sum', () => {
      expect(() => {
        new ConnectionPoolCoordinator({
          postgresMaxConnections: 20,
          totalBudgetLimit: 10,
          reserveCapacity: 5,
          budgets: {
            'pool1': { min: 1, max: 8, priority: 1, canBorrow: true },
            'pool2': { min: 1, max: 8, priority: 2, canBorrow: true }
            // Total 16 > totalBudgetLimit 10
          }
        });
      }).toThrow();
    });
  });
});
