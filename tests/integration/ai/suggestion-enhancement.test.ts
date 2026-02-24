/**
 * Integration tests for suggestion enhancement in AI chat endpoint
 *
 * Tests the integration of SuggestionEnhancer with the chat API:
 * - Context enhancement for code-related queries
 * - Enhanced context inclusion in responses
 * - Statistics and metadata reporting
 * - Error handling and graceful degradation
 */

// Mock all dependencies BEFORE imports
jest.mock('@/lib/auth/middleware', () => ({
  withAIAuth: (handler: any) => handler,
  AuthenticatedRequest: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@/lib/cache/unified-cache-client', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  },
  CacheTTL: {
    HOUR: 3600,
    MINUTE: 60,
  },
}));

jest.mock('@/lib/utils/api-response', () => ({
  createErrorResponseFromError: jest.fn((error, status, message, requestId) => {
    const headers = new Map<string, string>();
    return {
      json: async () => ({
        error: message,
        details: error.message,
        requestId,
      }),
      status,
      headers: {
        set: (key: string, value: string) => headers.set(key, value),
        get: (key: string) => headers.get(key),
      },
    };
  }),
}));

// Mock AI SDK
jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn().mockReturnValue('mock-model'),
}));

jest.mock('ai', () => ({
  streamText: jest.fn().mockResolvedValue({
    textStream: {
      async *[Symbol.asyncIterator]() {
        yield 'Mock';
        yield ' ';
        yield 'response';
      },
    },
  }),
}));

jest.mock('@/lib/tools', () => ({
  tools: {},
}));

// Mock SuggestionEnhancer
const mockEnhance = jest.fn();
const mockClearAllCaches = jest.fn();

jest.mock('@/lib/ai/suggestion-enhancer', () => ({
  getDefaultEnhancer: jest.fn(() => ({
    enhance: mockEnhance,
    clearAllCaches: mockClearAllCaches,
  })),
  resetDefaultEnhancer: jest.fn(),
}));

import { NextRequest } from 'next/server';

// Set environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENROUTER_API_KEY = 'test-or-key';

describe('Integration: Suggestion Enhancement in AI Chat', () => {
  let POST: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEnhance.mockReset();
    mockClearAllCaches.mockReset();

    // Dynamic import to ensure mocks are applied
    const routeModule = await import('@/app/api/ai/chat/route');
    POST = routeModule.POST;
  });

  describe('Context Enhancement - Code-Related Queries', () => {
    it('should enhance context for code-related queries with code blocks', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'const foo = "bar";',
        contextSources: [
          {
            content: 'import { useState } from "react";',
            metadata: {
              type: 'import',
              title: 'React Import',
              relevance: 0.9,
            },
          },
          {
            content: 'interface User { name: string; email: string; }',
            metadata: {
              type: 'type',
              title: 'User Interface',
              relevance: 0.8,
            },
          },
        ],
        formattedContext: '## Relevant Context\n\n### Imports\n```typescript\nimport { useState } from "react";\n```',
        totalTokens: 150,
        relevanceScore: 0.85,
        stats: {
          importsIncluded: 1,
          typesIncluded: 1,
          functionsIncluded: 0,
          relatedCodeIncluded: 0,
          conventionsIncluded: 0,
          tokenUtilization: 75,
          optimizationStrategy: 'BALANCED',
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 1850,
          warnings: [],
        },
      };

      mockEnhance.mockResolvedValueOnce(mockEnhancedSuggestion);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'How do I create a React component?' },
            { role: 'assistant', content: 'You can create a component like this:' },
            { role: 'user', content: '```typescript\nconst foo = "bar";\n```\nHow do I improve this?' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockEnhance).toHaveBeenCalled();

      // Verify enhance was called with correct parameters
      const enhanceCall = mockEnhance.mock.calls[0][0];
      expect(enhanceCall).toHaveProperty('sourceCode');
      expect(enhanceCall).toHaveProperty('intent');
      expect(enhanceCall.workspaceId).toBe('test-user-id');
      expect(enhanceCall.contextOptions).toBeDefined();
      expect(enhanceCall.optimizationOptions).toBeDefined();

      // Verify response includes context enhancement metadata
      expect(data).toHaveProperty('context_enhancement');
      expect(data.context_enhancement).toEqual({
        enabled: true,
        totalTokens: 150,
        relevanceScore: 0.85,
        stats: mockEnhancedSuggestion.stats,
      });
    });

    it('should enhance context for queries containing code keywords', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'How do I write a function to validate email?',
        contextSources: [
          {
            content: 'function validateEmail(email: string): boolean { /* ... */ }',
            metadata: {
              type: 'function',
              title: 'Email Validation Function',
              relevance: 0.95,
            },
          },
        ],
        formattedContext: '## Relevant Context\n\n### Functions\n```typescript\nfunction validateEmail(email: string): boolean\n```',
        totalTokens: 80,
        relevanceScore: 0.92,
        stats: {
          importsIncluded: 0,
          typesIncluded: 0,
          functionsIncluded: 1,
          relatedCodeIncluded: 0,
          conventionsIncluded: 0,
          tokenUtilization: 40,
          optimizationStrategy: 'BALANCED',
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 1920,
          warnings: [],
        },
      };

      mockEnhance.mockResolvedValueOnce(mockEnhancedSuggestion);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'How do I write a function to validate email addresses?' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockEnhance).toHaveBeenCalled();
      expect(data).toHaveProperty('context_enhancement');
      expect(data.context_enhancement.stats.functionsIncluded).toBe(1);
    });

    it('should include enhanced context in system prompt', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'const component = () => {}',
        contextSources: [
          {
            content: 'import React from "react";',
            metadata: {
              type: 'import',
              title: 'React Import',
              relevance: 0.9,
            },
          },
        ],
        formattedContext: '## Relevant Context\n\n### Imports\n```typescript\nimport React from "react";\n```\n\nUse this context for better suggestions.',
        totalTokens: 100,
        relevanceScore: 0.88,
        stats: {
          importsIncluded: 1,
          typesIncluded: 0,
          functionsIncluded: 0,
          relatedCodeIncluded: 0,
          conventionsIncluded: 0,
          tokenUtilization: 50,
          optimizationStrategy: 'BALANCED',
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 1900,
          warnings: [],
        },
      };

      mockEnhance.mockResolvedValueOnce(mockEnhancedSuggestion);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: '```typescript\nconst component = () => {}\n```' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockEnhance).toHaveBeenCalled();
      expect(data.context_enhancement).toBeDefined();
      expect(data.context_enhancement.totalTokens).toBe(100);
    });
  });

  describe('Context Enhancement - Non-Code Queries', () => {
    it('should not enhance context for non-code-related queries', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'What is the weather today?' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockEnhance).not.toHaveBeenCalled();
      expect(data.context_enhancement).toBeUndefined();
    });

    it('should not enhance context for general conversation', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, how are you?' },
            { role: 'assistant', content: 'I am doing well, thank you!' },
            { role: 'user', content: 'That is great to hear.' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockEnhance).not.toHaveBeenCalled();
      expect(data.context_enhancement).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle enhancement errors gracefully', async () => {
      mockEnhance.mockRejectedValueOnce(new Error('Enhancement service unavailable'));

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: '```typescript\nconst test = 123;\n```\nExplain this code' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      // Should still return successful response without enhancement
      expect(response.status).toBe(200);
      expect(mockEnhance).toHaveBeenCalled();
      expect(data.context_enhancement).toBeUndefined();

      // Verify logger was called to log the warning
      const { logger } = await import('@/lib/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        'Context enhancement failed, continuing without enhancement',
        expect.objectContaining({
          error: 'Enhancement service unavailable',
        })
      );
    });

    it('should continue without enhancement when enhancer returns empty context', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'const x = 1;',
        contextSources: [],
        formattedContext: '',
        totalTokens: 0,
        relevanceScore: 0,
        stats: {
          importsIncluded: 0,
          typesIncluded: 0,
          functionsIncluded: 0,
          relatedCodeIncluded: 0,
          conventionsIncluded: 0,
          tokenUtilization: 0,
          optimizationStrategy: 'none',
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 2000,
          warnings: ['No relevant context found'],
        },
      };

      mockEnhance.mockResolvedValueOnce(mockEnhancedSuggestion);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: '```typescript\nconst x = 1;\n```' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockEnhance).toHaveBeenCalled();
      // Should still include context enhancement stats even when formattedContext is empty
      // This allows clients to see that enhancement was attempted but found nothing
      expect(data.context_enhancement).toBeDefined();
      expect(data.context_enhancement.totalTokens).toBe(0);
      expect(data.context_enhancement.stats.optimizationStrategy).toBe('none');
    });
  });

  describe('Enhancement Statistics', () => {
    it('should report comprehensive enhancement statistics', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'function authenticate(user: User) {}',
        contextSources: [
          {
            content: 'import { User } from "./types";',
            metadata: { type: 'import', title: 'User Import', relevance: 0.95 },
          },
          {
            content: 'interface User { id: string; name: string; }',
            metadata: { type: 'type', title: 'User Type', relevance: 0.92 },
          },
          {
            content: 'function validateUser(user: User): boolean {}',
            metadata: { type: 'function', title: 'Validation Function', relevance: 0.88 },
          },
          {
            content: 'class AuthService { /* ... */ }',
            metadata: { type: 'related_code', title: 'Auth Service', relevance: 0.85 },
          },
          {
            content: 'Functions use camelCase naming',
            metadata: { type: 'convention', title: 'Naming Convention', relevance: 0.70 },
          },
        ],
        formattedContext: '## Relevant Context\n\n### Comprehensive context',
        totalTokens: 450,
        relevanceScore: 0.86,
        stats: {
          importsIncluded: 1,
          typesIncluded: 1,
          functionsIncluded: 1,
          relatedCodeIncluded: 1,
          conventionsIncluded: 1,
          tokenUtilization: 90,
          optimizationStrategy: 'BALANCED',
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 1550,
          warnings: [],
        },
      };

      mockEnhance.mockResolvedValueOnce(mockEnhancedSuggestion);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: '```typescript\nfunction authenticate(user: User) {}\n```' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.context_enhancement).toBeDefined();
      expect(data.context_enhancement.stats).toEqual({
        importsIncluded: 1,
        typesIncluded: 1,
        functionsIncluded: 1,
        relatedCodeIncluded: 1,
        conventionsIncluded: 1,
        tokenUtilization: 90,
        optimizationStrategy: 'BALANCED',
      });
      expect(data.context_enhancement.totalTokens).toBe(450);
      expect(data.context_enhancement.relevanceScore).toBe(0.86);
    });

    it('should track token utilization correctly', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'const app = express();',
        contextSources: [
          {
            content: 'import express from "express";',
            metadata: { type: 'import', title: 'Express Import', relevance: 0.9 },
          },
        ],
        formattedContext: '## Relevant Context\n\n### Imports\n```typescript\nimport express from "express";\n```',
        totalTokens: 50,
        relevanceScore: 0.9,
        stats: {
          importsIncluded: 1,
          typesIncluded: 0,
          functionsIncluded: 0,
          relatedCodeIncluded: 0,
          conventionsIncluded: 0,
          tokenUtilization: 25, // 50 / 2000 * 100
          optimizationStrategy: 'BALANCED',
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 1950,
          warnings: [],
        },
      };

      mockEnhance.mockResolvedValueOnce(mockEnhancedSuggestion);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'How do I use Express?' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.context_enhancement.stats.tokenUtilization).toBe(25);
      expect(data.context_enhancement.totalTokens).toBe(50);
    });
  });

  describe('Context Options', () => {
    it('should pass correct context options to enhancer', async () => {
      const mockEnhancedSuggestion = {
        sourceCode: 'test',
        contextSources: [],
        formattedContext: '## Context',
        totalTokens: 10,
        relevanceScore: 0.5,
        stats: {
          importsIncluded: 0,
          typesIncluded: 0,
          functionsIncluded: 0,
          relatedCodeIncluded: 0,
          conventionsIncluded: 0,
          tokenUtilization: 5,
          optimizationStrategy: 'BALANCED',
        },
        optimization: {
          excludedSources: [],
          remainingTokens: 1990,
          warnings: [],
        },
      };

      mockEnhance.mockResolvedValueOnce(mockEnhancedSuggestion);

      const mockRequest = new NextRequest('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            { role: 'user', content: '```typescript\ntest\n```' },
          ],
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        headers: {
          'content-type': 'application/json',
        },
      });

      (mockRequest as any).user = {
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };

      await POST(mockRequest);

      expect(mockEnhance).toHaveBeenCalledWith({
        sourceCode: 'test',
        intent: '```typescript\ntest\n```',
        workspaceId: 'test-user-id',
        contextOptions: {
          includeRelatedCode: true,
          includeConventions: true,
          maxRelatedElements: 5,
          maxConventionExamples: 3,
          minRelevanceScore: 0.3,
        },
        optimizationOptions: {
          tokenBudget: 2000,
          strategy: 'BALANCED',
          minRelevanceScore: 0.2,
        },
      });
    });
  });
});
