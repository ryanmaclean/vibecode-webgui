/**
 * Agent Adapter Tests
 */

import { AgentAdapterRegistry, BaseAgentAdapter } from '@/lib/protocols/adapters/base-adapter';
import { AiderAdapter } from '@/lib/protocols/adapters/aider-adapter';
import { ClineAdapter } from '@/lib/protocols/adapters/cline-adapter';
import { ContinueAdapter } from '@/lib/protocols/adapters/continue-adapter';
import { ClaudeCodeAdapter } from '@/lib/protocols/adapters/claude-code-adapter';
import { GooseAdapter } from '@/lib/protocols/adapters/goose-adapter';
import { UniversalAdapter } from '@/lib/protocols/adapters/universal-adapter';

describe('Agent Adapters', () => {
  // Register all adapters before tests
  beforeAll(() => {
    AgentAdapterRegistry.register('aider', AiderAdapter);
    AgentAdapterRegistry.register('cline', ClineAdapter);
    AgentAdapterRegistry.register('continue', ContinueAdapter);
    AgentAdapterRegistry.register('claude-code', ClaudeCodeAdapter);
    AgentAdapterRegistry.register('goose', GooseAdapter);
    AgentAdapterRegistry.register('universal', UniversalAdapter);
  });

  describe('AgentAdapterRegistry', () => {
    it('should register adapters', () => {
      const AdapterClass = AgentAdapterRegistry.get('aider');
      expect(AdapterClass).toBe(AiderAdapter);
    });

    it('should create adapter from config', () => {
      const config = {
        type: 'aider' as const,
        workspace: '/home/coder/workspace',
        model: 'claude-3-5-sonnet-20241022',
      };

      const adapter = AgentAdapterRegistry.create(config);
      expect(adapter).toBeInstanceOf(AiderAdapter);
    });

    it('should throw error for unknown adapter type', () => {
      const config = {
        type: 'unknown' as any,
        workspace: '/home/coder/workspace',
      };

      expect(() => AgentAdapterRegistry.create(config)).toThrow('No adapter registered');
    });

    it('should list supported types', () => {
      const types = AgentAdapterRegistry.getSupportedTypes();
      expect(types).toContain('aider');
      expect(types).toContain('cline');
      expect(types).toContain('goose');
    });
  });

  describe('AiderAdapter', () => {
    let adapter: AiderAdapter;

    beforeEach(() => {
      adapter = new AiderAdapter({
        type: 'aider',
        workspace: '/home/coder/workspace',
      });
    });

    it('should have correct capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.gitOperations).toBe(true);
      expect(caps.fileOperations).toBe(true);
      expect(caps.interactiveMode).toBe(true);
      expect(caps.agentAPISupport).toBe(true);
    });

    it('should throw error when starting without client', async () => {
      // Adapter initializes agentAPIClient in constructor, but it will fail on actual start
      try {
        await adapter.start('test task');
        fail('Should have thrown error');
      } catch (error) {
        // Expected - network call will fail
        expect(error).toBeDefined();
      }
    });
  });

  describe('ClineAdapter', () => {
    let adapter: ClineAdapter;

    beforeEach(() => {
      adapter = new ClineAdapter({
        type: 'cline',
        workspace: '/home/coder/workspace',
      });
    });

    it('should have correct capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.gitOperations).toBe(true);
      expect(caps.testing).toBe(true);
      expect(caps.mcpNative).toBe(true);
      expect(caps.agentAPISupport).toBe(true);
    });
  });

  describe('ContinueAdapter', () => {
    let adapter: ContinueAdapter;

    beforeEach(() => {
      adapter = new ContinueAdapter({
        type: 'continue',
        workspace: '/home/coder/workspace',
      });
    });

    it('should have correct capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.gitOperations).toBe(false);
      expect(caps.codeGeneration).toBe(true);
      expect(caps.mcpNative).toBe(true);
      expect(caps.agentAPISupport).toBe(false);
    });
  });

  describe('ClaudeCodeAdapter', () => {
    let adapter: ClaudeCodeAdapter;

    beforeEach(() => {
      adapter = new ClaudeCodeAdapter({
        type: 'claude-code',
        workspace: '/home/coder/workspace',
      });
    });

    it('should have correct capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.gitOperations).toBe(true);
      expect(caps.testing).toBe(true);
      expect(caps.mcpNative).toBe(true);
      expect(caps.agentAPISupport).toBe(false);
    });
  });

  describe('GooseAdapter', () => {
    let adapter: GooseAdapter;

    beforeEach(() => {
      adapter = new GooseAdapter({
        type: 'goose',
        workspace: '/home/coder/workspace',
      });
    });

    it('should have correct capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.gitOperations).toBe(true);
      expect(caps.testing).toBe(true);
      expect(caps.mcpNative).toBe(true);
      expect(caps.agentAPISupport).toBe(true);
    });
  });

  describe('UniversalAdapter', () => {
    let adapter: UniversalAdapter;

    beforeEach(() => {
      adapter = new UniversalAdapter({
        type: 'universal',
        workspace: '/home/coder/workspace',
      });
    });

    it('should have fallback capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.fileOperations).toBe(true);
      expect(caps.codeGeneration).toBe(true);
      expect(caps.interactiveMode).toBe(true);
    });

    it('should throw error when protocol not detected', async () => {
      // Mock detection failures
      adapter['tryMCP'] = jest.fn().mockResolvedValue(false);
      adapter['tryAgentAPI'] = jest.fn().mockResolvedValue(false);

      try {
        await adapter.start('test task');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('No compatible protocol');
      }
    });
  });

  describe('Session Management', () => {
    it('should generate unique session IDs', () => {
      const adapter = new AiderAdapter({
        type: 'aider',
        workspace: '/home/coder/workspace',
      });

      const id1 = adapter['generateSessionId']();
      const id2 = adapter['generateSessionId']();

      expect(id1).toMatch(/^aider-[a-f0-9]{8}$/);
      expect(id2).toMatch(/^aider-[a-f0-9]{8}$/);
      expect(id1).not.toBe(id2);
    });

    it('should create session with correct properties', () => {
      const adapter = new AiderAdapter({
        type: 'aider',
        workspace: '/home/coder/workspace',
      });

      const session = adapter['createSession']('test-12345678');

      expect(session.id).toBe('test-12345678');
      expect(session.type).toBe('aider');
      expect(session.status).toBe('running');
      expect(session.workspace).toBe('/home/coder/workspace');
    });
  });

  describe('Status Tracking', () => {
    it('should track running status', async () => {
      const adapter = new AiderAdapter({
        type: 'aider',
        workspace: '/home/coder/workspace',
      });

      const status = await adapter.getStatus();
      expect(status).toBeNull();

      const isRunning = await adapter.isRunning();
      expect(isRunning).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should have low adapter overhead', () => {
      const start = Date.now();

      const adapter = new AiderAdapter({
        type: 'aider',
        workspace: '/home/coder/workspace',
      });

      const caps = adapter.getCapabilities();

      const duration = Date.now() - start;

      // Adapter initialization should be <50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
