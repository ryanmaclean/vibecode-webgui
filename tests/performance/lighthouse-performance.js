/**
 * Lighthouse Performance Testing
 * Automated performance audits for VibeCode web interface
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './performance-results';

// Performance budget thresholds
const PERFORMANCE_BUDGET = {
  'first-contentful-paint': 1800,
  'largest-contentful-paint': 2500,
  'first-meaningful-paint': 1600,
  'speed-index': 3000,
  'interactive': 5000,
  'total-blocking-time': 200,
  'cumulative-layout-shift': 0.1,
};

const PAGES_TO_TEST = [
  { name: 'homepage', url: '/', critical: true },
  { name: 'workspace', url: '/workspace', critical: true },
  { name: 'projects', url: '/projects', critical: false },
  { name: 'monitoring', url: '/monitoring', critical: false },
];

class PerformanceAuditor {
  constructor() {
    this.results = [];
    this.chrome = null;
  }

  async initialize() {
    console.log('🚀 Initializing Lighthouse performance auditor...');
    
    // Ensure output directory exists
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Launch Chrome
    this.chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
    });
    
    console.log(`✅ Chrome launched on port ${this.chrome.port}`);
  }

  async auditPage(page) {
    console.log(`📊 Auditing ${page.name} (${page.url})...`);
    
    const url = `${BASE_URL}${page.url}`;
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance'],
      port: this.chrome.port,
    };

    try {
      const runnerResult = await lighthouse(url, options);
      const { lhr } = runnerResult;
      
      const metrics = this.extractMetrics(lhr);
      const score = lhr.categories.performance.score * 100;
      
      const result = {
        page: page.name,
        url,
        critical: page.critical,
        score,
        metrics,
        passed: this.evaluatePerformance(metrics, score, page.critical),
        timestamp: new Date().toISOString(),
        details: lhr.audits
      };
      
      this.results.push(result);
      
      // Save detailed report
      const reportPath = path.join(OUTPUT_DIR, `lighthouse-${page.name}.json`);
      await fs.writeFile(reportPath, JSON.stringify(lhr, null, 2));
      
      console.log(`   Score: ${score}/100 ${result.passed ? '✅' : '❌'}`);
      this.logMetrics(metrics);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Failed to audit ${page.name}:`, error.message);
      return {
        page: page.name,
        url,
        critical: page.critical,
        error: error.message,
        passed: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  extractMetrics(lhr) {
    const audits = lhr.audits;
    return {
      'first-contentful-paint': audits['first-contentful-paint']?.numericValue || 0,
      'largest-contentful-paint': audits['largest-contentful-paint']?.numericValue || 0,
      'first-meaningful-paint': audits['first-meaningful-paint']?.numericValue || 0,
      'speed-index': audits['speed-index']?.numericValue || 0,
      'interactive': audits['interactive']?.numericValue || 0,
      'total-blocking-time': audits['total-blocking-time']?.numericValue || 0,
      'cumulative-layout-shift': audits['cumulative-layout-shift']?.numericValue || 0,
    };
  }

  evaluatePerformance(metrics, score, isCritical) {
    const minScore = isCritical ? 80 : 70;
    
    if (score < minScore) {
      return false;
    }
    
    // Check individual metrics against budget
    for (const [metric, threshold] of Object.entries(PERFORMANCE_BUDGET)) {
      const value = metrics[metric];
      if (value > threshold) {
        console.log(`   ⚠️  ${metric}: ${value}ms (budget: ${threshold}ms)`);
        if (isCritical) {
          return false;
        }
      }
    }
    
    return true;
  }

  logMetrics(metrics) {
    console.log('   Metrics:');
    Object.entries(metrics).forEach(([key, value]) => {
      const unit = key === 'cumulative-layout-shift' ? '' : 'ms';
      const budget = PERFORMANCE_BUDGET[key];
      const status = value <= budget ? '✅' : '⚠️ ';
      console.log(`     ${status} ${key}: ${value}${unit} (budget: ${budget}${unit})`);
    });
  }

  async generateSummaryReport() {
    const summary = {
      timestamp: new Date().toISOString(),
      total_pages: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
      average_score: this.calculateAverageScore(),
      critical_pages_status: this.evaluateCriticalPages(),
      results: this.results.map(r => ({
        page: r.page,
        score: r.score,
        passed: r.passed,
        critical: r.critical,
        error: r.error
      }))
    };

    const summaryPath = path.join(OUTPUT_DIR, 'lighthouse-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    
    return summary;
  }

  calculateAverageScore() {
    const scores = this.results.filter(r => r.score).map(r => r.score);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  evaluateCriticalPages() {
    const criticalPages = this.results.filter(r => r.critical);
    const passedCritical = criticalPages.filter(r => r.passed).length;
    
    return {
      total: criticalPages.length,
      passed: passedCritical,
      all_passed: passedCritical === criticalPages.length
    };
  }

  async cleanup() {
    if (this.chrome) {
      await this.chrome.kill();
      console.log('🧹 Chrome instance cleaned up');
    }
  }
}

async function runPerformanceAudit() {
  const auditor = new PerformanceAuditor();
  
  try {
    await auditor.initialize();
    
    console.log(`📋 Testing ${PAGES_TO_TEST.length} pages against ${BASE_URL}...`);
    
    for (const page of PAGES_TO_TEST) {
      await auditor.auditPage(page);
      // Small delay between audits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const summary = await auditor.generateSummaryReport();
    
    console.log('\n📈 Performance Audit Summary:');
    console.log(`   Pages tested: ${summary.total_pages}`);
    console.log(`   Passed: ${summary.passed} ✅`);
    console.log(`   Failed: ${summary.failed} ❌`);
    console.log(`   Average score: ${summary.average_score.toFixed(1)}/100`);
    console.log(`   Critical pages: ${summary.critical_pages_status.passed}/${summary.critical_pages_status.total} passed`);
    
    // Exit with error if critical pages failed
    if (!summary.critical_pages_status.all_passed) {
      console.log('\n❌ Critical pages failed performance requirements!');
      process.exit(1);
    }
    
    if (summary.average_score < 75) {
      console.log('\n⚠️  Average performance score below threshold (75)');
      process.exit(1);
    }
    
    console.log('\n✅ All performance requirements met!');
    
  } catch (error) {
    console.error('💥 Performance audit failed:', error);
    process.exit(1);
  } finally {
    await auditor.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  runPerformanceAudit().catch(console.error);
}

module.exports = { PerformanceAuditor, runPerformanceAudit };