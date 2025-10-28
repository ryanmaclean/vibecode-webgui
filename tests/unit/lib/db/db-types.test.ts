/**
 * Unit tests for db-types.ts
 * Tests database type definitions and interfaces
 */

import {
  LogLevel,
  LogCategory,
  DbLogger,
  LogOptions,
  DbOperationTimer,
  LoggerOptions,
  DatabaseConnectionOptions,
  ConnectionResult,
  ConnectionPoolStatus,
  DetailedConnectionPoolInfo,
  HealthCheckOptions,
  HealthCheckResult,
} from '@/lib/db/db-types'

describe('Database Types', () => {
  describe('LogLevel enum', () => {
    it('should have correct log levels', () => {
      expect(LogLevel.ERROR).toBe('error')
      expect(LogLevel.WARN).toBe('warn')
      expect(LogLevel.INFO).toBe('info')
      expect(LogLevel.DEBUG).toBe('debug')
      expect(LogLevel.TRACE).toBe('trace')
    })

    it('should have all expected log levels', () => {
      const levels = Object.values(LogLevel)
      expect(levels).toHaveLength(5)
      expect(levels).toContain('error')
      expect(levels).toContain('warn')
      expect(levels).toContain('info')
      expect(levels).toContain('debug')
      expect(levels).toContain('trace')
    })
  })

  describe('LogCategory enum', () => {
    it('should have correct log categories', () => {
      expect(LogCategory.QUERY).toBe('query')
      expect(LogCategory.CONNECTION).toBe('connection')
      expect(LogCategory.TRANSACTION).toBe('transaction')
      expect(LogCategory.MIGRATION).toBe('migration')
      expect(LogCategory.INITIALIZATION).toBe('initialization')
      expect(LogCategory.VECTOR).toBe('vector')
      expect(LogCategory.EMBEDDING).toBe('embedding')
      expect(LogCategory.HEALTH).toBe('health')
    })

    it('should have all expected log categories', () => {
      const categories = Object.values(LogCategory)
      expect(categories).toHaveLength(8)
      expect(categories).toContain('query')
      expect(categories).toContain('connection')
      expect(categories).toContain('transaction')
      expect(categories).toContain('migration')
      expect(categories).toContain('initialization')
      expect(categories).toContain('vector')
      expect(categories).toContain('embedding')
      expect(categories).toContain('health')
    })
  })

  describe('LogOptions interface', () => {
    it('should allow all optional properties', () => {
      const logOptions: LogOptions = {
        level: LogLevel.INFO,
        category: LogCategory.QUERY,
        elapsed: 150,
        operation: 'SELECT',
        sql: 'SELECT * FROM users',
        params: { id: 1 },
        metadata: { userId: 123 },
        error: new Error('Test error'),
        timestamp: new Date(),
      }

      expect(logOptions.level).toBe(LogLevel.INFO)
      expect(logOptions.category).toBe(LogCategory.QUERY)
      expect(logOptions.elapsed).toBe(150)
      expect(logOptions.operation).toBe('SELECT')
      expect(logOptions.sql).toBe('SELECT * FROM users')
      expect(logOptions.params).toEqual({ id: 1 })
      expect(logOptions.metadata).toEqual({ userId: 123 })
      expect(logOptions.error).toBeInstanceOf(Error)
      expect(logOptions.timestamp).toBeInstanceOf(Date)
    })

    it('should allow empty object', () => {
      const logOptions: LogOptions = {}
      expect(logOptions).toBeDefined()
    })
  })

  describe('DbOperationTimer interface', () => {
    it('should define timer methods', () => {
      // Mock implementation for testing interface compliance
      const mockTimer: DbOperationTimer = {
        start: jest.fn(),
        end: jest.fn().mockReturnValue(100),
        elapsed: jest.fn().mockReturnValue(50),
      }

      expect(typeof mockTimer.start).toBe('function')
      expect(typeof mockTimer.end).toBe('function')
      expect(typeof mockTimer.elapsed).toBe('function')

      mockTimer.start()
      expect(mockTimer.start).toHaveBeenCalled()

      const endResult = mockTimer.end('Test operation')
      expect(endResult).toBe(100)
      expect(mockTimer.end).toHaveBeenCalledWith('Test operation')

      const elapsedResult = mockTimer.elapsed()
      expect(elapsedResult).toBe(50)
    })
  })

  describe('LoggerOptions interface', () => {
    it('should allow all optional properties', () => {
      const loggerOptions: LoggerOptions = {
        logLevel: LogLevel.DEBUG,
        defaultCategory: LogCategory.CONNECTION,
        logToConsole: true,
        logToFile: false,
        logToMetrics: true,
        logFilePath: '/var/log/db.log',
        serviceName: 'test-service',
        environment: 'test',
      }

      expect(loggerOptions.logLevel).toBe(LogLevel.DEBUG)
      expect(loggerOptions.defaultCategory).toBe(LogCategory.CONNECTION)
      expect(loggerOptions.logToConsole).toBe(true)
      expect(loggerOptions.logToFile).toBe(false)
      expect(loggerOptions.logToMetrics).toBe(true)
      expect(loggerOptions.logFilePath).toBe('/var/log/db.log')
      expect(loggerOptions.serviceName).toBe('test-service')
      expect(loggerOptions.environment).toBe('test')
    })

    it('should allow empty object', () => {
      const loggerOptions: LoggerOptions = {}
      expect(loggerOptions).toBeDefined()
    })
  })

  describe('DatabaseConnectionOptions interface', () => {
    it('should allow all optional properties', () => {
      const connectionOptions: DatabaseConnectionOptions = {
        connectionUrl: 'postgresql://localhost:5432/test',
        maxRetries: 3,
        retryDelay: 1000,
        debug: true,
        poolKey: 'test-pool',
        enableLogging: true,
        poolMinSize: 2,
        poolMaxSize: 10,
        idleTimeout: 30000,
        connectionTimeout: 5000,
        acquireTimeout: 10000,
        enableDynamicSizing: true,
        enableConnectionValidation: true,
      }

      expect(connectionOptions.connectionUrl).toBe('postgresql://localhost:5432/test')
      expect(connectionOptions.maxRetries).toBe(3)
      expect(connectionOptions.retryDelay).toBe(1000)
      expect(connectionOptions.debug).toBe(true)
      expect(connectionOptions.poolKey).toBe('test-pool')
      expect(connectionOptions.enableLogging).toBe(true)
      expect(connectionOptions.poolMinSize).toBe(2)
      expect(connectionOptions.poolMaxSize).toBe(10)
      expect(connectionOptions.idleTimeout).toBe(30000)
      expect(connectionOptions.connectionTimeout).toBe(5000)
      expect(connectionOptions.acquireTimeout).toBe(10000)
      expect(connectionOptions.enableDynamicSizing).toBe(true)
      expect(connectionOptions.enableConnectionValidation).toBe(true)
    })

    it('should allow empty object', () => {
      const connectionOptions: DatabaseConnectionOptions = {}
      expect(connectionOptions).toBeDefined()
    })
  })

  describe('ConnectionResult interface', () => {
    it('should allow all properties', () => {
      const mockPrisma = {} as any
      const mockRelease = jest.fn().mockReturnValue(true)
      const mockError = new Error('Connection failed')

      const connectionResult: ConnectionResult = {
        prisma: mockPrisma,
        success: true,
        fromPool: true,
        release: mockRelease,
        error: mockError,
      }

      expect(connectionResult.prisma).toBe(mockPrisma)
      expect(connectionResult.success).toBe(true)
      expect(connectionResult.fromPool).toBe(true)
      expect(connectionResult.release).toBe(mockRelease)
      expect(connectionResult.error).toBe(mockError)
    })

    it('should allow minimal properties', () => {
      const connectionResult: ConnectionResult = {
        prisma: null,
        success: false,
      }

      expect(connectionResult.prisma).toBeNull()
      expect(connectionResult.success).toBe(false)
    })
  })

  describe('ConnectionPoolStatus interface', () => {
    it('should allow all properties', () => {
      const poolStatus: ConnectionPoolStatus = {
        size: 5,
        inUse: 2,
        maxSize: 10,
        minSize: 2,
        available: 3,
        utilization: 40,
        configuration: {
          idleTimeout: 30000,
          connectionTimeout: 5000,
          acquireTimeout: 10000,
          enableDynamicSizing: true,
          enableConnectionValidation: true,
        },
        metrics: {
          totalConnections: 5,
          peakConnections: 8,
          totalAcquires: 100,
          acquireSuccesses: 95,
          acquireFailures: 5,
          acquireTimeAvg: 50,
          connectionValidations: 20,
          connectionValidationFailures: 1,
          dynamicPoolAdjustments: 3,
        },
      }

      expect(poolStatus.size).toBe(5)
      expect(poolStatus.inUse).toBe(2)
      expect(poolStatus.maxSize).toBe(10)
      expect(poolStatus.minSize).toBe(2)
      expect(poolStatus.available).toBe(3)
      expect(poolStatus.utilization).toBe(40)

      expect(poolStatus.configuration.idleTimeout).toBe(30000)
      expect(poolStatus.configuration.connectionTimeout).toBe(5000)
      expect(poolStatus.configuration.acquireTimeout).toBe(10000)
      expect(poolStatus.configuration.enableDynamicSizing).toBe(true)
      expect(poolStatus.configuration.enableConnectionValidation).toBe(true)

      expect(poolStatus.metrics.totalConnections).toBe(5)
      expect(poolStatus.metrics.peakConnections).toBe(8)
      expect(poolStatus.metrics.totalAcquires).toBe(100)
      expect(poolStatus.metrics.acquireSuccesses).toBe(95)
      expect(poolStatus.metrics.acquireFailures).toBe(5)
      expect(poolStatus.metrics.acquireTimeAvg).toBe(50)
      expect(poolStatus.metrics.connectionValidations).toBe(20)
      expect(poolStatus.metrics.connectionValidationFailures).toBe(1)
      expect(poolStatus.metrics.dynamicPoolAdjustments).toBe(3)
    })
  })

  describe('DetailedConnectionPoolInfo interface', () => {
    it('should allow all properties', () => {
      const poolStatus: ConnectionPoolStatus = {
        size: 3,
        inUse: 1,
        maxSize: 5,
        minSize: 1,
        available: 2,
        utilization: 33.33,
        configuration: {
          idleTimeout: 30000,
          connectionTimeout: 5000,
          acquireTimeout: 10000,
          enableDynamicSizing: true,
          enableConnectionValidation: true,
        },
        metrics: {
          totalConnections: 3,
          peakConnections: 4,
          totalAcquires: 50,
          acquireSuccesses: 48,
          acquireFailures: 2,
          acquireTimeAvg: 25,
          connectionValidations: 10,
          connectionValidationFailures: 0,
          dynamicPoolAdjustments: 1,
        },
      }

      const detailedInfo: DetailedConnectionPoolInfo = {
        status: poolStatus,
        connections: [
          {
            key: 'conn-1',
            ageMs: 1000,
            idleTimeMs: 500,
            timeSinceValidationMs: 200,
            inUse: false,
          },
          {
            key: 'conn-2',
            ageMs: 2000,
            idleTimeMs: 0,
            timeSinceValidationMs: 100,
            inUse: true,
          },
        ],
      }

      expect(detailedInfo.status).toBe(poolStatus)
      expect(detailedInfo.connections).toHaveLength(2)
      expect(detailedInfo.connections[0].key).toBe('conn-1')
      expect(detailedInfo.connections[0].ageMs).toBe(1000)
      expect(detailedInfo.connections[0].idleTimeMs).toBe(500)
      expect(detailedInfo.connections[0].timeSinceValidationMs).toBe(200)
      expect(detailedInfo.connections[0].inUse).toBe(false)

      expect(detailedInfo.connections[1].key).toBe('conn-2')
      expect(detailedInfo.connections[1].ageMs).toBe(2000)
      expect(detailedInfo.connections[1].idleTimeMs).toBe(0)
      expect(detailedInfo.connections[1].timeSinceValidationMs).toBe(100)
      expect(detailedInfo.connections[1].inUse).toBe(true)
    })
  })

  describe('HealthCheckOptions interface', () => {
    it('should allow all optional properties', () => {
      const healthOptions: HealthCheckOptions = {
        detailed: true,
        checkPgVector: true,
        checkIndices: true,
        timeout: 5000,
        debug: true,
        includePoolDetails: true,
      }

      expect(healthOptions.detailed).toBe(true)
      expect(healthOptions.checkPgVector).toBe(true)
      expect(healthOptions.checkIndices).toBe(true)
      expect(healthOptions.timeout).toBe(5000)
      expect(healthOptions.debug).toBe(true)
      expect(healthOptions.includePoolDetails).toBe(true)
    })

    it('should allow empty object', () => {
      const healthOptions: HealthCheckOptions = {}
      expect(healthOptions).toBeDefined()
    })
  })

  describe('HealthCheckResult interface', () => {
    it('should allow all properties', () => {
      const healthResult: HealthCheckResult = {
        status: 'healthy',
        message: 'Database is healthy',
        timestamp: '2024-01-01T00:00:00.000Z',
        databaseName: 'test_db',
        postgresVersion: 'PostgreSQL 15.0',
        connectionTime: 150,
        pgVectorAvailable: true,
        documentTableExists: true,
        pgVectorVersion: '0.5.0',
        indices: {
          exists: true,
          count: 3,
          details: [
            {
              name: 'idx_document_id',
              definition: 'CREATE INDEX idx_document_id ON document_embeddings(document_id)',
            },
            {
              name: 'idx_embedding_l2',
              definition: 'CREATE INDEX idx_embedding_l2 ON document_embeddings USING ivfflat (embedding vector_l2_ops)',
            },
          ],
        },
        connectionPool: {
          size: 5,
          inUse: 2,
          maxSize: 10,
          minSize: 2,
          available: 3,
          utilization: 40,
          configuration: {
            idleTimeout: 30000,
            connectionTimeout: 5000,
            acquireTimeout: 10000,
            enableDynamicSizing: true,
            enableConnectionValidation: true,
          },
          metrics: {
            totalConnections: 5,
            peakConnections: 8,
            totalAcquires: 100,
            acquireSuccesses: 95,
            acquireFailures: 5,
            acquireTimeAvg: 50,
            connectionValidations: 20,
            connectionValidationFailures: 1,
            dynamicPoolAdjustments: 3,
          },
          connections: [
            {
              key: 'conn-1',
              ageMs: 1000,
              idleTimeMs: 500,
              timeSinceValidationMs: 200,
              inUse: false,
            },
          ],
        },
        error: undefined,
      }

      expect(healthResult.status).toBe('healthy')
      expect(healthResult.message).toBe('Database is healthy')
      expect(healthResult.timestamp).toBe('2024-01-01T00:00:00.000Z')
      expect(healthResult.databaseName).toBe('test_db')
      expect(healthResult.postgresVersion).toBe('PostgreSQL 15.0')
      expect(healthResult.connectionTime).toBe(150)
      expect(healthResult.pgVectorAvailable).toBe(true)
      expect(healthResult.documentTableExists).toBe(true)
      expect(healthResult.pgVectorVersion).toBe('0.5.0')

      expect(healthResult.indices?.exists).toBe(true)
      expect(healthResult.indices?.count).toBe(3)
      expect(healthResult.indices?.details).toHaveLength(2)
      expect(healthResult.indices?.details?.[0].name).toBe('idx_document_id')

      expect(healthResult.connectionPool?.size).toBe(5)
      expect(healthResult.connectionPool?.connections).toHaveLength(1)
      expect(healthResult.error).toBeUndefined()
    })

    it('should allow minimal properties', () => {
      const healthResult: HealthCheckResult = {
        status: 'unhealthy',
        message: 'Database connection failed',
        timestamp: '2024-01-01T00:00:00.000Z',
        error: 'Connection timeout',
      }

      expect(healthResult.status).toBe('unhealthy')
      expect(healthResult.message).toBe('Database connection failed')
      expect(healthResult.timestamp).toBe('2024-01-01T00:00:00.000Z')
      expect(healthResult.error).toBe('Connection timeout')
    })

    it('should allow degraded status', () => {
      const healthResult: HealthCheckResult = {
        status: 'degraded',
        message: 'Database connected but pgvector not available',
        timestamp: '2024-01-01T00:00:00.000Z',
        pgVectorAvailable: false,
      }

      expect(healthResult.status).toBe('degraded')
      expect(healthResult.message).toBe('Database connected but pgvector not available')
      expect(healthResult.pgVectorAvailable).toBe(false)
    })
  })

  describe('DbLogger interface', () => {
    it('should define all required methods', () => {
      // Mock implementation for testing interface compliance
      const mockLogger: DbLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        createTimer: jest.fn().mockReturnValue({
          start: jest.fn(),
          end: jest.fn().mockReturnValue(100),
          elapsed: jest.fn().mockReturnValue(50),
        }),
        setDefaultCategory: jest.fn(),
        shouldLog: jest.fn().mockReturnValue(true),
      }

      expect(typeof mockLogger.log).toBe('function')
      expect(typeof mockLogger.error).toBe('function')
      expect(typeof mockLogger.warn).toBe('function')
      expect(typeof mockLogger.info).toBe('function')
      expect(typeof mockLogger.debug).toBe('function')
      expect(typeof mockLogger.trace).toBe('function')
      expect(typeof mockLogger.createTimer).toBe('function')
      expect(typeof mockLogger.setDefaultCategory).toBe('function')
      expect(typeof mockLogger.shouldLog).toBe('function')

      // Test method calls
      mockLogger.log('Test message')
      expect(mockLogger.log).toHaveBeenCalledWith('Test message')

      mockLogger.error('Error message', new Error('Test error'))
      expect(mockLogger.error).toHaveBeenCalledWith('Error message', expect.any(Error))

      mockLogger.warn('Warning message')
      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message')

      mockLogger.info('Info message')
      expect(mockLogger.info).toHaveBeenCalledWith('Info message')

      mockLogger.debug('Debug message')
      expect(mockLogger.debug).toHaveBeenCalledWith('Debug message')

      mockLogger.trace('Trace message')
      expect(mockLogger.trace).toHaveBeenCalledWith('Trace message')

      const timer = mockLogger.createTimer('test-operation')
      expect(timer).toBeDefined()
      expect(typeof timer.start).toBe('function')
      expect(typeof timer.end).toBe('function')
      expect(typeof timer.elapsed).toBe('function')

      mockLogger.setDefaultCategory(LogCategory.QUERY)
      expect(mockLogger.setDefaultCategory).toHaveBeenCalledWith(LogCategory.QUERY)

      const shouldLog = mockLogger.shouldLog(LogLevel.INFO)
      expect(shouldLog).toBe(true)
      expect(mockLogger.shouldLog).toHaveBeenCalledWith(LogLevel.INFO)
    })
  })

  describe('Type compatibility', () => {
    it('should be compatible with LogLevel values', () => {
      const levels: LogLevel[] = [
        LogLevel.ERROR,
        LogLevel.WARN,
        LogLevel.INFO,
        LogLevel.DEBUG,
        LogLevel.TRACE,
      ]

      levels.forEach(level => {
        expect(typeof level).toBe('string')
        expect(['error', 'warn', 'info', 'debug', 'trace']).toContain(level)
      })
    })

    it('should be compatible with LogCategory values', () => {
      const categories: LogCategory[] = [
        LogCategory.QUERY,
        LogCategory.CONNECTION,
        LogCategory.TRANSACTION,
        LogCategory.MIGRATION,
        LogCategory.INITIALIZATION,
        LogCategory.VECTOR,
        LogCategory.EMBEDDING,
        LogCategory.HEALTH,
      ]

      categories.forEach(category => {
        expect(typeof category).toBe('string')
        expect([
          'query',
          'connection',
          'transaction',
          'migration',
          'initialization',
          'vector',
          'embedding',
          'health',
        ]).toContain(category)
      })
    })

    it('should allow status values', () => {
      const statuses: Array<HealthCheckResult['status']> = ['healthy', 'degraded', 'unhealthy']

      statuses.forEach(status => {
        expect(typeof status).toBe('string')
        expect(['healthy', 'degraded', 'unhealthy']).toContain(status)
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle zero values in metrics', () => {
      const poolStatus: ConnectionPoolStatus = {
        size: 0,
        inUse: 0,
        maxSize: 0,
        minSize: 0,
        available: 0,
        utilization: 0,
        configuration: {
          idleTimeout: 0,
          connectionTimeout: 0,
          acquireTimeout: 0,
          enableDynamicSizing: false,
          enableConnectionValidation: false,
        },
        metrics: {
          totalConnections: 0,
          peakConnections: 0,
          totalAcquires: 0,
          acquireSuccesses: 0,
          acquireFailures: 0,
          acquireTimeAvg: 0,
          connectionValidations: 0,
          connectionValidationFailures: 0,
          dynamicPoolAdjustments: 0,
        },
      }

      expect(poolStatus.size).toBe(0)
      expect(poolStatus.utilization).toBe(0)
      expect(poolStatus.metrics.totalConnections).toBe(0)
    })

    it('should handle negative values in metrics', () => {
      const poolStatus: ConnectionPoolStatus = {
        size: -1,
        inUse: -1,
        maxSize: -1,
        minSize: -1,
        available: -1,
        utilization: -1,
        configuration: {
          idleTimeout: -1,
          connectionTimeout: -1,
          acquireTimeout: -1,
          enableDynamicSizing: false,
          enableConnectionValidation: false,
        },
        metrics: {
          totalConnections: -1,
          peakConnections: -1,
          totalAcquires: -1,
          acquireSuccesses: -1,
          acquireFailures: -1,
          acquireTimeAvg: -1,
          connectionValidations: -1,
          connectionValidationFailures: -1,
          dynamicPoolAdjustments: -1,
        },
      }

      expect(poolStatus.size).toBe(-1)
      expect(poolStatus.utilization).toBe(-1)
    })

    it('should handle very large values', () => {
      const poolStatus: ConnectionPoolStatus = {
        size: Number.MAX_SAFE_INTEGER,
        inUse: Number.MAX_SAFE_INTEGER,
        maxSize: Number.MAX_SAFE_INTEGER,
        minSize: Number.MAX_SAFE_INTEGER,
        available: Number.MAX_SAFE_INTEGER,
        utilization: Number.MAX_SAFE_INTEGER,
        configuration: {
          idleTimeout: Number.MAX_SAFE_INTEGER,
          connectionTimeout: Number.MAX_SAFE_INTEGER,
          acquireTimeout: Number.MAX_SAFE_INTEGER,
          enableDynamicSizing: true,
          enableConnectionValidation: true,
        },
        metrics: {
          totalConnections: Number.MAX_SAFE_INTEGER,
          peakConnections: Number.MAX_SAFE_INTEGER,
          totalAcquires: Number.MAX_SAFE_INTEGER,
          acquireSuccesses: Number.MAX_SAFE_INTEGER,
          acquireFailures: Number.MAX_SAFE_INTEGER,
          acquireTimeAvg: Number.MAX_SAFE_INTEGER,
          connectionValidations: Number.MAX_SAFE_INTEGER,
          connectionValidationFailures: Number.MAX_SAFE_INTEGER,
          dynamicPoolAdjustments: Number.MAX_SAFE_INTEGER,
        },
      }

      expect(poolStatus.size).toBe(Number.MAX_SAFE_INTEGER)
      expect(poolStatus.utilization).toBe(Number.MAX_SAFE_INTEGER)
    })
  })
})
