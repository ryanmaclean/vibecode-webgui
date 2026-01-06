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

// Mock console methods for testing logger
const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('Input Validator Security Tests', () => {
  beforeEach(() => {
    // Reset rate limiter between tests
    (aiRateLimiter as any).queryCache.clear();
    jest.clearAllMocks();
    consoleSpy.mockClear();
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
        query: 'SELECT * FROM users WHERE id = 1; DROP TABLE users;',
      };

      expect(() => validateAIQuery(sqlInjection)).toThrow('potentially unsafe content');
    });

    it('should reject NoSQL injection attempts', () => {
      const nosqlInjection = {
        query: 'Find users where {$ne: null}',
      };

      expect(() => validateAIQuery(nosqlInjection)).toThrow('potentially unsafe content');
    });

    it('should reject command injection attempts', () => {
      const cmdInjection = {
        query: 'List files; rm -rf /',
      };

      expect(() => validateAIQuery(cmdInjection)).toThrow('potentially unsafe content');
    });

    it('should reject script injection attempts', () => {
      const scriptInjection = {
        query: '<script>alert("xss")</script>',
      };

      expect(() => validateAIQuery(scriptInjection)).toThrow('potentially unsafe content');
    });

    it('should reject GraphQL/Cypher injection attempts', () => {
      const cypherInjection = {
        query: 'MATCH (n) DELETE n',
      };

      expect(() => validateAIQuery(cypherInjection)).toThrow('potentially unsafe content');
    });

    it('should reject oversized queries', () => {
      const oversizedQuery = {
        query: 'a'.repeat(10001),
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
        variables: { componentName: 'UserProfile' }
      };

      const result = validatePrompt(validPrompt);
      expect(result.content).toBe('Generate a React component for {{componentName}}');
      expect(result.variables?.componentName).toBe('UserProfile');
    });

    it('should sanitize prompt variables', () => {
      const promptWithSuspiciousVars = {
        content: 'Generate component for {{name}}',
        variables: { name: 'Test<script>alert(1)</script>Component' }
      };

      const result = validatePrompt(promptWithSuspiciousVars);
      // Should sanitize the variable value
      expect(result.variables?.name).not.toContain('<script>');
    });

    it('should reject oversized prompts', () => {
      const oversizedPrompt = {
        content: 'a'.repeat(50001),
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
        contentType: 'invalid/type',
        size: 1024
      };

      expect(() => validateFileUpload(invalidContentType)).toThrow('Invalid content type');
    });

    it('should reject oversized files', () => {
      const oversizedFile = {
        filename: 'large.zip',
        contentType: 'application/zip',
        size: 101 * 1024 * 1024 // 101MB
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
      const userId = 'test-user-1';
      
      for (let i = 0; i < 100; i++) {
        expect(aiRateLimiter.checkRateLimit(userId)).toBe(true);
      }
    });

    it('should block queries exceeding rate limit', () => {
      const userId = 'test-user-2';
      
      // Use up the rate limit
      for (let i = 0; i < 100; i++) {
        aiRateLimiter.checkRateLimit(userId);
      }
      
      // Next query should be blocked
      expect(aiRateLimiter.checkRateLimit(userId)).toBe(false);
    });

    it('should reset rate limit after time window', () => {
      const userId = 'test-user-3';
      let mockTime = Date.now();
      
      // Mock Date.now to control time
      const originalDateNow = Date.now;
      Date.now = () => mockTime;
      
      // Use up the rate limit
      for (let i = 0; i < 100; i++) {
        aiRateLimiter.checkRateLimit(userId);
      }
      expect(aiRateLimiter.checkRateLimit(userId)).toBe(false);
      
      // Simulate time passage (1 hour + 1 minute)
      mockTime += 61 * 60 * 1000;
      
      // Should allow queries again
      expect(aiRateLimiter.checkRateLimit(userId)).toBe(true);
      
      // Restore original Date.now
      Date.now = originalDateNow;
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
    it('should log suspicious activity without errors', () => {
      // Just verify the logger methods can be called without throwing
      expect(() => {
        AISecurityLogger.logSuspiciousActivity('test-user', 'SUSPICIOUS_QUERY', {
          query: 'DROP TABLE users',
          severity: 'HIGH'
        });
      }).not.toThrow();
    });

    it('should log validation failures without errors', () => {
      // Just verify the logger methods can be called without throwing
      expect(() => {
        AISecurityLogger.logValidationFailure(
          'test-user',
          'malicious input here',
          'SQL injection detected'
        );
      }).not.toThrow();
    });
  });
});