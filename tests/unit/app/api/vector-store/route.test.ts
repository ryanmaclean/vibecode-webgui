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
      expect(data.error).toBe('Unauthorized');
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
      expect(data.status).toBe('error');
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

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'POST', validSearchRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
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
      expect(data.status).toBe('error');
      expect(data.message).toBe('Invalid request parameters');
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
      expect(data.status).toBe('error');
      expect(data.message).toBe('Search failed');
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
        totalStored: 1,
        providers: ['pgvector']
      });

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', validStoreRequest);
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.totalStored).toBe(1);
      expect(data.message).toContain('Stored 1 documents');
    });

    it('should require authentication', async () => {
      const { getServerSession } = require('next-auth');
      getServerSession.mockResolvedValueOnce(null);

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'PUT', validStoreRequest);
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should validate store parameters', async () => {
      const invalidRequest = {
        workspaceId: 1,
        documents: [] // Invalid: empty documents array
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
      expect(data.status).toBe('error');
      expect(data.message).toBe('Storage failed');
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
      expect(data.error).toBe('Unauthorized');
    });

    it('should validate delete parameters', async () => {
      const invalidRequest = {}; // Invalid: missing required parameters

      const request = createMockRequest('http://localhost:3000/api/vector-store', 'DELETE', invalidRequest);
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.status).toBe('error');
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
      expect(data.status).toBe('error');
      expect(data.message).toBe('Deletion failed');
    });
  });

  describe('OPTIONS /api/vector-store', () => {
    it('should handle CORS preflight', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
    });

    it('should set CORS headers', async () => {
      const response = await OPTIONS();

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });
  });
});
