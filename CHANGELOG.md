# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [v1.1.1] - 2025-10-01

### Changed

- **Code-Server Images**: License compliance improvements for all profiles (minimal, standard, ai, web, full)
- **Documentation**: Updated all references to use v1.1.1 tags
- **Verification**: Enhanced verification guide with comprehensive profile testing

### Security

- **License Compliance**: All tools verified to use permissive licenses only (MIT, Apache 2.0, BSD, Vim License)

## [v1.2.0] - 2025-10-01

### Added

- **PocketBase v0.24.4**: Lightweight, embedded database with admin UI and REST API (MIT License)
- **Devbox**: Portable, reproducible development environments powered by Nix (Apache 2.0)
- **OpenAI Cookbook**: Comprehensive reference examples cloned to `/opt/openai-cookbook`
- **Enhanced tool verification**: Automated validation of all installed tools during build

### Changed

- Updated to v1.2.0 with expanded tooling ecosystem
- All dependencies remain permissively licensed (Apache 2.0/MIT)
- Improved build-time verification for tool availability

### Added

- **MCP Server Datadog Integration**: All Model Context Protocol servers now support Datadog APM tracing
  - Python wrapper (`scripts/roundtable-mcp-wrapper.py`) for `roundtable-ai` server
  - Universal Node.js wrapper (`scripts/mcp-wrapper.js`) for `puppeteer` and `sequential-thinking` servers
  - Automatic instrumentation with `dd-trace` (Node.js) and `ddtrace` (Python)
  - Service names: `mcp-puppeteer`, `mcp-sequential-thinking`, `mcp-roundtable-ai`
  - Runtime metrics, error tracking, and distributed tracing support
  - Setup script (`scripts/setup-mcp-tracing.sh`) for dependency installation
  - Comprehensive documentation in `docs/MCP_DATADOG_INTEGRATION.md`
  - Reference configuration in `config/mcp_config.json`
- **Reduced-motion Playwright coverage**: Added `tests/e2e/enhanced-chat/reduced-motion.spec.ts` with chunked SSE stub and accessibility assertions; updated `EnhancedChatInterface` streaming indicator and live region to support motion-sensitive users; documented coverage in testing guides.

### Fixed

- **roundtable_mcp_server log file error**: Wrapper changes working directory to `~/vibecode-webgui` before importing server, preventing "Read-only file system" errors when writing logs
- **ddtrace API compatibility**: Updated Python wrapper to use environment variables (`DD_AGENT_HOST`, `DD_TRACE_AGENT_PORT`) instead of deprecated `tracer.configure()` parameters

### Changed

- MCP server logs now written to project directory instead of root filesystem
- Added `roundtable_mcp_server.log` to `.gitignore`

## Previous Releases

See git history for changes prior to this version.
