/**
 * Monitoring Health Check Tests
 * Validates health endpoints and monitoring system status
 */

import { describe, test, expect } from '@jest/globals'

describe('Monitoring Health Endpoints', () => {
  test('should provide detailed health status', async () => {
    const response = await fetch('/api/monitoring/health');
    expect(response.status).toBe(200);
    
    const health = await response.json();
    
    // Required health check fields
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('timestamp');
    expect(health).toHaveProperty('uptime');
    expect(health).toHaveProperty('version');
    expect(health).toHaveProperty('components');
    
    // Component health checks
    expect(health.components).toHaveProperty('datadog');
    expect(health.components).toHaveProperty('database');
    expect(health.components).toHaveProperty('redis');
    expect(health.components).toHaveProperty('metrics_api');
    
    // Each component should have status and details
    Object.entries(health.components).forEach(([name, component]: [string, any]) => {
      expect(component).toHaveProperty('status');
      expect(component).toHaveProperty('responseTime');
      expect(['healthy', 'unhealthy', 'degraded']).toContain(component.status);
    });
  });

  test('should respond within acceptable time limits', async () => {
    const startTime = Date.now();
    const response = await fetch('/api/monitoring/health');
    const endTime = Date.now();
    
    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(1000) // 1 second max
  });

  test('should include monitoring system metrics', async () => {
    const response = await fetch('/api/monitoring/health');
    const health = await response.json();
    
    expect(health).toHaveProperty('metrics');
    expect(health.metrics).toHaveProperty('totalMetricsCollected');
    expect(health.metrics).toHaveProperty('averageResponseTime');
    expect(health.metrics).toHaveProperty('errorRate');
    expect(health.metrics).toHaveProperty('activeMonitoringSessions');
  });
});

describe('Component Health Validation', () => {
  test('should validate Datadog connectivity', async () => {
    const response = await fetch('/api/monitoring/health/datadog');
    expect(response.status).toBe(200);
    
    const datadogHealth = await response.json();
    
    expect(datadogHealth).toHaveProperty('status');
    expect(datadogHealth).toHaveProperty('apiConnectivity');
    expect(datadogHealth).toHaveProperty('lastSuccessfulSubmission');
    expect(datadogHealth).toHaveProperty('pendingMetrics');
    expect(datadogHealth).toHaveProperty('errorCount');
  });

  test('should validate database connectivity', async () => {
    const response = await fetch('/api/monitoring/health/database');
    expect(response.status).toBe(200);
    
    const dbHealth = await response.json();
    
    expect(dbHealth).toHaveProperty('status');
    expect(dbHealth).toHaveProperty('connectionPool');
    expect(dbHealth).toHaveProperty('queryResponseTime');
    expect(dbHealth).toHaveProperty('activeConnections');
  });

  test('should validate Redis connectivity', async () => {
    const response = await fetch('/api/monitoring/health/redis');
    expect(response.status).toBe(200);
    
    const redisHealth = await response.json();
    
    expect(redisHealth).toHaveProperty('status');
    expect(redisHealth).toHaveProperty('memory');
    expect(redisHealth).toHaveProperty('connections');
    expect(redisHealth).toHaveProperty('responseTime');
  });
});

describe('Health Check Security', () => {
  test('should require authentication for detailed health info', async () => {
    const response = await fetch('/api/monitoring/health/detailed');
    expect(response.status).toBe(401);
  });

  test('should provide public health status without authentication', async () => {
    const response = await fetch('/api/monitoring/health/public');
    expect(response.status).toBe(200);
    
    const publicHealth = await response.json();
    
    // Should only include basic status
    expect(publicHealth).toHaveProperty('status');
    expect(publicHealth).not.toHaveProperty('components');
    expect(publicHealth).not.toHaveProperty('metrics');
  });
});

describe('Health Check Performance', () => {
  test('should handle multiple concurrent health checks', async () => {
    const promises = Array.from({ length: 50 }, () =>
      fetch('/api/monitoring/health');
    );
    
    const responses = await Promise.all(promises);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });

  test('should cache health check results appropriately', async () => {
    const firstRequest = Date.now();
    await fetch('/api/monitoring/health');
    const firstResponseTime = Date.now() - firstRequest;
    
    // Second request should be faster due to caching
    const secondRequest = Date.now();
    await fetch('/api/monitoring/health');
    const secondResponseTime = Date.now() - secondRequest;
    
    expect(secondResponseTime).toBeLessThan(firstResponseTime);
  });
});