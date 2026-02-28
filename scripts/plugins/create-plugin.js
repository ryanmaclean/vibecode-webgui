#!/usr/bin/env node

/**
 * VibeCode Plugin Scaffolding CLI
 * Creates a new plugin with proper structure and template files
 */

const fs = require('fs');
const path = require('path');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'cyan') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    name: null,
    type: null,
    description: null,
    author: null,
    outputDir: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--name':
      case '-n':
        options.name = nextArg;
        i++;
        break;
      case '--type':
      case '-t':
        options.type = nextArg;
        i++;
        break;
      case '--description':
      case '-d':
        options.description = nextArg;
        i++;
        break;
      case '--author':
      case '-a':
        options.author = nextArg;
        i++;
        break;
      case '--output':
      case '-o':
        options.outputDir = nextArg;
        i++;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function showHelp() {
  log('VibeCode Plugin Scaffolding CLI', 'blue');
  log('');
  log('Usage: node scripts/plugins/create-plugin.js [options]', 'cyan');
  log('');
  log('Options:', 'yellow');
  log('  --name, -n <name>          Plugin name (required)');
  log('  --type, -t <type>          Plugin type (required)');
  log('  --description, -d <desc>   Plugin description');
  log('  --author, -a <author>      Plugin author name');
  log('  --output, -o <dir>         Output directory (default: ./plugins)');
  log('  --help, -h                 Show this help message');
  log('');
  log('Plugin Types:', 'yellow');
  log('  ai-model       - Custom AI model providers');
  log('  integration    - External service integrations');
  log('  workflow       - Workflow automation');
  log('  other          - Other plugin types');
  log('');
  log('Example:', 'green');
  log('  node scripts/plugins/create-plugin.js --name my-plugin --type integration');
}

function validateOptions(options) {
  const errors = [];

  if (!options.name) {
    errors.push('Plugin name is required (--name)');
  }

  if (!options.type) {
    errors.push('Plugin type is required (--type)');
  }

  const validTypes = ['ai-model', 'integration', 'workflow', 'other'];
  if (options.type && !validTypes.includes(options.type)) {
    errors.push(`Invalid plugin type. Must be one of: ${validTypes.join(', ')}`);
  }

  if (options.name && !/^[a-z0-9-]+$/.test(options.name)) {
    errors.push('Plugin name must contain only lowercase letters, numbers, and hyphens');
  }

  return errors;
}

function createPluginManifest(options) {
  const pluginId = options.name;
  const pluginName = options.name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const manifest = {
    id: pluginId,
    name: pluginName,
    version: '1.0.0',
    description: options.description || `A ${options.type} plugin for VibeCode`,
    author: {
      name: options.author || 'Your Name',
      email: 'you@example.com',
      url: 'https://example.com'
    },
    type: options.type,
    main: 'index.ts',
    permissions: getDefaultPermissions(options.type),
    engines: {
      node: '>=18.0.0',
      vibecode: '>=1.0.0'
    },
    license: 'MIT',
    keywords: [
      options.type,
      'plugin',
      'vibecode'
    ],
    homepage: `https://vibecode.dev/docs/plugins/${pluginId}`
  };

  return JSON.stringify(manifest, null, 2);
}

function getDefaultPermissions(type) {
  const permissionMap = {
    'ai-model': ['ai-models:access', 'network:outbound'],
    'integration': ['network:outbound', 'settings:read'],
    'workflow': ['filesystem:read', 'filesystem:write', 'commands:register', 'settings:read'],
    'other': ['commands:register']
  };

  return permissionMap[type] || ['commands:register'];
}

function createPluginIndex(options) {
  const pluginName = options.name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const capabilities = getDefaultCapabilities(options.type);

  return `/**
 * ${pluginName} Plugin
 *
 * ${options.description || `A ${options.type} plugin for VibeCode`}
 */

import {
  PluginAPI,
  PluginManifest,
  PluginCapabilities,
  PluginContext
} from '@/types/plugin';

// Import the manifest
import manifest from './plugin.json';

/**
 * Plugin capabilities
 */
const capabilities: PluginCapabilities = ${JSON.stringify(capabilities, null, 2)};

/**
 * Plugin context (set during initialization)
 */
let context: PluginContext | null = null;

/**
 * Initialize the plugin
 */
async function initialize(ctx: PluginContext): Promise<void> {
  context = ctx;

  ctx.logger.info('${pluginName} plugin initializing...');
  ctx.logger.info(\`Plugin ID: \${ctx.pluginId}\`);
  ctx.logger.info(\`Plugin Path: \${ctx.pluginPath}\`);
  ctx.logger.info(\`Data Path: \${ctx.dataPath}\`);

  // TODO: Add your initialization logic here

  ctx.logger.info('${pluginName} plugin initialized successfully!');
}

/**
 * Cleanup when plugin is destroyed
 */
async function destroy(): Promise<void> {
  if (context) {
    context.logger.info('${pluginName} plugin shutting down...');
    // TODO: Add cleanup logic here
    context = null;
  }
}

/**
 * Called when plugin is installed
 */
async function onInstall(): Promise<void> {
  if (context) {
    context.logger.info('${pluginName} plugin installed!');
    // TODO: Add installation logic here
  }
}

/**
 * Called when plugin is uninstalled
 */
async function onUninstall(): Promise<void> {
  if (context) {
    context.logger.info('${pluginName} plugin uninstalled.');
    // TODO: Add uninstallation cleanup here
  }
}

/**
 * Called when plugin is enabled
 */
async function onEnable(): Promise<void> {
  if (context) {
    context.logger.info('${pluginName} plugin enabled!');
    // TODO: Add enable logic here
  }
}

/**
 * Called when plugin is disabled
 */
async function onDisable(): Promise<void> {
  if (context) {
    context.logger.info('${pluginName} plugin disabled.');
    // TODO: Add disable logic here
  }
}

/**
 * Called when plugin is updated
 */
async function onUpdate(oldVersion: string, newVersion: string): Promise<void> {
  if (context) {
    context.logger.info(\`${pluginName} plugin updated from \${oldVersion} to \${newVersion}\`);
    // TODO: Add update migration logic here
  }
}

/**
 * Plugin API export
 *
 * This is the main interface that VibeCode uses to interact with the plugin
 */
const plugin: PluginAPI = {
  manifest: manifest as PluginManifest,
  capabilities,
  initialize,
  destroy,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  onUpdate
};

export default plugin;
`;
}

function getDefaultCapabilities(type) {
  const capabilityMap = {
    'ai-model': {
      providesAIModel: true,
      providesIntegration: false,
      providesCommands: false,
      providesUIComponents: false,
      providesCodeActions: false,
      providesWorkflows: false,
      providesFormatters: false,
      providesLinters: false
    },
    'integration': {
      providesAIModel: false,
      providesIntegration: true,
      providesCommands: true,
      providesUIComponents: false,
      providesCodeActions: false,
      providesWorkflows: false,
      providesFormatters: false,
      providesLinters: false
    },
    'workflow': {
      providesAIModel: false,
      providesIntegration: false,
      providesCommands: true,
      providesUIComponents: false,
      providesCodeActions: false,
      providesWorkflows: true,
      providesFormatters: false,
      providesLinters: false
    },
    'other': {
      providesAIModel: false,
      providesIntegration: false,
      providesCommands: true,
      providesUIComponents: false,
      providesCodeActions: false,
      providesWorkflows: false,
      providesFormatters: false,
      providesLinters: false
    }
  };

  return capabilityMap[type] || capabilityMap.other;
}

function createReadme(options) {
  const pluginName = options.name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `# ${pluginName}

${options.description || `A ${options.type} plugin for VibeCode`}

## Installation

\`\`\`bash
# Install via VibeCode CLI
vibecode plugin install ${options.name}

# Or install via UI
# Navigate to Settings > Plugins > Browse Marketplace
# Search for "${pluginName}" and click Install
\`\`\`

## Usage

TODO: Add usage instructions

## Configuration

TODO: Add configuration options

## Development

\`\`\`bash
# Install dependencies
npm install

# Run tests
npm test

# Build the plugin
npm run build
\`\`\`

## License

MIT
`;
}

function createPackageJson(options) {
  return `{
  "name": "@vibecode-plugin/${options.name}",
  "version": "1.0.0",
  "description": "${options.description || `A ${options.type} plugin for VibeCode`}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "keywords": [
    "vibecode",
    "plugin",
    "${options.type}"
  ],
  "author": "${options.author || 'Your Name'}",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
`;
}

function createTsConfig() {
  return `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "paths": {
      "@/*": ["../../src/*"]
    }
  },
  "include": [
    "**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
`;
}

function createGitignore() {
  return `node_modules/
dist/
*.log
.DS_Store
.env
.vscode/
`;
}

function createPlugin(options) {
  log(`Creating ${options.type} plugin: ${options.name}`, 'blue');

  const baseDir = options.outputDir || './plugins';
  const pluginDir = path.join(baseDir, options.name);

  if (fs.existsSync(pluginDir)) {
    log(`Error: Plugin directory already exists: ${pluginDir}`, 'red');
    process.exit(1);
  }

  fs.mkdirSync(pluginDir, { recursive: true });

  log('Creating plugin files...', 'yellow');

  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    createPluginManifest(options)
  );
  log('  ✓ plugin.json', 'green');

  fs.writeFileSync(
    path.join(pluginDir, 'index.ts'),
    createPluginIndex(options)
  );
  log('  ✓ index.ts', 'green');

  fs.writeFileSync(
    path.join(pluginDir, 'README.md'),
    createReadme(options)
  );
  log('  ✓ README.md', 'green');

  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    createPackageJson(options)
  );
  log('  ✓ package.json', 'green');

  fs.writeFileSync(
    path.join(pluginDir, 'tsconfig.json'),
    createTsConfig()
  );
  log('  ✓ tsconfig.json', 'green');

  fs.writeFileSync(
    path.join(pluginDir, '.gitignore'),
    createGitignore()
  );
  log('  ✓ .gitignore', 'green');

  log('', 'reset');
  log('Plugin scaffold created successfully', 'green');
  log('', 'reset');
  log(`Plugin location: ${pluginDir}`, 'cyan');
  log('', 'reset');
  log('Next steps:', 'yellow');
  log(`  cd ${pluginDir}`, 'cyan');
  log('  npm install', 'cyan');
  log('  # Edit index.ts to implement your plugin logic', 'cyan');
  log('  npm run build', 'cyan');
  log('', 'reset');
}

function main() {
  const options = parseArguments();

  const errors = validateOptions(options);
  if (errors.length > 0) {
    log('Validation errors:', 'red');
    errors.forEach(error => log(`  - ${error}`, 'red'));
    log('', 'reset');
    log('Use --help for usage information', 'yellow');
    process.exit(1);
  }

  createPlugin(options);
}

if (require.main === module) {
  main();
}

module.exports = { createPlugin, parseArguments, validateOptions };
