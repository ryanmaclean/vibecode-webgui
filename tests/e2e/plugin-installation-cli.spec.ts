/**
 * End-to-End Test: Plugin Installation via CLI
 *
 * This test verifies the complete plugin installation workflow using the vibecode CLI:
 * - Installing a plugin from a local directory
 * - Verifying plugin appears in the list
 * - Checking plugin metadata and capabilities
 * - Uninstalling the plugin
 * - Verifying removal
 */

import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Test configuration
const CLI_PATH = path.resolve(__dirname, '../../vibecode');
const PLUGIN_PATH = path.resolve(__dirname, '../../plugins/examples/custom-model');
const PLUGIN_NAME = 'custom-model';
const API_BASE_URL = 'http://localhost:3000';

/**
 * Helper function to execute CLI commands
 */
async function runCLI(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(`${CLI_PATH} ${args}`);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1,
    };
  }
}

/**
 * Helper function to call the plugin API
 */
async function callPluginAPI(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
}

test.describe('CLI Plugin Installation E2E', () => {
  // Clean up any existing test plugins before and after tests
  test.beforeEach(async () => {
    // Try to uninstall the plugin if it exists (ignore errors)
    await runCLI(`plugin uninstall ${PLUGIN_NAME}`);
  });

  test.afterEach(async () => {
    // Clean up after test
    await runCLI(`plugin uninstall ${PLUGIN_NAME}`);
  });

  test('should complete full plugin lifecycle via CLI', async () => {
    // Step 1: Install plugin via CLI
    console.log('Step 1: Installing plugin via CLI...');
    const installResult = await runCLI(`plugin install ${PLUGIN_PATH}`);

    console.log('Install output:', installResult.stdout);
    console.log('Install stderr:', installResult.stderr);

    // Verify installation output contains success message
    expect(installResult.stdout).toContain('Plugin installed successfully');
    expect(installResult.exitCode).toBe(0);

    // Step 2: Verify plugin appears in list via CLI
    console.log('\nStep 2: Listing plugins via CLI...');
    const listResult = await runCLI('plugin list');

    console.log('List output:', listResult.stdout);

    // Verify plugin appears in list
    expect(listResult.stdout).toContain(PLUGIN_NAME);
    expect(listResult.stdout).toContain('custom-model');
    expect(listResult.exitCode).toBe(0);

    // Step 3: Verify plugin via API
    console.log('\nStep 3: Verifying plugin via API...');
    const pluginsResponse = await callPluginAPI('/api/plugins');
    const pluginsData = await pluginsResponse.json();

    console.log('API response:', JSON.stringify(pluginsData, null, 2));

    // Find the custom-model plugin
    const installedPlugin = pluginsData.plugins?.find((p: any) =>
      p.name === PLUGIN_NAME || p.id?.includes(PLUGIN_NAME)
    );

    expect(installedPlugin).toBeDefined();
    if (installedPlugin) {
      expect(installedPlugin.name).toBe(PLUGIN_NAME);
      expect(installedPlugin.version).toBeDefined();
      expect(installedPlugin.type).toBe('ai-model');
      expect(installedPlugin.status).toMatch(/installed|enabled/);

      // Verify capabilities
      expect(installedPlugin.capabilities).toBeDefined();
      expect(installedPlugin.capabilities.providesAIModel).toBe(true);
    }

    // Step 4: Verify plugin details via API
    console.log('\nStep 4: Checking plugin details...');
    const detailsResponse = await callPluginAPI(`/api/plugins/${PLUGIN_NAME}`);

    if (detailsResponse.ok) {
      const pluginDetails = await detailsResponse.json();
      console.log('Plugin details:', JSON.stringify(pluginDetails, null, 2));

      expect(pluginDetails.name).toBe(PLUGIN_NAME);
      expect(pluginDetails.description).toBeDefined();
      expect(pluginDetails.author).toBeDefined();
      expect(pluginDetails.permissions).toBeDefined();
      expect(Array.isArray(pluginDetails.permissions)).toBe(true);

      // Verify AI model specific permissions
      expect(pluginDetails.permissions).toContain('ai-models:access');
    }

    // Step 5: Uninstall plugin via CLI
    console.log('\nStep 5: Uninstalling plugin via CLI...');
    const uninstallResult = await runCLI(`plugin uninstall ${PLUGIN_NAME}`);

    console.log('Uninstall output:', uninstallResult.stdout);

    // Verify uninstallation output
    expect(uninstallResult.stdout).toContain('Plugin uninstalled successfully');
    expect(uninstallResult.exitCode).toBe(0);

    // Step 6: Verify plugin is removed via CLI
    console.log('\nStep 6: Verifying plugin removal via CLI...');
    const listAfterUninstallResult = await runCLI('plugin list');

    console.log('List after uninstall:', listAfterUninstallResult.stdout);

    // Plugin should not appear in list or list should show "No plugins installed"
    const isRemoved = listAfterUninstallResult.stdout.includes('No plugins installed') ||
                      !listAfterUninstallResult.stdout.includes(PLUGIN_NAME);
    expect(isRemoved).toBe(true);

    // Step 7: Verify plugin is removed via API
    console.log('\nStep 7: Verifying plugin removal via API...');
    const pluginsAfterUninstall = await callPluginAPI('/api/plugins');
    const pluginsAfterData = await pluginsAfterUninstall.json();

    const stillInstalled = pluginsAfterData.plugins?.find((p: any) =>
      p.name === PLUGIN_NAME || p.id?.includes(PLUGIN_NAME)
    );

    expect(stillInstalled).toBeUndefined();
  });

  test('should show plugin help message', async () => {
    const helpResult = await runCLI('plugin --help');

    expect(helpResult.stdout).toContain('Plugin Management');
    expect(helpResult.stdout).toContain('list');
    expect(helpResult.stdout).toContain('install');
    expect(helpResult.stdout).toContain('uninstall');
    expect(helpResult.exitCode).toBe(0);
  });

  test('should handle non-existent plugin path gracefully', async () => {
    const invalidPath = './plugins/non-existent-plugin';
    const installResult = await runCLI(`plugin install ${invalidPath}`);

    // Should fail with appropriate error message
    expect(installResult.exitCode).not.toBe(0);
    expect(installResult.stderr || installResult.stdout).toMatch(/not found|Failed/i);
  });

  test('should handle uninstalling non-existent plugin', async () => {
    const uninstallResult = await runCLI('plugin uninstall non-existent-plugin');

    // Should fail with plugin not found message
    expect(uninstallResult.stdout).toContain('Plugin not found');
    expect(uninstallResult.exitCode).not.toBe(0);
  });

  test('should list plugins when none are installed', async () => {
    // Make sure no plugins are installed
    const listResult = await runCLI('plugin list');

    // Should succeed even with no plugins
    expect(listResult.exitCode).toBe(0);

    // Should show appropriate message
    const hasNoPluginsMessage = listResult.stdout.includes('No plugins installed') ||
                                listResult.stdout.includes('Found 0 plugin');
    expect(hasNoPluginsMessage).toBe(true);
  });

  test('should show plugin metadata after installation', async () => {
    // Install plugin
    const installResult = await runCLI(`plugin install ${PLUGIN_PATH}`);
    expect(installResult.exitCode).toBe(0);

    // List plugins with details
    const listResult = await runCLI('plugin list');
    expect(listResult.exitCode).toBe(0);

    // Verify metadata is shown
    expect(listResult.stdout).toContain(PLUGIN_NAME);
    expect(listResult.stdout).toMatch(/version|v\d+\.\d+\.\d+/i);
    expect(listResult.stdout).toMatch(/installed|enabled/i);
  });
});

test.describe('CLI Plugin Installation - Custom Model Specific', () => {
  test.beforeEach(async () => {
    await runCLI(`plugin uninstall ${PLUGIN_NAME}`);
  });

  test.afterEach(async () => {
    await runCLI(`plugin uninstall ${PLUGIN_NAME}`);
  });

  test('should verify custom model plugin provides AI models', async () => {
    // Install the custom-model plugin
    const installResult = await runCLI(`plugin install ${PLUGIN_PATH}`);
    expect(installResult.exitCode).toBe(0);

    // Get plugin details via API
    const detailsResponse = await callPluginAPI(`/api/plugins/${PLUGIN_NAME}`);
    expect(detailsResponse.ok).toBe(true);

    const pluginDetails = await detailsResponse.json();

    // Verify it's an AI model plugin
    expect(pluginDetails.type).toBe('ai-model');
    expect(pluginDetails.capabilities?.providesAIModel).toBe(true);

    // Verify it has the required permissions for AI models
    expect(pluginDetails.permissions).toContain('ai-models:access');
    expect(pluginDetails.permissions).toContain('network:outbound');

    // Verify plugin metadata
    expect(pluginDetails.description).toContain('AI');
  });

  test('should verify custom models are registered after installation', async () => {
    // Install the plugin
    const installResult = await runCLI(`plugin install ${PLUGIN_PATH}`);
    expect(installResult.exitCode).toBe(0);

    // Check if plugin is enabled
    const pluginsResponse = await callPluginAPI('/api/plugins');
    const pluginsData = await pluginsResponse.json();

    const customModelPlugin = pluginsData.plugins?.find((p: any) =>
      p.name === PLUGIN_NAME
    );

    expect(customModelPlugin).toBeDefined();
    expect(customModelPlugin?.status).toMatch(/installed|enabled/);

    // Verify the plugin has AI model capabilities
    if (customModelPlugin?.capabilities) {
      expect(customModelPlugin.capabilities.providesAIModel).toBe(true);
    }
  });
});
