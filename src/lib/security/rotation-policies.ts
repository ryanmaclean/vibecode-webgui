/**
 * Rotation Policies - Configurable rotation rules per secret type
 *
 * Defines rotation schedules, strategies, and validation logic for different secret types.
 * Provides policy-based rotation management with industry-standard intervals.
 *
 * Features:
 * - Predefined policies for common secret types
 * - Configurable rotation intervals and grace periods
 * - Policy validation and enforcement
 * - Rotation strategy definitions per type
 * - Helper functions for rotation checks
 */

import { createChildLogger } from '@/lib/logger'

const logger = createChildLogger({ module: 'security', scope: 'rotation-policies' })

/**
 * Rotation strategy types
 */
export type RotationStrategy =
  | 'manual' // Requires manual intervention to generate new secret
  | 'automated' // Can be automatically rotated via API/script
  | 'provider-managed' // Managed by external provider (e.g., GitHub, AWS)
  | 'warning-only' // Only warn, don't enforce rotation

/**
 * Secret type categories
 */
export type SecretType =
  | 'api_key' // Third-party API keys
  | 'auth_token' // Authentication tokens and secrets
  | 'database_credential' // Database connection strings and passwords
  | 'monitoring_key' // Monitoring and observability service keys
  | 'custom' // Custom-defined secret type

/**
 * Rotation policy definition
 */
export interface RotationPolicy {
  /** Unique policy identifier */
  name: string

  /** Human-readable description */
  description: string

  /** Secret type this policy applies to */
  secretType: SecretType

  /** Rotation interval in days */
  rotationIntervalDays: number

  /** Grace period before marking as critical (days) */
  gracePeriodDays: number

  /** Warning thresholds (days before expiration) */
  warningThresholds: number[]

  /** Rotation strategy for this secret type */
  strategy: RotationStrategy

  /** Whether this policy is mandatory or advisory */
  mandatory: boolean

  /** Additional metadata for policy-specific behavior */
  metadata?: {
    /** Requires approval before rotation */
    requiresApproval?: boolean

    /** Can be rotated in production */
    allowProductionRotation?: boolean

    /** Additional validation required */
    customValidation?: string

    /** Provider-specific instructions */
    providerInstructions?: string
  }
}

/**
 * Predefined rotation policies for common secret types
 */
export const ROTATION_POLICIES: Record<string, RotationPolicy> = {
  api_keys: {
    name: 'api_keys',
    description: 'Third-party API keys (OpenAI, Anthropic, Azure, Google, etc.)',
    secretType: 'api_key',
    rotationIntervalDays: 90,
    gracePeriodDays: 7,
    warningThresholds: [30, 14, 7, 3, 1],
    strategy: 'manual',
    mandatory: true,
    metadata: {
      requiresApproval: false,
      allowProductionRotation: true,
      providerInstructions: 'Rotate via provider dashboard and update keychain',
    },
  },

  auth_tokens: {
    name: 'auth_tokens',
    description: 'Authentication tokens and OAuth secrets',
    secretType: 'auth_token',
    rotationIntervalDays: 30,
    gracePeriodDays: 3,
    warningThresholds: [14, 7, 3, 1],
    strategy: 'manual',
    mandatory: true,
    metadata: {
      requiresApproval: true,
      allowProductionRotation: false,
      customValidation: 'Verify all active sessions before rotation',
      providerInstructions: 'Regenerate via OAuth provider console',
    },
  },

  db_credentials: {
    name: 'db_credentials',
    description: 'Database connection strings and passwords',
    secretType: 'database_credential',
    rotationIntervalDays: 180,
    gracePeriodDays: 14,
    warningThresholds: [30, 14, 7, 3],
    strategy: 'manual',
    mandatory: true,
    metadata: {
      requiresApproval: true,
      allowProductionRotation: false,
      customValidation: 'Ensure zero-downtime rotation strategy',
      providerInstructions: 'Use database provider rotation tools',
    },
  },

  monitoring: {
    name: 'monitoring',
    description: 'Monitoring and observability service keys (Datadog, etc.)',
    secretType: 'monitoring_key',
    rotationIntervalDays: 90,
    gracePeriodDays: 7,
    warningThresholds: [30, 14, 7, 3],
    strategy: 'manual',
    mandatory: true,
    metadata: {
      requiresApproval: false,
      allowProductionRotation: true,
      providerInstructions: 'Rotate via monitoring provider dashboard',
    },
  },

  custom: {
    name: 'custom',
    description: 'Custom secrets with default policy',
    secretType: 'custom',
    rotationIntervalDays: 90,
    gracePeriodDays: 7,
    warningThresholds: [30, 14, 7, 3, 1],
    strategy: 'warning-only',
    mandatory: false,
    metadata: {
      requiresApproval: false,
      allowProductionRotation: false,
    },
  },
}

/**
 * Policy validation result
 */
export interface PolicyValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Rotation requirement check result
 */
export interface RotationCheckResult {
  /** Whether rotation is required */
  rotationRequired: boolean

  /** Days until expiration (negative if expired) */
  daysUntilExpiration: number | null

  /** Severity level: 'critical', 'warning', 'info', 'ok' */
  severity: 'critical' | 'warning' | 'info' | 'ok'

  /** Human-readable message */
  message: string

  /** Policy that was evaluated */
  policy: RotationPolicy | null

  /** Timestamp of check */
  checkedAt: Date
}

/**
 * Get rotation policy by name
 *
 * @param policyName - Policy identifier (e.g., 'api_keys')
 * @returns Rotation policy or null if not found
 */
export function getPolicy(policyName: string): RotationPolicy | null {
  const policy = ROTATION_POLICIES[policyName]
  if (!policy) {
    logger.warn('Rotation policy not found', { policyName })
    return null
  }
  return policy
}

/**
 * Get all available rotation policies
 *
 * @returns Array of all policies
 */
export function getAllPolicies(): RotationPolicy[] {
  return Object.values(ROTATION_POLICIES)
}

/**
 * Validate a rotation policy definition
 *
 * @param policy - Policy to validate
 * @returns Validation result with errors and warnings
 */
export function validatePolicy(policy: RotationPolicy): PolicyValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!policy.name || policy.name.trim() === '') {
    errors.push('Policy name is required')
  }

  if (!policy.description || policy.description.trim() === '') {
    errors.push('Policy description is required')
  }

  if (!policy.secretType) {
    errors.push('Secret type is required')
  }

  // Rotation interval validation
  if (!policy.rotationIntervalDays || policy.rotationIntervalDays <= 0) {
    errors.push('Rotation interval must be greater than 0 days')
  } else if (policy.rotationIntervalDays > 365) {
    warnings.push('Rotation interval exceeds 1 year - consider shorter intervals for security')
  } else if (policy.rotationIntervalDays < 7) {
    warnings.push('Rotation interval less than 7 days may be too frequent')
  }

  // Grace period validation
  if (policy.gracePeriodDays < 0) {
    errors.push('Grace period cannot be negative')
  } else if (policy.gracePeriodDays > policy.rotationIntervalDays) {
    errors.push('Grace period cannot exceed rotation interval')
  }

  // Warning thresholds validation
  if (!policy.warningThresholds || policy.warningThresholds.length === 0) {
    warnings.push('No warning thresholds defined')
  } else {
    // Check thresholds are in descending order
    for (let i = 0; i < policy.warningThresholds.length - 1; i++) {
      if (policy.warningThresholds[i] <= policy.warningThresholds[i + 1]) {
        errors.push('Warning thresholds must be in descending order')
        break
      }
    }

    // Check thresholds are within rotation interval
    const maxThreshold = Math.max(...policy.warningThresholds)
    if (maxThreshold >= policy.rotationIntervalDays) {
      warnings.push('Warning threshold exceeds rotation interval')
    }
  }

  // Strategy validation
  const validStrategies: RotationStrategy[] = [
    'manual',
    'automated',
    'provider-managed',
    'warning-only',
  ]
  if (!validStrategies.includes(policy.strategy)) {
    errors.push(`Invalid rotation strategy: ${policy.strategy}`)
  }

  logger.debug('Policy validation completed', {
    policyName: policy.name,
    valid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Check if rotation is required based on policy and expiration date
 *
 * @param expiresAt - Secret expiration date
 * @param policyName - Policy to evaluate against
 * @param lastRotatedAt - Optional last rotation timestamp
 * @returns Rotation check result with severity and recommendations
 */
export function checkRotationRequired(
  expiresAt: Date | null,
  policyName: string,
  lastRotatedAt?: Date | null
): RotationCheckResult {
  const now = new Date()
  const policy = getPolicy(policyName)

  // No expiration date set
  if (!expiresAt) {
    return {
      rotationRequired: true,
      daysUntilExpiration: null,
      severity: 'warning',
      message: 'No expiration date set - rotation policy not enforced',
      policy,
      checkedAt: now,
    }
  }

  // Calculate days until expiration
  const msUntilExpiration = expiresAt.getTime() - now.getTime()
  const daysUntilExpiration = Math.ceil(msUntilExpiration / (1000 * 60 * 60 * 24))

  // No policy found - use default thresholds
  if (!policy) {
    if (daysUntilExpiration <= 0) {
      return {
        rotationRequired: true,
        daysUntilExpiration,
        severity: 'critical',
        message: `Secret expired ${Math.abs(daysUntilExpiration)} days ago`,
        policy: null,
        checkedAt: now,
      }
    } else if (daysUntilExpiration <= 7) {
      return {
        rotationRequired: true,
        daysUntilExpiration,
        severity: 'warning',
        message: `Secret expires in ${daysUntilExpiration} days`,
        policy: null,
        checkedAt: now,
      }
    } else {
      return {
        rotationRequired: false,
        daysUntilExpiration,
        severity: 'ok',
        message: `Secret expires in ${daysUntilExpiration} days`,
        policy: null,
        checkedAt: now,
      }
    }
  }

  // Expired - critical
  if (daysUntilExpiration <= 0) {
    return {
      rotationRequired: true,
      daysUntilExpiration,
      severity: 'critical',
      message: `Secret expired ${Math.abs(daysUntilExpiration)} days ago - immediate rotation required`,
      policy,
      checkedAt: now,
    }
  }

  // Within grace period - critical
  if (daysUntilExpiration <= policy.gracePeriodDays) {
    return {
      rotationRequired: true,
      daysUntilExpiration,
      severity: 'critical',
      message: `Secret expires in ${daysUntilExpiration} days (within grace period of ${policy.gracePeriodDays} days)`,
      policy,
      checkedAt: now,
    }
  }

  // Check warning thresholds
  for (const threshold of policy.warningThresholds) {
    if (daysUntilExpiration <= threshold) {
      return {
        rotationRequired: policy.mandatory,
        daysUntilExpiration,
        severity: 'warning',
        message: `Secret expires in ${daysUntilExpiration} days - rotation recommended`,
        policy,
        checkedAt: now,
      }
    }
  }

  // All good
  return {
    rotationRequired: false,
    daysUntilExpiration,
    severity: 'ok',
    message: `Secret expires in ${daysUntilExpiration} days - no action required`,
    policy,
    checkedAt: now,
  }
}

/**
 * Calculate next expiration date based on policy
 *
 * @param policyName - Policy to use for calculation
 * @param fromDate - Start date (defaults to now)
 * @returns Next expiration date or null if policy not found
 */
export function calculateNextExpiration(
  policyName: string,
  fromDate: Date = new Date()
): Date | null {
  const policy = getPolicy(policyName)
  if (!policy) {
    logger.error('Cannot calculate expiration - policy not found', { policyName })
    return null
  }

  const expirationDate = new Date(fromDate)
  expirationDate.setDate(expirationDate.getDate() + policy.rotationIntervalDays)

  logger.debug('Calculated next expiration date', {
    policyName,
    fromDate: fromDate.toISOString(),
    expirationDate: expirationDate.toISOString(),
    intervalDays: policy.rotationIntervalDays,
  })

  return expirationDate
}

/**
 * Get secrets that match a specific rotation policy
 *
 * @param secretKeyName - Secret identifier to check
 * @returns Matching policy name or null
 */
export function inferPolicyFromKeyName(secretKeyName: string): string | null {
  const keyLower = secretKeyName.toLowerCase()

  // API Keys
  if (
    keyLower.includes('api_key') ||
    keyLower.includes('apikey') ||
    keyLower.endsWith('_key')
  ) {
    return 'api_keys'
  }

  // Auth tokens
  if (
    keyLower.includes('token') ||
    keyLower.includes('secret') ||
    keyLower.includes('oauth') ||
    keyLower.includes('jwt')
  ) {
    return 'auth_tokens'
  }

  // Database credentials
  if (
    keyLower.includes('database') ||
    keyLower.includes('db_') ||
    keyLower.includes('postgres') ||
    keyLower.includes('mysql') ||
    keyLower.includes('mongo') ||
    keyLower.includes('connection_string')
  ) {
    return 'db_credentials'
  }

  // Monitoring
  if (keyLower.includes('dd_') || keyLower.includes('datadog')) {
    return 'monitoring'
  }

  // Default to custom
  logger.debug('No matching policy found, using custom', { secretKeyName })
  return 'custom'
}

/**
 * Format rotation check result for display
 *
 * @param result - Rotation check result
 * @returns Formatted string for logging or display
 */
export function formatRotationCheckResult(result: RotationCheckResult): string {
  const emoji =
    result.severity === 'critical'
      ? '🔴'
      : result.severity === 'warning'
        ? '⚠️'
        : result.severity === 'info'
          ? 'ℹ️'
          : '✅'

  const policyInfo = result.policy ? ` (Policy: ${result.policy.name})` : ''
  return `${emoji} ${result.message}${policyInfo}`
}
