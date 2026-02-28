/**
 * @jest-environment node
 */

/**
 * Unit tests for Vector Store API Route
 * Tests vector search, storage, and deletion operations
 */

import { NextRequest } from 'next/server';
import { GET, POST, PUT, DELETE, OPTIONS } from '@/app/api/vector-store/route';

// Mock dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

// Mock enhanced vector store - must be defined inside jest.mock due to hoisting
jest.mock('@/lib/vector-stores/enhanced-vector-store', () => ({
  enhancedVectorStore: {
    healthCheck: jest.fn(),
    search: jest.fn(),
    storeDocuments: jest.fn(),
    deleteDocuments: jest.fn()
  }
}));

// Get reference to the mocked vector store for test assertions
const mockVectorStore = require('@/lib/vector-stores/enhanced-vector-store').enhancedVectorStore;

// Helper function to create a mock NextRequest
function createMockRequest(url: string, method: string, body?: any): NextRequest {
  const options: any = {
    method,
    headers: {
      'content-type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return new NextRequest(url, options);
}

describe('/api/vector-store', () => {
  const mockSession = {
    user: {
      id: 'user-123',
      email: 'test@example.com'
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValue(mockSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/vector-store', () => {
    it('should return API information', async () => {
      const request = createMockRequest('http://localhost:3000/api/vector-store', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.message).toBe('Enhanced Vector Store API');
      expect(data.endpoints).toBeDefined();
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(data.error.message).toContain('Authentication required');
    });

    it('should handle health check action', async () => {
      mockVectorStore.healthCheck.mockResolvedValue({
        status: 'healthy',
        providers: [
          { id: 'pgvector', available: true, features: { semanticSearch: true } }
        ]
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store?action=health', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    it('should handle providers action', async () => {
      mockVectorStore.healthCheck.mockResolvedValue({
        providers: [
          { id: 'pgvector', available: true, features: { semanticSearch: true } },
          { id: 'weaviate', available: false, features: { semanticSearch: true } }
        ]
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store?action=providers', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.providers).toBeDefined();
      expect(data.data.recommendedProvider).toBe('pgvector');
    });

    it('should handle errors gracefully', async () => {
      mockVectorStore.healthCheck.mockRejectedValue(new Error('Health check failed'));

      const request = createMockRequest('http://localhost:3000/api/vector-store?action=health', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Health check failed');
    });

    it('should set request ID header', async () => {
      const request = createMockRequest('http://localhost:3000/api/vector-store', 'GET');
      const response = await GET(request);

      expect(response.headers.get('x-request-id')).toBeDefined();
    });

    it('should include timestamp in responses', async () => {
      mockVectorStore.healthCheck.mockResolvedValue({
        status: 'healthy',
        providers: []
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store?action=health', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');
    });
  });

  describe('POST /api/vector-store - Search', () => {
    const validSearchRequest = {
      query: 'test query',
      workspaceId: 1,
      limit: 10,
      threshold: 0.7
    };

    it('should search documents successfully', async () => {
      const mockResults = [
        {
          content: 'matching document',
          score: 0.95,
          metadata: { provider: 'pgvector' }
        }
      ];

      mockVectorStore.search.mockResolvedValue(mockResults);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', validSearchRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.results).toEqual(mockResults);
      expect(data.data.query).toBe('test query');
      expect(data.data.provider).toBe('pgvector');
    });

    it('should support provider parameter', async () => {
      const mockResults = [
        {
          content: 'matching document',
          score: 0.95,
          metadata: { provider: 'weaviate' }
        }
      ];

      mockVectorStore.search.mockResolvedValue(mockResults);

      const requestWithProvider = {
        ...validSearchRequest,
        provider: 'weaviate' as const
      };

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', requestWithProvider);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });

    it('should support searchType parameter', async () => {
      mockVectorStore.search.mockResolvedValue([]);

      const requestWithSearchType = {
        ...validSearchRequest,
        searchType: 'hybrid' as const
      };

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', requestWithSearchType);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });

    it('should support generativePrompt parameter', async () => {
      mockVectorStore.search.mockResolvedValue([]);

      const requestWithGenerative = {
        ...validSearchRequest,
        searchType: 'generative' as const,
        generativePrompt: 'Explain this code'
      };

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', requestWithGenerative);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });

    it('should handle fileIds filter', async () => {
      mockVectorStore.search.mockResolvedValue([]);

      const requestWithFileIds = {
        query: 'test query',
        fileIds: [1, 2, 3],
        limit: 10,
        threshold: 0.7
      };

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', requestWithFileIds);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });

    it('should set request ID header', async () => {
      mockVectorStore.search.mockResolvedValue([]);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', validSearchRequest);
      const response = await POST(request);

      expect(response.headers.get('x-request-id')).toBeDefined();
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', validSearchRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(data.error.message).toContain('Authentication required');
    });

    it('should validate search parameters', async () => {
      const invalidRequest = {
        query: '', // Invalid: empty query
        limit: 10
      };

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', invalidRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VECTOR_STORE_INVALID_REQUEST');
    });

    it('should include performance metrics', async () => {
      mockVectorStore.search.mockResolvedValue([]);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', validSearchRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.performance).toBeDefined();
      expect(data.data.performance.queryTime).toBeDefined();
      expect(data.data.performance.resultCount).toBe(0);
    });

    it('should handle search errors', async () => {
      mockVectorStore.search.mockRejectedValue(new Error('Search failed'));

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', validSearchRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Search failed');
    });
  });

  describe('PUT /api/vector-store - Store', () => {
    const validStoreRequest = {
      workspaceId: 1,
      documents: [
        {
          content: 'test content',
          fileName: 'test.js',
          filePath: '/test.js',
          language: 'javascript',
          fileId: 1,
          tokens: 100
        }
      ]
    };

    it('should store documents successfully', async () => {
      mockVectorStore.storeDocuments.mockResolvedValue({
        stored: 1,
        failed: 0,
        providerResults: { pgvector: { stored: 1, failed: 0, duration: 10 } }
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', validStoreRequest);
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.stored).toBe(1);
      expect(data.message).toContain('Stored 1 documents');
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', validStoreRequest);
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(data.error.message).toContain('Authentication required');
    });

    it('should validate store parameters', async () => {
      const invalidRequest = {
        workspaceId: 'not-a-number', // Invalid: should be number
      };

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', invalidRequest);
      const response = await PUT(request);

      // Schema validation will catch this
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should include performance metrics', async () => {
      mockVectorStore.storeDocuments.mockResolvedValue({
        totalStored: 1,
        providers: ['pgvector']
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', validStoreRequest);
      const response = await PUT(request);
      const data = await response.json();

      expect(data.data.performance).toBeDefined();
      expect(data.data.performance.storeTime).toBeDefined();
      expect(data.data.performance.documentsProcessed).toBe(1);
    });

    it('should handle storage errors', async () => {
      mockVectorStore.storeDocuments.mockRejectedValue(new Error('Storage failed'));

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', validStoreRequest);
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Storage failed');
    });

    it('should set request ID header', async () => {
      mockVectorStore.storeDocuments.mockResolvedValue({
        stored: 1,
        failed: 0,
        providerResults: {}
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', validStoreRequest);
      const response = await PUT(request);

      expect(response.headers.get('x-request-id')).toBeDefined();
    });

    it('should include timestamp in responses', async () => {
      mockVectorStore.storeDocuments.mockResolvedValue({
        stored: 1,
        failed: 0,
        providerResults: {}
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', validStoreRequest);
      const response = await PUT(request);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');
    });

    it('should handle documents with optional fields', async () => {
      mockVectorStore.storeDocuments.mockResolvedValue({
        stored: 1,
        failed: 0,
        providerResults: {}
      });

      const requestWithOptionalFields = {
        workspaceId: 1,
        documents: [
          {
            content: 'test content',
            fileName: 'test.js',
            filePath: '/test.js',
            language: 'javascript',
            fileId: 1,
            tokens: 100,
            startLine: 1,
            endLine: 10
          }
        ]
      };

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', requestWithOptionalFields);
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });
  });

  describe('DELETE /api/vector-store', () => {
    const validDeleteRequest = {
      workspaceId: 1
    };

    it('should delete documents successfully', async () => {
      mockVectorStore.deleteDocuments.mockResolvedValue({
        totalDeleted: 5,
        providers: ['pgvector']
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', validDeleteRequest);
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.totalDeleted).toBe(5);
      expect(data.message).toContain('Deleted 5 documents');
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', validDeleteRequest);
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error.code).toBe('UNAUTHORIZED');
      expect(data.error.message).toContain('Authentication required');
    });

    it('should validate delete parameters', async () => {
      const invalidRequest = {}; // Invalid: missing required parameters

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', invalidRequest);
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should accept fileIds for deletion', async () => {
      mockVectorStore.deleteDocuments.mockResolvedValue({
        totalDeleted: 2,
        providers: ['pgvector']
      });

      const deleteByFileIds = {
        fileIds: [1, 2]
      };

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', deleteByFileIds);
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.totalDeleted).toBe(2);
    });

    it('should handle deletion errors', async () => {
      mockVectorStore.deleteDocuments.mockRejectedValue(new Error('Deletion failed'));

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', validDeleteRequest);
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Deletion failed');
    });

    it('should set request ID header', async () => {
      mockVectorStore.deleteDocuments.mockResolvedValue({
        totalDeleted: 5,
        providers: ['pgvector']
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', validDeleteRequest);
      const response = await DELETE(request);

      expect(response.headers.get('x-request-id')).toBeDefined();
    });

    it('should include timestamp in responses', async () => {
      mockVectorStore.deleteDocuments.mockResolvedValue({
        totalDeleted: 5,
        providers: ['pgvector']
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', validDeleteRequest);
      const response = await DELETE(request);
      const data = await response.json();

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');
    });

    it('should handle zero deletions gracefully', async () => {
      mockVectorStore.deleteDocuments.mockResolvedValue({
        totalDeleted: 0,
        providers: ['pgvector']
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', validDeleteRequest);
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.totalDeleted).toBe(0);
      expect(data.message).toContain('Deleted 0 documents');
    });
  });

  describe('OPTIONS /api/vector-store', () => {
    it('should handle CORS preflight', async () => {
      const request = createMockRequest('http://localhost:3000/api/vector-store', 'OPTIONS');
      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
    });

    it('should set CORS headers', async () => {
      const request = createMockRequest('http://localhost:3000/api/vector-store', 'OPTIONS');
      const response = await OPTIONS(request);

      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should set max age header', async () => {
      const request = createMockRequest('http://localhost:3000/api/vector-store', 'OPTIONS');
      const response = await OPTIONS(request);

      expect(response.headers.get('Access-Control-Max-Age')).toBe('3600');
    });

    it('should allow localhost origin', async () => {
      const options: any = {
        method: 'OPTIONS',
        headers: {
          'origin': 'http://localhost:3000',
          'content-type': 'application/json',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/vector-store', options);
      const response = await OPTIONS(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Vary')).toBe('Origin');
    });

    it('should allow production origin', async () => {
      const options: any = {
        method: 'OPTIONS',
        headers: {
          'origin': 'https://vibecode.dev',
          'content-type': 'application/json',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/vector-store', options);
      const response = await OPTIONS(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://vibecode.dev');
      expect(response.headers.get('Vary')).toBe('Origin');
    });

    it('should reject unauthorized origins', async () => {
      const options: any = {
        method: 'OPTIONS',
        headers: {
          'origin': 'https://malicious-site.com',
          'content-type': 'application/json',
        },
      };

      const request = new NextRequest('http://localhost:3000/api/vector-store', options);
      const response = await OPTIONS(request);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should handle missing origin header', async () => {
      const request = createMockRequest('http://localhost:3000/api/vector-store', 'OPTIONS');
      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });
});
