#!/usr/bin/env node
/**
 * Performance Budget Enforcement Script
 * 
 * Validates performance metrics against defined budgets
 * Used in CI/CD to enforce performance standards
 */

const fs = require('fs');
const path = require('path');

class PerformanceBudgetEnforcer {
  constructor(budgetFile = './performance-budget.json') {
    this.budget = JSON.parse(fs.readFileSync(budgetFile, 'utf8'));
    this.violations = [];
    this.warnings = [];
  }

  /**
   * Check build time against budget
   */
  checkBuildTime(actualTime) {
    const budget = this.budget.budgets.build.time;
    if (actualTime > budget) {
      this.violations.push({
        type: 'build_time',
        budget: budget,
        actual: actualTime,
        difference: actualTime - budget,
        message: `Build time ${actualTime}ms exceeds budget of ${budget}ms`
      });
      return false;
    }
    return true;
  }

  /**
   * Check bundle sizes against budget
   */
  checkBundleSize(bundleStats) {
    const budgets = this.budget.budgets.bundle;
    let passed = true;

    if (bundleStats.totalSize > budgets.totalSize) {
      this.violations.push({
        type: 'bundle_total_size',
        budget: budgets.totalSize,
        actual: bundleStats.totalSize,
        difference: bundleStats.totalSize - budgets.totalSize,
        message: `Total bundle size ${this.formatBytes(bundleStats.totalSize)} exceeds budget of ${this.formatBytes(budgets.totalSize)}`
      });
      passed = false;
    }

    if (bundleStats.maxJsChunkSize > budgets.jsChunkSize) {
      this.violations.push({
        type: 'bundle_js_chunk',
        budget: budgets.jsChunkSize,
        actual: bundleStats.maxJsChunkSize,
        difference: bundleStats.maxJsChunkSize - budgets.jsChunkSize,
        message: `Largest JS chunk ${this.formatBytes(bundleStats.maxJsChunkSize)} exceeds budget of ${this.formatBytes(budgets.jsChunkSize)}`
      });
      passed = false;
    }

    return passed;
  }

  /**
   * Check API response times against budget
   */
  checkAPIResponseTimes(metrics) {
    const budgets = this.budget.budgets.api.responseTime;
    let passed = true;

    if (metrics.p50 > budgets.p50) {
      this.violations.push({
        type: 'api_p50',
        budget: budgets.p50,
        actual: metrics.p50,
        difference: metrics.p50 - budgets.p50,
        message: `API p50 response time ${metrics.p50}ms exceeds budget of ${budgets.p50}ms`
      });
      passed = false;
    }

    if (metrics.p95 > budgets.p95) {
      this.violations.push({
        type: 'api_p95',
        budget: budgets.p95,
        actual: metrics.p95,
        difference: metrics.p95 - budgets.p95,
        message: `API p95 response time ${metrics.p95}ms exceeds budget of ${budgets.p95}ms`
      });
      passed = false;
    }

    return passed;
  }

  /**
   * Check Lighthouse scores against budget
   */
  checkLighthouseScores(scores) {
    const budgets = this.budget.budgets.lighthouse;
    let passed = true;

    Object.keys(budgets).forEach(key => {
      if (key === 'description') return;
      
      if (scores[key] < budgets[key]) {
        this.violations.push({
          type: `lighthouse_${key}`,
          budget: budgets[key],
          actual: scores[key],
          difference: budgets[key] - scores[key],
          message: `Lighthouse ${key} score ${scores[key]} is below budget of ${budgets[key]}`
        });
        passed = false;
      }
    });

    return passed;
  }

  /**
   * Check Core Web Vitals against budget
   */
  checkWebVitals(vitals) {
    const budgets = this.budget.budgets.webVitals;
    let passed = true;

    Object.keys(budgets).forEach(key => {
      if (key === 'description') return;
      
      if (vitals[key] > budgets[key]) {
        this.violations.push({
          type: `web_vital_${key}`,
          budget: budgets[key],
          actual: vitals[key],
          difference: vitals[key] - budgets[key],
          message: `Core Web Vital ${key.toUpperCase()} ${vitals[key]}ms exceeds budget of ${budgets[key]}ms`
        });
        passed = false;
      }
    });

    return passed;
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    return {
      passed: this.violations.length === 0,
      violationCount: this.violations.length,
      warningCount: this.warnings.length,
      violations: this.violations,
      warnings: this.warnings,
      summary: this.generateSummary()
    };
  }

  /**
   * Generate summary message
   */
  generateSummary() {
    if (this.violations.length === 0) {
      return '✅ All performance budgets met!';
    }

    let summary = `❌ ${this.violations.length} performance budget violation(s):\n\n`;
    
    this.violations.forEach((v, i) => {
      summary += `${i + 1}. ${v.message}\n`;
    });

    if (this.warnings.length > 0) {
      summary += `\n⚠️  ${this.warnings.length} warning(s):\n`;
      this.warnings.forEach((w, i) => {
        summary += `${i + 1}. ${w.message}\n`;
      });
    }

    return summary;
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  /**
   * Save report to file
   */
  saveReport(outputPath) {
    const report = this.generateReport();
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    return report;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const metricsFile = args[0];
  const outputFile = args[1] || './performance-budget-report.json';

  if (!metricsFile) {
    console.error('Usage: node enforce-performance-budget.js <metrics-file> [output-file]');
    process.exit(1);
  }

  try {
    const enforcer = new PerformanceBudgetEnforcer();
    const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));

    // Check all metrics
    if (metrics.buildTime) {
      enforcer.checkBuildTime(metrics.buildTime);
    }
    if (metrics.bundleStats) {
      enforcer.checkBundleSize(metrics.bundleStats);
    }
    if (metrics.apiMetrics) {
      enforcer.checkAPIResponseTimes(metrics.apiMetrics);
    }
    if (metrics.lighthouseScores) {
      enforcer.checkLighthouseScores(metrics.lighthouseScores);
    }
    if (metrics.webVitals) {
      enforcer.checkWebVitals(metrics.webVitals);
    }

    const report = enforcer.saveReport(outputFile);
    
    console.log('\n' + report.summary);
    console.log(`\nFull report saved to: ${outputFile}`);

    if (!report.passed) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Error enforcing performance budget:', error.message);
    process.exit(1);
  }
}

module.exports = { PerformanceBudgetEnforcer };
