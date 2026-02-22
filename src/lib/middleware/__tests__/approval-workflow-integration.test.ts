/**
 * Integration tests for production operations triggering approval workflow
 * Tests that operations in production environment trigger HITL approval workflow
 */

import {
  checkAgentOperation,
  checkFileOperation,
  checkDatabaseOperation,
  checkDeploymentOperation,
  checkSystemConfigOperation,
  initializeEnvironmentGuard,
  setHITLManager,
  __TEST__resetEnvironmentGuard,
} from '../environment-guard';
import { EnvironmentPermissionManager } from '../../environment/permissions';
import type { HITLManager, ApprovalRequest } from '@/lib/workflow/hitl-manager';
import type { OperationMetadata } from '../../environment/types';

describe('Production Operations Approval Workflow Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockHITLManager: jest.Mocked<HITLManager>;
  let mockCreateRequest: jest.Mock;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset environment guard state
    __TEST__resetEnvironmentGuard();

    // Reset permission manager singleton
    EnvironmentPermissionManager.resetInstance();

    // Create mock HITL manager
    mockCreateRequest = jest.fn().mockReturnValue({
      id: 'test-approval-request',
      type: 'code_change',
      title: 'Test Approval',
      description: 'Test description',
      status: 'pending',
      createdAt: new Date(),
    } as ApprovalRequest);

    mockHITLManager = {
      createRequest: mockCreateRequest,
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
      cancelRequest: jest.fn(),
      getRequest: jest.fn(),
      listRequests: jest.fn(),
      waitForApproval: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    } as unknown as jest.Mocked<HITLManager>;

    // Initialize environment guard with mock HITL manager
    initializeEnvironmentGuard({
      enabled: true,
      bypassInTest: false, // Don't bypass in tests
      logChecks: false, // Reduce noise in tests
      hitlManager: mockHITLManager,
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Reset singletons
    __TEST__resetEnvironmentGuard();
    EnvironmentPermissionManager.resetInstance();
  });

  // ==========================================================================
  // Production Environment - File Operations
  // ==========================================================================

  describe('production file operations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('write_file operation triggers approval workflow', async () => {
      const result = await checkFileOperation('write', '/app/config.json', 'medium', 'test-agent');

      expect(result.environment).toBe('production');
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false); // Not allowed until approved
      expect(result.approvalRequest).toBeDefined();
      expect(mockCreateRequest).toHaveBeenCalled();
    });

    it('delete_file operation triggers approval workflow', async () => {
      const result = await checkFileOperation('delete', '/app/data.db', 'high', 'test-agent');

      expect(result.environment).toBe('production');
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false);
      expect(result.approvalRequest).toBeDefined();
      expect(mockCreateRequest).toHaveBeenCalled();
    });

    it('read_file operation is allowed in production', async () => {
      const result = await checkFileOperation('read', '/app/config.json', 'low', 'test-agent');

      expect(result.environment).toBe('production');
      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(true);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Production Environment - Database Operations
  // ==========================================================================

  describe('production database operations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('database_write operation triggers approval workflow', async () => {
      const result = await checkDatabaseOperation(
        'write',
        'Update user records',
        ['users', 'profiles'],
        'high',
        'test-agent'
      );

      expect(result.environment).toBe('production');
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false);
      expect(result.approvalRequest).toBeDefined();
      expect(mockCreateRequest).toHaveBeenCalled();

      // Verify approval request details
      const callArgs = mockCreateRequest.mock.calls[0][0];
      expect(callArgs.type).toBe('data_access');
      expect(callArgs.title).toContain('database_write');
      expect(callArgs.title).toContain('production');
    });

    it('database_read operation is allowed in production', async () => {
      const result = await checkDatabaseOperation(
        'read',
        'Query user data',
        ['users'],
        'medium',
        'test-agent'
      );

      expect(result.environment).toBe('production');
      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(true);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Production Environment - Deployment Operations
  // ==========================================================================

  describe('production deployment operations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('deployment operation triggers approval workflow', async () => {
      const result = await checkDeploymentOperation(
        'Deploy new version to production',
        ['api', 'frontend'],
        'critical',
        'test-agent'
      );

      expect(result.environment).toBe('production');
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false);
      expect(result.approvalRequest).toBeDefined();
      expect(mockCreateRequest).toHaveBeenCalled();

      // Verify approval request has deployment type
      const callArgs = mockCreateRequest.mock.calls[0][0];
      expect(callArgs.type).toBe('deployment');
      expect(callArgs.priority).toBe('critical'); // Critical risk = critical priority
    });
  });

  // ==========================================================================
  // Production Environment - System Configuration
  // ==========================================================================

  describe('production system configuration operations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('system_config operation triggers approval workflow', async () => {
      const result = await checkSystemConfigOperation(
        'Update nginx configuration',
        ['nginx.conf'],
        'high',
        'test-agent'
      );

      expect(result.environment).toBe('production');
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false);
      expect(result.approvalRequest).toBeDefined();
      expect(mockCreateRequest).toHaveBeenCalled();

      // Verify approval request has security_action type
      const callArgs = mockCreateRequest.mock.calls[0][0];
      expect(callArgs.type).toBe('security_action');
    });
  });

  // ==========================================================================
  // Development Environment - No Approval Required
  // ==========================================================================

  describe('development environment operations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('write_file operation is allowed without approval', async () => {
      const result = await checkFileOperation('write', '/app/test.txt', 'medium', 'test-agent');

      expect(result.environment).toBe('development');
      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(true);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });

    it('delete_file operation is allowed without approval', async () => {
      const result = await checkFileOperation('delete', '/app/temp.txt', 'medium', 'test-agent');

      expect(result.environment).toBe('development');
      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(true);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });

    it('database_write operation is allowed without approval', async () => {
      const result = await checkDatabaseOperation(
        'write',
        'Insert test data',
        ['test_users'],
        'low',
        'test-agent'
      );

      expect(result.environment).toBe('development');
      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(true);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });

    it('deployment operation is denied in development', async () => {
      const result = await checkDeploymentOperation(
        'Deploy from dev environment',
        ['api'],
        'medium',
        'test-agent'
      );

      expect(result.environment).toBe('development');
      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(false); // Denied, not requires_approval
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Staging Environment - Selective Approval
  // ==========================================================================

  describe('staging environment operations', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'staging';
    });

    it('write_file operation triggers approval for medium+ risk', async () => {
      const result = await checkFileOperation('write', '/app/config.json', 'medium', 'test-agent');

      expect(result.environment).toBe('staging');
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false);
      expect(result.approvalRequest).toBeDefined();
      expect(mockCreateRequest).toHaveBeenCalled();
    });

    it('database_write operation triggers approval', async () => {
      const result = await checkDatabaseOperation(
        'write',
        'Update staging data',
        ['users'],
        'low',
        'test-agent'
      );

      expect(result.environment).toBe('staging');
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false);
      expect(mockCreateRequest).toHaveBeenCalled();
    });

    it('read operations are allowed without approval', async () => {
      const result = await checkDatabaseOperation(
        'read',
        'Query staging data',
        ['users'],
        'low',
        'test-agent'
      );

      expect(result.environment).toBe('staging');
      expect(result.requiresApproval).toBe(false);
      expect(result.allowed).toBe(true);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Approval Request Details
  // ==========================================================================

  describe('approval request details', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('includes operation details in approval request', async () => {
      const operation: OperationMetadata = {
        type: 'write',
        riskLevel: 'high',
        description: 'Update production database schema',
        affectedResources: ['users', 'posts', 'comments'],
        agent: 'schema-migrator',
        requestedAt: new Date(),
      };

      await checkAgentOperation('database_write', operation);

      expect(mockCreateRequest).toHaveBeenCalled();
      const callArgs = mockCreateRequest.mock.calls[0][0];

      expect(callArgs.description).toContain('database_write');
      expect(callArgs.description).toContain('production');
      expect(callArgs.description).toContain('high');
      expect(callArgs.description).toContain('Update production database schema');
      expect(callArgs.agentId).toBe('schema-migrator');
      expect(callArgs.priority).toBe('high');
    });

    it('sets appropriate priority based on risk level', async () => {
      const scenarios = [
        { risk: 'safe' as const, expectedPriority: 'low' },
        { risk: 'low' as const, expectedPriority: 'low' },
        { risk: 'medium' as const, expectedPriority: 'medium' },
        { risk: 'high' as const, expectedPriority: 'high' },
        { risk: 'critical' as const, expectedPriority: 'critical' },
      ];

      for (const scenario of scenarios) {
        mockCreateRequest.mockClear();

        await checkFileOperation('write', '/app/test.txt', scenario.risk);

        expect(mockCreateRequest).toHaveBeenCalled();
        const callArgs = mockCreateRequest.mock.calls[0][0];
        expect(callArgs.priority).toBe(scenario.expectedPriority);
      }
    });

    it('includes affected resources in approval request', async () => {
      await checkDatabaseOperation(
        'write',
        'Migrate user data',
        ['users', 'user_profiles', 'user_settings'],
        'high'
      );

      expect(mockCreateRequest).toHaveBeenCalled();
      const callArgs = mockCreateRequest.mock.calls[0][0];
      expect(callArgs.description).toContain('users');
      expect(callArgs.description).toContain('user_profiles');
      expect(callArgs.description).toContain('user_settings');
    });
  });

  // ==========================================================================
  // Multi-Environment Comparison
  // ==========================================================================

  describe('cross-environment comparison', () => {
    const testOperation = async (env: string) => {
      process.env.NODE_ENV = env;
      mockCreateRequest.mockClear();
      __TEST__resetEnvironmentGuard();
      EnvironmentPermissionManager.resetInstance();
      initializeEnvironmentGuard({
        enabled: true,
        bypassInTest: env !== 'test',
        logChecks: false,
        hitlManager: mockHITLManager,
      });

      return await checkFileOperation('write', '/app/data.json', 'medium');
    };

    it('production requires approval', async () => {
      const result = await testOperation('production');
      expect(result.requiresApproval).toBe(true);
      expect(mockCreateRequest).toHaveBeenCalled();
    });

    it('staging requires approval', async () => {
      const result = await testOperation('staging');
      expect(result.requiresApproval).toBe(true);
      expect(mockCreateRequest).toHaveBeenCalled();
    });

    it('development allows operation', async () => {
      const result = await testOperation('development');
      expect(result.requiresApproval).toBe(false);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });

    it('test allows operation (with bypass enabled)', async () => {
      const result = await testOperation('test');
      expect(result.allowed).toBe(true);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('error handling without HITL manager', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      __TEST__resetEnvironmentGuard();
      EnvironmentPermissionManager.resetInstance();

      // Initialize without HITL manager
      initializeEnvironmentGuard({
        enabled: true,
        bypassInTest: false,
        logChecks: false,
        // No hitlManager provided
      });
    });

    it('handles missing HITL manager gracefully', async () => {
      const result = await checkFileOperation('write', '/app/config.json', 'medium');

      expect(result.environment).toBe('production');
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false);
      expect(result.approvalRequest).toBeNull(); // No approval request without manager
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles unknown environment with default deny', async () => {
      process.env.NODE_ENV = 'unknown-env';

      const result = await checkFileOperation('write', '/app/data.txt', 'medium');

      expect(result.environment).toBe('unknown');
      expect(result.allowed).toBe(false);
      expect(mockCreateRequest).not.toHaveBeenCalled();
    });

    it('includes timestamp in guard result', async () => {
      process.env.NODE_ENV = 'production';
      const before = new Date();

      const result = await checkFileOperation('write', '/app/test.txt', 'low');

      const after = new Date();
      expect(result.checkedAt).toBeInstanceOf(Date);
      expect(result.checkedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.checkedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('handles operation without agent ID', async () => {
      process.env.NODE_ENV = 'production';

      const result = await checkFileOperation('write', '/app/test.txt', 'medium');

      expect(result.requiresApproval).toBe(true);
      expect(mockCreateRequest).toHaveBeenCalled();

      const callArgs = mockCreateRequest.mock.calls[0][0];
      expect(callArgs.agentId).toBeDefined(); // Should have a default value
    });
  });
});
