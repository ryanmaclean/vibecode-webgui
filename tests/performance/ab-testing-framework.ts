/**
 * A/B Testing Framework for AKS vs Azure Functions Performance Comparison
 * 
 * This framework allows testing both deployment methods simultaneously
 * with proper rollback capabilities and comprehensive metrics collection.
 */

import { performance } from 'perf_hooks';
import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TestEnvironment {
  name: string;
  type: 'aks' | 'azure-functions';
  baseUrl: string;
  healthEndpoint: string;
  searchEndpoint: string;
  isActive: boolean;
  deploymentVersion: string;
}

interface PerformanceMetrics {
  responseTime: number;
  statusCode: number;
  contentLength: number;
  timestamp: number;
  error?: string;
}

interface TestResult {
  environment: string;
  testName: string;
  metrics: PerformanceMetrics;
  success: boolean;
  duration: number;
}

interface ComparisonReport {
  timestamp: string;
  environments: TestEnvironment[];
  testResults: TestResult[];
  summary: {
    aks: {
      avgResponseTime: number;
      successRate: number;
      totalRequests: number;
    };
    azureFunctions: {
      avgResponseTime: number;
      successRate: number;
      totalRequests: number;
      coldStartCount: number;
    };
  };
  recommendation: string;
}

export class ABTestingFramework {
  private environments: TestEnvironment[] = [];
  private testResults: TestResult[] = [];
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'tests', 'performance', 'results');
    this.initializeEnvironments();
  }

  private initializeEnvironments(): void {
    this.environments = [
      {
        name: 'dev-aks',
        type: 'aks',
        baseUrl: process.env.AKS_BASE_URL || 'http://localhost:3000',
        healthEndpoint: '/api/health',
        searchEndpoint: '/api/docs/search',
        isActive: true,
        deploymentVersion: process.env.AKS_VERSION || 'current'
      },
      {
        name: 'staging-functions',
        type: 'azure-functions',
        baseUrl: process.env.FUNCTIONS_BASE_URL || 'https://vibecode-docs-search.azurewebsites.net',
        healthEndpoint: '/api/health',
        searchEndpoint: '/api/docs/search',
        isActive: true,
        deploymentVersion: process.env.FUNCTIONS_VERSION || 'current'
      }
    ];
  }

  /**
   * Validate that both environments are healthy before testing
   */
  async validateEnvironments(): Promise<boolean> {
    console.log('🔍 Validating test environments...');
    
    const validationPromises = this.environments.map(async (env) => {
      try {
        const startTime = performance.now();
        const response = await axios.get(`${env.baseUrl}${env.healthEndpoint}`, {
          timeout: 10000,
          validateStatus: (status) => status < 500
        });
        const responseTime = performance.now() - startTime;

        const isHealthy = response.status === 200;
        console.log(`${env.name} (${env.type}): ${isHealthy ? '✅' : '❌'} - ${responseTime.toFixed(2)}ms`);
        
        env.isActive = isHealthy;
        return isHealthy;
      } catch (error) {
        console.log(`${env.name} (${env.type}): ❌ - ${error.message}`);
        env.isActive = false;
        return false;
      }
    });

    const results = await Promise.all(validationPromises);
    const allHealthy = results.every(result => result);
    
    if (!allHealthy) {
      console.log('⚠️ Some environments are not healthy. Proceeding with available environments.');
    }

    return results.some(result => result); // At least one environment should be healthy
  }

  /**
   * Run performance test against a specific environment
   */
  private async runPerformanceTest(
    env: TestEnvironment,
    testName: string,
    testFunction: (baseUrl: string) => Promise<AxiosResponse>
  ): Promise<TestResult> {
    const startTime = performance.now();
    
    try {
      const response = await testFunction(env.baseUrl);
      const endTime = performance.now();
      
      const metrics: PerformanceMetrics = {
        responseTime: endTime - startTime,
        statusCode: response.status,
        contentLength: JSON.stringify(response.data).length,
        timestamp: Date.now()
      };

      return {
        environment: env.name,
        testName,
        metrics,
        success: response.status >= 200 && response.status < 300,
        duration: endTime - startTime
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        environment: env.name,
        testName,
        metrics: {
          responseTime: endTime - startTime,
          statusCode: error.response?.status || 0,
          contentLength: 0,
          timestamp: Date.now(),
          error: error.message
        },
        success: false,
        duration: endTime - startTime
      };
    }
  }

  /**
   * Test basic search functionality
   */
  async testBasicSearch(): Promise<void> {
    console.log('🔍 Testing basic search functionality...');
    
    const testQueries = [
      'deployment',
      'kubernetes',
      'testing',
      'AI integration',
      'security'
    ];

    for (const query of testQueries) {
      const testPromises = this.environments
        .filter(env => env.isActive)
        .map(async (env) => {
          return this.runPerformanceTest(
            env,
            `basic-search-${query}`,
            async (baseUrl) => {
              return axios.get(`${baseUrl}${env.searchEndpoint}`, {
                params: { q: query, limit: 10 },
                timeout: 15000
              });
            }
          );
        });

      const results = await Promise.all(testPromises);
      this.testResults.push(...results);
      
      // Log immediate results
      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${result.environment}: ${status} ${result.duration.toFixed(2)}ms - "${query}"`);
      });
    }
  }

  /**
   * Test cold start performance (mainly for Azure Functions)
   */
  async testColdStartPerformance(): Promise<void> {
    console.log('🧊 Testing cold start performance...');
    
    // Wait to ensure functions are cold
    console.log('⏳ Waiting 5 minutes for functions to go cold...');
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    
    const coldStartPromises = this.environments
      .filter(env => env.isActive)
      .map(async (env) => {
        return this.runPerformanceTest(
          env,
          'cold-start-search',
          async (baseUrl) => {
            return axios.get(`${baseUrl}${env.searchEndpoint}`, {
              params: { q: 'deployment', limit: 5 },
              timeout: 30000 // Longer timeout for cold starts
            });
          }
        );
      });

    const results = await Promise.all(coldStartPromises);
    this.testResults.push(...results);
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const isColdStart = result.duration > 2000 ? '🧊' : '🔥';
      console.log(`  ${result.environment}: ${status} ${isColdStart} ${result.duration.toFixed(2)}ms (cold start)`);
    });
  }

  /**
   * Test concurrent load handling
   */
  async testConcurrentLoad(): Promise<void> {
    console.log('⚡ Testing concurrent load handling...');
    
    const concurrentRequests = 10;
    const queries = Array(concurrentRequests).fill(0).map((_, i) => `test query ${i + 1}`);
    
    for (const env of this.environments.filter(e => e.isActive)) {
      console.log(`  Testing ${env.name} with ${concurrentRequests} concurrent requests...`);
      
      const concurrentPromises = queries.map(async (query, index) => {
        return this.runPerformanceTest(
          env,
          `concurrent-load-${index + 1}`,
          async (baseUrl) => {
            return axios.get(`${baseUrl}${env.searchEndpoint}`, {
              params: { q: query, limit: 5 },
              timeout: 20000
            });
          }
        );
      });

      const results = await Promise.all(concurrentPromises);
      this.testResults.push(...results);
      
      const avgResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const successRate = results.filter(r => r.success).length / results.length * 100;
      
      console.log(`    Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`    Success rate: ${successRate.toFixed(1)}%`);
    }
  }

  /**
   * Generate comprehensive comparison report
   */
  generateReport(): ComparisonReport {
    const now = new Date().toISOString();
    
    // Calculate metrics for each environment type
    const aksResults = this.testResults.filter(r => 
      this.environments.find(e => e.name === r.environment)?.type === 'aks'
    );
    
    const functionsResults = this.testResults.filter(r => 
      this.environments.find(e => e.name === r.environment)?.type === 'azure-functions'
    );

    const aksMetrics = this.calculateMetrics(aksResults);
    const functionsMetrics = this.calculateMetrics(functionsResults);
    
    // Determine recommendation
    let recommendation = 'Unable to determine - insufficient data';
    
    if (aksMetrics.totalRequests > 0 && functionsMetrics.totalRequests > 0) {
      const aksCost = 650; // Monthly cost estimate
      const functionsCost = 50; // Monthly cost estimate
      
      const aksScore = (aksMetrics.successRate * 0.4) + 
                      (1000 / Math.max(aksMetrics.avgResponseTime, 1) * 0.4) +
                      (1000 / aksCost * 0.2);
                      
      const functionsScore = (functionsMetrics.successRate * 0.4) + 
                            (1000 / Math.max(functionsMetrics.avgResponseTime, 1) * 0.4) +
                            (1000 / functionsCost * 0.2);
      
      if (functionsScore > aksScore * 1.1) {
        recommendation = 'Azure Functions recommended - Better cost/performance ratio';
      } else if (aksScore > functionsScore * 1.1) {
        recommendation = 'AKS recommended - Better performance for consistent workloads';
      } else {
        recommendation = 'Both options viable - Choose based on operational preferences';
      }
    }

    return {
      timestamp: now,
      environments: this.environments,
      testResults: this.testResults,
      summary: {
        aks: aksMetrics,
        azureFunctions: {
          ...functionsMetrics,
          coldStartCount: functionsResults.filter(r => r.duration > 2000).length
        }
      },
      recommendation
    };
  }

  private calculateMetrics(results: TestResult[]) {
    if (results.length === 0) {
      return {
        avgResponseTime: 0,
        successRate: 0,
        totalRequests: 0
      };
    }

    const successfulResults = results.filter(r => r.success);
    const avgResponseTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successRate = (successfulResults.length / results.length) * 100;

    return {
      avgResponseTime,
      successRate,
      totalRequests: results.length
    };
  }

  /**
   * Save test results to file
   */
  async saveResults(report: ComparisonReport): Promise<string> {
    await fs.mkdir(this.outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ab-test-report-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    // Also save a summary CSV
    const csvFilename = `ab-test-summary-${timestamp}.csv`;
    const csvFilepath = path.join(this.outputDir, csvFilename);
    const csvContent = this.generateCSVSummary(report);
    await fs.writeFile(csvFilepath, csvContent);
    
    console.log(`📊 Results saved to: ${filepath}`);
    console.log(`📈 CSV summary saved to: ${csvFilepath}`);
    
    return filepath;
  }

  private generateCSVSummary(report: ComparisonReport): string {
    const headers = [
      'Environment',
      'Type',
      'Test Name',
      'Success',
      'Response Time (ms)',
      'Status Code',
      'Content Length',
      'Error'
    ];

    const rows = report.testResults.map(result => [
      result.environment,
      this.environments.find(e => e.name === result.environment)?.type || 'unknown',
      result.testName,
      result.success ? 'true' : 'false',
      result.duration.toFixed(2),
      result.metrics.statusCode.toString(),
      result.metrics.contentLength.toString(),
      result.metrics.error || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Print summary to console
   */
  printSummary(report: ComparisonReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 A/B TESTING RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`\n🕒 Test completed at: ${report.timestamp}`);
    
    console.log('\n📈 PERFORMANCE COMPARISON:');
    console.log('┌─────────────────────┬─────────────┬─────────────────┬─────────────────┐');
    console.log('│ Metric              │ AKS (Dev)   │ Functions (Stg) │ Winner          │');
    console.log('├─────────────────────┼─────────────┼─────────────────┼─────────────────┤');
    
    const aks = report.summary.aks;
    const funcs = report.summary.azureFunctions;
    
    const responseWinner = aks.avgResponseTime < funcs.avgResponseTime ? 'AKS' : 'Functions';
    const reliabilityWinner = aks.successRate > funcs.successRate ? 'AKS' : 'Functions';
    
    console.log(`│ Avg Response Time   │ ${aks.avgResponseTime.toFixed(0).padStart(8)}ms │ ${funcs.avgResponseTime.toFixed(0).padStart(12)}ms │ ${responseWinner.padEnd(15)} │`);
    console.log(`│ Success Rate        │ ${aks.successRate.toFixed(1).padStart(9)}% │ ${funcs.successRate.toFixed(1).padStart(13)}% │ ${reliabilityWinner.padEnd(15)} │`);
    console.log(`│ Total Requests      │ ${aks.totalRequests.toString().padStart(11)} │ ${funcs.totalRequests.toString().padStart(15)} │ -               │`);
    console.log(`│ Cold Starts         │ N/A         │ ${funcs.coldStartCount.toString().padStart(15)} │ AKS (none)      │`);
    console.log('└─────────────────────┴─────────────┴─────────────────┴─────────────────┘');
    
    console.log('\n💰 COST COMPARISON:');
    console.log('• AKS (Dev): ~$650-1300/month (fixed costs)');
    console.log('• Azure Functions (Staging): ~$30-80/month (usage-based)');
    console.log('• Cost savings with Functions: 85-90%');
    
    console.log('\n🎯 RECOMMENDATION:');
    console.log(`${report.recommendation}`);
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Review detailed results in generated JSON/CSV files');
    console.log('2. Consider traffic patterns and cost requirements');
    console.log('3. Test rollback procedures for chosen deployment');
    console.log('4. Plan gradual migration strategy');
  }

  /**
   * Run complete A/B test suite
   */
  async runCompleteTest(): Promise<ComparisonReport> {
    console.log('🚀 Starting comprehensive A/B testing...\n');
    
    // Validate environments
    const isValid = await this.validateEnvironments();
    if (!isValid) {
      throw new Error('No healthy environments found for testing');
    }

    // Run test suites
    await this.testBasicSearch();
    await this.testColdStartPerformance();
    await this.testConcurrentLoad();
    
    // Generate and save report
    const report = this.generateReport();
    await this.saveResults(report);
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }
}

// Export for use in other test files
export default ABTestingFramework;
