#!/usr/bin/env node

/**
 * Plugin Packaging CLI
 *
 * This script packages a plugin directory into a .vcp (VibeCode Plugin) archive
 * for distribution and installation.
 *
 * The .vcp format is a ZIP archive containing all plugin files except development artifacts.
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import { existsSync } from 'fs';
import { readFile, mkdir, rm } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  const outputPath = args[1] || process.cwd();

  return {
    pluginPath: path.resolve(pluginPath),
    outputPath: path.resolve(outputPath)
  };
}

/**
 * Show help message
 */
function showHelp() {
  log('Plugin Packaging CLI', 'blue');
  log('');
  log('Usage: node scripts/plugins/package-plugin.js <plugin-path> [output-path]', 'cyan');
  log('');
  log('Arguments:', 'yellow');
  log('  <plugin-path>    Path to the plugin directory');
  log('  [output-path]    Output directory for the .vcp file (default: current directory)');
  log('');
  log('Options:', 'yellow');
  log('  --help, -h       Show this help message');
  log('');
  log('Examples:', 'green');
  log('  node scripts/plugins/package-plugin.js ./plugins/examples/hello-world');
  log('  node scripts/plugins/package-plugin.js ./my-plugin ./dist');
  log('');
  log('Output:', 'yellow');
  log('  Creates a .vcp file named {plugin-id}-{version}.vcp');
  log('');
}

/**
 * Validate plugin directory
 */
async function validatePluginDirectory(pluginPath) {
  logInfo('Validating plugin directory...');

  // Check if directory exists
  if (!existsSync(pluginPath)) {
    logError(`Plugin directory not found: ${pluginPath}`);
    return false;
  }

  // Check if plugin.json exists
  const manifestPath = path.join(pluginPath, 'plugin.json');
  if (!existsSync(manifestPath)) {
    logError('plugin.json not found in plugin directory');
    return false;
  }

  logSuccess('Plugin directory is valid');
  return true;
}

/**
 * Load and validate plugin manifest
 */
async function loadPluginManifest(pluginPath) {
  logInfo('Loading plugin manifest...');

  try {
    const manifestPath = path.join(pluginPath, 'plugin.json');
    const manifestContent = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Validate required fields
    const requiredFields = ['id', 'name', 'version'];
    const missingFields = requiredFields.filter(field => !manifest[field]);

    if (missingFields.length > 0) {
      logError(`Missing required fields in plugin.json: ${missingFields.join(', ')}`);
      return null;
    }

    // Validate version format (semver)
    const semverPattern = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
    if (!semverPattern.test(manifest.version)) {
      logError(`Invalid version format: ${manifest.version} (must be semver, e.g., 1.0.0)`);
      return null;
    }

    logSuccess(`Loaded manifest for ${manifest.name} v${manifest.version}`);
    return manifest;
  } catch (error) {
    logError(`Failed to load plugin manifest: ${error.message}`);
    return null;
  }
}

/**
 * Create .vcp archive
 */
async function createVCPArchive(pluginPath, outputPath, manifest) {
  const archiveName = `${manifest.id}-${manifest.version}.vcp`;
  const archivePath = path.join(outputPath, archiveName);

  logInfo(`Creating .vcp archive: ${archiveName}`);

  // Files and directories to exclude from the archive
  const excludePatterns = [
    'node_modules',
    '.git',
    '.gitignore',
    '.DS_Store',
    '*.log',
    '.env',
    '.env.*',
    'dist',
    'build',
    'coverage',
    '.nyc_output',
    '*.vcp'
  ];

  try {
    // Ensure output directory exists
    await mkdir(outputPath, { recursive: true });

    // Remove existing archive if it exists
    if (existsSync(archivePath)) {
      logWarning(`Removing existing archive: ${archiveName}`);
      await rm(archivePath, { force: true });
    }

    // Build exclude flags for zip command
    const excludeFlags = excludePatterns
      .map(pattern => `-x "${pattern}"`)
      .join(' ');

    // Create zip archive
    // Note: Using -r for recursive, -q for quiet (less verbose), -y for symlinks
    const pluginDir = path.basename(pluginPath);
    const pluginParentDir = path.dirname(pluginPath);

    // Change to parent directory and zip the plugin directory
    const zipCommand = `cd "${pluginParentDir}" && zip -r -q "${archivePath}" "${pluginDir}" ${excludeFlags}`;

    logInfo('Compressing plugin files...');
    await execAsync(zipCommand);

    // Verify the archive was created
    if (!existsSync(archivePath)) {
      throw new Error('Archive creation failed - file not found after zip command');
    }

    // Get archive size
    const { stdout } = await execAsync(`ls -lh "${archivePath}" | awk '{print $5}'`);
    const fileSize = stdout.trim();

    logSuccess(`Package created successfully: ${archiveName} (${fileSize})`);
    logInfo(`Output: ${archivePath}`);

    return archivePath;
  } catch (error) {
    logError(`Failed to create archive: ${error.message}`);
    return null;
  }
}

/**
 * Display package summary
 */
async function displayPackageSummary(archivePath, manifest) {
  log('');
  log('━'.repeat(60), 'cyan');
  log('Package Summary', 'bright');
  log('━'.repeat(60), 'cyan');
  log('');
  log(`Plugin ID:      ${manifest.id}`, 'cyan');
  log(`Name:           ${manifest.name}`, 'cyan');
  log(`Version:        ${manifest.version}`, 'cyan');
  log(`Type:           ${manifest.type || 'other'}`, 'cyan');
  log(`Author:         ${manifest.author?.name || 'Unknown'}`, 'cyan');
  log(`Package:        ${path.basename(archivePath)}`, 'green');
  log(`Location:       ${archivePath}`, 'green');
  log('');
  log('━'.repeat(60), 'cyan');
  log('');
  logSuccess('Plugin packaged successfully!');
  log('');
  logInfo('Next steps:');
  log('  1. Test the package: node scripts/plugins/test-plugin.js <plugin-path>');
  log('  2. Publish to marketplace: POST /api/plugins/publish');
  log('');
}

/**
 * Main execution
 */
async function main() {
  try {
    log('');
    log('━'.repeat(60), 'blue');
    log('VibeCode Plugin Packaging CLI', 'bright');
    log('━'.repeat(60), 'blue');
    log('');

    // Parse arguments
    const { pluginPath, outputPath } = parseArguments();

    // Validate plugin directory
    const isValid = await validatePluginDirectory(pluginPath);
    if (!isValid) {
      process.exit(1);
    }

    // Load plugin manifest
    const manifest = await loadPluginManifest(pluginPath);
    if (!manifest) {
      process.exit(1);
    }

    // Create .vcp archive
    const archivePath = await createVCPArchive(pluginPath, outputPath, manifest);
    if (!archivePath) {
      process.exit(1);
    }

    // Display summary
    await displayPackageSummary(archivePath, manifest);

    process.exit(0);
  } catch (error) {
    logError(`Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
