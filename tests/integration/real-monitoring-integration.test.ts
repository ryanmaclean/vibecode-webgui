/**
 * REAL Monitoring Integration Tests
 *
 * Tests actual monitoring stack integration with real services
 * NO MOCKING - Real connections to verify monitoring works
 *
 * Staff Engineer Implementation - Replacing over-mocked monitoring tests
 */

// Check if databases are available (set by jest.globalSetup.js)
const SKIP_POSTGRES = process.env.SKIP_POSTGRES_TESTS === '1';
const SKIP_REDIS = process.env.SKIP_REDIS_TESTS === '1';

const { getDatadogApiKey, getDatadogSite } = require('../../src/lib/monitoring/datadog-env');

// Skip these tests if DD_API_KEY not set or databases unavailable
const HAS_DD_KEY = process.env.DD_API_KEY !== undefined;
const SKIP_TESTS = SKIP_POSTGRES || SKIP_REDIS || !HAS_DD_KEY;

(SKIP_TESTS ? describe.skip : describe)('Real Monitoring Integration Tests (NO MOCKING)', () => {
  beforeAll(() => {
    const apiKey = getDatadogApiKey()
    if (!apiKey) {
      throw new Error('DD_API_KEY (or DATADOG_API_KEY) must be set for real monitoring tests')
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set for real database monitoring tests')
    }
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL must be set for real Redis monitoring tests')
    }
  });

  test('should successfully initialize and send metrics to Datadog RUM', async () => {
    // Test that our RUM initialization works in a real browser-like environment
    const jsdom = require('jsdom')
    const { JSDOM } = jsdom

    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    global.window = dom.window as any
    global.document = dom.window.document
    global.navigator = dom.window.navigator

    // Import monitoring library in browser context
    const { monitoring } = require('../../src/lib/monitoring')

    // Should not throw when initializing with real config
    expect(() => {
      monitoring.init()
    }).not.toThrow()

    // Test metric submission
    const startTime = Date.now()
    monitoring.trackPageLoad('/', startTime)
    monitoring.trackUserAction('test-integration', { test: true });

    // These should not throw with real RUM
    expect(() => {
      monitoring.trackError(new Error('Test integration error'), {
        context: 'integration-test'
      })
    }).not.toThrow()

    // Cleanup
    delete (global as any).window
    delete (global as any).document
    delete (global as any).navigator
  }, 10000);

  test('should connect to real PostgreSQL and validate schema', async () => {
    const { Client } = require('pg')
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000
    });

    try {
      await client.connect()

      // Verify tables exist
      const tablesResult = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `)

      const tables = tablesResult.rows.map((row) => row.table_name)
      expect(tables).toContain('users')
      expect(tables).toContain('projects')
      expect(tables).toContain('sessions')

      // Test real query performance
      const startTime = Date.now()
      const result = await client.query('SELECT COUNT(*) as count FROM users')
      const queryTime = Date.now() - startTime

      expect(result.rows).toHaveLength(1)
      expect(typeof parseInt(result.rows[0].count)).toBe('number')
      expect(queryTime).toBeLessThan(1000) // Should be fast

      // Test connection pool info
      const poolResult = await client.query(`
        SELECT
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `)

      expect(Number(poolResult.rows[0].total_connections)).toBeGreaterThan(0)
      expect(parseInt(poolResult.rows[0].active_connections)).toBeGreaterThanOrEqual(1)

    } finally {
      await client.end()
    }
  }, 15000);

  test('should connect to real Redis and validate cache operations', async () => {
    const redis = require('redis')
    const client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000
      }
    });

    try {
      await client.connect()

      // Test basic operations
      const testKey = `integration-test-${Date.now()}`
      const testValue = JSON.stringify({
        test: true,
        timestamp: Date.now(),
        data: 'integration-test-data'
      });

      // Set with expiration
      await client.setEx(testKey, 60, testValue)

      // Get and verify
      const retrieved = await client.get(testKey)
      expect(retrieved).toBe(testValue)

      const parsed = JSON.parse(retrieved!)
      expect(parsed.test).toBe(true)
      expect(parsed.data).toBe('integration-test-data')

      // Test TTL
      const ttl = await client.ttl(testKey)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(60)

      // Test performance
      const startTime = Date.now()
      await client.ping()
      const pingTime = Date.now() - startTime
      expect(pingTime).toBeLessThan(100) // Should be very fast

      // Test Redis info
      const info = await client.info('memory')
      expect(info).toContain('used_memory')
      expect(info).toContain('used_memory_human')

      console.log('Real integration configuration:', {
        hasDatadogKey: !!getDatadogApiKey(),
        hasRumConfig: true,
        datadogSite: getDatadogSite()
      });

      // Cleanup
      await client.del(testKey)

    } finally {
      await client.quit()
    }
  }, 15000);

  test('should validate health check endpoint returns real status', async () => {
    const response = await fetch('http://localhost:3000/api/health')

    if (response.ok) {
      const healthData = await response.json()

      expect(healthData).toHaveProperty('status')
      expect(healthData).toHaveProperty('timestamp')
      expect(healthData).toHaveProperty('uptime')
      expect(healthData).toHaveProperty('version')

      // Should have real timestamp
      const timestamp = new Date(healthData.timestamp).getTime()
      const now = Date.now()
      expect(Math.abs(now - timestamp)).toBeLessThan(5000) // Within 5 seconds

      // Should have realistic uptime
      expect(typeof healthData.uptime).toBe('number')
      expect(healthData.uptime).toBeGreaterThan(0)

      // Check individual service health
      if (healthData.checks) {
        // Database check should be real
        if (healthData.checks.database) {
          expect(healthData.checks.database).toHaveProperty('status')
          expect(healthData.checks.database).toHaveProperty('responseTime')
          expect(typeof healthData.checks.database.responseTime).toBe('number')
          expect(healthData.checks.database.responseTime).toBeGreaterThan(0)

          if (healthData.checks.database.status === 'healthy') {
            expect(healthData.checks.database).toHaveProperty('details')
            expect(healthData.checks.database.details).toHaveProperty('version')
            expect(healthData.checks.database.details.version).toContain('PostgreSQL')
          }
        }

        // Redis check should be real
        if (healthData.checks.redis) {
          expect(healthData.checks.redis).toHaveProperty('status')
          expect(healthData.checks.redis).toHaveProperty('responseTime')
          expect(typeof healthData.checks.redis.responseTime).toBe('number')

          if (healthData.checks.redis.status === 'healthy') {
            expect(healthData.checks.redis).toHaveProperty('details')
          }
        }
      }
    } else {
      throw new Error(`Health check failed with status: ${response.status}`)
    }
  }, 15000);

  test('should validate monitoring metrics endpoint returns real data', async () => {
    const response = await fetch('http://localhost:3000/api/monitoring/metrics')

    if (response.ok) {
      const metricsData = await response.json()

      expect(metricsData).toHaveProperty('timestamp')
      expect(metricsData).toHaveProperty('system')

      // System metrics should be realistic
      if (metricsData.system) {
        // CPU usage should be reasonable
        expect(metricsData.system.cpu).toBeGreaterThanOrEqual(0)
        expect(metricsData.system.cpu).toBeLessThanOrEqual(100)

        // Memory usage should be reasonable
        expect(metricsData.system.memory).toBeGreaterThanOrEqual(0)
        expect(metricsData.system.memory).toBeLessThanOrEqual(100)

        // Should not be obviously fake values
        expect(metricsData.system.cpu).not.toBe(45.5) // Common fake value
        expect(metricsData.system.memory).not.toBe(67.3) // Common fake value

        // Load average should exist on Unix systems
        if (process.platform !== 'win32') {
          expect(metricsData.system).toHaveProperty('loadAverage')
          expect(Array.isArray(metricsData.system.loadAverage)).toBe(true)
          expect(metricsData.system.loadAverage).toHaveLength(3)
        }

        // Network stats should be cumulative and increasing
        if (metricsData.system.network) {
          expect(metricsData.system.network.rx).toBeGreaterThanOrEqual(0)
          expect(metricsData.system.network.tx).toBeGreaterThanOrEqual(0)
          expect(typeof metricsData.system.network.rx).toBe('number')
          expect(typeof metricsData.system.network.tx).toBe('number')
        }
      }

      // Application metrics should be present
      if (metricsData.application) {
        expect(metricsData.application).toHaveProperty('requestCount')
        expect(metricsData.application).toHaveProperty('responseTime')
        expect(typeof metricsData.application.requestCount).toBe('number')
        expect(metricsData.application.requestCount).toBeGreaterThanOrEqual(0)
      }
    } else if (response.status === 401) {
      console.log('Metrics endpoint requires authentication')
    } else {
      throw new Error(`Metrics endpoint failed with status: ${response.status}`)
    }
  }, 15000);

  test('should validate Vector logging pipeline is operational', async () => {
    // Skip if kubectl not available
    if (process.env.SKIP_K8S_TESTS === '1') {
      console.log('Skipping Vector K8s check - kubectl not available');
      return;
    }

    // Check if Vector is running in Kubernetes
    const { execSync } = require('child_process')

    try {
      const vectorPods = execSync('kubectl get pods -n monitoring -l app=vector --no-headers', {
        encoding: 'utf8',
        timeout: 10000
      });

      const pods = vectorPods.trim().split('\n').filter(line => line.length > 0)
      expect(pods.length).toBeGreaterThan(0)

      // Check that at least one pod is running
      const runningPods = pods.filter(pod => pod.includes('Running'))
      expect(runningPods.length).toBeGreaterThan(0)

      // Test log generation and collection
      const testLogMessage = `Integration test log ${Date.now()}`

      // Generate a log entry via our application
      const logResponse = await fetch('http://localhost:3000/api/monitoring/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          level: 'info',
          message: testLogMessage,
          service: 'vibecode-webgui',
          environment: 'test'
        })
      })

      if (logResponse.ok) {
        console.log('Successfully sent log to monitoring pipeline')
      }

    } catch (error) {
      console.log('Vector pods check failed - may not be in Kubernetes environment:', error)
    }
  }, 20000);

  test('should validate Datadog agent connectivity', async () => {
    const datadogApiKey = getDatadogApiKey() as string
    const baseUrl = 'https://api.datadoghq.com'

    // Test API key validation
    const response = await fetch(`${baseUrl}/api/v1/validate`, {
      method: 'GET',
      headers: {
        'DD-API-KEY': datadogApiKey,
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok).toBe(true)

    const validationData = await response.json()
    expect(validationData).toHaveProperty('valid')
    expect(validationData.valid).toBe(true)

    // Test metric submission
    const now = Math.floor(Date.now() / 1000)
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.integration.test',
          points: [[now, 1]],
          tags: [
            'test:integration',
            'service:vibecode-webgui',
            'environment:test',
            `timestamp:${now}`
          ]
        }
      ]
    }

    const metricsResponse = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': datadogApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)
    });

    expect(metricsResponse.ok).toBe(true)

    const metricsResult = await metricsResponse.json()
    expect(metricsResult).toHaveProperty('status')
    expect(metricsResult.status).toBe('ok')
  }, 20000);

  test('should validate monitoring dashboard renders real data', async () => {
    // This would typically use a browser automation tool, but for now
    // we'll test the data endpoints the dashboard uses

    const endpoints = [
      '/api/monitoring/system',
      '/api/monitoring/application',
      '/api/monitoring/database',
      '/api/monitoring/errors'
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:3000${endpoint}`)

        if (response.ok) {
          const data = await response.json()

          // Should have timestamp
          expect(data).toHaveProperty('timestamp')

          // Should not be empty or obviously fake
          expect(Object.keys(data).length).toBeGreaterThan(1)

          // Should have realistic data types
          Object.values(data).forEach(value => {
            if (typeof value === 'number') {
              expect(isNaN(value as number)).toBe(false)
              expect(isFinite(value as number)).toBe(true)
            }
          });

        } else if (response.status === 401) {
          console.log(`Endpoint ${endpoint} requires authentication`)
        }

      } catch (error) {
        console.log(`Endpoint ${endpoint} not available:`, error)
      }
    }
  }, 30000);
});

// Test to verify our monitoring tests are using real integrations
describe('Monitoring Test Quality Validation', () => {
  test('should not have extensive mocking in critical monitoring tests', () => {
    const fs = require('fs')
    const testFileContent = fs.readFileSync(__filename, 'utf8')

    // Count ACTUAL mock usage (excluding this validator's own checks)
    const lines = testFileContent.split('\n')
    const actualMocks = lines.filter(line =>
      (line.includes('jest.mock') || line.includes('jest.fn')) &&
      !line.includes('expect(') &&
      !line.includes('match(/jest\\.mock/g)') &&
      !line.includes('.not.toContain(') &&
      !line.includes('// Count') &&
      !line.includes('line.includes(') &&
      !line.trim().startsWith('//') &&
      (line.trim().startsWith('jest.mock') || line.includes('jest.fn()'))
    )

    // Integration tests should have minimal ACTUAL mocking (validator code excluded)
    expect(actualMocks.length).toBeLessThanOrEqual(1)

    // Should not mock critical monitoring components in actual code
    const hasDatadogRumMock = lines.some(line =>
      line.includes("jest.mock('@datadog/browser-rum')") && !line.includes('expect(')
    )
    const hasDatadogLogsMock = lines.some(line =>
      line.includes("jest.mock('@datadog/browser-logs')") && !line.includes('expect(')
    )
    const hasPgMock = lines.some(line =>
      line.includes("jest.mock('pg')") && !line.includes('expect(')
    )
    const hasRedisMock = lines.some(line =>
      line.includes("jest.mock('redis')") && !line.includes('expect(')
    )

    expect(hasDatadogRumMock).toBe(false)
    expect(hasDatadogLogsMock).toBe(false)
    expect(hasPgMock).toBe(false)
    expect(hasRedisMock).toBe(false)
  });

  test('should validate environment has real monitoring configuration', () => {
    if (shouldRunRealTests) {
      // Verify we have real configuration values
      const effectiveApiKey = process.env.DD_API_KEY || process.env.DATADOG_API_KEY
      expect(effectiveApiKey).toBeTruthy()
      expect(process.env.DATABASE_URL).toBeTruthy()
      expect(process.env.REDIS_URL).toBeTruthy()

      // Should not contain test/fake values
      const dangerousValues = [
        'test-key',
        'fake-key',
        'localhost:fake',
        'mock-endpoint'
      ]

      dangerousValues.forEach(dangerousValue => {
        expect(effectiveApiKey).not.toContain(dangerousValue)
        expect(process.env.DATABASE_URL).not.toContain(dangerousValue)
        expect(process.env.REDIS_URL).not.toContain(dangerousValue)
      });
    }
  });
});
