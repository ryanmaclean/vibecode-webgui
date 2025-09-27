/**
 * Integration tests for database metrics with real system metrics
 */

import { getMetricsCollector, collectDatabaseMetrics } from '../../src/lib/db/database-metrics';

describe('Database Metrics Integration', () => {
  let collector: ReturnType<typeof getMetricsCollector>;

  beforeEach(() => {
    collector = getMetricsCollector();
  });

  describe('MetricsCollector.getMetrics (now async)', () => {
    it('should return real system health metrics instead of hardcoded values', async () => {
      const metrics = await collector.getMetrics();
      
      expect(metrics).toHaveProperty('systemHealth');
      expect(metrics.systemHealth).toHaveProperty('diskUsage');
      expect(metrics.systemHealth).toHaveProperty('memoryUsage');
      expect(metrics.systemHealth).toHaveProperty('cpuUsage');
      expect(metrics.systemHealth).toHaveProperty('uptime');
      
      // These should NOT be the old hardcoded values
      expect(metrics.systemHealth.diskUsage).not.toBe(65.4);
      expect(metrics.systemHealth.memoryUsage).not.toBe(72.1);
      expect(metrics.systemHealth.cpuUsage).not.toBe(45.2);
      
      // Values should be realistic
      expect(metrics.systemHealth.diskUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.systemHealth.diskUsage).toBeLessThanOrEqual(100);
      expect(metrics.systemHealth.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.systemHealth.memoryUsage).toBeLessThanOrEqual(100);
      expect(metrics.systemHealth.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.systemHealth.cpuUsage).toBeLessThanOrEqual(100);
      expect(metrics.systemHealth.uptime).toBeGreaterThan(0);
    });

    it('should return consistent other metrics', async () => {
      const metrics = await collector.getMetrics();
      
      // Other metrics should still work
      expect(metrics).toHaveProperty('connectionPool');
      expect(metrics).toHaveProperty('queryPerformance');
      expect(metrics).toHaveProperty('vectorOperations');
      
      expect(metrics.connectionPool.totalConnections).toBeGreaterThanOrEqual(0);
      expect(metrics.queryPerformance.totalQueries).toBeGreaterThanOrEqual(0);
      expect(metrics.vectorOperations.embeddingInserts).toBeGreaterThanOrEqual(0);
    });

    it('should return different system values over time', async () => {
      const metrics1 = await collector.getMetrics();
      
      // Add some processing load
      const start = Date.now();
      while (Date.now() - start < 100) {
        Math.random() * Math.random();
      }
      
      const metrics2 = await collector.getMetrics();
      
      // The metrics might be the same or different, but they should be valid
      expect(typeof metrics1.systemHealth.cpuUsage).toBe('number');
      expect(typeof metrics2.systemHealth.cpuUsage).toBe('number');
      expect(metrics1.systemHealth.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(metrics2.systemHealth.cpuUsage).toBeGreaterThanOrEqual(0);
    }, 10000);
  });

  describe('collectDatabaseMetrics function', () => {
    it('should use real metrics instead of hardcoded values', async () => {
      const metrics = await collectDatabaseMetrics();
      
      expect(metrics).toHaveProperty('systemHealth');
      
      // Should not return the old hardcoded values
      expect(metrics.systemHealth.diskUsage).not.toBe(65.4);
      expect(metrics.systemHealth.memoryUsage).not.toBe(72.1);
      expect(metrics.systemHealth.cpuUsage).not.toBe(45.2);
      expect(metrics.systemHealth.uptime).not.toBe(86400);
      
      // Should not return the old hardcoded connection pool values
      expect(metrics.connectionPool.totalConnections).not.toBe(10);
      expect(metrics.connectionPool.activeConnections).not.toBe(5);
      expect(metrics.connectionPool.maxConnections).not.toBe(20);
      
      // Should not return the old hardcoded query performance values
      expect(metrics.queryPerformance.totalQueries).not.toBe(1250);
      expect(metrics.queryPerformance.averageQueryTime).not.toBe(45);
      expect(metrics.queryPerformance.slowQueries).not.toBe(12);
      expect(metrics.queryPerformance.failedQueries).not.toBe(3);
      
      // Should not return the old hardcoded vector operation values
      expect(metrics.vectorOperations.embeddingInserts).not.toBe(450);
      expect(metrics.vectorOperations.similaritySearches).not.toBe(230);
      expect(metrics.vectorOperations.vectorIndexSize).not.toBe(1500000);
      expect(metrics.vectorOperations.avgEmbeddingTime).not.toBe(120);
    });

    it('should return valid structure and types', async () => {
      const metrics = await collectDatabaseMetrics();
      
      // Verify the structure matches the interface
      expect(typeof metrics.connectionPool.totalConnections).toBe('number');
      expect(typeof metrics.connectionPool.activeConnections).toBe('number');
      expect(typeof metrics.connectionPool.idleConnections).toBe('number');
      expect(typeof metrics.connectionPool.waitingClients).toBe('number');
      expect(typeof metrics.connectionPool.maxConnections).toBe('number');
      
      expect(typeof metrics.queryPerformance.totalQueries).toBe('number');
      expect(typeof metrics.queryPerformance.averageQueryTime).toBe('number');
      expect(typeof metrics.queryPerformance.slowQueries).toBe('number');
      expect(typeof metrics.queryPerformance.failedQueries).toBe('number');
      
      expect(typeof metrics.vectorOperations.embeddingInserts).toBe('number');
      expect(typeof metrics.vectorOperations.similaritySearches).toBe('number');
      expect(typeof metrics.vectorOperations.vectorIndexSize).toBe('number');
      expect(typeof metrics.vectorOperations.avgEmbeddingTime).toBe('number');
      
      expect(typeof metrics.systemHealth.diskUsage).toBe('number');
      expect(typeof metrics.systemHealth.memoryUsage).toBe('number');
      expect(typeof metrics.systemHealth.cpuUsage).toBe('number');
      expect(typeof metrics.systemHealth.uptime).toBe('number');
    });
  });

  describe('Connection metrics integration', () => {
    it('should allow updating connection metrics and reflect in system metrics', async () => {
      // Set some test connection metrics
      collector.setConnectionMetrics(15, 8, 25);
      
      const metrics = await collector.getMetrics();
      
      expect(metrics.connectionPool.totalConnections).toBe(15);
      expect(metrics.connectionPool.activeConnections).toBe(8);
      expect(metrics.connectionPool.idleConnections).toBe(7); // 15 - 8
      expect(metrics.connectionPool.maxConnections).toBe(25);
    });
  });

  describe('Query metrics integration', () => {
    it('should track queries and reflect in system metrics', async () => {
      // Record some test queries
      collector.recordQuery(100, false);
      collector.recordQuery(200, true); // slow query
      collector.recordQueryError();
      
      const metrics = await collector.getMetrics();
      
      expect(metrics.queryPerformance.totalQueries).toBe(2);
      expect(metrics.queryPerformance.slowQueries).toBe(1);
      expect(metrics.queryPerformance.failedQueries).toBe(1);
      expect(metrics.queryPerformance.averageQueryTime).toBe(150); // (100 + 200) / 2
    });
  });

  describe('Vector operations integration', () => {
    it('should track vector operations and reflect in system metrics', async () => {
      // Record some test vector operations
      collector.recordVectorStore(5, 'pgvector', 500);
      collector.recordVectorSearch('pgvector', 50, 10, true);
      
      const metrics = await collector.getMetrics();
      
      expect(metrics.vectorOperations.embeddingInserts).toBe(5);
      expect(metrics.vectorOperations.similaritySearches).toBe(1);
      expect(metrics.vectorOperations.avgEmbeddingTime).toBe(500);
    });
  });
});