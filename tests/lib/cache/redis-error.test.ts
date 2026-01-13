/**
 * Tests for RedisError custom error class
 */
import { RedisError } from '@/lib/cache/redis-error';

describe('RedisError', () => {
  describe('constructor', () => {
    it('should create error with message and operation', () => {
      const error = new RedisError('Connection failed', 'connect');
      expect(error.message).toBe('Connection failed');
      expect(error.operation).toBe('connect');
      expect(error.name).toBe('RedisError');
    });

    it('should create error with cause', () => {
      const cause = new Error('Network timeout');
      const error = new RedisError('Redis operation failed', 'get', cause);
      expect(error.cause).toBe(cause);
    });

    it('should create error without cause', () => {
      const error = new RedisError('Redis error', 'set');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('name property', () => {
    it('should have name RedisError', () => {
      const error = new RedisError('Test', 'test');
      expect(error.name).toBe('RedisError');
    });
  });

  describe('operation property', () => {
    it('should store operation type', () => {
      const error = new RedisError('Test', 'connect');
      expect(error.operation).toBe('connect');
    });

    it('should handle different operation types', () => {
      const operations = ['get', 'set', 'del', 'keys', 'scan'];
      operations.forEach(op => {
        const error = new RedisError('Test', op);
        expect(error.operation).toBe(op);
      });
    });
  });

  describe('inheritance', () => {
    it('should be instance of Error', () => {
      const error = new RedisError('Test', 'test');
      expect(error instanceof Error).toBe(true);
    });

    it('should be instance of RedisError', () => {
      const error = new RedisError('Test', 'test');
      expect(error instanceof RedisError).toBe(true);
    });
  });

  describe('stack trace', () => {
    it('should have stack trace', () => {
      const error = new RedisError('Test', 'test');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });

    it('should capture stack trace at creation point', () => {
      const error = new RedisError('Test', 'test');
      expect(error.stack).toContain('RedisError');
    });
  });

  describe('error message formatting', () => {
    it('should preserve error message', () => {
      const message = 'Connection refused on port 6379';
      const error = new RedisError(message, 'connect');
      expect(error.message).toBe(message);
    });

    it('should handle multiline messages', () => {
      const message = 'Error:\nLine 1\nLine 2';
      const error = new RedisError(message, 'test');
      expect(error.message).toBe(message);
    });
  });

  describe('error with various cause types', () => {
    it('should handle Error cause', () => {
      const cause = new Error('Original error');
      const error = new RedisError('Wrapped', 'test', cause);
      expect(error.cause).toBe(cause);
    });

    it('should handle string cause', () => {
      const error = new RedisError('Test', 'test', 'string cause');
      expect(error.cause).toBe('string cause');
    });

    it('should handle object cause', () => {
      const cause = { code: 'ECONNREFUSED', port: 6379 };
      const error = new RedisError('Test', 'test', cause);
      expect(error.cause).toEqual(cause);
    });

    it('should handle null cause', () => {
      const error = new RedisError('Test', 'test', null);
      expect(error.cause).toBeNull();
    });
  });

  describe('error serialization', () => {
    it('should convert to string', () => {
      const error = new RedisError('Test error', 'get');
      const str = error.toString();
      expect(str).toContain('RedisError');
      expect(str).toContain('Test error');
    });

    it('should work with JSON.stringify', () => {
      const error = new RedisError('Test error', 'set');
      const json = JSON.stringify(error);
      expect(json).toBeDefined();
      // Note: Error objects don't serialize all properties by default
    });
  });
});
