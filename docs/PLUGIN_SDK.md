# Plugin SDK Documentation

Developer guide for building, testing, and distributing VibeCode plugins with the official SDK tools and utilities.

## Table of Contents

- [Overview](#overview)
- [SDK Installation](#sdk-installation)
- [Development Setup](#development-setup)
- [Plugin Scaffolding](#plugin-scaffolding)
- [TypeScript Types](#typescript-types)
- [Development Workflow](#development-workflow)
- [Testing Plugins](#testing-plugins)
- [Debugging](#debugging)
- [Building & Packaging](#building--packaging)
- [Publishing Plugins](#publishing-plugins)
- [SDK Utilities](#sdk-utilities)
- [Common Patterns](#common-patterns)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

---

## Overview

The VibeCode Plugin SDK provides tools and utilities for efficient plugin development:

- 🚀 **Quick Scaffolding**: Generate plugin boilerplate in seconds
- 🔧 **Development Tools**: CLI utilities for testing and debugging
- 📦 **Build System**: Automated building and packaging
- 🧪 **Testing Framework**: Unit and integration testing utilities
- 📝 **TypeScript Support**: Full type definitions and IntelliSense
- 🔍 **Validation Tools**: Manifest and code validators
- 📚 **Code Generation**: Automatic type generation from schemas

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0 or yarn >= 1.22.0
- TypeScript >= 5.0.0 (recommended)
- VibeCode >= 1.0.0

---

## SDK Installation

### Global Installation

Install the SDK globally for CLI access:

```bash
npm install -g @vibecode/plugin-sdk
```

Verify installation:

```bash
vibecode-sdk --version
```

### Project Installation

Add SDK as a development dependency:

```bash
npm install --save-dev @vibecode/plugin-sdk
```

Or with yarn:

```bash
yarn add -D @vibecode/plugin-sdk
```

### Package Contents

```
@vibecode/plugin-sdk/
├── bin/
│   └── vibecode-sdk         # CLI executable
├── types/
│   ├── plugin.d.ts          # Plugin type definitions
│   ├── context.d.ts         # Context types
│   └── index.d.ts           # All exports
├── templates/               # Plugin templates
├── utils/                   # Development utilities
└── test/                    # Testing helpers
```

---

## Development Setup

### 1. Initialize Development Environment

Create a new plugin project:

```bash
vibecode-sdk init my-awesome-plugin
cd my-awesome-plugin
```

This creates the following structure:

```
my-awesome-plugin/
├── plugin.json              # Plugin manifest
├── index.ts                 # Entry point
├── tsconfig.json            # TypeScript config
├── package.json             # npm dependencies
├── README.md                # Documentation
├── .gitignore              # Git ignore rules
├── src/                     # Source code
│   ├── plugin.ts           # Plugin implementation
│   ├── types.ts            # Custom types
│   └── utils.ts            # Utility functions
├── tests/                   # Test files
│   ├── plugin.test.ts      # Unit tests
│   └── integration.test.ts # Integration tests
└── dist/                    # Build output (generated)
```

### 2. Configure TypeScript

Recommended `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node", "@vibecode/plugin-sdk"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Package Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "vibecode-sdk dev",
    "build": "vibecode-sdk build",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts",
    "validate": "vibecode-sdk validate",
    "package": "vibecode-sdk package",
    "publish": "vibecode-sdk publish"
  }
}
```

---

## Plugin Scaffolding

### Generate New Plugin

Interactive plugin generator:

```bash
vibecode-sdk create
```

**Prompts**:
- Plugin ID (e.g., `my-plugin`)
- Plugin name (e.g., `My Plugin`)
- Description
- Author information
- Plugin type (ai-model, integration, workflow, etc.)
- Required permissions
- Include example code? (yes/no)
- Use TypeScript? (yes/no)

### Template Options

Generate from specific templates:

```bash
# Basic plugin
vibecode-sdk create --template basic

# AI model provider
vibecode-sdk create --template ai-model

# Integration plugin
vibecode-sdk create --template integration

# Workflow automation
vibecode-sdk create --template workflow

# UI extension
vibecode-sdk create --template ui-extension
```

### Template Customization

Create custom templates in `.vibecode/templates/`:

```
.vibecode/templates/my-template/
├── plugin.json.template
├── index.ts.template
├── README.md.template
└── package.json.template
```

Use custom template:

```bash
vibecode-sdk create --template ./path/to/my-template
```

---

## TypeScript Types

### Core Type Imports

```typescript
import type {
  PluginAPI,
  PluginContext,
  PluginManifest,
  PluginCapabilities,
  PluginPermission,
  PluginLogger,
  PluginStatus,
  PluginType,
} from '@vibecode/plugin-sdk';
```

### Plugin API Interface

```typescript
interface PluginAPI {
  manifest: PluginManifest;
  capabilities: PluginCapabilities;
  initialize: (context: PluginContext) => Promise<void> | void;
  destroy: () => Promise<void> | void;
  onInstall?: () => Promise<void> | void;
  onUninstall?: () => Promise<void> | void;
  onEnable?: () => Promise<void> | void;
  onDisable?: () => Promise<void> | void;
  onUpdate?: (oldVersion: string, newVersion: string) => Promise<void> | void;
}
```

### Context Interface

```typescript
interface PluginContext {
  pluginId: string;
  pluginPath: string;
  dataPath: string;
  logger: PluginLogger;
  permissions: PluginPermission[];
  config: Record<string, unknown>;
  vibecode: VibeCodeAPI;
}
```

### VibeCode API Interface

```typescript
interface VibeCodeAPI {
  // Commands
  registerCommand: (id: string, handler: CommandHandler) => void;
  executeCommand: (id: string, ...args: unknown[]) => Promise<unknown>;

  // Settings
  getSettings: (key: string) => Promise<unknown>;
  updateSettings: (key: string, value: unknown) => Promise<void>;

  // Notifications
  showNotification: (message: string, type: NotificationType) => void;
  showProgress: (title: string, task: ProgressTask) => Promise<void>;

  // File System
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<void>;

  // Database
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;

  // AI Models
  invokeModel: (modelId: string, prompt: string) => Promise<string>;
}
```

### Type Guards

```typescript
import { isPluginManifest, isPluginContext } from '@vibecode/plugin-sdk/utils';

function validateManifest(obj: unknown): obj is PluginManifest {
  return isPluginManifest(obj);
}

function validateContext(obj: unknown): obj is PluginContext {
  return isPluginContext(obj);
}
```

### Custom Type Extensions

Extend SDK types for your plugin:

```typescript
import type { PluginContext } from '@vibecode/plugin-sdk';

// Extend context with custom properties
interface MyPluginContext extends PluginContext {
  customData: {
    apiKey: string;
    endpoint: string;
  };
}

// Use in plugin
export const plugin: PluginAPI = {
  async initialize(context: MyPluginContext) {
    const apiKey = context.customData.apiKey;
    // ...
  },
};
```

---

## Development Workflow

### 1. Local Development Mode

Start development server with hot reload:

```bash
vibecode-sdk dev
```

This runs your plugin in a local VibeCode instance with:
- Hot module reloading
- Real-time validation
- Debug logging
- Source maps

**Options**:
```bash
vibecode-sdk dev --port 3001          # Custom port
vibecode-sdk dev --watch ./src        # Custom watch path
vibecode-sdk dev --verbose            # Verbose logging
vibecode-sdk dev --no-validation      # Skip validation
```

### 2. File Watching

The dev server watches for changes and automatically:
- Recompiles TypeScript
- Validates manifest
- Reloads plugin
- Runs tests (optional)

Configure watching in `vibecode-sdk.config.js`:

```javascript
module.exports = {
  watch: {
    paths: ['src/**/*.ts', 'plugin.json'],
    ignore: ['node_modules/**', 'dist/**'],
    onchange: ['build', 'validate', 'test'],
  },
};
```

### 3. Linking for Development

Link plugin to local VibeCode instance:

```bash
vibecode-sdk link
```

Now the plugin appears in your VibeCode installation:

```bash
vibecode plugin list
# my-plugin (v0.0.1-dev) - Active [LINKED]
```

### 4. Unlinking

Remove development link:

```bash
vibecode-sdk unlink
```

### 5. Live Reload

Enable live reload in plugin code:

```typescript
export const plugin: PluginAPI = {
  async initialize(context: PluginContext) {
    if (process.env.NODE_ENV === 'development') {
      context.logger.debug('Development mode enabled');
      // Development-only code
    }
  },
};
```

### 6. Environment Variables

Create `.env` for development:

```env
NODE_ENV=development
VIBECODE_API_URL=http://localhost:3000
PLUGIN_DEBUG=true
API_KEY=dev_key_12345
```

Access in plugin:

```typescript
const apiKey = process.env.API_KEY;
const debug = process.env.PLUGIN_DEBUG === 'true';
```

---

## Testing Plugins

### Test Setup

Install testing dependencies:

```bash
npm install --save-dev jest @types/jest ts-jest
```

Configure Jest in `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

### Unit Tests

Test plugin logic in isolation:

```typescript
import { plugin } from '../src/plugin';
import { createMockContext } from '@vibecode/plugin-sdk/test';

describe('MyPlugin', () => {
  let context: PluginContext;

  beforeEach(() => {
    context = createMockContext({
      pluginId: 'test-plugin',
      permissions: ['filesystem:read'],
      config: { apiKey: 'test-key' },
    });
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      await expect(plugin.initialize(context)).resolves.not.toThrow();
    });

    it('should log initialization', async () => {
      await plugin.initialize(context);
      expect(context.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized')
      );
    });

    it('should handle missing config', async () => {
      context.config = {};
      await expect(plugin.initialize(context)).rejects.toThrow(
        'Missing API key'
      );
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', async () => {
      await plugin.initialize(context);
      await expect(plugin.destroy()).resolves.not.toThrow();
    });
  });
});
```

### Integration Tests

Test plugin with real VibeCode instance:

```typescript
import { PluginTestHarness } from '@vibecode/plugin-sdk/test';

describe('MyPlugin Integration', () => {
  let harness: PluginTestHarness;

  beforeAll(async () => {
    harness = await PluginTestHarness.create({
      pluginPath: __dirname + '/../',
      vibecodePath: process.env.VIBECODE_PATH,
    });
  });

  afterAll(async () => {
    await harness.teardown();
  });

  it('should register commands', async () => {
    const commands = await harness.getRegisteredCommands();
    expect(commands).toContain('my-plugin:hello');
  });

  it('should handle command execution', async () => {
    const result = await harness.executeCommand('my-plugin:hello', 'world');
    expect(result).toBe('Hello, world!');
  });
});
```

### Mock Utilities

SDK provides mocking helpers:

```typescript
import {
  createMockContext,
  createMockLogger,
  createMockVibeCodeAPI,
} from '@vibecode/plugin-sdk/test';

// Mock context
const context = createMockContext({
  pluginId: 'test-plugin',
  permissions: ['network:outbound'],
});

// Mock logger
const logger = createMockLogger();
logger.info('test message');
expect(logger.info).toHaveBeenCalled();

// Mock VibeCode API
const api = createMockVibeCodeAPI();
api.registerCommand('test', async () => 'result');
```

### Coverage Reports

Generate coverage:

```bash
npm test -- --coverage
```

**Output**:
```
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   95.12 |    88.23 |   91.66 |   95.83 |
 plugin.ts          |   98.50 |    92.30 |  100.00 |   98.33 | 45-47
 utils.ts           |   90.00 |    80.00 |   85.71 |   91.66 | 23,67
--------------------|---------|----------|---------|---------|-------------------
```

### Continuous Testing

Watch mode for TDD:

```bash
npm test -- --watch
```

---

## Debugging

### Debug Configuration

#### VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Plugin",
      "program": "${workspaceFolder}/node_modules/@vibecode/plugin-sdk/bin/vibecode-sdk",
      "args": ["dev", "--debug"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true,
      "smartStep": true,
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/jest/bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

#### WebStorm / IntelliJ

Create run configuration:
- **Type**: Node.js
- **Node parameters**: `--inspect`
- **JavaScript file**: `node_modules/@vibecode/plugin-sdk/bin/vibecode-sdk`
- **Application parameters**: `dev --debug`

### Logging

Use structured logging:

```typescript
async initialize(context: PluginContext) {
  const { logger } = context;

  // Debug logs (development only)
  logger.debug('Initializing plugin', {
    pluginId: context.pluginId,
    permissions: context.permissions,
  });

  // Info logs
  logger.info('Plugin started', { version: this.manifest.version });

  // Warning logs
  logger.warn('Deprecated feature used', { feature: 'oldAPI' });

  // Error logs
  try {
    await this.connect();
  } catch (error) {
    logger.error('Connection failed', {
      error,
      endpoint: this.endpoint,
    });
    throw error;
  }
}
```

### Log Levels

Set log level for debugging:

```bash
VIBECODE_LOG_LEVEL=debug vibecode-sdk dev
```

Levels: `error`, `warn`, `info`, `debug`

### Breakpoint Debugging

Set breakpoints in TypeScript source:

```typescript
async initialize(context: PluginContext) {
  debugger; // Execution pauses here when debugging

  const config = context.config;
  // Step through code...
}
```

### Remote Debugging

Debug plugin in production:

```bash
vibecode-sdk attach --plugin-id my-plugin --debug-port 9229
```

Connect Chrome DevTools to `chrome://inspect`

### Profiling

Profile plugin performance:

```typescript
import { performance } from 'perf_hooks';

async initialize(context: PluginContext) {
  const start = performance.now();

  // Plugin initialization...

  const duration = performance.now() - start;
  context.logger.info('Initialization complete', { duration });
}
```

Generate CPU profile:

```bash
vibecode-sdk dev --profile
```

---

## Building & Packaging

### Build Plugin

Compile TypeScript and bundle:

```bash
vibecode-sdk build
```

**Output**:
```
dist/
├── index.js              # Compiled entry point
├── index.js.map          # Source map
├── plugin.json           # Manifest (copied)
├── package.json          # Package metadata (copied)
└── README.md             # Documentation (copied)
```

### Build Options

```bash
vibecode-sdk build --watch              # Watch mode
vibecode-sdk build --production         # Production optimizations
vibecode-sdk build --sourcemaps false   # Disable source maps
vibecode-sdk build --minify             # Minify output
```

### Custom Build Configuration

Create `vibecode-sdk.config.js`:

```javascript
module.exports = {
  build: {
    entry: './src/index.ts',
    outDir: './dist',
    target: 'node18',
    sourceMaps: true,
    minify: false,
    bundle: true,
    external: ['@vibecode/plugin-sdk'],
    plugins: [],
  },
};
```

### Package Plugin

Create distributable archive:

```bash
vibecode-sdk package
```

**Output**: `my-plugin-1.0.0.zip`

**Contents**:
```
my-plugin-1.0.0.zip
├── plugin.json
├── index.js
├── package.json
├── README.md
└── LICENSE
```

### Package Validation

Validate package before distribution:

```bash
vibecode-sdk validate ./my-plugin-1.0.0.zip
```

**Checks**:
- ✓ Manifest schema
- ✓ Entry point exists
- ✓ Required fields present
- ✓ Valid permissions
- ✓ Version format
- ✓ No dangerous files

---

## Publishing Plugins

### Registry Setup

Configure plugin registry:

```bash
vibecode-sdk config set registry https://plugins.vibecode.io
vibecode-sdk login
```

### Publish Plugin

Publish to official registry:

```bash
vibecode-sdk publish
```

**Steps**:
1. Validates plugin
2. Builds production bundle
3. Runs tests
4. Creates package
5. Uploads to registry
6. Tags version in git

### Publishing Options

```bash
vibecode-sdk publish --tag beta           # Publish as beta
vibecode-sdk publish --access public      # Public package
vibecode-sdk publish --access private     # Private package
vibecode-sdk publish --dry-run            # Test without publishing
```

### Version Management

Update version before publishing:

```bash
# Bump patch version (1.0.0 -> 1.0.1)
vibecode-sdk version patch

# Bump minor version (1.0.0 -> 1.1.0)
vibecode-sdk version minor

# Bump major version (1.0.0 -> 2.0.0)
vibecode-sdk version major

# Set specific version
vibecode-sdk version 1.2.3
```

### Pre-publish Checklist

Automated checks before publishing:

```javascript
// package.json
{
  "scripts": {
    "prepublish": "npm run lint && npm test && npm run build"
  }
}
```

### Publishing to GitHub

Publish as GitHub release:

```bash
vibecode-sdk publish --github
```

Creates:
- GitHub release
- Attached plugin package
- Release notes from changelog

### Publishing to npm

Publish to npm registry:

```bash
vibecode-sdk publish --npm
```

### Private Registry

Publish to private registry:

```bash
vibecode-sdk config set registry https://registry.mycompany.com
vibecode-sdk publish --registry private
```

---

## SDK Utilities

### Manifest Utilities

```typescript
import {
  validateManifest,
  readManifest,
  updateManifest,
} from '@vibecode/plugin-sdk/utils';

// Validate manifest
const isValid = validateManifest(manifest);

// Read manifest from file
const manifest = await readManifest('./plugin.json');

// Update manifest fields
await updateManifest('./plugin.json', {
  version: '1.1.0',
  permissions: [...manifest.permissions, 'network:outbound'],
});
```

### Plugin Loader

Load and test plugin programmatically:

```typescript
import { PluginLoader } from '@vibecode/plugin-sdk/loader';

const loader = new PluginLoader();
const plugin = await loader.load('./path/to/plugin');

// Access plugin
console.log(plugin.manifest.name);
console.log(plugin.capabilities);

// Test lifecycle
await plugin.initialize(mockContext);
await plugin.destroy();
```

### Validation Utilities

```typescript
import {
  validatePermissions,
  validateVersion,
  validatePluginId,
} from '@vibecode/plugin-sdk/validators';

// Validate permissions
const valid = validatePermissions(['filesystem:read', 'network:outbound']);

// Validate semantic version
const validVersion = validateVersion('1.2.3'); // true
const invalidVersion = validateVersion('1.2'); // false

// Validate plugin ID
const validId = validatePluginId('my-plugin'); // true
const invalidId = validatePluginId('My_Plugin!'); // false
```

### File System Helpers

```typescript
import { createDataDir, cleanupDataDir } from '@vibecode/plugin-sdk/fs';

// Create plugin data directory
const dataPath = await createDataDir('my-plugin');

// Cleanup data directory
await cleanupDataDir('my-plugin');
```

### Template Engine

```typescript
import { renderTemplate } from '@vibecode/plugin-sdk/templates';

const code = renderTemplate('ai-model', {
  pluginId: 'custom-ai',
  modelName: 'GPT-4',
  apiEndpoint: 'https://api.example.com',
});
```

---

## Common Patterns

### Configuration Management

```typescript
import type { PluginAPI, PluginContext } from '@vibecode/plugin-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

interface PluginConfig {
  apiKey: string;
  endpoint: string;
  timeout: number;
}

export const plugin: PluginAPI = {
  // ...

  async initialize(context: PluginContext) {
    const config = await this.loadConfig(context);
    // Use config...
  },

  async loadConfig(context: PluginContext): Promise<PluginConfig> {
    const configPath = path.join(context.dataPath, 'config.json');

    try {
      const data = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(data) as PluginConfig;
    } catch (error) {
      // Return defaults if config doesn't exist
      return {
        apiKey: process.env.API_KEY || '',
        endpoint: 'https://api.example.com',
        timeout: 5000,
      };
    }
  },

  async saveConfig(
    context: PluginContext,
    config: PluginConfig
  ): Promise<void> {
    const configPath = path.join(context.dataPath, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  },
};
```

### State Management

```typescript
class PluginState {
  private state: Map<string, unknown> = new Map();

  get<T>(key: string): T | undefined {
    return this.state.get(key) as T;
  }

  set<T>(key: string, value: T): void {
    this.state.set(key, value);
  }

  delete(key: string): void {
    this.state.delete(key);
  }

  clear(): void {
    this.state.clear();
  }
}

export const plugin: PluginAPI = {
  state: new PluginState(),

  async initialize(context: PluginContext) {
    this.state.set('initialized', true);
    this.state.set('startTime', Date.now());
  },

  async destroy() {
    this.state.clear();
  },
};
```

### Event Handling

```typescript
import { EventEmitter } from 'events';

class MyPlugin extends EventEmitter implements PluginAPI {
  async initialize(context: PluginContext) {
    // Register event listeners
    this.on('data', this.handleData);
    this.on('error', this.handleError);

    // Emit events
    this.emit('initialized', { pluginId: context.pluginId });
  }

  private handleData(data: unknown): void {
    console.log('Data received:', data);
  }

  private handleError(error: Error): void {
    console.error('Error occurred:', error);
  }

  async destroy() {
    this.removeAllListeners();
  }
}

export const plugin = new MyPlugin();
```

### Caching Strategy

```typescript
class Cache<T> {
  private cache: Map<string, { value: T; expires: number }> = new Map();
  private ttl: number;

  constructor(ttlMs: number = 60000) {
    this.ttl = ttlMs;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl,
    });
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const plugin: PluginAPI = {
  cache: new Cache(300000), // 5 minutes

  async fetchData(url: string): Promise<Data> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) return cached;

    // Fetch and cache
    const data = await fetch(url).then((r) => r.json());
    this.cache.set(url, data);
    return data;
  },

  async destroy() {
    this.cache.clear();
  },
};
```

### Async Queue

```typescript
class AsyncQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = false;

  async add(task: () => Promise<void>): Promise<void> {
    this.queue.push(task);
    if (!this.running) {
      await this.process();
    }
  }

  private async process(): Promise<void> {
    this.running = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('Task failed:', error);
        }
      }
    }

    this.running = false;
  }
}

export const plugin: PluginAPI = {
  queue: new AsyncQueue(),

  async initialize(context: PluginContext) {
    // Queue tasks for sequential execution
    await this.queue.add(() => this.loadConfig(context));
    await this.queue.add(() => this.connectDatabase());
    await this.queue.add(() => this.startServices());
  },
};
```

---

## Migration Guide

### From v0.x to v1.x

**Breaking Changes**:

1. **Manifest Schema**: New required fields
2. **Permissions**: Granular permission model
3. **Lifecycle Hooks**: Renamed methods
4. **TypeScript**: Strict mode required

**Migration Steps**:

#### 1. Update Manifest

```diff
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
+ "description": "Plugin description",
+ "author": {
+   "name": "Your Name",
+   "email": "you@example.com"
+ },
+ "type": "other",
  "main": "index.ts",
- "permission": "all",
+ "permissions": [
+   "filesystem:read",
+   "network:outbound"
+ ]
}
```

#### 2. Update Plugin Interface

```diff
-export const plugin = {
+export const plugin: PluginAPI = {
  manifest: require('./plugin.json'),
+ capabilities: {
+   providesCommands: true,
+   providesAIModel: false,
+   // ... other capabilities
+ },
- setup(context) {
+ async initialize(context: PluginContext) {
    // Initialization code
  },
- teardown() {
+ async destroy() {
    // Cleanup code
  },
};
```

#### 3. Update Dependencies

```bash
npm install --save-dev @vibecode/plugin-sdk@latest
npm install --save-dev typescript@latest
```

#### 4. Run Migration Tool

```bash
vibecode-sdk migrate --from 0.x --to 1.x
```

### Automated Migration

```bash
vibecode-sdk migrate --interactive
```

Prompts through each breaking change and provides fixes.

---

## Troubleshooting

### SDK Installation Issues

**Problem**: `command not found: vibecode-sdk`

**Solution**:
```bash
# Ensure global install
npm install -g @vibecode/plugin-sdk

# Or use npx
npx @vibecode/plugin-sdk --version
```

### TypeScript Compilation Errors

**Problem**: `Cannot find module '@vibecode/plugin-sdk'`

**Solution**:
```bash
# Install types
npm install --save-dev @vibecode/plugin-sdk

# Verify tsconfig.json includes types
{
  "compilerOptions": {
    "types": ["@vibecode/plugin-sdk"]
  }
}
```

### Build Failures

**Problem**: Build fails with module resolution errors

**Solution**:
```bash
# Clear build cache
rm -rf dist/ node_modules/.cache

# Rebuild
npm run build
```

### Hot Reload Not Working

**Problem**: Changes don't trigger reload in dev mode

**Solution**:
```bash
# Restart dev server
vibecode-sdk dev --force-reload

# Check watch configuration
vibecode-sdk dev --verbose
```

### Test Failures

**Problem**: Mock context missing required properties

**Solution**:
```typescript
// Provide complete mock context
const context = createMockContext({
  pluginId: 'test',
  pluginPath: '/path',
  dataPath: '/data',
  permissions: ['filesystem:read'],
  config: {},
  logger: createMockLogger(),
  vibecode: createMockVibeCodeAPI(),
});
```

### Packaging Errors

**Problem**: Package validation fails

**Solution**:
```bash
# Validate manifest first
vibecode-sdk validate

# Check for invalid permissions
# Check version format
# Ensure all required files exist
```

### Debug Breakpoints Not Hit

**Problem**: Breakpoints ignored in VS Code

**Solution**:
```json
// Ensure source maps enabled in tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSourceMap": false
  }
}

// Rebuild with source maps
npm run build
```

---

## Additional Resources

- [Plugin API Documentation](./PLUGIN_API.md)
- [SDK API Reference](https://docs.vibecode.io/sdk)
- [Example Plugins](../plugins/examples/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Testing Best Practices](https://jestjs.io/docs/getting-started)
- [GitHub Discussions](https://github.com/vibecode/plugins/discussions)

---

## Contributing to SDK

We welcome contributions! See:

- [SDK Contributing Guide](../CONTRIBUTING.md#sdk-development)
- [SDK Architecture](./SDK_ARCHITECTURE.md)
- [Issue Templates](https://github.com/vibecode/plugin-sdk/issues/new/choose)

---

## Support

- **Documentation**: https://docs.vibecode.io/plugins
- **Discord**: https://discord.gg/vibecode
- **GitHub Issues**: https://github.com/vibecode/plugin-sdk/issues
- **Email**: plugins@vibecode.io

---

**Last Updated**: February 21, 2026
**SDK Version**: 1.0.0
