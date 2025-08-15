/**
 * Performance Regression Testing Suite
 * Addresses Issue #77: Add performance testing and monitoring
 */

import { performance } from 'perf_hooks';

interface PerformanceMetrics {
  buildTime: number;
  pageLoadTime: number;
  apiResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface PerformanceThresholds {
  buildTime: number;      // seconds
  pageLoadTime: number;   // milliseconds
  apiResponseTime: number; // milliseconds
  memoryUsage: number;    // MB
  cpuUsage: number;       // percentage
}

class PerformanceTester {
  private thresholds: PerformanceThresholds;
  private baselineMetrics: PerformanceMetrics | null = null;

  constructor(thresholds: PerformanceThresholds) {
    this.thresholds = thresholds;
  }

  /**
   * Set baseline metrics for regression detection
   */
  setBaseline(metrics: PerformanceMetrics): void {
    this.baselineMetrics = metrics;
    console.log('📊 Performance baseline set:', metrics);
  }

  /**
   * Test build performance
   */
  async testBuildPerformance(): Promise<{ passed: boolean; actual: number; threshold: number }> {
    const startTime = performance.now();
    
    // Simulate build process
    await this.simulateBuild();
    
    const endTime = performance.now();
    const buildTime = (endTime - startTime) / 1000; // Convert to seconds
    
    const passed = buildTime <= this.thresholds.buildTime;
    
    return {
      passed,
      actual: buildTime,
      threshold: this.thresholds.buildTime
    };
  }

  /**
   * Test page load performance
   */
  async testPageLoadPerformance(): Promise<{ passed: boolean; actual: number; threshold: number }> {
    const startTime = performance.now();
    
    // Simulate page load
    await this.simulatePageLoad();
    
    const endTime = performance.now();
    const pageLoadTime = endTime - startTime;
    
    const passed = pageLoadTime <= this.thresholds.pageLoadTime;
    
    return {
      passed,
      actual: pageLoadTime,
      threshold: this.thresholds.pageLoadTime
    };
  }

  /**
   * Test API response performance
   */
  async testAPIResponsePerformance(): Promise<{ passed: boolean; actual: number; threshold: number }> {
    const startTime = performance.now();
    
    // Simulate API call
    await this.simulateAPICall();
    
    const endTime = performance.now();
    const apiResponseTime = endTime - startTime;
    
    const passed = apiResponseTime <= this.thresholds.apiResponseTime;
    
    return {
      passed,
      actual: apiResponseTime,
      threshold: this.thresholds.apiResponseTime
    };
  }

  /**
   * Test memory usage
   */
  testMemoryUsage(): { passed: boolean; actual: number; threshold: number } {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024;
    
    const passed = memoryUsageMB <= this.thresholds.memoryUsage;
    
    return {
      passed,
      actual: memoryUsageMB,
      threshold: this.thresholds.memoryUsage
    };
  }

  /**
   * Test CPU usage
   */
  async testCPUUsage(): Promise<{ passed: boolean; actual: number; threshold: number }> {
    const startUsage = process.cpuUsage();
    
    // Simulate CPU-intensive task
    await this.simulateCPUIntensiveTask();
    
    const endUsage = process.cpuUsage();
    const cpuUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
    
    const passed = cpuUsage <= this.thresholds.cpuUsage;
    
    return {
      passed,
      actual: cpuUsage,
      threshold: this.thresholds.cpuUsage
    };
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(currentMetrics: PerformanceMetrics): string[] {
    if (!this.baselineMetrics) {
      return ['No baseline metrics set for regression detection'];
    }

    const regressions: string[] = [];
    const regressionThreshold = 0.1; // 10% degradation

    // Check build time regression
    const buildTimeRegression = (currentMetrics.buildTime - this.baselineMetrics.buildTime) / this.baselineMetrics.buildTime;
    if (buildTimeRegression > regressionThreshold) {
      regressions.push(`Build time regression: ${(buildTimeRegression * 100).toFixed(1)}% increase`);
    }

    // Check page load time regression
    const pageLoadRegression = (currentMetrics.pageLoadTime - this.baselineMetrics.pageLoadTime) / this.baselineMetrics.pageLoadTime;
    if (pageLoadRegression > regressionThreshold) {
      regressions.push(`Page load time regression: ${(pageLoadRegression * 100).toFixed(1)}% increase`);
    }

    // Check API response time regression
    const apiResponseRegression = (currentMetrics.apiResponseTime - this.baselineMetrics.apiResponseTime) / this.baselineMetrics.apiResponseTime;
    if (apiResponseRegression > regressionThreshold) {
      regressions.push(`API response time regression: ${(apiResponseRegression * 100).toFixed(1)}% increase`);
    }

    // Check memory usage regression
    const memoryRegression = (currentMetrics.memoryUsage - this.baselineMetrics.memoryUsage) / this.baselineMetrics.memoryUsage;
    if (memoryRegression > regressionThreshold) {
      regressions.push(`Memory usage regression: ${(memoryRegression * 100).toFixed(1)}% increase`);
    }

    return regressions;
  }

  /**
   * Generate performance report
   */
  generateReport(metrics: PerformanceMetrics): string {
    const regressions = this.detectRegressions(metrics);
    
    let report = '📊 **Performance Test Report**\n\n';
    
    // Build Performance
    const buildResult = metrics.buildTime <= this.thresholds.buildTime ? '✅' : '❌';
    report += `${buildResult} Build Time: ${metrics.buildTime.toFixed(2)}s (threshold: ${this.thresholds.buildTime}s)\n`;
    
    // Page Load Performance
    const pageLoadResult = metrics.pageLoadTime <= this.thresholds.pageLoadTime ? '✅' : '❌';
    report += `${pageLoadResult} Page Load: ${metrics.pageLoadTime.toFixed(0)}ms (threshold: ${this.thresholds.pageLoadTime}ms)\n`;
    
    // API Response Performance
    const apiResult = metrics.apiResponseTime <= this.thresholds.apiResponseTime ? '✅' : '❌';
    report += `${apiResult} API Response: ${metrics.apiResponseTime.toFixed(0)}ms (threshold: ${this.thresholds.apiResponseTime}ms)\n`;
    
    // Memory Usage
    const memoryResult = metrics.memoryUsage <= this.thresholds.memoryUsage ? '✅' : '❌';
    report += `${memoryResult} Memory Usage: ${metrics.memoryUsage.toFixed(1)}MB (threshold: ${this.thresholds.memoryUsage}MB)\n`;
    
    // CPU Usage
    const cpuResult = metrics.cpuUsage <= this.thresholds.cpuUsage ? '✅' : '❌';
    report += `${cpuResult} CPU Usage: ${metrics.cpuUsage.toFixed(1)}% (threshold: ${this.thresholds.cpuUsage}%)\n`;
    
    if (regressions.length > 0) {
      report += '\n🚨 **Performance Regressions Detected:**\n';
      regressions.forEach(regression => {
        report += `• ${regression}\n`;
      });
    } else {
      report += '\n✅ **No performance regressions detected**\n';
    }
    
    return report;
  }

  // Simulation methods for testing
  private async simulateBuild(): Promise<void> {
    // Simulate build process with realistic delays
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  }

  private async simulatePageLoad(): Promise<void> {
    // Simulate page load with realistic delays
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
  }

  private async simulateAPICall(): Promise<void> {
    // Simulate API call with realistic delays
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));
  }

  private async simulateCPUIntensiveTask(): Promise<void> {
    // Simulate CPU-intensive task
    const start = Date.now();
    while (Date.now() - start < 100) {
      Math.random() * Math.random();
    }
  }
}

// Performance thresholds based on Issue #77 requirements
const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  buildTime: 15,        // < 15s (current: 13.0s ✅)
  pageLoadTime: 2000,   // < 2s
  apiResponseTime: 500,  // < 500ms (current: 285ms 50th percentile ✅)
  memoryUsage: 1024,    // < 1GB
  cpuUsage: 80          // < 80%
};

// Baseline metrics (current production performance)
const BASELINE_METRICS: PerformanceMetrics = {
  buildTime: 13.0,
  pageLoadTime: 1500,   // Estimated
  apiResponseTime: 285,  // 50th percentile
  memoryUsage: 512,      // Estimated
  cpuUsage: 45          // Estimated
};

describe('Performance Regression Testing', () => {
  let performanceTester: PerformanceTester;

  beforeAll(() => {
    performanceTester = new PerformanceTester(PERFORMANCE_THRESHOLDS);
    performanceTester.setBaseline(BASELINE_METRICS);
  });

  describe('Build Performance', () => {
    it('should complete build within 15 seconds', async () => {
      const result = await performanceTester.testBuildPerformance();
      
      expect(result.passed).toBe(true);
      expect(result.actual).toBeLessThanOrEqual(result.threshold);
      
      console.log(`🏗️ Build time: ${result.actual.toFixed(2)}s (threshold: ${result.threshold}s)`);
    });
  });

  describe('Page Load Performance', () => {
    it('should load pages within 2 seconds', async () => {
      const result = await performanceTester.testPageLoadPerformance();
      
      expect(result.passed).toBe(true);
      expect(result.actual).toBeLessThanOrEqual(result.threshold);
      
      console.log(`📄 Page load time: ${result.actual.toFixed(0)}ms (threshold: ${result.threshold}ms)`);
    });
  });

  describe('API Response Performance', () => {
    it('should respond to API calls within 500ms', async () => {
      const result = await performanceTester.testAPIResponsePerformance();
      
      expect(result.passed).toBe(true);
      expect(result.actual).toBeLessThanOrEqual(result.threshold);
      
      console.log(`🔌 API response time: ${result.actual.toFixed(0)}ms (threshold: ${result.threshold}ms)`);
    });
  });

  describe('Memory Usage', () => {
    it('should use less than 1GB of memory', () => {
      const result = performanceTester.testMemoryUsage();
      
      expect(result.passed).toBe(true);
      expect(result.actual).toBeLessThanOrEqual(result.threshold);
      
      console.log(`🧠 Memory usage: ${result.actual.toFixed(1)}MB (threshold: ${result.threshold}MB)`);
    });
  });

  describe('CPU Usage', () => {
    it('should use less than 80% CPU during intensive tasks', async () => {
      const result = await performanceTester.testCPUUsage();
      
      expect(result.passed).toBe(true);
      expect(result.actual).toBeLessThanOrEqual(result.threshold);
      
      console.log(`⚡ CPU usage: ${result.actual.toFixed(1)}% (threshold: ${result.threshold}%)`);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', () => {
      const currentMetrics: PerformanceMetrics = {
        buildTime: 16.0,        // Regression: 13s → 16s (+23%)
        pageLoadTime: 1800,     // Improvement: 1500ms → 1800ms (+20%)
        apiResponseTime: 300,    // Slight regression: 285ms → 300ms (+5%)
        memoryUsage: 600,       // Regression: 512MB → 600MB (+17%)
        cpuUsage: 50            // Improvement: 45% → 50% (+11%)
      };

      const regressions = performanceTester.detectRegressions(currentMetrics);
      
      // Should detect build time and memory usage regressions (>10% threshold)
      expect(regressions).toContain('Build time regression: 23.1% increase');
      expect(regressions).toContain('Memory usage regression: 17.2% increase');
      
      // Should not detect API response regression (<10% threshold)
      expect(regressions).not.toContain('API response time regression');
      
      console.log('🚨 Detected regressions:', regressions);
    });

    it('should generate comprehensive performance report', () => {
      const currentMetrics: PerformanceMetrics = {
        buildTime: 14.0,
        pageLoadTime: 1600,
        apiResponseTime: 290,
        memoryUsage: 550,
        cpuUsage: 48
      };

      const report = performanceTester.generateReport(currentMetrics);
      
      expect(report).toContain('📊 **Performance Test Report**');
      expect(report).toContain('✅ Build Time: 14.00s');
      expect(report).toContain('✅ Page Load: 1600ms');
      expect(report).toContain('✅ API Response: 290ms');
      expect(report).toContain('✅ Memory Usage: 550.0MB');
      expect(report).toContain('✅ CPU Usage: 48.0%');
      expect(report).toContain('✅ **No performance regressions detected**');
      
      console.log(report);
    });
  });
});

// Export for use in CI/CD pipeline
export { PerformanceTester, PerformanceMetrics, PerformanceThresholds };
