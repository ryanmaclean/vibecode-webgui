/**
 * Tests for AI input validation and security measures
 */

import {
  validateAIQuery,
  validatePrompt,
  validateFileUpload,
  sanitizeUserInput,
  sanitizeHtml,
  aiRateLimiter,
  AISecurityLogger
} from '../../src/lib/security/input-validator';

describe('Input Validator Security Tests', () => {
  beforeEach(() => {
    // Reset rate limiter between tests
    (aiRateLimiter as any).queryCache.clear();
    jest.clearAllMocks();
  });

  describe('validateAIQuery', () => {
    it('should accept valid queries', () => {
      const validInput = {
        query: 'How do I implement React hooks?',
        context: 'React development',
        metadata: { source: 'user' }
      };

      const result = validateAIQuery(validInput);
      expect(result.query).toBe('How do I implement React hooks?');
      expect(result.context).toBe('React development');
    });

    it('should reject SQL injection attempts', () => {
      const sqlInjection = {
        query: "'; DROP TABLE users; --"
      };

      expect(() => validateAIQuery(sqlInjection)).toThrow('potentially unsafe content');
    });

    it('should reject NoSQL injection attempts', () => {
      const nosqlInjection = {
        query: 'Find user where $ne: password'
      };

      expect(() => validateAIQuery(nosqlInjection)).toThrow('potentially unsafe content');
    });

    it('should reject command injection attempts', () => {
      const cmdInjection = {
        query: 'How to; rm -rf /'
      };

      expect(() => validateAIQuery(cmdInjection)).toThrow('potentially unsafe content');
    });

    it('should reject script injection attempts', () => {
      const scriptInjection = {
        query: '<script>alert("xss")</script>How to code?'
      };

      expect(() => validateAIQuery(scriptInjection)).toThrow('potentially unsafe content');
    });

    it('should reject GraphQL/Cypher injection attempts', () => {
      const cypherInjection = {
        query: 'MATCH (n) DELETE n RETURN count(*)'
      };

      expect(() => validateAIQuery(cypherInjection)).toThrow('potentially unsafe content');
    });

    it('should reject oversized queries', () => {
      const oversizedQuery = {
        query: 'a'.repeat(10001) // Exceeds 10000 char limit
      };

      expect(() => validateAIQuery(oversizedQuery)).toThrow('cannot exceed 10000 characters');
    });

    it('should reject empty queries', () => {
      const emptyQuery = { query: '' };
      expect(() => validateAIQuery(emptyQuery)).toThrow('Query cannot be empty');
    });
  });

  describe('validatePrompt', () => {
    it('should accept valid prompts', () => {
      const validPrompt = {
        content: 'Generate a React component for {{componentName}}',
        variables: { componentName: 'UserProfile' },
        systemPrompt: 'You are a helpful coding assistant'
      };

      const result = validatePrompt(validPrompt);
      expect(result.content).toBe('Generate a React component for {{componentName}}');
      expect(result.variables?.componentName).toBe('UserProfile');
    });

    it('should sanitize prompt variables', () => {
      const promptWithSuspiciousVars = {
        content: 'Generate code for {{name}}',
        variables: { name: '<script>alert("xss")</script>UserList' }
      };

      const result = validatePrompt(promptWithSuspiciousVars);
      // Should sanitize the variable value
      expect(result.variables?.name).not.toContain('<script>');
    });

    it('should reject oversized prompts', () => {
      const oversizedPrompt = {
        content: 'a'.repeat(50001) // Exceeds 50000 char limit
      };

      expect(() => validatePrompt(oversizedPrompt)).toThrow('cannot exceed 50000 characters');
    });
  });

  describe('validateFileUpload', () => {
    it('should accept valid file uploads', () => {
      const validFile = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024 // 1MB
      };

      const result = validateFileUpload(validFile);
      expect(result.filename).toBe('document.pdf');
      expect(result.contentType).toBe('application/pdf');
    });

    it('should reject path traversal attempts in filename', () => {
      const pathTraversal = {
        filename: '../../../etc/passwd',
        contentType: 'text/plain',
        size: 1024
      };

      expect(() => validateFileUpload(pathTraversal)).toThrow('Invalid filename format');
    });

    it('should reject invalid content types', () => {
      const invalidContentType = {
        filename: 'test.txt',
        contentType: 'invalid/content-type!',
        size: 1024
      };

      expect(() => validateFileUpload(invalidContentType)).toThrow('Invalid content type');
    });

    it('should reject oversized files', () => {
      const oversizedFile = {
        filename: 'huge.zip',
        contentType: 'application/zip',
        size: 200 * 1024 * 1024 // 200MB, exceeds 100MB limit
      };

      expect(() => validateFileUpload(oversizedFile)).toThrow('cannot exceed 100MB');
    });
  });

  describe('sanitizeUserInput', () => {
    it('should remove control characters', () => {
      const input = 'Hello\x00\x08World\x1F';
      const result = sanitizeUserInput(input);
      expect(result).toBe('Hello World');
    });

    it('should normalize whitespace', () => {
      const input = 'Hello    \n\n   World   ';
      const result = sanitizeUserInput(input);
      expect(result).toBe('Hello World');
    });

    it('should remove dangerous Unicode characters', () => {
      const input = 'Hello\u200BWorld\uFEFF';
      const result = sanitizeUserInput(input);
      expect(result).toBe('HelloWorld');
    });
  });

  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Hello <strong>world</strong></p>');
    });

    it('should remove dangerous HTML tags', () => {
      const input = '<script>alert("xss")</script><p>Safe content</p>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Safe content</p>');
    });

    it('should remove event handlers', () => {
      const input = '<p onclick="alert(1)">Click me</p>';
      const result = sanitizeHtml(input);
      expect(result).toBe('<p>Click me</p>');
    });
  });

  describe('AIQueryRateLimiter', () => {
    it('should allow queries within rate limit', () => {
      const userId = 'test-user';
      
      for (let i = 0; i < 100; i++) {
        expect(aiRateLimiter.checkRateLimit(userId)).toBe(true);
      }
    });

    it('should block queries exceeding rate limit', () => {
      const userId = 'test-user-2';
      
      // Exhaust the rate limit
      for (let i = 0; i < 100; i++) {
        aiRateLimiter.checkRateLimit(userId);
      }
      
      // Next query should be blocked
      expect(aiRateLimiter.checkRateLimit(userId)).toBe(false);
    });

    it('should reset rate limit after time window', () => {
      const userId = 'test-user-3';
      
      // Mock Date.now to simulate time passage
      const originalNow = Date.now;
      let mockTime = originalNow();
      Date.now = jest.fn(() => mockTime);
      
      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        aiRateLimiter.checkRateLimit(userId);
      }
      expect(aiRateLimiter.checkRateLimit(userId)).toBe(false);
      
      // Simulate time passage (1 hour + 1 minute)
      mockTime += 61 * 60 * 1000;
      
      // Should allow queries again
      expect(aiRateLimiter.checkRateLimit(userId)).toBe(true);
      
      // Restore Date.now
      Date.now = originalNow;
    });

    it('should return correct remaining query count', () => {
      const userId = 'test-user-4';
      
      expect(aiRateLimiter.getRemainingQueries(userId)).toBe(100);
      
      aiRateLimiter.checkRateLimit(userId);
      expect(aiRateLimiter.getRemainingQueries(userId)).toBe(99);
      
      aiRateLimiter.checkRateLimit(userId);
      expect(aiRateLimiter.getRemainingQueries(userId)).toBe(98);
    });
  });

  describe('AISecurityLogger', () => {
    it('should log suspicious activity', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      AISecurityLogger.logSuspiciousActivity('test-user', 'SUSPICIOUS_QUERY', {
        query: 'DROP TABLE users',
        severity: 'HIGH'
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('[AI_SECURITY]', expect.objectContaining({
        userId: 'test-user',
        activity: 'SUSPICIOUS_QUERY',
        details: expect.objectContaining({
          query: 'DROP TABLE users',
          severity: 'HIGH'
        })
      }));
      
      consoleSpy.mockRestore();
    });

    it('should log validation failures', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      AISecurityLogger.logValidationFailure(
        'test-user',
        'malicious input here',
        'SQL injection detected'
      );
      
      expect(consoleSpy).toHaveBeenCalledWith('[AI_VALIDATION_FAILURE]', expect.objectContaining({
        userId: 'test-user',
        validationError: 'SQL injection detected',
        inputSample: 'malicious input here'
      }));
      
      consoleSpy.mockRestore();
    });
  });
});