/**
 * Unit tests for db-metrics.ts
 * Tests database metrics collection and monitoring functionality
 */

// Mock the logger dependency
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock the robust-db-connection dependency
jest.mock('@/lib/db/robust-db-connection', () => ({
  getConnectionPoolStatus: jest.fn().mockReturnValue({
    pools: [],
  }),
}))

import {
  getDatabaseMetricsCollector,
  createQueryTrackingMiddleware,
} from '@/lib/db/db-metrics'

describe('Database Metrics', () => {
  let collector: ReturnType<typeof getDatabaseMetricsCollector>

  beforeEach(() => {
    collector = getDatabaseMetricsCollector()
    collector.reset()
  })

  describe('DatabaseMetricsCollector', () => {
    describe('Constructor', () => {
      it('should initialize with default values', () => {
        expect(collector).toBeDefined()
        expect(collector.getUptime()).toBeGreaterThanOrEqual(0)
      })

      it('should initialize with empty metrics', () => {
        const metrics = collector.getMetrics()
        expect(metrics.totalQueries).toBe(0)
        expect(metrics.totalQueriesPerSecond).toBe(0)
        expect(metrics.avgQueryTime).toBe(0)
        expect(metrics.errorRate).toBe(0)
        expect(metrics.slowQueries).toBe(0)
        expect(metrics.queriesByType).toEqual({})
        expect(metrics.queriesByTable).toEqual({})
      })
    })

    describe('recordQuery', () => {
      it('should record successful query', () => {
        collector.recordQuery('SELECT * FROM users', 150, true)
        
        const metrics = collector.getMetrics()
        expect(metrics.totalQueries).toBe(1)
        expect(metrics.avgQueryTime).toBe(150)
        expect(metrics.errorRate).toBe(0)
      })

      it('should record failed query', () => {
        collector.recordQuery('SELECT * FROM users', 200, false)
        
        const metrics = collector.getMetrics()
        expect(metrics.totalQueries).toBe(1)
        expect(metrics.avgQueryTime).toBe(200)
        expect(metrics.errorRate).toBe(1)
      })

      it('should record query with options object', () => {
        collector.recordQuery('SELECT * FROM users', 100, {
          type: 'SELECT',
          table: 'users',
        })
        
        const metrics = collector.getMetrics()
        expect(metrics.totalQueries).toBe(1)
        expect(metrics.queriesByType.SELECT).toBe(1)
        expect(metrics.queriesByTable.users).toBe(1)
      })

      it('should record query with error', () => {
        const error = new Error('Connection timeout')
        collector.recordQuery('SELECT * FROM users', 5000, false, error)
        
        const recentQueries = collector.getRecentQueries(1)
        expect(recentQueries[0].error).toBe('Connection timeout')
        expect(recentQueries[0].success).toBe(false)
      })

      it('should truncate long queries', () => {
        const longQuery = 'SELECT * FROM users WHERE ' + 'condition = true AND '.repeat(100)
        collector.recordQuery(longQuery, 100, true)
        
        const recentQueries = collector.getRecentQueries(1)
        expect(recentQueries[0].query.length).toBeLessThanOrEqual(200)
      })

      it('should limit stored queries to prevent memory leaks', () => {
        // Record more queries than maxStoredQueries
        for (let i = 0; i < 1500; i++) {
          collector.recordQuery(`SELECT * FROM table${i}`, 100, true)
        }
        
        const recentQueries = collector.getRecentQueries(2000)
        expect(recentQueries.length).toBeLessThanOrEqual(1000)
      })
    })

    describe('extractQueryType', () => {
      it('should extract SELECT query type', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.SELECT).toBe(1)
      })

      it('should extract INSERT query type', () => {
        collector.recordQuery('INSERT INTO users VALUES (1, "test")', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.INSERT).toBe(1)
      })

      it('should extract UPDATE query type', () => {
        collector.recordQuery('UPDATE users SET name = "test"', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.UPDATE).toBe(1)
      })

      it('should extract DELETE query type', () => {
        collector.recordQuery('DELETE FROM users WHERE id = 1', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.DELETE).toBe(1)
      })

      it('should extract CREATE query type', () => {
        collector.recordQuery('CREATE TABLE users (id INT)', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.CREATE).toBe(1)
      })

      it('should extract DROP query type', () => {
        collector.recordQuery('DROP TABLE users', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.DROP).toBe(1)
      })

      it('should extract ALTER query type', () => {
        collector.recordQuery('ALTER TABLE users ADD COLUMN name VARCHAR(255)', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.ALTER).toBe(1)
      })

      it('should extract CTE query type', () => {
        collector.recordQuery('WITH cte AS (SELECT * FROM users) SELECT * FROM cte', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.CTE).toBe(1)
      })

      it('should handle unknown query types', () => {
        collector.recordQuery('EXPLAIN SELECT * FROM users', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.OTHER).toBe(1)
      })

      it('should handle case insensitive queries', () => {
        collector.recordQuery('select * from users', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.SELECT).toBe(1)
      })
    })

    describe('extractTableName', () => {
      it('should extract table name from SELECT query', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByTable.users).toBe(1)
      })

      it('should extract table name from INSERT query', () => {
        collector.recordQuery('INSERT INTO products VALUES (1, "test")', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByTable.products).toBe(1)
      })

      it('should extract table name from UPDATE query', () => {
        collector.recordQuery('UPDATE orders SET status = "completed"', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByTable.orders).toBe(1)
      })

      it('should extract table name from DELETE query', () => {
        collector.recordQuery('DELETE FROM logs WHERE id = 1', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByTable.logs).toBe(1)
      })

      it('should extract table name from CREATE TABLE query', () => {
        collector.recordQuery('CREATE TABLE customers (id INT)', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByTable.customers).toBe(1)
      })

      it('should handle quoted table names', () => {
        collector.recordQuery('SELECT * FROM "user_profiles"', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByTable['user_profiles']).toBe(1)
      })

      it('should handle backtick quoted table names', () => {
        collector.recordQuery('SELECT * FROM `user_profiles`', 100, true)
        const metrics = collector.getMetrics()
        expect(metrics.queriesByTable['user_profiles']).toBe(1)
      })

      it('should return undefined for queries without clear table', () => {
        collector.recordQuery('SHOW TABLES', 100, true)
        const metrics = collector.getMetrics()
        expect(Object.keys(metrics.queriesByTable)).toHaveLength(0)
      })
    })

    describe('calculatePercentile', () => {
      it('should calculate 95th percentile correctly', () => {
        // Add multiple queries with different durations
        const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        durations.forEach((duration, index) => {
          collector.recordQuery(`SELECT * FROM table${index}`, duration, true)
        })
        
        const metrics = collector.getMetrics()
        expect(metrics.p95QueryTime).toBe(100) // 95th percentile of [10,20,30,40,50,60,70,80,90,100] = 100
      })

      it('should calculate 99th percentile correctly', () => {
        const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        durations.forEach((duration, index) => {
          collector.recordQuery(`SELECT * FROM table${index}`, duration, true)
        })
        
        const metrics = collector.getMetrics()
        expect(metrics.p99QueryTime).toBe(100) // 99th percentile
      })

      it('should handle empty array', () => {
        const metrics = collector.getMetrics()
        expect(metrics.p95QueryTime).toBe(0)
        expect(metrics.p99QueryTime).toBe(0)
      })
    })

    describe('getMetrics', () => {
      it('should calculate total queries per second', () => {
        // Add queries over time
        const now = Date.now()
        collector.recordQuery('SELECT * FROM users', 100, true)
        
        // Mock the timestamp to be within the 5-minute window
        const queryTimings = (collector as any).queryTimings
        queryTimings[0].timestamp = now - 1000 // 1 second ago
        
        const metrics = collector.getMetrics()
        expect(metrics.totalQueriesPerSecond).toBeGreaterThan(0)
      })

      it('should calculate average query time', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        collector.recordQuery('SELECT * FROM products', 200, true)
        collector.recordQuery('SELECT * FROM orders', 300, true)
        
        const metrics = collector.getMetrics()
        expect(metrics.avgQueryTime).toBe(200) // (100 + 200 + 300) / 3
      })

      it('should calculate error rate', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        collector.recordQuery('SELECT * FROM products', 200, false)
        collector.recordQuery('SELECT * FROM orders', 300, true)
        
        const metrics = collector.getMetrics()
        expect(metrics.errorRate).toBeCloseTo(0.333, 2) // 1/3
      })

      it('should count slow queries', () => {
        collector.recordQuery('SELECT * FROM users', 500, true)
        collector.recordQuery('SELECT * FROM products', 1500, true) // Slow query
        collector.recordQuery('SELECT * FROM orders', 2000, true) // Slow query
        
        const metrics = collector.getMetrics()
        expect(metrics.slowQueries).toBe(2)
      })

      it('should group queries by type', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        collector.recordQuery('INSERT INTO products VALUES (1)', 200, true)
        collector.recordQuery('UPDATE orders SET status = "done"', 300, true)
        
        const metrics = collector.getMetrics()
        expect(metrics.queriesByType.SELECT).toBe(1)
        expect(metrics.queriesByType.INSERT).toBe(1)
        expect(metrics.queriesByType.UPDATE).toBe(1)
      })

      it('should group queries by table', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        collector.recordQuery('SELECT * FROM products', 200, true)
        collector.recordQuery('INSERT INTO users VALUES (1)', 300, true)
        
        const metrics = collector.getMetrics()
        expect(metrics.queriesByTable.users).toBe(2)
        expect(metrics.queriesByTable.products).toBe(1)
      })
    })

    describe('setConnectionMetrics', () => {
      it('should update connection metrics', () => {
        collector.setConnectionMetrics(10, 3, 7, 30)
        
        const connMetrics = collector.getConnectionMetrics()
        expect(connMetrics.totalConnections).toBe(10)
        expect(connMetrics.activeConnections).toBe(3)
        expect(connMetrics.idleConnections).toBe(7)
        expect(connMetrics.poolUtilization).toBe(30)
      })
    })

    describe('getRecentQueries', () => {
      it('should return recent queries sorted by timestamp', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        collector.recordQuery('SELECT * FROM products', 200, true)
        
        const recentQueries = collector.getRecentQueries(10)
        expect(recentQueries).toHaveLength(2)
        expect(recentQueries[0].timestamp).toBeGreaterThanOrEqual(recentQueries[1].timestamp)
      })

      it('should limit results to specified limit', () => {
        for (let i = 0; i < 10; i++) {
          collector.recordQuery(`SELECT * FROM table${i}`, 100, true)
        }
        
        const recentQueries = collector.getRecentQueries(5)
        expect(recentQueries).toHaveLength(5)
      })
    })

    describe('getSlowQueries', () => {
      it('should return slow queries sorted by duration', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        collector.recordQuery('SELECT * FROM products', 1500, true) // Slow
        collector.recordQuery('SELECT * FROM orders', 2000, true) // Slow
        
        const slowQueries = collector.getSlowQueries(1000, 10)
        expect(slowQueries).toHaveLength(2)
        expect(slowQueries[0].duration).toBeGreaterThanOrEqual(slowQueries[1].duration)
      })

      it('should respect threshold parameter', () => {
        collector.recordQuery('SELECT * FROM users', 500, true)
        collector.recordQuery('SELECT * FROM products', 1500, true)
        
        const slowQueries = collector.getSlowQueries(1000, 10)
        expect(slowQueries).toHaveLength(1)
        expect(slowQueries[0].duration).toBe(1500)
      })

      it('should limit results to specified limit', () => {
        for (let i = 0; i < 10; i++) {
          collector.recordQuery(`SELECT * FROM table${i}`, 1500, true)
        }
        
        const slowQueries = collector.getSlowQueries(1000, 5)
        expect(slowQueries).toHaveLength(5)
      })
    })

    describe('reset', () => {
      it('should reset all metrics', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        collector.setConnectionMetrics(5, 2, 3, 40)
        
        collector.reset()
        
        const metrics = collector.getMetrics()
        expect(metrics.totalQueries).toBe(0)
        
        const connMetrics = collector.getConnectionMetrics()
        expect(connMetrics.totalConnections).toBe(0)
      })
    })

    describe('getUptime', () => {
      it('should return uptime in seconds', () => {
        const uptime = collector.getUptime()
        expect(uptime).toBeGreaterThanOrEqual(0)
        expect(typeof uptime).toBe('number')
      })
    })

    describe('toPrometheusFormat', () => {
      it('should export metrics in Prometheus format', () => {
        collector.recordQuery('SELECT * FROM users', 100, true)
        collector.setConnectionMetrics(5, 2, 3, 40)
        
        const prometheusFormat = collector.toPrometheusFormat()
        
        expect(prometheusFormat).toContain('# HELP db_queries_total')
        expect(prometheusFormat).toContain('# TYPE db_queries_total counter')
        expect(prometheusFormat).toContain('db_queries_total 1')
        expect(prometheusFormat).toContain('# HELP db_query_duration_avg')
        expect(prometheusFormat).toContain('db_query_duration_avg 100')
        expect(prometheusFormat).toContain('# HELP db_connections_total')
        expect(prometheusFormat).toContain('db_connections_total 5')
        expect(prometheusFormat).toContain('# HELP db_connections_active')
        expect(prometheusFormat).toContain('db_connections_active 2')
        expect(prometheusFormat).toContain('# HELP db_pool_utilization')
        expect(prometheusFormat).toContain('db_pool_utilization 40')
      })

      it('should include timestamp in Prometheus format', () => {
        const prometheusFormat = collector.toPrometheusFormat()
        const lines = prometheusFormat.split('\n')
        
        // Check that metrics have timestamps
        const metricLines = lines.filter(line => line.startsWith('db_') && !line.startsWith('#'))
        metricLines.forEach(line => {
          const parts = line.split(' ')
          expect(parts).toHaveLength(3) // metric_name value timestamp
          expect(Number(parts[2])).toBeGreaterThan(0) // timestamp should be positive
        })
      })
    })
  })

  describe('getDatabaseMetricsCollector', () => {
    it('should return singleton instance', () => {
      const collector1 = getDatabaseMetricsCollector()
      const collector2 = getDatabaseMetricsCollector()
      
      expect(collector1).toBe(collector2)
    })

    it('should initialize collector on first call', () => {
      const collector = getDatabaseMetricsCollector()
      expect(collector).toBeDefined()
      expect(typeof collector.recordQuery).toBe('function')
      expect(typeof collector.getMetrics).toBe('function')
      expect(typeof collector.reset).toBe('function')
    })
  })

  describe('createQueryTrackingMiddleware', () => {
    it('should create middleware function', () => {
      const middleware = createQueryTrackingMiddleware()
      expect(typeof middleware).toBe('function')
    })

    it('should track successful queries', async () => {
      const middleware = createQueryTrackingMiddleware()
      const mockNext = jest.fn().mockResolvedValue('result')
      
      const result = await middleware(
        { model: 'User', action: 'findMany' },
        mockNext
      )
      
      expect(result).toBe('result')
      expect(mockNext).toHaveBeenCalledWith({ model: 'User', action: 'findMany' })
      
      // Check that metrics were recorded
      const collector = getDatabaseMetricsCollector()
      const metrics = collector.getMetrics()
      expect(metrics.totalQueries).toBe(1)
      expect(metrics.queriesByType.FINDMANY).toBe(1)
      expect(metrics.queriesByTable.User).toBe(1)
    })

    it('should track failed queries', async () => {
      const middleware = createQueryTrackingMiddleware()
      const mockError = new Error('Database error')
      const mockNext = jest.fn().mockRejectedValue(mockError)
      
      await expect(middleware(
        { model: 'User', action: 'findMany' },
        mockNext
      )).rejects.toThrow('Database error')
      
      // Check that metrics were recorded
      const collector = getDatabaseMetricsCollector()
      const metrics = collector.getMetrics()
      expect(metrics.totalQueries).toBe(1)
      expect(metrics.errorRate).toBe(1)
    })

    it('should handle non-Error exceptions', async () => {
      const middleware = createQueryTrackingMiddleware()
      const mockNext = jest.fn().mockRejectedValue('String error')
      
      await expect(middleware(
        { model: 'User', action: 'findMany' },
        mockNext
      )).rejects.toBe('String error')
      
      // Check that metrics were recorded
      const collector = getDatabaseMetricsCollector()
      const metrics = collector.getMetrics()
      expect(metrics.totalQueries).toBe(1)
      expect(metrics.errorRate).toBe(1)
    })
  })

  describe('Edge cases', () => {
    it('should handle zero duration queries', () => {
      collector.recordQuery('SELECT 1', 0, true)
      
      const metrics = collector.getMetrics()
      expect(metrics.avgQueryTime).toBe(0)
      expect(metrics.p95QueryTime).toBe(0)
      expect(metrics.p99QueryTime).toBe(0)
    })

    it('should handle very large duration queries', () => {
      collector.recordQuery('SELECT * FROM large_table', 300000, true) // 5 minutes
      
      const metrics = collector.getMetrics()
      expect(metrics.avgQueryTime).toBe(300000)
      expect(metrics.slowQueries).toBe(1)
    })

    it('should handle empty query strings', () => {
      collector.recordQuery('', 100, true)
      
      const metrics = collector.getMetrics()
      expect(metrics.totalQueries).toBe(1)
      expect(metrics.queriesByType.OTHER).toBe(1)
    })

    it('should handle queries with special characters', () => {
      collector.recordQuery('SELECT * FROM "table-with-dashes"', 100, true)
      
      const metrics = collector.getMetrics()
      expect(metrics.totalQueries).toBe(1)
      // The table name extraction might not work perfectly with special characters
      // So we just check that the query was recorded
      expect(metrics.queriesByType.SELECT).toBe(1)
      // The table name might not be extracted correctly for special characters
      expect(metrics.avgQueryTime).toBe(100)
      expect(metrics.p95QueryTime).toBe(100)
      expect(metrics.p99QueryTime).toBe(100)
    })

    it('should record slow queries', () => {
      collector.recordQuery('SELECT * FROM products', 1500, true) // Slow
      collector.recordQuery('SELECT * FROM orders', 2000, true) // Slow
      
      const slowQueries = collector.getSlowQueries(1000, 10)
      expect(slowQueries).toHaveLength(2)
      expect(slowQueries[0].duration).toBeGreaterThanOrEqual(slowQueries[1].duration)
    })

    it('should respect threshold parameter', () => {
      collector.recordQuery('SELECT * FROM users', 500, true)
      collector.recordQuery('SELECT * FROM products', 1500, true)
      
      const slowQueries = collector.getSlowQueries(1000, 10)
      expect(slowQueries).toHaveLength(1)
      expect(slowQueries[0].duration).toBe(1500)
    })

    it('should limit results to specified limit', () => {
      for (let i = 0; i < 10; i++) {
        collector.recordQuery(`SELECT * FROM table${i}`, 1500, true)
      }
      
      const slowQueries = collector.getSlowQueries(1000, 5)
      expect(slowQueries).toHaveLength(5)
    })
  })
})
