/**
 * Rollback Manager for AKS and Azure Functions Deployments
 * 
 * Provides automated rollback capabilities for both deployment types
 * with health checks, validation, and recovery procedures.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface DeploymentState {
  type: 'aks' | 'azure-functions';
  environment: string;
  version: string;
  timestamp: string;
  healthEndpoint: string;
  rollbackCommand: string[];
  validationChecks: string[];
}

interface RollbackResult {
  success: boolean;
  environment: string;
  previousVersion?: string;
  currentVersion?: string;
  duration: number;
  errors: string[];
  logs: string[];
}

export class RollbackManager {
  private deploymentStates: Map<string, DeploymentState[]> = new Map();
  private maxHistorySize = 10;
  private stateFile: string;

  constructor() {
    this.stateFile = path.join(process.cwd(), 'tests', 'performance', 'deployment-states.json');
    this.loadDeploymentStates();
  }

  /**
   * Load deployment states from persistent storage
   */
  private async loadDeploymentStates(): Promise<void> {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      const states = JSON.parse(data);
      this.deploymentStates = new Map(Object.entries(states));
    } catch (error) {
      console.log('No existing deployment states found. Starting fresh.');
      this.deploymentStates = new Map();
    }
  }

  /**
   * Save deployment states to persistent storage
   */
  private async saveDeploymentStates(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
      const states = Object.fromEntries(this.deploymentStates);
      await fs.writeFile(this.stateFile, JSON.stringify(states, null, 2));
    } catch (error) {
      console.error('Failed to save deployment states:', error);
    }
  }

  /**
   * Record a successful deployment state
   */
  async recordDeploymentState(
    environment: string,
    type: 'aks' | 'azure-functions',
    version: string,
    healthEndpoint: string
  ): Promise<void> {
    const state: DeploymentState = {
      type,
      environment,
      version,
      timestamp: new Date().toISOString(),
      healthEndpoint,
      rollbackCommand: this.getRollbackCommand(type, environment),
      validationChecks: this.getValidationChecks(type, environment)
    };

    const envStates = this.deploymentStates.get(environment) || [];
    envStates.unshift(state); // Add to beginning (most recent first)
    
    // Keep only the last N deployments
    if (envStates.length > this.maxHistorySize) {
      envStates.splice(this.maxHistorySize);
    }
    
    this.deploymentStates.set(environment, envStates);
    await this.saveDeploymentStates();
    
    console.log(`✅ Recorded deployment state for ${environment}: ${version}`);
  }

  /**
   * Get rollback command for deployment type
   */
  private getRollbackCommand(type: 'aks' | 'azure-functions', environment: string): string[] {
    switch (type) {
      case 'aks':
        return [
          'kubectl',
          'rollout',
          'undo',
          'deployment/vibecode-webgui',
          `-n=${environment}`
        ];
      
      case 'azure-functions':
        return [
          'az',
          'functionapp',
          'deployment',
          'source',
          'config-zip',
          '--name',
          'vibecode-docs-search',
          '--resource-group',
          'vibecode-docs-rg',
          '--src',
          './azure-functions/previous-deployment.zip'
        ];
      
      default:
        throw new Error(`Unknown deployment type: ${type}`);
    }
  }

  /**
   * Get validation checks for deployment type
   */
  private getValidationChecks(type: 'aks' | 'azure-functions', environment: string): string[] {
    switch (type) {
      case 'aks':
        return [
          `kubectl get pods -n ${environment}`,
          `kubectl rollout status deployment/vibecode-webgui -n ${environment}`,
          'curl -f http://localhost:3000/api/health'
        ];
      
      case 'azure-functions':
        return [
          'az functionapp show --name vibecode-docs-search --resource-group vibecode-docs-rg',
          'curl -f https://vibecode-docs-search.azurewebsites.net/api/health'
        ];
      
      default:
        return [];
    }
  }

  /**
   * Check if deployment is healthy
   */
  async checkDeploymentHealth(environment: string): Promise<boolean> {
    const states = this.deploymentStates.get(environment);
    if (!states || states.length === 0) {
      console.log(`No deployment states found for ${environment}`);
      return false;
    }

    const currentState = states[0];
    
    try {
      console.log(`🔍 Checking health of ${environment}...`);
      
      // HTTP health check
      const response = await axios.get(currentState.healthEndpoint, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      const isHealthy = response.status === 200;
      console.log(`Health check: ${isHealthy ? '✅' : '❌'} (${response.status})`);
      
      if (!isHealthy) {
        return false;
      }

      // Run additional validation checks
      for (const check of currentState.validationChecks) {
        try {
          await execAsync(check);
          console.log(`✅ Validation passed: ${check}`);
        } catch (error) {
          console.log(`❌ Validation failed: ${check} - ${error.message}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.log(`❌ Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Perform rollback to previous version
   */
  async rollbackDeployment(environment: string): Promise<RollbackResult> {
    const startTime = Date.now();
    const result: RollbackResult = {
      success: false,
      environment,
      duration: 0,
      errors: [],
      logs: []
    };

    try {
      const states = this.deploymentStates.get(environment);
      if (!states || states.length < 2) {
        throw new Error(`No previous deployment found for rollback in ${environment}`);
      }

      const currentState = states[0];
      const previousState = states[1];
      
      result.currentVersion = currentState.version;
      result.previousVersion = previousState.version;
      
      console.log(`🔄 Rolling back ${environment} from ${currentState.version} to ${previousState.version}...`);
      
      // Execute rollback command
      const rollbackCommand = currentState.rollbackCommand;
      result.logs.push(`Executing: ${rollbackCommand.join(' ')}`);
      
      const { stdout, stderr } = await execAsync(rollbackCommand.join(' '));
      result.logs.push(`STDOUT: ${stdout}`);
      if (stderr) {
        result.logs.push(`STDERR: ${stderr}`);
      }

      // Wait for rollback to complete
      console.log('⏳ Waiting for rollback to complete...');
      await this.waitForRollbackCompletion(currentState, 300); // 5 minute timeout

      // Validate rollback success
      const isHealthy = await this.checkDeploymentHealth(environment);
      if (!isHealthy) {
        throw new Error('Rollback completed but health checks failed');
      }

      // Update deployment states (remove failed deployment)
      states.shift(); // Remove the failed deployment
      this.deploymentStates.set(environment, states);
      await this.saveDeploymentStates();

      result.success = true;
      console.log(`✅ Rollback completed successfully for ${environment}`);

    } catch (error) {
      result.errors.push(error.message);
      console.log(`❌ Rollback failed for ${environment}: ${error.message}`);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Wait for rollback to complete with timeout
   */
  private async waitForRollbackCompletion(state: DeploymentState, timeoutSeconds: number): Promise<void> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        if (state.type === 'aks') {
          // Check rollout status
          const { stdout } = await execAsync(
            `kubectl rollout status deployment/vibecode-webgui -n ${state.environment} --timeout=30s`
          );
          
          if (stdout.includes('successfully rolled out')) {
            return;
          }
        } else if (state.type === 'azure-functions') {
          // Check function app status
          const { stdout } = await execAsync(
            'az functionapp show --name vibecode-docs-search --resource-group vibecode-docs-rg --query "state" -o tsv'
          );
          
          if (stdout.trim() === 'Running') {
            return;
          }
        }
      } catch (error) {
        console.log(`Waiting for rollback completion... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }

    throw new Error(`Rollback did not complete within ${timeoutSeconds} seconds`);
  }

  /**
   * Create deployment backup for Azure Functions
   */
  async createFunctionAppBackup(environment: string): Promise<void> {
    try {
      console.log(`📦 Creating backup for ${environment}...`);
      
      const backupDir = path.join(process.cwd(), 'azure-functions', 'backups');
      await fs.mkdir(backupDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `backup-${timestamp}.zip`);
      
      // Create deployment package
      await execAsync(`cd azure-functions && zip -r "${backupPath}" . -x "node_modules/*" "dist/*" "*.log"`);
      
      console.log(`✅ Backup created: ${backupPath}`);
    } catch (error) {
      console.error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Test rollback procedures without actually rolling back
   */
  async testRollbackProcedures(): Promise<{ [environment: string]: boolean }> {
    console.log('🧪 Testing rollback procedures...');
    
    const results: { [environment: string]: boolean } = {};
    
    for (const [environment, states] of this.deploymentStates) {
      if (states.length < 2) {
        console.log(`⚠️ ${environment}: Not enough deployment history for rollback test`);
        results[environment] = false;
        continue;
      }

      const currentState = states[0];
      
      try {
        console.log(`Testing rollback readiness for ${environment}...`);
        
        // Test command availability
        const rollbackCommand = currentState.rollbackCommand[0];
        await execAsync(`which ${rollbackCommand}`);
        
        // Test permissions (dry run)
        if (currentState.type === 'aks') {
          await execAsync(`kubectl auth can-i update deployments -n ${environment}`);
        } else if (currentState.type === 'azure-functions') {
          await execAsync('az account show');
        }
        
        console.log(`✅ ${environment}: Rollback procedures ready`);
        results[environment] = true;
      } catch (error) {
        console.log(`❌ ${environment}: Rollback procedures not ready - ${error.message}`);
        results[environment] = false;
      }
    }
    
    return results;
  }

  /**
   * Get deployment history for environment
   */
  getDeploymentHistory(environment: string): DeploymentState[] {
    return this.deploymentStates.get(environment) || [];
  }

  /**
   * Monitor deployments and auto-rollback on failure
   */
  async startHealthMonitoring(
    environments: string[],
    checkIntervalSeconds: number = 60,
    autoRollback: boolean = false
  ): Promise<void> {
    console.log(`🔍 Starting health monitoring for: ${environments.join(', ')}`);
    console.log(`Check interval: ${checkIntervalSeconds}s, Auto-rollback: ${autoRollback}`);
    
    const monitoringLoop = async () => {
      for (const environment of environments) {
        const isHealthy = await this.checkDeploymentHealth(environment);
        
        if (!isHealthy && autoRollback) {
          console.log(`🚨 ${environment} is unhealthy. Initiating auto-rollback...`);
          const rollbackResult = await this.rollbackDeployment(environment);
          
          if (rollbackResult.success) {
            console.log(`✅ Auto-rollback successful for ${environment}`);
          } else {
            console.log(`❌ Auto-rollback failed for ${environment}: ${rollbackResult.errors.join(', ')}`);
          }
        }
      }
    };

    // Run initial check
    await monitoringLoop();
    
    // Set up recurring checks
    setInterval(monitoringLoop, checkIntervalSeconds * 1000);
  }

  /**
   * Generate rollback readiness report
   */
  generateRollbackReport(): string {
    const report = ['ROLLBACK READINESS REPORT', '='.repeat(50), ''];
    
    for (const [environment, states] of this.deploymentStates) {
      report.push(`Environment: ${environment}`);
      report.push(`Type: ${states[0]?.type || 'unknown'}`);
      report.push(`Current Version: ${states[0]?.version || 'unknown'}`);
      report.push(`Deployment History: ${states.length} versions`);
      report.push(`Rollback Available: ${states.length >= 2 ? 'YES' : 'NO'}`);
      
      if (states.length >= 2) {
        report.push(`Previous Version: ${states[1].version}`);
        report.push(`Rollback Command: ${states[0].rollbackCommand.join(' ')}`);
      }
      
      report.push('');
    }
    
    return report.join('\n');
  }
}

export default RollbackManager;
