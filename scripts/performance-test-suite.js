#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * VibeCode Performance Testing Suite
 * Comprehensive testing of Tauri vs Electron with Lighthouse, RUM, and CFP metrics
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Initialize log aggregation
const logAggregation = new LogAggregation();


class PerformanceTester {
  constructor() {
    this.results = {
      tauri: {},
      electron: {},
      comparison: {}
    };
    this.startTime = Date.now();
  }

  async runTests() {
    console.log('🚀 Starting VibeCode Performance Testing Suite');
    console.log('=' .repeat(60));

    try {
      // 1. Test Tauri (WebKit)
      console.log('\n📱 Testing Tauri (WebKit Engine)');
      await this.testTauri();

      // 2. Test Electron (Chromium)
      console.log('\n⚡ Testing Electron (Chromium Engine)');
      await this.testElectron();

      // 3. Run Lighthouse CI
      console.log('\n🔍 Running Lighthouse Performance Tests');
      await this.runLighthouse();

      // 4. Generate comparison report
      console.log('\n📊 Generating Performance Comparison Report');
      await this.generateReport();

      console.log('\n✅ Performance testing complete!');
      console.log(`Total time: ${(Date.now() - this.startTime) / 1000}s`);

    } catch (error) {
      console.error('❌ Performance testing failed:', error);
      process.exit(1);
    }
  }

  async testTauri() {
    console.log('  Starting Tauri app...');
    
    // Start Tauri app
    const tauriProcess = spawn('npm', ['run', 'tauri:dev'], {
      stdio: 'pipe',
      env: { ...process.env, DD_RUM_ENABLED: 'true' }
    });

    // Wait for Tauri to start
    await this.waitForService('http://localhost:8080', 30000);

    console.log('  Tauri app started, running performance tests...');

    // Run performance tests
    this.results.tauri = await this.runPerformanceTests('http://localhost:8080', 'Tauri-WebKit');

    // Stop Tauri
    tauriProcess.kill();
    console.log('  Tauri app stopped');
  }

  async testElectron() {
    console.log('  Starting Electron app...');
    
    // Start Electron app
    const electronProcess = spawn('npm', ['run', 'electron:dev'], {
      stdio: 'pipe',
      env: { ...process.env, DD_RUM_ENABLED: 'true' }
    });

    // Wait for Electron to start
    await this.waitForService('http://localhost:3000', 30000);

    console.log('  Electron app started, running performance tests...');

    // Run performance tests
    this.results.electron = await this.runPerformanceTests('http://localhost:3000', 'Electron-Chromium');

    // Stop Electron
    electronProcess.kill();
    console.log('  Electron app stopped');
  }

  async runPerformanceTests(url, engine) {
    const results = {
      engine,
      url,
      timestamp: new Date().toISOString(),
      metrics: {}
    };

    // 1. Basic Performance Metrics
    console.log(`    Running basic performance tests for ${engine}...`);
    results.metrics.basic = await this.getBasicMetrics(url);

    // 2. Contentful First Paint
    console.log(`    Measuring Contentful First Paint for ${engine}...`);
    results.metrics.cfp = await this.measureContentfulFirstPaint(url);

    // 3. JavaScript Performance
    console.log(`    Testing JavaScript performance for ${engine}...`);
    results.metrics.js = await this.testJavaScriptPerformance(url);

    // 4. DOM Performance
    console.log(`    Testing DOM performance for ${engine}...`);
    results.metrics.dom = await this.testDOMPerformance(url);

    // 5. Memory Usage
    console.log(`    Measuring memory usage for ${engine}...`);
    results.metrics.memory = await this.measureMemoryUsage(url);

    return results;
  }

  async getBasicMetrics(url) {
    return new Promise((resolve) => {
      exec(`curl -w "@curl-format.txt" -o /dev/null -s "${url}"`, (error, stdout) => {
        if (error) {
          resolve({ error: error.message });
          return;
        }
        
        const metrics = {};
        stdout.split('\n').forEach(line => {
          const [key, value] = line.split(': ');
          if (key && value) {
            metrics[key.trim()] = parseFloat(value) || value.trim();
          }
        });
        
        resolve(metrics);
      });
    });
  }

  async measureContentfulFirstPaint(url) {
    // Use Puppeteer to measure CFP
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Enable performance metrics
    await page.evaluateOnNewDocument(() => {
      window.performance.mark('page-start');
    });

    await page.goto(url, { waitUntil: 'networkidle0' });

    // Measure CFP
    const cfp = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const cfpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      return cfpEntry ? cfpEntry.startTime : null;
    });

    await browser.close();

    return {
      contentfulFirstPaint: cfp,
      timestamp: new Date().toISOString()
    };
  }

  async testJavaScriptPerformance(url) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });

    // Run JavaScript benchmarks
    const jsResults = await page.evaluate(() => {
      const results = {};

      // Test 1: Array operations
      const start = performance.now();
      const arr = new Array(100000).fill(0).map((_, i) => i);
      arr.sort((a, b) => b - a);
      results.arrayOperations = performance.now() - start;

      // Test 2: Object operations
      const start2 = performance.now();
      const obj = {};
      for (let i = 0; i < 10000; i++) {
        obj[`key${i}`] = Math.random();
      }
      const values = Object.values(obj);
      results.objectOperations = performance.now() - start2;

      // Test 3: String operations
      const start3 = performance.now();
      let str = '';
      for (let i = 0; i < 10000; i++) {
        str += `test${i}`;
      }
      results.stringOperations = performance.now() - start3;

      // Test 4: Math operations
      const start4 = performance.now();
      let sum = 0;
      for (let i = 0; i < 1000000; i++) {
        sum += Math.sqrt(i);
      }
      results.mathOperations = performance.now() - start4;

      return results;
    });

    await browser.close();
    return jsResults;
  }

  async testDOMPerformance(url) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });

    const domResults = await page.evaluate(() => {
      const results = {};

      // Test 1: DOM creation
      const start = performance.now();
      const container = document.createElement('div');
      for (let i = 0; i < 1000; i++) {
        const div = document.createElement('div');
        div.textContent = `Element ${i}`;
        container.appendChild(div);
      }
      results.domCreation = performance.now() - start;

      // Test 2: DOM querying
      const start2 = performance.now();
      const elements = container.querySelectorAll('div');
      results.domQuerying = performance.now() - start2;

      // Test 3: DOM manipulation
      const start3 = performance.now();
      elements.forEach(el => {
        el.style.color = 'red';
        el.classList.add('test-class');
      });
      results.domManipulation = performance.now() - start3;

      return results;
    });

    await browser.close();
    return domResults;
  }

  async measureMemoryUsage(url) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0' });

    const memoryInfo = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
      return { error: 'Memory API not available' };
    });

    await browser.close();
    return memoryInfo;
  }

  async runLighthouse() {
    return new Promise((resolve, reject) => {
      exec('npx lhci autorun', (error, stdout, stderr) => {
        if (error) {
          console.log('Lighthouse CI output:', stdout);
          console.log('Lighthouse CI errors:', stderr);
          reject(error);
          return;
        }
        console.log('Lighthouse CI completed:', stdout);
        resolve(stdout);
      });
    });
  }

  async waitForService(url, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Service not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Service at ${url} did not start within ${timeout}ms`);
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      detailed: this.results,
      recommendations: this.generateRecommendations()
    };

    // Save report
    await fs.writeFile(
      'performance-report.json',
      JSON.stringify(report, null, 2)
    );

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    await fs.writeFile('PERFORMANCE_REPORT.md', markdownReport);

    console.log('\n📊 Performance Report Generated:');
    console.log('  - performance-report.json');
    console.log('  - PERFORMANCE_REPORT.md');
  }

  generateSummary() {
    const summary = {
      winner: 'Unknown',
      keyMetrics: {},
      performanceGap: {}
    };

    if (this.results.tauri.metrics && this.results.electron.metrics) {
      // Compare key metrics
      const tauri = this.results.tauri.metrics;
      const electron = this.results.electron.metrics;

      // JavaScript Performance
      if (tauri.js && electron.js) {
        summary.keyMetrics.jsPerformance = {
          tauri: tauri.js.arrayOperations + tauri.js.objectOperations,
          electron: electron.js.arrayOperations + electron.js.objectOperations
        };
      }

      // Contentful First Paint
      if (tauri.cfp && electron.cfp) {
        summary.keyMetrics.contentfulFirstPaint = {
          tauri: tauri.cfp.contentfulFirstPaint,
          electron: electron.cfp.contentfulFirstPaint
        };
      }

      // Memory Usage
      if (tauri.memory && electron.memory) {
        summary.keyMetrics.memoryUsage = {
          tauri: tauri.memory.usedJSHeapSize,
          electron: electron.memory.usedJSHeapSize
        };
      }

      // Determine winner
      const tauriScore = this.calculateScore(tauri);
      const electronScore = this.calculateScore(electron);
      
      summary.winner = tauriScore > electronScore ? 'Tauri (WebKit)' : 'Electron (Chromium)';
      summary.performanceGap = Math.abs(tauriScore - electronScore);
    }

    return summary;
  }

  calculateScore(metrics) {
    let score = 0;
    
    // Lower is better for most metrics
    if (metrics.cfp?.contentfulFirstPaint) {
      score += 1000 / metrics.cfp.contentfulFirstPaint; // Higher score for faster CFP
    }
    
    if (metrics.js) {
      const jsTotal = metrics.js.arrayOperations + metrics.js.objectOperations + 
                     metrics.js.stringOperations + metrics.js.mathOperations;
      score += 1000 / jsTotal; // Higher score for faster JS
    }
    
    if (metrics.memory?.usedJSHeapSize) {
      score += 1000000 / metrics.memory.usedJSHeapSize; // Higher score for less memory
    }
    
    return score;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.results.tauri.metrics && this.results.electron.metrics) {
      const tauri = this.results.tauri.metrics;
      const electron = this.results.electron.metrics;

      // JavaScript Performance
      if (tauri.js && electron.js) {
        const tauriJS = tauri.js.arrayOperations + tauri.js.objectOperations;
        const electronJS = electron.js.arrayOperations + electron.js.objectOperations;
        
        if (electronJS < tauriJS) {
          recommendations.push({
            category: 'JavaScript Performance',
            recommendation: 'Electron (Chromium/V8) shows better JavaScript performance',
            impact: 'High',
            details: `Electron: ${electronJS.toFixed(2)}ms vs Tauri: ${tauriJS.toFixed(2)}ms`
          });
        }
      }

      // Contentful First Paint
      if (tauri.cfp && electron.cfp) {
        if (electron.cfp.contentfulFirstPaint < tauri.cfp.contentfulFirstPaint) {
          recommendations.push({
            category: 'Rendering Performance',
            recommendation: 'Electron shows faster Contentful First Paint',
            impact: 'High',
            details: `Electron: ${electron.cfp.contentfulFirstPaint.toFixed(2)}ms vs Tauri: ${tauri.cfp.contentfulFirstPaint.toFixed(2)}ms`
          });
        }
      }

      // Memory Usage
      if (tauri.memory && electron.memory) {
        if (tauri.memory.usedJSHeapSize < electron.memory.usedJSHeapSize) {
          recommendations.push({
            category: 'Memory Efficiency',
            recommendation: 'Tauri shows better memory efficiency',
            impact: 'Medium',
            details: `Tauri: ${(tauri.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB vs Electron: ${(electron.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`
          });
        }
      }
    }

    return recommendations;
  }

  generateMarkdownReport(report) {
    return `# VibeCode Performance Testing Report

Generated: ${report.timestamp}

## 🏆 Winner: ${report.summary.winner}

## 📊 Key Metrics Comparison

### JavaScript Performance
- **Tauri (WebKit)**: ${report.summary.keyMetrics.jsPerformance?.tauri?.toFixed(2) || 'N/A'}ms
- **Electron (Chromium)**: ${report.summary.keyMetrics.jsPerformance?.electron?.toFixed(2) || 'N/A'}ms

### Contentful First Paint
- **Tauri (WebKit)**: ${report.summary.keyMetrics.contentfulFirstPaint?.tauri?.toFixed(2) || 'N/A'}ms
- **Electron (Chromium)**: ${report.summary.keyMetrics.contentfulFirstPaint?.electron?.toFixed(2) || 'N/A'}ms

### Memory Usage
- **Tauri (WebKit)**: ${report.summary.keyMetrics.memoryUsage?.tauri ? (report.summary.keyMetrics.memoryUsage.tauri / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}
- **Electron (Chromium)**: ${report.summary.keyMetrics.memoryUsage?.electron ? (report.summary.keyMetrics.memoryUsage.electron / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}

## 🎯 Recommendations

${report.recommendations.map(rec => 
  `### ${rec.category}
- **Impact**: ${rec.impact}
- **Recommendation**: ${rec.recommendation}
- **Details**: ${rec.details}
`).join('\n')}

## 📈 Detailed Results

See \`performance-report.json\` for complete detailed metrics.

---
*Generated by VibeCode Performance Testing Suite*
`;
  }
}

// Run the tests
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runTests().catch(console.error);
}

module.exports = PerformanceTester;
