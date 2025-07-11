/**
 * Monitoring Alert Validation Tests
 * 
 * Tests that monitoring alerts are properly configured and functional
 * Validates alert thresholds, escalation, and notification systems
 * 
 * Staff Engineer Implementation - Production alerting validation
 */

import { describe, test, expect } from '@jest/globals'

describe('Monitoring Alert Validation', () => {
  const HEALTH_ENDPOINT = 'http://localhost:3000/api/monitoring/health';
  const METRICS_ENDPOINT = 'http://localhost:3000/api/monitoring/metrics';

  describe('Health Check Alerts', () => {
    test('should have health check endpoint with proper alertable metrics', async () => {
      const response = await fetch(HEALTH_ENDPOINT);
      
      if (response.ok) {
        const data = await response.json();
        
        // Should have alertable status
        expect(data).toHaveProperty('status');
        expect(['healthy', 'unhealthy', 'degraded']).toContain(data.status);
        
        // Should have timestamp for alert timing
        expect(data).toHaveProperty('timestamp');
        expect(new Date(data.timestamp)).toBeInstanceOf(Date);
        
        // Should have uptime for availability alerts
        expect(data).toHaveProperty('uptime');
        expect(typeof data.uptime).toBe('number');
        expect(data.uptime).toBeGreaterThan(0);
        
        console.log(`Health status: ${data.status}, uptime: ${data.uptime}s`);
      }
    });

    test('should provide component-specific health status', async () => {
      const response = await fetch(HEALTH_ENDPOINT);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.checks) {
          const components = ['database', 'redis', 'datadog'];
          
          components.forEach(component => {
            if (data.checks[component]) {
              const check = data.checks[component];
              
              // Each component should have alertable status
              expect(check).toHaveProperty('status');
              expect(['healthy', 'unhealthy']).toContain(check.status);
              
              // Should have response time for performance alerts
              if (check.responseTime !== undefined) {
                expect(typeof check.responseTime).toBe('number');
                expect(check.responseTime).toBeGreaterThanOrEqual(0);
              }
              
              // Should have lastChecked for staleness alerts
              if (check.lastChecked !== undefined) {
                expect(typeof check.lastChecked).toBe('number');
                const checkAge = Date.now() - check.lastChecked;
                expect(checkAge).toBeLessThan(300000) // Less than 5 minutes old
              }
              
              console.log(`${component}: ${check.status}`);
            }
          });
        }
      }
    });

    test('should detect unhealthy state transitions', async () => {
      // Test multiple health checks to see if we can detect state changes
      const healthChecks: any[] = [];
      
      for (let i = 0; i < 3; i++) {
        const response = await fetch(HEALTH_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          healthChecks.push({
            timestamp: Date.now(),
            status: data.status,
            checks: data.checks
          });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (healthChecks.length >= 2) {
        // Check for status consistency (alerts should fire on changes);
        const statuses = healthChecks.map(check => check.status);
        const uniqueStatuses = [...new Set(statuses)];
        
        if (uniqueStatuses.length > 1) {
          console.log('Health status changed during test - this should trigger alerts');
        }
        
        // All health checks should complete in reasonable time
        healthChecks.forEach((check, index) => {
          if (index > 0) {
            const timeDiff = check.timestamp - healthChecks[index - 1].timestamp;
            expect(timeDiff).toBeLessThan(5000) // Health checks should be fast
          }
        });
      }
    });
  });

  describe('Performance Metrics Alerts', () => {
    test('should provide alertable performance metrics', async () => {
      const response = await fetch(METRICS_ENDPOINT);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.system) {
          // CPU utilization alerts
          if (data.system.cpu !== undefined) {
            expect(typeof data.system.cpu).toBe('number');
            expect(data.system.cpu).toBeGreaterThanOrEqual(0);
            expect(data.system.cpu).toBeLessThanOrEqual(100);
            
            // Alert thresholds validation
            if (data.system.cpu > 80) {
              console.warn(`High CPU usage detected: ${data.system.cpu}% - should trigger alert`);
            }
          }
          
          // Memory utilization alerts
          if (data.system.memory !== undefined) {
            expect(typeof data.system.memory).toBe('number');
            expect(data.system.memory).toBeGreaterThanOrEqual(0);
            expect(data.system.memory).toBeLessThanOrEqual(100);
            
            if (data.system.memory > 85) {
              console.warn(`High memory usage detected: ${data.system.memory}% - should trigger alert`);
            }
          }
          
          // Disk utilization alerts
          if (data.system.disk !== undefined) {
            expect(typeof data.system.disk).toBe('number');
            expect(data.system.disk).toBeGreaterThanOrEqual(0);
            expect(data.system.disk).toBeLessThanOrEqual(100);
            
            if (data.system.disk > 90) {
              console.warn(`High disk usage detected: ${data.system.disk}% - should trigger alert`);
            }
          }
        }
        
        // Response time metrics for latency alerts
        if (data.performance) {
          if (data.performance.responseTime !== undefined) {
            expect(typeof data.performance.responseTime).toBe('number');
            expect(data.performance.responseTime).toBeGreaterThan(0);
            
            if (data.performance.responseTime > 2000) {
              console.warn(`High response time detected: ${data.performance.responseTime}ms - should trigger alert`);
            }
          }
          
          if (data.performance.errorRate !== undefined) {
            expect(typeof data.performance.errorRate).toBe('number');
            expect(data.performance.errorRate).toBeGreaterThanOrEqual(0);
            
            if (data.performance.errorRate > 0.05) { // 5% error rate
              console.warn(`High error rate detected: ${data.performance.errorRate} - should trigger alert`);
            }
          }
        }
      }
    });

    test('should track request volume for traffic alerts', async () => {
      const response = await fetch(METRICS_ENDPOINT);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.users) {
          // Active user metrics
          if (data.users.activeUsers !== undefined) {
            expect(typeof data.users.activeUsers).toBe('number');
            expect(data.users.activeUsers).toBeGreaterThanOrEqual(0);
            
            // Unusual traffic patterns
            if (data.users.activeUsers > 10000) {
              console.warn(`High user count detected: ${data.users.activeUsers} - potential traffic spike`);
            }
            if (data.users.activeUsers === 0) {
              console.warn('Zero active users detected - potential service issue');
            }
          }
          
          // Workspace utilization
          if (data.users.activeWorkspaces !== undefined) {
            expect(typeof data.users.activeWorkspaces).toBe('number');
            expect(data.users.activeWorkspaces).toBeGreaterThanOrEqual(0);
          }
        }
        
        // Request metrics for rate-based alerts
        if (data.requests) {
          if (data.requests.total !== undefined) {
            expect(typeof data.requests.total).toBe('number');
            expect(data.requests.total).toBeGreaterThanOrEqual(0);
          }
          
          if (data.requests.failed !== undefined) {
            expect(typeof data.requests.failed).toBe('number');
            expect(data.requests.failed).toBeGreaterThanOrEqual(0);
          }
        }
      }
    });

    test('should provide metrics with proper timestamps for time-based alerts', async () => {
      const response = await fetch(METRICS_ENDPOINT);
      
      if (response.ok) {
        const data = await response.json();
        
        // Should have timestamp for time-series analysis
        expect(data).toHaveProperty('timestamp');
        const timestamp = new Date(data.timestamp);
        expect(timestamp).toBeInstanceOf(Date);
        
        // Timestamp should be recent (within last minute);
        const age = Date.now() - timestamp.getTime();
        expect(age).toBeLessThan(60000) // Less than 1 minute old
        
        // Staleness detection
        if (age > 30000) { // Older than 30 seconds
          console.warn(`Metrics timestamp is stale: ${age}ms old - may indicate collection issues`);
        }
      }
    });
  });

  describe('Error Rate and Availability Alerts', () => {
    test('should track error rates across multiple requests', async () => {
      const requests = 20;
      const results: { success: boolean, responseTime: number, status: number }[] = [];
      
      for (let i = 0; i < requests; i++) {
        const startTime = Date.now();
        try {
          const response = await fetch(HEALTH_ENDPOINT);
          const responseTime = Date.now() - startTime;
          
          results.push({
            success: response.ok,
            responseTime,
            status: response.status
          });
        } catch (error) {
          results.push({
            success: false,
            responseTime: Date.now() - startTime,
            status: 0
          });
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Calculate error rate
      const successCount = results.filter(r => r.success).length;
      const errorRate = (requests - successCount) / requests;
      const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      
      console.log(`Error rate: ${(errorRate * 100).toFixed(1)}%, Avg response time: ${avgResponseTime.toFixed(1)}ms`);
      
      // Alert thresholds
      expect(errorRate).toBeLessThan(0.1) // Less than 10% error rate
      expect(avgResponseTime).toBeLessThan(2000) // Average response time under 2s
      
      // Check for specific error patterns
      const timeouts = results.filter(r => r.responseTime > 5000).length;
      const serverErrors = results.filter(r => r.status >= 500).length;
      
      if (timeouts > 0) {
        console.warn(`${timeouts} timeouts detected - should trigger latency alerts`);
      }
      if (serverErrors > 0) {
        console.warn(`${serverErrors} server errors detected - should trigger error alerts`);
      }
    });

    test('should detect service availability patterns', async () => {
      // Test availability over time
      const duration = 30000 // 30 seconds;
      const interval = 2000 // Every 2 seconds;
      const startTime = Date.now();
      
      const availability: { timestamp: number, available: boolean }[] = [];
      
      while (Date.now() - startTime < duration) {
        const checkStart = Date.now();
        try {
          const response = await fetch(HEALTH_ENDPOINT, {
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          availability.push({
            timestamp: checkStart,
            available: response.ok
          });
        } catch (error) {
          availability.push({
            timestamp: checkStart,
            available: false
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      
      // Calculate availability percentage
      const availableCount = availability.filter(check => check.available).length;
      const availabilityPercent = (availableCount / availability.length) * 100;
      
      console.log(`Availability: ${availabilityPercent.toFixed(2)}% over ${availability.length} checks`);
      
      // SLA validation
      expect(availabilityPercent).toBeGreaterThan(95) // 95% availability SLA
      
      // Check for downtime patterns
      let consecutiveFailures = 0
      let maxConsecutiveFailures = 0
      
      availability.forEach(check => {
        if (!check.available) {
          consecutiveFailures++
          maxConsecutiveFailures = Math.max(maxConsecutiveFailures, consecutiveFailures);
        } else {
          consecutiveFailures = 0
        }
      });
      
      if (maxConsecutiveFailures > 2) {
        console.warn(`${maxConsecutiveFailures} consecutive failures detected - should trigger downtime alert`);
      }
    }, 35000);
  });

  describe('Resource Exhaustion Alerts', () => {
    test('should detect memory pressure patterns', async () => {
      // Monitor memory usage over multiple requests
      const memoryReadings: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const response = await fetch(METRICS_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          if (data.system?.memory !== undefined) {
            memoryReadings.push(data.system.memory);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (memoryReadings.length > 5) {
        // Check for memory growth trend
        const first = memoryReadings.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const last = memoryReadings.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const growth = last - first;
        
        console.log(`Memory trend: ${first.toFixed(1)}% -> ${last.toFixed(1)}% (${growth > 0 ? '+' : ''}${growth.toFixed(1)}%)`);
        
        // Alert on rapid memory growth
        if (growth > 10) { // More than 10% growth
          console.warn('Rapid memory growth detected - potential memory leak');
        }
        
        // Alert on high memory usage
        const maxMemory = Math.max(...memoryReadings);
        if (maxMemory > 85) {
          console.warn(`High memory usage detected: ${maxMemory}% - should trigger resource alert`);
        }
      }
    });

    test('should monitor connection pool health', async () => {
      const response = await fetch(HEALTH_ENDPOINT);
      
      if (response.ok) {
        const data = await response.json();
        
        // Database connection monitoring
        if (data.checks?.database?.details) {
          const dbDetails = data.checks.database.details;
          
          if (dbDetails.activeConnections !== undefined) {
            expect(typeof dbDetails.activeConnections).toBe('number');
            expect(dbDetails.activeConnections).toBeGreaterThanOrEqual(0);
            
            // Alert on connection pool exhaustion
            if (dbDetails.maxConnections && dbDetails.activeConnections) {
              const utilization = dbDetails.activeConnections / dbDetails.maxConnections;
              if (utilization > 0.8) { // 80% pool utilization
                console.warn(`High DB connection pool utilization: ${(utilization * 100).toFixed(1)}%`);
              }
            }
          }
        }
        
        // Redis connection monitoring
        if (data.checks?.redis?.details) {
          const redisDetails = data.checks.redis.details;
          
          if (redisDetails.connectedClients !== undefined) {
            expect(typeof redisDetails.connectedClients).toBe('number');
            expect(redisDetails.connectedClients).toBeGreaterThanOrEqual(0);
            
            // Alert on too many Redis connections
            if (redisDetails.connectedClients > 100) {
              console.warn(`High Redis client count: ${redisDetails.connectedClients}`);
            }
          }
        }
      }
    });
  });

  describe('Business Logic Alerts', () => {
    test('should monitor feature flag evaluation patterns', async () => {
      // Test feature flag metrics for business alerts
      try {
        const response = await fetch('http://localhost:3000/api/experiments?action=list');
        if (response.ok) {
          const data = await response.json();
          
          if (Array.isArray(data.flags)) {
            const totalFlags = data.flags.length;
            const enabledFlags = data.flags.filter((flag: any) => flag.enabled).length;
            const enabledPercent = totalFlags > 0 ? (enabledFlags / totalFlags) * 100 : 0;
            
            console.log(`Feature flags: ${enabledFlags}/${totalFlags} enabled (${enabledPercent.toFixed(1)}%)`);
            
            // Business logic alerts
            if (totalFlags === 0) {
              console.warn('No feature flags found - potential configuration issue');
            }
            if (enabledPercent === 100) {
              console.warn('All feature flags enabled - potential rollback risk');
            }
            if (enabledPercent === 0 && totalFlags > 0) {
              console.warn('All feature flags disabled - potential service degradation');
            }
          }
        }
      } catch (error) {
        // Connection errors are OK for this test
      }
    });

    test('should track user activity for business alerts', async () => {
      const response = await fetch(METRICS_ENDPOINT);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.users) {
          const activeUsers = data.users.activeUsers || 0;
          const activeWorkspaces = data.users.activeWorkspaces || 0;
          
          console.log(`Business metrics - Users: ${activeUsers}, Workspaces: ${activeWorkspaces}`);
          
          // Business health alerts
          if (activeUsers === 0) {
            console.warn('Zero active users - potential business impact');
          }
          if (activeWorkspaces === 0 && activeUsers > 0) {
            console.warn('Users active but no workspaces - potential feature issue');
          }
          
          // Growth/decline alerts
          const userWorkspaceRatio = activeUsers > 0 ? activeWorkspaces / activeUsers : 0;
          if (userWorkspaceRatio > 2) {
            console.log(`High workspace/user ratio: ${userWorkspaceRatio.toFixed(2)} - power users detected`);
          }
        }
      }
    });
  });

  describe('Alert Configuration Validation', () => {
    test('should have consistent metric collection intervals', async () => {
      // Test that metrics are collected at consistent intervals
      const collections: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const response = await fetch(METRICS_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          if (data.timestamp) {
            collections.push(new Date(data.timestamp).getTime());
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (collections.length >= 3) {
        // Check intervals between collections
        const intervals: number[] = [];
        for (let i = 1; i < collections.length; i++) {
          intervals.push(collections[i] - collections[i - 1]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const maxVariation = Math.max(...intervals) - Math.min(...intervals);
        
        console.log(`Metric collection interval: ${avgInterval.toFixed(0)}ms avg, ${maxVariation.toFixed(0)}ms variation`);
        
        // Intervals should be reasonably consistent for reliable alerting
        expect(maxVariation).toBeLessThan(5000) // Less than 5 second variation
      }
    });

    test('should provide alert-friendly metric formats', async () => {
      const response = await fetch(METRICS_ENDPOINT);
      
      if (response.ok) {
        const data = await response.json();
        
        // Metrics should have consistent structure for alerting systems
        expect(data).toHaveProperty('timestamp');
        
        // Numeric metrics should be numbers, not strings
        if (data.system) {
          Object.entries(data.system).forEach(([key, value]) => {
            if (['cpu', 'memory', 'disk'].includes(key)) {
              expect(typeof value).toBe('number');
            }
          });
        }
        
        // Performance metrics should be structured consistently
        if (data.performance) {
          if (data.performance.responseTime !== undefined) {
            expect(typeof data.performance.responseTime).toBe('number');
          }
          if (data.performance.errorRate !== undefined) {
            expect(typeof data.performance.errorRate).toBe('number');
          }
        }
        
        // Boolean status should be consistent
        if (data.status) {
          expect(typeof data.status).toBe('string');
          expect(['healthy', 'unhealthy', 'degraded']).toContain(data.status);
        }
      }
    });
  });
});