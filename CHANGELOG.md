# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

### Fixed

- **roundtable_mcp_server log file error**: Wrapper changes working directory to `~/vibecode-webgui` before importing server, preventing "Read-only file system" errors when writing logs
- **ddtrace API compatibility**: Updated Python wrapper to use environment variables (`DD_AGENT_HOST`, `DD_TRACE_AGENT_PORT`) instead of deprecated `tracer.configure()` parameters

### Changed

- MCP server logs now written to project directory instead of root filesystem
- Added `roundtable_mcp_server.log` to `.gitignore`

## Previous Releases

See git history for changes prior to this version.
