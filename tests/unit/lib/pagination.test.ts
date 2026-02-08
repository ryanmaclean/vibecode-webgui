/**
 * Tests for src/lib/api/pagination.ts
 * Pagination validation, normalization, and response helpers
 */

import { describe, it, expect } from '@jest/globals';
import {
  validatePaginationParams,
  createPaginatedResponse,
  getPaginationFromSearchParams,
  getPaginationFromBody,
  isValidLimit,
  isValidOffset,
  clampLimit,
  clampOffset,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  MAX_OFFSET,
} from '@/lib/api/pagination';

describe('Pagination Utils', () => {
  describe('validatePaginationParams', () => {
    it('should return defaults when no params provided', () => {
      const result = validatePaginationParams({});
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
      expect(result.offset).toBe(0);
      expect(result.page).toBeUndefined();
    });

    it('should parse numeric limit', () => {
      const result = validatePaginationParams({ limit: 50 });
      expect(result.limit).toBe(50);
    });

    it('should parse string limit', () => {
      const result = validatePaginationParams({ limit: '25' });
      expect(result.limit).toBe(25);
    });

    it('should cap limit at maxLimit', () => {
      const result = validatePaginationParams({ limit: 500 }, 100);
      expect(result.limit).toBe(100);
    });

    it('should use default for invalid limit', () => {
      const result = validatePaginationParams({ limit: 'abc' });
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    });

    it('should use default for zero limit', () => {
      const result = validatePaginationParams({ limit: 0 });
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    });

    it('should use default for negative limit', () => {
      const result = validatePaginationParams({ limit: -5 });
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    });

    it('should use default for null limit', () => {
      const result = validatePaginationParams({ limit: null });
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    });

    it('should parse numeric offset', () => {
      const result = validatePaginationParams({ offset: 100 });
      expect(result.offset).toBe(100);
    });

    it('should parse string offset', () => {
      const result = validatePaginationParams({ offset: '50' });
      expect(result.offset).toBe(50);
    });

    it('should cap offset at maxOffset', () => {
      const result = validatePaginationParams({ offset: 999999 }, 100, 20, 1000);
      expect(result.offset).toBe(1000);
    });

    it('should use 0 for invalid offset', () => {
      const result = validatePaginationParams({ offset: 'abc' });
      expect(result.offset).toBe(0);
    });

    it('should use 0 for negative offset', () => {
      const result = validatePaginationParams({ offset: -10 });
      expect(result.offset).toBe(0);
    });

    it('should handle page-based pagination', () => {
      const result = validatePaginationParams({ page: 3, limit: 10 });
      expect(result.page).toBe(3);
      expect(result.offset).toBe(20); // (3-1) * 10
    });

    it('should handle string page', () => {
      const result = validatePaginationParams({ page: '2', limit: 10 });
      expect(result.page).toBe(2);
      expect(result.offset).toBe(10);
    });

    it('should ignore page 0', () => {
      const result = validatePaginationParams({ page: 0 });
      expect(result.page).toBeUndefined();
    });

    it('should ignore negative page', () => {
      const result = validatePaginationParams({ page: -1 });
      expect(result.page).toBeUndefined();
    });

    it('should ignore invalid page string', () => {
      const result = validatePaginationParams({ page: 'abc' });
      expect(result.page).toBeUndefined();
    });

    it('should use custom default limit', () => {
      const result = validatePaginationParams({}, 100, 50);
      expect(result.limit).toBe(50);
    });

    it('should cap page offset at maxOffset', () => {
      const result = validatePaginationParams({ page: 10000, limit: 100 }, 100, 20, 5000);
      expect(result.offset).toBe(5000);
    });
  });

  describe('createPaginatedResponse', () => {
    it('should create response with data and pagination info', () => {
      const data = [1, 2, 3];
      const result = createPaginatedResponse(data, { limit: 10, offset: 0 });
      expect(result.data).toEqual([1, 2, 3]);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.offset).toBe(0);
    });

    it('should set hasMore=false when data length < limit', () => {
      const data = [1, 2, 3];
      const result = createPaginatedResponse(data, { limit: 10, offset: 0 });
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should set hasMore=true when data length equals limit', () => {
      const data = [1, 2, 3, 4, 5];
      const result = createPaginatedResponse(data, { limit: 5, offset: 0 });
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should use total count when provided', () => {
      const data = [1, 2, 3];
      const result = createPaginatedResponse(data, { limit: 3, offset: 0 }, 10);
      expect(result.pagination.total).toBe(10);
      expect(result.pagination.totalPages).toBe(4); // ceil(10/3)
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should set hasMore=false when offset+data >= total', () => {
      const data = [1, 2];
      const result = createPaginatedResponse(data, { limit: 10, offset: 8 }, 10);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should include page when present in params', () => {
      const data = [1, 2, 3];
      const result = createPaginatedResponse(data, { limit: 10, offset: 10, page: 2 });
      expect(result.pagination.page).toBe(2);
    });

    it('should not include page when not present', () => {
      const data = [1, 2, 3];
      const result = createPaginatedResponse(data, { limit: 10, offset: 0 });
      expect(result.pagination.page).toBeUndefined();
    });

    it('should handle empty data array', () => {
      const result = createPaginatedResponse([], { limit: 10, offset: 0 }, 0);
      expect(result.data).toEqual([]);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('getPaginationFromSearchParams', () => {
    it('should extract params from URLSearchParams', () => {
      const params = new URLSearchParams('limit=25&offset=50');
      const result = getPaginationFromSearchParams(params);
      expect(result.limit).toBe(25);
      expect(result.offset).toBe(50);
    });

    it('should handle missing params', () => {
      const params = new URLSearchParams('');
      const result = getPaginationFromSearchParams(params);
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
      expect(result.offset).toBe(0);
    });

    it('should handle page param', () => {
      const params = new URLSearchParams('page=3&limit=10');
      const result = getPaginationFromSearchParams(params);
      expect(result.page).toBe(3);
      expect(result.offset).toBe(20);
    });

    it('should use custom max and default limits', () => {
      const params = new URLSearchParams('limit=500');
      const result = getPaginationFromSearchParams(params, 50, 10);
      expect(result.limit).toBe(50);
    });
  });

  describe('getPaginationFromBody', () => {
    it('should extract params from body object', () => {
      const result = getPaginationFromBody({ limit: 30, offset: 60 });
      expect(result.limit).toBe(30);
      expect(result.offset).toBe(60);
    });

    it('should handle empty body', () => {
      const result = getPaginationFromBody({});
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
      expect(result.offset).toBe(0);
    });
  });

  describe('isValidLimit', () => {
    it('should return true for valid limit', () => {
      expect(isValidLimit(10)).toBe(true);
      expect(isValidLimit(100)).toBe(true);
      expect(isValidLimit(1)).toBe(true);
    });

    it('should return false for zero', () => {
      expect(isValidLimit(0)).toBe(false);
    });

    it('should return false for negative', () => {
      expect(isValidLimit(-5)).toBe(false);
    });

    it('should return false for exceeding max', () => {
      expect(isValidLimit(200, 100)).toBe(false);
    });

    it('should return false for non-integer', () => {
      expect(isValidLimit(5.5)).toBe(false);
    });
  });

  describe('isValidOffset', () => {
    it('should return true for valid offset', () => {
      expect(isValidOffset(0)).toBe(true);
      expect(isValidOffset(100)).toBe(true);
    });

    it('should return false for negative', () => {
      expect(isValidOffset(-1)).toBe(false);
    });

    it('should return false for exceeding max', () => {
      expect(isValidOffset(20000, 10000)).toBe(false);
    });

    it('should return false for non-integer', () => {
      expect(isValidOffset(5.5)).toBe(false);
    });
  });

  describe('clampLimit', () => {
    it('should return value when in range', () => {
      expect(clampLimit(50)).toBe(50);
    });

    it('should return default for zero', () => {
      expect(clampLimit(0)).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    });

    it('should return default for negative', () => {
      expect(clampLimit(-10)).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    });

    it('should return default for NaN', () => {
      expect(clampLimit(NaN)).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    });

    it('should return default for Infinity', () => {
      expect(clampLimit(Infinity)).toBe(DEFAULT_PAGE_SIZE.DEFAULT);
    });

    it('should cap at max', () => {
      expect(clampLimit(500, 100)).toBe(100);
    });

    it('should floor decimal values', () => {
      expect(clampLimit(10.7)).toBe(10);
    });

    it('should use custom default', () => {
      expect(clampLimit(-1, 100, 50)).toBe(50);
    });
  });

  describe('clampOffset', () => {
    it('should return value when in range', () => {
      expect(clampOffset(100)).toBe(100);
    });

    it('should return 0 for negative', () => {
      expect(clampOffset(-10)).toBe(0);
    });

    it('should return 0 for NaN', () => {
      expect(clampOffset(NaN)).toBe(0);
    });

    it('should cap at max', () => {
      expect(clampOffset(50000, 10000)).toBe(10000);
    });

    it('should floor decimal values', () => {
      expect(clampOffset(10.9)).toBe(10);
    });

    it('should return 0 for Infinity', () => {
      expect(clampOffset(Infinity)).toBe(0);
    });
  });

  describe('Constants', () => {
    it('should have reasonable MAX_PAGE_SIZE defaults', () => {
      expect(MAX_PAGE_SIZE.DEFAULT).toBe(100);
      expect(MAX_PAGE_SIZE.VECTOR_SEARCH).toBe(50);
      expect(MAX_PAGE_SIZE.EXPORT).toBe(10000);
    });

    it('should have reasonable DEFAULT_PAGE_SIZE defaults', () => {
      expect(DEFAULT_PAGE_SIZE.DEFAULT).toBe(20);
      expect(DEFAULT_PAGE_SIZE.MESSAGES).toBe(50);
    });

    it('should have reasonable MAX_OFFSET defaults', () => {
      expect(MAX_OFFSET.DEFAULT).toBe(10000);
      expect(MAX_OFFSET.EXTENDED).toBe(100000);
    });
  });
});
