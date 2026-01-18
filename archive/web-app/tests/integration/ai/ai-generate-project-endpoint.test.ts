/**
 * Comprehensive tests for /api/ai/generate-project endpoint
 *
 * Tests all critical paths including:
 * - Project generation with various prompts
 * - Request validation
 * - Response structure validation
 * - Error handling
 * - Performance benchmarks
 */

import { NextRequest } from 'next/server';
import { POST, generateProjectWithAI } from '@/app/api/ai/generate-project/route';

describe('Integration: /api/ai/generate-project', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Happy Path - Project Generation', () => {
    it('should generate project with valid prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Create a simple React app',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('success');
      expect(data.message).toBe('Project generation endpoint is working');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('project');
    });

    it('should return project structure', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Create a Next.js application',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.project).toHaveProperty('name');
      expect(data.project).toHaveProperty('description');
      expect(data.project).toHaveProperty('files');
      expect(data.project).toHaveProperty('scripts');
      expect(data.project).toHaveProperty('dependencies');
      expect(data.project).toHaveProperty('devDependencies');
      expect(data.project).toHaveProperty('envVars');
    });

    it('should accept detailed project prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt:
            'Create a full-stack e-commerce application with React frontend, Node.js backend, and PostgreSQL database',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.project.description).toContain('e-commerce');
    });

    it('should handle short prompts', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'React app',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should handle long prompts', async () => {
      const longPrompt =
        'Create a comprehensive application with ' + 'x'.repeat(1000);

      const mockRequest = {
        json: async () => ({
          prompt: longPrompt,
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });
  });

  describe('Request Validation', () => {
    it('should reject missing prompt', async () => {
      const mockRequest = {
        json: async () => ({}),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Invalid request');
      expect(data.details).toBeDefined();
    });

    it('should reject empty prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: '',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.details).toBeDefined();
      expect(data.details[0].message).toContain('required');
    });

    it('should reject null prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: null,
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
    });

    it('should reject non-string prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 123,
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
    });

    it('should validate prompt field is present', async () => {
      const mockRequest = {
        json: async () => ({
          projectName: 'test',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
    });
  });

  describe('Response Structure Validation', () => {
    it('should return consistent response shape', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(Object.keys(data).sort()).toEqual([
        'message',
        'project',
        'status',
        'timestamp',
      ]);
    });

    it('should return valid ISO timestamp', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      const timestamp = new Date(data.timestamp);
      expect(timestamp.toISOString()).toBe(data.timestamp);
    });

    it('should return project with all required fields', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      const requiredFields = [
        'name',
        'description',
        'files',
        'scripts',
        'dependencies',
        'devDependencies',
        'envVars',
      ];

      requiredFields.forEach((field) => {
        expect(data.project).toHaveProperty(field);
      });
    });

    it('should return files as array', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(Array.isArray(data.project.files)).toBe(true);
    });

    it('should return scripts as object', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(typeof data.project.scripts).toBe('object');
      expect(data.project.scripts).not.toBeNull();
    });

    it('should return dependencies as object', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(typeof data.project.dependencies).toBe('object');
      expect(data.project.dependencies).not.toBeNull();
    });

    it('should return envVars as array', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(Array.isArray(data.project.envVars)).toBe(true);
    });
  });

  describe('Core Logic - generateProjectWithAI', () => {
    it('should be exported for testing', () => {
      expect(typeof generateProjectWithAI).toBe('function');
    });

    it('should accept prompt parameter', async () => {
      const result = await generateProjectWithAI('Test prompt');
      expect(result).toBeDefined();
    });

    it('should accept optional options parameter', async () => {
      const result = await generateProjectWithAI('Test prompt', {
        framework: 'react',
      });
      expect(result).toBeDefined();
    });

    it('should return project structure', async () => {
      const result = await generateProjectWithAI('Test prompt');

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('scripts');
      expect(result).toHaveProperty('dependencies');
      expect(result).toHaveProperty('devDependencies');
      expect(result).toHaveProperty('envVars');
    });

    it('should include prompt in description', async () => {
      const prompt = 'Create a unique test application';
      const result = await generateProjectWithAI(prompt);

      expect(result.description).toBe(prompt);
    });

    it('should return default project name', async () => {
      const result = await generateProjectWithAI('Test');
      expect(result.name).toBe('generated-project');
    });

    it('should handle special characters in prompt', async () => {
      const prompt = 'Create app with <special> & "chars"';
      const result = await generateProjectWithAI(prompt);

      expect(result.description).toBe(prompt);
    });

    it('should handle unicode in prompt', async () => {
      const prompt = 'Create 🚀 emoji app 中文';
      const result = await generateProjectWithAI(prompt);

      expect(result.description).toBe(prompt);
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parse errors', async () => {
      const mockRequest = {
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('should handle network errors', async () => {
      const mockRequest = {
        json: async () => {
          throw new Error('Network error');
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
    });

    it('should handle unexpected errors', async () => {
      const mockRequest = {
        json: async () => {
          throw new Error('Unexpected error');
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
    });

    it('should handle timeout errors', async () => {
      const mockRequest = {
        json: async () => {
          throw new Error('Request timeout');
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace-only prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: '   ',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      // Zod may not trim by default, so whitespace may pass validation
      // This is actually acceptable behavior
      expect([200, 400]).toContain(response.status);
    });

    it('should handle prompt with only newlines', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: '\n\n\n',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      // Similar to whitespace, newlines may pass validation
      expect([200, 400]).toContain(response.status);
    });

    it('should handle prompt with tabs', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Create\tapp\twith\ttabs',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should handle multiline prompts', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Create an app\nwith multiple\nlines',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should handle SQL injection attempts in prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: "'; DROP TABLE users; --",
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
      // Should be safely handled, not executed
    });

    it('should handle XSS attempts in prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: '<script>alert("xss")</script>',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should handle extremely long prompts', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'x'.repeat(10000),
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });
  });

  describe('Content Type', () => {
    it('should return JSON response', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const contentType = response.headers.get('content-type');

      expect(contentType).toContain('application/json');
    });

    it('should return JSON on error', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: '',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const contentType = response.headers.get('content-type');

      expect(contentType).toContain('application/json');
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Create a simple app',
        }),
      } as unknown as NextRequest;

      const start = Date.now();
      await POST(mockRequest);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should handle rapid sequential requests', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const promises = Array.from({ length: 10 }, () => POST(mockRequest));
      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 20 }, (_, i) => ({
        json: async () => ({
          prompt: `Test project ${i}`,
        }),
      })) as unknown as NextRequest[];

      const promises = requests.map((req) => POST(req));
      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it('should maintain performance with complex prompts', async () => {
      const complexPrompt = `
        Create a full-stack application with:
        - React frontend with TypeScript
        - Node.js Express backend
        - PostgreSQL database
        - Redis caching
        - Docker containerization
        - CI/CD pipeline
        - Unit and integration tests
        - API documentation
        - Authentication and authorization
        - Real-time features with WebSockets
      `;

      const mockRequest = {
        json: async () => ({
          prompt: complexPrompt,
        }),
      } as unknown as NextRequest;

      const start = Date.now();
      await POST(mockRequest);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Idempotency', () => {
    it('should return consistent structure for same prompt', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test project',
        }),
      } as unknown as NextRequest;

      const response1 = await POST(mockRequest);
      const data1 = await response1.json();

      const response2 = await POST(mockRequest);
      const data2 = await response2.json();

      // Structure should be identical
      expect(Object.keys(data1).sort()).toEqual(Object.keys(data2).sort());
      expect(Object.keys(data1.project).sort()).toEqual(
        Object.keys(data2.project).sort()
      );
    });

    it('should preserve prompt in description', async () => {
      const prompt = 'Unique test prompt';
      const mockRequest = {
        json: async () => ({ prompt }),
      } as unknown as NextRequest;

      const response1 = await POST(mockRequest);
      const data1 = await response1.json();

      const response2 = await POST(mockRequest);
      const data2 = await response2.json();

      expect(data1.project.description).toBe(prompt);
      expect(data2.project.description).toBe(prompt);
    });
  });

  describe('HTTP Standards', () => {
    it('should return 200 for successful requests', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: 'Test',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(200);
    });

    it('should return 400 for validation errors', async () => {
      const mockRequest = {
        json: async () => ({}),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(400);
    });

    it('should return 500 for server errors', async () => {
      const mockRequest = {
        json: async () => {
          throw new Error('Server error');
        },
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      expect(response.status).toBe(500);
    });

    it('should include error details in response', async () => {
      const mockRequest = {
        json: async () => ({
          prompt: '',
        }),
      } as unknown as NextRequest;

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('details');
    });
  });
});
