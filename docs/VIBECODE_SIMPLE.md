# VibeCode Wiki

## Overview

VibeCode is a native desktop application that wraps code-server (VS Code in browser) with a Tauri wrapper.

## What VibeCode Is

**VibeCode = code-server + Tauri + AI Extension**

### Core Components

1. **code-server**
   - VS Code that runs in the browser
   - Full VS Code feature set
   - Web-based IDE

2. **Tauri Wrapper**
   - Native desktop app (macOS/Windows/Linux)
   - Small bundle size
   - WebKit rendering engine

3. **VibeCode AI Assistant Extension**
   - Multi-provider AI support (321+ models)
   - Code generation, explanation, optimization
   - Project templates and deployment

## Architecture

```
User
 ↓
Tauri App (native desktop)
 ↓
WebKit (rendering)
 ↓
code-server (VS Code in browser)
 ↓
VibeCode Extension (AI features)
```

## Key Files

- `src-tauri/` - Tauri app configuration
- `extensions/vibecode-ai-assistant/` - VS Code extension
- `src-tauri/tauri.conf.json` - Points to code-server at localhost:8080

## Simple Explanation

We wrapped code-server (VS Code) with Tauri to make it a desktop app. That's all.

## Development

See main README for setup instructions.

## License

MIT
