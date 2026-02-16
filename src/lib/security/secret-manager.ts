/**
 * Secret Manager - Centralized secret lifecycle management
 *
 * Provides unified interface for secret storage, metadata tracking, and rotation management.
 * Integrates macOS Keychain for secure storage with database tracking for expiration and rotation.
 *
 * Features:
 * - CRUD operations for secrets with metadata
 * - Expiration tracking and rotation policies
 * - Audit trail via rotation history
 * - Integration with macOS Keychain
 * - Structured logging
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { createChildLogger } from '@/lib/logger'
import * as keychain from './macos-keychain'

const logger = createChildLogger({ module: 'security', scope: 'secret-manager' })

// Secret registration options
export interface SecretRegistrationOptions {
  expiresAt?: Date
  rotationPolicy?: string
  metadata?: Prisma.InputJsonValue
  keychainOptions?: {
    service?: string
    accessGroup?: string
    accessibility?: 'whenUnlocked' | 'afterFirstUnlock' | 'whenUnlockedThisDeviceOnly'
  }
}

// Secret metadata update options
export interface SecretMetadataUpdate {
  expiresAt?: Date | null
  rotationPolicy?: string | null
  status?: 'active' | 'expired' | 'rotating' | 'revoked'
  metadata?: Prisma.InputJsonValue
}

// Secret with metadata response
export interface SecretWithMetadata {
  keyName: string
  value: string | null
  metadata: {
    id: number
    createdAt: Date
    expiresAt: Date | null
    lastRotatedAt: Date | null
    rotationPolicy: string | null
    status: string
    metadata: Prisma.JsonValue | null
  }
}

/**
 * SecretManager class - Manages secret lifecycle with metadata tracking
 */
export class SecretManager {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Register a new secret with metadata tracking
   *
   * @param keyName - Unique identifier for the secret (e.g., "GITHUB_TOKEN")
   * @param value - Secret value to store
   * @param options - Registration options including expiration and rotation policy
   */
  async registerSecret(
    keyName: string,
    value: string,
    options: SecretRegistrationOptions = {}
  ): Promise<void> {
    try {
      // Store secret in macOS Keychain
      await keychain.setSecret(keyName, value, options.keychainOptions)

      // Create or update metadata record
      await this.prisma.secretMetadata.upsert({
        where: { key_name: keyName },
        create: {
          key_name: keyName,
          expires_at: options.expiresAt,
          rotation_policy: options.rotationPolicy,
          status: 'active',
          metadata: options.metadata,
        },
        update: {
          expires_at: options.expiresAt,
          rotation_policy: options.rotationPolicy,
          status: 'active',
          metadata: options.metadata,
        },
      })

      logger.info('Secret registered successfully', {
        keyName,
        expiresAt: options.expiresAt,
        rotationPolicy: options.rotationPolicy,
      })
    } catch (error) {
      logger.error('Failed to register secret', {
        error: error instanceof Error ? error.message : error,
        keyName,
      })
      throw new Error(`Secret registration failed for ${keyName}`)
    }
  }

  /**
   * Update metadata for an existing secret
   *
   * @param keyName - Secret identifier
   * @param updates - Metadata fields to update
   */
  async updateMetadata(
    keyName: string,
    updates: SecretMetadataUpdate
  ): Promise<void> {
    try {
      await this.prisma.secretMetadata.update({
        where: { key_name: keyName },
        data: {
          expires_at: updates.expiresAt,
          rotation_policy: updates.rotationPolicy,
          status: updates.status,
          metadata: updates.metadata,
        },
      })

      logger.info('Secret metadata updated', {
        keyName,
        updates,
      })
    } catch (error) {
      logger.error('Failed to update secret metadata', {
        error: error instanceof Error ? error.message : error,
        keyName,
      })
      throw new Error(`Metadata update failed for ${keyName}`)
    }
  }

  /**
   * Retrieve secret with its metadata
   *
   * @param keyName - Secret identifier
   * @returns Secret value and metadata, or null if not found
   */
  async getSecretWithMetadata(
    keyName: string
  ): Promise<SecretWithMetadata | null> {
    try {
      // Get metadata from database
      const metadata = await this.prisma.secretMetadata.findUnique({
        where: { key_name: keyName },
      })

      if (!metadata) {
        logger.debug('Secret metadata not found', { keyName })
        return null
      }

      // Get secret value from keychain
      const value = await keychain.getSecret(keyName)

      return {
        keyName,
        value,
        metadata: {
          id: metadata.id,
          createdAt: metadata.created_at,
          expiresAt: metadata.expires_at,
          lastRotatedAt: metadata.last_rotated_at,
          rotationPolicy: metadata.rotation_policy,
          status: metadata.status,
          metadata: metadata.metadata,
        },
      }
    } catch (error) {
      logger.error('Failed to retrieve secret with metadata', {
        error: error instanceof Error ? error.message : error,
        keyName,
      })
      throw new Error(`Secret retrieval failed for ${keyName}`)
    }
  }

  /**
   * List all secrets with metadata
   *
   * @param filters - Optional filters for status, expiration, etc.
   * @returns Array of secret metadata records
   */
  async listAllSecrets(filters?: {
    status?: string
    expiringBefore?: Date
    rotationPolicy?: string
  }): Promise<Array<{
    keyName: string
    createdAt: Date
    expiresAt: Date | null
    lastRotatedAt: Date | null
    rotationPolicy: string | null
    status: string
    metadata: Prisma.JsonValue | null
  }>> {
    try {
      const where: Prisma.SecretMetadataWhereInput = {}

      if (filters?.status) {
        where.status = filters.status
      }

      if (filters?.expiringBefore) {
        where.expires_at = {
          lte: filters.expiringBefore,
        }
      }

      if (filters?.rotationPolicy) {
        where.rotation_policy = filters.rotationPolicy
      }

      const secrets = await this.prisma.secretMetadata.findMany({
        where,
        orderBy: { created_at: 'desc' },
      })

      logger.debug('Listed secrets', {
        count: secrets.length,
        filters,
      })

      return secrets.map((secret) => ({
        keyName: secret.key_name,
        createdAt: secret.created_at,
        expiresAt: secret.expires_at,
        lastRotatedAt: secret.last_rotated_at,
        rotationPolicy: secret.rotation_policy,
        status: secret.status,
        metadata: secret.metadata,
      }))
    } catch (error) {
      logger.error('Failed to list secrets', {
        error: error instanceof Error ? error.message : error,
        filters,
      })
      throw new Error('Failed to list secrets')
    }
  }

  /**
   * Mark a secret for rotation
   *
   * @param keyName - Secret identifier
   * @param reason - Reason for rotation request
   */
  async markForRotation(keyName: string, reason?: string): Promise<void> {
    try {
      const metadata = await this.prisma.secretMetadata.findUnique({
        where: { key_name: keyName },
      })

      if (!metadata) {
        throw new Error(`Secret ${keyName} not found`)
      }

      // Update status to rotating
      await this.prisma.secretMetadata.update({
        where: { key_name: keyName },
        data: {
          status: 'rotating',
        },
      })

      // Create rotation history record to track the rotation request
      await this.prisma.secretRotationHistory.create({
        data: {
          secret_id: metadata.id,
          rotated_by: 'manual',
          previous_expires_at: metadata.expires_at,
          reason: reason || 'manual rotation requested',
          metadata: {
            markedForRotation: true,
            requestedAt: new Date().toISOString(),
          },
        },
      })

      logger.info('Secret marked for rotation', {
        keyName,
        reason,
      })
    } catch (error) {
      logger.error('Failed to mark secret for rotation', {
        error: error instanceof Error ? error.message : error,
        keyName,
      })
      throw new Error(`Failed to mark ${keyName} for rotation`)
    }
  }

  /**
   * Delete a secret and its metadata
   *
   * @param keyName - Secret identifier
   */
  async deleteSecret(keyName: string): Promise<void> {
    try {
      // Delete from keychain
      await keychain.deleteSecret(keyName)

      // Delete metadata (cascade will delete rotation history)
      await this.prisma.secretMetadata.delete({
        where: { key_name: keyName },
      })

      logger.info('Secret deleted', { keyName })
    } catch (error) {
      logger.error('Failed to delete secret', {
        error: error instanceof Error ? error.message : error,
        keyName,
      })
      throw new Error(`Secret deletion failed for ${keyName}`)
    }
  }

  /**
   * Record a completed rotation in history
   *
   * @param keyName - Secret identifier
   * @param newExpiresAt - New expiration date after rotation
   * @param rotatedBy - User identifier or "system" for automated rotations
   * @param reason - Reason for rotation
   */
  async recordRotation(
    keyName: string,
    newExpiresAt: Date | null,
    rotatedBy: string = 'system',
    reason?: string
  ): Promise<void> {
    try {
      const metadata = await this.prisma.secretMetadata.findUnique({
        where: { key_name: keyName },
      })

      if (!metadata) {
        throw new Error(`Secret ${keyName} not found`)
      }

      // Create rotation history record
      await this.prisma.secretRotationHistory.create({
        data: {
          secret_id: metadata.id,
          rotated_by: rotatedBy,
          previous_expires_at: metadata.expires_at,
          new_expires_at: newExpiresAt,
          reason: reason || 'scheduled rotation',
        },
      })

      // Update metadata
      await this.prisma.secretMetadata.update({
        where: { key_name: keyName },
        data: {
          expires_at: newExpiresAt,
          last_rotated_at: new Date(),
          status: 'active',
        },
      })

      logger.info('Rotation recorded successfully', {
        keyName,
        rotatedBy,
        newExpiresAt,
      })
    } catch (error) {
      logger.error('Failed to record rotation', {
        error: error instanceof Error ? error.message : error,
        keyName,
      })
      throw new Error(`Failed to record rotation for ${keyName}`)
    }
  }

  /**
   * Get rotation history for a secret
   *
   * @param keyName - Secret identifier
   * @returns Array of rotation history records
   */
  async getRotationHistory(keyName: string): Promise<Array<{
    rotatedAt: Date
    rotatedBy: string | null
    previousExpiresAt: Date | null
    newExpiresAt: Date | null
    reason: string | null
    metadata: Prisma.JsonValue | null
  }>> {
    try {
      const metadata = await this.prisma.secretMetadata.findUnique({
        where: { key_name: keyName },
        include: {
          rotation_history: {
            orderBy: { rotated_at: 'desc' },
          },
        },
      })

      if (!metadata) {
        logger.debug('Secret not found for rotation history', { keyName })
        return []
      }

      return metadata.rotation_history.map((record) => ({
        rotatedAt: record.rotated_at,
        rotatedBy: record.rotated_by,
        previousExpiresAt: record.previous_expires_at,
        newExpiresAt: record.new_expires_at,
        reason: record.reason,
        metadata: record.metadata,
      }))
    } catch (error) {
      logger.error('Failed to get rotation history', {
        error: error instanceof Error ? error.message : error,
        keyName,
      })
      throw new Error(`Failed to get rotation history for ${keyName}`)
    }
  }
}

// Export singleton instance factory
export function createSecretManager(prisma: PrismaClient): SecretManager {
  return new SecretManager(prisma)
}
