/**
 * Mock Workspace Provisioning Service for Testing
 * Extracted from src/lib/services/workspace-provisioning-simple.ts
 */

import { z } from 'zod'

const WorkspaceRequestSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  framework: z.string(),
  userId: z.string(),
  files: z.record(z.string()),
  dependencies: z.array(z.string()).default([]),
  environment: z.record(z.string()).default({})
})

const WorkspaceStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'creating', 'ready', 'error', 'terminating']),
  url: z.string().optional(),
  endpoints: z.object({
    ide: z.string().optional(),
    preview: z.string().optional(),
    terminal: z.string().optional()
  }).default({}),
  resources: z.object({
    namespace: z.string(),
    deployment: z.string(),
    service: z.string(),
    ingress: z.string().optional(),
    pvc: z.string().optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().optional()
})

export type WorkspaceRequest = z.infer<typeof WorkspaceRequestSchema>
export type WorkspaceStatus = z.infer<typeof WorkspaceStatusSchema>

export class MockWorkspaceProvisioningService {
  private namespace: string
  
  // Mock data storage for tests
  private workspaces: Map<string, WorkspaceStatus> = new Map()

  constructor() {
    this.namespace = process.env.WORKSPACE_NAMESPACE || 'vibecode-workspaces-test'
  }

  /**
   * Create a new development workspace (mock implementation)
   */
  async createWorkspace(request: WorkspaceRequest): Promise<WorkspaceStatus> {
    const validatedRequest = WorkspaceRequestSchema.parse(request)
    
    // Generate unique workspace ID
    const workspaceId = `ws-${validatedRequest.projectId}-${Date.now()}`
    const workspaceName = `workspace-${workspaceId}`

    // Simulate workspace creation delay (minimal for tests)
    await new Promise(resolve => setTimeout(resolve, 10))

    const workspace: WorkspaceStatus = {
      id: workspaceId,
      status: 'ready',
      url: `https://${workspaceId}.workspaces.vibecode.test`,
      endpoints: {
        ide: `https://${workspaceId}.workspaces.vibecode.test`,
        preview: `https://${workspaceId}.workspaces.vibecode.test/preview`,
        terminal: `https://${workspaceId}.workspaces.vibecode.test/terminal`
      },
      resources: {
        namespace: this.namespace,
        deployment: workspaceName,
        service: `${workspaceName}-service`,
        ingress: `${workspaceName}-ingress`,
        pvc: `${workspaceName}-storage`
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    }

    // Store for retrieval
    this.workspaces.set(workspaceId, workspace)
    
    return workspace
  }

  /**
   * Get workspace status (mock implementation)
   */
  async getWorkspaceStatus(workspaceId: string): Promise<WorkspaceStatus | null> {
    const stored = this.workspaces.get(workspaceId)
    if (stored) {
      return stored
    }

    // Return mock status for unknown workspaces
    return {
      id: workspaceId,
      status: 'ready',
      url: `https://${workspaceId}.workspaces.vibecode.test`,
      endpoints: {
        ide: `https://${workspaceId}.workspaces.vibecode.test`,
        preview: `https://${workspaceId}.workspaces.vibecode.test/preview`,
        terminal: `https://${workspaceId}.workspaces.vibecode.test/terminal`
      },
      resources: {
        namespace: this.namespace,
        deployment: `workspace-${workspaceId}`,
        service: `workspace-${workspaceId}-service`,
        ingress: `workspace-${workspaceId}-ingress`,
        pvc: `workspace-${workspaceId}-storage`
      },
      createdAt: new Date(Date.now() - 60000), // 1 minute ago
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  }

  /**
   * Delete workspace (mock implementation)
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    // Simulate deletion delay (minimal for tests)
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Remove from mock storage
    this.workspaces.delete(workspaceId)
  }

  /**
   * List all workspaces (mock implementation)
   */
  async listWorkspaces(): Promise<WorkspaceStatus[]> {
    return Array.from(this.workspaces.values())
  }

  /**
   * Test helper: Clear all mock data
   */
  clearAll(): void {
    this.workspaces.clear()
  }

  /**
   * Test helper: Set workspace status
   */
  setWorkspaceStatus(workspaceId: string, status: WorkspaceStatus): void {
    this.workspaces.set(workspaceId, status)
  }
}

// Export default for Jest mocking
export default MockWorkspaceProvisioningService