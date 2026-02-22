/**
 * Tests for HTTP Cache Headers Utility
 */

import {
  getPublicCacheHeaders,
  getPrivateCacheHeaders,
  getSWRCacheHeaders,
  withCacheStatus,
  NO_CACHE_HEADERS,
  CACHE_HEADER_PRESETS,
  CacheHeaderOptions,
  CacheStatus,
} from '@/lib/cache/http-cache-headers';

describe('HTTP Cache Headers Utility', () => {
  describe('getPublicCacheHeaders', () => {
    it('should generate public cache headers with maxAge only', () => {
      const headers = getPublicCacheHeaders(300);
      expect(headers['Cache-Control']).toBe('public, s-maxage=300, max-age=300');
    });

    it('should include stale-while-revalidate when provided', () => {
      const headers = getPublicCacheHeaders(300, 3600);
      expect(headers['Cache-Control']).toBe(
        'public, s-maxage=300, max-age=300, stale-while-revalidate=3600'
      );
    });

    it('should not include stale-while-revalidate when not provided', () => {
      const headers = getPublicCacheHeaders(60);
      expect(headers['Cache-Control']).not.toContain('stale-while-revalidate');
    });

    it('should return an object with only Cache-Control header', () => {
      const headers = getPublicCacheHeaders(300);
      expect(Object.keys(headers)).toEqual(['Cache-Control']);
    });

    it('should handle zero maxAge', () => {
      const headers = getPublicCacheHeaders(0);
      expect(headers['Cache-Control']).toContain('max-age=0');
      expect(headers['Cache-Control']).toContain('s-maxage=0');
    });

    it('should handle zero staleWhileRevalidate', () => {
      const headers = getPublicCacheHeaders(300, 0);
      expect(headers['Cache-Control']).toContain('stale-while-revalidate=0');
    });

    it('should include public directive', () => {
      const headers = getPublicCacheHeaders(300, 3600);
      expect(headers['Cache-Control']).toContain('public');
    });

    it('should include both s-maxage and max-age directives', () => {
      const headers = getPublicCacheHeaders(120);
      expect(headers['Cache-Control']).toContain('s-maxage=120');
      expect(headers['Cache-Control']).toContain('max-age=120');
    });
  });

  describe('getPrivateCacheHeaders', () => {
    it('should generate private cache headers with maxAge only', () => {
      const headers = getPrivateCacheHeaders(300);
      expect(headers['Cache-Control']).toBe('private, max-age=300');
    });

    it('should include stale-while-revalidate when provided', () => {
      const headers = getPrivateCacheHeaders(120, 300);
      expect(headers['Cache-Control']).toBe(
        'private, max-age=120, stale-while-revalidate=300'
      );
    });

    it('should not include stale-while-revalidate when not provided', () => {
      const headers = getPrivateCacheHeaders(300);
      expect(headers['Cache-Control']).not.toContain('stale-while-revalidate');
    });

    it('should include private directive', () => {
      const headers = getPrivateCacheHeaders(300);
      expect(headers['Cache-Control']).toContain('private');
    });

    it('should not include s-maxage (CDN-bypass for private)', () => {
      const headers = getPrivateCacheHeaders(300, 600);
      expect(headers['Cache-Control']).not.toContain('s-maxage');
    });

    it('should return an object with only Cache-Control header', () => {
      const headers = getPrivateCacheHeaders(300);
      expect(Object.keys(headers)).toEqual(['Cache-Control']);
    });

    it('should handle zero maxAge', () => {
      const headers = getPrivateCacheHeaders(0);
      expect(headers['Cache-Control']).toContain('max-age=0');
    });
  });

  describe('getSWRCacheHeaders', () => {
    it('should generate SWR cache headers with both maxAge and staleTime', () => {
      const headers = getSWRCacheHeaders(300, 3600);
      expect(headers['Cache-Control']).toBe(
        'public, s-maxage=300, max-age=300, stale-while-revalidate=3600'
      );
    });

    it('should always include public, s-maxage, max-age, and stale-while-revalidate', () => {
      const headers = getSWRCacheHeaders(60, 120);
      expect(headers['Cache-Control']).toContain('public');
      expect(headers['Cache-Control']).toContain('s-maxage=60');
      expect(headers['Cache-Control']).toContain('max-age=60');
      expect(headers['Cache-Control']).toContain('stale-while-revalidate=120');
    });

    it('should return an object with only Cache-Control header', () => {
      const headers = getSWRCacheHeaders(300, 600);
      expect(Object.keys(headers)).toEqual(['Cache-Control']);
    });

    it('should handle large stale windows', () => {
      const headers = getSWRCacheHeaders(300, 86400);
      expect(headers['Cache-Control']).toContain('stale-while-revalidate=86400');
    });
  });

  describe('withCacheStatus', () => {
    it('should add X-Cache-Status header with HIT status', () => {
      const baseHeaders = { 'Cache-Control': 'public, max-age=300' };
      const headers = withCacheStatus(baseHeaders, 'HIT');
      expect(headers['X-Cache-Status']).toBe('HIT');
    });

    it('should add X-Cache-Status header with MISS status', () => {
      const baseHeaders = { 'Cache-Control': 'public, max-age=300' };
      const headers = withCacheStatus(baseHeaders, 'MISS');
      expect(headers['X-Cache-Status']).toBe('MISS');
    });

    it('should add X-Cache-Status header with BYPASS status', () => {
      const baseHeaders = { 'Cache-Control': 'no-store, max-age=0' };
      const headers = withCacheStatus(baseHeaders, 'BYPASS');
      expect(headers['X-Cache-Status']).toBe('BYPASS');
    });

    it('should add X-Cache-Status header with REVALIDATING status', () => {
      const baseHeaders = { 'Cache-Control': 'public, max-age=300' };
      const headers = withCacheStatus(baseHeaders, 'REVALIDATING');
      expect(headers['X-Cache-Status']).toBe('REVALIDATING');
    });

    it('should preserve existing headers', () => {
      const baseHeaders = {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': 'application/json',
      };
      const headers = withCacheStatus(baseHeaders, 'HIT');
      expect(headers['Cache-Control']).toBe('public, max-age=300');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Cache-Status']).toBe('HIT');
    });

    it('should not mutate the original headers object', () => {
      const baseHeaders = { 'Cache-Control': 'public, max-age=300' };
      withCacheStatus(baseHeaders, 'HIT');
      expect(baseHeaders).not.toHaveProperty('X-Cache-Status');
    });

    it('should work with empty headers object', () => {
      const headers = withCacheStatus({}, 'MISS');
      expect(headers['X-Cache-Status']).toBe('MISS');
    });
  });

  describe('NO_CACHE_HEADERS', () => {
    it('should have no-store and max-age=0 directives', () => {
      expect(NO_CACHE_HEADERS['Cache-Control']).toBe('no-store, max-age=0');
    });

    it('should be a plain object with Cache-Control key', () => {
      expect(Object.keys(NO_CACHE_HEADERS)).toEqual(['Cache-Control']);
    });

    it('should contain no-store directive', () => {
      expect(NO_CACHE_HEADERS['Cache-Control']).toContain('no-store');
    });
  });

  describe('CACHE_HEADER_PRESETS', () => {
    it('AI_MODELS preset should be a public cache header', () => {
      expect(CACHE_HEADER_PRESETS.AI_MODELS['Cache-Control']).toContain('public');
      expect(CACHE_HEADER_PRESETS.AI_MODELS['Cache-Control']).toContain('s-maxage=300');
      expect(CACHE_HEADER_PRESETS.AI_MODELS['Cache-Control']).toContain('max-age=300');
      expect(CACHE_HEADER_PRESETS.AI_MODELS['Cache-Control']).toContain(
        'stale-while-revalidate=3600'
      );
    });

    it('TEMPLATES preset should be a public cache header with extended stale window', () => {
      expect(CACHE_HEADER_PRESETS.TEMPLATES['Cache-Control']).toContain('public');
      expect(CACHE_HEADER_PRESETS.TEMPLATES['Cache-Control']).toContain('s-maxage=300');
      expect(CACHE_HEADER_PRESETS.TEMPLATES['Cache-Control']).toContain('max-age=300');
      expect(CACHE_HEADER_PRESETS.TEMPLATES['Cache-Control']).toContain(
        'stale-while-revalidate=7200'
      );
    });

    it('EXPERIMENTS_CONFIG preset should be a private cache header', () => {
      expect(CACHE_HEADER_PRESETS.EXPERIMENTS_CONFIG['Cache-Control']).toContain('private');
      expect(CACHE_HEADER_PRESETS.EXPERIMENTS_CONFIG['Cache-Control']).toContain('max-age=120');
      expect(CACHE_HEADER_PRESETS.EXPERIMENTS_CONFIG['Cache-Control']).toContain(
        'stale-while-revalidate=300'
      );
    });

    it('EXPERIMENTS_CONFIG preset should not have s-maxage (private only)', () => {
      expect(CACHE_HEADER_PRESETS.EXPERIMENTS_CONFIG['Cache-Control']).not.toContain('s-maxage');
    });

    it('SAML_METADATA preset should be public cache with 1 hour maxAge', () => {
      expect(CACHE_HEADER_PRESETS.SAML_METADATA['Cache-Control']).toContain('public');
      expect(CACHE_HEADER_PRESETS.SAML_METADATA['Cache-Control']).toContain('s-maxage=3600');
      expect(CACHE_HEADER_PRESETS.SAML_METADATA['Cache-Control']).toContain('max-age=3600');
    });

    it('SAML_METADATA preset should not have stale-while-revalidate', () => {
      expect(CACHE_HEADER_PRESETS.SAML_METADATA['Cache-Control']).not.toContain(
        'stale-while-revalidate'
      );
    });

    it('NO_CACHE preset should match NO_CACHE_HEADERS constant', () => {
      expect(CACHE_HEADER_PRESETS.NO_CACHE['Cache-Control']).toBe(
        NO_CACHE_HEADERS['Cache-Control']
      );
    });

    it('should have all expected preset keys', () => {
      expect(CACHE_HEADER_PRESETS).toHaveProperty('AI_MODELS');
      expect(CACHE_HEADER_PRESETS).toHaveProperty('TEMPLATES');
      expect(CACHE_HEADER_PRESETS).toHaveProperty('EXPERIMENTS_CONFIG');
      expect(CACHE_HEADER_PRESETS).toHaveProperty('SAML_METADATA');
      expect(CACHE_HEADER_PRESETS).toHaveProperty('NO_CACHE');
    });
  });

  describe('CacheHeaderOptions interface', () => {
    it('should accept valid options with all fields', () => {
      const options: CacheHeaderOptions = {
        maxAge: 300,
        staleWhileRevalidate: 3600,
        staleIfError: 86400,
      };
      expect(options.maxAge).toBe(300);
      expect(options.staleWhileRevalidate).toBe(3600);
      expect(options.staleIfError).toBe(86400);
    });

    it('should accept options with only required fields', () => {
      const options: CacheHeaderOptions = { maxAge: 60 };
      expect(options.maxAge).toBe(60);
      expect(options.staleWhileRevalidate).toBeUndefined();
      expect(options.staleIfError).toBeUndefined();
    });
  });

  describe('CacheStatus type', () => {
    it('should accept all valid status values', () => {
      const statuses: CacheStatus[] = ['HIT', 'MISS', 'BYPASS', 'REVALIDATING'];
      statuses.forEach(status => {
        const headers = withCacheStatus({}, status);
        expect(headers['X-Cache-Status']).toBe(status);
      });
    });
  });
});
