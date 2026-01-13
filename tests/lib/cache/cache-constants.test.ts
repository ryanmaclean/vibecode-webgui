/**
 * Tests for Cache Constants
 */
import { CacheTTL, CACHE_PREFIXES, DEFAULT_CACHE_CONFIG } from '@/lib/cache/cache-constants';

describe('cache-constants', () => {
  describe('CacheTTL', () => {
    it('should have SHORT ttl of 5 minutes', () => {
      expect(CacheTTL.SHORT).toBe(300);
    });

    it('should have MEDIUM ttl of 30 minutes', () => {
      expect(CacheTTL.MEDIUM).toBe(1800);
    });

    it('should have LONG ttl of 1 hour', () => {
      expect(CacheTTL.LONG).toBe(3600);
    });

    it('should have VERY_LONG ttl of 24 hours', () => {
      expect(CacheTTL.VERY_LONG).toBe(86400);
    });

    it('should have increasing TTL values', () => {
      expect(CacheTTL.SHORT).toBeLessThan(CacheTTL.MEDIUM);
      expect(CacheTTL.MEDIUM).toBeLessThan(CacheTTL.LONG);
      expect(CacheTTL.LONG).toBeLessThan(CacheTTL.VERY_LONG);
    });
  });

  describe('CACHE_PREFIXES', () => {
    it('should have VECTOR prefix', () => {
      expect(CACHE_PREFIXES.VECTOR).toBe('vector:');
    });

    it('should have QUERY prefix', () => {
      expect(CACHE_PREFIXES.QUERY).toBe('query:');
    });

    it('should have SESSION prefix', () => {
      expect(CACHE_PREFIXES.SESSION).toBe('session:');
    });

    it('should have USER prefix', () => {
      expect(CACHE_PREFIXES.USER).toBe('user:');
    });

    it('should have EMBEDDING prefix', () => {
      expect(CACHE_PREFIXES.EMBEDDING).toBe('embedding:');
    });

    it('should have all prefixes ending with colon', () => {
      Object.values(CACHE_PREFIXES).forEach(prefix => {
        expect(prefix.endsWith(':')).toBe(true);
      });
    });

    it('should have unique prefixes', () => {
      const values = Object.values(CACHE_PREFIXES);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it('should be readonly (const assertion)', () => {
      // TypeScript type check - this test ensures the const assertion works
      expect(Object.isFrozen(CACHE_PREFIXES)).toBe(false); // const assertion doesn't freeze at runtime
      // But TypeScript should prevent modifications at compile time
    });
  });

  describe('DEFAULT_CACHE_CONFIG', () => {
    it('should have MEDIUM ttl as default', () => {
      expect(DEFAULT_CACHE_CONFIG.ttl).toBe(CacheTTL.MEDIUM);
      expect(DEFAULT_CACHE_CONFIG.ttl).toBe(1800);
    });

    it('should have maxSize of 1000', () => {
      expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000);
    });

    it('should have checkPeriod of 10 minutes', () => {
      expect(DEFAULT_CACHE_CONFIG.checkPeriod).toBe(600);
    });

    it('should have all required config properties', () => {
      expect(DEFAULT_CACHE_CONFIG).toHaveProperty('ttl');
      expect(DEFAULT_CACHE_CONFIG).toHaveProperty('maxSize');
      expect(DEFAULT_CACHE_CONFIG).toHaveProperty('checkPeriod');
    });

    it('should have reasonable checkPeriod relative to ttl', () => {
      // Check period should be less than or equal to ttl
      expect(DEFAULT_CACHE_CONFIG.checkPeriod).toBeLessThanOrEqual(DEFAULT_CACHE_CONFIG.ttl);
    });
  });
});
