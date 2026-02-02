/**
 * Integration tests for workspace provisioning end-to-end flow
 * Tests the complete workspace lifecycle from creation to deletion
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ENV_MOCK, MockUtils } from '../utils/mock-templates';

// Mock next-auth for authentication
jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({
    user: {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User'
    }
  })
}));

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {}
}));

// Mock prisma for workspace persistence
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    workspace: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    project: {
      findUnique: jest.fn(),
      create: jest.fn()
    }
  }
}));

// Mock vector store for workspace indexing
jest.mock('@/lib/vector-store', () => ({
  vectorStore: {
    search: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue(undefined)
  }
}));

import {
  WorkspaceProvisioningService,
  WorkspaceRequest,
  WorkspaceStatus
} from '@/lib/services/workspace-provisioning-simple';

describe('Workspace Provisioning End-to-End Integration', () => {
  let service: WorkspaceProvisioningService;
  let consoleSpy: {
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    log: jest.SpyInstance;
    debug: jest.SpyInstance;
  };

  beforeEach(() => {
    MockUtils.resetAllMocks();
    Object.assign(process.env, ENV_MOCK.test());

    // Silence console output during tests
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {})
    };

    service = new WorkspaceProvisioningService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    MockUtils.resetAllMocks();
  });

  describe('Complete Workspace Lifecycle', () => {
    it('should create, retrieve, update, and delete workspace', async () => {
      // Step 1: Create workspace
      const createRequest: WorkspaceRequest = {
        projectId: 'lifecycle-test-project',
        projectName: 'Lifecycle Test Project',
        framework: 'nextjs',
        userId: 'test-user-123',
        files: {
          'src/app/page.tsx': 'export default function Home() { return <div>Hello</div>; }',
          'package.json': JSON.stringify({ name: 'lifecycle-test', version: '1.0.0' })
        },
        dependencies: ['next', 'react', 'react-dom'],
        environment: { NODE_ENV: 'development' }
      };

      const workspace = await service.createWorkspace(createRequest);

      expect(workspace).toBeDefined();
      expect(workspace.id).toContain('ws-');
      expect(workspace.status).toBe('ready');
      expect(workspace.url).toBeDefined();

      // Step 2: Retrieve workspace status
      const status = await service.getWorkspaceStatus(workspace.id);

      expect(status).toBeDefined();
      expect(status!.id).toBe(workspace.id);
      expect(status!.status).toBe('ready');

      // Step 3: Update workspace
      const updateResult = await service.updateWorkspace(workspace.id, {
        resources: { cpu: '1', memory: '2Gi' },
        scaling: { minReplicas: 1, maxReplicas: 3 },
        metadata: { team: 'frontend' }
      });

      expect(updateResult).toBeDefined();
      expect(updateResult!.id).toBe(workspace.id);
      expect(updateResult!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        workspace.updatedAt.getTime()
      );

      // Step 4: Delete workspace
      await expect(service.deleteWorkspace(workspace.id)).resolves.not.toThrow();
    }, 15000);

    it('should handle multiple concurrent workspace creations', async () => {
      const requests: WorkspaceRequest[] = Array.from({ length: 3 }, (_, i) => ({
        projectId: `concurrent-project-${i}`,
        projectName: `Concurrent Project ${i}`,
        framework: 'react',
        userId: 'test-user-123',
        files: { 'index.tsx': `console.log(${i})` },
        dependencies: ['react'],
        environment: {}
      }));

      const results = await Promise.all(
        requests.map(req => service.createWorkspace(req))
      );

      expect(results).toHaveLength(3);

      // Verify all workspaces are unique
      const ids = results.map(w => w.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      // Verify all are in ready state
      results.forEach(workspace => {
        expect(workspace.status).toBe('ready');
        expect(workspace.url).toBeDefined();
      });
    }, 20000);
  });

  describe('Workspace Creation with Different Frameworks', () => {
    const frameworks = ['react', 'nextjs', 'vue', 'express', 'django', 'flask'];

    frameworks.forEach(framework => {
      it(`should create workspace for ${framework} framework`, async () => {
        const request: WorkspaceRequest = {
          projectId: `${framework}-test-project`,
          projectName: `${framework} Test Project`,
          framework,
          userId: 'test-user-123',
          files: { 'main.ts': 'console.log("test")' },
          dependencies: [],
          environment: {}
        };

        const workspace = await service.createWorkspace(request);

        expect(workspace).toBeDefined();
        expect(workspace.id).toContain('ws-');
        expect(workspace.status).toBe('ready');
        expect(workspace.endpoints).toBeDefined();
        expect(workspace.endpoints.ide).toBeDefined();
        expect(workspace.endpoints.preview).toBeDefined();
        expect(workspace.endpoints.terminal).toBeDefined();
      }, 10000);
    });
  });

  describe('Workspace Endpoints Verification', () => {
    it('should generate correct endpoint URLs', async () => {
      const request: WorkspaceRequest = {
        projectId: 'endpoint-test',
        projectName: 'Endpoint Test',
        framework: 'nextjs',
        userId: 'test-user-123',
        files: {},
        dependencies: [],
        environment: {}
      };

      const workspace = await service.createWorkspace(request);

      // Verify URL format
      expect(workspace.url).toMatch(/^https:\/\/ws-.*\.workspaces\.vibecode\.dev$/);

      // Verify endpoints are derived from URL
      expect(workspace.endpoints.ide).toBe(workspace.url);
      expect(workspace.endpoints.preview).toBe(`${workspace.url}/preview`);
      expect(workspace.endpoints.terminal).toBe(`${workspace.url}/terminal`);
    }, 10000);

    it('should include all Kubernetes resource references', async () => {
      const request: WorkspaceRequest = {
        projectId: 'resource-test',
        projectName: 'Resource Test',
        framework: 'express',
        userId: 'test-user-123',
        files: {},
        dependencies: [],
        environment: {}
      };

      const workspace = await service.createWorkspace(request);

      // Verify all K8s resources are named
      expect(workspace.resources.namespace).toBeDefined();
      expect(workspace.resources.deployment).toContain('workspace-');
      expect(workspace.resources.service).toContain('-service');
      expect(workspace.resources.ingress).toContain('-ingress');
      expect(workspace.resources.pvc).toContain('-storage');
    }, 10000);
  });

  describe('Workspace File Handling', () => {
    it('should accept workspace with multiple files', async () => {
      const files: Record<string, string> = {
        'src/index.ts': 'export * from "./app"',
        'src/app.ts': 'export function App() {}',
        'src/utils/helpers.ts': 'export const helper = () => {}',
        'package.json': '{"name":"test"}',
        'tsconfig.json': '{"compilerOptions":{}}',
        '.gitignore': 'node_modules'
      };

      const request: WorkspaceRequest = {
        projectId: 'multi-file-test',
        projectName: 'Multi File Test',
        framework: 'typescript',
        userId: 'test-user-123',
        files,
        dependencies: ['typescript'],
        environment: {}
      };

      const workspace = await service.createWorkspace(request);

      expect(workspace).toBeDefined();
      expect(workspace.status).toBe('ready');
    }, 10000);

    it('should accept workspace with empty files object', async () => {
      const request: WorkspaceRequest = {
        projectId: 'empty-files-test',
        projectName: 'Empty Files Test',
        framework: 'blank',
        userId: 'test-user-123',
        files: {},
        dependencies: [],
        environment: {}
      };

      const workspace = await service.createWorkspace(request);

      expect(workspace).toBeDefined();
      expect(workspace.status).toBe('ready');
    }, 10000);
  });

  describe('Workspace Update Operations', () => {
    it('should update workspace CPU resources', async () => {
      const workspaceId = 'ws-cpu-update-test';

      const result = await service.updateWorkspace(workspaceId, {
        resources: { cpu: '2' }
      });

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
    });

    it('should update workspace memory resources', async () => {
      const workspaceId = 'ws-memory-update-test';

      const result = await service.updateWorkspace(workspaceId, {
        resources: { memory: '4Gi' }
      });

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
    });

    it('should update workspace storage resources', async () => {
      const workspaceId = 'ws-storage-update-test';

      const result = await service.updateWorkspace(workspaceId, {
        resources: { storage: '50Gi' }
      });

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
    });

    it('should update workspace scaling configuration', async () => {
      const workspaceId = 'ws-scaling-update-test';

      const result = await service.updateWorkspace(workspaceId, {
        scaling: { minReplicas: 2, maxReplicas: 10 }
      });

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
    });

    it('should update workspace metadata', async () => {
      const workspaceId = 'ws-metadata-update-test';

      const result = await service.updateWorkspace(workspaceId, {
        metadata: {
          team: 'backend',
          environment: 'production',
          version: '2.0.0'
        }
      });

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
    });
  });

  describe('Workspace Expiration', () => {
    it('should set workspace expiration to 24 hours', async () => {
      const request: WorkspaceRequest = {
        projectId: 'expiry-test',
        projectName: 'Expiry Test',
        framework: 'react',
        userId: 'test-user-123',
        files: {},
        dependencies: [],
        environment: {}
      };

      const beforeCreation = Date.now();
      const workspace = await service.createWorkspace(request);
      const afterCreation = Date.now();

      expect(workspace.expiresAt).toBeDefined();

      const expectedMinExpiry = beforeCreation + (24 * 60 * 60 * 1000);
      const expectedMaxExpiry = afterCreation + (24 * 60 * 60 * 1000);

      expect(workspace.expiresAt!.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry);
      expect(workspace.expiresAt!.getTime()).toBeLessThanOrEqual(expectedMaxExpiry + 1000);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should reject invalid workspace request missing projectId', async () => {
      const invalidRequest = {
        projectName: 'Invalid',
        framework: 'react',
        userId: 'test-user',
        files: {}
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should reject invalid workspace request missing projectName', async () => {
      const invalidRequest = {
        projectId: 'invalid',
        framework: 'react',
        userId: 'test-user',
        files: {}
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should reject invalid workspace request missing framework', async () => {
      const invalidRequest = {
        projectId: 'invalid',
        projectName: 'Invalid',
        userId: 'test-user',
        files: {}
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should reject invalid workspace request missing userId', async () => {
      const invalidRequest = {
        projectId: 'invalid',
        projectName: 'Invalid',
        framework: 'react',
        files: {}
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should reject invalid workspace request missing files', async () => {
      const invalidRequest = {
        projectId: 'invalid',
        projectName: 'Invalid',
        framework: 'react',
        userId: 'test-user'
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });
  });

  describe('Workspace Listing', () => {
    it('should return empty list in simplified mode', async () => {
      const workspaces = await service.listWorkspaces();

      expect(workspaces).toEqual([]);
      expect(Array.isArray(workspaces)).toBe(true);
    });
  });

  describe('Workspace Status Retrieval', () => {
    it('should return status for any workspace ID', async () => {
      const workspaceId = 'ws-status-test-123';
      const status = await service.getWorkspaceStatus(workspaceId);

      expect(status).toBeDefined();
      expect(status!.id).toBe(workspaceId);
      expect(status!.status).toBe('ready');
    });

    it('should return complete status information', async () => {
      const workspaceId = 'ws-complete-status-test';
      const status = await service.getWorkspaceStatus(workspaceId);

      // Verify all required fields
      expect(status!.id).toBe(workspaceId);
      expect(status!.status).toBe('ready');
      expect(status!.url).toBeDefined();
      expect(status!.endpoints).toBeDefined();
      expect(status!.resources).toBeDefined();
      expect(status!.createdAt).toBeInstanceOf(Date);
      expect(status!.updatedAt).toBeInstanceOf(Date);
      expect(status!.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('Custom Namespace Configuration', () => {
    it('should use custom namespace from environment', async () => {
      const originalNamespace = process.env.WORKSPACE_NAMESPACE;
      process.env.WORKSPACE_NAMESPACE = 'custom-test-namespace';

      const customService = new WorkspaceProvisioningService();
      const status = await customService.getWorkspaceStatus('ws-custom-ns-test');

      expect(status!.resources.namespace).toBe('custom-test-namespace');

      // Restore original
      if (originalNamespace) {
        process.env.WORKSPACE_NAMESPACE = originalNamespace;
      } else {
        delete process.env.WORKSPACE_NAMESPACE;
      }
    });

    it('should use default namespace when not configured', async () => {
      const originalNamespace = process.env.WORKSPACE_NAMESPACE;
      delete process.env.WORKSPACE_NAMESPACE;

      const defaultService = new WorkspaceProvisioningService();
      const status = await defaultService.getWorkspaceStatus('ws-default-ns-test');

      expect(status!.resources.namespace).toBe('vibecode-workspaces');

      // Restore original
      if (originalNamespace) {
        process.env.WORKSPACE_NAMESPACE = originalNamespace;
      }
    });
  });
});
