/**
 * Environment Permission Manager
 * Manages environment-aware permissions and integrates with HITL for approvals
 *
 * @module lib/environment/permissions
 */

import type {
  EnvironmentType,
  PermissionAction,
  PermissionDecision,
  PermissionRule,
  EnvironmentPermissions,
  PermissionConfig,
  PermissionCheckResult,
  OperationMetadata,
  OperationRiskLevel,
} from './types';

import type { ApprovalRequest, HITLManager } from '@/lib/workflow/hitl-manager';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default permission configuration for development environment
 */
const DEFAULT_DEVELOPMENT_PERMISSIONS: EnvironmentPermissions = {
  environment: 'development',
  rules: [
    { action: 'read_file', decision: 'allowed' },
    { action: 'write_file', decision: 'allowed' },
    { action: 'delete_file', decision: 'allowed', riskThreshold: 'medium' },
    { action: 'execute_command', decision: 'allowed' },
    { action: 'database_read', decision: 'allowed' },
    { action: 'database_write', decision: 'allowed' },
    { action: 'network_request', decision: 'allowed' },
    { action: 'system_config', decision: 'requires_approval', riskThreshold: 'high' },
    { action: 'deploy', decision: 'denied' },
  ],
  defaultDecision: 'allowed',
  enabled: true,
  approvers: [],
};

/**
 * Default permission configuration for staging environment
 */
const DEFAULT_STAGING_PERMISSIONS: EnvironmentPermissions = {
  environment: 'staging',
  rules: [
    { action: 'read_file', decision: 'allowed' },
    { action: 'write_file', decision: 'requires_approval', riskThreshold: 'medium' },
    { action: 'delete_file', decision: 'requires_approval', riskThreshold: 'low' },
    { action: 'execute_command', decision: 'requires_approval', riskThreshold: 'medium' },
    { action: 'database_read', decision: 'allowed' },
    { action: 'database_write', decision: 'requires_approval', riskThreshold: 'low' },
    { action: 'network_request', decision: 'allowed' },
    { action: 'system_config', decision: 'requires_approval', riskThreshold: 'low' },
    { action: 'deploy', decision: 'requires_approval', riskThreshold: 'medium' },
  ],
  defaultDecision: 'requires_approval',
  enabled: true,
  approvers: [],
};

/**
 * Default permission configuration for production environment
 */
const DEFAULT_PRODUCTION_PERMISSIONS: EnvironmentPermissions = {
  environment: 'production',
  rules: [
    { action: 'read_file', decision: 'allowed' },
    { action: 'write_file', decision: 'requires_approval', riskThreshold: 'low' },
    { action: 'delete_file', decision: 'requires_approval', riskThreshold: 'low' },
    { action: 'execute_command', decision: 'requires_approval', riskThreshold: 'low' },
    { action: 'database_read', decision: 'allowed' },
    { action: 'database_write', decision: 'requires_approval', riskThreshold: 'low' },
    { action: 'network_request', decision: 'requires_approval', riskThreshold: 'medium' },
    { action: 'system_config', decision: 'requires_approval', riskThreshold: 'low' },
    { action: 'deploy', decision: 'requires_approval', riskThreshold: 'low' },
  ],
  defaultDecision: 'requires_approval',
  enabled: true,
  approvers: [],
};

/**
 * Default permission configuration for test environment
 */
const DEFAULT_TEST_PERMISSIONS: EnvironmentPermissions = {
  environment: 'test',
  rules: [
    { action: 'read_file', decision: 'allowed' },
    { action: 'write_file', decision: 'allowed' },
    { action: 'delete_file', decision: 'allowed' },
    { action: 'execute_command', decision: 'allowed' },
    { action: 'database_read', decision: 'allowed' },
    { action: 'database_write', decision: 'allowed' },
    { action: 'network_request', decision: 'allowed' },
    { action: 'system_config', decision: 'allowed' },
    { action: 'deploy', decision: 'denied' },
  ],
  defaultDecision: 'allowed',
  enabled: false, // Typically disabled in test to allow fast execution
  approvers: [],
};

/**
 * Default permission configuration
 */
const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  environments: {
    development: DEFAULT_DEVELOPMENT_PERMISSIONS,
    staging: DEFAULT_STAGING_PERMISSIONS,
    production: DEFAULT_PRODUCTION_PERMISSIONS,
    test: DEFAULT_TEST_PERMISSIONS,
  },
  global: {
    enabled: true,
    unknownEnvironmentDefault: 'denied',
    logChecks: true,
  },
};

// ============================================================================
// Risk Level Utilities
// ============================================================================

/**
 * Compare risk levels (higher value = higher risk)
 */
const RISK_LEVEL_VALUES: Record<OperationRiskLevel, number> = {
  safe: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Check if operation risk meets or exceeds threshold
 */
function meetsRiskThreshold(
  operationRisk: OperationRiskLevel,
  threshold: OperationRiskLevel
): boolean {
  return RISK_LEVEL_VALUES[operationRisk] >= RISK_LEVEL_VALUES[threshold];
}

// ============================================================================
// Permission Manager Class
// ============================================================================

/**
 * Permission change observer callback
 */
export type PermissionObserver = (event: {
  type: 'config_changed' | 'check_performed' | 'approval_requested';
  data: unknown;
}) => void;

/**
 * Environment Permission Manager - Manages environment-aware permissions
 */
export class EnvironmentPermissionManager {
  private static instance: EnvironmentPermissionManager | null = null;
  private config: PermissionConfig;
  private observers: Set<PermissionObserver> = new Set();
  private hitlManager: HITLManager | null = null;
  private checkHistory: PermissionCheckResult[] = [];
  private maxHistorySize = 100;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor(config?: Partial<PermissionConfig>) {
    this.config = this.mergeConfig(config || {});
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(config?: Partial<PermissionConfig>): EnvironmentPermissionManager {
    if (!EnvironmentPermissionManager.instance) {
      EnvironmentPermissionManager.instance = new EnvironmentPermissionManager(config);
    }
    return EnvironmentPermissionManager.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  public static resetInstance(): void {
    EnvironmentPermissionManager.instance = null;
  }

  /**
   * Set HITL manager for approval workflows
   */
  public setHITLManager(hitlManager: HITLManager): void {
    this.hitlManager = hitlManager;
  }

  // ==========================================================================
  // Configuration Management
  // ==========================================================================

  /**
   * Merge provided config with defaults
   */
  private mergeConfig(partial: Partial<PermissionConfig>): PermissionConfig {
    return {
      environments: {
        ...DEFAULT_PERMISSION_CONFIG.environments,
        ...partial.environments,
      },
      global: {
        ...DEFAULT_PERMISSION_CONFIG.global,
        ...partial.global,
      },
    };
  }

  /**
   * Update permission configuration
   */
  public updateConfig(config: Partial<PermissionConfig>): void {
    this.config = this.mergeConfig(config);
    this.notifyObservers({
      type: 'config_changed',
      data: { config: this.config },
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): PermissionConfig {
    return { ...this.config };
  }

  /**
   * Update environment-specific permissions
   */
  public updateEnvironmentPermissions(
    environment: EnvironmentType,
    permissions: Partial<EnvironmentPermissions>
  ): void {
    // Only update known environments
    if (environment === 'unknown') {
      return;
    }

    const current = this.config.environments[environment];
    if (current) {
      this.config.environments[environment] = {
        ...current,
        ...permissions,
      };
      this.notifyObservers({
        type: 'config_changed',
        data: { environment, permissions },
      });
    }
  }

  // ==========================================================================
  // Permission Checking
  // ==========================================================================

  /**
   * Check if an operation is permitted in the current environment
   */
  public checkPermission(
    action: PermissionAction,
    environment: EnvironmentType,
    operation: OperationMetadata
  ): PermissionCheckResult {
    const result = this.performPermissionCheck(action, environment, operation);

    // Log if enabled
    if (this.config.global.logChecks) {
      this.logPermissionCheck(result);
    }

    // Add to history
    this.addToHistory(result);

    // Notify observers
    this.notifyObservers({
      type: 'check_performed',
      data: result,
    });

    return result;
  }

  /**
   * Perform the actual permission check logic
   */
  private performPermissionCheck(
    action: PermissionAction,
    environment: EnvironmentType,
    operation: OperationMetadata
  ): PermissionCheckResult {
    // If global permissions are disabled, allow everything
    if (!this.config.global.enabled) {
      return {
        allowed: true,
        decision: 'allowed',
        reason: 'Permission system is globally disabled',
        environment,
        operation,
        checkedAt: new Date(),
      };
    }

    // Get environment-specific permissions
    const envPermissions =
      environment !== 'unknown'
        ? this.config.environments[environment]
        : undefined;

    // Handle unknown environment
    if (!envPermissions) {
      const decision = this.config.global.unknownEnvironmentDefault;
      return {
        allowed: decision === 'allowed',
        decision,
        reason: `Unknown environment '${environment}' - using default: ${decision}`,
        environment,
        operation,
        checkedAt: new Date(),
      };
    }

    // If environment permissions are disabled, use default
    if (!envPermissions.enabled) {
      const decision = envPermissions.defaultDecision;
      return {
        allowed: decision === 'allowed',
        decision,
        reason: `Permissions disabled for ${environment} - using default: ${decision}`,
        environment,
        operation,
        checkedAt: new Date(),
      };
    }

    // Find matching rule
    const matchingRule = this.findMatchingRule(action, operation, envPermissions);

    if (matchingRule) {
      return this.applyRule(matchingRule, environment, operation);
    }

    // No matching rule - use default decision
    const decision = envPermissions.defaultDecision;
    return {
      allowed: decision === 'allowed',
      decision,
      reason: `No specific rule found for ${action} - using default: ${decision}`,
      environment,
      operation,
      checkedAt: new Date(),
    };
  }

  /**
   * Find matching permission rule for action and operation
   */
  private findMatchingRule(
    action: PermissionAction,
    operation: OperationMetadata,
    envPermissions: EnvironmentPermissions
  ): PermissionRule | null {
    for (const rule of envPermissions.rules) {
      // Check if action matches
      if (rule.action !== action) {
        continue;
      }

      // Check risk threshold if specified
      if (rule.riskThreshold) {
        if (!meetsRiskThreshold(operation.riskLevel, rule.riskThreshold)) {
          continue;
        }
      }

      // Rule matches
      return rule;
    }

    return null;
  }

  /**
   * Apply permission rule and create result
   */
  private applyRule(
    rule: PermissionRule,
    environment: EnvironmentType,
    operation: OperationMetadata
  ): PermissionCheckResult {
    const envPermissions =
      environment !== 'unknown'
        ? this.config.environments[environment]
        : undefined;
    const requiredApprovers = rule.requiredApprovers || envPermissions?.approvers || [];

    return {
      allowed: rule.decision === 'allowed',
      decision: rule.decision,
      reason:
        rule.reason ||
        `Rule applied: ${rule.action} → ${rule.decision}${
          rule.riskThreshold ? ` (risk >= ${rule.riskThreshold})` : ''
        }`,
      appliedRule: rule,
      environment,
      operation,
      requiredApprovers: requiredApprovers.length > 0 ? requiredApprovers : undefined,
      checkedAt: new Date(),
    };
  }

  // ==========================================================================
  // HITL Integration
  // ==========================================================================

  /**
   * Request approval for an operation via HITL workflow
   */
  public async requestApproval(
    action: PermissionAction,
    environment: EnvironmentType,
    operation: OperationMetadata,
    requiredApprovers?: string[]
  ): Promise<ApprovalRequest | null> {
    if (!this.hitlManager) {
      console.warn('HITL Manager not configured - cannot request approval');
      return null;
    }

    const envPermissions =
      environment !== 'unknown'
        ? this.config.environments[environment]
        : undefined;

    const approvers =
      requiredApprovers ||
      envPermissions?.approvers ||
      ['admin'];

    const approvalRequest = this.hitlManager.createRequest({
      type: this.mapActionToApprovalType(action),
      title: `Approval Required: ${action} in ${environment}`,
      description: this.formatApprovalDescription(action, environment, operation),
      agentId: operation.agent || 'unknown',
      taskId: `${environment}-${action}-${Date.now()}`,
      payload: { action, environment, operation },
      priority: this.mapRiskToPriority(operation.riskLevel),
      requiredApprovers: approvers,
      expiresInMinutes: this.getApprovalTimeoutMinutes(environment, operation.riskLevel),
    });

    this.notifyObservers({
      type: 'approval_requested',
      data: approvalRequest,
    });

    return approvalRequest;
  }

  /**
   * Map permission action to HITL approval type
   */
  private mapActionToApprovalType(
    action: PermissionAction
  ): 'code_change' | 'deployment' | 'data_access' | 'security_action' | 'external_api' | 'custom' {
    switch (action) {
      case 'write_file':
      case 'delete_file':
        return 'code_change';
      case 'deploy':
        return 'deployment';
      case 'database_read':
      case 'database_write':
        return 'data_access';
      case 'system_config':
        return 'security_action';
      case 'network_request':
        return 'external_api';
      default:
        return 'custom';
    }
  }

  /**
   * Map operation risk to approval priority
   */
  private mapRiskToPriority(
    risk: OperationRiskLevel
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (risk) {
      case 'safe':
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
        return 'high';
      case 'critical':
        return 'critical';
    }
  }

  /**
   * Get approval timeout based on environment and risk
   */
  private getApprovalTimeoutMinutes(
    environment: EnvironmentType,
    risk: OperationRiskLevel
  ): number {
    // Production operations get longer timeouts
    const baseTimeout = environment === 'production' ? 60 : 30;

    // Higher risk gets more time
    const riskMultiplier = RISK_LEVEL_VALUES[risk] * 0.5;

    return Math.round(baseTimeout * (1 + riskMultiplier));
  }

  /**
   * Format approval description
   */
  private formatApprovalDescription(
    action: PermissionAction,
    environment: EnvironmentType,
    operation: OperationMetadata
  ): string {
    const parts: string[] = [
      `**Action:** ${action}`,
      `**Environment:** ${environment}`,
      `**Risk Level:** ${operation.riskLevel}`,
      `**Description:** ${operation.description}`,
    ];

    if (operation.affectedResources && operation.affectedResources.length > 0) {
      parts.push(`**Affected Resources:**\n${operation.affectedResources.map(r => `  - ${r}`).join('\n')}`);
    }

    if (operation.agent) {
      parts.push(`**Requesting Agent:** ${operation.agent}`);
    }

    return parts.join('\n\n');
  }

  // ==========================================================================
  // History & Logging
  // ==========================================================================

  /**
   * Add check result to history
   */
  private addToHistory(result: PermissionCheckResult): void {
    this.checkHistory.push(result);

    // Keep history size bounded
    if (this.checkHistory.length > this.maxHistorySize) {
      this.checkHistory = this.checkHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get recent permission check history
   */
  public getHistory(limit?: number): PermissionCheckResult[] {
    const historyLimit = limit || this.checkHistory.length;
    return this.checkHistory.slice(-historyLimit);
  }

  /**
   * Clear permission check history
   */
  public clearHistory(): void {
    this.checkHistory = [];
  }

  /**
   * Log permission check result
   */
  private logPermissionCheck(result: PermissionCheckResult): void {
    const level = result.allowed ? 'info' : 'warn';
    const message = `[PermissionCheck] ${result.decision.toUpperCase()}: ${result.operation.type} in ${result.environment} - ${result.reason}`;

    if (level === 'warn') {
      console.warn(message);
    } else {
      console.log(message);
    }
  }

  // ==========================================================================
  // Observer Pattern
  // ==========================================================================

  /**
   * Subscribe to permission events
   */
  public subscribe(observer: PermissionObserver): () => void {
    this.observers.add(observer);

    // Return unsubscribe function
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Notify all observers of an event
   */
  private notifyObservers(event: Parameters<PermissionObserver>[0]): void {
    this.observers.forEach(observer => {
      try {
        observer(event);
      } catch (error) {
        console.error('Error in permission observer:', error);
      }
    });
  }

  /**
   * Get number of active observers
   */
  public getObserverCount(): number {
    return this.observers.size;
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate permission configuration
   */
  public validateConfig(config: PermissionConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate global config
    if (typeof config.global.enabled !== 'boolean') {
      errors.push('global.enabled must be a boolean');
    }

    if (
      !['allowed', 'denied', 'requires_approval'].includes(
        config.global.unknownEnvironmentDefault
      )
    ) {
      errors.push('global.unknownEnvironmentDefault must be a valid PermissionDecision');
    }

    // Validate environment permissions
    for (const [envName, envPerms] of Object.entries(config.environments)) {
      if (!envPerms) continue;

      if (typeof envPerms.enabled !== 'boolean') {
        errors.push(`${envName}.enabled must be a boolean`);
      }

      if (
        !['allowed', 'denied', 'requires_approval'].includes(envPerms.defaultDecision)
      ) {
        errors.push(`${envName}.defaultDecision must be a valid PermissionDecision`);
      }

      // Validate rules
      envPerms.rules.forEach((rule, index) => {
        if (!rule.action) {
          errors.push(`${envName}.rules[${index}] missing action`);
        }
        if (!rule.decision) {
          errors.push(`${envName}.rules[${index}] missing decision`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Get singleton instance (convenience export)
 */
export function getPermissionManager(
  config?: Partial<PermissionConfig>
): EnvironmentPermissionManager {
  return EnvironmentPermissionManager.getInstance(config);
}

/**
 * Create a default permission configuration
 */
export function createDefaultPermissionConfig(): PermissionConfig {
  return { ...DEFAULT_PERMISSION_CONFIG };
}
