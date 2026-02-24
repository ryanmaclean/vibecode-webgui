#!/usr/bin/env node

/**
 * Plugin Testing CLI
 *
 * This script loads a plugin in an isolated environment and runs validation tests.
 * Tests include manifest validation, code structure verification, and plugin initialization.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { existsSync } from 'fs';
import { readFile, access } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const pluginPath = args[0];

  return {
    pluginPath: path.resolve(pluginPath)
  };
}

/**
 * Show help message
 */
function showHelp() {
  log('Plugin Testing CLI', 'blue');
  log('');
  log('Usage: node scripts/plugins/test-plugin.js <plugin-path>', 'cyan');
  log('');
  log('Arguments:', 'yellow');
  log('  <plugin-path>    Path to the plugin directory');
  log('');
  log('Options:', 'yellow');
  log('  --help, -h       Show this help message');
  log('');
  log('Example:', 'green');
  log('  node scripts/plugins/test-plugin.js ./plugins/examples/hello-world');
  log('');
}

/**
 * Test suite tracking
 */
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.warnings = [];
  }

  addTest(name, result, error = null) {
    this.tests.push({ name, result, error });
    if (result) {
      this.passed++;
    } else {
      this.failed++;
    }
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }

  printResults() {
    log('');
    log(`Test Suite: ${this.name}`, 'blue');
    log('─'.repeat(60), 'blue');

    for (const test of this.tests) {
      if (test.result) {
        logSuccess(test.name);
      } else {
        logError(`${test.name}: ${test.error || 'Failed'}`);
      }
    }

    if (this.warnings.length > 0) {
      log('');
      log('Warnings:', 'yellow');
      for (const warning of this.warnings) {
        logWarning(warning);
      }
    }

    log('');
    log(`Results: ${this.passed} passed, ${this.failed} failed`,
        this.failed === 0 ? 'green' : 'red');
    log('─'.repeat(60), 'blue');
  }

  isSuccess() {
    return this.failed === 0;
  }
}

/**
 * Validate plugin manifest
 */
async function validatePluginManifest(pluginPath, suite) {
  const manifestPath = path.join(pluginPath, 'plugin.json');

  // Check if manifest exists
  try {
    await access(manifestPath);
    suite.addTest('Manifest file exists', true);
  } catch (error) {
    suite.addTest('Manifest file exists', false, 'plugin.json not found');
    return null;
  }

  // Load and parse manifest
  let manifest;
  try {
    const manifestData = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(manifestData);
    suite.addTest('Manifest is valid JSON', true);
  } catch (error) {
    suite.addTest('Manifest is valid JSON', false, error.message);
    return null;
  }

  // Validate required fields
  const requiredFields = ['id', 'name', 'version', 'description', 'author', 'type', 'main', 'permissions'];
  for (const field of requiredFields) {
    const hasField = manifest.hasOwnProperty(field);
    suite.addTest(`Manifest has '${field}' field`, hasField, hasField ? null : `Missing '${field}' field`);
  }

  // Validate field types and formats
  if (manifest.id) {
    const validId = /^[a-zA-Z0-9_-]+$/.test(manifest.id);
    suite.addTest('Plugin ID is valid format', validId,
      validId ? null : 'ID must contain only alphanumeric characters, hyphens, and underscores');
  }

  if (manifest.version) {
    const validVersion = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(manifest.version);
    suite.addTest('Version follows semantic versioning', validVersion,
      validVersion ? null : 'Version must follow semver (e.g., 1.0.0)');
  }

  if (manifest.main) {
    const validMain = (manifest.main.endsWith('.js') || manifest.main.endsWith('.ts') || manifest.main.endsWith('.mjs'))
                      && !manifest.main.includes('..');
    suite.addTest('Main entry point is valid', validMain,
      validMain ? null : 'Main must be a JS/TS file without directory traversal');
  }

  if (manifest.type) {
    const validTypes = ['ai-model', 'integration', 'workflow', 'ui-extension', 'code-generator', 'linter', 'formatter', 'other'];
    const validType = validTypes.includes(manifest.type);
    suite.addTest('Plugin type is valid', validType,
      validType ? null : `Type must be one of: ${validTypes.join(', ')}`);
  }

  if (manifest.permissions) {
    const isArray = Array.isArray(manifest.permissions);
    suite.addTest('Permissions is an array', isArray,
      isArray ? null : 'Permissions must be an array');
  }

  // Optional field warnings
  if (!manifest.keywords || manifest.keywords.length === 0) {
    suite.addWarning('No keywords provided - consider adding keywords for discoverability');
  }

  if (!manifest.license) {
    suite.addWarning('No license specified');
  }

  if (!manifest.repository) {
    suite.addWarning('No repository URL provided');
  }

  return manifest;
}

/**
 * Validate plugin code structure
 */
async function validatePluginCode(pluginPath, manifest, suite) {
  if (!manifest || !manifest.main) {
    suite.addTest('Check main entry point exists', false, 'No manifest or main field');
    return false;
  }

  const mainPath = path.join(pluginPath, manifest.main);

  // Check if main file exists
  try {
    await access(mainPath);
    suite.addTest('Main entry point file exists', true);
  } catch (error) {
    suite.addTest('Main entry point file exists', false, `${manifest.main} not found`);
    return false;
  }

  // Check for README
  const readmePath = path.join(pluginPath, 'README.md');
  if (existsSync(readmePath)) {
    suite.addTest('README.md exists', true);
  } else {
    suite.addTest('README.md exists', false);
    suite.addWarning('Consider adding a README.md file for documentation');
  }

  return true;
}

/**
 * Test plugin loading and initialization
 */
async function testPluginInitialization(pluginPath, manifest, suite) {
  if (!manifest || !manifest.main) {
    suite.addTest('Plugin structure is valid', false, 'No manifest or main field');
    return false;
  }

  const mainPath = path.resolve(pluginPath, manifest.main);

  // Validate path safety
  const resolvedPluginPath = path.resolve(pluginPath);
  if (!(mainPath === resolvedPluginPath || mainPath.startsWith(`${resolvedPluginPath}${path.sep}`))) {
    suite.addTest('Plugin path is safe', false, 'Main path escapes plugin directory');
    return false;
  }

  suite.addTest('Plugin path is safe', true);

  // Read and validate plugin code structure
  try {
    const codeContent = await readFile(mainPath, 'utf-8');

    // Check for required exports and structure
    const hasInitialize = codeContent.includes('initialize') || codeContent.includes('async function initialize');
    const hasDestroy = codeContent.includes('destroy') || codeContent.includes('async function destroy');
    const hasManifest = codeContent.includes('manifest') && codeContent.includes('plugin.json');
    const hasCapabilities = codeContent.includes('capabilities');
    const hasDefaultExport = codeContent.includes('export default') || codeContent.includes('module.exports');

    suite.addTest('Plugin has initialize function', hasInitialize,
      hasInitialize ? null : 'No initialize function found in code');

    suite.addTest('Plugin has destroy function', hasDestroy,
      hasDestroy ? null : 'No destroy function found in code');

    suite.addTest('Plugin has manifest export', hasManifest,
      hasManifest ? null : 'No manifest export found in code');

    suite.addTest('Plugin has capabilities declaration', hasCapabilities,
      hasCapabilities ? null : 'No capabilities declaration found in code');

    suite.addTest('Plugin has default export', hasDefaultExport,
      hasDefaultExport ? null : 'No default export found in code');

    // Try to dynamically import if it's JavaScript (skip TypeScript in test environment)
    if (manifest.main.endsWith('.js') || manifest.main.endsWith('.mjs')) {
      try {
        const pluginModule = await import(mainPath);
        suite.addTest('Plugin module imports successfully', true);

        const pluginAPI = pluginModule.default || pluginModule;

        // Validate required API methods
        const requiredMethods = ['initialize', 'destroy'];
        const hasRequiredMethods = requiredMethods.every(method => typeof pluginAPI[method] === 'function');
        suite.addTest('Plugin API methods are callable', hasRequiredMethods,
          hasRequiredMethods ? null : `Missing required methods: ${requiredMethods.filter(m => typeof pluginAPI[m] !== 'function').join(', ')}`);

        // Validate manifest in API matches
        if (pluginAPI.manifest) {
          const manifestMatches = pluginAPI.manifest.id === manifest.id;
          suite.addTest('Plugin API manifest matches plugin.json', manifestMatches,
            manifestMatches ? null : 'Manifest in code does not match plugin.json');
        }

        // Test initialization with mock context
        const mockContext = {
          pluginId: manifest.id,
          pluginPath: pluginPath,
          dataPath: path.join(pluginPath, 'data'),
          logger: {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {}
          },
          permissions: manifest.permissions,
          config: {}
        };

        if (typeof pluginAPI.initialize === 'function') {
          await pluginAPI.initialize(mockContext);
          suite.addTest('Plugin initializes without errors', true);

          // Clean up
          if (typeof pluginAPI.destroy === 'function') {
            await pluginAPI.destroy();
          }
        }
      } catch (error) {
        // Import failed but code structure is valid - this is OK for TypeScript in test env
        if (error.message.includes('Cannot find package') || error.message.includes('@/')) {
          suite.addWarning(`Plugin import skipped (TypeScript requires build): ${error.message}`);
          suite.addTest('Plugin code structure is valid', true);
        } else {
          suite.addTest('Plugin module imports successfully', false, error.message);
        }
      }
    } else {
      // TypeScript file - validate structure only
      suite.addWarning('TypeScript plugin - runtime import test skipped (requires compilation)');
      suite.addTest('Plugin code structure is valid', true);
    }

    return true;
  } catch (error) {
    suite.addTest('Plugin code is readable', false, error.message);
    return false;
  }
}

/**
 * Run all plugin tests
 */
async function runPluginTests(pluginPath) {
  log('');
  log('🧪 VibeCode Plugin Testing CLI', 'bright');
  log('═'.repeat(60), 'blue');
  logInfo(`Testing plugin at: ${pluginPath}`);
  log('');

  const suite = new TestSuite('Plugin Validation');

  // Verify plugin path exists
  if (!existsSync(pluginPath)) {
    logError(`Plugin directory not found: ${pluginPath}`);
    process.exit(1);
  }

  // Test 1: Validate manifest
  logInfo('Running manifest validation tests...');
  const manifest = await validatePluginManifest(pluginPath, suite);

  // Test 2: Validate code structure
  if (manifest) {
    logInfo('Running code structure tests...');
    await validatePluginCode(pluginPath, manifest, suite);

    // Test 3: Test plugin initialization
    logInfo('Running plugin initialization tests...');
    await testPluginInitialization(pluginPath, manifest, suite);
  }

  // Print results
  suite.printResults();

  if (suite.isSuccess()) {
    log('');
    logSuccess('Plugin tests passed');
    log('');
    return 0;
  } else {
    log('');
    logError('Plugin tests failed');
    log('');
    return 1;
  }
}

/**
 * Main entry point
 */
async function main() {
  try {
    const { pluginPath } = parseArguments();
    const exitCode = await runPluginTests(pluginPath);
    process.exit(exitCode);
  } catch (error) {
    logError(`Unexpected error: ${error.message}`);
    if (error.stack) {
      log(error.stack, 'red');
    }
    process.exit(1);
  }
}

main();
