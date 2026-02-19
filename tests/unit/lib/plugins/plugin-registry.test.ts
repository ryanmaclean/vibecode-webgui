/**
 * Tests for Plugin Registry
 * @jest-environment node
 */

import {
  Plugin,
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
  // Test data
  const createMockPlugin = (overrides: Partial<Plugin> = {}): Plugin => ({
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    metadata: {
      license: 'MIT',
      keywords: ['test'],
    },
    capabilities: {
      aiModels: false,
      integrations: false,
      workflows: false,
      commands: true,
      ui: false,
    },
    status: 'installed' as PluginStatus,
    installedAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    // Clear registry before each test
    clearRegistry();
  });

  describe('registerPlugin', () => {
    it('should register a new plugin', () => {
      const plugin = createMockPlugin();
      registerPlugin(plugin);

      expect(hasPlugin(plugin.id)).toBe(true);
      expect(getPlugin(plugin.id)).toEqual(plugin);
    });

    it('should throw error when registering duplicate plugin', () => {
      const plugin = createMockPlugin();
      registerPlugin(plugin);

      expect(() => registerPlugin(plugin)).toThrow(`Plugin with id '${plugin.id}' is already registered`);
    });

    it('should allow registering multiple different plugins', () => {
      const plugin1 = createMockPlugin({ id: 'plugin-1', name: 'Plugin 1' });
      const plugin2 = createMockPlugin({ id: 'plugin-2', name: 'Plugin 2' });

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

      const retrieved = getPlugin(plugin.id);
      expect(retrieved).toEqual(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('getAllPlugins', () => {
    it('should list all plugins', () => {
      const plugin1 = createMockPlugin({ id: 'plugin-1' });
      const plugin2 = createMockPlugin({ id: 'plugin-2' });

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
      const installedPlugin = createMockPlugin({ id: 'installed', status: 'installed' });
      const activePlugin = createMockPlugin({ id: 'active', status: 'active' });
      const disabledPlugin = createMockPlugin({ id: 'disabled', status: 'disabled' });

      registerPlugin(installedPlugin);
      registerPlugin(activePlugin);
      registerPlugin(disabledPlugin);

      const installed = getPluginsByStatus('installed');
      expect(installed).toHaveLength(1);
      expect(installed[0].id).toBe('installed');

      const active = getPluginsByStatus('active');
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');

      const disabled = getPluginsByStatus('disabled');
      expect(disabled).toHaveLength(1);
      expect(disabled[0].id).toBe('disabled');
    });

    it('should return empty array when no plugins match status', () => {
      const plugin = createMockPlugin({ status: 'installed' });
      registerPlugin(plugin);

      expect(getPluginsByStatus('error')).toEqual([]);
    });
  });

  describe('getActivePlugins', () => {
    it('should return only active plugins', () => {
      const activePlugin = createMockPlugin({ id: 'active', status: 'active' });
      const installedPlugin = createMockPlugin({ id: 'installed', status: 'installed' });

      registerPlugin(activePlugin);
      registerPlugin(installedPlugin);

      const active = getActivePlugins();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe('active');
    });
  });

  describe('updatePluginStatus', () => {
    it('should update plugin status', () => {
      const plugin = createMockPlugin({ status: 'installed' });
      registerPlugin(plugin);

      const beforeUpdate = plugin.updatedAt;

      updatePluginStatus(plugin.id, 'active');

      const updated = getPlugin(plugin.id);
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
        updatePluginStatus(plugin.id, status);
        expect(getPlugin(plugin.id)?.status).toBe(status);
      });
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister a plugin', () => {
      const plugin = createMockPlugin();
      registerPlugin(plugin);

      const result = unregisterPlugin(plugin.id);

      expect(result).toBe(true);
      expect(hasPlugin(plugin.id)).toBe(false);
      expect(getPlugin(plugin.id)).toBeUndefined();
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

      expect(hasPlugin(plugin.id)).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      expect(hasPlugin('non-existent')).toBe(false);
    });
  });

  describe('getPluginsByCapability', () => {
    it('should filter by capability', () => {
      const aiModelPlugin = createMockPlugin({
        id: 'ai-plugin',
        capabilities: {
          aiModels: true,
          integrations: false,
          workflows: false,
          commands: false,
          ui: false,
        },
      });

      const workflowPlugin = createMockPlugin({
        id: 'workflow-plugin',
        capabilities: {
          aiModels: false,
          integrations: false,
          workflows: true,
          commands: false,
          ui: false,
        },
      });

      registerPlugin(aiModelPlugin);
      registerPlugin(workflowPlugin);

      const aiPlugins = getPluginsByCapability('aiModels');
      expect(aiPlugins).toHaveLength(1);
      expect(aiPlugins[0].id).toBe('ai-plugin');

      const workflowPlugins = getPluginsByCapability('workflows');
      expect(workflowPlugins).toHaveLength(1);
      expect(workflowPlugins[0].id).toBe('workflow-plugin');
    });

    it('should return empty array when no plugins have capability', () => {
      const plugin = createMockPlugin({
        capabilities: {
          aiModels: false,
          integrations: false,
          workflows: false,
          commands: false,
          ui: false,
        },
      });

      registerPlugin(plugin);

      expect(getPluginsByCapability('aiModels')).toEqual([]);
    });
  });

  describe('clearRegistry', () => {
    it('should clear all plugins from registry', () => {
      const plugin1 = createMockPlugin({ id: 'plugin-1' });
      const plugin2 = createMockPlugin({ id: 'plugin-2' });

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

      registerPlugin(createMockPlugin({ id: 'plugin-1' }));
      expect(getPluginCount()).toBe(1);

      registerPlugin(createMockPlugin({ id: 'plugin-2' }));
      expect(getPluginCount()).toBe(2);

      unregisterPlugin('plugin-1');
      expect(getPluginCount()).toBe(1);
    });
  });
});
