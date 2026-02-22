/**
 * Unit Tests for SecretManager
 * Tests secret registration, metadata tracking, rotation management, and error handling
 */

import { jest } from '@jest/globals'
import { PrismaClient } from '@prisma/client'

// Mock Prisma before importing the module
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}))

// Mock keychain module
jest.mock('@/lib/security/macos-keychain', () => ({
  setSecret: jest.fn(),
  getSecret: jest.fn(),
  deleteSecret: jest.fn(),
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
import { SecretManager, createSecretManager } from '@/lib/security/secret-manager'
import * as keychain from '@/lib/security/macos-keychain'

const mockSetSecret = keychain.setSecret as jest.MockedFunction<typeof keychain.setSecret>
const mockGetSecret = keychain.getSecret as jest.MockedFunction<typeof keychain.getSecret>
const mockDeleteSecret = keychain.deleteSecret as jest.MockedFunction<typeof keychain.deleteSecret>

describe('SecretManager', () => {
  let mockPrisma: any
  let secretManager: SecretManager

  beforeEach(() => {
    jest.clearAllMocks()

    // Create mock Prisma client
    mockPrisma = {
      secretMetadata: {
        upsert: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      secretRotationHistory: {
        create: jest.fn(),
      },
    }

    secretManager = new SecretManager(mockPrisma as unknown as PrismaClient)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('registerSecret', () => {
    it('should register a secret successfully with default options', async () => {
      mockSetSecret.mockResolvedValue(undefined)
      mockPrisma.secretMetadata.upsert.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        status: 'active',
        created_at: new Date(),
      })

      await secretManager.registerSecret('TEST_SECRET', 'secret-value')

      expect(mockSetSecret).toHaveBeenCalledWith('TEST_SECRET', 'secret-value', undefined)
      expect(mockPrisma.secretMetadata.upsert).toHaveBeenCalledWith({
        where: { key_name: 'TEST_SECRET' },
        create: {
          key_name: 'TEST_SECRET',
          expires_at: undefined,
          rotation_policy: undefined,
          status: 'active',
          metadata: undefined,
        },
        update: {
          expires_at: undefined,
          rotation_policy: undefined,
          status: 'active',
          metadata: undefined,
        },
      })
    })

    it('should register a secret with expiration and rotation policy', async () => {
      const expiresAt = new Date('2026-12-31')
      mockSetSecret.mockResolvedValue(undefined)
      mockPrisma.secretMetadata.upsert.mockResolvedValue({
        id: 1,
        key_name: 'API_KEY',
        status: 'active',
        created_at: new Date(),
      })

      await secretManager.registerSecret('API_KEY', 'api-secret', {
        expiresAt,
        rotationPolicy: 'api_keys',
      })

      expect(mockSetSecret).toHaveBeenCalledWith('API_KEY', 'api-secret', undefined)
      expect(mockPrisma.secretMetadata.upsert).toHaveBeenCalledWith({
        where: { key_name: 'API_KEY' },
        create: {
          key_name: 'API_KEY',
          expires_at: expiresAt,
          rotation_policy: 'api_keys',
          status: 'active',
          metadata: undefined,
        },
        update: {
          expires_at: expiresAt,
          rotation_policy: 'api_keys',
          status: 'active',
          metadata: undefined,
        },
      })
    })

    it('should register a secret with custom metadata', async () => {
      mockSetSecret.mockResolvedValue(undefined)
      mockPrisma.secretMetadata.upsert.mockResolvedValue({
        id: 1,
        key_name: 'GITHUB_TOKEN',
        status: 'active',
        created_at: new Date(),
      })

      const metadata = { source: 'github', scopes: ['repo', 'user'] }

      await secretManager.registerSecret('GITHUB_TOKEN', 'ghp_token', {
        metadata,
      })

      expect(mockPrisma.secretMetadata.upsert).toHaveBeenCalledWith({
        where: { key_name: 'GITHUB_TOKEN' },
        create: expect.objectContaining({
          metadata,
        }),
        update: expect.objectContaining({
          metadata,
        }),
      })
    })

    it('should pass keychain options to setSecret', async () => {
      mockSetSecret.mockResolvedValue(undefined)
      mockPrisma.secretMetadata.upsert.mockResolvedValue({
        id: 1,
        key_name: 'SECURE_KEY',
        status: 'active',
        created_at: new Date(),
      })

      const keychainOptions = {
        service: 'custom.service',
        accessGroup: 'TEAM123.shared',
      }

      await secretManager.registerSecret('SECURE_KEY', 'secure-value', {
        keychainOptions,
      })

      expect(mockSetSecret).toHaveBeenCalledWith('SECURE_KEY', 'secure-value', keychainOptions)
    })

    it('should handle keychain storage errors', async () => {
      mockSetSecret.mockRejectedValue(new Error('Keychain access denied'))

      await expect(
        secretManager.registerSecret('TEST_SECRET', 'secret-value')
      ).rejects.toThrow('Secret registration failed for TEST_SECRET')

      expect(mockPrisma.secretMetadata.upsert).not.toHaveBeenCalled()
    })

    it('should handle database errors', async () => {
      mockSetSecret.mockResolvedValue(undefined)
      mockPrisma.secretMetadata.upsert.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(
        secretManager.registerSecret('TEST_SECRET', 'secret-value')
      ).rejects.toThrow('Secret registration failed for TEST_SECRET')
    })
  })

  describe('updateMetadata', () => {
    it('should update secret metadata successfully', async () => {
      mockPrisma.secretMetadata.update.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        status: 'expired',
        updated_at: new Date(),
      })

      await secretManager.updateMetadata('TEST_SECRET', {
        status: 'expired',
      })

      expect(mockPrisma.secretMetadata.update).toHaveBeenCalledWith({
        where: { key_name: 'TEST_SECRET' },
        data: {
          expires_at: undefined,
          rotation_policy: undefined,
          status: 'expired',
          metadata: undefined,
        },
      })
    })

    it('should update expiration date and rotation policy', async () => {
      const newExpiresAt = new Date('2027-01-01')
      mockPrisma.secretMetadata.update.mockResolvedValue({
        id: 1,
        key_name: 'API_KEY',
        expires_at: newExpiresAt,
        rotation_policy: 'auth_tokens',
        updated_at: new Date(),
      })

      await secretManager.updateMetadata('API_KEY', {
        expiresAt: newExpiresAt,
        rotationPolicy: 'auth_tokens',
      })

      expect(mockPrisma.secretMetadata.update).toHaveBeenCalledWith({
        where: { key_name: 'API_KEY' },
        data: {
          expires_at: newExpiresAt,
          rotation_policy: 'auth_tokens',
          status: undefined,
          metadata: undefined,
        },
      })
    })

    it('should handle metadata update errors', async () => {
      mockPrisma.secretMetadata.update.mockRejectedValue(
        new Error('Record not found')
      )

      await expect(
        secretManager.updateMetadata('NONEXISTENT', { status: 'active' })
      ).rejects.toThrow('Metadata update failed for NONEXISTENT')
    })

    it('should allow setting fields to null', async () => {
      mockPrisma.secretMetadata.update.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        expires_at: null,
        rotation_policy: null,
        updated_at: new Date(),
      })

      await secretManager.updateMetadata('TEST_SECRET', {
        expiresAt: null,
        rotationPolicy: null,
      })

      expect(mockPrisma.secretMetadata.update).toHaveBeenCalledWith({
        where: { key_name: 'TEST_SECRET' },
        data: {
          expires_at: null,
          rotation_policy: null,
          status: undefined,
          metadata: undefined,
        },
      })
    })
  })

  describe('getSecretWithMetadata', () => {
    it('should retrieve secret with metadata successfully', async () => {
      const createdAt = new Date('2026-01-01')
      const expiresAt = new Date('2026-12-31')
      const lastRotatedAt = new Date('2026-06-01')

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        created_at: createdAt,
        expires_at: expiresAt,
        last_rotated_at: lastRotatedAt,
        rotation_policy: 'api_keys',
        status: 'active',
        metadata: { source: 'manual' },
      })

      mockGetSecret.mockResolvedValue('secret-value')

      const result = await secretManager.getSecretWithMetadata('TEST_SECRET')

      expect(result).toEqual({
        keyName: 'TEST_SECRET',
        value: 'secret-value',
        metadata: {
          id: 1,
          createdAt,
          expiresAt,
          lastRotatedAt,
          rotationPolicy: 'api_keys',
          status: 'active',
          metadata: { source: 'manual' },
        },
      })

      expect(mockPrisma.secretMetadata.findUnique).toHaveBeenCalledWith({
        where: { key_name: 'TEST_SECRET' },
      })
      expect(mockGetSecret).toHaveBeenCalledWith('TEST_SECRET')
    })

    it('should return null when metadata is not found', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue(null)

      const result = await secretManager.getSecretWithMetadata('NONEXISTENT')

      expect(result).toBeNull()
      expect(mockGetSecret).not.toHaveBeenCalled()
    })

    it('should handle keychain retrieval returning null', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        created_at: new Date(),
        expires_at: null,
        last_rotated_at: null,
        rotation_policy: null,
        status: 'active',
        metadata: null,
      })

      mockGetSecret.mockResolvedValue(null)

      const result = await secretManager.getSecretWithMetadata('TEST_SECRET')

      expect(result?.value).toBeNull()
      expect(result?.keyName).toBe('TEST_SECRET')
    })

    it('should handle retrieval errors', async () => {
      mockPrisma.secretMetadata.findUnique.mockRejectedValue(
        new Error('Database error')
      )

      await expect(
        secretManager.getSecretWithMetadata('TEST_SECRET')
      ).rejects.toThrow('Secret retrieval failed for TEST_SECRET')
    })
  })

  describe('listAllSecrets', () => {
    it('should list all secrets without filters', async () => {
      const secrets = [
        {
          id: 1,
          key_name: 'SECRET_1',
          created_at: new Date('2026-01-01'),
          expires_at: new Date('2026-12-31'),
          last_rotated_at: null,
          rotation_policy: 'api_keys',
          status: 'active',
          metadata: null,
        },
        {
          id: 2,
          key_name: 'SECRET_2',
          created_at: new Date('2026-02-01'),
          expires_at: null,
          last_rotated_at: new Date('2026-02-15'),
          rotation_policy: 'auth_tokens',
          status: 'active',
          metadata: { source: 'github' },
        },
      ]

      mockPrisma.secretMetadata.findMany.mockResolvedValue(secrets)

      const result = await secretManager.listAllSecrets()

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        keyName: 'SECRET_1',
        createdAt: secrets[0].created_at,
        expiresAt: secrets[0].expires_at,
        lastRotatedAt: null,
        rotationPolicy: 'api_keys',
        status: 'active',
        metadata: null,
      })
      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: 'desc' },
      })
    })

    it('should filter by status', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      await secretManager.listAllSecrets({ status: 'expired' })

      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: { status: 'expired' },
        orderBy: { created_at: 'desc' },
      })
    })

    it('should filter by expiring before date', async () => {
      const expiringBefore = new Date('2026-03-01')
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      await secretManager.listAllSecrets({ expiringBefore })

      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {
          expires_at: {
            lte: expiringBefore,
          },
        },
        orderBy: { created_at: 'desc' },
      })
    })

    it('should filter by rotation policy', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      await secretManager.listAllSecrets({ rotationPolicy: 'api_keys' })

      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: { rotation_policy: 'api_keys' },
        orderBy: { created_at: 'desc' },
      })
    })

    it('should apply multiple filters', async () => {
      const expiringBefore = new Date('2026-03-01')
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      await secretManager.listAllSecrets({
        status: 'active',
        expiringBefore,
        rotationPolicy: 'api_keys',
      })

      expect(mockPrisma.secretMetadata.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          expires_at: {
            lte: expiringBefore,
          },
          rotation_policy: 'api_keys',
        },
        orderBy: { created_at: 'desc' },
      })
    })

    it('should handle listing errors', async () => {
      mockPrisma.secretMetadata.findMany.mockRejectedValue(
        new Error('Database connection failed')
      )

      await expect(secretManager.listAllSecrets()).rejects.toThrow(
        'Failed to list secrets'
      )
    })

    it('should return empty array when no secrets found', async () => {
      mockPrisma.secretMetadata.findMany.mockResolvedValue([])

      const result = await secretManager.listAllSecrets()

      expect(result).toEqual([])
    })
  })

  describe('markForRotation', () => {
    it('should mark a secret for rotation successfully', async () => {
      const expiresAt = new Date('2026-12-31')
      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        expires_at: expiresAt,
        status: 'active',
      })

      mockPrisma.secretMetadata.update.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        status: 'rotating',
      })

      mockPrisma.secretRotationHistory.create.mockResolvedValue({
        id: 1,
        secret_id: 1,
        rotated_at: new Date(),
      })

      await secretManager.markForRotation('TEST_SECRET', 'security review')

      expect(mockPrisma.secretMetadata.update).toHaveBeenCalledWith({
        where: { key_name: 'TEST_SECRET' },
        data: {
          status: 'rotating',
        },
      })

      expect(mockPrisma.secretRotationHistory.create).toHaveBeenCalledWith({
        data: {
          secret_id: 1,
          rotated_by: 'manual',
          previous_expires_at: expiresAt,
          reason: 'security review',
          metadata: {
            markedForRotation: true,
            requestedAt: expect.any(String),
          },
        },
      })
    })

    it('should use default reason when not provided', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        expires_at: null,
        status: 'active',
      })

      mockPrisma.secretMetadata.update.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        status: 'rotating',
      })

      mockPrisma.secretRotationHistory.create.mockResolvedValue({
        id: 1,
        secret_id: 1,
        rotated_at: new Date(),
      })

      await secretManager.markForRotation('TEST_SECRET')

      expect(mockPrisma.secretRotationHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reason: 'manual rotation requested',
        }),
      })
    })

    it('should throw error when secret not found', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue(null)

      await expect(
        secretManager.markForRotation('NONEXISTENT')
      ).rejects.toThrow('Failed to mark NONEXISTENT for rotation')
    })

    it('should handle database errors', async () => {
      mockPrisma.secretMetadata.findUnique.mockRejectedValue(
        new Error('Database error')
      )

      await expect(
        secretManager.markForRotation('TEST_SECRET')
      ).rejects.toThrow('Failed to mark TEST_SECRET for rotation')
    })
  })

  describe('deleteSecret', () => {
    it('should delete secret from keychain and database', async () => {
      mockDeleteSecret.mockResolvedValue(undefined)
      mockPrisma.secretMetadata.delete.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
      })

      await secretManager.deleteSecret('TEST_SECRET')

      expect(mockDeleteSecret).toHaveBeenCalledWith('TEST_SECRET')
      expect(mockPrisma.secretMetadata.delete).toHaveBeenCalledWith({
        where: { key_name: 'TEST_SECRET' },
      })
    })

    it('should handle keychain deletion errors', async () => {
      mockDeleteSecret.mockRejectedValue(new Error('Keychain error'))

      await expect(secretManager.deleteSecret('TEST_SECRET')).rejects.toThrow(
        'Secret deletion failed for TEST_SECRET'
      )

      expect(mockPrisma.secretMetadata.delete).not.toHaveBeenCalled()
    })

    it('should handle database deletion errors', async () => {
      mockDeleteSecret.mockResolvedValue(undefined)
      mockPrisma.secretMetadata.delete.mockRejectedValue(
        new Error('Record not found')
      )

      await expect(secretManager.deleteSecret('TEST_SECRET')).rejects.toThrow(
        'Secret deletion failed for TEST_SECRET'
      )
    })
  })

  describe('recordRotation', () => {
    it('should record rotation with new expiration date', async () => {
      const previousExpiresAt = new Date('2026-12-31')
      const newExpiresAt = new Date('2027-12-31')

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        expires_at: previousExpiresAt,
        status: 'rotating',
      })

      mockPrisma.secretRotationHistory.create.mockResolvedValue({
        id: 1,
        secret_id: 1,
        rotated_at: new Date(),
      })

      mockPrisma.secretMetadata.update.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        expires_at: newExpiresAt,
        status: 'active',
      })

      await secretManager.recordRotation(
        'TEST_SECRET',
        newExpiresAt,
        'admin',
        'scheduled rotation'
      )

      expect(mockPrisma.secretRotationHistory.create).toHaveBeenCalledWith({
        data: {
          secret_id: 1,
          rotated_by: 'admin',
          previous_expires_at: previousExpiresAt,
          new_expires_at: newExpiresAt,
          reason: 'scheduled rotation',
        },
      })

      expect(mockPrisma.secretMetadata.update).toHaveBeenCalledWith({
        where: { key_name: 'TEST_SECRET' },
        data: {
          expires_at: newExpiresAt,
          last_rotated_at: expect.any(Date),
          status: 'active',
        },
      })
    })

    it('should use default values for optional parameters', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        expires_at: null,
        status: 'active',
      })

      mockPrisma.secretRotationHistory.create.mockResolvedValue({
        id: 1,
        secret_id: 1,
        rotated_at: new Date(),
      })

      mockPrisma.secretMetadata.update.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        status: 'active',
      })

      await secretManager.recordRotation('TEST_SECRET', null)

      expect(mockPrisma.secretRotationHistory.create).toHaveBeenCalledWith({
        data: {
          secret_id: 1,
          rotated_by: 'system',
          previous_expires_at: null,
          new_expires_at: null,
          reason: 'scheduled rotation',
        },
      })
    })

    it('should throw error when secret not found', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue(null)

      await expect(
        secretManager.recordRotation('NONEXISTENT', null)
      ).rejects.toThrow('Failed to record rotation for NONEXISTENT')
    })

    it('should handle database errors', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        expires_at: null,
        status: 'active',
      })

      mockPrisma.secretRotationHistory.create.mockRejectedValue(
        new Error('Database error')
      )

      await expect(
        secretManager.recordRotation('TEST_SECRET', null)
      ).rejects.toThrow('Failed to record rotation for TEST_SECRET')
    })
  })

  describe('getRotationHistory', () => {
    it('should retrieve rotation history successfully', async () => {
      const rotatedAt1 = new Date('2026-06-01')
      const rotatedAt2 = new Date('2026-01-01')

      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        rotation_history: [
          {
            id: 2,
            secret_id: 1,
            rotated_at: rotatedAt1,
            rotated_by: 'admin',
            previous_expires_at: new Date('2026-12-31'),
            new_expires_at: new Date('2027-12-31'),
            reason: 'scheduled',
            metadata: null,
          },
          {
            id: 1,
            secret_id: 1,
            rotated_at: rotatedAt2,
            rotated_by: 'system',
            previous_expires_at: null,
            new_expires_at: new Date('2026-12-31'),
            reason: 'initial setup',
            metadata: { source: 'migration' },
          },
        ],
      })

      const result = await secretManager.getRotationHistory('TEST_SECRET')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        rotatedAt: rotatedAt1,
        rotatedBy: 'admin',
        previousExpiresAt: expect.any(Date),
        newExpiresAt: expect.any(Date),
        reason: 'scheduled',
        metadata: null,
      })
      expect(mockPrisma.secretMetadata.findUnique).toHaveBeenCalledWith({
        where: { key_name: 'TEST_SECRET' },
        include: {
          rotation_history: {
            orderBy: { rotated_at: 'desc' },
          },
        },
      })
    })

    it('should return empty array when secret not found', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue(null)

      const result = await secretManager.getRotationHistory('NONEXISTENT')

      expect(result).toEqual([])
    })

    it('should return empty array when no rotation history exists', async () => {
      mockPrisma.secretMetadata.findUnique.mockResolvedValue({
        id: 1,
        key_name: 'TEST_SECRET',
        rotation_history: [],
      })

      const result = await secretManager.getRotationHistory('TEST_SECRET')

      expect(result).toEqual([])
    })

    it('should handle database errors', async () => {
      mockPrisma.secretMetadata.findUnique.mockRejectedValue(
        new Error('Database error')
      )

      await expect(
        secretManager.getRotationHistory('TEST_SECRET')
      ).rejects.toThrow('Failed to get rotation history for TEST_SECRET')
    })
  })

  describe('createSecretManager', () => {
    it('should create a SecretManager instance', () => {
      const manager = createSecretManager(mockPrisma as unknown as PrismaClient)

      expect(manager).toBeInstanceOf(SecretManager)
    })
  })
})
