# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Features
- Automated changelog generation workflow with git-cliff integration
- Conventional commits enforcement and validation
- Manual changelog generation script with version detection

### Documentation
- Add comprehensive CHANGELOG_GUIDE.md with conventional commit format
- Document semantic versioning strategy and best practices
- Include troubleshooting and configuration examples

### CI/CD
- GitHub Actions workflow for automated changelog on release
- Workflow dispatch for manual changelog generation
- Automatic release notes update integration

## DEPRECATION NOTICE

### v1.1.0 Code-Server Images - DEPRECATED (2025-10-01)

**STATUS**: DEPRECATED - DO NOT USE

**Reason**: v1.1.0 code-server images contain GPL-licensed GNU Emacs, violating MIT license compatibility.

**Action Required**: All users must migrate to v1.1.1 immediately.

**Migration**: Replace all `1.1.0` tags with `1.1.1`:
```bash
# Old (DEPRECATED)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.0-standard

# New (GPL-free)
docker pull ghcr.io/ryanmaclean/vibecode-codeserver:1.1.1-standard
```

**Details**: See [docker/code-server/DEPRECATION_NOTICE_v1.1.0.md](docker/code-server/DEPRECATION_NOTICE_v1.1.0.md)

**Timeline**: v1.1.0 images scheduled for registry removal after 30-day transition period.

**Affected Images**:
- GHCR version IDs: 532086486, 532080021, 531338584, 531327265, 531251775
- Docker Hub: All 1.1.0-tagged images

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
