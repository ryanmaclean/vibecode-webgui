/**
 * Unit Tests for ExpirationChecker
 * Tests expiration detection, threshold logic, alert generation, and notification management
 */

import { jest } from '@jest/globals'
import { PrismaClient } from '@prisma/client'

// Mock Prisma before importing the module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  createChildLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}))

// Import after mocks
import { ExpirationChecker } from '@/lib/security/expiration-checker'
import type {
  ExpirationStatus,
  ExpirationAlert,
  ExpirationThresholds,
  NotificationConfig,
} from '@/lib/security/expiration-checker'

describe('ExpirationChecker', () => {
  let mockPrisma: any
  let expirationChecker: ExpirationChecker

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock Prisma client
    mockPrisma = {
      secretMetadata: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    }

    expirationChecker = new ExpirationChecker(mockPrisma as unknown as PrismaClient)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default thresholds', () => {
      const checker = new ExpirationChecker(mockPrisma as unknown as PrismaClient)
      expect(checker).toBeInstanceOf(ExpirationChecker)
    })

    it('should initialize with custom thresholds', () => {
      const customThresholds: Partial<ExpirationThresholds> = {
        critical: 3,
        warning: 7,
        info: 14,
      }

      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        customThresholds
      )
      expect(checker).toBeInstanceOf(ExpirationChecker)
    })

    it('should initialize with custom notification config', () => {
      const customConfig: Partial<NotificationConfig> = {
        enabled: false,
        minSeverity: 'warning',
        renotifyInterval: 120,
      }

      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        {},
        customConfig
      )
      expect(checker).toBeInstanceOf(ExpirationChecker)
    })
  })

  describe('checkExpiration', () => {
    it('should return null for non-existent secret', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue(null)

      const result = await expirationChecker.checkExpiration('NON_EXISTENT')

      expect(result).toBeNull()
      expect(mockPrisma.secretMetadata.findUnique).toHaveBeenCalledWith({
        where: { key_name: 'NON_EXISTENT' },
      })
    })

    it('should return no_expiration status for secret without expiration', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        created_at: new Date(),
        expires_at: null,
        last_rotated_at: null,
        rotation_policy: 'custom',
        status: 'active',
        metadata: {},
      })

      const result = await expirationChecker.checkExpiration('TEST_SECRET')

      expect(result).toEqual({
        keyName: 'TEST_SECRET',
        status: 'no_expiration',
        expiresAt: null,
        daysUntilExpiration: null,
        severity: null,
        rotationPolicy: 'custom',
        message: 'Secret has no expiration date configured',
      })
    })

    it('should return expired status for expired secret', async () => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 10)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'EXPIRED_SECRET',
        created_at: new Date(),
        expires_at: expiredDate,
        last_rotated_at: null,
        rotation_policy: 'api_keys',
        status: 'active',
        metadata: {},
      })

      const result = await expirationChecker.checkExpiration('EXPIRED_SECRET')

      expect(result).toMatchObject({
        keyName: 'EXPIRED_SECRET',
        status: 'expired',
        severity: 'critical',
        rotationPolicy: 'api_keys',
      })
      expect(result?.daysUntilExpiration).toBeLessThan(0)
      expect(result?.message).toContain('EXPIRED')
    })

    it('should return critical status for secret expiring within 7 days', async () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'CRITICAL_SECRET',
        created_at: new Date(),
        expires_at: expiresAt,
        last_rotated_at: null,
        rotation_policy: 'auth_tokens',
        status: 'active',
        metadata: {},
      })

      const result = await expirationChecker.checkExpiration('CRITICAL_SECRET')

      expect(result).toMatchObject({
        keyName: 'CRITICAL_SECRET',
        status: 'expiring_soon',
        severity: 'critical',
        rotationPolicy: 'auth_tokens',
      })
      expect(result?.daysUntilExpiration).toBeGreaterThan(0)
      expect(result?.daysUntilExpiration).toBeLessThanOrEqual(7)
      expect(result?.message).toContain('CRITICAL')
    })

    it('should return warning status for secret expiring within 14 days', async () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 10)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'WARNING_SECRET',
        created_at: new Date(),
        expires_at: expiresAt,
        last_rotated_at: null,
        rotation_policy: 'api_keys',
        status: 'active',
        metadata: {},
      })

      const result = await expirationChecker.checkExpiration('WARNING_SECRET')

      expect(result).toMatchObject({
        keyName: 'WARNING_SECRET',
        status: 'expiring_soon',
        severity: 'warning',
        rotationPolicy: 'api_keys',
      })
      expect(result?.daysUntilExpiration).toBeGreaterThan(7)
      expect(result?.daysUntilExpiration).toBeLessThanOrEqual(14)
      expect(result?.message).toContain('WARNING')
    })

    it('should return info status for secret expiring within 30 days', async () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 20)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'INFO_SECRET',
        created_at: new Date(),
        expires_at: expiresAt,
        last_rotated_at: null,
        rotation_policy: 'api_keys',
        status: 'active',
        metadata: {},
      })

      const result = await expirationChecker.checkExpiration('INFO_SECRET')

      expect(result).toMatchObject({
        keyName: 'INFO_SECRET',
        status: 'expiring_soon',
        severity: 'info',
        rotationPolicy: 'api_keys',
      })
      expect(result?.daysUntilExpiration).toBeGreaterThan(14)
      expect(result?.daysUntilExpiration).toBeLessThanOrEqual(30)
      expect(result?.message).toContain('INFO')
    })

    it('should return active status for secret expiring after 30 days', async () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 60)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'ACTIVE_SECRET',
        created_at: new Date(),
        expires_at: expiresAt,
        last_rotated_at: null,
        rotation_policy: 'db_credentials',
        status: 'active',
        metadata: {},
      })

      const result = await expirationChecker.checkExpiration('ACTIVE_SECRET')

      expect(result).toMatchObject({
        keyName: 'ACTIVE_SECRET',
        status: 'active',
        severity: null,
        rotationPolicy: 'db_credentials',
      })
      expect(result?.daysUntilExpiration).toBeGreaterThan(30)
      expect(result?.message).not.toContain('CRITICAL')
    })

    it('should use custom threshold from options', async () => {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'CUSTOM_THRESHOLD',
        created_at: new Date(),
        expires_at: expiresAt,
        last_rotated_at: null,
        rotation_policy: 'api_keys',
        status: 'active',
        metadata: {},
      })

      const result = await expirationChecker.checkExpiration('CUSTOM_THRESHOLD', {
        thresholdDays: 7,
      })

      expect(result).toBeDefined()
    })

    it('should handle database errors gracefully', async () => {
      mockPrisma.secretMetadata.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        expirationChecker.checkExpiration('TEST_SECRET')
      ).rejects.toThrow('Expiration check failed for TEST_SECRET')
    })
  })

  describe('getExpiringSoon', () => {
    it('should return secrets expiring within default threshold (30 days)', async () => {
      const now = new Date()
      const expiresAt1 = new Date(now)
      expiresAt1.setDate(expiresAt1.getDate() + 5)
      const expiresAt2 = new Date(now)
      expiresAt2.setDate(expiresAt2.getDate() + 15)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'SECRET_1',
          created_at: now,
          expires_at: expiresAt1,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 2,
          key_name: 'SECRET_2',
          created_at: now,
          expires_at: expiresAt2,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      // Mock findUnique calls for checkExpiration
      mockPrisma.secretMetadata.findUnique
        .mockResolvedValueOnce({
          id: 1,
          key_name: 'SECRET_1',
          created_at: now,
          expires_at: expiresAt1,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 2,
          key_name: 'SECRET_2',
          created_at: now,
          expires_at: expiresAt2,
          status: 'active',
          rotation_policy: 'api_keys',
        })

      const results = await expirationChecker.getExpiringSoon()

      expect(results).toHaveLength(2)
      expect(results[0].keyName).toBe('SECRET_1')
      expect(results[1].keyName).toBe('SECRET_2')
      expect(results[0].status).toBe('expiring_soon')
      expect(results[1].status).toBe('expiring_soon')
    })

    it('should return secrets expiring within custom threshold', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'SECRET_1',
          created_at: now,
          expires_at: expiresAt,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'SECRET_1',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const results = await expirationChecker.getExpiringSoon({ thresholdDays: 7 })

      expect(results).toHaveLength(1)
      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalled()
    })

    it('should exclude revoked secrets', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      const results = await expirationChecker.getExpiringSoon()

      expect(results).toHaveLength(0)
      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {
          expires_at: expect.any(Object),
          status: {
            not: 'revoked',
          },
        },
        orderBy: {
          expires_at: 'asc',
        },
      })
    })

    it('should return empty array when no secrets expiring soon', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      const results = await expirationChecker.getExpiringSoon()

      expect(results).toEqual([])
    })

    it('should handle database errors', async () => {
      mockPrisma.secretMetadata.findMany.mockRejectedValue(
        new Error('Database query failed')
      )

      await expect(expirationChecker.getExpiringSoon()).rejects.toThrow(
        'Failed to retrieve expiring soon secrets'
      )
    })
  })

  describe('getExpired', () => {
    it('should return all expired secrets', async () => {
      const now = new Date()
      const expiredDate1 = new Date(now)
      expiredDate1.setDate(expiredDate1.getDate() - 5)
      const expiredDate2 = new Date(now)
      expiredDate2.setDate(expiredDate2.getDate() - 10)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'EXPIRED_1',
          created_at: now,
          expires_at: expiredDate1,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 2,
          key_name: 'EXPIRED_2',
          created_at: now,
          expires_at: expiredDate2,
          status: 'active',
          rotation_policy: 'auth_tokens',
        },
      ])

      mockPrisma.secretMetadata.findUnique
        .mockResolvedValueOnce({
          id: 1,
          key_name: 'EXPIRED_1',
          created_at: now,
          expires_at: expiredDate1,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 2,
          key_name: 'EXPIRED_2',
          created_at: now,
          expires_at: expiredDate2,
          status: 'active',
          rotation_policy: 'auth_tokens',
        })

      const results = await expirationChecker.getExpired()

      expect(results).toHaveLength(2)
      expect(results[0].status).toBe('expired')
      expect(results[1].status).toBe('expired')
      expect(results[0].severity).toBe('critical')
      expect(results[1].severity).toBe('critical')
    })

    it('should exclude revoked secrets', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      await expirationChecker.getExpired()

      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {
          expires_at: {
            lt: expect.any(Date),
          },
          status: {
            not: 'revoked',
          },
        },
        orderBy: {
          expires_at: 'asc',
        },
      })
    })

    it('should return empty array when no expired secrets', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      const results = await expirationChecker.getExpired()

      expect(results).toEqual([])
    })

    it('should handle database errors', async () => {
      mockPrisma.secretMetadata.findMany.mockRejectedValue(
        new Error('Database query failed')
      )

      await expect(expirationChecker.getExpired()).rejects.toThrow(
        'Failed to retrieve expired secrets'
      )
    })
  })

  describe('getSummary', () => {
    it('should return comprehensive summary with all counts', async () => {
      const now = new Date()
      const activeDate = new Date(now)
      activeDate.setDate(activeDate.getDate() + 60)
      const expiringSoonDate = new Date(now)
      expiringSoonDate.setDate(expiringSoonDate.getDate() + 5)
      const expiredDate = new Date(now)
      expiredDate.setDate(expiredDate.getDate() - 5)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'ACTIVE',
          created_at: now,
          expires_at: activeDate,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 2,
          key_name: 'EXPIRING',
          created_at: now,
          expires_at: expiringSoonDate,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 3,
          key_name: 'EXPIRED',
          created_at: now,
          expires_at: expiredDate,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 4,
          key_name: 'NO_EXPIRY',
          created_at: now,
          expires_at: null,
          status: 'active',
          rotation_policy: 'custom',
        },
      ])

      mockPrisma.secretMetadata.findUnique
        .mockResolvedValueOnce({
          id: 1,
          key_name: 'ACTIVE',
          created_at: now,
          expires_at: activeDate,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 2,
          key_name: 'EXPIRING',
          created_at: now,
          expires_at: expiringSoonDate,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 3,
          key_name: 'EXPIRED',
          created_at: now,
          expires_at: expiredDate,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 4,
          key_name: 'NO_EXPIRY',
          created_at: now,
          expires_at: null,
          status: 'active',
          rotation_policy: 'custom',
        })

      const summary = await expirationChecker.getSummary()

      expect(summary.total).toBe(4)
      expect(summary.active).toBe(1)
      expect(summary.expiringSoon).toBe(1)
      expect(summary.expired).toBe(1)
      expect(summary.noExpiration).toBe(1)
      expect(summary.alerts).toHaveLength(2) // expiring + expired
      expect(summary.timestamp).toBeInstanceOf(Date)
    })

    it('should sort alerts by severity and days until expiration', async () => {
      const now = new Date()
      const critical1 = new Date(now)
      critical1.setDate(critical1.getDate() + 3)
      const critical2 = new Date(now)
      critical2.setDate(critical2.getDate() + 1)
      const warning = new Date(now)
      warning.setDate(warning.getDate() + 10)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'CRITICAL_1',
          created_at: now,
          expires_at: critical1,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 2,
          key_name: 'WARNING',
          created_at: now,
          expires_at: warning,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 3,
          key_name: 'CRITICAL_2',
          created_at: now,
          expires_at: critical2,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique
        .mockResolvedValueOnce({
          id: 1,
          key_name: 'CRITICAL_1',
          created_at: now,
          expires_at: critical1,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 2,
          key_name: 'WARNING',
          created_at: now,
          expires_at: warning,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 3,
          key_name: 'CRITICAL_2',
          created_at: now,
          expires_at: critical2,
          status: 'active',
          rotation_policy: 'api_keys',
        })

      const summary = await expirationChecker.getSummary()

      expect(summary.alerts).toHaveLength(3)
      expect(summary.alerts[0].severity).toBe('critical')
      expect(summary.alerts[0].keyName).toBe('CRITICAL_2') // Most urgent first (1 day)
      expect(summary.alerts[1].severity).toBe('critical')
      expect(summary.alerts[1].keyName).toBe('CRITICAL_1') // Next (3 days)
      expect(summary.alerts[2].severity).toBe('warning')
      expect(summary.alerts[2].keyName).toBe('WARNING') // Last (10 days)
    })

    it('should handle empty secrets list', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      const summary = await expirationChecker.getSummary()

      expect(summary.total).toBe(0)
      expect(summary.active).toBe(0)
      expect(summary.expiringSoon).toBe(0)
      expect(summary.expired).toBe(0)
      expect(summary.noExpiration).toBe(0)
      expect(summary.alerts).toEqual([])
    })

    it('should handle database errors', async () => {
      mockPrisma.secretMetadata.findMany.mockRejectedValue(
        new Error('Database error')
      )

      await expect(expirationChecker.getSummary()).rejects.toThrow(
        'Failed to generate expiration summary'
      )
    })
  })

  describe('sendAlerts', () => {
    it('should send alerts for expiring and expired secrets', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'EXPIRING',
          created_at: now,
          expires_at: expiresAt,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'EXPIRING',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const alerts = await expirationChecker.sendAlerts()

      expect(alerts).toHaveLength(1)
      expect(alerts[0].keyName).toBe('EXPIRING')
      expect(alerts[0].severity).toBe('critical')
    })

    it('should return empty array when notifications disabled', async () => {
      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        {},
        { enabled: false }
      )

      const alerts = await checker.sendAlerts()

      expect(alerts).toEqual([])
    })

    it('should filter alerts by minimum severity', async () => {
      const now = new Date()
      const critical = new Date(now)
      critical.setDate(critical.getDate() + 3)
      const warning = new Date(now)
      warning.setDate(warning.getDate() + 10)
      const info = new Date(now)
      info.setDate(info.getDate() + 20)

      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        {},
        { enabled: true, minSeverity: 'warning' }
      )

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'CRITICAL',
          created_at: now,
          expires_at: critical,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 2,
          key_name: 'WARNING',
          created_at: now,
          expires_at: warning,
          status: 'active',
          rotation_policy: 'api_keys',
        },
        {
          id: 3,
          key_name: 'INFO',
          created_at: now,
          expires_at: info,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique
        .mockResolvedValueOnce({
          id: 1,
          key_name: 'CRITICAL',
          created_at: now,
          expires_at: critical,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 2,
          key_name: 'WARNING',
          created_at: now,
          expires_at: warning,
          status: 'active',
          rotation_policy: 'api_keys',
        })
        .mockResolvedValueOnce({
          id: 3,
          key_name: 'INFO',
          created_at: now,
          expires_at: info,
          status: 'active',
          rotation_policy: 'api_keys',
        })

      const alerts = await checker.sendAlerts()

      expect(alerts).toHaveLength(2) // critical + warning only
      expect(alerts.find((a) => a.severity === 'info')).toBeUndefined()
    })

    it('should apply renotification throttling', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 10) // Warning level

      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        {},
        { enabled: true, renotifyInterval: 60 } // 60 minutes
      )

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'WARNING',
          created_at: now,
          expires_at: expiresAt,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'WARNING',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      // First alert should be sent
      const alerts1 = await checker.sendAlerts()
      expect(alerts1).toHaveLength(1)

      // Second alert immediately after should be throttled
      const alerts2 = await checker.sendAlerts()
      expect(alerts2).toHaveLength(0)
    })

    it('should always send critical alerts regardless of throttling', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 3) // Critical level

      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        {},
        { enabled: true, renotifyInterval: 60 }
      )

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'CRITICAL',
          created_at: now,
          expires_at: expiresAt,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'CRITICAL',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      // First alert
      const alerts1 = await checker.sendAlerts()
      expect(alerts1).toHaveLength(1)

      // Critical alerts should NOT be throttled
      const alerts2 = await checker.sendAlerts()
      expect(alerts2).toHaveLength(1)
    })

    it('should return empty array when no alerts to send', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      const alerts = await expirationChecker.sendAlerts()

      expect(alerts).toEqual([])
    })

    it('should handle database errors', async () => {
      mockPrisma.secretMetadata.findMany.mockRejectedValue(
        new Error('Database error')
      )

      await expect(expirationChecker.sendAlerts()).rejects.toThrow(
        'Failed to send expiration alerts'
      )
    })
  })

  describe('getSecretsByStatus', () => {
    it('should return expired secrets when filtering by expired status', async () => {
      const now = new Date()
      const expiredDate = new Date(now)
      expiredDate.setDate(expiredDate.getDate() - 5)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'EXPIRED',
          created_at: now,
          expires_at: expiredDate,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'EXPIRED',
        created_at: now,
        expires_at: expiredDate,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const results = await expirationChecker.getSecretsByStatus('expired')

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('expired')
      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {
          expires_at: {
            lt: expect.any(Date),
          },
          status: {
            not: 'revoked',
          },
        },
        orderBy: {
          expires_at: 'asc',
        },
      })
    })

    it('should return expiring_soon secrets when filtering by expiring_soon status', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'EXPIRING',
          created_at: now,
          expires_at: expiresAt,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'EXPIRING',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const results = await expirationChecker.getSecretsByStatus('expiring_soon')

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('expiring_soon')
      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {
          expires_at: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          status: {
            not: 'revoked',
          },
        },
        orderBy: {
          expires_at: 'asc',
        },
      })
    })

    it('should return active secrets when filtering by active status', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 60)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'ACTIVE',
          created_at: now,
          expires_at: expiresAt,
          status: 'active',
          rotation_policy: 'db_credentials',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'ACTIVE',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'db_credentials',
      })

      const results = await expirationChecker.getSecretsByStatus('active')

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('active')
      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {
          expires_at: {
            gt: expect.any(Date),
          },
          status: {
            not: 'revoked',
          },
        },
        orderBy: {
          expires_at: 'asc',
        },
      })
    })

    it('should return no_expiration secrets when filtering by no_expiration status', async () => {
      const now = new Date()

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'NO_EXPIRY',
          created_at: now,
          expires_at: null,
          status: 'active',
          rotation_policy: 'custom',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'NO_EXPIRY',
        created_at: now,
        expires_at: null,
        status: 'active',
        rotation_policy: 'custom',
      })

      const results = await expirationChecker.getSecretsByStatus('no_expiration')

      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('no_expiration')
      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {
          expires_at: null,
          status: {
            not: 'revoked',
          },
        },
        orderBy: {
          expires_at: 'asc',
        },
      })
    })

    it('should use custom threshold from options', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findMany.mockResolvedValue([
        {
          id: 1,
          key_name: 'EXPIRING',
          created_at: now,
          expires_at: expiresAt,
          status: 'active',
          rotation_policy: 'api_keys',
        },
      ])

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'EXPIRING',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const results = await expirationChecker.getSecretsByStatus('expiring_soon', {
        thresholdDays: 7,
      })

      expect(results).toBeDefined()
    })

    it('should return empty array when no matching secrets', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      const results = await expirationChecker.getSecretsByStatus('expired')

      expect(results).toEqual([])
    })

    it('should handle database errors', async () => {
      mockPrisma.secretMetadata.findMany.mockRejectedValue(
        new Error('Database error')
      )

      await expect(
        expirationChecker.getSecretsByStatus('expired')
      ).rejects.toThrow('Failed to retrieve secrets with status: expired')
    })
  })

  describe('custom thresholds', () => {
    it('should use custom thresholds for severity determination', async () => {
      const customThresholds: ExpirationThresholds = {
        critical: 3,
        warning: 7,
        info: 14,
      }

      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        customThresholds
      )

      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5) // Would be warning with custom thresholds

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'CUSTOM',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const result = await checker.checkExpiration('CUSTOM')

      expect(result).toMatchObject({
        keyName: 'CUSTOM',
        status: 'expiring_soon',
        severity: 'warning', // With custom thresholds, 5 days = warning (3 < 5 <= 7)
      })
    })

    it('should handle edge case exactly at threshold boundary', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 7) // Exactly at critical threshold

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'BOUNDARY',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const result = await expirationChecker.checkExpiration('BOUNDARY')

      expect(result).toMatchObject({
        keyName: 'BOUNDARY',
        status: 'expiring_soon',
        severity: 'critical', // <= 7 days = critical
        daysUntilExpiration: 7,
      })
    })
  })

  describe('notification configuration', () => {
    it('should include recommendations when configured', async () => {
      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        {},
        { includeRecommendations: true }
      )

      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const result = await checker.checkExpiration('TEST')

      expect(result?.message).toContain('**Action Required**')
      expect(result?.message).toContain('**Next Steps**')
    })

    it('should exclude recommendations when configured', async () => {
      const checker = new ExpirationChecker(
        mockPrisma as unknown as PrismaClient,
        {},
        { includeRecommendations: false }
      )

      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const result = await checker.checkExpiration('TEST')

      expect(result?.message).not.toContain('**Action Required**')
      expect(result?.message).not.toContain('**Next Steps**')
    })
  })

  describe('alert message formatting', () => {
    it('should include rotation policy in alert message', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: 'api_keys',
      })

      const result = await expirationChecker.checkExpiration('TEST')

      expect(result?.message).toContain('**Rotation Policy**: api_keys')
    })

    it('should suggest configuring rotation policy when missing', async () => {
      const now = new Date()
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + 5)

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST',
        created_at: now,
        expires_at: expiresAt,
        status: 'active',
        rotation_policy: null,
      })

      const result = await expirationChecker.checkExpiration('TEST')

      expect(result?.message).toContain(
        'Configure a rotation policy for automated management'
      )
    })
  })
})
