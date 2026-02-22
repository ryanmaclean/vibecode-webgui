/**
 * Environment Guard Middleware
 * Enforces environment-based permission checks on agent operations
 * Integrates with environment detection and HITL approval workflows
 */

import type {
  EnvironmentType,
  PermissionAction,
  OperationMetadata,
  PermissionCheckResult,
} from '../environment/types';
import { getEnvironmentContext } from '../env-validation';
import { getPermissionManager, EnvironmentPermissionManager } from '../environment/permissions';
import type { ApprovalRequest, HITLManager } from '../workflow/hitl-manager';

// ============================================================================
// Types
// ============================================================================

/**
 * Environment guard result for agent operations
 */
export interface EnvironmentGuardResult {
  /** Whether the operation is allowed to proceed */
  allowed: boolean;

  /** Reason for the decision */
  reason: string;

  /** Whether the operation requires approval */
  requiresApproval: boolean;

  /** Environment where the operation was checked */
  environment: EnvironmentType;

  /** Permission check details */
  permissionCheck?: PermissionCheckResult;

  /** Approval request if approval is required */
  approvalRequest?: ApprovalRequest | null;

  /** Timestamp of the guard check */
  checkedAt: Date;
}

/**
 * Environment guard configuration
 */
export interface EnvironmentGuardConfig {
  /** Whether to enable environment-based guards */
  enabled?: boolean;

  /** Whether to bypass checks in test environment */
  bypassInTest?: boolean;

  /** Whether to log guard checks */
  logChecks?: boolean;

  /** HITL manager for approval workflows */
  hitlManager?: HITLManager;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<EnvironmentGuardConfig> = {
  enabled: true,
  bypassInTest: true,
  logChecks: true,
  hitlManager: undefined as unknown as HITLManager, // Will be set via setHITLManager
};

let globalConfig: Required<EnvironmentGuardConfig> = { ...DEFAULT_CONFIG };
let permissionManager: EnvironmentPermissionManager | null = null;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the environment guard with configuration
 */
export function initializeEnvironmentGuard(config: EnvironmentGuardConfig = {}): void {
  globalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  // Initialize permission manager
  permissionManager = getPermissionManager();

  // Set HITL manager if provided
  if (config.hitlManager) {
    permissionManager.setHITLManager(config.hitlManager);
  }

  if (globalConfig.logChecks) {
    console.log('[EnvironmentGuard] Initialized with config:', {
      enabled: globalConfig.enabled,
      bypassInTest: globalConfig.bypassInTest,
      logChecks: globalConfig.logChecks,
      hasHITLManager: !!globalConfig.hitlManager,
    });
  }
}

/**
 * Set HITL manager for approval workflows
 */
export function setHITLManager(hitlManager: HITLManager): void {
  globalConfig.hitlManager = hitlManager;

  if (!permissionManager) {
    permissionManager = getPermissionManager();
  }

  permissionManager.setHITLManager(hitlManager);
}

/**
 * Update environment guard configuration
 */
export function updateEnvironmentGuardConfig(config: Partial<EnvironmentGuardConfig>): void {
  globalConfig = {
    ...globalConfig,
    ...config,
  };

  if (config.hitlManager && permissionManager) {
    permissionManager.setHITLManager(config.hitlManager);
  }
}

/**
 * Get current environment guard configuration
 */
export function getEnvironmentGuardConfig(): EnvironmentGuardConfig {
  return { ...globalConfig };
}

// ============================================================================
// Guard Functions
// ============================================================================

/**
 * Check if an agent operation is allowed in the current environment
 *
 * This is the main entry point for environment-based permission checks.
 * It detects the current environment, checks permissions, and handles
 * approval workflows if needed.
 *
 * @param action - The permission action to check (e.g., 'write_file', 'deploy')
 * @param operation - Metadata about the operation
 * @returns Guard result indicating if operation is allowed
 */
export async function checkAgentOperation(
  action: PermissionAction,
  operation: OperationMetadata
): Promise<EnvironmentGuardResult> {
  const checkedAt = new Date();

  // If guard is disabled globally, allow all operations
  if (!globalConfig.enabled) {
    return {
      allowed: true,
      requiresApproval: false,
      reason: 'Environment guard is disabled',
      environment: 'unknown',
      checkedAt,
    };
  }

  // Get current environment
  const envContext = getEnvironmentContext();
  const environment = envContext?.current?.environment || 'unknown';

  // Bypass checks in test environment if configured
  if (globalConfig.bypassInTest && environment === 'test') {
    if (globalConfig.logChecks) {
      console.log('[EnvironmentGuard] Bypassing check in test environment:', action);
    }
    return {
      allowed: true,
      requiresApproval: false,
      reason: 'Test environment - checks bypassed',
      environment,
      checkedAt,
    };
  }

  // Initialize permission manager if not already done
  if (!permissionManager) {
    permissionManager = getPermissionManager();
    if (globalConfig.hitlManager) {
      permissionManager.setHITLManager(globalConfig.hitlManager);
    }
  }

  // Check permissions
  const permissionCheck = permissionManager.checkPermission(action, environment, operation);

  // Log the check if enabled
  if (globalConfig.logChecks) {
    logGuardCheck(action, environment, permissionCheck);
  }

  // Handle the permission decision
  switch (permissionCheck.decision) {
    case 'allowed':
      return {
        allowed: true,
        requiresApproval: false,
        reason: permissionCheck.reason,
        environment,
        permissionCheck,
        checkedAt,
      };

    case 'denied':
      return {
        allowed: false,
        requiresApproval: false,
        reason: permissionCheck.reason,
        environment,
        permissionCheck,
        checkedAt,
      };

    case 'requires_approval':
      // Request approval via HITL if manager is available
      let approvalRequest: ApprovalRequest | null = null;

      if (globalConfig.hitlManager) {
        approvalRequest = await permissionManager.requestApproval(
          action,
          environment,
          operation,
          permissionCheck.requiredApprovers
        );
      }

      return {
        allowed: false, // Not allowed until approved
        requiresApproval: true,
        reason: permissionCheck.reason,
        environment,
        permissionCheck,
        approvalRequest,
        checkedAt,
      };

    default:
      // Should never happen, but handle gracefully
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Unknown permission decision',
        environment,
        permissionCheck,
        checkedAt,
      };
  }
}

/**
 * Check if a file operation is allowed
 * Convenience wrapper for file-related operations
 */
export async function checkFileOperation(
  type: 'read' | 'write' | 'delete',
  filePath: string,
  riskLevel: OperationMetadata['riskLevel'] = 'medium',
  agent?: string
): Promise<EnvironmentGuardResult> {
  const actionMap: Record<typeof type, PermissionAction> = {
    read: 'read_file',
    write: 'write_file',
    delete: 'delete_file',
  };

  const operation: OperationMetadata = {
    type: type === 'read' ? 'read' : type === 'delete' ? 'delete' : 'write',
    riskLevel,
    description: `${type.charAt(0).toUpperCase() + type.slice(1)} file: ${filePath}`,
    affectedResources: [filePath],
    agent,
    requestedAt: new Date(),
  };

  return checkAgentOperation(actionMap[type], operation);
}

/**
 * Check if a database operation is allowed
 * Convenience wrapper for database-related operations
 */
export async function checkDatabaseOperation(
  type: 'read' | 'write',
  description: string,
  affectedTables?: string[],
  riskLevel: OperationMetadata['riskLevel'] = 'high',
  agent?: string
): Promise<EnvironmentGuardResult> {
  const action: PermissionAction = type === 'read' ? 'database_read' : 'database_write';

  const operation: OperationMetadata = {
    type: 'database',
    riskLevel,
    description,
    affectedResources: affectedTables,
    agent,
    requestedAt: new Date(),
  };

  return checkAgentOperation(action, operation);
}

/**
 * Check if a deployment operation is allowed
 * Convenience wrapper for deployment operations
 */
export async function checkDeploymentOperation(
  description: string,
  affectedServices?: string[],
  riskLevel: OperationMetadata['riskLevel'] = 'critical',
  agent?: string
): Promise<EnvironmentGuardResult> {
  const operation: OperationMetadata = {
    type: 'deploy',
    riskLevel,
    description,
    affectedResources: affectedServices,
    agent,
    requestedAt: new Date(),
  };

  return checkAgentOperation('deploy', operation);
}

/**
 * Check if a system configuration operation is allowed
 * Convenience wrapper for system config operations
 */
export async function checkSystemConfigOperation(
  description: string,
  affectedConfigs?: string[],
  riskLevel: OperationMetadata['riskLevel'] = 'high',
  agent?: string
): Promise<EnvironmentGuardResult> {
  const operation: OperationMetadata = {
    type: 'system',
    riskLevel,
    description,
    affectedResources: affectedConfigs,
    agent,
    requestedAt: new Date(),
  };

  return checkAgentOperation('system_config', operation);
}

/**
 * Check if a command execution is allowed
 * Convenience wrapper for command execution operations
 */
export async function checkCommandExecution(
  command: string,
  riskLevel: OperationMetadata['riskLevel'] = 'medium',
  agent?: string
): Promise<EnvironmentGuardResult> {
  const operation: OperationMetadata = {
    type: 'execute',
    riskLevel,
    description: `Execute command: ${command}`,
    affectedResources: [command],
    agent,
    requestedAt: new Date(),
  };

  return checkAgentOperation('execute_command', operation);
}

/**
 * Check if a network request is allowed
 * Convenience wrapper for network operations
 */
export async function checkNetworkRequest(
  url: string,
  riskLevel: OperationMetadata['riskLevel'] = 'medium',
  agent?: string
): Promise<EnvironmentGuardResult> {
  const operation: OperationMetadata = {
    type: 'network',
    riskLevel,
    description: `Network request to: ${url}`,
    affectedResources: [url],
    agent,
    requestedAt: new Date(),
  };

  return checkAgentOperation('network_request', operation);
}

// ============================================================================
// Logging & Monitoring
// ============================================================================

/**
 * Log a guard check result
 */
function logGuardCheck(
  action: PermissionAction,
  environment: EnvironmentType,
  permissionCheck: PermissionCheckResult
): void {
  const level = permissionCheck.allowed ? 'info' : 'warn';
  const emoji = permissionCheck.allowed ? '✅' : permissionCheck.decision === 'requires_approval' ? '⏸️' : '❌';

  const message = `[EnvironmentGuard] ${emoji} ${action} in ${environment}: ${permissionCheck.decision.toUpperCase()} - ${permissionCheck.reason}`;

  if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

/**
 * Get guard statistics
 */
export function getGuardStatistics(): {
  enabled: boolean;
  bypassInTest: boolean;
  hasHITLManager: boolean;
  permissionManagerInitialized: boolean;
} {
  return {
    enabled: globalConfig.enabled,
    bypassInTest: globalConfig.bypassInTest,
    hasHITLManager: !!globalConfig.hitlManager,
    permissionManagerInitialized: !!permissionManager,
  };
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Reset environment guard state (for testing)
 * @internal - Only for use in tests
 */
export function __TEST__resetEnvironmentGuard(): void {
  globalConfig = { ...DEFAULT_CONFIG };
  permissionManager = null;
}

/**
 * Enable/disable environment guard (for testing)
 * @internal - Only for use in tests
 */
export function __TEST__setEnvironmentGuardEnabled(enabled: boolean): void {
  globalConfig.enabled = enabled;
}

// ============================================================================
// Exports
// ============================================================================

// Re-export permission manager for convenience
export { getPermissionManager, EnvironmentPermissionManager };
