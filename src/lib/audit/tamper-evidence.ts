/**
 * Tamper-Evidence Module for Audit Logging
 *
 * Provides HMAC-based hash chain for audit log integrity verification.
 * Each audit log entry contains a hash of its contents and the previous entry's hash,
 * creating a cryptographic chain that detects tampering.
 *
 * Architecture:
 * 1. Configuration (HMAC secret management)
 * 2. Hash computation (deterministic serialization + HMAC-SHA256)
 * 3. Chain verification (validates hash chain integrity)
 * 4. Public API (exports for audit service)
 *
 * Compliance:
 * - SOC2: Provides audit trail integrity
 * - HIPAA: Ensures log immutability verification
 */

import { createHmac, randomBytes } from 'crypto';
import type { AuditLogEntry, AuditContext } from './types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for tamper-evidence module
 */
interface TamperEvidenceConfig {
  /** HMAC secret key for hash computation */
  secretKey: string;
  /** Hash algorithm to use */
  algorithm: 'sha256' | 'sha384' | 'sha512';
  /** Genesis hash for the first entry in the chain */
  genesisHash: string;
}

/**
 * Default genesis hash for the first audit log entry.
 * This is a well-known constant that marks the beginning of the chain.
 */
const DEFAULT_GENESIS_HASH = '0'.repeat(64); // 64 zeros (SHA-256 hex length)

/**
 * Get tamper-evidence configuration from environment
 */
function getTamperEvidenceConfig(): TamperEvidenceConfig {
  const secretKey = process.env.AUDIT_HMAC_SECRET;

  if (!secretKey) {
    // In development/test, generate a deterministic key from a seed
    // In production, this should be a securely stored secret
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      // Use a deterministic key for development (allows consistent hashes)
      return {
        secretKey: 'dev-audit-hmac-secret-key-32bytes!',
        algorithm: 'sha256',
        genesisHash: DEFAULT_GENESIS_HASH,
      };
    }
    throw new Error(
      'AUDIT_HMAC_SECRET environment variable is required in production. ' +
        'Generate with: openssl rand -hex 32'
    );
  }

  return {
    secretKey,
    algorithm: 'sha256',
    genesisHash: process.env.AUDIT_GENESIS_HASH || DEFAULT_GENESIS_HASH,
  };
}

// ============================================================================
// Types
// ============================================================================

/**
 * Data used to compute the hash for an audit log entry.
 * This is the canonical form that gets serialized and hashed.
 */
export interface AuditHashData {
  /** Timestamp in ISO format */
  timestamp: string;
  /** User ID (null for system/anonymous) */
  userId: number | null;
  /** Action performed */
  action: string;
  /** Resource identifier */
  resource: string;
  /** IP address */
  ipAddress: string | null;
  /** User agent string */
  userAgent: string | null;
  /** Metadata object (will be JSON stringified) */
  metadata: Record<string, unknown> | null;
  /** Severity level */
  severity: string;
  /** Category */
  category: string;
  /** Outcome */
  outcome: string;
  /** Session ID */
  sessionId: string | null;
  /** Previous entry's hash (for chain) */
  previousHash: string | null;
}

/**
 * Result of a chain verification operation
 */
export interface ChainVerificationResult {
  /** Whether the entire chain is valid */
  valid: boolean;
  /** Total number of entries verified */
  entriesVerified: number;
  /** Index of first invalid entry (if any) */
  firstInvalidIndex: number | null;
  /** Details about the first invalid entry */
  invalidReason: string | null;
  /** ID of the first invalid entry */
  invalidEntryId: string | null;
}

/**
 * Result of a single entry verification
 */
export interface EntryVerificationResult {
  /** Whether the entry hash is valid */
  valid: boolean;
  /** Expected hash value */
  expectedHash: string;
  /** Actual hash stored in entry */
  actualHash: string;
  /** Reason for failure (if invalid) */
  reason: string | null;
}

// ============================================================================
// Hash Computation
// ============================================================================

/**
 * Serialize audit data to a deterministic string for hashing.
 * The serialization must be stable (same data = same string) for hash verification.
 *
 * @param data - Audit hash data to serialize
 * @returns Deterministic string representation
 */
function serializeForHash(data: AuditHashData): string {
  // Use a sorted, deterministic JSON representation
  // Keys are explicitly ordered to ensure consistency
  const canonical = {
    action: data.action,
    category: data.category,
    ipAddress: data.ipAddress,
    metadata: data.metadata ? JSON.stringify(data.metadata, Object.keys(data.metadata).sort()) : null,
    outcome: data.outcome,
    previousHash: data.previousHash,
    resource: data.resource,
    sessionId: data.sessionId,
    severity: data.severity,
    timestamp: data.timestamp,
    userAgent: data.userAgent,
    userId: data.userId,
  };

  return JSON.stringify(canonical);
}

/**
 * Compute HMAC hash for the given data
 *
 * @param data - Serialized data to hash
 * @param config - Tamper evidence configuration
 * @returns Hex-encoded HMAC hash
 */
function computeHmac(data: string, config: TamperEvidenceConfig): string {
  const hmac = createHmac(config.algorithm, config.secretKey);
  hmac.update(data, 'utf8');
  return hmac.digest('hex');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Compute the hash for an audit log entry
 *
 * @param data - Audit hash data
 * @returns HMAC-SHA256 hash as hex string
 */
export function computeAuditHash(data: AuditHashData): string {
  const config = getTamperEvidenceConfig();
  const serialized = serializeForHash(data);
  return computeHmac(serialized, config);
}

/**
 * Create hash data from an audit log entry for verification
 *
 * @param entry - Audit log entry
 * @returns Hash data for computing/verifying hash
 */
export function entryToHashData(entry: AuditLogEntry): AuditHashData {
  return {
    timestamp: entry.timestamp.toISOString(),
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    metadata: entry.metadata,
    severity: entry.severity,
    category: entry.category,
    outcome: entry.outcome,
    sessionId: entry.sessionId,
    previousHash: entry.previousHash,
  };
}

/**
 * Verify that an audit log entry's hash is valid
 *
 * @param entry - Audit log entry to verify
 * @returns Verification result with expected vs actual hash
 */
export function verifyEntryHash(entry: AuditLogEntry): EntryVerificationResult {
  const hashData = entryToHashData(entry);
  const expectedHash = computeAuditHash(hashData);

  if (expectedHash === entry.hash) {
    return {
      valid: true,
      expectedHash,
      actualHash: entry.hash,
      reason: null,
    };
  }

  return {
    valid: false,
    expectedHash,
    actualHash: entry.hash,
    reason: 'Hash mismatch - entry may have been tampered with',
  };
}

/**
 * Verify the hash chain for a sequence of audit log entries.
 * Entries must be provided in chronological order (oldest first).
 *
 * @param entries - Audit log entries in chronological order
 * @param expectedPreviousHash - Expected previous hash for the first entry (null for genesis)
 * @returns Chain verification result
 */
export function verifyHashChain(
  entries: AuditLogEntry[],
  expectedPreviousHash: string | null = null
): ChainVerificationResult {
  if (entries.length === 0) {
    return {
      valid: true,
      entriesVerified: 0,
      firstInvalidIndex: null,
      invalidReason: null,
      invalidEntryId: null,
    };
  }

  const config = getTamperEvidenceConfig();
  let currentExpectedPreviousHash = expectedPreviousHash ?? config.genesisHash;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Verify chain linkage - the entry's previousHash should match expected
    if (entry.previousHash !== currentExpectedPreviousHash) {
      return {
        valid: false,
        entriesVerified: i,
        firstInvalidIndex: i,
        invalidReason: `Chain broken at entry ${i}: previousHash mismatch. Expected "${currentExpectedPreviousHash}", got "${entry.previousHash}"`,
        invalidEntryId: entry.id,
      };
    }

    // Verify the entry's own hash
    const entryVerification = verifyEntryHash(entry);
    if (!entryVerification.valid) {
      return {
        valid: false,
        entriesVerified: i,
        firstInvalidIndex: i,
        invalidReason: `Invalid hash at entry ${i}: ${entryVerification.reason}`,
        invalidEntryId: entry.id,
      };
    }

    // Next entry should reference this entry's hash
    currentExpectedPreviousHash = entry.hash;
  }

  return {
    valid: true,
    entriesVerified: entries.length,
    firstInvalidIndex: null,
    invalidReason: null,
    invalidEntryId: null,
  };
}

/**
 * Get the genesis hash (hash for the "previous" entry of the first log)
 *
 * @returns Genesis hash string
 */
export function getGenesisHash(): string {
  const config = getTamperEvidenceConfig();
  return config.genesisHash;
}

/**
 * Create audit hash data from creation input and context.
 * Used when creating a new audit log entry.
 *
 * @param params - Parameters for creating hash data
 * @returns Hash data ready for hash computation
 */
export function createHashData(params: {
  timestamp: Date;
  action: string;
  resource: string;
  context?: AuditContext;
  metadata?: Record<string, unknown> | null;
  severity: string;
  category: string;
  outcome: string;
  previousHash: string | null;
}): AuditHashData {
  return {
    timestamp: params.timestamp.toISOString(),
    userId: params.context?.userId ?? null,
    action: params.action,
    resource: params.resource,
    ipAddress: params.context?.ipAddress ?? null,
    userAgent: params.context?.userAgent ?? null,
    metadata: params.metadata ?? null,
    severity: params.severity,
    category: params.category,
    outcome: params.outcome,
    sessionId: params.context?.sessionId ?? null,
    previousHash: params.previousHash,
  };
}

/**
 * Generate a secure random key for HMAC operations.
 * Use this to generate the AUDIT_HMAC_SECRET environment variable.
 *
 * @param byteLength - Length of the key in bytes (default 32 for 256-bit)
 * @returns Hex-encoded random key
 */
export function generateHmacKey(byteLength: number = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/**
 * Check if the tamper-evidence module is properly configured
 *
 * @returns True if configured for production use
 */
export function isConfigured(): boolean {
  try {
    const config = getTamperEvidenceConfig();
    return config.secretKey !== 'dev-audit-hmac-secret-key-32bytes!';
  } catch {
    return false;
  }
}

/**
 * Get configuration status for monitoring/health checks
 *
 * @returns Configuration status object
 */
export function getConfigurationStatus(): {
  configured: boolean;
  algorithm: string;
  usingDefaultGenesis: boolean;
  warning: string | null;
} {
  try {
    const config = getTamperEvidenceConfig();
    const isDevKey = config.secretKey === 'dev-audit-hmac-secret-key-32bytes!';

    return {
      configured: !isDevKey,
      algorithm: config.algorithm,
      usingDefaultGenesis: config.genesisHash === DEFAULT_GENESIS_HASH,
      warning: isDevKey
        ? 'Using development HMAC key. Set AUDIT_HMAC_SECRET in production.'
        : null,
    };
  } catch (error) {
    return {
      configured: false,
      algorithm: 'sha256',
      usingDefaultGenesis: true,
      warning: error instanceof Error ? error.message : 'Configuration error',
    };
  }
}
