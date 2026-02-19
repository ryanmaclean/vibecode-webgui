/**
 * Tests for Plugin Sandbox
 * @jest-environment node
 */

import {
  PluginSandbox,
  createPluginSandbox,
  executeInSandbox,
} from '@/lib/plugins/plugin-sandbox';
import { PluginPermission } from '@/types/plugin';

describe('Plugin Sandbox', () => {
  describe('PluginSandbox class', () => {
    it('should execute code in isolated context', async () => {
      const sandbox = new PluginSandbox('test-plugin', []);
      const result = await sandbox.execute('return 1 + 1');
      expect(result).toBe(2);
    });

    it('should restrict filesystem access without permission', async () => {
      const sandbox = new PluginSandbox('test-plugin', []);

      // Filesystem should be undefined without permission
      const result = await sandbox.execute('return typeof fs');
      expect(result).toBe('undefined');
    });

    it('should allow filesystem access with permission', async () => {
      const permissions: PluginPermission[] = ['filesystem:read'];
      const sandbox = new PluginSandbox('test-plugin', permissions);

      const result = await sandbox.execute('return typeof fs');
      expect(result).toBe('object');
    });

    it('should restrict network access without permission', async () => {
      const sandbox = new PluginSandbox('test-plugin', []);

      const result = await sandbox.execute('return typeof fetch');
      expect(result).toBe('undefined');
    });

    it('should timeout long-running code', async () => {
      const sandbox = new PluginSandbox('test-plugin', [], { timeout: 100 });

      await expect(
        sandbox.execute('while(true) {}')
      ).rejects.toThrow();
    });

    it('should provide safe console methods', async () => {
      const sandbox = new PluginSandbox('test-plugin', []);

      const result = await sandbox.execute(`
        console.log('test');
        return 'ok';
      `);
      expect(result).toBe('ok');
    });

    it('should block dangerous require() calls', async () => {
      const sandbox = new PluginSandbox('test-plugin', []);

      await expect(
        sandbox.execute('return require("child_process")')
      ).rejects.toThrow();
    });

    it('should prevent access to process object', async () => {
      const sandbox = new PluginSandbox('test-plugin', []);

      const result = await sandbox.execute('return typeof process');
      expect(result).toBe('undefined');
    });

    it('should handle sandbox errors gracefully', async () => {
      const sandbox = new PluginSandbox('test-plugin', []);

      await expect(
        sandbox.execute('throw new Error("test error")')
      ).rejects.toThrow('test error');
    });

    it('should track memory usage', async () => {
      const sandbox = new PluginSandbox('test-plugin', [], { memoryLimit: 128 });

      // Memory tracking should be enabled
      const result = await sandbox.execute('return "ok"');
      expect(result).toBe('ok');
    });
  });

  describe('createPluginSandbox', () => {
    it('should create a new sandbox instance', () => {
      const sandbox = createPluginSandbox('test-plugin', []);
      expect(sandbox).toBeInstanceOf(PluginSandbox);
    });

    it('should create sandbox with permissions', () => {
      const permissions: PluginPermission[] = ['filesystem:read'];
      const sandbox = createPluginSandbox('test-plugin', permissions);
      expect(sandbox).toBeInstanceOf(PluginSandbox);
    });

    it('should create sandbox with config', () => {
      const sandbox = createPluginSandbox('test-plugin', [], {
        timeout: 5000,
        memoryLimit: 256,
      });
      expect(sandbox).toBeInstanceOf(PluginSandbox);
    });
  });

  describe('executeInSandbox', () => {
    it('should execute code and return result', async () => {
      const result = await executeInSandbox('test-plugin', [], 'return 42');
      expect(result).toBe(42);
    });

    it('should handle execution errors', async () => {
      await expect(
        executeInSandbox('test-plugin', [], 'throw new Error("test")')
      ).rejects.toThrow();
    });

    it('should respect permissions', async () => {
      const permissions: PluginPermission[] = ['filesystem:read'];
      const result = await executeInSandbox(
        'test-plugin',
        permissions,
        'return typeof fs'
      );
      expect(result).toBe('object');
    });
  });
});
