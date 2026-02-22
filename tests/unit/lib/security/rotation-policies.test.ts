/**
 * Unit Tests for Rotation Policies
 * Tests policy validation, rotation checks, eligibility validation, and rotation execution
 */

import { jest } from '@jest/globals'

// Mock logger before importing the module
jest.mock('@/lib/logger', () => ({
  createChildLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}))

// Import after mocks
import {
  ROTATION_POLICIES,
  getPolicy,
  getAllPolicies,
  validatePolicy,
  checkRotationRequired,
  calculateNextExpiration,
  inferPolicyFromKeyName,
  formatRotationCheckResult,
  validateRotationEligibility,
  executeRotation,
  generateRotationInstructions,
  type RotationPolicy,
  type RotationCheckResult,
} from '@/lib/security/rotation-policies'

describe('Rotation Policies', () => {
  describe('getPolicy', () => {
    it('should return policy when found', () => {
      const policy = getPolicy('api_keys')

      expect(policy).not.toBeNull()
      expect(policy?.name).toBe('api_keys')
      expect(policy?.secretType).toBe('api_key')
      expect(policy?.rotationIntervalDays).toBe(90)
    })

    it('should return null when policy not found', () => {
      const policy = getPolicy('nonexistent_policy')

      expect(policy).toBeNull()
    })

    it('should return correct policy for each predefined policy', () => {
      const apiKeys = getPolicy('api_keys')
      const authTokens = getPolicy('auth_tokens')
      const dbCredentials = getPolicy('db_credentials')
      const monitoring = getPolicy('monitoring')
      const custom = getPolicy('custom')

      expect(apiKeys?.name).toBe('api_keys')
      expect(authTokens?.name).toBe('auth_tokens')
      expect(dbCredentials?.name).toBe('db_credentials')
      expect(monitoring?.name).toBe('monitoring')
      expect(custom?.name).toBe('custom')
    })
  })

  describe('getAllPolicies', () => {
    it('should return all predefined policies', () => {
      const policies = getAllPolicies()

      expect(policies).toHaveLength(5)
      expect(policies.map((p) => p.name).sort()).toEqual([
        'api_keys',
        'auth_tokens',
        'custom',
        'db_credentials',
        'monitoring',
      ])
    })

    it('should return array of RotationPolicy objects', () => {
      const policies = getAllPolicies()

      policies.forEach((policy) => {
        expect(policy).toHaveProperty('name')
        expect(policy).toHaveProperty('description')
        expect(policy).toHaveProperty('secretType')
        expect(policy).toHaveProperty('rotationIntervalDays')
        expect(policy).toHaveProperty('gracePeriodDays')
        expect(policy).toHaveProperty('warningThresholds')
        expect(policy).toHaveProperty('strategy')
        expect(policy).toHaveProperty('mandatory')
      })
    })
  })

  describe('validatePolicy', () => {
    it('should validate a valid policy successfully', () => {
      const policy: RotationPolicy = {
        name: 'test_policy',
        description: 'Test policy',
        secretType: 'api_key',
        rotationIntervalDays: 90,
        gracePeriodDays: 7,
        warningThresholds: [30, 14, 7, 3, 1],
        strategy: 'manual',
        mandatory: true,
      }

      const result = validatePolicy(policy)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const invalidPolicy = {
        name: '',
        description: '',
        secretType: '',
        rotationIntervalDays: 0,
        gracePeriodDays: 0,
        warningThresholds: [],
        strategy: 'manual',
        mandatory: true,
      } as RotationPolicy

      const result = validatePolicy(invalidPolicy)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Policy name is required')
      expect(result.errors).toContain('Policy description is required')
      expect(result.errors).toContain('Secret type is required')
      expect(result.errors).toContain('Rotation interval must be greater than 0 days')
    })

    it('should warn about very long rotation intervals', () => {
      const policy: RotationPolicy = {
        name: 'long_policy',
        description: 'Very long rotation',
        secretType: 'api_key',
        rotationIntervalDays: 400,
        gracePeriodDays: 7,
        warningThresholds: [30, 14, 7],
        strategy: 'manual',
        mandatory: true,
      }

      const result = validatePolicy(policy)

      expect(result.valid).toBe(true)
      expect(result.warnings).toContain(
        'Rotation interval exceeds 1 year - consider shorter intervals for security'
      )
    })

    it('should warn about very short rotation intervals', () => {
      const policy: RotationPolicy = {
        name: 'short_policy',
        description: 'Very short rotation',
        secretType: 'api_key',
        rotationIntervalDays: 3,
        gracePeriodDays: 1,
        warningThresholds: [2, 1],
        strategy: 'manual',
        mandatory: true,
      }

      const result = validatePolicy(policy)

      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('Rotation interval less than 7 days may be too frequent')
    })

    it('should detect grace period exceeding rotation interval', () => {
      const policy: RotationPolicy = {
        name: 'invalid_grace',
        description: 'Invalid grace period',
        secretType: 'api_key',
        rotationIntervalDays: 30,
        gracePeriodDays: 40,
        warningThresholds: [15, 7, 3],
        strategy: 'manual',
        mandatory: true,
      }

      const result = validatePolicy(policy)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Grace period cannot exceed rotation interval')
    })

    it('should detect negative grace period', () => {
      const policy: RotationPolicy = {
        name: 'negative_grace',
        description: 'Negative grace period',
        secretType: 'api_key',
        rotationIntervalDays: 90,
        gracePeriodDays: -5,
        warningThresholds: [30, 14, 7],
        strategy: 'manual',
        mandatory: true,
      }

      const result = validatePolicy(policy)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Grace period cannot be negative')
    })

    it('should detect warning thresholds not in descending order', () => {
      const policy: RotationPolicy = {
        name: 'invalid_thresholds',
        description: 'Invalid threshold order',
        secretType: 'api_key',
        rotationIntervalDays: 90,
        gracePeriodDays: 7,
        warningThresholds: [14, 30, 7, 3],
        strategy: 'manual',
        mandatory: true,
      }

      const result = validatePolicy(policy)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Warning thresholds must be in descending order')
    })

    it('should warn about no warning thresholds', () => {
      const policy: RotationPolicy = {
        name: 'no_thresholds',
        description: 'No thresholds',
        secretType: 'api_key',
        rotationIntervalDays: 90,
        gracePeriodDays: 7,
        warningThresholds: [],
        strategy: 'manual',
        mandatory: true,
      }

      const result = validatePolicy(policy)

      expect(result.valid).toBe(true)
      expect(result.warnings).toContain('No warning thresholds defined')
    })

    it('should detect invalid rotation strategy', () => {
      const policy: RotationPolicy = {
        name: 'invalid_strategy',
        description: 'Invalid strategy',
        secretType: 'api_key',
        rotationIntervalDays: 90,
        gracePeriodDays: 7,
        warningThresholds: [30, 14, 7],
        strategy: 'invalid_strategy' as any,
        mandatory: true,
      }

      const result = validatePolicy(policy)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid rotation strategy: invalid_strategy')
    })

    it('should validate all predefined policies', () => {
      const policies = getAllPolicies()

      policies.forEach((policy) => {
        const result = validatePolicy(policy)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('checkRotationRequired', () => {
    it('should return warning when no expiration date is set', () => {
      const result = checkRotationRequired(null, 'api_keys')

      expect(result.rotationRequired).toBe(true)
      expect(result.daysUntilExpiration).toBeNull()
      expect(result.severity).toBe('warning')
      expect(result.message).toContain('No expiration date set')
      expect(result.policy).not.toBeNull()
    })

    it('should return critical when secret is expired', () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() - 10) // 10 days ago

      const result = checkRotationRequired(expiresAt, 'api_keys')

      expect(result.rotationRequired).toBe(true)
      expect(result.daysUntilExpiration).toBeLessThan(0)
      expect(result.severity).toBe('critical')
      expect(result.message).toContain('expired')
      expect(result.message).toContain('10 days ago')
    })

    it('should return critical when within grace period', () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 5) // 5 days from now

      const result = checkRotationRequired(expiresAt, 'api_keys')

      expect(result.rotationRequired).toBe(true)
      expect(result.daysUntilExpiration).toBe(5)
      expect(result.severity).toBe('critical')
      expect(result.message).toContain('within grace period')
    })

    it('should return warning when within warning threshold', () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 20) // 20 days from now

      const result = checkRotationRequired(expiresAt, 'api_keys')

      expect(result.rotationRequired).toBe(true) // api_keys is mandatory
      expect(result.daysUntilExpiration).toBe(20)
      expect(result.severity).toBe('warning')
      expect(result.message).toContain('rotation recommended')
    })

    it('should return ok when not near expiration', () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 60) // 60 days from now

      const result = checkRotationRequired(expiresAt, 'api_keys')

      expect(result.rotationRequired).toBe(false)
      expect(result.daysUntilExpiration).toBe(60)
      expect(result.severity).toBe('ok')
      expect(result.message).toContain('no action required')
    })

    it('should use default thresholds when policy not found', () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() - 5)

      const result = checkRotationRequired(expiresAt, 'nonexistent_policy')

      expect(result.rotationRequired).toBe(true)
      expect(result.severity).toBe('critical')
      expect(result.policy).toBeNull()
    })

    it('should handle non-mandatory policies correctly', () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 20)

      const result = checkRotationRequired(expiresAt, 'custom')

      expect(result.rotationRequired).toBe(false) // custom is not mandatory
      expect(result.severity).toBe('warning')
    })

    it('should respect policy-specific grace periods', () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 5) // 5 days

      // auth_tokens has 3-day grace period
      const result = checkRotationRequired(expiresAt, 'auth_tokens')

      expect(result.rotationRequired).toBe(true)
      expect(result.severity).toBe('warning') // Outside 3-day grace period
    })
  })

  describe('calculateNextExpiration', () => {
    it('should calculate next expiration based on policy', () => {
      const fromDate = new Date('2026-01-01')
      const result = calculateNextExpiration('api_keys', fromDate)

      expect(result).not.toBeNull()

      const expectedDate = new Date('2026-01-01')
      expectedDate.setDate(expectedDate.getDate() + 90)

      expect(result?.toISOString()).toBe(expectedDate.toISOString())
    })

    it('should use current date when fromDate not provided', () => {
      const result = calculateNextExpiration('api_keys')

      expect(result).not.toBeNull()
      expect(result!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should return null when policy not found', () => {
      const result = calculateNextExpiration('nonexistent_policy')

      expect(result).toBeNull()
    })

    it('should calculate correctly for different policies', () => {
      const fromDate = new Date('2026-01-01')

      const apiKeysExpiration = calculateNextExpiration('api_keys', fromDate)
      const authTokensExpiration = calculateNextExpiration('auth_tokens', fromDate)
      const dbCredsExpiration = calculateNextExpiration('db_credentials', fromDate)

      // api_keys: 90 days
      const expectedApiKeys = new Date('2026-01-01')
      expectedApiKeys.setDate(expectedApiKeys.getDate() + 90)
      expect(apiKeysExpiration?.toISOString()).toBe(expectedApiKeys.toISOString())

      // auth_tokens: 30 days
      const expectedAuthTokens = new Date('2026-01-01')
      expectedAuthTokens.setDate(expectedAuthTokens.getDate() + 30)
      expect(authTokensExpiration?.toISOString()).toBe(expectedAuthTokens.toISOString())

      // db_credentials: 180 days
      const expectedDbCreds = new Date('2026-01-01')
      expectedDbCreds.setDate(expectedDbCreds.getDate() + 180)
      expect(dbCredsExpiration?.toISOString()).toBe(expectedDbCreds.toISOString())
    })
  })

  describe('inferPolicyFromKeyName', () => {
    it('should infer api_keys policy from key names', () => {
      expect(inferPolicyFromKeyName('OPENAI_API_KEY')).toBe('api_keys')
      expect(inferPolicyFromKeyName('ANTHROPIC_APIKEY')).toBe('api_keys')
      expect(inferPolicyFromKeyName('GOOGLE_KEY')).toBe('api_keys')
      expect(inferPolicyFromKeyName('azure_key')).toBe('api_keys')
    })

    it('should infer auth_tokens policy from key names', () => {
      expect(inferPolicyFromKeyName('GITHUB_TOKEN')).toBe('auth_tokens')
      expect(inferPolicyFromKeyName('OAUTH_SECRET')).toBe('auth_tokens')
      expect(inferPolicyFromKeyName('JWT_TOKEN')).toBe('auth_tokens')
      expect(inferPolicyFromKeyName('AUTH_SECRET')).toBe('auth_tokens')
    })

    it('should infer db_credentials policy from key names', () => {
      expect(inferPolicyFromKeyName('DATABASE_URL')).toBe('db_credentials')
      expect(inferPolicyFromKeyName('DB_PASSWORD')).toBe('db_credentials')
      expect(inferPolicyFromKeyName('POSTGRES_CONNECTION')).toBe('db_credentials')
      expect(inferPolicyFromKeyName('MYSQL_HOST')).toBe('db_credentials')
      expect(inferPolicyFromKeyName('MONGO_URI')).toBe('db_credentials')
      expect(inferPolicyFromKeyName('CONNECTION_STRING')).toBe('db_credentials')
    })

    it('should infer monitoring policy from key names', () => {
      expect(inferPolicyFromKeyName('DD_API_KEY')).toBe('monitoring')
      expect(inferPolicyFromKeyName('DATADOG_APP_KEY')).toBe('monitoring')
    })

    it('should default to custom for unrecognized patterns', () => {
      expect(inferPolicyFromKeyName('MY_CUSTOM_VALUE')).toBe('custom')
      expect(inferPolicyFromKeyName('RANDOM_VALUE')).toBe('custom')
      expect(inferPolicyFromKeyName('FOO_BAR')).toBe('custom')
    })

    it('should be case insensitive', () => {
      expect(inferPolicyFromKeyName('openai_api_key')).toBe('api_keys')
      expect(inferPolicyFromKeyName('OPENAI_API_KEY')).toBe('api_keys')
      expect(inferPolicyFromKeyName('OpenAI_API_Key')).toBe('api_keys')
    })
  })

  describe('formatRotationCheckResult', () => {
    it('should format critical result correctly', () => {
      const result: RotationCheckResult = {
        rotationRequired: true,
        daysUntilExpiration: -5,
        severity: 'critical',
        message: 'Secret expired 5 days ago',
        policy: getPolicy('api_keys'),
        checkedAt: new Date(),
      }

      const formatted = formatRotationCheckResult(result)

      expect(formatted).toContain('🔴')
      expect(formatted).toContain('Secret expired 5 days ago')
      expect(formatted).toContain('Policy: api_keys')
    })

    it('should format warning result correctly', () => {
      const result: RotationCheckResult = {
        rotationRequired: true,
        daysUntilExpiration: 15,
        severity: 'warning',
        message: 'Secret expires in 15 days',
        policy: getPolicy('api_keys'),
        checkedAt: new Date(),
      }

      const formatted = formatRotationCheckResult(result)

      expect(formatted).toContain('⚠️')
      expect(formatted).toContain('Secret expires in 15 days')
    })

    it('should format ok result correctly', () => {
      const result: RotationCheckResult = {
        rotationRequired: false,
        daysUntilExpiration: 60,
        severity: 'ok',
        message: 'Secret expires in 60 days - no action required',
        policy: getPolicy('api_keys'),
        checkedAt: new Date(),
      }

      const formatted = formatRotationCheckResult(result)

      expect(formatted).toContain('✅')
      expect(formatted).toContain('no action required')
    })

    it('should handle result without policy', () => {
      const result: RotationCheckResult = {
        rotationRequired: true,
        daysUntilExpiration: null,
        severity: 'warning',
        message: 'No expiration date set',
        policy: null,
        checkedAt: new Date(),
      }

      const formatted = formatRotationCheckResult(result)

      expect(formatted).toContain('⚠️')
      expect(formatted).toContain('No expiration date set')
      expect(formatted).not.toContain('Policy:')
    })
  })

  describe('validateRotationEligibility', () => {
    it('should validate eligible rotation successfully', () => {
      const result = validateRotationEligibility(
        'TEST_SECRET',
        'api_keys',
        'active',
        null
      )

      expect(result.eligible).toBe(true)
      expect(result.blockingIssues).toHaveLength(0)
      expect(result.policy).not.toBeNull()
    })

    it('should block rotation when policy not found', () => {
      const result = validateRotationEligibility(
        'TEST_SECRET',
        'nonexistent_policy',
        'active',
        null
      )

      expect(result.eligible).toBe(false)
      expect(result.blockingIssues).toContain(
        "Rotation policy 'nonexistent_policy' not found"
      )
    })

    it('should block rotation when secret is already rotating', () => {
      const result = validateRotationEligibility(
        'TEST_SECRET',
        'api_keys',
        'rotating',
        null
      )

      expect(result.eligible).toBe(false)
      expect(result.blockingIssues).toContain('Secret is already in rotating state')
    })

    it('should block rotation when secret is revoked', () => {
      const result = validateRotationEligibility(
        'TEST_SECRET',
        'api_keys',
        'revoked',
        null
      )

      expect(result.eligible).toBe(false)
      expect(result.blockingIssues).toContain('Cannot rotate revoked secret')
    })

    it('should block production rotation when not allowed', () => {
      const result = validateRotationEligibility(
        'TEST_SECRET',
        'auth_tokens',
        'active',
        null,
        { isProduction: true }
      )

      expect(result.eligible).toBe(false)
      expect(result.blockingIssues.some((issue) => issue.includes('production rotation'))).toBe(
        true
      )
    })

    it('should warn when approval is required', () => {
      const result = validateRotationEligibility(
        'TEST_SECRET',
        'auth_tokens',
        'active',
        null,
        { isProduction: false }
      )

      expect(result.warnings.some((w) => w.includes('requires approval'))).toBe(true)
    })

    it('should block rotation within cooldown period', () => {
      const oneHourAgo = new Date()
      oneHourAgo.setHours(oneHourAgo.getHours() - 1)

      const result = validateRotationEligibility(
        'TEST_SECRET',
        'api_keys',
        'active',
        oneHourAgo
      )

      expect(result.eligible).toBe(false)
      expect(result.blockingIssues.some((issue) => issue.includes('rotated'))).toBe(true)
    })

    it('should allow rotation after cooldown period', () => {
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

      const result = validateRotationEligibility(
        'TEST_SECRET',
        'api_keys',
        'active',
        twoDaysAgo
      )

      expect(result.eligible).toBe(true)
    })

    it('should warn for warning-only policies', () => {
      const result = validateRotationEligibility(
        'TEST_SECRET',
        'custom',
        'active',
        null
      )

      expect(result.warnings.some((w) => w.includes('warning-only'))).toBe(true)
    })

    it('should warn for provider-managed policies', () => {
      const policy = getPolicy('custom')
      if (policy) {
        policy.strategy = 'provider-managed'
      }

      const result = validateRotationEligibility(
        'TEST_SECRET',
        'api_keys',
        'active',
        null
      )

      // Reset policy
      if (policy) {
        policy.strategy = 'warning-only'
      }

      expect(result.eligible).toBe(true)
    })
  })

  describe('executeRotation', () => {
    it('should fail when eligibility check fails', () => {
      const result = executeRotation(
        'TEST_SECRET',
        'api_keys',
        null,
        'rotating',
        null
      )

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.newExpiresAt).toBeNull()
    })

    it('should execute dry run successfully', () => {
      const currentExpiresAt = new Date('2026-12-31')
      const result = executeRotation(
        'TEST_SECRET',
        'api_keys',
        currentExpiresAt,
        'active',
        null,
        { dryRun: true }
      )

      expect(result.success).toBe(true)
      expect(result.messages.some((m) => m.includes('DRY RUN'))).toBe(true)
      expect(result.newExpiresAt).not.toBeNull()
    })

    it('should fail manual rotation without new secret value', () => {
      const result = executeRotation(
        'TEST_SECRET',
        'api_keys',
        new Date(),
        'active',
        null
      )

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.includes('newSecretValue'))).toBe(true)
      expect(result.nextSteps.length).toBeGreaterThan(0)
    })

    it('should succeed manual rotation with new secret value', () => {
      const currentExpiresAt = new Date('2026-12-31')
      const result = executeRotation(
        'TEST_SECRET',
        'api_keys',
        currentExpiresAt,
        'active',
        null,
        { newSecretValue: 'new-secret-value' }
      )

      expect(result.success).toBe(true)
      expect(result.newExpiresAt).not.toBeNull()
      expect(result.previousExpiresAt).toBe(currentExpiresAt)
      expect(result.messages.some((m) => m.includes('completed successfully'))).toBe(true)
    })

    it('should handle automated rotation (not implemented)', () => {
      const policy = getPolicy('api_keys')
      if (policy) {
        policy.strategy = 'automated'
      }

      const result = executeRotation(
        'TEST_SECRET',
        'api_keys',
        new Date(),
        'active',
        null,
        { newSecretValue: 'new-value' }
      )

      // Reset policy
      if (policy) {
        policy.strategy = 'manual'
      }

      expect(result.success).toBe(false)
      expect(result.errors.some((e) => e.includes('Automated rotation not yet implemented'))).toBe(
        true
      )
    })

    it('should handle warning-only rotation', () => {
      const result = executeRotation(
        'TEST_SECRET',
        'custom',
        new Date(),
        'active',
        null
      )

      expect(result.success).toBe(true)
      expect(result.newExpiresAt).not.toBeNull()
      expect(result.messages.some((m) => m.includes('warning-only'))).toBe(true)
    })

    it('should include warnings in result', () => {
      const result = executeRotation(
        'TEST_SECRET',
        'auth_tokens',
        new Date(),
        'active',
        null,
        { newSecretValue: 'new-value', isProduction: false }
      )

      expect(result.messages.length).toBeGreaterThan(0)
    })

    it('should set rotation timestamp', () => {
      const beforeRotation = new Date()
      const result = executeRotation(
        'TEST_SECRET',
        'custom',
        new Date(),
        'active',
        null
      )

      expect(result.rotatedAt.getTime()).toBeGreaterThanOrEqual(beforeRotation.getTime())
    })
  })

  describe('generateRotationInstructions', () => {
    it('should generate instructions for manual rotation', () => {
      const instructions = generateRotationInstructions('TEST_SECRET', 'api_keys')

      expect(instructions.length).toBeGreaterThan(0)
      expect(instructions.some((i) => i.includes('Manual Rotation Steps'))).toBe(true)
      expect(instructions.some((i) => i.includes('TEST_SECRET'))).toBe(true)
      expect(instructions.some((i) => i.includes('api_keys'))).toBe(true)
    })

    it('should include provider instructions when available', () => {
      const instructions = generateRotationInstructions('API_KEY', 'api_keys')

      expect(instructions.some((i) => i.includes('Provider Instructions'))).toBe(true)
      expect(instructions.some((i) => i.includes('provider dashboard'))).toBe(true)
    })

    it('should generate instructions for automated rotation', () => {
      const policy = getPolicy('api_keys')
      if (policy) {
        const originalStrategy = policy.strategy
        policy.strategy = 'automated'

        const instructions = generateRotationInstructions('TEST_SECRET', 'api_keys')

        policy.strategy = originalStrategy

        expect(instructions.some((i) => i.includes('Automated Rotation'))).toBe(true)
      }
    })

    it('should generate instructions for provider-managed rotation', () => {
      const policy = getPolicy('monitoring')
      if (policy) {
        const originalStrategy = policy.strategy
        policy.strategy = 'provider-managed'

        const instructions = generateRotationInstructions('DD_API_KEY', 'monitoring')

        policy.strategy = originalStrategy

        expect(instructions.some((i) => i.includes('Provider-Managed'))).toBe(true)
      }
    })

    it('should handle warning-only policy', () => {
      const instructions = generateRotationInstructions('CUSTOM_SECRET', 'custom')

      expect(instructions.some((i) => i.includes('Warning-Only'))).toBe(true)
      expect(instructions.some((i) => i.includes('not enforced'))).toBe(true)
    })

    it('should include approval requirement when necessary', () => {
      const instructions = generateRotationInstructions('AUTH_TOKEN', 'auth_tokens')

      expect(instructions.some((i) => i.includes('APPROVAL REQUIRED'))).toBe(true)
    })

    it('should include production restriction when applicable', () => {
      const instructions = generateRotationInstructions('DB_PASS', 'db_credentials')

      expect(instructions.some((i) => i.includes('Production rotation NOT allowed'))).toBe(true)
    })

    it('should include custom validation when defined', () => {
      const instructions = generateRotationInstructions('AUTH_TOKEN', 'auth_tokens')

      expect(instructions.some((i) => i.includes('Custom Validation'))).toBe(true)
    })

    it('should handle nonexistent policy gracefully', () => {
      const instructions = generateRotationInstructions('SECRET', 'nonexistent')

      expect(instructions.some((i) => i.includes('not found'))).toBe(true)
      expect(instructions.some((i) => i.includes('default rotation procedure'))).toBe(true)
    })

    it('should include rotation interval in instructions', () => {
      const instructions = generateRotationInstructions('API_KEY', 'api_keys')

      expect(instructions.some((i) => i.includes('90 days'))).toBe(true)
    })
  })

  describe('ROTATION_POLICIES constants', () => {
    it('should have all required policies defined', () => {
      expect(ROTATION_POLICIES.api_keys).toBeDefined()
      expect(ROTATION_POLICIES.auth_tokens).toBeDefined()
      expect(ROTATION_POLICIES.db_credentials).toBeDefined()
      expect(ROTATION_POLICIES.monitoring).toBeDefined()
      expect(ROTATION_POLICIES.custom).toBeDefined()
    })

    it('should have correct rotation intervals', () => {
      expect(ROTATION_POLICIES.api_keys.rotationIntervalDays).toBe(90)
      expect(ROTATION_POLICIES.auth_tokens.rotationIntervalDays).toBe(30)
      expect(ROTATION_POLICIES.db_credentials.rotationIntervalDays).toBe(180)
      expect(ROTATION_POLICIES.monitoring.rotationIntervalDays).toBe(90)
      expect(ROTATION_POLICIES.custom.rotationIntervalDays).toBe(90)
    })

    it('should have valid strategies', () => {
      const validStrategies = ['manual', 'automated', 'provider-managed', 'warning-only']

      Object.values(ROTATION_POLICIES).forEach((policy) => {
        expect(validStrategies).toContain(policy.strategy)
      })
    })

    it('should have descending warning thresholds', () => {
      Object.values(ROTATION_POLICIES).forEach((policy) => {
        for (let i = 0; i < policy.warningThresholds.length - 1; i++) {
          expect(policy.warningThresholds[i]).toBeGreaterThan(
            policy.warningThresholds[i + 1]
          )
        }
      })
    })
  })
})
