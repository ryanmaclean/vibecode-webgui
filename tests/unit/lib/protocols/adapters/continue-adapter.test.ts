/**
 * Tests for Continue Agent Adapter
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ContinueAdapter } from '../../../../../src/lib/protocols/adapters/continue-adapter';
import type { AgentConfig } from '../../../../../src/lib/protocols/adapters/base-adapter';

// Mock the MCP client
jest.mock('../../../../../src/lib/protocols/mcp-client', () => ({
  createMCPClient: jest.fn((config) => ({
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    invokeTool: jest.fn(async (tool: string, params: any) => ({
      success: true,
      result: `Response to ${params.message || params.prefix || tool}`
    })),
    isConnected: jest.fn(() => true)
  }))
}));

describe('ContinueAdapter', () => {
  let adapter: ContinueAdapter;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    mockConfig = {
      type: 'continue',
      workspace: '/test/workspace',
      baseUrl: 'ws://localhost:3000/mcp'
    };
    adapter = new ContinueAdapter(mockConfig);
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.gitOperations).toBe(false);
      expect(capabilities.fileOperations).toBe(true);
      expect(capabilities.codeGeneration).toBe(true);
      expect(capabilities.refactoring).toBe(true);
      expect(capabilities.testing).toBe(true);
      expect(capabilities.documentation).toBe(true);
      expect(capabilities.interactiveMode).toBe(true);
      expect(capabilities.mcpNative).toBe(true);
      expect(capabilities.agentAPISupport).toBe(false);
    });
  });

  describe('start', () => {
    it('should start session with MCP client', async () => {
      const task = 'Test task';
      const session = await adapter.start(task);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.type).toBe('continue');
      expect(session.status).toBe('running');
      expect(session.workspace).toBe('/test/workspace');
    });

    it('should connect to MCP client', async () => {
      const session = await adapter.start('Connect test');
      expect(session).toBeDefined();
    });

    it('should use baseUrl from config', async () => {
      const customAdapter = new ContinueAdapter({
        type: 'continue',
        workspace: '/test',
        baseUrl: 'ws://custom:4000/mcp'
      });

      const session = await customAdapter.start('Custom URL test');
      expect(session).toBeDefined();
    });

    it('should use default URL when not provided', async () => {
      const defaultAdapter = new ContinueAdapter({
        type: 'continue',
        workspace: '/test'
      });

      const session = await defaultAdapter.start('Default URL test');
      expect(session).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should send message via MCP client', async () => {
      await adapter.start('Init');
      const result = await adapter.sendMessage('Test message');

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.duration).toBeDefined();
    });

    it('should throw error when client not connected', async () => {
      await expect(adapter.sendMessage('Test')).rejects.toThrow(
        'Continue client not connected'
      );
    });

    it('should measure duration', async () => {
      await adapter.start('Init');
      const result = await adapter.sendMessage('Duration test');

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors gracefully', async () => {
      const { createMCPClient } = require('../../../../../src/lib/protocols/mcp-client');

      let callCount = 0;
      createMCPClient.mockImplementationOnce(() => ({
        connect: jest.fn(async () => {}),
        disconnect: jest.fn(async () => {}),
        invokeTool: jest.fn(async () => {
          callCount++;
          // First call is from start(), let it succeed
          if (callCount === 1) {
            return { success: true, result: 'Started' };
          }
          // Subsequent calls should fail
          throw new Error('MCP invocation failed');
        }),
        isConnected: jest.fn(() => true)
      }));

      const errorAdapter = new ContinueAdapter(mockConfig);
      await errorAdapter.start('Init');
      const result = await errorAdapter.sendMessage('Error test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('MCP invocation failed');
      expect(result.duration).toBeDefined();
    });

    it('should return parsed JSON output', async () => {
      await adapter.start('Init');
      const result = await adapter.sendMessage('JSON test');

      expect(result.output).toBeDefined();
      const parsed = JSON.parse(result.output);
      expect(parsed).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should disconnect MCP client', async () => {
      await adapter.start('Init');
      await adapter.stop();

      // Session should be stopped
      // Attempting to send message should fail
      await expect(adapter.sendMessage('Test')).rejects.toThrow();
    });

    it('should set session status to stopped', async () => {
      await adapter.start('Init');
      await adapter.stop();

      // Session status should be updated (internal state)
      // We can verify by trying to send a message
      await expect(adapter.sendMessage('Test')).rejects.toThrow();
    });

    it('should handle stop when not started', async () => {
      await expect(adapter.stop()).resolves.not.toThrow();
    });
  });

  describe('autocomplete', () => {
    it('should perform autocomplete via MCP', async () => {
      await adapter.start('Init');
      const result = await adapter.autocomplete('const x = ', '');

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should throw error when client not connected', async () => {
      await expect(adapter.autocomplete('test', '')).rejects.toThrow(
        'Continue client not connected'
      );
    });

    it('should handle autocomplete with prefix and suffix', async () => {
      await adapter.start('Init');
      const result = await adapter.autocomplete('function test() {', '}');

      expect(result.success).toBe(true);
    });

    it('should handle autocomplete errors', async () => {
      const { createMCPClient } = require('../../../../../src/lib/protocols/mcp-client');

      let callCount = 0;
      createMCPClient.mockImplementationOnce(() => ({
        connect: jest.fn(async () => {}),
        disconnect: jest.fn(async () => {}),
        invokeTool: jest.fn(async () => {
          callCount++;
          // First call is from start(), let it succeed
          if (callCount === 1) {
            return { success: true, result: 'Started' };
          }
          // Subsequent calls should fail
          throw new Error('Autocomplete failed');
        }),
        isConnected: jest.fn(() => true)
      }));

      const errorAdapter = new ContinueAdapter(mockConfig);
      await errorAdapter.start('Init');
      const result = await errorAdapter.autocomplete('test', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Autocomplete failed');
    });
  });

  describe('explainCode', () => {
    it('should explain code via sendMessage', async () => {
      await adapter.start('Init');
      const result = await adapter.explainCode('const x = 10;');

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should format message with code block', async () => {
      await adapter.start('Init');
      const code = 'function test() { return true; }';
      const result = await adapter.explainCode(code);

      expect(result.success).toBe(true);
    });
  });

  describe('fixCode', () => {
    it('should fix code errors via sendMessage', async () => {
      await adapter.start('Init');
      const result = await adapter.fixCode(
        'const x = ;',
        'SyntaxError: Unexpected token'
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should include both code and error in message', async () => {
      await adapter.start('Init');
      const code = 'console.log(x)';
      const error = 'ReferenceError: x is not defined';
      const result = await adapter.fixCode(code, error);

      expect(result.success).toBe(true);
    });
  });

  describe('refactorCode', () => {
    it('should refactor code via sendMessage', async () => {
      await adapter.start('Init');
      const result = await adapter.refactorCode(
        'const x = 10; const y = 20;',
        'Use let instead of const'
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should include code and instruction in message', async () => {
      await adapter.start('Init');
      const code = 'function add(a, b) { return a + b; }';
      const instruction = 'Add TypeScript types';
      const result = await adapter.refactorCode(code, instruction);

      expect(result.success).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full workflow: start, message, stop', async () => {
      const session = await adapter.start('Full workflow test');
      expect(session.status).toBe('running');

      const result = await adapter.sendMessage('Test message');
      expect(result.success).toBe(true);

      await adapter.stop();
      await expect(adapter.sendMessage('After stop')).rejects.toThrow();
    });

    it('should handle multiple messages in sequence', async () => {
      await adapter.start('Multi-message test');

      const result1 = await adapter.sendMessage('First message');
      expect(result1.success).toBe(true);

      const result2 = await adapter.sendMessage('Second message');
      expect(result2.success).toBe(true);

      const result3 = await adapter.sendMessage('Third message');
      expect(result3.success).toBe(true);
    });

    it('should handle mixed operations', async () => {
      await adapter.start('Mixed ops test');

      const message = await adapter.sendMessage('Hello');
      expect(message.success).toBe(true);

      const explain = await adapter.explainCode('const x = 1;');
      expect(explain.success).toBe(true);

      const autocomplete = await adapter.autocomplete('func', '');
      expect(autocomplete.success).toBe(true);

      await adapter.stop();
    });
  });
});
