# Hello World Plugin

A simple example plugin that demonstrates the basic structure and API of VibeCode plugins.

## Overview

This plugin serves as a minimal working example for developers who want to create their own VibeCode plugins. It demonstrates:

- Plugin manifest structure (`plugin.json`)
- Plugin API implementation (`index.ts`)
- Lifecycle hooks (install, enable, disable, uninstall, update)
- Command registration
- Logging and context usage

## Features

- **Hello Command**: Registers a simple "hello" command that displays a greeting
- **Lifecycle Logging**: Demonstrates all plugin lifecycle hooks
- **Minimal Permissions**: Only requests `commands:register` permission

## Installation

### Via CLI

```bash
vibecode plugin install ./plugins/examples/hello-world
```

### Via UI

1. Navigate to the Plugins page (`/plugins`)
2. Click "Install Plugin"
3. Select the plugin directory or upload as a zip file
4. Click "Install"

### Via API

```bash
curl -X POST http://localhost:3000/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"source": "./plugins/examples/hello-world"}'
```

## Usage

Once installed and enabled, the plugin will:

1. Log initialization messages to the plugin logger
2. Register a "hello" command (in a full implementation)
3. Respond to lifecycle events (enable, disable, etc.)

### Example Command Usage

```typescript
import { executeHelloCommand } from 'hello-world';

// Basic greeting
executeHelloCommand();
// Output: "Hello, World!"

// Personalized greeting
executeHelloCommand("Alice");
// Output: "Hello, Alice!"
```

## Plugin Structure

```
hello-world/
├── plugin.json       # Plugin manifest with metadata
├── index.ts         # Main plugin implementation
└── README.md        # This file
```

### Manifest (`plugin.json`)

The manifest defines plugin metadata:

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "version": "1.0.0",
  "description": "A simple example plugin",
  "author": {
    "name": "VibeCode Team"
  },
  "type": "other",
  "main": "index.ts",
  "permissions": ["commands:register"]
}
```

### Implementation (`index.ts`)

The implementation exports a `PluginAPI` object with:

- `manifest`: Plugin metadata
- `capabilities`: What the plugin provides
- `initialize()`: Setup function called when plugin loads
- `destroy()`: Cleanup function called when plugin unloads
- Lifecycle hooks: `onInstall`, `onUninstall`, `onEnable`, `onDisable`, `onUpdate`

## Lifecycle Events

The plugin demonstrates all lifecycle hooks:

1. **onInstall**: Called once when plugin is first installed
2. **onEnable**: Called each time plugin is enabled
3. **initialize**: Called to set up the plugin
4. **onDisable**: Called when plugin is disabled
5. **onUpdate**: Called when plugin is updated to a new version
6. **onUninstall**: Called when plugin is removed
7. **destroy**: Called to clean up resources

## Permissions

This plugin only requests one permission:

- `commands:register`: Allows the plugin to register custom commands

## Development

### Modifying the Plugin

1. Edit `index.ts` to change plugin behavior
2. Update `plugin.json` if adding new permissions or changing metadata
3. Reinstall the plugin to see changes

### Testing

```bash
# Install the plugin
vibecode plugin install ./plugins/examples/hello-world

# List installed plugins
vibecode plugin list

# Uninstall the plugin
vibecode plugin uninstall hello-world
```

## Learning Resources

This plugin demonstrates:

- ✅ Basic plugin structure
- ✅ Manifest schema and validation
- ✅ Plugin API implementation
- ✅ Lifecycle hooks
- ✅ Context and logger usage
- ✅ Permission declaration

For more advanced examples, see:

- **custom-model**: AI model integration
- **workflow-automation**: Workflow automation
- **Plugin API Documentation**: `/docs/PLUGIN_API.md`

## License

MIT

## Author

VibeCode Team
- Email: team@vibecode.dev
- Website: https://vibecode.dev
