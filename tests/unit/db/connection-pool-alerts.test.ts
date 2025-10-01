/**
 * Unit tests for ConnectionPoolAlertService dynamic import functionality
 * Tests the lazy-loading behavior and ensures proper error handling
 */

import { ConnectionPoolAlertService } from '@/lib/db/connection-pool-alerts';

// Mock the vector-connection-pool module
const mockVectorConnectionPool = {
  createConnectionPool: jest.fn(),
  ConnectionPoolFactory: jest.fn(),
};

// Mock dynamic import
jest.mock('@/lib/db/vector-connection-pool', () => mockVectorConnectionPool);

// Mock browser environment
const mockWindow = {
  location: { href: 'http://localhost:3000' },
};

describe('ConnectionPoolAlertService Dynamic Import', () => {
  let originalWindow: any;
  let originalConsoleWarn: any;

  beforeEach(() => {
    // Store original values
    originalWindow = global.window;
    originalConsoleWarn = console.warn;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset module state
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original values
    global.window = originalWindow;
    console.warn = originalConsoleWarn;
  });

  describe('Server Environment', () => {
    beforeEach(() => {
      // Simulate server environment (no window)
      delete (global as any).window;
    });

    it('should load vector connection pool module on server', async () => {
      // Mock successful import
      jest.doMock('@/lib/db/vector-connection-pool', () => mockVectorConnectionPool);

      const service = ConnectionPoolAlertService.getInstance();
      
      // Trigger module loading
      await service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      });

      // Verify the module was loaded
      expect(mockVectorConnectionPool.createConnectionPool).toHaveBeenCalled();
    });

    it('should handle module loading failure gracefully', async () => {
      // Mock failed import
      jest.doMock('@/lib/db/vector-connection-pool', () => {
        throw new Error('Module not found');
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const service = ConnectionPoolAlertService.getInstance();
      
      // Should not throw error even if module fails to load
      await expect(service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      })).resolves.not.toThrow();

      // Should log warning about module loading failure
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ConnectionPoolAlertService] Unable to load vector connection pool module',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should cache module after successful load', async () => {
      jest.doMock('@/lib/db/vector-connection-pool', () => mockVectorConnectionPool);

      const service = ConnectionPoolAlertService.getInstance();
      
      // First call should load the module
      await service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      });

      const firstCallCount = mockVectorConnectionPool.createConnectionPool.mock.calls.length;

      // Second call should use cached module
      await service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      });

      // Should not call createConnectionPool again (cached)
      expect(mockVectorConnectionPool.createConnectionPool).toHaveBeenCalledTimes(firstCallCount);
    });
  });

  describe('Browser Environment', () => {
    beforeEach(() => {
      // Simulate browser environment
      global.window = mockWindow;
    });

    it('should skip module loading in browser environment', async () => {
      const service = ConnectionPoolAlertService.getInstance();
      
      // Should not attempt to load the module in browser
      await service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      });

      // Should not call the mocked module
      expect(mockVectorConnectionPool.createConnectionPool).not.toHaveBeenCalled();
    });

    it('should return null for module loading in browser', async () => {
      const service = ConnectionPoolAlertService.getInstance();
      
      // Should complete without error in browser
      await expect(service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      })).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      delete (global as any).window;
    });

    it('should handle network errors during import', async () => {
      // Mock network error
      jest.doMock('@/lib/db/vector-connection-pool', () => {
        throw new Error('Network error: Failed to fetch');
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const service = ConnectionPoolAlertService.getInstance();
      
      await expect(service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      })).resolves.not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ConnectionPoolAlertService] Unable to load vector connection pool module',
        expect.objectContaining({
          message: 'Network error: Failed to fetch'
        })
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle module syntax errors', async () => {
      // Mock syntax error
      jest.doMock('@/lib/db/vector-connection-pool', () => {
        throw new SyntaxError('Unexpected token');
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const service = ConnectionPoolAlertService.getInstance();
      
      await expect(service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      })).resolves.not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ConnectionPoolAlertService] Unable to load vector connection pool module',
        expect.objectContaining({
          message: 'Unexpected token'
        })
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Monitoring Functionality', () => {
    beforeEach(() => {
      delete (global as any).window;
    });

    it('should continue monitoring even when module fails to load', async () => {
      // Mock failed import
      jest.doMock('@/lib/db/vector-connection-pool', () => {
        throw new Error('Module not found');
      });

      const service = ConnectionPoolAlertService.getInstance();
      
      await service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      });

      // Should still be able to create alerts
      const alert = service.createAlert({
        type: 'pool_utilization' as any,
        severity: 'warning' as any,
        message: 'Pool utilization is high',
        timestamp: new Date(),
        metadata: { utilization: 85 }
      });

      expect(alert).toBeDefined();
      expect(alert.type).toBe('pool_utilization');
      expect(alert.severity).toBe('warning');
    });

    it('should provide fallback functionality when module unavailable', async () => {
      jest.doMock('@/lib/db/vector-connection-pool', () => {
        throw new Error('Module not available');
      });

      const service = ConnectionPoolAlertService.getInstance();
      
      await service.initializeAlerts({
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      });

      // Should still provide basic alerting functionality
      const alerts = service.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);

      const stats = service.getAlertStats();
      expect(stats).toHaveProperty('totalAlerts');
      expect(stats).toHaveProperty('activeAlerts');
    });
  });
});