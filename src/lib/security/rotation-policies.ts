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

  // Monitoring (check before generic api key patterns)
  if (keyLower.includes('dd_') || keyLower.includes('datadog')) {
    return 'monitoring'
  }

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

// ============================================================================
// ROTATION EXECUTOR - Policy Enforcement and Rotation Orchestration
// ============================================================================

/**
 * Rotation eligibility check result
 */
export interface RotationEligibilityResult {
  /** Whether rotation is allowed */
  eligible: boolean

  /** Reason for eligibility status */
  reason: string

  /** Policy being evaluated */
  policy: RotationPolicy | null

  /** Blocking issues preventing rotation */
  blockingIssues: string[]

  /** Warnings that should be considered */
  warnings: string[]
}

/**
 * Rotation execution options
 */
export interface RotationExecutionOptions {
  /** Reason for rotation (e.g., "scheduled", "compromised", "manual") */
  reason?: string

  /** User or system initiating rotation */
  initiatedBy?: string

  /** New secret value (for manual rotations) */
  newSecretValue?: string

  /** Whether to skip approval checks */
  skipApproval?: boolean

  /** Whether this is a dry-run (validation only) */
  dryRun?: boolean

  /** Production environment flag */
  isProduction?: boolean
}

/**
 * Rotation execution result
 */
export interface RotationExecutionResult {
  /** Whether rotation succeeded */
  success: boolean

  /** New expiration date after rotation */
  newExpiresAt: Date | null

  /** Previous expiration date */
  previousExpiresAt: Date | null

  /** Rotation timestamp */
  rotatedAt: Date

  /** Messages describing the rotation process */
  messages: string[]

  /** Errors encountered during rotation */
  errors: string[]

  /** Next steps for user (for manual rotations) */
  nextSteps?: string[]
}

/**
 * Validate if a secret is eligible for rotation based on policy
 *
 * Checks policy constraints, current secret status, and environment restrictions
 * to determine if rotation can proceed.
 *
 * @param secretKeyName - Secret identifier to validate
 * @param policyName - Rotation policy to enforce
 * @param currentStatus - Current secret status
 * @param lastRotatedAt - Last rotation timestamp
 * @param options - Rotation execution options
 * @returns Eligibility result with blocking issues and warnings
 */
export function validateRotationEligibility(
  secretKeyName: string,
  policyName: string,
  currentStatus: 'active' | 'expired' | 'rotating' | 'revoked',
  lastRotatedAt: Date | null,
  options: RotationExecutionOptions = {}
): RotationEligibilityResult {
  const policy = getPolicy(policyName)
  const blockingIssues: string[] = []
  const warnings: string[] = []

  // Policy not found
  if (!policy) {
    blockingIssues.push(`Rotation policy '${policyName}' not found`)
    return {
      eligible: false,
      reason: 'Policy not found',
      policy: null,
      blockingIssues,
      warnings,
    }
  }

  // Validate policy definition
  const policyValidation = validatePolicy(policy)
  if (!policyValidation.valid) {
    blockingIssues.push(...policyValidation.errors.map((e) => `Policy error: ${e}`))
  }
  warnings.push(...policyValidation.warnings)

  // Check if secret is already being rotated
  if (currentStatus === 'rotating') {
    blockingIssues.push('Secret is already in rotating state')
  }

  // Check if secret is revoked
  if (currentStatus === 'revoked') {
    blockingIssues.push('Cannot rotate revoked secret')
  }

  // Check production rotation restrictions
  if (options.isProduction && policy.metadata?.allowProductionRotation === false) {
    blockingIssues.push(
      `Policy '${policy.name}' does not allow production rotation. Rotate in staging first.`
    )
  }

  // Check approval requirements
  if (policy.metadata?.requiresApproval && !options.skipApproval) {
    warnings.push(
      'This secret requires approval before rotation. Use skipApproval flag if approved.'
    )
  }

  // Check rotation cooldown (prevent too-frequent rotations)
  if (lastRotatedAt) {
    const hoursSinceRotation =
      (Date.now() - lastRotatedAt.getTime()) / (1000 * 60 * 60)
    const cooldownHours = 24 // Minimum 24 hours between rotations

    if (hoursSinceRotation < cooldownHours) {
      blockingIssues.push(
        `Secret was rotated ${Math.round(hoursSinceRotation)} hours ago. ` +
          `Wait ${Math.round(cooldownHours - hoursSinceRotation)} more hours before rotating again.`
      )
    }
  }

  // Strategy-specific checks
  if (policy.strategy === 'warning-only') {
    warnings.push('Policy is warning-only - rotation will be recorded but not enforced')
  }

  if (policy.strategy === 'provider-managed') {
    warnings.push(
      'Secret is provider-managed. Ensure provider rotation is completed before updating locally.'
    )
  }

  // Add custom validation warnings if defined
  if (policy.metadata?.customValidation) {
    warnings.push(`Custom validation required: ${policy.metadata.customValidation}`)
  }

  const eligible = blockingIssues.length === 0

  logger.debug('Rotation eligibility check completed', {
    secretKeyName,
    policyName,
    eligible,
    blockingIssuesCount: blockingIssues.length,
    warningsCount: warnings.length,
  })

  return {
    eligible,
    reason: eligible
      ? 'Secret is eligible for rotation'
      : blockingIssues[0] || 'Unknown reason',
    policy,
    blockingIssues,
    warnings,
  }
}

/**
 * Execute rotation with policy enforcement
 *
 * Orchestrates the secret rotation process according to policy rules.
 * For manual strategies, provides guidance and validates user-supplied values.
 * For automated strategies, coordinates rotation with external systems.
 *
 * @param secretKeyName - Secret identifier to rotate
 * @param policyName - Rotation policy to enforce
 * @param currentExpiresAt - Current expiration date
 * @param currentStatus - Current secret status
 * @param lastRotatedAt - Last rotation timestamp
 * @param options - Rotation execution options
 * @returns Rotation execution result with new expiration and next steps
 */
export function executeRotation(
  secretKeyName: string,
  policyName: string,
  currentExpiresAt: Date | null,
  currentStatus: 'active' | 'expired' | 'rotating' | 'revoked',
  lastRotatedAt: Date | null,
  options: RotationExecutionOptions = {}
): RotationExecutionResult {
  const now = new Date()
  const messages: string[] = []
  const errors: string[] = []
  const nextSteps: string[] = []

  logger.info('Executing secret rotation', {
    secretKeyName,
    policyName,
    reason: options.reason || 'manual',
    dryRun: options.dryRun || false,
    initiatedBy: options.initiatedBy || 'system',
  })

  // Validate eligibility
  const eligibility = validateRotationEligibility(
    secretKeyName,
    policyName,
    currentStatus,
    lastRotatedAt,
    options
  )

  if (!eligibility.eligible) {
    errors.push(...eligibility.blockingIssues)
    logger.error('Rotation blocked by policy', {
      secretKeyName,
      policyName,
      blockingIssues: eligibility.blockingIssues,
    })

    return {
      success: false,
      newExpiresAt: null,
      previousExpiresAt: currentExpiresAt,
      rotatedAt: now,
      messages,
      errors,
      nextSteps: [],
    }
  }

  // Log warnings
  if (eligibility.warnings.length > 0) {
    messages.push(...eligibility.warnings)
    logger.warn('Rotation warnings', {
      secretKeyName,
      warnings: eligibility.warnings,
    })
  }

  const policy = eligibility.policy!

  // Dry run - validation only
  if (options.dryRun) {
    messages.push('DRY RUN: Rotation validation passed')
    messages.push(`Policy: ${policy.name} (${policy.strategy})`)
    messages.push(`Current expiration: ${currentExpiresAt?.toISOString() || 'None'}`)

    const newExpiresAt = calculateNextExpiration(policyName)
    messages.push(`New expiration would be: ${newExpiresAt?.toISOString() || 'Unknown'}`)

    return {
      success: true,
      newExpiresAt,
      previousExpiresAt: currentExpiresAt,
      rotatedAt: now,
      messages,
      errors,
      nextSteps: [],
    }
  }

  // Strategy-specific rotation logic
  let rotationSuccess = false
  let newExpiresAt: Date | null = null

  switch (policy.strategy) {
    case 'manual':
      messages.push('Manual rotation required')

      // Check if new secret value provided
      if (!options.newSecretValue) {
        errors.push('Manual rotation requires newSecretValue in options')
        nextSteps.push('1. Generate new secret via provider dashboard')
        nextSteps.push('2. Call executeRotation() again with newSecretValue')
        nextSteps.push('3. Verify old secret is revoked')

        if (policy.metadata?.providerInstructions) {
          nextSteps.push(`Provider instructions: ${policy.metadata.providerInstructions}`)
        }
      } else {
        // New secret provided - rotation can proceed
        newExpiresAt = calculateNextExpiration(policyName)
        rotationSuccess = true
        messages.push('Manual rotation ready to commit')
        messages.push('New secret value will be stored in keychain')
        messages.push('Old secret should be revoked at provider')
      }
      break

    case 'automated':
      errors.push('Automated rotation not yet implemented')
      messages.push('Automated rotation requires integration with secret providers')
      nextSteps.push('Use manual rotation strategy for now')
      break

    case 'provider-managed':
      errors.push('Provider-managed rotation not yet implemented')
      messages.push('Provider-managed secrets must be rotated at the provider')
      nextSteps.push('1. Rotate secret via provider dashboard')
      nextSteps.push('2. Update local keychain with new value')
      nextSteps.push('3. Call executeRotation() to update metadata')

      if (policy.metadata?.providerInstructions) {
        nextSteps.push(`Instructions: ${policy.metadata.providerInstructions}`)
      }
      break

    case 'warning-only':
      messages.push('Warning-only policy - rotation recorded but not enforced')
      newExpiresAt = calculateNextExpiration(policyName)
      rotationSuccess = true
      break

    default:
      errors.push(`Unknown rotation strategy: ${policy.strategy}`)
  }

  // Log rotation result
  if (rotationSuccess) {
    logger.info('Rotation executed successfully', {
      secretKeyName,
      policyName,
      strategy: policy.strategy,
      previousExpiresAt: currentExpiresAt?.toISOString(),
      newExpiresAt: newExpiresAt?.toISOString(),
      reason: options.reason || 'manual',
    })

    messages.push('Rotation completed successfully')
    messages.push(`Previous expiration: ${currentExpiresAt?.toISOString() || 'None'}`)
    messages.push(`New expiration: ${newExpiresAt?.toISOString() || 'None'}`)
  } else {
    logger.warn('Rotation incomplete', {
      secretKeyName,
      policyName,
      errors,
    })
  }

  return {
    success: rotationSuccess,
    newExpiresAt,
    previousExpiresAt: currentExpiresAt,
    rotatedAt: now,
    messages,
    errors,
    nextSteps,
  }
}

/**
 * Generate rotation instructions for a secret based on its policy
 *
 * Provides step-by-step guidance for rotating a secret according to
 * its policy requirements and rotation strategy.
 *
 * @param secretKeyName - Secret identifier
 * @param policyName - Rotation policy
 * @returns Array of instruction steps
 */
export function generateRotationInstructions(
  secretKeyName: string,
  policyName: string
): string[] {
  const policy = getPolicy(policyName)
  const instructions: string[] = []

  if (!policy) {
    instructions.push(`⚠️  Policy '${policyName}' not found`)
    instructions.push('Use default rotation procedure')
    return instructions
  }

  instructions.push(`🔄 Rotation Instructions for: ${secretKeyName}`)
  instructions.push(`📋 Policy: ${policy.name} - ${policy.description}`)
  instructions.push(`⏰ Rotation Interval: ${policy.rotationIntervalDays} days`)
  instructions.push('')

  switch (policy.strategy) {
    case 'manual':
      instructions.push('📝 Manual Rotation Steps:')
      instructions.push('1. Log in to the service provider dashboard')
      instructions.push('2. Navigate to API/token management section')
      instructions.push('3. Generate a new token/key')
      instructions.push('4. Copy the new secret value')
      instructions.push('5. Update the secret in macOS Keychain')
      instructions.push('6. Test the new secret with your application')
      instructions.push('7. Revoke the old secret at the provider')
      instructions.push('8. Update rotation metadata in database')

      if (policy.metadata?.providerInstructions) {
        instructions.push('')
        instructions.push(`💡 Provider Instructions:`)
        instructions.push(`   ${policy.metadata.providerInstructions}`)
      }
      break

    case 'automated':
      instructions.push('🤖 Automated Rotation:')
      instructions.push('Rotation will be performed automatically via API')
      instructions.push('Monitor logs for rotation status')
      break

    case 'provider-managed':
      instructions.push('☁️  Provider-Managed Rotation:')
      instructions.push('1. Enable automatic rotation at the provider')
      instructions.push('2. Configure rotation notifications')
      instructions.push('3. Update local keychain when notified')
      instructions.push('4. Sync metadata with database')

      if (policy.metadata?.providerInstructions) {
        instructions.push('')
        instructions.push(`💡 Provider Instructions:`)
        instructions.push(`   ${policy.metadata.providerInstructions}`)
      }
      break

    case 'warning-only':
      instructions.push('⚠️  Warning-Only Policy:')
      instructions.push('Rotation is recommended but not enforced')
      instructions.push('Follow manual rotation steps when convenient')
      break
  }

  if (policy.metadata?.customValidation) {
    instructions.push('')
    instructions.push(`⚠️  Custom Validation Required:`)
    instructions.push(`   ${policy.metadata.customValidation}`)
  }

  if (policy.metadata?.requiresApproval) {
    instructions.push('')
    instructions.push('✅ APPROVAL REQUIRED before rotation')
  }

  if (policy.metadata?.allowProductionRotation === false) {
    instructions.push('')
    instructions.push('🚫 Production rotation NOT allowed - rotate in staging first')
  }

  return instructions
}
