/**
 * Unit tests for Workspace Provisioning Service Mock
 * Tests extracted stub logic behavior for reliable mocking
 */

import { MockWorkspaceProvisioningService } from '../../__mocks__/workspace-provisioning'
import type { WorkspaceRequest, WorkspaceStatus } from '../../__mocks__/workspace-provisioning'

describe('MockWorkspaceProvisioningService', () => {
  let service: MockWorkspaceProvisioningService

  beforeEach(() => {
    service = new MockWorkspaceProvisioningService()
  })

  afterEach(() => {
    service.clearAll()
  })

  describe('createWorkspace', () => {
    it('should create a workspace with valid request', async () => {
      const request: WorkspaceRequest = {
        projectId: 'test-project-123',
        projectName: 'Test Project',
        framework: 'react',
        userId: 'user-456',
        files: {
          'index.ts': 'console.log("Hello World")',
          'package.json': '{"name": "test-project"}'
        },
        dependencies: ['react', 'typescript'],
        environment: { NODE_ENV: 'development' }
      }

      const workspace = await service.createWorkspace(request)

      expect(workspace).toBeDefined()
      expect(workspace.id).toMatch(/^ws-test-project-123-\d+$/)
      expect(workspace.status).toBe('ready')
      expect(workspace.url).toMatch(/\.workspaces\.vibecode\.test$/)
      expect(workspace.endpoints.ide).toBeDefined()
      expect(workspace.endpoints.preview).toBeDefined()
      expect(workspace.endpoints.terminal).toBeDefined()
      expect(workspace.resources.namespace).toBe('vibecode-workspaces-test')
      expect(workspace.createdAt).toBeInstanceOf(Date)
      expect(workspace.updatedAt).toBeInstanceOf(Date)
      expect(workspace.expiresAt).toBeInstanceOf(Date)
    })

    it('should generate unique workspace IDs', async () => {
      const request: WorkspaceRequest = {
        projectId: 'project-1',
        projectName: 'Project 1',
        framework: 'nodejs',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      }

      const workspace1 = await service.createWorkspace(request)
      const workspace2 = await service.createWorkspace(request)

      expect(workspace1.id).not.toBe(workspace2.id)
    })

    it('should validate workspace request schema', async () => {
      const invalidRequest = {
        projectId: '', // Invalid empty string
        projectName: 'Test',
        framework: 'react',
        userId: 'user-1'
        // Missing required fields
      } as any

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow()
    })
  })

  describe('getWorkspaceStatus', () => {
    it('should return status for existing workspace', async () => {
      const request: WorkspaceRequest = {
        projectId: 'test-project',
        projectName: 'Test Project',
        framework: 'nodejs',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      }

      const created = await service.createWorkspace(request)
      const status = await service.getWorkspaceStatus(created.id)

      expect(status).toBeDefined()
      expect(status!.id).toBe(created.id)
      expect(status!.status).toBe('ready')
    })

    it('should return mock status for unknown workspace', async () => {
      const status = await service.getWorkspaceStatus('unknown-workspace-id')

      expect(status).toBeDefined()
      expect(status!.id).toBe('unknown-workspace-id')
      expect(status!.status).toBe('ready')
      expect(status!.url).toMatch(/\.workspaces\.vibecode\.test$/)
    })
  })

  describe('deleteWorkspace', () => {
    it('should delete existing workspace', async () => {
      const request: WorkspaceRequest = {
        projectId: 'test-project',
        projectName: 'Test Project',
        framework: 'nodejs',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      }

      const created = await service.createWorkspace(request)
      await service.deleteWorkspace(created.id)

      const workspaces = await service.listWorkspaces()
      expect(workspaces).not.toContain(expect.objectContaining({ id: created.id }))
    })

    it('should handle deletion of non-existent workspace', async () => {
      await expect(service.deleteWorkspace('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('listWorkspaces', () => {
    it('should return empty array when no workspaces exist', async () => {
      const workspaces = await service.listWorkspaces()
      expect(workspaces).toEqual([])
    })

    it('should return all created workspaces', async () => {
      const request1: WorkspaceRequest = {
        projectId: 'project-1',
        projectName: 'Project 1',
        framework: 'react',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      }

      const request2: WorkspaceRequest = {
        projectId: 'project-2',
        projectName: 'Project 2',
        framework: 'nodejs',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      }

      const workspace1 = await service.createWorkspace(request1)
      const workspace2 = await service.createWorkspace(request2)

      const workspaces = await service.listWorkspaces()
      expect(workspaces).toHaveLength(2)
      expect(workspaces).toContainEqual(workspace1)
      expect(workspaces).toContainEqual(workspace2)
    })
  })

  describe('test helpers', () => {
    it('should clear all mock data', async () => {
      const request: WorkspaceRequest = {
        projectId: 'test-project',
        projectName: 'Test Project',
        framework: 'nodejs',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      }

      await service.createWorkspace(request)
      expect(await service.listWorkspaces()).toHaveLength(1)

      service.clearAll()
      expect(await service.listWorkspaces()).toHaveLength(0)
    })

    it('should allow setting custom workspace status', async () => {
      const customStatus: WorkspaceStatus = {
        id: 'custom-workspace',
        status: 'error',
        url: 'https://custom.test',
        endpoints: {},
        resources: {
          namespace: 'test',
          deployment: 'test-deployment',
          service: 'test-service'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      service.setWorkspaceStatus('custom-workspace', customStatus)
      const retrieved = await service.getWorkspaceStatus('custom-workspace')

      expect(retrieved).toEqual(customStatus)
    })
  })
})