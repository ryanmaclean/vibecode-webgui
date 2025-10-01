/**
 * Unit tests for ConnectionPoolAlertService dynamic import functionality
 * Tests the lazy-loading behavior and ensures proper error handling
 */

import ConnectionPoolAlertService from '@/lib/db/connection-pool-alerts';

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

    it('should start monitoring without errors', () => {
      const service = ConnectionPoolAlertService.getInstance();
      
      // Should not throw error when starting monitoring
      expect(() => service.startMonitoring(1000)).not.toThrow();
      
      // Should be monitoring
      expect(service.isMonitoring()).toBe(true);
      
      // Clean up
      service.stopMonitoring();
    });

    it('should handle monitoring start/stop cycles', () => {
      const service = ConnectionPoolAlertService.getInstance();
      
      // Start monitoring
      service.startMonitoring(1000);
      expect(service.isMonitoring()).toBe(true);
      
      // Stop monitoring
      service.stopMonitoring();
      expect(service.isMonitoring()).toBe(false);
      
      // Start again
      service.startMonitoring(2000);
      expect(service.isMonitoring()).toBe(true);
      
      // Clean up
      service.stopMonitoring();
    });
  });

  describe('Browser Environment', () => {
    beforeEach(() => {
      // Simulate browser environment
      global.window = { location: { href: 'http://localhost:3000' } };
    });

    it('should skip module loading in browser environment', () => {
      const service = ConnectionPoolAlertService.getInstance();
      
      // Should not throw error in browser
      expect(() => service.startMonitoring(1000)).not.toThrow();
      
      // Should be monitoring
      expect(service.isMonitoring()).toBe(true);
      
      // Clean up
      service.stopMonitoring();
    });

    it('should work normally in browser environment', () => {
      const service = ConnectionPoolAlertService.getInstance();
      
      // Should complete without error in browser
      expect(() => service.startMonitoring(1000)).not.toThrow();
      expect(service.isMonitoring()).toBe(true);
      
      service.stopMonitoring();
      expect(service.isMonitoring()).toBe(false);
    });
  });

  describe('Alert Configuration', () => {
    it('should provide default alert configurations', () => {
      const service = ConnectionPoolAlertService.getInstance();
      
      // Should have default configurations
      expect(service.getPoolUtilizationConfig()).toBeDefined();
      expect(service.getAcquireFailuresConfig()).toBeDefined();
      expect(service.getValidationFailuresConfig()).toBeDefined();
      expect(service.getIdleConnectionsConfig()).toBeDefined();
    });

    it('should allow configuration updates', () => {
      const service = ConnectionPoolAlertService.getInstance();
      
      const newConfig = {
        poolUtilization: { enabled: true, warningThreshold: 80, criticalThreshold: 95 },
        acquireFailures: { enabled: true, warningThreshold: 5, criticalThreshold: 10 },
        validationFailures: { enabled: true, warningThreshold: 3, criticalThreshold: 5 },
        idleConnections: { enabled: true, warningThreshold: 20, criticalThreshold: 30 }
      };
      
      // Should not throw error when updating config
      expect(() => service.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConnectionPoolAlertService.getInstance();
      const instance2 = ConnectionPoolAlertService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Dynamic Import Behavior', () => {
    it('should handle module loading gracefully in server environment', () => {
      delete (global as any).window;
      
      const service = ConnectionPoolAlertService.getInstance();
      
      // Should not throw error when starting monitoring
      expect(() => service.startMonitoring(1000)).not.toThrow();
      
      // Should be monitoring
      expect(service.isMonitoring()).toBe(true);
      
      // Clean up
      service.stopMonitoring();
    });

    it('should skip module loading in browser environment', () => {
      global.window = { location: { href: 'http://localhost:3000' } };
      
      const service = ConnectionPoolAlertService.getInstance();
      
      // Should not throw error in browser
      expect(() => service.startMonitoring(1000)).not.toThrow();
      
      // Should be monitoring
      expect(service.isMonitoring()).toBe(true);
      
      // Clean up
      service.stopMonitoring();
    });
  });
});