# Plugin API Documentation

VibeCode's extensible plugin system allows developers to add custom AI models, integrations, workflow automations, and UI extensions to enhance the platform's capabilities.

## Table of Contents

- [Overview](#overview)
- [Plugin Architecture](#plugin-architecture)
- [Getting Started](#getting-started)
- [Plugin Manifest](#plugin-manifest)
- [Plugin API Interface](#plugin-api-interface)
- [Plugin Types](#plugin-types)
- [Permissions System](#permissions-system)
- [Plugin Lifecycle](#plugin-lifecycle)
- [Plugin Context](#plugin-context)
- [Installation Methods](#installation-methods)
- [REST API Endpoints](#rest-api-endpoints)
- [CLI Commands](#cli-commands)
- [Security & Sandboxing](#security--sandboxing)
- [Example Plugins](#example-plugins)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The VibeCode plugin system enables:

- **Custom AI Models**: Integrate your own AI providers and models
- **Third-Party Integrations**: Connect with external tools and services
- **Workflow Automation**: Create automated tasks and workflows
- **UI Extensions**: Add custom components and functionality
- **Code Tools**: Build custom formatters, linters, and generators

### Key Features

- 🔒 **Sandboxed Execution**: Secure plugin isolation with permission-based access
- 📦 **Simple Packaging**: Standard manifest format with npm-style dependencies
- 🔌 **Hot Loading**: Install and enable plugins without restarts
- 🎯 **Type Safety**: Full TypeScript support with comprehensive types
- 📊 **Event System**: React to plugin lifecycle events
- 🛠️ **Multiple Installation Methods**: UI, CLI, or API-based installation

---

## Plugin Architecture

```mermaid
graph TB
    subgraph "Plugin Layer"
        Plugin[Plugin Code]
        Manifest[plugin.json]
    end

    subgraph "Plugin Manager"
        Loader[Plugin Loader]
        Registry[Plugin Registry]
        Validator[Manifest Validator]
        Sandbox[Security Sandbox]
    end

    subgraph "VibeCode Core"
        API[REST API]
        CLI[CLI Commands]
        UI[Plugin Manager UI]
        Database[(PostgreSQL)]
    end

    Plugin --> Loader
    Manifest --> Validator
    Validator --> Loader
    Loader --> Registry
    Loader --> Sandbox
    Registry --> Database
    API --> Loader
    CLI --> Loader
    UI --> API
```

### Component Overview

| Component | Purpose |
|-----------|---------|
| **Plugin Loader** | Loads plugin code and initializes instances |
| **Plugin Registry** | Tracks installed plugins in memory |
| **Manifest Validator** | Validates plugin.json schema and requirements |
| **Security Sandbox** | Executes plugins in isolated environment |
| **Plugin Manager** | Coordinates installation, lifecycle, and updates |

---

## Getting Started

### Quick Start

1. **Create a plugin directory**:
```bash
mkdir my-plugin
cd my-plugin
```

2. **Create `plugin.json` manifest**:
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "type": "other",
  "main": "index.ts",
  "permissions": ["commands:register"]
}
```

3. **Create `index.ts` implementation**:
```typescript
import type { PluginAPI, PluginContext } from '@vibecode/plugin-types';

export const plugin: PluginAPI = {
  manifest: require('./plugin.json'),

  capabilities: {
    providesCommands: true,
    providesAIModel: false,
    providesIntegration: false,
    providesUIComponents: false,
    providesCodeActions: false,
    providesWorkflows: false,
    providesFormatters: false,
    providesLinters: false,
  },

  async initialize(context: PluginContext) {
    context.logger.info('Plugin initialized!');
    // Your initialization code
  },

  async destroy() {
    // Cleanup code
  },
};
```

4. **Install the plugin**:
```bash
vibecode plugin install ./my-plugin
```

---

## Plugin Manifest

The `plugin.json` manifest defines plugin metadata, requirements, and permissions.

### Schema

```typescript
interface PluginManifest {
  // Required fields
  id: string;                          // Unique identifier (lowercase, hyphens)
  name: string;                        // Display name
  version: string;                     // Semantic version (e.g., "1.0.0")
  description: string;                 // Brief description
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  type: PluginType;                    // Plugin category
  main: string;                        // Entry point file
  permissions: PluginPermission[];     // Required permissions

  // Optional fields
  dependencies?: Record<string, string>;      // npm dependencies
  peerDependencies?: Record<string, string>;  // Peer dependencies
  engines?: {
    node?: string;                     // Node.js version requirement
    vibecode?: string;                 // VibeCode version requirement
  };
  repository?: {
    type: string;                      // e.g., "git"
    url: string;
  };
  license?: string;                    // SPDX license identifier
  keywords?: string[];                 // Searchable keywords
  homepage?: string;                   // Plugin homepage URL
  icon?: string;                       // Icon URL or path
}
```

### Example Manifest

```json
{
  "id": "custom-ai-model",
  "name": "Custom AI Model Provider",
  "version": "1.0.0",
  "description": "Integrates custom AI models with VibeCode",
  "author": {
    "name": "AI Team",
    "email": "ai@example.com",
    "url": "https://example.com"
  },
  "type": "ai-model",
  "main": "index.ts",
  "permissions": [
    "ai-models:access",
    "network:outbound",
    "settings:read"
  ],
  "engines": {
    "node": ">=18.0.0",
    "vibecode": ">=1.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/example/custom-ai-model"
  },
  "license": "MIT",
  "keywords": ["ai", "llm", "custom-model"],
  "homepage": "https://example.com/docs",
  "icon": "https://example.com/icon.png"
}
```

### Validation Rules

- **`id`**: Must be lowercase, alphanumeric with hyphens only
- **`version`**: Must follow semantic versioning (MAJOR.MINOR.PATCH)
- **`type`**: Must be a valid PluginType
- **`main`**: Must point to an existing file
- **`permissions`**: Each permission must be a valid PluginPermission

---

## Plugin API Interface

Every plugin must export a `PluginAPI` object implementing the following interface:

```typescript
interface PluginAPI {
  // Required
  manifest: PluginManifest;
  capabilities: PluginCapabilities;
  initialize: (context: PluginContext) => Promise<void> | void;
  destroy: () => Promise<void> | void;

  // Optional lifecycle hooks
  onInstall?: () => Promise<void> | void;
  onUninstall?: () => Promise<void> | void;
  onEnable?: () => Promise<void> | void;
  onDisable?: () => Promise<void> | void;
  onUpdate?: (oldVersion: string, newVersion: string) => Promise<void> | void;
}
```

### Capabilities

Define what your plugin provides:

```typescript
interface PluginCapabilities {
  providesAIModel: boolean;        // Adds custom AI model
  providesIntegration: boolean;    // Integrates external service
  providesCommands: boolean;       // Adds custom commands
  providesUIComponents: boolean;   // Adds UI components
  providesCodeActions: boolean;    // Adds code actions/quick fixes
  providesWorkflows: boolean;      // Adds workflow automations
  providesFormatters: boolean;     // Adds code formatters
  providesLinters: boolean;        // Adds linters/analyzers
}
```

### Example Implementation

```typescript
import type { PluginAPI, PluginContext } from '@vibecode/plugin-types';

export const plugin: PluginAPI = {
  manifest: require('./plugin.json'),

  capabilities: {
    providesAIModel: true,
    providesIntegration: false,
    providesCommands: false,
    providesUIComponents: false,
    providesCodeActions: false,
    providesWorkflows: false,
    providesFormatters: false,
    providesLinters: false,
  },

  async initialize(context: PluginContext) {
    context.logger.info('Initializing AI model plugin');
    // Register AI provider
    // Set up event listeners
  },

  async destroy() {
    // Cleanup resources
    // Unregister providers
  },

  async onInstall() {
    // First-time setup
    // Create configuration files
  },

  async onEnable() {
    // Called when plugin is enabled
  },

  async onDisable() {
    // Called when plugin is disabled
  },

  async onUpdate(oldVersion: string, newVersion: string) {
    // Handle version migrations
    console.log(`Updating from ${oldVersion} to ${newVersion}`);
  },

  async onUninstall() {
    // Final cleanup
    // Remove configuration files
  },
};
```

---

## Plugin Types

Plugins are categorized by their primary function:

```typescript
type PluginType =
  | 'ai-model'           // Custom AI model providers
  | 'integration'        // Third-party tool integrations
  | 'workflow'           // Workflow automation plugins
  | 'ui-extension'       // UI enhancements
  | 'code-generator'     // Code generation and scaffolding
  | 'linter'            // Custom linting and code analysis
  | 'formatter'         // Code formatting plugins
  | 'other'             // General purpose plugins
```

### Type-Specific Guidelines

#### AI Model Plugins (`ai-model`)

Required capabilities:
- `providesAIModel: true`

Required permissions:
- `ai-models:access`
- `network:outbound` (if calling external APIs)

Example:
```typescript
// Register custom AI provider
const provider = {
  id: 'my-ai-provider',
  name: 'My AI Provider',
  models: [
    {
      id: 'my-model-v1',
      name: 'My Model v1',
      contextWindow: 4096,
      pricing: { input: 0.001, output: 0.002 }
    }
  ]
};
```

#### Workflow Plugins (`workflow`)

Required capabilities:
- `providesWorkflows: true`

Common permissions:
- `commands:register`
- `filesystem:read`
- `filesystem:write`
- `settings:read`

#### UI Extension Plugins (`ui-extension`)

Required capabilities:
- `providesUIComponents: true`

Required permissions:
- `ui:inject`

---

## Permissions System

Plugins must declare all required permissions in their manifest. The sandbox enforces these permissions at runtime.

### Available Permissions

```typescript
type PluginPermission =
  | 'filesystem:read'    // Read filesystem access
  | 'filesystem:write'   // Write filesystem access
  | 'network:outbound'   // Make outbound network requests
  | 'database:read'      // Read database access
  | 'database:write'     // Write database access
  | 'ai-models:access'   // Access to AI model APIs
  | 'ui:inject'          // Inject UI components
  | 'commands:register'  // Register custom commands
  | 'settings:read'      // Read user settings
  | 'settings:write'     // Modify user settings
```

### Permission Risk Levels

| Permission | Risk | Description |
|------------|------|-------------|
| `filesystem:read` | Medium | Can read files in allowed paths |
| `filesystem:write` | High | Can modify/create files |
| `network:outbound` | Medium | Can make HTTP requests to allowed hosts |
| `database:read` | Medium | Can query database |
| `database:write` | High | Can modify database |
| `ai-models:access` | Low | Can use AI models |
| `ui:inject` | Medium | Can modify UI |
| `commands:register` | Low | Can add commands |
| `settings:read` | Low | Can read settings |
| `settings:write` | Medium | Can modify settings |

### Permission Validation

The plugin system validates permissions:

```typescript
// Automatically validated on install
{
  "permissions": [
    "filesystem:read",
    "network:outbound"
  ]
}

// Invalid permissions are rejected
{
  "permissions": [
    "invalid:permission"  // ❌ Installation fails
  ]
}
```

### Permission Prerequisites

Some permissions require others:

- `database:write` requires `database:read`
- `settings:write` requires `settings:read`
- `filesystem:write` requires `filesystem:read`

### Permission Conflicts

Certain combinations are not allowed:

- `filesystem:write` + `network:outbound` requires manual review (data exfiltration risk)

---

## Plugin Lifecycle

Plugins go through several lifecycle states and events:

### Plugin Status

```typescript
type PluginStatus =
  | 'active'            // Plugin is installed and enabled
  | 'inactive'          // Plugin is installed but disabled
  | 'error'             // Plugin encountered an error
  | 'installing'        // Plugin is being installed
  | 'uninstalling'      // Plugin is being uninstalled
```

### Lifecycle Events

```mermaid
graph LR
    Install[onInstall] --> Enable[onEnable]
    Enable --> Initialize[initialize]
    Initialize --> Active[Active]
    Active --> Disable[onDisable]
    Disable --> Inactive[Inactive]
    Inactive --> Enable
    Active --> Update[onUpdate]
    Update --> Active
    Inactive --> Uninstall[onUninstall]
    Active --> Destroy[destroy]
    Destroy --> Uninstall
```

### Lifecycle Hooks

#### `onInstall()`
Called once when plugin is first installed.

**Use case**: One-time setup, create config files

```typescript
async onInstall() {
  // Create plugin data directory
  await fs.mkdir(this.context.dataPath, { recursive: true });

  // Create default configuration
  const defaultConfig = { enabled: true };
  await fs.writeFile(
    path.join(this.context.dataPath, 'config.json'),
    JSON.stringify(defaultConfig, null, 2)
  );
}
```

#### `initialize(context)`
Called when plugin is loaded (on enable or startup).

**Use case**: Set up runtime resources, register providers

```typescript
async initialize(context: PluginContext) {
  this.context = context;
  this.logger = context.logger;

  // Register event listeners
  // Initialize connections
  // Load cached data
}
```

#### `onEnable()`
Called when plugin is explicitly enabled by user.

**Use case**: Start background tasks, enable features

```typescript
async onEnable() {
  this.logger.info('Plugin enabled');
  // Start scheduled tasks
  // Enable integrations
}
```

#### `onDisable()`
Called when plugin is disabled by user.

**Use case**: Stop background tasks, disable features

```typescript
async onDisable() {
  this.logger.info('Plugin disabled');
  // Stop scheduled tasks
  // Disable integrations
}
```

#### `onUpdate(oldVersion, newVersion)`
Called when plugin is updated to a new version.

**Use case**: Migrate data, update configurations

```typescript
async onUpdate(oldVersion: string, newVersion: string) {
  if (oldVersion === '1.0.0' && newVersion === '2.0.0') {
    // Migrate config format
    await this.migrateConfig();
  }
}
```

#### `destroy()`
Called before plugin is unloaded.

**Use case**: Cleanup resources, close connections

```typescript
async destroy() {
  // Close database connections
  // Clear caches
  // Remove event listeners
}
```

#### `onUninstall()`
Called when plugin is completely removed.

**Use case**: Final cleanup, remove all data

```typescript
async onUninstall() {
  // Remove plugin data directory
  await fs.rm(this.context.dataPath, { recursive: true });

  // Clean up any external resources
}
```

---

## Plugin Context

The `PluginContext` object is provided to plugins during initialization:

```typescript
interface PluginContext {
  pluginId: string;                   // Plugin unique ID
  pluginPath: string;                 // Plugin installation directory
  dataPath: string;                   // Plugin-specific data directory
  logger: PluginLogger;               // Logger instance
  permissions: PluginPermission[];    // Granted permissions
  config: Record<string, unknown>;    // Plugin configuration
}
```

### Using Context

```typescript
async initialize(context: PluginContext) {
  // Access plugin ID
  const id = context.pluginId;

  // Use logger
  context.logger.info('Plugin starting', { id });
  context.logger.error('Something failed', { error: new Error() });

  // Access data directory
  const dataFile = path.join(context.dataPath, 'data.json');

  // Check permissions
  if (context.permissions.includes('filesystem:write')) {
    await fs.writeFile(dataFile, JSON.stringify({ foo: 'bar' }));
  }

  // Access configuration
  const apiKey = context.config.apiKey as string;
}
```

### Logger Interface

```typescript
interface PluginLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}
```

**Example**:
```typescript
context.logger.info('Processing started', { taskId: 123 });
context.logger.error('Failed to process', { error: err, taskId: 123 });
```

---

## Installation Methods

### 1. Via CLI

Install from local directory:
```bash
vibecode plugin install ./plugins/my-plugin
```

Install from URL:
```bash
vibecode plugin install https://example.com/my-plugin.zip
```

Install with options:
```bash
vibecode plugin install ./my-plugin --force --auto-enable
```

### 2. Via UI

1. Navigate to `/plugins` in VibeCode
2. Click "Install Plugin"
3. Choose installation method:
   - **Upload ZIP**: Drag and drop plugin archive
   - **From URL**: Enter plugin URL
4. Configure options:
   - Force overwrite existing
   - Skip validation
   - Auto-enable after install
5. Click "Install"

### 3. Via API

**Install from URL**:
```bash
curl -X POST http://localhost:3000/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://example.com/my-plugin.zip",
    "autoEnable": true
  }'
```

**Install from file upload**:
```bash
curl -X POST http://localhost:3000/api/plugins/install \
  -F "file=@my-plugin.zip" \
  -F "autoEnable=true"
```

### Installation Options

```typescript
interface PluginInstallOptions {
  source: string;           // URL, file path, or npm package
  version?: string;         // Specific version to install
  force?: boolean;          // Overwrite if exists
  skipValidation?: boolean; // Skip manifest validation (dangerous)
  autoEnable?: boolean;     // Enable after installation
}
```

---

## REST API Endpoints

### List Plugins

**GET** `/api/plugins`

Query parameters:
- `type` - Filter by plugin type
- `status` - Filter by status (active, inactive, error)
- `keyword` - Search by keyword
- `author` - Filter by author name

**Response**:
```json
{
  "success": true,
  "plugins": [
    {
      "id": "hello-world",
      "name": "Hello World",
      "version": "1.0.0",
      "description": "A simple example plugin",
      "author": {
        "name": "VibeCode Team"
      },
      "status": "active",
      "capabilities": {
        "providesCommands": true,
        "providesAIModel": false
      },
      "permissions": ["commands:register"],
      "icon": null,
      "homepage": null
    }
  ],
  "total": 1
}
```

### Get Plugin Details

**GET** `/api/plugins/:id`

**Response**:
```json
{
  "success": true,
  "plugin": {
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0",
    "description": "A simple example plugin",
    "status": "active",
    "installedAt": "2026-02-14T12:00:00Z",
    "updatedAt": "2026-02-14T12:00:00Z"
  }
}
```

### Install Plugin

**POST** `/api/plugins/install`

**Content-Type**: `application/json` or `multipart/form-data`

**JSON Body**:
```json
{
  "source": "https://example.com/my-plugin.zip",
  "version": "1.0.0",
  "force": false,
  "skipValidation": false,
  "autoEnable": true
}
```

**File Upload (multipart/form-data)**:
```
file: <plugin.zip>
autoEnable: true
force: false
```

**Response**:
```json
{
  "success": true,
  "pluginId": "my-plugin",
  "warnings": []
}
```

### Enable/Disable Plugin

**POST** `/api/plugins`

**Body**:
```json
{
  "action": "enable",
  "pluginId": "hello-world"
}
```

Actions: `enable`, `disable`

**Response**:
```json
{
  "success": true,
  "message": "Plugin 'hello-world' enabled successfully"
}
```

### Uninstall Plugin

**DELETE** `/api/plugins/:id`

**Response**:
```json
{
  "success": true,
  "message": "Plugin 'hello-world' uninstalled successfully"
}
```

### Rate Limiting

All API endpoints are rate-limited to **60 requests per minute** per IP address.

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1708012800
Retry-After: 60
```

---

## CLI Commands

The `vibecode` CLI provides plugin management commands:

### List Plugins

```bash
vibecode plugin list
```

**Output**:
```
Installed Plugins:
  hello-world (v1.0.0) - Active
  custom-model (v1.0.0) - Inactive
  workflow-automation (v1.0.0) - Active
```

### Install Plugin

```bash
vibecode plugin install <source>
```

**Examples**:
```bash
# From local directory
vibecode plugin install ./plugins/my-plugin

# From URL
vibecode plugin install https://example.com/my-plugin.zip

# With force overwrite
vibecode plugin install ./my-plugin --force
```

### Uninstall Plugin

```bash
vibecode plugin uninstall <plugin-id>
```

**Example**:
```bash
vibecode plugin uninstall hello-world
```

### Get Help

```bash
vibecode plugin --help
```

---

## Security & Sandboxing

### Sandbox Execution

All plugins run in a **sandboxed environment** with restricted access:

```typescript
interface PluginSandboxConfig {
  timeout: number;              // Execution timeout in ms (default: 30000)
  memoryLimit: number;          // Memory limit in MB (default: 512)
  cpuLimit?: number;            // CPU time limit
  allowedPaths: string[];       // Filesystem paths plugin can access
  allowedHosts: string[];       // Network hosts plugin can access
}
```

### Sandbox Restrictions

- **Filesystem**: Only allowed paths are accessible
- **Network**: Only allowed hosts can be reached
- **Memory**: Hard limit enforced (default 512MB)
- **CPU**: Timeout after 30 seconds (configurable)
- **Modules**: Only safe Node.js modules are importable

### Permission Enforcement

```typescript
// Filesystem access - checked at runtime
if (!hasPermission('filesystem:read')) {
  throw new Error('Permission denied: filesystem:read');
}

// Network access - validated against allowedHosts
if (!allowedHosts.includes(hostname)) {
  throw new Error('Permission denied: host not allowed');
}
```

### Security Best Practices

1. **Principle of Least Privilege**: Only request necessary permissions
2. **Validate Inputs**: Always validate external data
3. **Handle Errors**: Use try-catch blocks
4. **Secure Dependencies**: Audit npm packages
5. **No Hardcoded Secrets**: Use environment variables
6. **Timeout Long Operations**: Prevent hanging

**Example**:
```typescript
async initialize(context: PluginContext) {
  try {
    // Validate configuration
    if (!context.config.apiKey) {
      throw new Error('Missing API key in configuration');
    }

    // Use timeout for external calls
    const response = await Promise.race([
      fetch('https://api.example.com'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    ]);
  } catch (error) {
    context.logger.error('Initialization failed', { error });
    throw error;
  }
}
```

### Dangerous Permissions

Plugins requesting these permission combinations require manual review:

- `filesystem:write` + `network:outbound` (data exfiltration risk)
- `database:write` + `network:outbound` (data leak risk)
- `settings:write` + `ui:inject` (UI spoofing risk)

---

## Example Plugins

### Hello World Plugin

Demonstrates basic plugin structure and lifecycle hooks.

**Location**: `plugins/examples/hello-world/`

**Features**:
- Minimal manifest
- Lifecycle logging
- Command registration
- Context usage

**Installation**:
```bash
vibecode plugin install ./plugins/examples/hello-world
```

See: [hello-world/README.md](../plugins/examples/hello-world/README.md)

---

### Custom AI Model Plugin

Demonstrates AI provider integration.

**Location**: `plugins/examples/custom-model/`

**Features**:
- Custom AI provider registration
- Model metadata configuration
- Inference implementation
- Environment variable usage

**Example**:
```typescript
const provider = {
  id: 'ollama',
  name: 'Ollama Local',
  models: [
    {
      id: 'llama2',
      name: 'Llama 2',
      contextWindow: 4096,
      capabilities: ['chat', 'completion']
    }
  ]
};
```

**Installation**:
```bash
vibecode plugin install ./plugins/examples/custom-model
```

See: [custom-model/README.md](../plugins/examples/custom-model/README.md)

---

### Workflow Automation Plugin

Demonstrates workflow automation capabilities.

**Location**: `plugins/examples/workflow-automation/`

**Features**:
- Workflow definitions
- Task orchestration
- Scheduled execution
- Multi-step workflows

**Example Workflows**:
- **Daily Cleanup**: Automated file cleanup
- **Code Quality Check**: Multi-step validation
- **Auto Backup**: Scheduled backups

**Installation**:
```bash
vibecode plugin install ./plugins/examples/workflow-automation
```

See: [workflow-automation/README.md](../plugins/examples/workflow-automation/README.md)

---

## Best Practices

### 1. Plugin Structure

**Recommended Directory Layout**:
```
my-plugin/
├── plugin.json          # Manifest (required)
├── index.ts            # Entry point (required)
├── README.md           # Documentation
├── LICENSE             # License file
├── src/                # Source code
│   ├── provider.ts
│   ├── utils.ts
│   └── types.ts
├── tests/              # Unit tests
│   └── plugin.test.ts
└── package.json        # npm dependencies (optional)
```

### 2. Error Handling

Always handle errors gracefully:

```typescript
async initialize(context: PluginContext) {
  try {
    // Plugin initialization
    await this.setup();
  } catch (error) {
    context.logger.error('Failed to initialize', { error });
    // Don't throw - let plugin gracefully degrade
  }
}
```

### 3. Logging

Use structured logging with context:

```typescript
// Good
context.logger.info('Task completed', {
  taskId: 123,
  duration: 1500,
  itemsProcessed: 42
});

// Bad
console.log('Task done');
```

### 4. Async Operations

Handle promises correctly:

```typescript
// Good - proper async/await
async initialize(context: PluginContext) {
  await this.loadConfig();
  await this.connectDatabase();
}

// Bad - unhandled promise
initialize(context: PluginContext) {
  this.loadConfig(); // Promise not awaited!
}
```

### 5. Resource Cleanup

Always clean up in `destroy()`:

```typescript
async destroy() {
  // Close connections
  await this.db?.close();

  // Clear timers
  if (this.timer) {
    clearInterval(this.timer);
  }

  // Remove event listeners
  this.emitter?.removeAllListeners();
}
```

### 6. Version Compatibility

Specify version requirements:

```json
{
  "engines": {
    "node": ">=18.0.0",
    "vibecode": ">=1.0.0"
  }
}
```

### 7. Testing

Write unit tests for your plugin:

```typescript
import { plugin } from '../index';

describe('MyPlugin', () => {
  it('should initialize without errors', async () => {
    const context = createMockContext();
    await expect(plugin.initialize(context)).resolves.not.toThrow();
  });
});
```

### 8. Documentation

Provide comprehensive README:

- Installation instructions
- Configuration options
- Usage examples
- API reference
- Troubleshooting guide

### 9. Security

- Never hardcode secrets
- Validate all inputs
- Use environment variables for configuration
- Audit dependencies regularly
- Follow OWASP best practices

### 10. Performance

- Cache expensive operations
- Use lazy loading when possible
- Implement timeouts for long operations
- Monitor memory usage
- Optimize database queries

---

## Troubleshooting

### Plugin Not Loading

**Symptoms**: Plugin status shows "error" or doesn't appear

**Solutions**:
1. Check manifest validation:
   ```bash
   vibecode plugin validate ./my-plugin
   ```

2. Check plugin logs:
   ```bash
   vibecode logs | grep "plugin-id"
   ```

3. Verify file permissions:
   ```bash
   ls -la plugins/my-plugin/
   ```

4. Check for syntax errors:
   ```bash
   npx tsc --noEmit index.ts
   ```

### Permission Denied Errors

**Symptoms**: `Error: Permission denied: <permission>`

**Solutions**:
1. Add permission to `plugin.json`:
   ```json
   {
     "permissions": ["filesystem:read", "network:outbound"]
   }
   ```

2. Reinstall plugin:
   ```bash
   vibecode plugin uninstall my-plugin
   vibecode plugin install ./my-plugin
   ```

### Plugin Timeouts

**Symptoms**: Plugin operations timeout

**Solutions**:
1. Reduce initialization time
2. Move long operations to background
3. Request higher timeout limit
4. Optimize expensive operations

### Memory Limit Exceeded

**Symptoms**: `Error: Memory limit exceeded`

**Solutions**:
1. Optimize memory usage
2. Clear caches periodically
3. Process data in chunks
4. Request higher memory limit

### Network Errors

**Symptoms**: `Error: Host not allowed`

**Solutions**:
1. Ensure `network:outbound` permission is granted
2. Check allowed hosts configuration
3. Verify network connectivity
4. Use HTTPS instead of HTTP

### Database Errors

**Symptoms**: `Error: Database operation failed`

**Solutions**:
1. Check database permissions
2. Verify connection string
3. Check database is running
4. Review query syntax

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `ERR_PLUGIN_NOT_FOUND` | Plugin ID doesn't exist | Check plugin ID spelling |
| `ERR_INVALID_MANIFEST` | Manifest validation failed | Fix plugin.json schema |
| `ERR_PERMISSION_DENIED` | Missing required permission | Add permission to manifest |
| `ERR_SANDBOX_TIMEOUT` | Execution timeout | Optimize plugin code |
| `ERR_MEMORY_LIMIT` | Memory limit exceeded | Reduce memory usage |
| `ERR_INVALID_VERSION` | Version format invalid | Use semantic versioning |

### Getting Help

1. **Documentation**: Check [Plugin Examples](../plugins/examples/)
2. **Logs**: Review plugin logs for detailed errors
3. **Community**: Ask in VibeCode community forums
4. **GitHub**: Open an issue with reproduction steps

---

## Additional Resources

- [Plugin Type Definitions](../src/types/plugin.ts)
- [Plugin Manager Source](../src/lib/plugins/plugin-manager.ts)
- [Example Plugins](../plugins/examples/)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Security Documentation](./SECURITY.md)

---

## Contributing

We welcome plugin contributions! Please:

1. Follow the plugin structure guidelines
2. Include comprehensive tests
3. Document all configuration options
4. Submit a pull request with your plugin

See [Contributing Guidelines](../CONTRIBUTING.md) for details.

---

## License

VibeCode Plugin System is licensed under the MIT License.

---

**Last Updated**: February 14, 2026
**Version**: 1.0.0
