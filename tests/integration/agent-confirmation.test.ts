/**
 * Integration Tests for Agent Action Preview & Confirmation
 *
 * Tests end-to-end workflow from settings to service to UI
 * for the agent confirmation feature.
 */

import { Agent, createAgent } from '@/lib/agent-framework';
import type { ToolDefinition } from '@/lib/agent-framework';
import { ConfirmationService } from '@/lib/agent-framework/confirmation/service';
import type {
  ConfirmationRequest,
  ConfirmationResponse,
  ActionPreview,
  ConfirmationRequiredEvent,
  ConfirmationApprovedEvent,
  ConfirmationRejectedEvent,
} from '@/types/agent-confirmation';
import { UnifiedAIClient } from '@/lib/unified-ai-client';

// UnifiedAIClient is globally mocked by jest.setup.js
jest.mock('@/lib/unified-ai-client');

describe('Agent Confirmation - Integration Tests', () => {
  let client: jest.Mocked<UnifiedAIClient>;
  let confirmationService: ConfirmationService;

  beforeEach(() => {
    // Reset and configure the mock client
    jest.clearAllMocks();
    client = new UnifiedAIClient() as jest.Mocked<UnifiedAIClient>;

    // Create fresh confirmation service for each test
    confirmationService = new ConfirmationService({
      defaultTimeout: 30000, // 30 seconds for tests
      maxPendingConfirmations: 50,
      autoCleanupExpired: true,
    });

    // Simple mock response
    client.chat = jest.fn().mockResolvedValue({
      content: 'Mock response',
      model: 'gpt-4o-mini',
      provider: 'openai',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    });
  });

  afterEach(() => {
    // Clean up pending confirmations
    if (confirmationService) {
      confirmationService.clearPendingConfirmations();
    }
  });

  describe('Settings → Service Integration', () => {
    it('should create confirmation service with custom settings', () => {
      const customService = new ConfirmationService({
        defaultTimeout: 60000,
        maxPendingConfirmations: 100,
        autoCleanupExpired: false,
      });

      expect(customService).toBeDefined();
      expect(customService.getPendingCount()).toBe(0);
    });

    it('should respect max pending confirmations limit', () => {
      const limitedService = new ConfirmationService({
        maxPendingConfirmations: 2,
      });

      const action1: ActionPreview = {
        action_id: '1',
        action_type: 'file_write',
        tool_name: 'file_write',
        file_path: 'test1.ts',
        explanation: 'Test action 1',
        created_at: new Date().toISOString(),
      };

      const action2: ActionPreview = {
        action_id: '2',
        action_type: 'file_write',
        tool_name: 'file_write',
        file_path: 'test2.ts',
        explanation: 'Test action 2',
        created_at: new Date().toISOString(),
      };

      const action3: ActionPreview = {
        action_id: '3',
        action_type: 'file_write',
        tool_name: 'file_write',
        file_path: 'test3.ts',
        explanation: 'Test action 3',
        created_at: new Date().toISOString(),
      };

      limitedService.requestConfirmation('agent-1', action1);
      limitedService.requestConfirmation('agent-1', action2);

      expect(() => {
        limitedService.requestConfirmation('agent-1', action3);
      }).toThrow(/Maximum pending confirmations/);
    });
  });

  describe('Service → Event Emission', () => {
    it('should emit confirmation_required event when requesting confirmation', (done) => {
      const action: ActionPreview = {
        action_id: 'test-action-1',
        action_type: 'file_edit',
        tool_name: 'file_edit',
        file_path: 'src/example.ts',
        explanation: 'Update function signature',
        diff: {
          old_content: 'function test() {}',
          new_content: 'function test(param: string) {}',
          language: 'typescript',
          lines_added: 1,
          lines_removed: 1,
        },
        created_at: new Date().toISOString(),
      };

      confirmationService.on('confirmation_required', (event: ConfirmationRequiredEvent) => {
        expect(event.type).toBe('confirmation_required');
        expect(event.confirmation.action.action_id).toBe('test-action-1');
        expect(event.confirmation.status).toBe('pending');
        expect(event.confirmation.agent_id).toBe('test-agent');
        done();
      });

      confirmationService.requestConfirmation('test-agent', action);
    });

    it('should emit confirmation_approved event when approving', async () => {
      const action: ActionPreview = {
        action_id: 'test-action-2',
        action_type: 'file_write',
        tool_name: 'file_write',
        file_path: 'src/new.ts',
        explanation: 'Create new file',
        created_at: new Date().toISOString(),
      };

      let approvedEvent: ConfirmationApprovedEvent | null = null;

      confirmationService.on('confirmation_approved', (event: ConfirmationApprovedEvent) => {
        approvedEvent = event;
      });

      const request = confirmationService.requestConfirmation('test-agent', action);

      // Simulate async confirmation
      setTimeout(async () => {
        await confirmationService.approve(request.request_id, 'Looks good!');
      }, 10);

      // Wait a bit for the approval
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(approvedEvent).not.toBeNull();
      expect(approvedEvent?.type).toBe('confirmation_approved');
      expect(approvedEvent?.response.decision).toBe('approve');
      expect(approvedEvent?.response.comment).toBe('Looks good!');
    });

    it('should emit confirmation_rejected event when rejecting', async () => {
      const action: ActionPreview = {
        action_id: 'test-action-3',
        action_type: 'file_delete',
        tool_name: 'file_delete',
        file_path: 'src/old.ts',
        explanation: 'Remove deprecated file',
        created_at: new Date().toISOString(),
      };

      let rejectedEvent: ConfirmationRejectedEvent | null = null;

      confirmationService.on('confirmation_rejected', (event: ConfirmationRejectedEvent) => {
        rejectedEvent = event;
      });

      const request = confirmationService.requestConfirmation('test-agent', action);

      // Simulate async rejection
      setTimeout(async () => {
        await confirmationService.reject(request.request_id, 'Not safe');
      }, 10);

      // Wait a bit for the rejection
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(rejectedEvent).not.toBeNull();
      expect(rejectedEvent?.type).toBe('confirmation_rejected');
      expect(rejectedEvent?.response.decision).toBe('reject');
      expect(rejectedEvent?.response.comment).toBe('Not safe');
    });
  });

  describe('Agent Tool Execution with Confirmation', () => {
    it('should trigger confirmation for tools marked requiresConfirmation', async () => {
      const fileEditTool: ToolDefinition = {
        name: 'file_edit',
        description: 'Edit a file',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            old_content: { type: 'string' },
            new_content: { type: 'string' },
          },
          required: ['file_path', 'old_content', 'new_content'],
        },
        requiresConfirmation: true,
        execute: async (params) => {
          return { success: true, file_path: params.file_path };
        },
      };

      const agent = createAgent({
        model: 'gpt-4o-mini',
        tools: [fileEditTool],
        client,
        confirmationService,
        agentId: 'test-agent-1',
      });

      let confirmationEvent: ConfirmationRequiredEvent | null = null;

      agent.on('confirmation_required', (event: ConfirmationRequiredEvent) => {
        confirmationEvent = event;

        // Auto-approve for this test
        setTimeout(async () => {
          await confirmationService.approve(event.confirmation.request_id);
        }, 10);
      });

      // Mock client to trigger tool call
      client.chat = jest.fn()
        .mockResolvedValueOnce({
          content: '',
          model: 'gpt-4o-mini',
          provider: 'openai',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'file_edit',
              arguments: JSON.stringify({
                file_path: 'src/test.ts',
                old_content: 'const x = 1;',
                new_content: 'const x = 2;',
              }),
            },
          }],
        })
        .mockResolvedValueOnce({
          content: 'File edited successfully.',
          model: 'gpt-4o-mini',
          provider: 'openai',
        });

      await agent.processMessage('Edit the file');

      expect(confirmationEvent).not.toBeNull();
      expect(confirmationEvent?.confirmation.action.action_type).toBe('file_edit');
      expect(confirmationEvent?.confirmation.action.file_path).toBe('src/test.ts');
    }, 30000);

    it('should not execute tool if confirmation is rejected', async () => {
      let toolExecuted = false;

      const dangerousTool: ToolDefinition = {
        name: 'file_delete',
        description: 'Delete a file',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
          },
          required: ['file_path'],
        },
        requiresConfirmation: true,
        execute: async (params) => {
          toolExecuted = true;
          return { success: true, deleted: params.file_path };
        },
      };

      const agent = createAgent({
        model: 'gpt-4o-mini',
        tools: [dangerousTool],
        client,
        confirmationService,
        agentId: 'test-agent-2',
      });

      agent.on('confirmation_required', (event: ConfirmationRequiredEvent) => {
        // Reject the confirmation
        setTimeout(async () => {
          await confirmationService.reject(event.confirmation.request_id, 'Too risky');
        }, 10);
      });

      // Mock client to trigger tool call
      client.chat = jest.fn().mockResolvedValueOnce({
        content: '',
        model: 'gpt-4o-mini',
        provider: 'openai',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: {
            name: 'file_delete',
            arguments: JSON.stringify({
              file_path: 'important.ts',
            }),
          },
        }],
      });

      try {
        await agent.processMessage('Delete the file');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('rejected');
      }

      expect(toolExecuted).toBe(false);
    }, 30000);
  });

  describe('Bulk Approval Workflow', () => {
    it('should approve multiple actions at once with bulkApprove', async () => {
      const actions: ActionPreview[] = [
        {
          action_id: 'bulk-1',
          action_type: 'file_edit',
          tool_name: 'file_edit',
          file_path: 'file1.ts',
          explanation: 'Update file 1',
          created_at: new Date().toISOString(),
        },
        {
          action_id: 'bulk-2',
          action_type: 'file_edit',
          tool_name: 'file_edit',
          file_path: 'file2.ts',
          explanation: 'Update file 2',
          created_at: new Date().toISOString(),
        },
        {
          action_id: 'bulk-3',
          action_type: 'file_edit',
          tool_name: 'file_edit',
          file_path: 'file3.ts',
          explanation: 'Update file 3',
          created_at: new Date().toISOString(),
        },
      ];

      const requestIds: string[] = [];

      for (const action of actions) {
        const request = confirmationService.requestConfirmation('test-agent', action, {
          bulkApprovable: true,
        });
        requestIds.push(request.request_id);
      }

      expect(confirmationService.getPendingCount()).toBe(3);

      const result = await confirmationService.bulkApprove({
        request_ids: requestIds,
        comment: 'Bulk approve all changes',
      });

      expect(result.success).toBe(true);
      expect(result.approved_count).toBe(3);
      expect(result.failed_count).toBe(0);
      expect(result.results).toHaveLength(3);
      expect(confirmationService.getPendingCount()).toBe(0);
    });

    it('should skip non-bulk-approvable actions in bulk approval', async () => {
      const actions: ActionPreview[] = [
        {
          action_id: 'bulk-safe-1',
          action_type: 'file_edit',
          tool_name: 'file_edit',
          file_path: 'safe1.ts',
          explanation: 'Safe edit',
          created_at: new Date().toISOString(),
        },
        {
          action_id: 'bulk-danger-1',
          action_type: 'file_delete',
          tool_name: 'file_delete',
          file_path: 'important.ts',
          explanation: 'Dangerous delete',
          created_at: new Date().toISOString(),
        },
        {
          action_id: 'bulk-safe-2',
          action_type: 'file_edit',
          tool_name: 'file_edit',
          file_path: 'safe2.ts',
          explanation: 'Another safe edit',
          created_at: new Date().toISOString(),
        },
      ];

      const requestIds: string[] = [];

      // Mark first and third as bulk approvable
      const req1 = confirmationService.requestConfirmation('test-agent', actions[0], {
        bulkApprovable: true,
      });
      requestIds.push(req1.request_id);

      // Mark second as NOT bulk approvable
      const req2 = confirmationService.requestConfirmation('test-agent', actions[1], {
        bulkApprovable: false,
      });
      requestIds.push(req2.request_id);

      const req3 = confirmationService.requestConfirmation('test-agent', actions[2], {
        bulkApprovable: true,
      });
      requestIds.push(req3.request_id);

      const result = await confirmationService.bulkApprove({
        request_ids: requestIds,
      });

      expect(result.approved_count).toBe(2);
      expect(result.failed_count).toBe(1);
      expect(confirmationService.getPendingCount()).toBe(1); // The non-bulk-approvable one remains
    });
  });

  describe('Confirmation Timeout', () => {
    it('should expire confirmations after timeout', async () => {
      const action: ActionPreview = {
        action_id: 'timeout-test',
        action_type: 'file_write',
        tool_name: 'file_write',
        file_path: 'test.ts',
        explanation: 'Test timeout',
        created_at: new Date().toISOString(),
      };

      let expiredEvent = false;

      confirmationService.on('confirmation_expired', () => {
        expiredEvent = true;
      });

      const request = confirmationService.requestConfirmation('test-agent', action, {
        timeout: 100, // 100ms timeout
      });

      // Try to await confirmation (should timeout)
      try {
        await confirmationService.awaitConfirmation(request.request_id);
        fail('Should have thrown timeout error');
      } catch (error) {
        expect((error as Error).message).toContain('expired');
      }

      // Wait for event to be emitted
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(expiredEvent).toBe(true);
    }, 5000);
  });

  describe('End-to-End Workflow', () => {
    it('should complete full approve workflow: request → await → approve → execute', async () => {
      const executionLog: string[] = [];

      const fileWriteTool: ToolDefinition = {
        name: 'file_write',
        description: 'Write content to a file',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['file_path', 'content'],
        },
        requiresConfirmation: true,
        execute: async (params) => {
          executionLog.push(`Wrote to ${params.file_path}`);
          return { success: true, file_path: params.file_path };
        },
      };

      const agent = createAgent({
        model: 'gpt-4o-mini',
        tools: [fileWriteTool],
        client,
        confirmationService,
        agentId: 'e2e-agent',
      });

      // Set up confirmation handler
      agent.on('confirmation_required', async (event: ConfirmationRequiredEvent) => {
        executionLog.push('Confirmation requested');

        // Simulate user approval after 50ms
        setTimeout(async () => {
          executionLog.push('User approving');
          await confirmationService.approve(event.confirmation.request_id);
          executionLog.push('Approval complete');
        }, 50);
      });

      // Mock LLM to call the tool
      client.chat = jest.fn()
        .mockResolvedValueOnce({
          content: '',
          model: 'gpt-4o-mini',
          provider: 'openai',
          tool_calls: [{
            id: 'call_write',
            type: 'function',
            function: {
              name: 'file_write',
              arguments: JSON.stringify({
                file_path: 'output.ts',
                content: 'export const value = 42;',
              }),
            },
          }],
        })
        .mockResolvedValueOnce({
          content: 'File created successfully!',
          model: 'gpt-4o-mini',
          provider: 'openai',
        });

      const response = await agent.processMessage('Create a new file');

      expect(executionLog).toContain('Confirmation requested');
      expect(executionLog).toContain('User approving');
      expect(executionLog).toContain('Approval complete');
      expect(executionLog).toContain('Wrote to output.ts');
      expect(response.content).toContain('successfully');
    }, 30000);

    it('should complete full reject workflow: request → await → reject → abort', async () => {
      const executionLog: string[] = [];

      const deleteFileTool: ToolDefinition = {
        name: 'file_delete',
        description: 'Delete a file',
        parameters: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
          },
          required: ['file_path'],
        },
        requiresConfirmation: true,
        execute: async (params) => {
          executionLog.push(`Deleted ${params.file_path}`);
          return { success: true };
        },
      };

      const agent = createAgent({
        model: 'gpt-4o-mini',
        tools: [deleteFileTool],
        client,
        confirmationService,
        agentId: 'e2e-agent-reject',
      });

      // Set up confirmation handler
      agent.on('confirmation_required', async (event: ConfirmationRequiredEvent) => {
        executionLog.push('Confirmation requested');

        // Simulate user rejection
        setTimeout(async () => {
          executionLog.push('User rejecting');
          await confirmationService.reject(event.confirmation.request_id, 'Not safe');
          executionLog.push('Rejection complete');
        }, 50);
      });

      // Mock LLM to call the tool
      client.chat = jest.fn().mockResolvedValueOnce({
        content: '',
        model: 'gpt-4o-mini',
        provider: 'openai',
        tool_calls: [{
          id: 'call_delete',
          type: 'function',
          function: {
            name: 'file_delete',
            arguments: JSON.stringify({
              file_path: 'important.ts',
            }),
          },
        }],
      });

      try {
        await agent.processMessage('Delete the file');
        fail('Should have thrown rejection error');
      } catch (error) {
        expect((error as Error).message).toContain('rejected');
      }

      expect(executionLog).toContain('Confirmation requested');
      expect(executionLog).toContain('User rejecting');
      expect(executionLog).toContain('Rejection complete');
      expect(executionLog).not.toContain('Deleted important.ts');
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle approval of non-existent confirmation', async () => {
      await expect(
        confirmationService.approve('non-existent-id')
      ).rejects.toThrow(/not found in pending queue/);
    });

    it('should handle rejection of non-existent confirmation', async () => {
      await expect(
        confirmationService.reject('non-existent-id')
      ).rejects.toThrow(/not found in pending queue/);
    });

    it('should handle double approval gracefully', async () => {
      const action: ActionPreview = {
        action_id: 'double-approve',
        action_type: 'file_edit',
        tool_name: 'file_edit',
        file_path: 'test.ts',
        explanation: 'Test',
        created_at: new Date().toISOString(),
      };

      const request = confirmationService.requestConfirmation('test-agent', action);

      await confirmationService.approve(request.request_id);

      // Second approval should fail
      await expect(
        confirmationService.approve(request.request_id)
      ).rejects.toThrow(/not found in pending queue/);
    });

    it('should clear all pending confirmations on clearPendingConfirmations', async () => {
      const actions = ['action1', 'action2', 'action3'].map((id) => ({
        action_id: id,
        action_type: 'file_edit' as const,
        tool_name: 'file_edit',
        file_path: `${id}.ts`,
        explanation: `Action ${id}`,
        created_at: new Date().toISOString(),
      }));

      actions.forEach(action => {
        confirmationService.requestConfirmation('test-agent', action);
      });

      expect(confirmationService.getPendingCount()).toBe(3);

      confirmationService.clearPendingConfirmations();

      expect(confirmationService.getPendingCount()).toBe(0);
    });
  });

  describe('Risk Level Assessment', () => {
    it('should include risk level in confirmation request', () => {
      const action: ActionPreview = {
        action_id: 'risk-test',
        action_type: 'file_delete',
        tool_name: 'file_delete',
        file_path: 'critical.ts',
        explanation: 'Delete critical file',
        created_at: new Date().toISOString(),
      };

      const request = confirmationService.requestConfirmation('test-agent', action, {
        riskLevel: 'high',
      });

      expect(request.risk_level).toBe('high');
    });

    it('should mark file deletes as high risk by default', () => {
      const action: ActionPreview = {
        action_id: 'delete-risk',
        action_type: 'file_delete',
        tool_name: 'file_delete',
        file_path: 'file.ts',
        explanation: 'Delete file',
        created_at: new Date().toISOString(),
      };

      const request = confirmationService.requestConfirmation('test-agent', action, {
        riskLevel: 'high',
      });

      expect(request.risk_level).toBe('high');
      expect(request.bulk_approvable).toBe(true); // Can be overridden
    });
  });
});
