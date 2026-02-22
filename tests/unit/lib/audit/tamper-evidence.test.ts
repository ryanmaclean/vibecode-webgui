/**
 * Comprehensive test suite for Tamper-Evidence Module
 *
 * Test Coverage:
 * - Configuration and initialization
 * - Hash computation (computeAuditHash)
 * - Entry to hash data conversion (entryToHashData)
 * - Single entry verification (verifyEntryHash)
 * - Hash chain verification (verifyHashChain)
 * - Genesis hash retrieval (getGenesisHash)
 * - Hash data creation (createHashData)
 * - HMAC key generation (generateHmacKey)
 * - Configuration status (isConfigured, getConfigurationStatus)
 * - Deterministic serialization
 * - Edge cases and error handling
 */

import type {
  AuditLogEntry,
  AuditContext,
} from '@/lib/audit/types';
import {
  AuditAction,
  AuditSeverity,
  AuditCategory,
  AuditOutcome,
} from '@/lib/audit/types';

describe('Tamper-Evidence Module', () => {
  let computeAuditHash: typeof import('@/lib/audit/tamper-evidence').computeAuditHash;
  let entryToHashData: typeof import('@/lib/audit/tamper-evidence').entryToHashData;
  let verifyEntryHash: typeof import('@/lib/audit/tamper-evidence').verifyEntryHash;
  let verifyHashChain: typeof import('@/lib/audit/tamper-evidence').verifyHashChain;
  let getGenesisHash: typeof import('@/lib/audit/tamper-evidence').getGenesisHash;
  let createHashData: typeof import('@/lib/audit/tamper-evidence').createHashData;
  let generateHmacKey: typeof import('@/lib/audit/tamper-evidence').generateHmacKey;
  let isConfigured: typeof import('@/lib/audit/tamper-evidence').isConfigured;
  let getConfigurationStatus: typeof import('@/lib/audit/tamper-evidence').getConfigurationStatus;

  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    jest.resetModules();
    const tamperModule = await import('@/lib/audit/tamper-evidence');
    computeAuditHash = tamperModule.computeAuditHash;
    entryToHashData = tamperModule.entryToHashData;
    verifyEntryHash = tamperModule.verifyEntryHash;
    verifyHashChain = tamperModule.verifyHashChain;
    getGenesisHash = tamperModule.getGenesisHash;
    createHashData = tamperModule.createHashData;
    generateHmacKey = tamperModule.generateHmacKey;
    isConfigured = tamperModule.isConfigured;
    getConfigurationStatus = tamperModule.getConfigurationStatus;
  });

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    // Ensure we're in test/development mode (not production)
    delete process.env.AUDIT_HMAC_SECRET;
    delete process.env.AUDIT_GENESIS_HASH;
    process.env.NODE_ENV = 'test';
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Module Initialization', () => {
    test('should export all required functions', () => {
      expect(computeAuditHash).toBeDefined();
      expect(entryToHashData).toBeDefined();
      expect(verifyEntryHash).toBeDefined();
      expect(verifyHashChain).toBeDefined();
      expect(getGenesisHash).toBeDefined();
      expect(createHashData).toBeDefined();
      expect(generateHmacKey).toBeDefined();
      expect(isConfigured).toBeDefined();
      expect(getConfigurationStatus).toBeDefined();
    });

    test('should have functions of correct types', () => {
      expect(typeof computeAuditHash).toBe('function');
      expect(typeof entryToHashData).toBe('function');
      expect(typeof verifyEntryHash).toBe('function');
      expect(typeof verifyHashChain).toBe('function');
      expect(typeof getGenesisHash).toBe('function');
      expect(typeof createHashData).toBe('function');
      expect(typeof generateHmacKey).toBe('function');
      expect(typeof isConfigured).toBe('function');
      expect(typeof getConfigurationStatus).toBe('function');
    });
  });

  describe('Configuration', () => {
    test('should use development key when AUDIT_HMAC_SECRET is not set', () => {
      delete process.env.AUDIT_HMAC_SECRET;
      process.env.NODE_ENV = 'development';

      // Should not throw in development
      expect(() => getGenesisHash()).not.toThrow();
    });

    test('should use default genesis hash of 64 zeros', () => {
      const genesisHash = getGenesisHash();
      expect(genesisHash).toBe('0'.repeat(64));
    });

    test('should report not configured when using dev key', () => {
      delete process.env.AUDIT_HMAC_SECRET;
      process.env.NODE_ENV = 'development';

      expect(isConfigured()).toBe(false);
    });

    test('should report configured when AUDIT_HMAC_SECRET is set', async () => {
      process.env.AUDIT_HMAC_SECRET = 'production-secret-key-at-least-32-bytes-long';

      // Re-import module to pick up new env
      jest.resetModules();
      const { isConfigured: reloadedIsConfigured } = await import('@/lib/audit/tamper-evidence');

      expect(reloadedIsConfigured()).toBe(true);
    });

    test('should return configuration status with warning for dev key', () => {
      delete process.env.AUDIT_HMAC_SECRET;
      process.env.NODE_ENV = 'test';

      const status = getConfigurationStatus();

      expect(status.configured).toBe(false);
      expect(status.algorithm).toBe('sha256');
      expect(status.usingDefaultGenesis).toBe(true);
      expect(status.warning).toContain('development');
    });

    test('should return configuration status without warning for production key', async () => {
      process.env.AUDIT_HMAC_SECRET = 'production-secret-key-at-least-32-bytes';

      jest.resetModules();
      const { getConfigurationStatus: reloadedGetStatus } = await import('@/lib/audit/tamper-evidence');

      const status = reloadedGetStatus();

      expect(status.configured).toBe(true);
      expect(status.algorithm).toBe('sha256');
      expect(status.warning).toBeNull();
    });

    test('should use custom genesis hash from environment', async () => {
      process.env.AUDIT_HMAC_SECRET = 'test-secret-key';
      process.env.AUDIT_GENESIS_HASH = 'custom-genesis-hash-value';

      jest.resetModules();
      const { getGenesisHash: reloadedGetGenesis } = await import('@/lib/audit/tamper-evidence');

      expect(reloadedGetGenesis()).toBe('custom-genesis-hash-value');
    });
  });

  describe('computeAuditHash', () => {
    const baseHashData = {
      timestamp: '2024-01-15T10:30:00.000Z',
      userId: 123,
      action: AuditAction.USER_LOGIN,
      resource: 'user:123',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      metadata: { browser: 'Chrome' },
      severity: AuditSeverity.INFO,
      category: AuditCategory.AUTH,
      outcome: AuditOutcome.SUCCESS,
      sessionId: 'session-abc123',
      previousHash: '0'.repeat(64),
    };

    test('should compute hash for valid audit data', () => {
      const hash = computeAuditHash(baseHashData);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex length
    });

    test('should produce deterministic hashes', () => {
      const hash1 = computeAuditHash(baseHashData);
      const hash2 = computeAuditHash(baseHashData);

      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different data', () => {
      const hash1 = computeAuditHash(baseHashData);
      const hash2 = computeAuditHash({
        ...baseHashData,
        action: AuditAction.USER_LOGOUT,
      });

      expect(hash1).not.toBe(hash2);
    });

    test('should handle null values', () => {
      const hashData = {
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: null,
        action: AuditAction.SYSTEM_STARTUP,
        resource: 'system',
        ipAddress: null,
        userAgent: null,
        metadata: null,
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      };

      const hash = computeAuditHash(hashData);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should be sensitive to timestamp changes', () => {
      const hash1 = computeAuditHash(baseHashData);
      const hash2 = computeAuditHash({
        ...baseHashData,
        timestamp: '2024-01-15T10:30:01.000Z',
      });

      expect(hash1).not.toBe(hash2);
    });

    test('should be sensitive to userId changes', () => {
      const hash1 = computeAuditHash(baseHashData);
      const hash2 = computeAuditHash({
        ...baseHashData,
        userId: 456,
      });

      expect(hash1).not.toBe(hash2);
    });

    test('should be sensitive to metadata changes', () => {
      const hash1 = computeAuditHash(baseHashData);
      const hash2 = computeAuditHash({
        ...baseHashData,
        metadata: { browser: 'Firefox' },
      });

      expect(hash1).not.toBe(hash2);
    });

    test('should be sensitive to previousHash changes', () => {
      const hash1 = computeAuditHash(baseHashData);
      const hash2 = computeAuditHash({
        ...baseHashData,
        previousHash: 'a'.repeat(64),
      });

      expect(hash1).not.toBe(hash2);
    });

    test('should handle complex metadata objects', () => {
      const complexMetadata = {
        nested: {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        },
        array: [1, 2, 3],
        mixed: {
          str: 'string',
          num: 42,
          bool: true,
          arr: ['a', 'b'],
        },
      };

      const hash = computeAuditHash({
        ...baseHashData,
        metadata: complexMetadata,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should produce consistent hash regardless of metadata key order', () => {
      const hash1 = computeAuditHash({
        ...baseHashData,
        metadata: { a: 1, b: 2, c: 3 },
      });

      const hash2 = computeAuditHash({
        ...baseHashData,
        metadata: { c: 3, a: 1, b: 2 },
      });

      // Due to sorted serialization, these should be equal
      expect(hash1).toBe(hash2);
    });
  });

  describe('entryToHashData', () => {
    const mockEntry: AuditLogEntry = {
      id: 'audit-123',
      timestamp: new Date('2024-01-15T10:30:00.000Z'),
      userId: 123,
      action: AuditAction.USER_LOGIN,
      resource: 'user:123',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0',
      metadata: { browser: 'Chrome' },
      hash: 'abc123',
      previousHash: '0'.repeat(64),
      severity: AuditSeverity.INFO,
      category: AuditCategory.AUTH,
      outcome: AuditOutcome.SUCCESS,
      sessionId: 'session-abc',
    };

    test('should convert audit entry to hash data', () => {
      const hashData = entryToHashData(mockEntry);

      expect(hashData.timestamp).toBe('2024-01-15T10:30:00.000Z');
      expect(hashData.userId).toBe(123);
      expect(hashData.action).toBe(AuditAction.USER_LOGIN);
      expect(hashData.resource).toBe('user:123');
      expect(hashData.ipAddress).toBe('192.168.1.100');
      expect(hashData.userAgent).toBe('Mozilla/5.0');
      expect(hashData.metadata).toEqual({ browser: 'Chrome' });
      expect(hashData.severity).toBe(AuditSeverity.INFO);
      expect(hashData.category).toBe(AuditCategory.AUTH);
      expect(hashData.outcome).toBe(AuditOutcome.SUCCESS);
      expect(hashData.sessionId).toBe('session-abc');
      expect(hashData.previousHash).toBe('0'.repeat(64));
    });

    test('should convert timestamp Date to ISO string', () => {
      const hashData = entryToHashData(mockEntry);

      expect(typeof hashData.timestamp).toBe('string');
      expect(hashData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should handle null values in entry', () => {
      const entryWithNulls: AuditLogEntry = {
        ...mockEntry,
        userId: null,
        ipAddress: null,
        userAgent: null,
        metadata: null,
        sessionId: null,
        previousHash: null,
      };

      const hashData = entryToHashData(entryWithNulls);

      expect(hashData.userId).toBeNull();
      expect(hashData.ipAddress).toBeNull();
      expect(hashData.userAgent).toBeNull();
      expect(hashData.metadata).toBeNull();
      expect(hashData.sessionId).toBeNull();
      expect(hashData.previousHash).toBeNull();
    });
  });

  describe('verifyEntryHash', () => {
    test('should verify valid entry hash', () => {
      // Create a valid entry with correct hash
      const timestamp = new Date('2024-01-15T10:30:00.000Z');
      const hashData = {
        timestamp: timestamp.toISOString(),
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { browser: 'Chrome' },
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: 'session-abc',
        previousHash: '0'.repeat(64),
      };

      const correctHash = computeAuditHash(hashData);

      const entry: AuditLogEntry = {
        id: 'audit-123',
        timestamp,
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { browser: 'Chrome' },
        hash: correctHash,
        previousHash: '0'.repeat(64),
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: 'session-abc',
      };

      const result = verifyEntryHash(entry);

      expect(result.valid).toBe(true);
      expect(result.expectedHash).toBe(correctHash);
      expect(result.actualHash).toBe(correctHash);
      expect(result.reason).toBeNull();
    });

    test('should detect invalid entry hash', () => {
      const entry: AuditLogEntry = {
        id: 'audit-123',
        timestamp: new Date('2024-01-15T10:30:00.000Z'),
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { browser: 'Chrome' },
        hash: 'invalid-hash-value',
        previousHash: '0'.repeat(64),
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: 'session-abc',
      };

      const result = verifyEntryHash(entry);

      expect(result.valid).toBe(false);
      expect(result.actualHash).toBe('invalid-hash-value');
      expect(result.expectedHash).not.toBe('invalid-hash-value');
      expect(result.reason).toContain('tampered');
    });

    test('should detect tampered data', () => {
      // Create valid entry
      const timestamp = new Date('2024-01-15T10:30:00.000Z');
      const originalHash = computeAuditHash({
        timestamp: timestamp.toISOString(),
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: null,
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      // Tamper with the data but keep the old hash
      const tamperedEntry: AuditLogEntry = {
        id: 'audit-123',
        timestamp,
        userId: 999, // Changed!
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: null,
        hash: originalHash,
        previousHash: null,
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
      };

      const result = verifyEntryHash(tamperedEntry);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('tampered');
    });
  });

  describe('verifyHashChain', () => {
    function createValidEntry(
      index: number,
      previousHash: string | null,
      timestamp: Date
    ): AuditLogEntry {
      const hashData = {
        timestamp: timestamp.toISOString(),
        userId: 123,
        action: AuditAction.FILE_ACCESSED,
        resource: `file:${index}`,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { index },
        severity: AuditSeverity.INFO,
        category: AuditCategory.DATA_ACCESS,
        outcome: AuditOutcome.SUCCESS,
        sessionId: 'session-abc',
        previousHash,
      };

      return {
        id: `audit-${index}`,
        timestamp,
        userId: 123,
        action: AuditAction.FILE_ACCESSED,
        resource: `file:${index}`,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { index },
        hash: computeAuditHash(hashData),
        previousHash,
        severity: AuditSeverity.INFO,
        category: AuditCategory.DATA_ACCESS,
        outcome: AuditOutcome.SUCCESS,
        sessionId: 'session-abc',
      };
    }

    test('should verify empty chain', () => {
      const result = verifyHashChain([]);

      expect(result.valid).toBe(true);
      expect(result.entriesVerified).toBe(0);
      expect(result.firstInvalidIndex).toBeNull();
      expect(result.invalidReason).toBeNull();
      expect(result.invalidEntryId).toBeNull();
    });

    test('should verify single entry chain with genesis hash', () => {
      const genesisHash = getGenesisHash();
      const entry = createValidEntry(0, genesisHash, new Date('2024-01-15T10:00:00.000Z'));

      const result = verifyHashChain([entry]);

      expect(result.valid).toBe(true);
      expect(result.entriesVerified).toBe(1);
      expect(result.firstInvalidIndex).toBeNull();
    });

    test('should verify multi-entry chain', () => {
      const genesisHash = getGenesisHash();

      const entry1 = createValidEntry(0, genesisHash, new Date('2024-01-15T10:00:00.000Z'));
      const entry2 = createValidEntry(1, entry1.hash, new Date('2024-01-15T10:01:00.000Z'));
      const entry3 = createValidEntry(2, entry2.hash, new Date('2024-01-15T10:02:00.000Z'));

      const result = verifyHashChain([entry1, entry2, entry3]);

      expect(result.valid).toBe(true);
      expect(result.entriesVerified).toBe(3);
      expect(result.firstInvalidIndex).toBeNull();
    });

    test('should detect broken chain linkage', () => {
      const genesisHash = getGenesisHash();

      const entry1 = createValidEntry(0, genesisHash, new Date('2024-01-15T10:00:00.000Z'));
      const entry2 = createValidEntry(1, 'wrong-previous-hash', new Date('2024-01-15T10:01:00.000Z'));

      const result = verifyHashChain([entry1, entry2]);

      expect(result.valid).toBe(false);
      expect(result.entriesVerified).toBe(1);
      expect(result.firstInvalidIndex).toBe(1);
      expect(result.invalidReason).toContain('Chain broken');
      expect(result.invalidReason).toContain('previousHash mismatch');
      expect(result.invalidEntryId).toBe('audit-1');
    });

    test('should detect tampered entry in chain', () => {
      const genesisHash = getGenesisHash();

      const entry1 = createValidEntry(0, genesisHash, new Date('2024-01-15T10:00:00.000Z'));
      const entry2 = createValidEntry(1, entry1.hash, new Date('2024-01-15T10:01:00.000Z'));

      // Tamper with entry2's hash
      entry2.hash = 'tampered-hash-value';

      const result = verifyHashChain([entry1, entry2]);

      expect(result.valid).toBe(false);
      expect(result.entriesVerified).toBe(1);
      expect(result.firstInvalidIndex).toBe(1);
      expect(result.invalidReason).toContain('Invalid hash');
      expect(result.invalidEntryId).toBe('audit-1');
    });

    test('should verify chain with custom expected previous hash', () => {
      const customPrevHash = 'custom-previous-hash-from-external-source';

      const entry = createValidEntry(0, customPrevHash, new Date('2024-01-15T10:00:00.000Z'));

      const result = verifyHashChain([entry], customPrevHash);

      expect(result.valid).toBe(true);
      expect(result.entriesVerified).toBe(1);
    });

    test('should fail if first entry does not match expected previous hash', () => {
      const genesisHash = getGenesisHash();

      // Create entry with genesis hash
      const entry = createValidEntry(0, genesisHash, new Date('2024-01-15T10:00:00.000Z'));

      // But expect a different previous hash
      const result = verifyHashChain([entry], 'different-expected-hash');

      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(0);
      expect(result.invalidReason).toContain('previousHash mismatch');
    });

    test('should detect tampering in the middle of chain', () => {
      const genesisHash = getGenesisHash();

      const entry1 = createValidEntry(0, genesisHash, new Date('2024-01-15T10:00:00.000Z'));
      const entry2 = createValidEntry(1, entry1.hash, new Date('2024-01-15T10:01:00.000Z'));
      const entry3 = createValidEntry(2, entry2.hash, new Date('2024-01-15T10:02:00.000Z'));
      const entry4 = createValidEntry(3, entry3.hash, new Date('2024-01-15T10:03:00.000Z'));

      // Tamper with entry2
      entry2.resource = 'tampered:resource';

      const result = verifyHashChain([entry1, entry2, entry3, entry4]);

      expect(result.valid).toBe(false);
      expect(result.firstInvalidIndex).toBe(1);
      expect(result.invalidReason).toContain('Invalid hash');
    });
  });

  describe('createHashData', () => {
    test('should create hash data from parameters', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z');
      const context: AuditContext = {
        userId: 123,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session-abc',
      };

      const hashData = createHashData({
        timestamp,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        context,
        metadata: { browser: 'Chrome' },
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        previousHash: '0'.repeat(64),
      });

      expect(hashData.timestamp).toBe('2024-01-15T10:30:00.000Z');
      expect(hashData.userId).toBe(123);
      expect(hashData.action).toBe(AuditAction.USER_LOGIN);
      expect(hashData.resource).toBe('user:123');
      expect(hashData.ipAddress).toBe('192.168.1.100');
      expect(hashData.userAgent).toBe('Mozilla/5.0');
      expect(hashData.metadata).toEqual({ browser: 'Chrome' });
      expect(hashData.severity).toBe(AuditSeverity.INFO);
      expect(hashData.category).toBe(AuditCategory.AUTH);
      expect(hashData.outcome).toBe(AuditOutcome.SUCCESS);
      expect(hashData.sessionId).toBe('session-abc');
      expect(hashData.previousHash).toBe('0'.repeat(64));
    });

    test('should handle missing context', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z');

      const hashData = createHashData({
        timestamp,
        action: AuditAction.SYSTEM_STARTUP,
        resource: 'system',
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM,
        outcome: AuditOutcome.SUCCESS,
        previousHash: null,
      });

      expect(hashData.userId).toBeNull();
      expect(hashData.ipAddress).toBeNull();
      expect(hashData.userAgent).toBeNull();
      expect(hashData.sessionId).toBeNull();
    });

    test('should handle partial context', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z');
      const context: AuditContext = {
        userId: 123,
        // No ipAddress, userAgent, sessionId
      };

      const hashData = createHashData({
        timestamp,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        context,
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        previousHash: null,
      });

      expect(hashData.userId).toBe(123);
      expect(hashData.ipAddress).toBeNull();
      expect(hashData.userAgent).toBeNull();
      expect(hashData.sessionId).toBeNull();
    });

    test('should handle null metadata', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z');

      const hashData = createHashData({
        timestamp,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        metadata: null,
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        previousHash: null,
      });

      expect(hashData.metadata).toBeNull();
    });

    test('should handle undefined metadata', () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z');

      const hashData = createHashData({
        timestamp,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        // metadata not provided
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        previousHash: null,
      });

      expect(hashData.metadata).toBeNull();
    });
  });

  describe('generateHmacKey', () => {
    test('should generate random hex key', () => {
      const key = generateHmacKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    test('should generate 64-character key by default (32 bytes)', () => {
      const key = generateHmacKey();

      expect(key.length).toBe(64); // 32 bytes * 2 (hex)
    });

    test('should generate key of specified length', () => {
      const key16 = generateHmacKey(16);
      const key64 = generateHmacKey(64);

      expect(key16.length).toBe(32); // 16 bytes * 2 (hex)
      expect(key64.length).toBe(128); // 64 bytes * 2 (hex)
    });

    test('should generate unique keys', () => {
      const keys = new Set<string>();

      for (let i = 0; i < 100; i++) {
        keys.add(generateHmacKey());
      }

      // All keys should be unique
      expect(keys.size).toBe(100);
    });

    test('should handle small byte lengths', () => {
      const key = generateHmacKey(1);

      expect(key.length).toBe(2); // 1 byte = 2 hex characters
    });
  });

  describe('Deterministic Serialization', () => {
    test('should produce same hash for same data', () => {
      const data = {
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { a: 1, b: 2 },
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: 'session-abc',
        previousHash: null,
      };

      const hash1 = computeAuditHash(data);
      const hash2 = computeAuditHash(data);

      expect(hash1).toBe(hash2);
    });

    test('should handle metadata with various value types', () => {
      const data = {
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: null,
        userAgent: null,
        metadata: {
          string: 'value',
          number: 42,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          nested: { key: 'value' },
        },
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      };

      const hash = computeAuditHash(data);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should produce consistent hash for empty metadata', () => {
      const data = {
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: null,
        action: AuditAction.SYSTEM_STARTUP,
        resource: 'system',
        ipAddress: null,
        userAgent: null,
        metadata: {},
        severity: AuditSeverity.INFO,
        category: AuditCategory.SYSTEM,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      };

      const hash1 = computeAuditHash(data);
      const hash2 = computeAuditHash(data);

      expect(hash1).toBe(hash2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long user agent strings', () => {
      const longUserAgent = 'A'.repeat(5000);

      const hash = computeAuditHash({
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: longUserAgent,
        metadata: null,
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should handle unicode in metadata', () => {
      const hash = computeAuditHash({
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: {
          emoji: '🔐🔑🛡️',
          chinese: '审计日志',
          arabic: 'سجل التدقيق',
        },
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should handle special characters in strings', () => {
      const hash = computeAuditHash({
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:special"chars\'<>&',
        ipAddress: '192.168.1.100',
        userAgent: 'Test\nNew\tLine\rCarriage',
        metadata: {
          special: 'quote"apostrophe\'backslash\\',
        },
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should handle IPv6 addresses', () => {
      const hash = computeAuditHash({
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        userAgent: 'Mozilla/5.0',
        metadata: null,
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should handle very large user IDs', () => {
      const hash = computeAuditHash({
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: Number.MAX_SAFE_INTEGER,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: null,
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should handle deeply nested metadata', () => {
      const deepMetadata: Record<string, unknown> = {};
      let current = deepMetadata;
      for (let i = 0; i < 10; i++) {
        current.level = i;
        current.nested = {};
        current = current.nested as Record<string, unknown>;
      }
      current.deepestValue = 'bottom';

      const hash = computeAuditHash({
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: deepMetadata,
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });

    test('should handle large metadata arrays', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        index: i,
        value: `item-${i}`,
      }));

      const hash = computeAuditHash({
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { items: largeArray },
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });

  describe('Performance', () => {
    test('should compute hashes efficiently', () => {
      const iterations = 1000;
      const data = {
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: 123,
        action: AuditAction.USER_LOGIN,
        resource: 'user:123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { key: 'value' },
        severity: AuditSeverity.INFO,
        category: AuditCategory.AUTH,
        outcome: AuditOutcome.SUCCESS,
        sessionId: 'session-abc',
        previousHash: null,
      };

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeAuditHash(data);
      }
      const end = performance.now();

      const avgTime = (end - start) / iterations;

      // Should be well under 1ms per hash
      expect(avgTime).toBeLessThan(1);
    });

    test('should verify chain efficiently', () => {
      const genesisHash = getGenesisHash();
      const entries: AuditLogEntry[] = [];

      // Build a chain of 100 entries
      let prevHash: string | null = genesisHash;
      for (let i = 0; i < 100; i++) {
        const timestamp = new Date(Date.now() + i * 1000);
        const hashData = {
          timestamp: timestamp.toISOString(),
          userId: 123,
          action: AuditAction.FILE_ACCESSED,
          resource: `file:${i}`,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          metadata: { index: i },
          severity: AuditSeverity.INFO,
          category: AuditCategory.DATA_ACCESS,
          outcome: AuditOutcome.SUCCESS,
          sessionId: 'session-abc',
          previousHash: prevHash,
        };

        const hash = computeAuditHash(hashData);
        entries.push({
          id: `audit-${i}`,
          timestamp,
          userId: 123,
          action: AuditAction.FILE_ACCESSED,
          resource: `file:${i}`,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0',
          metadata: { index: i },
          hash,
          previousHash: prevHash,
          severity: AuditSeverity.INFO,
          category: AuditCategory.DATA_ACCESS,
          outcome: AuditOutcome.SUCCESS,
          sessionId: 'session-abc',
        });
        prevHash = hash;
      }

      const start = performance.now();
      const result = verifyHashChain(entries);
      const end = performance.now();

      expect(result.valid).toBe(true);
      expect(result.entriesVerified).toBe(100);

      // Should verify 100 entries in well under 100ms
      expect(end - start).toBeLessThan(100);
    });
  });

  describe('Type Safety', () => {
    test('should accept all valid AuditSeverity values', () => {
      const severities = [AuditSeverity.INFO, AuditSeverity.WARNING, AuditSeverity.CRITICAL];

      severities.forEach(severity => {
        const hash = computeAuditHash({
          timestamp: '2024-01-15T10:30:00.000Z',
          userId: null,
          action: AuditAction.SYSTEM_STARTUP,
          resource: 'system',
          ipAddress: null,
          userAgent: null,
          metadata: null,
          severity,
          category: AuditCategory.SYSTEM,
          outcome: AuditOutcome.SUCCESS,
          sessionId: null,
          previousHash: null,
        });

        expect(hash).toBeDefined();
        expect(hash.length).toBe(64);
      });
    });

    test('should accept all valid AuditCategory values', () => {
      const categories = [
        AuditCategory.AUTH,
        AuditCategory.DATA_ACCESS,
        AuditCategory.ADMIN,
        AuditCategory.SYSTEM,
        AuditCategory.AI_OPERATIONS,
        AuditCategory.API,
        AuditCategory.GENERAL,
      ];

      categories.forEach(category => {
        const hash = computeAuditHash({
          timestamp: '2024-01-15T10:30:00.000Z',
          userId: null,
          action: AuditAction.SYSTEM_STARTUP,
          resource: 'system',
          ipAddress: null,
          userAgent: null,
          metadata: null,
          severity: AuditSeverity.INFO,
          category,
          outcome: AuditOutcome.SUCCESS,
          sessionId: null,
          previousHash: null,
        });

        expect(hash).toBeDefined();
        expect(hash.length).toBe(64);
      });
    });

    test('should accept all valid AuditOutcome values', () => {
      const outcomes = [AuditOutcome.SUCCESS, AuditOutcome.FAILURE, AuditOutcome.ERROR];

      outcomes.forEach(outcome => {
        const hash = computeAuditHash({
          timestamp: '2024-01-15T10:30:00.000Z',
          userId: null,
          action: AuditAction.SYSTEM_STARTUP,
          resource: 'system',
          ipAddress: null,
          userAgent: null,
          metadata: null,
          severity: AuditSeverity.INFO,
          category: AuditCategory.SYSTEM,
          outcome,
          sessionId: null,
          previousHash: null,
        });

        expect(hash).toBeDefined();
        expect(hash.length).toBe(64);
      });
    });

    test('should accept string actions (for custom actions)', () => {
      const hash = computeAuditHash({
        timestamp: '2024-01-15T10:30:00.000Z',
        userId: null,
        action: 'custom.action.name',
        resource: 'custom:resource',
        ipAddress: null,
        userAgent: null,
        metadata: null,
        severity: AuditSeverity.INFO,
        category: AuditCategory.GENERAL,
        outcome: AuditOutcome.SUCCESS,
        sessionId: null,
        previousHash: null,
      });

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64);
    });
  });
});
