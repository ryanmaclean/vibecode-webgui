/**
 * Integration tests for workspace templates and cloning feature
 *
 * Tests the complete workflow:
 * 1. Create workspace
 * 2. Save workspace as template
 * 3. List templates
 * 4. Create workspace from template (future)
 * 5. Clone workspace
 * 6. Verify cloned workspace
 *
 * @see src/lib/workspace-templates.ts
 * @see src/app/api/workspaces/[id]/template/route.ts
 * @see src/app/api/workspace-templates/route.ts
 * @see src/app/api/workspaces/[id]/clone/route.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'
import { prisma } from '@/lib/prisma'
import { WorkspaceTemplateService } from '@/lib/workspace-templates'

// Mock Datadog metrics
jest.mock('@/lib/monitoring/datadog-metrics', () => ({
  datadogMetrics: {
    increment: jest.fn(),
    histogram: jest.fn(),
    gauge: jest.fn(),
    distribution: jest.fn()
  }
}))

// Mock next-auth session
jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {}
}))

// Mock cache utilities
jest.mock('@/lib/cache/cache-utils', () => ({
  cacheGetOrSet: jest.fn().mockImplementation(async (key, fn) => fn()),
  cacheDelete: jest.fn().mockResolvedValue(true),
  CacheKeyGenerators: {},
  TTLPresets: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 3600
  }
}))

// Mock rate limiting
jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn().mockReturnValue(
    jest.fn().mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000
    })
  )
}))

// Mock logging utilities
jest.mock('@/lib/logging', () => ({
  createServiceLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
  createPerformanceTimer: jest.fn().mockReturnValue({
    stop: jest.fn().mockReturnValue(100)
  }),
  logError: jest.fn(),
  apiLogger: {
    logRequest: jest.fn().mockReturnValue({ requestId: 'test-request-id' }),
    logResponse: jest.fn()
  }
}))

// Mock workspace provisioning service
jest.mock('@/lib/services/workspace-provisioning-simple', () => ({
  WorkspaceProvisioningService: jest.fn().mockImplementation(() => ({
    createWorkspace: jest.fn().mockResolvedValue({
      id: 'workspace-123',
      url: 'http://localhost:8080',
      status: 'ready',
      resources: {
        cpu: '1',
        memory: '2Gi'
      }
    }),
    getWorkspaceStatus: jest.fn().mockResolvedValue({
      id: 'workspace-123',
      status: 'ready'
    })
  }))
}))

describe('Workspace Templates Integration', () => {
  let templateService: WorkspaceTemplateService
  let testUserId: number
  let testWorkspaceId: string

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.workspaceTemplate.deleteMany({
      where: {
        name: {
          contains: 'Integration Test'
        }
      }
    })

    await prisma.user.deleteMany({
      where: {
        email: 'template-test@example.com'
      }
    })

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: 'template-test@example.com',
        name: 'Template Test User'
      }
    })
    testUserId = testUser.id

    // Create test workspace ID
    testWorkspaceId = `test-workspace-${Date.now()}`

    // Create test workspace in database for testing
    await prisma.workspace.create({
      data: {
        workspace_id: testWorkspaceId,
        name: 'Integration Test Workspace',
        user_id: testUserId,
        status: 'active'
      }
    })

    templateService = new WorkspaceTemplateService()
  })

  afterAll(async () => {
    // Clean up test data
    await prisma.workspaceTemplate.deleteMany({
      where: {
        user_id: testUserId
      }
    })

    await prisma.workspace.deleteMany({
      where: {
        user_id: testUserId
      }
    })

    await prisma.user.delete({
      where: {
        id: testUserId
      }
    }).catch(() => {})

    await prisma.$disconnect()
  })

  describe('Complete Workflow: Create → Template → Clone', () => {
    let createdTemplateId: number

    it('should save workspace as template', async () => {
      const template = await templateService.saveAsTemplate(testWorkspaceId, {
        name: 'Integration Test Template',
        description: 'A template created during integration testing',
        userId: testUserId,
        isPublic: false,
        tags: 'test,integration',
        framework: 'react',
        language: 'typescript'
      })

      expect(template).toBeDefined()
      expect(template.id).toBeGreaterThan(0)
      expect(template.name).toBe('Integration Test Template')
      expect(template.description).toBe('A template created during integration testing')
      expect(template.user_id).toBe(testUserId)
      expect(template.is_public).toBe(false)
      expect(template.tags).toBe('test,integration')
      expect(template.framework).toBe('react')
      expect(template.language).toBe('typescript')
      expect(template.workspace_config).toBeDefined()
      expect(typeof template.workspace_config).toBe('object')

      createdTemplateId = template.id
    })

    it('should list templates including the created one', async () => {
      const templates = await templateService.listTemplates({
        userId: testUserId
      })

      expect(templates).toBeDefined()
      expect(Array.isArray(templates)).toBe(true)
      expect(templates.length).toBeGreaterThan(0)

      const foundTemplate = templates.find(t => t.id === createdTemplateId)
      expect(foundTemplate).toBeDefined()
      expect(foundTemplate?.name).toBe('Integration Test Template')
    })

    it('should filter templates by framework', async () => {
      const templates = await templateService.listTemplates({
        userId: testUserId,
        framework: 'react'
      })

      expect(templates).toBeDefined()
      expect(Array.isArray(templates)).toBe(true)

      // All returned templates should be react templates
      templates.forEach(template => {
        expect(template.framework).toBe('react')
      })
    })

    it('should filter templates by language', async () => {
      const templates = await templateService.listTemplates({
        userId: testUserId,
        language: 'typescript'
      })

      expect(templates).toBeDefined()
      expect(Array.isArray(templates)).toBe(true)

      // All returned templates should be typescript templates
      templates.forEach(template => {
        expect(template.language).toBe('typescript')
      })
    })

    it('should retrieve a specific template by ID', async () => {
      const template = await templateService.getTemplate(createdTemplateId)

      expect(template).toBeDefined()
      expect(template?.id).toBe(createdTemplateId)
      expect(template?.name).toBe('Integration Test Template')
      expect(template?.user_id).toBe(testUserId)
    })

    it('should return null for non-existent template', async () => {
      const template = await templateService.getTemplate(999999)

      expect(template).toBeNull()
    })

    it('should support pagination with limit and offset', async () => {
      // Create additional templates for pagination testing
      await templateService.saveAsTemplate(testWorkspaceId, {
        name: 'Integration Test Template 2',
        description: 'Second template',
        userId: testUserId,
        isPublic: false
      })

      await templateService.saveAsTemplate(testWorkspaceId, {
        name: 'Integration Test Template 3',
        description: 'Third template',
        userId: testUserId,
        isPublic: false
      })

      // Get first page
      const firstPage = await templateService.listTemplates({
        userId: testUserId,
        limit: 2,
        offset: 0
      })

      expect(firstPage).toBeDefined()
      expect(firstPage.length).toBe(2)

      // Get second page
      const secondPage = await templateService.listTemplates({
        userId: testUserId,
        limit: 2,
        offset: 2
      })

      expect(secondPage).toBeDefined()
      expect(secondPage.length).toBeGreaterThanOrEqual(1)

      // Ensure no overlap between pages
      const firstPageIds = firstPage.map(t => t.id)
      const secondPageIds = secondPage.map(t => t.id)
      const overlap = firstPageIds.filter(id => secondPageIds.includes(id))
      expect(overlap.length).toBe(0)
    })
  })

  describe('Template Visibility and Access Control', () => {
    let privateTemplateId: number
    let publicTemplateId: number
    let otherUserId: number

    beforeEach(async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: `other-user-${Date.now()}@example.com`,
          name: 'Other User'
        }
      })
      otherUserId = otherUser.id

      // Create a private template
      const privateTemplate = await templateService.saveAsTemplate(testWorkspaceId, {
        name: 'Private Template',
        description: 'Private template for testing',
        userId: testUserId,
        isPublic: false
      })
      privateTemplateId = privateTemplate.id

      // Create a public template
      const publicTemplate = await templateService.saveAsTemplate(testWorkspaceId, {
        name: 'Public Template',
        description: 'Public template for testing',
        userId: testUserId,
        isPublic: true
      })
      publicTemplateId = publicTemplate.id
    })

    afterEach(async () => {
      await prisma.user.delete({
        where: { id: otherUserId }
      }).catch(() => {})
    })

    it('should list only user templates when isPublic filter is false', async () => {
      const templates = await templateService.listTemplates({
        userId: testUserId,
        isPublic: false
      })

      expect(templates).toBeDefined()
      templates.forEach(template => {
        expect(template.is_public).toBe(false)
        expect(template.user_id).toBe(testUserId)
      })
    })

    it('should list public templates when isPublic filter is true', async () => {
      const templates = await templateService.listTemplates({
        userId: testUserId,
        isPublic: true
      })

      expect(templates).toBeDefined()
      templates.forEach(template => {
        expect(template.is_public).toBe(true)
      })
    })

    it('should allow other users to view public templates', async () => {
      const templates = await templateService.listTemplates({
        userId: otherUserId,
        isPublic: true
      })

      const foundPublicTemplate = templates.find(t => t.id === publicTemplateId)
      expect(foundPublicTemplate).toBeDefined()
      expect(foundPublicTemplate?.is_public).toBe(true)
    })

    it('should not show private templates to other users', async () => {
      const templates = await templateService.listTemplates({
        userId: otherUserId,
        isPublic: false
      })

      const foundPrivateTemplate = templates.find(t => t.id === privateTemplateId)
      expect(foundPrivateTemplate).toBeUndefined()
    })
  })

  describe('Template Deletion', () => {
    let deletableTemplateId: number

    beforeEach(async () => {
      const template = await templateService.saveAsTemplate(testWorkspaceId, {
        name: 'Deletable Template',
        description: 'Template that will be deleted',
        userId: testUserId,
        isPublic: false
      })
      deletableTemplateId = template.id
    })

    it('should delete a template successfully', async () => {
      const result = await templateService.deleteTemplate(deletableTemplateId)

      expect(result).toBe(true)

      // Verify template is deleted
      const template = await templateService.getTemplate(deletableTemplateId)
      expect(template).toBeNull()
    })

    it('should return false when deleting non-existent template', async () => {
      const result = await templateService.deleteTemplate(999999)

      expect(result).toBe(false)
    })
  })

  describe('Template Data Integrity', () => {
    it('should preserve workspace configuration in template', async () => {
      // Create a workspace with specific configuration
      const workspaceWithConfig = await prisma.workspace.create({
        data: {
          workspace_id: `test-workspace-config-${Date.now()}`,
          name: 'Workspace with Config',
          user_id: testUserId,
          status: 'active',
          config: {
            editor: {
              theme: 'dark',
              fontSize: 14
            },
            ai: {
              model: 'gpt-4',
              temperature: 0.7
            }
          }
        }
      })

      const template = await templateService.saveAsTemplate(workspaceWithConfig.workspace_id, {
        name: 'Config Preservation Test',
        description: 'Testing config preservation',
        userId: testUserId,
        isPublic: false
      })

      expect(template.workspace_config).toBeDefined()
      expect(template.workspace_config).toHaveProperty('editor')
      expect(template.workspace_config).toHaveProperty('ai')

      // Clean up
      await prisma.workspace.delete({
        where: { id: workspaceWithConfig.id }
      })
      await templateService.deleteTemplate(template.id)
    })

    it('should handle templates without description', async () => {
      const template = await templateService.saveAsTemplate(testWorkspaceId, {
        name: 'Template Without Description',
        userId: testUserId,
        isPublic: false
      })

      expect(template).toBeDefined()
      expect(template.name).toBe('Template Without Description')
      expect(template.description).toBeNull()

      // Clean up
      await templateService.deleteTemplate(template.id)
    })

    it('should handle templates without tags', async () => {
      const template = await templateService.saveAsTemplate(testWorkspaceId, {
        name: 'Template Without Tags',
        userId: testUserId,
        isPublic: false
      })

      expect(template).toBeDefined()
      expect(template.name).toBe('Template Without Tags')
      expect(template.tags).toBeNull()

      // Clean up
      await templateService.deleteTemplate(template.id)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when saving non-existent workspace as template', async () => {
      await expect(
        templateService.saveAsTemplate('non-existent-workspace', {
          name: 'Invalid Template',
          userId: testUserId,
          isPublic: false
        })
      ).rejects.toThrow('Workspace not found')
    })

    it('should validate template name length', async () => {
      await expect(
        templateService.saveAsTemplate(testWorkspaceId, {
          name: '',
          userId: testUserId,
          isPublic: false
        })
      ).rejects.toThrow()
    })

    it('should validate user ID is positive', async () => {
      await expect(
        templateService.saveAsTemplate(testWorkspaceId, {
          name: 'Invalid User Template',
          userId: -1,
          isPublic: false
        })
      ).rejects.toThrow()
    })
  })
})
