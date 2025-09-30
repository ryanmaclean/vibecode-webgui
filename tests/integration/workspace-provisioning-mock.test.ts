/**
 * Integration tests for workspace provisioning with mocks
 * Validates UI behavior without touching real infrastructure
 */

import { NextRequest } from 'next/server'
import { MockWorkspaceProvisioningService } from '../../__mocks__/workspace-provisioning'

// Mock the workspace provisioning service
jest.mock('@/lib/services/workspace-provisioning-simple', () => ({
  WorkspaceProvisioningService: MockWorkspaceProvisioningService
}))

// Import after mocking
const { POST, GET } = require('@/app/api/workspaces/route')

describe('Workspace API Integration with Mocks', () => {
  let mockService: MockWorkspaceProvisioningService

  beforeEach(() => {
    // Reset environment
    delete process.env.KUBECONFIG
    delete process.env.KUBERNETES_SERVICE_HOST
    
    mockService = new MockWorkspaceProvisioningService()
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockService.clearAll()
  })

  describe('POST /api/workspaces', () => {
    it('should create workspace with valid request when Kubernetes is configured', async () => {
      // Setup Kubernetes environment
      process.env.KUBERNETES_SERVICE_HOST = 'kubernetes.default.svc'

      const requestBody = {
        projectId: 'test-project-123',
        projectName: 'Test Integration Project',
        framework: 'react',
        userId: 'integration-user',
        files: {
          'src/App.tsx': 'import React from "react"; export default function App() { return <div>Hello</div>; }',
          'package.json': '{"name": "test-project", "version": "1.0.0"}'
        },
        dependencies: ['react', '@types/react'],
        environment: { NODE_ENV: 'development' }
      }

      const request = {
        json: jest.fn().mockResolvedValue(requestBody)
      } as unknown as NextRequest

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.workspace).toBeDefined()
      expect(responseData.workspace.id).toMatch(/^ws-test-project-123-\d+$/)
      expect(responseData.workspace.status).toBe('ready')
      expect(responseData.workspace.url).toMatch(/\.workspaces\.vibecode\.test$/)
      expect(responseData.success).toBe(true)
      expect(responseData.timing).toBeDefined()
    })

    it('should return 503 when Kubernetes is not configured', async () => {
      // Ensure no Kubernetes configuration
      delete process.env.KUBECONFIG
      delete process.env.KUBERNETES_SERVICE_HOST

      const requestBody = {
        projectId: 'test-project',
        projectName: 'Test Project',
        framework: 'nodejs',
        userId: 'test-user',
        files: {},
        dependencies: [],
        environment: {}
      }

      const request = {
        json: jest.fn().mockResolvedValue(requestBody)
      } as unknown as NextRequest

      const response = await POST(request)
      const responseData = await response.json()

      expect(response.status).toBe(503)
      expect(responseData.error).toBe('Workspace service not available')
      expect(responseData.message).toContain('Kubernetes cluster not configured')
    })

    it('should validate request schema and return 400 for invalid data', async () => {
      process.env.KUBERNETES_SERVICE_HOST = 'kubernetes.default.svc'

      const invalidRequestBody = {
        projectId: '', // Invalid empty string
        projectName: 'Test Project',
        framework: 'react'
        // Missing required fields
      }

      const request = {
        json: jest.fn().mockResolvedValue(invalidRequestBody)
      } as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should handle JSON parsing errors', async () => {
      process.env.KUBERNETES_SERVICE_HOST = 'kubernetes.default.svc'

      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      } as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(400)
    })
  })

  describe('GET /api/workspaces', () => {
    it('should return service availability when Kubernetes is configured', async () => {
      process.env.KUBERNETES_SERVICE_HOST = 'kubernetes.default.svc'

      const request = {} as NextRequest

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(200)
      expect(responseData.available).toBe(true)
      expect(responseData.service).toBe('Workspace Provisioning')
    })

    it('should return unavailable when Kubernetes is not configured', async () => {
      delete process.env.KUBECONFIG
      delete process.env.KUBERNETES_SERVICE_HOST

      const request = {} as NextRequest

      const response = await GET(request)
      const responseData = await response.json()

      expect(response.status).toBe(503)
      expect(responseData.available).toBe(false)
      expect(responseData.reason).toBe('Kubernetes not configured')
    })
  })

  describe('Workspace lifecycle integration', () => {
    beforeEach(() => {
      process.env.KUBERNETES_SERVICE_HOST = 'kubernetes.default.svc'
    })

    it('should handle complete workspace creation to deletion workflow', async () => {
      // Create workspace
      const createRequestBody = {
        projectId: 'lifecycle-test',
        projectName: 'Lifecycle Test Project',
        framework: 'nodejs',
        userId: 'test-user',
        files: { 'index.js': 'console.log("test")' },
        dependencies: ['express'],
        environment: { NODE_ENV: 'test' }
      }

      const createRequest = {
        json: jest.fn().mockResolvedValue(createRequestBody)
      } as unknown as NextRequest

      const createResponse = await POST(createRequest)
      const createData = await createResponse.json()

      expect(createResponse.status).toBe(200)
      expect(createData.workspace).toBeDefined()

      const workspaceId = createData.workspace.id

      // Verify workspace exists in mock storage
      const status = await mockService.getWorkspaceStatus(workspaceId)
      expect(status).toBeDefined()
      expect(status!.id).toBe(workspaceId)

      // Simulate deletion
      await mockService.deleteWorkspace(workspaceId)

      // Verify workspace is removed from listing
      const workspaces = await mockService.listWorkspaces()
      expect(workspaces.find(w => w.id === workspaceId)).toBeUndefined()
    })

    it('should handle multiple concurrent workspace creations', async () => {
      const createWorkspace = async (projectId: string) => {
        const requestBody = {
          projectId,
          projectName: `Project ${projectId}`,
          framework: 'react',
          userId: 'concurrent-user',
          files: {},
          dependencies: [],
          environment: {}
        }

        const request = {
          json: jest.fn().mockResolvedValue(requestBody)
        } as unknown as NextRequest

        return POST(request)
      }

      // Create multiple workspaces concurrently
      const responses = await Promise.all([
        createWorkspace('concurrent-1'),
        createWorkspace('concurrent-2'),
        createWorkspace('concurrent-3')
      ])

      // Verify all succeeded
      for (const response of responses) {
        expect(response.status).toBe(200)
        const data = await response.json()
        expect(data.workspace).toBeDefined()
        expect(data.workspace.status).toBe('ready')
      }

      // Verify all workspaces are stored
      const workspaces = await mockService.listWorkspaces()
      expect(workspaces).toHaveLength(3)

      // Verify unique IDs
      const ids = workspaces.map(w => w.id)
      expect(new Set(ids).size).toBe(3)
    })
  })
})