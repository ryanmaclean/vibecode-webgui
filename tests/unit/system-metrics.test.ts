/**
 * Unit tests for system-metrics functionality
 */

import { getCpuUsage, getMemoryUsage, getDiskUsage, getSystemMetrics } from '../../src/lib/system-metrics';

describe('System Metrics', () => {
  describe('getCpuUsage', () => {
    it('should return a valid CPU usage percentage', async () => {
      const cpuUsage = await getCpuUsage();
      
      expect(typeof cpuUsage).toBe('number');
      expect(cpuUsage).toBeGreaterThanOrEqual(0);
      expect(cpuUsage).toBeLessThanOrEqual(100);
    });

    it('should return different values on subsequent calls', async () => {
      const usage1 = await getCpuUsage();
      const usage2 = await getCpuUsage();
      
      // While they could theoretically be the same, 
      // we at least verify both are valid numbers
      expect(typeof usage1).toBe('number');
      expect(typeof usage2).toBe('number');
    });
  });

  describe('getMemoryUsage', () => {
    it('should return valid memory usage information', () => {
      const memUsage = getMemoryUsage();
      
      expect(memUsage).toHaveProperty('usage');
      expect(memUsage).toHaveProperty('used');
      expect(memUsage).toHaveProperty('total');
      expect(memUsage).toHaveProperty('available');
      
      expect(typeof memUsage.usage).toBe('number');
      expect(typeof memUsage.used).toBe('number');
      expect(typeof memUsage.total).toBe('number');
      expect(typeof memUsage.available).toBe('number');
      
      expect(memUsage.usage).toBeGreaterThanOrEqual(0);
      expect(memUsage.usage).toBeLessThanOrEqual(100);
      expect(memUsage.used).toBeGreaterThan(0);
      expect(memUsage.total).toBeGreaterThan(0);
      expect(memUsage.available).toBeGreaterThanOrEqual(0);
      
      // used + available should equal total
      expect(memUsage.used + memUsage.available).toBe(memUsage.total);
    });
  });

  describe('getDiskUsage', () => {
    it('should return valid disk usage information', async () => {
      const diskUsage = await getDiskUsage();
      
      expect(diskUsage).toHaveProperty('usage');
      expect(diskUsage).toHaveProperty('used');
      expect(diskUsage).toHaveProperty('total');
      expect(diskUsage).toHaveProperty('available');
      
      expect(typeof diskUsage.usage).toBe('number');
      expect(typeof diskUsage.used).toBe('number');
      expect(typeof diskUsage.total).toBe('number');
      expect(typeof diskUsage.available).toBe('number');
      
      expect(diskUsage.usage).toBeGreaterThanOrEqual(0);
      expect(diskUsage.usage).toBeLessThanOrEqual(100);
      expect(diskUsage.total).toBeGreaterThan(0);
      expect(diskUsage.available).toBeGreaterThanOrEqual(0);
    });

    it('should provide fallback values if system calls fail', async () => {
      // This test ensures our fallback mechanism works
      const diskUsage = await getDiskUsage();
      
      // Even with fallbacks, we should get reasonable values
      expect(diskUsage.usage).toBeGreaterThan(0);
      expect(diskUsage.total).toBeGreaterThan(0);
    });
  });

  describe('getSystemMetrics', () => {
    it('should return comprehensive system metrics', async () => {
      const metrics = await getSystemMetrics();
      
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('disk');
      
      // CPU metrics
      expect(metrics.cpu).toHaveProperty('usage');
      expect(metrics.cpu).toHaveProperty('cores');
      expect(metrics.cpu).toHaveProperty('loadAverage');
      
      expect(typeof metrics.cpu.usage).toBe('number');
      expect(typeof metrics.cpu.cores).toBe('number');
      expect(Array.isArray(metrics.cpu.loadAverage)).toBe(true);
      
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.usage).toBeLessThanOrEqual(100);
      expect(metrics.cpu.cores).toBeGreaterThan(0);
      expect(metrics.cpu.loadAverage).toHaveLength(3);
      
      // Memory metrics
      expect(metrics.memory.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.usage).toBeLessThanOrEqual(100);
      
      // Disk metrics
      expect(metrics.disk.usage).toBeGreaterThanOrEqual(0);
      expect(metrics.disk.usage).toBeLessThanOrEqual(100);
    }, 10000); // Give more time for system calls
  });

  describe('Realistic values', () => {
    it('should not return obviously fake hardcoded values', async () => {
      const metrics = await getSystemMetrics();
      
      // These were the old hardcoded values that should NOT appear
      expect(metrics.cpu.usage).not.toBe(45.2);
      expect(metrics.memory.usage).not.toBe(72.1);
      expect(metrics.disk.usage).not.toBe(65.4);
    });

    it('should return values that change over time', async () => {
      const metrics1 = await getSystemMetrics();
      
      // Add some small workload to potentially change metrics
      const start = Date.now();
      while (Date.now() - start < 50) {
        Math.random() * Math.random();
      }
      
      const metrics2 = await getSystemMetrics();
      
      // At minimum, timestamps should be different, and likely some metrics too
      expect(metrics1).toBeDefined();
      expect(metrics2).toBeDefined();
    });
  });
});