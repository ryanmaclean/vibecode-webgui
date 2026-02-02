/**
 * Unit tests for pagination utilities
 * Tests pagination constants, validation, and helper functions
 */

import {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  MAX_OFFSET,
  validatePaginationParams,
  createPaginatedResponse,
  getPaginationFromSearchParams,
  isValidLimit,
  isValidOffset,
  clampLimit,
  clampOffset,
} from '@/lib/api/pagination';

describe('Pagination Constants', () => {
  test('MAX_PAGE_SIZE should have expected values', () => {
    expect(MAX_PAGE_SIZE.DEFAULT).toBe(100);
    expect(MAX_PAGE_SIZE.MESSAGES).toBe(200);
    expect(MAX_PAGE_SIZE.VECTOR_SEARCH).toBe(50);
    expect(MAX_PAGE_SIZE.FILES).toBe(500);
    expect(MAX_PAGE_SIZE.EXPORT).toBe(10000);
  });

  test('DEFAULT_PAGE_SIZE should have expected values', () => {
    expect(DEFAULT_PAGE_SIZE.DEFAULT).toBe(20);
    expect(DEFAULT_PAGE_SIZE.MESSAGES).toBe(50);
    expect(DEFAULT_PAGE_SIZE.VECTOR_SEARCH).toBe(10);
  });

  test('MAX_OFFSET should have expected values', () => {
    expect(MAX_OFFSET.DEFAULT).toBe(10000);
    expect(MAX_OFFSET.EXTENDED).toBe(100000);
    expect(MAX_OFFSET.LIMITED).toBe(1000);
  });
});

describe('validatePaginationParams', () => {
  test('should return defaults when no params provided', () => {
    const result = validatePaginationParams({});
    expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    expect(result.offset).toBe(0);
    expect(result.page).toBeUndefined();
  });

  test('should respect provided limit within bounds', () => {
    const result = validatePaginationParams({ limit: 50 });
    expect(result.limit).toBe(50);
  });

  test('should cap limit at max', () => {
    const result = validatePaginationParams({ limit: 1000 }, 100);
    expect(result.limit).toBe(100);
  });

  test('should handle string limit values', () => {
    const result = validatePaginationParams({ limit: '50' });
    expect(result.limit).toBe(50);
  });

  test('should use default for invalid limit', () => {
    const result = validatePaginationParams({ limit: -10 }, 100, 20);
    expect(result.limit).toBe(20);
  });

  test('should handle offset parameter', () => {
    const result = validatePaginationParams({ offset: 100 });
    expect(result.offset).toBe(100);
  });

  test('should cap offset at max', () => {
    const result = validatePaginationParams({ offset: 50000 }, 100, 20, 10000);
    expect(result.offset).toBe(10000);
  });

  test('should calculate offset from page number', () => {
    const result = validatePaginationParams({ page: 3, limit: 10 });
    expect(result.offset).toBe(20); // (3-1) * 10
    expect(result.page).toBe(3);
  });

  test('should handle null values', () => {
    const result = validatePaginationParams({ limit: null, offset: null });
    expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    expect(result.offset).toBe(0);
  });
});

describe('createPaginatedResponse', () => {
  test('should create response with correct structure', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const pagination = { limit: 10, offset: 0 };
    const result = createPaginatedResponse(data, pagination);

    expect(result.data).toEqual(data);
    expect(result.pagination.limit).toBe(10);
    expect(result.pagination.offset).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
  });

  test('should set hasMore to true when data length equals limit', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const pagination = { limit: 2, offset: 0 };
    const result = createPaginatedResponse(data, pagination);

    expect(result.pagination.hasMore).toBe(true);
  });

  test('should include total and totalPages when total provided', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const pagination = { limit: 10, offset: 0 };
    const result = createPaginatedResponse(data, pagination, 100);

    expect(result.pagination.total).toBe(100);
    expect(result.pagination.totalPages).toBe(10);
    expect(result.pagination.hasMore).toBe(true);
  });

  test('should include page when provided', () => {
    const data = [{ id: 1 }];
    const pagination = { limit: 10, offset: 0, page: 1 };
    const result = createPaginatedResponse(data, pagination);

    expect(result.pagination.page).toBe(1);
  });
});

describe('getPaginationFromSearchParams', () => {
  test('should extract limit from search params', () => {
    const params = new URLSearchParams('limit=50');
    const result = getPaginationFromSearchParams(params);
    expect(result.limit).toBe(50);
  });

  test('should extract offset from search params', () => {
    const params = new URLSearchParams('offset=100');
    const result = getPaginationFromSearchParams(params);
    expect(result.offset).toBe(100);
  });

  test('should extract page from search params', () => {
    const params = new URLSearchParams('page=5&limit=10');
    const result = getPaginationFromSearchParams(params);
    expect(result.page).toBe(5);
    expect(result.offset).toBe(40);
  });

  test('should apply custom max and default limits', () => {
    const params = new URLSearchParams('limit=500');
    const result = getPaginationFromSearchParams(params, 50, 10);
    expect(result.limit).toBe(50);
  });
});

describe('isValidLimit', () => {
  test('should return true for valid limits', () => {
    expect(isValidLimit(1)).toBe(true);
    expect(isValidLimit(50)).toBe(true);
    expect(isValidLimit(100)).toBe(true);
  });

  test('should return false for invalid limits', () => {
    expect(isValidLimit(0)).toBe(false);
    expect(isValidLimit(-1)).toBe(false);
    expect(isValidLimit(101)).toBe(false);
    expect(isValidLimit(1.5)).toBe(false);
  });

  test('should use custom max', () => {
    expect(isValidLimit(200, 500)).toBe(true);
    expect(isValidLimit(600, 500)).toBe(false);
  });
});

describe('isValidOffset', () => {
  test('should return true for valid offsets', () => {
    expect(isValidOffset(0)).toBe(true);
    expect(isValidOffset(100)).toBe(true);
    expect(isValidOffset(10000)).toBe(true);
  });

  test('should return false for invalid offsets', () => {
    expect(isValidOffset(-1)).toBe(false);
    expect(isValidOffset(10001)).toBe(false);
    expect(isValidOffset(1.5)).toBe(false);
  });
});

describe('clampLimit', () => {
  test('should return value when within bounds', () => {
    expect(clampLimit(50)).toBe(50);
  });

  test('should clamp to max when exceeds', () => {
    expect(clampLimit(150, 100)).toBe(100);
  });

  test('should return default for invalid values', () => {
    expect(clampLimit(-5, 100, 20)).toBe(20);
    expect(clampLimit(0, 100, 20)).toBe(20);
    expect(clampLimit(NaN, 100, 20)).toBe(20);
    // Infinity is not finite, so returns default
    expect(clampLimit(Infinity, 100, 20)).toBe(20);
  });

  test('should floor floating point values', () => {
    expect(clampLimit(10.9)).toBe(10);
  });
});

describe('clampOffset', () => {
  test('should return value when within bounds', () => {
    expect(clampOffset(100)).toBe(100);
  });

  test('should clamp to max when exceeds', () => {
    expect(clampOffset(15000, 10000)).toBe(10000);
  });

  test('should return 0 for invalid values', () => {
    expect(clampOffset(-5)).toBe(0);
    expect(clampOffset(NaN)).toBe(0);
  });

  test('should floor floating point values', () => {
    expect(clampOffset(100.9)).toBe(100);
  });
});

describe('Security: Resource Exhaustion Prevention', () => {
  test('should prevent extremely large limit values', () => {
    const result = validatePaginationParams({ limit: 1000000 }, MAX_PAGE_SIZE.DEFAULT);
    expect(result.limit).toBeLessThanOrEqual(MAX_PAGE_SIZE.DEFAULT);
  });

  test('should prevent extremely large offset values', () => {
    const result = validatePaginationParams({ offset: 1000000 });
    expect(result.offset).toBeLessThanOrEqual(MAX_OFFSET.DEFAULT);
  });

  test('should handle malicious string inputs', () => {
    const result = validatePaginationParams({
      limit: 'DROP TABLE users;--' as any,
      offset: '<script>alert(1)</script>' as any
    });
    expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    expect(result.offset).toBe(0);
  });

  test('should handle scientific notation attempts', () => {
    const result = validatePaginationParams({ limit: '1e10' });
    // parseInt('1e10') returns 1, which is valid
    expect(result.limit).toBeLessThanOrEqual(MAX_PAGE_SIZE.DEFAULT);
  });

  test('should enforce different limits for different resource types', () => {
    // Vector search should be more restrictive
    const vectorResult = validatePaginationParams(
      { limit: 1000 },
      MAX_PAGE_SIZE.VECTOR_SEARCH
    );
    expect(vectorResult.limit).toBe(MAX_PAGE_SIZE.VECTOR_SEARCH);

    // Export operations can be more permissive
    const exportResult = validatePaginationParams(
      { limit: 5000 },
      MAX_PAGE_SIZE.EXPORT
    );
    expect(exportResult.limit).toBe(5000);
  });
});
