/**
 * Tests for src/lib/security/input-validator.ts
 * Input validation, sanitization, rate limiting, and security logging
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock zod-compat to use real zod
jest.unstable_mockModule('@/lib/zod-compat', () => {
  const zod = jest.requireActual('zod') as any;
  return { z: zod.z || zod };
});

describe('Input Validator', () => {
  let sanitizeHtml: any;
  let sanitizeUserInput: any;
  let validateAIQuery: any;
  let validatePrompt: any;
  let validateFileUpload: any;
  let AIQueryRateLimiter: any;
  let AISecurityLogger: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('@/lib/security/input-validator');
    sanitizeHtml = mod.sanitizeHtml;
    sanitizeUserInput = mod.sanitizeUserInput;
    validateAIQuery = mod.validateAIQuery;
    validatePrompt = mod.validatePrompt;
    validateFileUpload = mod.validateFileUpload;
    AIQueryRateLimiter = mod.AIQueryRateLimiter;
    AISecurityLogger = mod.AISecurityLogger;
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const result = sanitizeHtml('<script>alert("xss")</script>Hello');
      expect(result).not.toContain('<script');
      expect(result).toContain('Hello');
    });

    it('should remove event handlers', () => {
      const result = sanitizeHtml('<div onload="alert(1)">content</div>');
      expect(result).not.toContain('onload');
    });

    it('should remove javascript: protocol', () => {
      const result = sanitizeHtml('<a href="javascript:void(0)">click</a>');
      expect(result).not.toContain('javascript:');
    });

    it('should remove iframe tags', () => {
      const result = sanitizeHtml('<iframe src="evil.com"></iframe>content');
      expect(result).not.toContain('<iframe');
    });

    it('should remove object tags', () => {
      const result = sanitizeHtml('<object data="evil.swf"></object>content');
      expect(result).not.toContain('<object');
    });

    it('should remove embed tags', () => {
      const result = sanitizeHtml('<embed src="evil.swf">content');
      expect(result).not.toContain('<embed');
    });

    it('should normalize whitespace', () => {
      const result = sanitizeHtml('  hello   world  ');
      expect(result).toBe('hello world');
    });

    it('should handle empty string', () => {
      expect(sanitizeHtml('')).toBe('');
    });
  });

  describe('sanitizeUserInput', () => {
    it('should remove null bytes', () => {
      const result = sanitizeUserInput('hello\x00world');
      expect(result).not.toContain('\x00');
    });

    it('should remove control characters', () => {
      const result = sanitizeUserInput('hello\x01\x02\x03world');
      expect(result).toBe('hello world');
    });

    it('should remove zero-width characters', () => {
      const result = sanitizeUserInput('hello\u200Bworld');
      expect(result).toBe('helloworld');
    });

    it('should remove BOM characters', () => {
      const result = sanitizeUserInput('\uFEFFhello');
      expect(result).toBe('hello');
    });

    it('should normalize whitespace', () => {
      const result = sanitizeUserInput('  hello   world  ');
      expect(result).toBe('hello world');
    });

    it('should preserve normal text', () => {
      const result = sanitizeUserInput('Hello, World! 123');
      expect(result).toBe('Hello, World! 123');
    });

    it('should handle empty string', () => {
      expect(sanitizeUserInput('')).toBe('');
    });

    it('should preserve newlines and tabs as spaces', () => {
      const result = sanitizeUserInput('hello\nworld\tthere');
      expect(result).toBe('hello world there');
    });
  });

  describe('validateAIQuery', () => {
    it('should accept valid query', () => {
      const result = validateAIQuery({ query: 'How do I sort an array?' });
      expect(result.query).toBe('How do I sort an array?');
    });

    it('should throw on empty query', () => {
      expect(() => validateAIQuery({ query: '' })).toThrow('Invalid AI query');
    });

    it('should throw on missing query', () => {
      expect(() => validateAIQuery({})).toThrow();
    });

    it('should throw on query exceeding max length', () => {
      expect(() => validateAIQuery({ query: 'x'.repeat(10001) })).toThrow();
    });

    it('should reject script injection patterns', () => {
      expect(() => validateAIQuery({ query: '<script>alert(1)</script>' })).toThrow('unsafe');
    });

    it('should reject path traversal patterns', () => {
      expect(() => validateAIQuery({ query: '../../etc/passwd' })).toThrow('unsafe');
    });

    it('should reject NoSQL injection patterns', () => {
      expect(() => validateAIQuery({ query: 'find users where $where is true' })).toThrow('unsafe');
    });

    it('should reject javascript protocol', () => {
      expect(() => validateAIQuery({ query: 'javascript:void(0)' })).toThrow('unsafe');
    });

    it('should reject onload event handlers', () => {
      expect(() => validateAIQuery({ query: '<img onload=alert(1)>' })).toThrow('unsafe');
    });

    it('should sanitize the returned query', () => {
      const result = validateAIQuery({ query: 'hello\x00world' });
      expect(result.query).not.toContain('\x00');
    });

    it('should handle optional context', () => {
      const result = validateAIQuery({ query: 'test', context: 'JavaScript' });
      expect(result.context).toBe('JavaScript');
    });

    it('should handle optional metadata', () => {
      const result = validateAIQuery({ query: 'test', metadata: { lang: 'ts' } });
      expect(result.metadata).toEqual({ lang: 'ts' });
    });
  });

  describe('validatePrompt', () => {
    it('should accept valid prompt', () => {
      const result = validatePrompt({ content: 'Write a function to sort numbers' });
      expect(result.content).toBe('Write a function to sort numbers');
    });

    it('should throw on empty content', () => {
      expect(() => validatePrompt({ content: '' })).toThrow('Invalid prompt');
    });

    it('should throw on content exceeding max length', () => {
      expect(() => validatePrompt({ content: 'x'.repeat(50001) })).toThrow();
    });

    it('should sanitize variables', () => {
      const result = validatePrompt({
        content: 'test',
        variables: { name: '<script>evil</script>' },
      });
      expect(result.variables!.name).not.toContain('<script');
    });

    it('should handle optional systemPrompt', () => {
      const result = validatePrompt({
        content: 'test',
        systemPrompt: 'You are a helpful assistant',
      });
      expect(result.systemPrompt).toBe('You are a helpful assistant');
    });
  });

  describe('validateFileUpload', () => {
    it('should accept valid file upload', () => {
      const result = validateFileUpload({
        filename: 'test.txt',
        contentType: 'text/plain',
        size: 1024,
      });
      expect(result.filename).toBe('test.txt');
      expect(result.contentType).toBe('text/plain');
      expect(result.size).toBe(1024);
    });

    it('should reject empty filename', () => {
      expect(() => validateFileUpload({
        filename: '',
        contentType: 'text/plain',
        size: 1024,
      })).toThrow();
    });

    it('should reject path traversal in filename', () => {
      expect(() => validateFileUpload({
        filename: '../etc/passwd',
        contentType: 'text/plain',
        size: 1024,
      })).toThrow();
    });

    it('should reject invalid characters in filename', () => {
      expect(() => validateFileUpload({
        filename: 'file<name>.txt',
        contentType: 'text/plain',
        size: 1024,
      })).toThrow();
    });

    it('should reject invalid content type', () => {
      expect(() => validateFileUpload({
        filename: 'test.txt',
        contentType: 'invalid/type/extra',
        size: 1024,
      })).toThrow();
    });

    it('should reject oversized files', () => {
      expect(() => validateFileUpload({
        filename: 'test.txt',
        contentType: 'text/plain',
        size: 200 * 1024 * 1024, // 200MB
      })).toThrow();
    });

    it('should reject zero size', () => {
      expect(() => validateFileUpload({
        filename: 'test.txt',
        contentType: 'text/plain',
        size: 0,
      })).toThrow();
    });

    it('should reject negative size', () => {
      expect(() => validateFileUpload({
        filename: 'test.txt',
        contentType: 'text/plain',
        size: -1,
      })).toThrow();
    });

    it('should accept common content types', () => {
      const types = ['text/plain', 'application/json', 'image/png', 'audio/mpeg', 'video/mp4'];
      for (const type of types) {
        const result = validateFileUpload({
          filename: 'test',
          contentType: type,
          size: 1024,
        });
        expect(result.contentType).toBe(type);
      }
    });
  });

  describe('AIQueryRateLimiter', () => {
    it('should allow first request', () => {
      const limiter = new AIQueryRateLimiter();
      expect(limiter.checkRateLimit('user-1')).toBe(true);
    });

    it('should track remaining queries', () => {
      const limiter = new AIQueryRateLimiter();
      expect(limiter.getRemainingQueries('user-1')).toBe(100);
      limiter.checkRateLimit('user-1');
      expect(limiter.getRemainingQueries('user-1')).toBe(99);
    });

    it('should allow multiple users independently', () => {
      const limiter = new AIQueryRateLimiter();
      limiter.checkRateLimit('user-1');
      limiter.checkRateLimit('user-2');
      expect(limiter.getRemainingQueries('user-1')).toBe(99);
      expect(limiter.getRemainingQueries('user-2')).toBe(99);
    });

    it('should block when limit is reached', () => {
      const limiter = new AIQueryRateLimiter();
      for (let i = 0; i < 100; i++) {
        limiter.checkRateLimit('user-1');
      }
      expect(limiter.checkRateLimit('user-1')).toBe(false);
      expect(limiter.getRemainingQueries('user-1')).toBe(0);
    });

    it('should return full quota for unknown user', () => {
      const limiter = new AIQueryRateLimiter();
      expect(limiter.getRemainingQueries('unknown')).toBe(100);
    });
  });

  describe('AISecurityLogger', () => {
    it('should log suspicious activity', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      AISecurityLogger.logSuspiciousActivity('user-1', 'injection_attempt', { pattern: 'SQL' });
      expect(warnSpy).toHaveBeenCalled();
      const logArgs = warnSpy.mock.calls[0];
      expect(logArgs[0]).toBe('[AI_SECURITY]');
      warnSpy.mockRestore();
    });

    it('should log validation failure', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      AISecurityLogger.logValidationFailure('user-1', 'bad input', 'too long');
      expect(warnSpy).toHaveBeenCalled();
      const logArgs = warnSpy.mock.calls[0];
      expect(logArgs[0]).toBe('[AI_VALIDATION_FAILURE]');
      warnSpy.mockRestore();
    });

    it('should truncate long input in validation failure log', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const longInput = 'x'.repeat(200);
      AISecurityLogger.logValidationFailure('user-1', longInput, 'too long');
      const logData = warnSpy.mock.calls[0][1] as any;
      expect(logData.inputSample.length).toBeLessThan(200);
      expect(logData.inputSample).toContain('...');
      warnSpy.mockRestore();
    });
  });
});
