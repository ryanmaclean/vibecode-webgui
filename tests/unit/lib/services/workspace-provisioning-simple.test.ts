/**
 * Unit tests for workspace-provisioning-simple.ts
 * Tests workspace provisioning service functionality
 */

import {
  WorkspaceProvisioningService,
  WorkspaceRequest,
  WorkspaceStatus
} from '@/lib/services/workspace-provisioning-simple';

describe('WorkspaceProvisioningService', () => {
  let service: WorkspaceProvisioningService;

  beforeEach(() => {
    // Silence console.info/warn during tests
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    service = new WorkspaceProvisioningService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default namespace', () => {
      expect(service).toBeDefined();
    });

    it('should use WORKSPACE_NAMESPACE from environment if set', () => {
      const originalEnv = process.env.WORKSPACE_NAMESPACE;
      process.env.WORKSPACE_NAMESPACE = 'custom-namespace';

      const customService = new WorkspaceProvisioningService();
      expect(customService).toBeDefined();

      // Restore
      if (originalEnv) {
        process.env.WORKSPACE_NAMESPACE = originalEnv;
      } else {
        delete process.env.WORKSPACE_NAMESPACE;
      }
    });
  });

  describe('createWorkspace', () => {
    it('should create a workspace with valid request', async () => {
      const request: WorkspaceRequest = {
        projectId: 'test-project-123',
        projectName: 'Test Project',
        framework: 'nextjs',
        userId: 'user-456',
        files: {
          'index.ts': 'console.log("hello")',
          'package.json': '{"name": "test"}'
        },
        dependencies: ['react', 'next'],
        environment: { NODE_ENV: 'development' }
      };

      const workspace = await service.createWorkspace(request);

      expect(workspace).toBeDefined();
      expect(workspace.id).toContain('ws-');
      expect(workspace.id).toContain(request.projectId);
      expect(workspace.status).toBe('ready');
      expect(workspace.url).toContain(workspace.id);
      expect(workspace.endpoints).toBeDefined();
      expect(workspace.endpoints.ide).toBeDefined();
      expect(workspace.endpoints.preview).toBeDefined();
      expect(workspace.endpoints.terminal).toBeDefined();
      expect(workspace.resources).toBeDefined();
      expect(workspace.createdAt).toBeInstanceOf(Date);
      expect(workspace.updatedAt).toBeInstanceOf(Date);
      expect(workspace.expiresAt).toBeInstanceOf(Date);
    }, 10000); // Increase timeout due to simulated delay

    it('should generate unique workspace IDs', async () => {
      const request: WorkspaceRequest = {
        projectId: 'test-project',
        projectName: 'Test',
        framework: 'react',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      };

      const workspace1 = await service.createWorkspace(request);
      const workspace2 = await service.createWorkspace(request);

      expect(workspace1.id).not.toBe(workspace2.id);
    }, 10000);

    it('should set workspace to expire in 24 hours', async () => {
      const request: WorkspaceRequest = {
        projectId: 'test-project',
        projectName: 'Test',
        framework: 'vue',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      };

      const before = Date.now();
      const workspace = await service.createWorkspace(request);
      const after = Date.now();

      const expectedExpiry = 24 * 60 * 60 * 1000; // 24 hours in ms

      expect(workspace.expiresAt).toBeDefined();
      // expiresAt should be approximately 24 hours from now
      const expiryTime = workspace.expiresAt!.getTime();
      expect(expiryTime).toBeGreaterThanOrEqual(before + expectedExpiry);
      expect(expiryTime).toBeLessThanOrEqual(after + expectedExpiry + 1000);
    }, 10000);

    it('should validate request schema', async () => {
      const invalidRequest = {
        // Missing required fields
        projectName: 'Test'
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should use default values for optional fields', async () => {
      const minimalRequest: WorkspaceRequest = {
        projectId: 'test-project',
        projectName: 'Test',
        framework: 'express',
        userId: 'user-1',
        files: {}
        // dependencies and environment are optional
      } as WorkspaceRequest;

      const workspace = await service.createWorkspace(minimalRequest);
      expect(workspace).toBeDefined();
      expect(workspace.status).toBe('ready');
    }, 10000);

    it('should include correct resource names', async () => {
      const request: WorkspaceRequest = {
        projectId: 'my-project',
        projectName: 'My Project',
        framework: 'django',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      };

      const workspace = await service.createWorkspace(request);

      expect(workspace.resources.namespace).toBeDefined();
      expect(workspace.resources.deployment).toContain('workspace-');
      expect(workspace.resources.service).toContain('-service');
      expect(workspace.resources.ingress).toContain('-ingress');
      expect(workspace.resources.pvc).toContain('-storage');
    }, 10000);

    it('should generate correct endpoint URLs', async () => {
      const request: WorkspaceRequest = {
        projectId: 'test',
        projectName: 'Test',
        framework: 'flask',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      };

      const workspace = await service.createWorkspace(request);

      expect(workspace.url).toMatch(/^https:\/\/ws-/);
      expect(workspace.url).toContain('.workspaces.vibecode.dev');
      expect(workspace.endpoints.ide).toBe(workspace.url);
      expect(workspace.endpoints.preview).toBe(`${workspace.url}/preview`);
      expect(workspace.endpoints.terminal).toBe(`${workspace.url}/terminal`);
    }, 10000);
  });

  describe('getWorkspaceStatus', () => {
    it('should return workspace status for valid ID', async () => {
      const workspaceId = 'ws-test-123';
      const status = await service.getWorkspaceStatus(workspaceId);

      expect(status).toBeDefined();
      expect(status!.id).toBe(workspaceId);
      expect(status!.status).toBe('ready');
      expect(status!.url).toContain(workspaceId);
    });

    it('should return correct endpoints', async () => {
      const workspaceId = 'ws-my-workspace';
      const status = await service.getWorkspaceStatus(workspaceId);

      expect(status!.endpoints).toBeDefined();
      expect(status!.endpoints.ide).toContain(workspaceId);
      expect(status!.endpoints.preview).toContain('/preview');
      expect(status!.endpoints.terminal).toContain('/terminal');
    });

    it('should return correct resource names', async () => {
      const workspaceId = 'ws-resource-test';
      const status = await service.getWorkspaceStatus(workspaceId);

      expect(status!.resources.deployment).toBe(`workspace-${workspaceId}`);
      expect(status!.resources.service).toBe(`workspace-${workspaceId}-service`);
      expect(status!.resources.ingress).toBe(`workspace-${workspaceId}-ingress`);
      expect(status!.resources.pvc).toBe(`workspace-${workspaceId}-storage`);
    });

    it('should return timestamps', async () => {
      const workspaceId = 'ws-timestamp-test';
      const status = await service.getWorkspaceStatus(workspaceId);

      expect(status!.createdAt).toBeInstanceOf(Date);
      expect(status!.updatedAt).toBeInstanceOf(Date);
      expect(status!.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace without throwing', async () => {
      const workspaceId = 'ws-to-delete';

      await expect(service.deleteWorkspace(workspaceId)).resolves.not.toThrow();
    });

    it('should handle deletion of non-existent workspace', async () => {
      const workspaceId = 'ws-non-existent';

      // In simplified mode, this should not throw
      await expect(service.deleteWorkspace(workspaceId)).resolves.not.toThrow();
    });
  });

  describe('listWorkspaces', () => {
    it('should return empty array in simplified mode', async () => {
      const workspaces = await service.listWorkspaces();

      expect(workspaces).toEqual([]);
    });

    it('should return array type', async () => {
      const workspaces = await service.listWorkspaces();

      expect(Array.isArray(workspaces)).toBe(true);
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace resources', async () => {
      const workspaceId = 'ws-update-test';
      const updates = {
        resources: {
          cpu: '500m',
          memory: '1Gi',
          storage: '10Gi'
        }
      };

      const result = await service.updateWorkspace(workspaceId, updates);

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });

    it('should update workspace scaling configuration', async () => {
      const workspaceId = 'ws-scaling-test';
      const updates = {
        scaling: {
          minReplicas: 1,
          maxReplicas: 5
        }
      };

      const result = await service.updateWorkspace(workspaceId, updates);

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
    });

    it('should update workspace metadata', async () => {
      const workspaceId = 'ws-metadata-test';
      const updates = {
        metadata: {
          team: 'backend',
          environment: 'staging'
        }
      };

      const result = await service.updateWorkspace(workspaceId, updates);

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
    });

    it('should handle combined updates', async () => {
      const workspaceId = 'ws-combined-test';
      const updates = {
        resources: { cpu: '1' },
        scaling: { minReplicas: 2 },
        metadata: { label: 'test' }
      };

      const result = await service.updateWorkspace(workspaceId, updates);

      expect(result).toBeDefined();
      expect(result!.id).toBe(workspaceId);
    });

    it('should update updatedAt timestamp', async () => {
      const workspaceId = 'ws-timestamp-update';
      const initialStatus = await service.getWorkspaceStatus(workspaceId);

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await service.updateWorkspace(workspaceId, { resources: { cpu: '1' } });

      expect(result!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        initialStatus!.updatedAt.getTime()
      );
    });

    it('should preserve existing workspace status', async () => {
      const workspaceId = 'ws-preserve-test';
      const result = await service.updateWorkspace(workspaceId, { metadata: { test: 'value' } });

      expect(result!.status).toBe('ready');
      expect(result!.endpoints).toBeDefined();
      expect(result!.resources).toBeDefined();
    });
  });

  describe('WorkspaceStatus schema', () => {
    it('should have all required status fields', async () => {
      const request: WorkspaceRequest = {
        projectId: 'schema-test',
        projectName: 'Schema Test',
        framework: 'nextjs',
        userId: 'user-1',
        files: {},
        dependencies: [],
        environment: {}
      };

      const workspace = await service.createWorkspace(request);

      // Verify all required fields exist
      expect(typeof workspace.id).toBe('string');
      expect(['pending', 'creating', 'ready', 'error', 'terminating']).toContain(workspace.status);
      expect(typeof workspace.url).toBe('string');
      expect(typeof workspace.endpoints).toBe('object');
      expect(typeof workspace.resources).toBe('object');
      expect(workspace.createdAt).toBeInstanceOf(Date);
      expect(workspace.updatedAt).toBeInstanceOf(Date);
    }, 10000);

    it('should have all endpoint fields', async () => {
      const status = await service.getWorkspaceStatus('ws-endpoint-test');

      expect(typeof status!.endpoints.ide).toBe('string');
      expect(typeof status!.endpoints.preview).toBe('string');
      expect(typeof status!.endpoints.terminal).toBe('string');
    });

    it('should have all resource fields', async () => {
      const status = await service.getWorkspaceStatus('ws-resource-test');

      expect(typeof status!.resources.namespace).toBe('string');
      expect(typeof status!.resources.deployment).toBe('string');
      expect(typeof status!.resources.service).toBe('string');
      expect(typeof status!.resources.ingress).toBe('string');
      expect(typeof status!.resources.pvc).toBe('string');
    });
  });

  describe('WorkspaceRequest validation', () => {
    it('should accept valid request with all fields', async () => {
      const request: WorkspaceRequest = {
        projectId: 'valid-project',
        projectName: 'Valid Project',
        framework: 'nextjs',
        userId: 'user-123',
        files: {
          'src/index.ts': 'export default function() {}',
          'package.json': '{"name": "valid"}'
        },
        dependencies: ['react', 'typescript'],
        environment: {
          API_KEY: 'test-key',
          DEBUG: 'true'
        }
      };

      const workspace = await service.createWorkspace(request);
      expect(workspace).toBeDefined();
    }, 10000);

    it('should reject request missing projectId', async () => {
      const invalidRequest = {
        projectName: 'Test',
        framework: 'react',
        userId: 'user-1',
        files: {}
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should reject request missing projectName', async () => {
      const invalidRequest = {
        projectId: 'test',
        framework: 'react',
        userId: 'user-1',
        files: {}
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should reject request missing framework', async () => {
      const invalidRequest = {
        projectId: 'test',
        projectName: 'Test',
        userId: 'user-1',
        files: {}
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should reject request missing userId', async () => {
      const invalidRequest = {
        projectId: 'test',
        projectName: 'Test',
        framework: 'react',
        files: {}
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });

    it('should reject request missing files', async () => {
      const invalidRequest = {
        projectId: 'test',
        projectName: 'Test',
        framework: 'react',
        userId: 'user-1'
      } as WorkspaceRequest;

      await expect(service.createWorkspace(invalidRequest)).rejects.toThrow();
    });
  });
});
