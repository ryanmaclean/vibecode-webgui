/**
 * Tests for Plugin Sandbox
 * @jest-environment node
 */

import {
  PluginSandbox,
  createPluginSandbox,
  executeInSandbox,
} from '@/lib/plugins/plugin-sandbox';
import { PluginPermission, PluginContext } from '@/types/plugin';

// Mock PluginContext for testing
const createMockContext = (pluginId: string, permissions: PluginPermission[] = []): PluginContext => ({
  pluginId,
  pluginDir: `/tmp/test-plugins/${pluginId}`,
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  getConfig: jest.fn(),
  setConfig: jest.fn(),
  permissions,
});

describe('Plugin Sandbox', () => {
  describe('PluginSandbox class', () => {
    it('should execute code in isolated context', async () => {
      const context = createMockContext('test-plugin');
      const sandbox = new PluginSandbox(context);
      const result = await sandbox.execute('1 + 1');
      expect(result.success).toBe(true);
      expect(result.result).toBe(2);
    });

    it('should restrict filesystem access without permission', async () => {
      const context = createMockContext('test-plugin', []); // No permissions
      const sandbox = new PluginSandbox(context);

      // Filesystem should be undefined without permission
      const result = await sandbox.execute('typeof fs');
      expect(result.success).toBe(true);
      expect(result.result).toBe('undefined');
    });

    it('should allow filesystem access with permission', async () => {
      const context = createMockContext('test-plugin', ['filesystem:read']);
      const sandbox = new PluginSandbox(context);

      const result = await sandbox.execute('typeof fs');
      expect(result.success).toBe(true);
      expect(result.result).toBe('object');
    });

    it('should restrict network access without permission', async () => {
      const context = createMockContext('test-plugin', []);
      const sandbox = new PluginSandbox(context);

      const result = await sandbox.execute('typeof fetch');
      expect(result.success).toBe(true);
      expect(result.result).toBe('undefined');
    });

    it('should timeout long-running code', async () => {
      const context = createMockContext('test-plugin');
      const sandbox = new PluginSandbox(context, { timeout: 100 });

      const result = await sandbox.execute('while(true) {}');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide safe console methods', async () => {
      const context = createMockContext('test-plugin');
      const sandbox = new PluginSandbox(context);

      const result = await sandbox.execute(`
        console.log('test');
        'ok';
      `);
      expect(result.success).toBe(true);
      expect(result.result).toBe('ok');
    });

    it('should block dangerous require() calls', async () => {
      const context = createMockContext('test-plugin');
      const sandbox = new PluginSandbox(context);

      const result = await sandbox.execute('require("child_process")');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should prevent access to process object', async () => {
      const context = createMockContext('test-plugin');
      const sandbox = new PluginSandbox(context);

      const result = await sandbox.execute('typeof process');
      expect(result.success).toBe(true);
      expect(result.result).toBe('undefined');
    });

    it('should handle sandbox errors gracefully', async () => {
      const context = createMockContext('test-plugin');
      const sandbox = new PluginSandbox(context);

      const result = await sandbox.execute('throw new Error("test error")');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect((result.error as Error).message).toBe('test error');
    });

    it('should track memory usage', async () => {
      const context = createMockContext('test-plugin');
      const sandbox = new PluginSandbox(context, { memoryLimit: 128 });

      // Memory tracking should be enabled
      const result = await sandbox.execute('"ok"');
      expect(result.success).toBe(true);
      expect(result.result).toBe('ok');
      expect(result.memoryUsed).toBeDefined();
    });
  });

  describe('createPluginSandbox', () => {
    it('should create a new sandbox instance', () => {
      const context = createMockContext('test-plugin');
      const sandbox = createPluginSandbox(context);
      expect(sandbox).toBeInstanceOf(PluginSandbox);
    });

    it('should create sandbox with permissions', () => {
      const context = createMockContext('test-plugin', ['filesystem:read']);
      const sandbox = createPluginSandbox(context);
      expect(sandbox).toBeInstanceOf(PluginSandbox);
    });

    it('should create sandbox with config', () => {
      const context = createMockContext('test-plugin');
      const sandbox = createPluginSandbox(context, {
        timeout: 5000,
        memoryLimit: 256,
      });
      expect(sandbox).toBeInstanceOf(PluginSandbox);
    });
  });

  describe('executeInSandbox', () => {
    it('should execute code and return result', async () => {
      const context = createMockContext('test-plugin');
      const result = await executeInSandbox('42', context);
      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
    });

    it('should handle execution errors', async () => {
      const context = createMockContext('test-plugin');
      const result = await executeInSandbox('throw new Error("test")', context);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect permissions', async () => {
      const context = createMockContext('test-plugin', ['filesystem:read']);
      const result = await executeInSandbox(
        'typeof fs',
        context
      );
      expect(result.success).toBe(true);
      expect(result.result).toBe('object');
    });
  });
});
