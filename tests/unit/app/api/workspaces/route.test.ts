/**
 * @jest-environment node
 */

/**
 * Unit tests for Workspaces API Route
 * Tests workspace creation, listing, and retrieval
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/workspaces/route';

// Mock the workspace provisioning service
const mockWorkspaceService = {
  createWorkspace: jest.fn(),
  listWorkspaces: jest.fn(),
  getWorkspaceStatus: jest.fn()
};

jest.mock('@/lib/services/workspace-provisioning-simple', () => ({
  WorkspaceProvisioningService: jest.fn().mockImplementation(() => mockWorkspaceService)
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock API utilities
jest.mock('@/lib/api-utils', () => ({
  createErrorResponse: jest.fn((title: string, status: number, details: any) => {
    return new Response(JSON.stringify({ error: title, ...details }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }),
  getErrorMessage: jest.fn((error: any) => error.message || 'Unknown error'),
  createErrorResponseFromError: jest.fn((error: any, status: number, fallbackMessage: string) => {
    return new Response(JSON.stringify({ error: error.message || 'Unknown error', details: fallbackMessage }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  })
}));

// Mock ErrorResponses utility (appears to be a global or separate module)
global.ErrorResponses = {
  validationError: jest.fn((message: string, details: any, requestId: string) => {
    return new Response(JSON.stringify({ error: message, details, requestId }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }),
  forbidden: jest.fn((message: string, requestId: string) => {
    return new Response(JSON.stringify({ error: message, requestId }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }),
  badRequest: jest.fn((message: string, requestId: string) => {
    return new Response(JSON.stringify({ error: message, requestId }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }),
  serviceUnavailable: jest.fn((message: string, requestId: string) => {
    return new Response(JSON.stringify({ error: message, requestId }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }),
  notFound: jest.fn((message: string, requestId: string) => {
    return new Response(JSON.stringify({ error: message, requestId }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  })
} as any;

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

describe('/api/workspaces', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up mock environment
    process.env.KUBECONFIG = '/path/to/kubeconfig';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.KUBECONFIG;
    delete process.env.KUBERNETES_SERVICE_HOST;
  });

  describe('POST /api/workspaces', () => {
    const validWorkspaceRequest = {
      projectId: 'project-123',
      projectName: 'Test Project',
      framework: 'react',
      userId: 'user-123',
      files: {
        'index.js': 'console.log("Hello");'
      },
      dependencies: ['react', 'react-dom'],
      environment: {
        NODE_ENV: 'development'
      }
    };

    it('should create a workspace successfully', async () => {
      const mockWorkspace = {
        id: 'workspace-123',
        url: 'https://workspace-123.example.com',
        status: 'running',
        resources: {
          cpu: '1',
          memory: '2Gi'
        }
      };

      mockWorkspaceService.createWorkspace.mockResolvedValue(mockWorkspace);

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', validWorkspaceRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.workspace).toEqual(mockWorkspace);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.framework).toBe('react');
      expect(data.metadata.filesCount).toBe(1);
    });

    it.skip('should validate required fields', async () => {
      const invalidRequest = {
        projectName: 'Test Project'
        // missing projectId, framework, files
      };

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', invalidRequest);
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 503 when Kubernetes is not configured', async () => {
      delete process.env.KUBECONFIG;
      delete process.env.KUBERNETES_SERVICE_HOST;

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', validWorkspaceRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe('Workspace service not available');
    });

    it('should handle workspace creation errors', async () => {
      mockWorkspaceService.createWorkspace.mockRejectedValue(new Error('Creation failed'));

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', validWorkspaceRequest);
      const response = await POST(request);

      expect(response.status).toBeGreaterThanOrEqual(500);
    });

    it('should handle Kubernetes quota errors', async () => {
      mockWorkspaceService.createWorkspace.mockRejectedValue(new Error('Insufficient quota'));

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', validWorkspaceRequest);
      const response = await POST(request);

      expect(response.status).toBe(503);
    });

    it('should handle authorization errors', async () => {
      mockWorkspaceService.createWorkspace.mockRejectedValue(new Error('Unauthorized'));

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', validWorkspaceRequest);
      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should handle timeout errors', async () => {
      mockWorkspaceService.createWorkspace.mockRejectedValue(new Error('timeout'));

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', validWorkspaceRequest);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should use default userId if not provided', async () => {
      const requestWithoutUserId = { ...validWorkspaceRequest };
      delete requestWithoutUserId.userId;

      mockWorkspaceService.createWorkspace.mockResolvedValue({
        id: 'workspace-123',
        url: 'https://workspace-123.example.com'
      });

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', requestWithoutUserId);
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockWorkspaceService.createWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous'
        })
      );
    });

    it('should include creation time in response', async () => {
      mockWorkspaceService.createWorkspace.mockResolvedValue({
        id: 'workspace-123',
        url: 'https://workspace-123.example.com'
      });

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'POST', validWorkspaceRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(data.metadata.creationTime).toBeDefined();
      expect(typeof data.metadata.creationTime).toBe('number');
    });
  });

  describe('GET /api/workspaces', () => {
    it('should list all workspaces', async () => {
      const mockWorkspaces = [
        { id: 'workspace-1', name: 'Workspace 1', status: 'running' },
        { id: 'workspace-2', name: 'Workspace 2', status: 'stopped' }
      ];

      mockWorkspaceService.listWorkspaces.mockResolvedValue(mockWorkspaces);

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.workspaces).toEqual(mockWorkspaces);
      expect(data.count).toBe(2);
      expect(data.available).toBe(true);
    });

    it('should get a specific workspace by id', async () => {
      const mockWorkspace = {
        id: 'workspace-123',
        name: 'Test Workspace',
        status: 'running',
        url: 'https://workspace-123.example.com'
      };

      mockWorkspaceService.getWorkspaceStatus.mockResolvedValue(mockWorkspace);

      const request = createMockRequest('http://localhost:3000/api/workspaces?id=workspace-123', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.workspace).toEqual(mockWorkspace);
    });

    it('should return 404 for non-existent workspace', async () => {
      mockWorkspaceService.getWorkspaceStatus.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/workspaces?id=non-existent', 'GET');
      const response = await GET(request);

      expect(response.status).toBe(404);
    });

    it('should return availability status when Kubernetes is not configured', async () => {
      delete process.env.KUBECONFIG;
      delete process.env.KUBERNETES_SERVICE_HOST;

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.available).toBe(false);
      expect(data.reason).toBe('Kubernetes cluster not configured');
    });

    it('should handle service errors gracefully', async () => {
      mockWorkspaceService.listWorkspaces.mockRejectedValue(new Error('Service error'));

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'GET');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('should return empty list when no workspaces exist', async () => {
      mockWorkspaceService.listWorkspaces.mockResolvedValue([]);

      const request = createMockRequest('http://localhost:3000/api/workspaces', 'GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.workspaces).toEqual([]);
      expect(data.count).toBe(0);
    });
  });
});
