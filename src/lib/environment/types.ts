/**
 * Environment Detection & Safety Type Definitions
 * Automatic detection of production vs development environments
 * with safety controls for agent operations
 */

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment type classification
 */
export type EnvironmentType =
  | 'development'
  | 'staging'
  | 'production'
  | 'test'
  | 'unknown';

/**
 * Confidence level for environment detection
 */
export type DetectionConfidence =
  | 'high'      // Multiple signals agree
  | 'medium'    // Single reliable signal
  | 'low'       // Heuristic match
  | 'unknown';  // No reliable signals

/**
 * Detection signal sources
 */
export type DetectionSignalType =
  | 'env_variable'    // NODE_ENV, DD_ENV, etc.
  | 'hostname'        // Machine/container hostname patterns
  | 'domain'          // URL domain patterns
  | 'git_branch'      // Git branch name
  | 'config_file'     // Configuration file indicators
  | 'cloud_metadata'; // Cloud provider metadata

// ============================================================================
// Detection Configuration
// ============================================================================

/**
 * Environment detection signal
 */
export interface DetectionSignal {
  /** Signal type */
  type: DetectionSignalType;

  /** Signal source (e.g., 'NODE_ENV', 'hostname') */
  source: string;

  /** Detected value */
  value: string;

  /** Environment indicated by this signal */
  indicates: EnvironmentType;

  /** Confidence level for this signal */
  confidence: DetectionConfidence;

  /** Signal priority (higher = more authoritative) */
  priority: number;
}

/**
 * Environment detection result
 */
export interface EnvironmentDetectionResult {
  /** Detected environment type */
  environment: EnvironmentType;

  /** Overall confidence level */
  confidence: DetectionConfidence;

  /** All detection signals collected */
  signals: DetectionSignal[];

  /** Primary signal used for determination */
  primarySignal?: DetectionSignal;

  /** Timestamp of detection */
  detectedAt: Date;

  /** Any warnings or conflicts in detection */
  warnings?: string[];
}

/**
 * Environment detection configuration
 */
export interface EnvironmentDetectorConfig {
  /** Environment variable names to check (in priority order) */
  envVariables?: string[];

  /** Hostname patterns for each environment */
  hostnamePatterns?: {
    development?: RegExp[];
    staging?: RegExp[];
    production?: RegExp[];
    test?: RegExp[];
  };

  /** Domain patterns for each environment */
  domainPatterns?: {
    development?: RegExp[];
    staging?: RegExp[];
    production?: RegExp[];
  };

  /** Git branch patterns */
  branchPatterns?: {
    development?: RegExp[];
    staging?: RegExp[];
    production?: RegExp[];
  };

  /** Custom detection rules */
  customRules?: DetectionRule[];

  /** Fallback environment if detection fails */
  fallbackEnvironment?: EnvironmentType;
}

/**
 * Custom detection rule
 */
export interface DetectionRule {
  /** Rule name */
  name: string;

  /** Rule evaluation function */
  evaluate: () => DetectionSignal | null;

  /** Rule priority */
  priority: number;
}

// ============================================================================
// Operation Safety Types
// ============================================================================

/**
 * Operation risk level
 */
export type OperationRiskLevel =
  | 'safe'       // No risk (read-only operations)
  | 'low'        // Low risk (create files, write logs)
  | 'medium'     // Medium risk (modify files, restart services)
  | 'high'       // High risk (delete files, database changes)
  | 'critical';  // Critical risk (deploy, production changes)

/**
 * Agent operation type
 */
export type AgentOperationType =
  | 'read'
  | 'write'
  | 'delete'
  | 'execute'
  | 'deploy'
  | 'database'
  | 'network'
  | 'system';

/**
 * Operation metadata for safety checks
 */
export interface OperationMetadata {
  /** Operation type */
  type: AgentOperationType;

  /** Risk level */
  riskLevel: OperationRiskLevel;

  /** Operation description */
  description: string;

  /** Resources affected (files, services, etc.) */
  affectedResources?: string[];

  /** Agent requesting the operation */
  agent?: string;

  /** Timestamp of operation request */
  requestedAt?: Date;
}

// ============================================================================
// Environment Context
// ============================================================================

/**
 * Complete environment context
 */
export interface EnvironmentContext {
  /** Current environment */
  current: EnvironmentDetectionResult;

  /** Whether safety checks are enabled */
  safetyEnabled: boolean;

  /** Whether currently in production */
  isProduction: boolean;

  /** Whether currently in development */
  isDevelopment: boolean;

  /** Whether currently in staging */
  isStaging: boolean;

  /** Last updated timestamp */
  updatedAt: Date;
}

// ============================================================================
// Validation & Guards
// ============================================================================

/**
 * Environment guard result
 */
export interface EnvironmentGuardResult {
  /** Whether operation is allowed */
  allowed: boolean;

  /** Reason for allow/deny */
  reason: string;

  /** Whether approval is required */
  requiresApproval: boolean;

  /** Environment context at time of check */
  environment: EnvironmentType;

  /** Operation metadata */
  operation: OperationMetadata;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type guard to check if environment is production
 */
export function isProductionEnvironment(env: EnvironmentType): boolean {
  return env === 'production';
}

/**
 * Type guard to check if environment is development
 */
export function isDevelopmentEnvironment(env: EnvironmentType): boolean {
  return env === 'development' || env === 'test';
}

/**
 * Type guard to check if environment requires extra safety
 */
export function requiresExtraSafety(env: EnvironmentType): boolean {
  return env === 'production' || env === 'staging';
}

/**
 * Get display color for environment
 */
export function getEnvironmentColor(env: EnvironmentType): string {
  switch (env) {
    case 'development':
    case 'test':
      return 'green';
    case 'staging':
      return 'yellow';
    case 'production':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get display label for environment
 */
export function getEnvironmentLabel(env: EnvironmentType): string {
  return env.charAt(0).toUpperCase() + env.slice(1);
}
