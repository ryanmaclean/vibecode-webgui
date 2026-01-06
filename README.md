# VibeCode - Test Project for Build Systems & Tracing

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**This is a test/demo repository** for experimenting with:
- Desktop app builds (Tauri + Rust)
- OpenVSCode Server integration
- Build system verification and tracing
- VS Code extension development (workspace-rag)

## What Actually Works

- ✅ **OpenVSCode Server** - Builds successfully on macOS ARM64 (4m 17s build time)
- ✅ **Tauri Desktop App** - Minimal working build (5.8 MB)
- ✅ **Workspace RAG Extension** - Production-ready VS Code extension with MLX embeddings
- ✅ **Build Scripts** - Python build automation with Datadog tracing
- ✅ **GUI Testing** - AppleScript-based extension testing framework

## Quick Start

### Run Tauri Desktop App
```bash
npm install --legacy-peer-deps
npm run tauri:dev
```

### Build OpenVSCode Server
```bash
# Requires Node 22+ and Rust
cd openvscode-server
npm install
npm run gulp vscode-darwin-arm64
```

### Package Workspace RAG Extension
```bash
cd extensions/workspace-rag
npm ci --legacy-peer-deps
npm run compile
vsce package
```

## What's Tested

- ✅ OpenVSCode Server native build (macOS ARM64)
- ✅ Tauri desktop build system
- ✅ Workspace RAG extension compilation (0 TypeScript errors)
- ✅ GUI testing framework with AppleScript
- ✅ Build verification with bun runtime
- ✅ Python build scripts with Datadog tracing integration

## Documentation

Some exploratory design docs exist in `/docs` - these are research/planning artifacts, not implemented features:
- Build guides and testing procedures (actually used)
- VM provider abstractions (partially implemented)
- Authentication and dashboard designs (exploration only, not built)
- Embedded systems concepts (research notes)

## Recent Work

- **Jan 2025**: Complete test suite (3,630 tests), security hardening (0 vulnerabilities), Datadog APM/logging integration
- **Nov 2024**: GUI testing infrastructure, workspace-rag v1.0.0 packaging
- **Oct 2024**: Build system verification, OpenVSCode Server integration
- **Earlier**: Various build automation experiments and documentation

## Test Coverage & Quality

- ✅ **3,630 tests passing** across 225 test suites (100% passing rate)
- ✅ **0 security vulnerabilities** (npm audit clean)
- ✅ **159 Datadog integration tests** with real API calls
- ✅ **GitHub Actions CI/CD** with automated testing
- ✅ **Pre-commit hooks** with security scanning for API keys

## Datadog Integration

- **Python (47 files)**: ddtrace APM instrumentation
- **JavaScript**: dd-trace in src/instrument.ts
- **Bash (5 scripts)**: Custom Datadog logging library
- **Metrics & Logs**: Real-time monitoring with Datadog API integration

## Project Structure

```
vibecode-webgui/
├── extensions/workspace-rag/     # VS Code extension (production ready)
├── openvscode-server/            # Git submodule (builds successfully)
├── src-tauri/                    # Tauri desktop app (basic build works)
├── scripts/                      # Build automation and testing
└── docs/                         # Mix of working docs and exploration notes
```

## License

MIT
