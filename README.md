# VibeCode

Native desktop app wrapping code-server with AI assistance.

**Simple**: VS Code in the browser, wrapped with Tauri for native desktop.

## What It Is

VibeCode wraps code-server (VS Code in browser) with a native Tauri app to provide a desktop experience.

### Features

- ✅ **VS Code in Browser** - code-server with full VS Code features
- ✅ **Native Desktop** - Tauri wrapper for macOS/Windows/Linux
- ✅ **AI Assistant Extension** - Multi-provider AI coding assistance
- ✅ **Portable** - Small bundle size (~2.5MB)

## Quick Start

### Install Extension

```bash
# Already compiled and ready
cd extensions/vibecode-ai-assistant
npm install
npm run compile
```

### Run Desktop App

```bash
npm run tauri:dev
```

### Use Extension

Extension is already installed in code-server when it starts.

## Architecture

```
code-server (VS Code in browser)
    ↓
Wrapped with Tauri (native desktop)
    ↓
VibeCode AI Assistant extension
```

That's it. Simple wrapper around code-server.

## Extension Features

- AI Code Generation
- 321+ AI Models via OpenRouter
- Project Templates
- Cloud Deployment
- Real-time Collaboration

## Development

See [Tauri README](./docs/tauri/README.md) for development setup.

## License

MIT