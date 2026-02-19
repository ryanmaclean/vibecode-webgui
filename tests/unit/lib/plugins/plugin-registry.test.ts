/**
 * Tests for Plugin Registry
 * @jest-environment node
 */

import {
  Plugin,
  PluginManifest,
  PluginStatus,
  registerPlugin,
  getPlugin,
  getAllPlugins,
  getPluginsByStatus,
  getActivePlugins,
  updatePluginStatus,
  unregisterPlugin,
  hasPlugin,
  getPluginsByCapability,
  clearRegistry,
  getPluginCount,
} from '@/lib/plugins/plugin-registry';

describe('Plugin Registry', () => {
  // Helper to create test plugin with manifest
  function createTestPlugin(
    id: string = 'test-plugin',
    overrides?: Partial<Plugin>
  ): Plugin {
    const manifest: PluginManifest = {
      id: id,
      name: `Test Plugin ${id}`,
      version: '1.0.0',
      description: 'Test plugin for unit testing',
      author: {
        name: 'Test Author',
        email: 'test@example.com'
      },
      type: 'other',
      main: 'index.js',
      permissions: []
    };

    return {
      manifest: manifest,
      capabilities: {
        providesAIModel: false,
        providesIntegration: false,
        providesCommands: true,
        providesUIComponents: false,
        providesCodeActions: false,
        providesWorkflows: false,
        providesFormatters: false,
        providesLinters: false
      },
      status: 'installed' as PluginStatus,
      installedAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides
    };
  }

  // Legacy helper for backwards compatibility
  const createMockPlugin = createTestPlugin;

  beforeEach(() => {
    // Clear registry before each test
    clearRegistry();
  });

  describe('registerPlugin', () => {
    it('should register a new plugin', () => {
      const plugin = createMockPlugin();
      registerPlugin(plugin);

      expect(hasPlugin(plugin.manifest.id)).toBe(true);
      expect(getPlugin(plugin.manifest.id)).toEqual(plugin);
    });

    it('should throw error when registering duplicate plugin', () => {
      const plugin = createMockPlugin();
      registerPlugin(plugin);

      expect(() => registerPlugin(plugin)).toThrow(`Plugin with id '${plugin.manifest.id}' is already registered`);
    });

    it('should allow registering multiple different plugins', () => {
      const plugin1 = createTestPlugin('plugin-1');
      const plugin2 = createTestPlugin('plugin-2');

      registerPlugin(plugin1);
      registerPlugin(plugin2);

      expect(getPluginCount()).toBe(2);
      expect(hasPlugin('plugin-1')).toBe(true);
      expect(hasPlugin('plugin-2')).toBe(true);
    });
  });

  describe('getPlugin', () => {
    it('should retrieve a plugin by ID', () => {
      const plugin = createMockPlugin();
      registerPlugin(plugin);

      const retrieved = getPlugin(plugin.manifest.id);
      expect(retrieved).toEqual(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('getAllPlugins', () => {
    it('should list all plugins', () => {
      const plugin1 = createTestPlugin('plugin-1');
      const plugin2 = createTestPlugin('plugin-2');

      registerPlugin(plugin1);
      registerPlugin(plugin2);

      const all = getAllPlugins();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual(plugin1);
      expect(all).toContainEqual(plugin2);
    });

    it('should return empty array when no plugins', () => {
      expect(getAllPlugins()).toEqual([]);
    });
  });

  describe('getPluginsByStatus', () => {
    it('should filter plugins by status', () => {
      const installedPlugin = createTestPlugin('installed', { status: 'installed' });
      const activePlugin = createTestPlugin('active', { status: 'active' });
      const disabledPlugin = createTestPlugin('disabled', { status: 'disabled' });

      registerPlugin(installedPlugin);
      registerPlugin(activePlugin);
      registerPlugin(disabledPlugin);

      const installed = getPluginsByStatus('installed');
      expect(installed).toHaveLength(1);
      expect(installed[0].manifest.id).toBe('installed');

      const active = getPluginsByStatus('active');
      expect(active).toHaveLength(1);
      expect(active[0].manifest.id).toBe('active');

      const disabled = getPluginsByStatus('disabled');
      expect(disabled).toHaveLength(1);
      expect(disabled[0].manifest.id).toBe('disabled');
    });

    it('should return empty array when no plugins match status', () => {
      const plugin = createMockPlugin({ status: 'installed' });
      registerPlugin(plugin);

      expect(getPluginsByStatus('error')).toEqual([]);
    });
  });

  describe('getActivePlugins', () => {
    it('should return only active plugins', () => {
      const activePlugin = createTestPlugin('active', { status: 'active' });
      const installedPlugin = createTestPlugin('installed', { status: 'installed' });

      registerPlugin(activePlugin);
      registerPlugin(installedPlugin);

      const active = getActivePlugins();
      expect(active).toHaveLength(1);
      expect(active[0].manifest.id).toBe('active');
    });
  });

  describe('updatePluginStatus', () => {
    it('should update plugin status', () => {
      const plugin = createMockPlugin({ status: 'installed' });
      registerPlugin(plugin);

      const beforeUpdate = plugin.updatedAt;

      updatePluginStatus(plugin.manifest.id, 'active');

      const updated = getPlugin(plugin.manifest.id);
      expect(updated?.status).toBe('active');
      expect(updated?.updatedAt).not.toEqual(beforeUpdate);
    });

    it('should throw error when updating non-existent plugin', () => {
      expect(() => updatePluginStatus('non-existent', 'active')).toThrow(`Plugin with id 'non-existent' not found`);
    });

    it('should allow transitioning between all statuses', () => {
      const plugin = createMockPlugin({ status: 'installed' });
      registerPlugin(plugin);

      const statuses: PluginStatus[] = ['active', 'disabled', 'error', 'installed'];

      statuses.forEach(status => {
        updatePluginStatus(plugin.manifest.id, status);
        expect(getPlugin(plugin.manifest.id)?.status).toBe(status);
      });
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister a plugin', () => {
      const plugin = createMockPlugin();
      registerPlugin(plugin);

      const result = unregisterPlugin(plugin.manifest.id);

      expect(result).toBe(true);
      expect(hasPlugin(plugin.manifest.id)).toBe(false);
      expect(getPlugin(plugin.manifest.id)).toBeUndefined();
    });

    it('should return false when unregistering non-existent plugin', () => {
      const result = unregisterPlugin('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('hasPlugin', () => {
    it('should return true for registered plugin', () => {
      const plugin = createMockPlugin();
      registerPlugin(plugin);

      expect(hasPlugin(plugin.manifest.id)).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(hasPlugin('non-existent')).toBe(false);
    });
  });

  describe('getPluginsByCapability', () => {
    it('should filter by capability', () => {
      const aiModelPlugin = createTestPlugin('ai-plugin', {
        capabilities: {
          providesAIModel: true,
          providesIntegration: false,
          providesWorkflows: false,
          providesCommands: false,
          providesUIComponents: false,
          providesCodeActions: false,
          providesFormatters: false,
          providesLinters: false
        },
      });

      const workflowPlugin = createTestPlugin('workflow-plugin', {
        capabilities: {
          providesAIModel: false,
          providesIntegration: false,
          providesWorkflows: true,
          providesCommands: false,
          providesUIComponents: false,
          providesCodeActions: false,
          providesFormatters: false,
          providesLinters: false
        },
      });

      registerPlugin(aiModelPlugin);
      registerPlugin(workflowPlugin);

      const aiPlugins = getPluginsByCapability('providesAIModel');
      expect(aiPlugins).toHaveLength(1);
      expect(aiPlugins[0].manifest.id).toBe('ai-plugin');

      const workflowPlugins = getPluginsByCapability('providesWorkflows');
      expect(workflowPlugins).toHaveLength(1);
      expect(workflowPlugins[0].manifest.id).toBe('workflow-plugin');
    });

    it('should return empty array when no plugins have capability', () => {
      const plugin = createTestPlugin('test-plugin', {
        capabilities: {
          providesAIModel: false,
          providesIntegration: false,
          providesWorkflows: false,
          providesCommands: false,
          providesUIComponents: false,
          providesCodeActions: false,
          providesFormatters: false,
          providesLinters: false
        },
      });

      registerPlugin(plugin);

      expect(getPluginsByCapability('providesAIModel')).toEqual([]);
    });
  });

  describe('clearRegistry', () => {
    it('should clear all plugins from registry', () => {
      const plugin1 = createTestPlugin('plugin-1');
      const plugin2 = createTestPlugin('plugin-2');

      registerPlugin(plugin1);
      registerPlugin(plugin2);

      expect(getPluginCount()).toBe(2);

      clearRegistry();

      expect(getPluginCount()).toBe(0);
      expect(getAllPlugins()).toEqual([]);
    });
  });

  describe('getPluginCount', () => {
    it('should return correct plugin count', () => {
      expect(getPluginCount()).toBe(0);

      registerPlugin(createTestPlugin('plugin-1'));
      expect(getPluginCount()).toBe(1);

      registerPlugin(createTestPlugin('plugin-2'));
      expect(getPluginCount()).toBe(2);

      unregisterPlugin('plugin-1');
      expect(getPluginCount()).toBe(1);
    });
  });
});
