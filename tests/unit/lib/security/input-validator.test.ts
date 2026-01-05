/**
 * Unit Tests for Input Validator Module
 * Tests input validation, sanitization, rate limiting, and security logging
 */

import { jest } from '@jest/globals'
import * as validator from '@/lib/security/input-validator'

// Define SpyInstance type directly since it's not properly exported
type SpyInstance = jest.SpiedFunction<any>

describe('Input Validator Module', () => {
  let consoleSpy: SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<p>Safe text</p><script>alert("xss")</script>'
      const result = validator.sanitizeHtml(input)
      expect(result).not.toContain('<script>')
      expect(result).toContain('Safe text')
    })

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>'
      const result = validator.sanitizeHtml(input)
      expect(result).not.toContain('onclick')
    })

    it('should remove javascript: urls', () => {
      const input = '<a href="javascript:alert(1)">Click</a>'
      const result = validator.sanitizeHtml(input)
      expect(result).not.toContain('javascript:')
    })

    it('should remove iframe tags', () => {
      const input = '<iframe src="http://evil.com"></iframe>'
      const result = validator.sanitizeHtml(input)
      expect(result).not.toContain('iframe')
    })
  })

  describe('sanitizeUserInput', () => {
    it('should remove null bytes and control characters', () => {
      const input = 'Hello\x00World\x1F'
      const result = validator.sanitizeUserInput(input)
      expect(result).toBe('Hello World')
    })

    it('should remove zero-width characters', () => {
      const input = 'Hello\u200BWorld'
      const result = validator.sanitizeUserInput(input)
      expect(result).toBe('HelloWorld')
    })

    it('should normalize whitespace', () => {
      const input = 'Hello    World  \n  Test'
      const result = validator.sanitizeUserInput(input)
      expect(result).toBe('Hello World Test')
    })
  })

  describe('validateAIQuery', () => {
    it('should validate a clean query', () => {
      const input = { query: 'What is the weather today?' }
      const result = validator.validateAIQuery(input)
      expect(result.query).toBe('What is the weather today?')
    })

    it('should reject SQL injection attempts', () => {
      const input = { query: "SELECT * FROM users; DROP TABLE users;" }
      expect(() => validator.validateAIQuery(input)).toThrow('potentially unsafe content')
    })

    it('should reject queries that are too long', () => {
      const input = { query: 'A'.repeat(10001) }
      expect(() => validator.validateAIQuery(input)).toThrow('cannot exceed')
    })

    it('should reject empty queries', () => {
      const input = { query: '' }
      expect(() => validator.validateAIQuery(input)).toThrow('cannot be empty')
    })
  })

  describe('validatePrompt', () => {
    it('should validate a clean prompt', () => {
      const input = { content: 'Generate a story about cats' }
      const result = validator.validatePrompt(input)
      expect(result.content).toBe('Generate a story about cats')
    })

    it('should sanitize variables', () => {
      const input = {
        content: 'Test',
        variables: { name: '<script>alert(1)</script>John' }
      }
      const result = validator.validatePrompt(input)
      expect(result.variables?.name).not.toContain('<script>')
    })
  })

  describe('validateFileUpload', () => {
    it('should validate a proper file upload', () => {
      const input = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024
      }
      const result = validator.validateFileUpload(input)
      expect(result.filename).toBe('document.pdf')
    })

    it('should reject path traversal in filename', () => {
      const input = {
        filename: '../../../etc/passwd',
        contentType: 'text/plain',
        size: 1024
      }
      expect(() => validator.validateFileUpload(input)).toThrow('Invalid filename')
    })

    it('should reject files that are too large', () => {
      const input = {
        filename: 'large.bin',
        contentType: 'application/octet-stream',
        size: 200 * 1024 * 1024
      }
      expect(() => validator.validateFileUpload(input)).toThrow('cannot exceed')
    })
  })

  describe('AIQueryRateLimiter', () => {
    it('should allow queries within limit', () => {
      const limiter = new validator.AIQueryRateLimiter()
      expect(limiter.checkRateLimit('user1')).toBe(true)
      expect(limiter.checkRateLimit('user1')).toBe(true)
    })

    it('should track remaining queries', () => {
      const limiter = new validator.AIQueryRateLimiter()
      limiter.checkRateLimit('user1')
      const remaining = limiter.getRemainingQueries('user1')
      expect(remaining).toBeLessThan(100)
    })
  })

  describe('AISecurityLogger', () => {
    it('should log suspicious activity', () => {
      validator.AISecurityLogger.logSuspiciousActivity('user1', 'SQL_INJECTION', {
        query: 'DROP TABLE'
      })
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should log validation failures', () => {
      validator.AISecurityLogger.logValidationFailure('user1', 'bad input', 'Invalid format')
      expect(consoleSpy).toHaveBeenCalled()
    })
  })
})
