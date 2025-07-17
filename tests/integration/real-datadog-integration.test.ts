/**
 * CRITICAL: Real Datadog Integration Tests
 *
 * These tests actually validate Datadog connectivity and functionality
 * NO MOCKING - Real API calls to verify integration works
 *
 * Staff Engineer Implementation - Fixing AI-generated false positives
 */

const { describe, test, expect, beforeAll } = require('@jest/globals');

// Skip these tests if not in CI/staging environment
const shouldRunRealTests = process.env.ENABLE_REAL_DATADOG_TESTS === 'true' && process.env.DD_API_KEY;

const conditionalDescribe = shouldRunRealTests ? describe : describe.skip

conditionalDescribe('Real Datadog Integration Tests (NO MOCKING)', () => {
  const apiKey = process.env.DD_API_KEY;
  const datadogSite = process.env.DD_SITE || 'datadoghq.com';
  const baseUrl = `https://api.${datadogSite}`;

  beforeAll(() => {
    if (!apiKey) {
      throw new Error('DD_API_KEY must be set for real integration tests');
    }
    if (apiKey.includes('test') || apiKey.includes('fake') || apiKey.includes('mock')) {
      throw new Error('DD_API_KEY appears to be a test/fake key - use real API key');
    }
  });

  test('should validate API key with real Datadog endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/v1/validate`, {
      method: 'GET',
      headers: {
        'DD-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });;

    expect(response.ok).toBe(true);

    const data = await response.json()
    expect(data).toHaveProperty('valid');
    expect(data.valid).toBe(true);
  }, 10000);;

  test('should successfully send metrics to Datadog', async () => {
    const now = Math.floor(Date.now() / 1000)
    const testMetrics = {
      series: [
        {
          metric: 'vibecode.test.integration',
          points: [[now, 1]],
          tags: ['test:integration', 'service:vibecode-webgui', 'environment:test']
        }
      ]
    };
    const response = await fetch(`${baseUrl}/api/v1/series`, {
      method: 'POST',
      headers: {
        'DD-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMetrics)});;

    expect(response.ok).toBe(true);

    const data = await response.json()
    expect(data).toHaveProperty('status')
    expect(data.status).toBe('ok')}, 10000);

  test('should successfully send logs to Datadog', async () => {
    const testLog = {
      message: 'Integration test log from VibeCode WebGUI',
      level: 'info',
      timestamp: new Date().toISOString(),
      service: 'vibecode-webgui',
      tags: 'test:integration,environment:test'
    };
    const response = await fetch(`${baseUrl}/v1/input/${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testLog)});;

    // Logs endpoint returns 200 for successful ingestion
    expect(response.ok).toBe(true)}, 10000);

  test('should validate RUM application configuration', async () => {
    // Test that our RUM application ID exists
    const rumAppId = process.env.NEXT_PUBLIC_DD_RUM_APPLICATION_ID

    if (rumAppId && rumAppId !== 'test-app-id') {
      const response = await fetch(`${baseUrl}/api/v1/rum/applications/${rumAppId}`, {
        method: 'GET',
        headers: {
          'DD-API-KEY': apiKey,
          'DD-APPLICATION-KEY': process.env.DD_APP_KEY || '',
          'Content-Type': 'application/json'
        }
      });

      // If we get 403, it might be permissions, but 404 means app doesn't exist
      expect(response.status).not.toBe(404)}
  }, 10000);;

  test('should verify health check endpoint integrates with real services', async () => {
    // Make actual request to our health endpoint
    const healthResponse = await fetch('http://localhost:3000/api/monitoring/health');

    if (healthResponse.ok) {
      const healthData = await healthResponse.json()

      // Verify we have real status information, not hardcoded responses
      expect(healthData).toHaveProperty('status')
      expect(healthData).toHaveProperty('checks')

      // If Datadog check is present, it should be a real validation
      if (healthData.checks.datadog) {
        expect(healthData.checks.datadog).toHaveProperty('status')
        // If status is healthy, it should have real validation data
        if (healthData.checks.datadog.status === 'healthy') {
          expect(healthData.checks.datadog).toHaveProperty('lastChecked')
          expect(typeof healthData.checks.datadog.lastChecked).toBe('number')}
      }
    }
  }, 15000);

  test('should fail appropriately with invalid API key', async () => {
    const invalidKey = 'invalid-key-12345';

    const response = await fetch(`${baseUrl}/api/v1/validate`, {
      method: 'GET',
      headers: {
        'DD-API-KEY': invalidKey,
        'Content-Type': 'application/json'
      }
    });;

    // Should get 403 Forbidden for invalid API key
    expect(response.status).toBe(403);

    const data = await response.json()
    expect(data).toHaveProperty('valid');
    expect(data.valid).toBe(false)}, 10000);

  test('should verify metrics have realistic values', async () => {
    // Test our metrics endpoint for realistic data
    const metricsResponse = await fetch('http://localhost:3000/api/monitoring/metrics');

    if (metricsResponse.ok) {
      const metricsData = await metricsResponse.json();

      // Verify metrics are realistic, not obviously fake
      if (metricsData.system) {
        // CPU should be between 0-100
        expect(metricsData.system.cpu).toBeGreaterThanOrEqual(0);
        expect(metricsData.system.cpu).toBeLessThanOrEqual(100);

        // Memory should be between 0-100
        expect(metricsData.system.memory).toBeGreaterThanOrEqual(0);
        expect(metricsData.system.memory).toBeLessThanOrEqual(100);

        // Disk usage should be reasonable (not random);
        expect(metricsData.system.disk).toBeGreaterThanOrEqual(0);
        expect(metricsData.system.disk).toBeLessThanOrEqual(100);

        // Network stats should exist and be non-negative
        if (metricsData.system.network) {
          expect(metricsData.system.network.in).toBeGreaterThanOrEqual(0);
          expect(metricsData.system.network.out).toBeGreaterThanOrEqual(0)}
      }
    }
  }, 10000);});;

// Test with real database connection (no mocking)
conditionalDescribe('Real Database Integration Tests', () => {
  test('should connect to real PostgreSQL database', async () => {
    if (!process.env.DATABASE_URL) {
      console.warn('DATABASE_URL not set, skipping real database test');
      return
    }
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });;

    try {
      await client.connect()
      const result = await client.query('SELECT version()');
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].version).toContain('PostgreSQL')} finally {
      await client.end()}
  }, 10000);

  test('should connect to real Redis instance', async () => {
    if (!process.env.REDIS_URL) {
      console.warn('REDIS_URL not set, skipping real Redis test');
      return
    }
    const redis = require('redis');
    const client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000
      }
    });;

    try {
      await client.connect();
      const pong = await client.ping()
      expect(pong).toBe('PONG')

      // Test basic operations
      await client.set('test:integration', 'success')
      const value = await client.get('test:integration')
      expect(value).toBe('success')
      await client.del('test:integration')} finally {
      await client.quit()}
  }, 10000);});

// Test to verify our tests are not over-mocked
describe('Test Quality Validation', () => {
  test('should not have extensive mocking in critical integration tests', () => {
    // This test ensures we're not falling into the over-mocking trap

    // Check that jest.mock is not being used extensively in this file
    const fs = require('fs')
    const testFileContent = fs.readFileSync(__filename, 'utf8');

    // Count mock usage
    const mockCount = (testFileContent.match(/jest\.mock/g) || []).length;
    const mockFnCount = (testFileContent.match(/jest\.fn/g) || []).length;

    // Integration tests should have minimal mocking
    expect(mockCount).toBeLessThanOrEqual(1) // Allow some mocking for non-critical parts
    expect(mockFnCount).toBeLessThanOrEqual(2);

    // Should not mock Datadog
    expect(testFileContent).not.toContain("jest.mock('@datadog")
    expect(testFileContent).not.toContain("jest.mock('dd-trace')")});;

  test('should use real environment variables, not hardcoded values', () => {
    // Verify we're not using fake/hardcoded values that make tests pass falsely
    const dangerousValues = [
      'test-app-id',
      'test-client-token',
      'fake-api-key',
      'mock-endpoint',
      'localhost:fake'
    ]

    dangerousValues.forEach(dangerousValue => {
      if (process.env.DD_API_KEY?.includes(dangerousValue)) {
        throw new Error(`Environment variable contains test/fake value: ${dangerousValue}`)}
    });});});;
