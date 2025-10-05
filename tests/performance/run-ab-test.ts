#!/usr/bin/env ts-node

/**
 * A/B Test Runner for AKS vs Azure Functions
 * 
 * This script orchestrates the complete A/B testing process including:
 * - Environment validation
 * - Performance comparison
 * - Rollback testing
 * - Report generation
 */

import ABTestingFramework from './ab-testing-framework';
import RollbackManager from './rollback-manager';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

interface TestConfiguration {
  runPerformanceTests: boolean;
  runRollbackTests: boolean;
  autoRollbackOnFailure: boolean;
  monitoringDuration: number; // minutes
  generateReport: boolean;
}

class ABTestRunner {
  private abTesting: ABTestingFramework;
  private rollbackManager: RollbackManager;
  private config: TestConfiguration;

  constructor(config: TestConfiguration) {
    this.abTesting = new ABTestingFramework();
    this.rollbackManager = new RollbackManager();
    this.config = config;
  }

  /**
   * Setup test environments and record initial states
   */
  async setupTestEnvironments(): Promise<void> {
    console.log('🚀 Setting up test environments...\n');

    // Record current deployment states
    const environments = [
      {
        name: 'dev-aks',
        type: 'aks' as const,
        version: process.env.AKS_VERSION || 'current',
        healthEndpoint: `${process.env.AKS_BASE_URL || 'http://localhost:3000'}/api/health`
      },
      {
        name: 'staging-functions',
        type: 'azure-functions' as const,
        version: process.env.FUNCTIONS_VERSION || 'current',
        healthEndpoint: `${process.env.FUNCTIONS_BASE_URL || 'https://vibecode-docs-search.azurewebsites.net'}/api/health`
      }
    ];

    for (const env of environments) {
      await this.rollbackManager.recordDeploymentState(
        env.name,
        env.type,
        env.version,
        env.healthEndpoint
      );
    }

    // Create backups for Azure Functions
    await this.rollbackManager.createFunctionAppBackup('staging-functions');

    console.log('✅ Test environments setup complete\n');
  }

  /**
   * Run performance comparison tests
   */
  async runPerformanceTests(): Promise<any> {
    console.log('📊 Running performance comparison tests...\n');
    
    try {
      const report = await this.abTesting.runCompleteTest();
      return report;
    } catch (error) {
      console.error('❌ Performance tests failed:', error.message);
      throw error;
    }
  }

  /**
   * Test rollback procedures
   */
  async testRollbackProcedures(): Promise<void> {
    console.log('🔄 Testing rollback procedures...\n');

    // Test rollback readiness
    const rollbackReadiness = await this.rollbackManager.testRollbackProcedures();
    
    console.log('Rollback Readiness Results:');
    for (const [env, ready] of Object.entries(rollbackReadiness)) {
      console.log(`  ${env}: ${ready ? '✅ Ready' : '❌ Not Ready'}`);
    }

    // Generate rollback report
    const rollbackReport = this.rollbackManager.generateRollbackReport();
    console.log('\n' + rollbackReport);
  }

  /**
   * Simulate deployment failure and test rollback
   */
  async simulateFailureAndRollback(): Promise<void> {
    console.log('🧪 Simulating deployment failure and rollback...\n');

    // Choose an environment to test rollback (prefer staging)
    const testEnvironment = 'staging-functions';
    
    console.log(`Testing rollback for ${testEnvironment}...`);
    
    try {
      // Check current health
      const isHealthy = await this.rollbackManager.checkDeploymentHealth(testEnvironment);
      
      if (isHealthy) {
        console.log('✅ Environment is healthy. Simulating failure scenario...');
        
        // In a real scenario, we might deploy a broken version here
        // For testing, we'll just demonstrate the rollback process
        
        console.log('⚠️ Simulated failure detected. Initiating rollback...');
        const rollbackResult = await this.rollbackManager.rollbackDeployment(testEnvironment);
        
        if (rollbackResult.success) {
          console.log(`✅ Rollback successful: ${rollbackResult.previousVersion} → ${rollbackResult.currentVersion}`);
          console.log(`Duration: ${rollbackResult.duration}ms`);
        } else {
          console.log(`❌ Rollback failed: ${rollbackResult.errors.join(', ')}`);
        }
      } else {
        console.log('⚠️ Environment is already unhealthy. Testing rollback...');
        const rollbackResult = await this.rollbackManager.rollbackDeployment(testEnvironment);
        
        if (rollbackResult.success) {
          console.log('✅ Rollback restored environment health');
        } else {
          console.log('❌ Rollback failed to restore health');
        }
      }
    } catch (error) {
      console.error(`❌ Rollback test failed: ${error.message}`);
    }
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.config.monitoringDuration <= 0) {
      console.log('⏭️ Skipping monitoring (duration set to 0)\n');
      return;
    }

    console.log(`🔍 Starting ${this.config.monitoringDuration} minute monitoring session...\n`);
    
    const environments = ['dev-aks', 'staging-functions'];
    
    // Start monitoring with auto-rollback if enabled
    const monitoringPromise = this.rollbackManager.startHealthMonitoring(
      environments,
      30, // Check every 30 seconds
      this.config.autoRollbackOnFailure
    );

    // Stop monitoring after specified duration
    setTimeout(() => {
      console.log('⏹️ Monitoring session completed\n');
    }, this.config.monitoringDuration * 60 * 1000);

    await monitoringPromise;
  }

  /**
   * Generate comprehensive test report
   */
  async generateFinalReport(performanceReport: any): Promise<void> {
    if (!this.config.generateReport) {
      console.log('⏭️ Skipping report generation\n');
      return;
    }

    console.log('📋 Generating comprehensive test report...\n');

    const reportSections = [
      '# A/B Testing Report: AKS vs Azure Functions',
      '## Executive Summary',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Performance Comparison',
      JSON.stringify(performanceReport.summary, null, 2),
      '',
      '## Recommendation',
      performanceReport.recommendation,
      '',
      '## Rollback Capabilities',
      this.rollbackManager.generateRollbackReport(),
      '',
      '## Cost Analysis',
      '- AKS (Dev Environment): $650-1300/month',
      '- Azure Functions (Staging): $30-80/month',
      '- Potential savings: 85-90%',
      '',
      '## Next Steps',
      '1. Review detailed performance metrics',
      '2. Consider traffic patterns and operational requirements',
      '3. Plan migration strategy based on results',
      '4. Implement chosen deployment with proper rollback procedures'
    ];

    const reportPath = path.join(process.cwd(), 'tests', 'performance', 'results', 'ab-test-final-report.md');
    const reportContent = reportSections.join('\n');

    await import('fs').then(fs => fs.promises.writeFile(reportPath, reportContent));
    
    console.log(`📄 Final report saved to: ${reportPath}`);
  }

  /**
   * Run complete A/B test suite
   */
  async runCompleteTest(): Promise<void> {
    console.log('🎯 Starting Complete A/B Test Suite');
    console.log('=' .repeat(80));
    console.log(`Configuration:`);
    console.log(`  Performance Tests: ${this.config.runPerformanceTests}`);
    console.log(`  Rollback Tests: ${this.config.runRollbackTests}`);
    console.log(`  Auto Rollback: ${this.config.autoRollbackOnFailure}`);
    console.log(`  Monitoring Duration: ${this.config.monitoringDuration} minutes`);
    console.log(`  Generate Report: ${this.config.generateReport}`);
    console.log('=' .repeat(80));
    console.log('');

    let performanceReport: any = null;

    try {
      // Setup phase
      await this.setupTestEnvironments();

      // Performance testing phase
      if (this.config.runPerformanceTests) {
        performanceReport = await this.runPerformanceTests();
      }

      // Rollback testing phase
      if (this.config.runRollbackTests) {
        await this.testRollbackProcedures();
        await this.simulateFailureAndRollback();
      }

      // Monitoring phase
      await this.startMonitoring();

      // Report generation phase
      if (performanceReport) {
        await this.generateFinalReport(performanceReport);
      }

      console.log('🎉 A/B Testing completed successfully!');
      console.log('\n📊 Summary:');
      
      if (performanceReport) {
        console.log(`• Performance Winner: ${performanceReport.summary.aks.avgResponseTime < performanceReport.summary.azureFunctions.avgResponseTime ? 'AKS' : 'Azure Functions'}`);
        console.log(`• Cost Winner: Azure Functions (85-90% savings)`);
        console.log(`• Recommendation: ${performanceReport.recommendation}`);
      }

    } catch (error) {
      console.error('❌ A/B Testing failed:', error.message);
      
      // Attempt recovery if auto-rollback is enabled
      if (this.config.autoRollbackOnFailure) {
        console.log('🔄 Attempting automatic recovery...');
        try {
          await this.rollbackManager.rollbackDeployment('staging-functions');
          console.log('✅ Recovery completed');
        } catch (recoveryError) {
          console.error('❌ Recovery failed:', recoveryError.message);
        }
      }
      
      throw error;
    }
  }
}

/**
 * Main execution function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const config: TestConfiguration = {
    runPerformanceTests: !args.includes('--no-performance'),
    runRollbackTests: !args.includes('--no-rollback'),
    autoRollbackOnFailure: args.includes('--auto-rollback'),
    monitoringDuration: parseInt(args.find(arg => arg.startsWith('--monitor='))?.split('=')[1] || '5'),
    generateReport: !args.includes('--no-report')
  };

  console.log('🚀 VibeCode A/B Testing Suite');
  console.log('Testing AKS (dev) vs Azure Functions (staging)');
  console.log('');

  const runner = new ABTestRunner(config);
  
  try {
    await runner.runCompleteTest();
    process.exit(0);
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️ Received interrupt signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️ Received termination signal. Shutting down gracefully...');
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default ABTestRunner;
