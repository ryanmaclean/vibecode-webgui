/**
 * Tests for Zod compatibility wrapper
 */
import { z, isZodError } from '@/lib/zod-compat';
import { ZodError } from 'zod';

describe('zod-compat', () => {
  describe('z export', () => {
    it('should export z from zod', () => {
      expect(z).toBeDefined();
      expect(typeof z.string).toBe('function');
      expect(typeof z.number).toBe('function');
      expect(typeof z.object).toBe('function');
    });

    it('should create valid string schema', () => {
      const schema = z.string();
      expect(schema.parse('hello')).toBe('hello');
    });

    it('should create valid number schema', () => {
      const schema = z.number();
      expect(schema.parse(42)).toBe(42);
    });

    it('should create valid object schema', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const result = schema.parse({ name: 'John', age: 30 });
      expect(result).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('isZodError', () => {
    it('should return true for ZodError instances', () => {
      const schema = z.string();
      try {
        schema.parse(123);
      } catch (error) {
        expect(isZodError(error)).toBe(true);
      }
    });

    it('should return false for regular Error', () => {
      const error = new Error('test error');
      expect(isZodError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isZodError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isZodError(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isZodError('not an error')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isZodError(123)).toBe(false);
    });

    it('should return false for object', () => {
      expect(isZodError({ message: 'not a zod error' })).toBe(false);
    });

    it('should correctly identify ZodError with validation issues', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(0),
      });

      try {
        schema.parse({ email: 'invalid', age: -1 });
      } catch (error) {
        expect(isZodError(error)).toBe(true);
        if (isZodError(error)) {
          expect(error.issues.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
