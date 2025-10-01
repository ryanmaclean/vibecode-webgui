# MCP Configuration

This directory contains reference configuration files for Model Context Protocol (MCP) servers.

## Quick Start

1. **Install dependencies**:

   ```bash
   ./scripts/setup-mcp-tracing.sh
   ```

2. **Copy the config**:

   ```bash
   cp config/mcp_config.json ~/.codeium/windsurf/mcp_config.json
   ```

3. **Restart Windsurf/Cascade**

## Files

- **mcp_config.json**: Complete MCP server configuration with Datadog tracing enabled

## Features

All MCP servers are wrapped with Datadog tracing to provide:

- Performance monitoring and metrics
- Error tracking and alerting
- Distributed tracing correlation
- Runtime metrics (CPU, memory, event loop)

## Configuration Details

### Puppeteer Server

- **Service**: `mcp-puppeteer`
- **Wrapper**: `scripts/mcp-wrapper.js`
- **Package**: `@modelcontextprotocol/server-puppeteer`

### Sequential Thinking Server

- **Service**: `mcp-sequential-thinking`
- **Wrapper**: `scripts/mcp-wrapper.js`
- **Package**: `@modelcontextprotocol/server-sequential-thinking`

### Roundtable AI Server

- **Service**: `mcp-roundtable-ai`
- **Wrapper**: `scripts/roundtable-mcp-wrapper.py`
- **Package**: `roundtable_mcp_server`
- **Sub-agents**: codex, cursor, gemini

## Environment Variables

All servers support these Datadog environment variables:

- `DD_AGENT_HOST`: Datadog Agent hostname (default: `localhost`)
- `DD_TRACE_AGENT_PORT`: Trace agent port (default: `8126`)
- `DD_ENV`: Environment name (default: `development`)
- `DD_VERSION`: Service version (default: `1.0.0`)
- `DD_TRACE_DEBUG`: Enable debug logging (optional)

## Customization

To customize for your environment:

1. Update Python path if different from `/opt/homebrew/opt/python@3.13/bin/python3.13`
2. Update script paths if your repo is not at `~/vibecode-webgui`
3. Adjust Datadog Agent connection settings if needed
4. Add/remove MCP servers as needed

## Documentation

See [docs/MCP_DATADOG_INTEGRATION.md](../docs/MCP_DATADOG_INTEGRATION.md) for complete documentation.

## Troubleshooting

### "Read-only file system" error

The wrapper scripts fix this by changing to a writable directory before importing the server.

### No traces appearing in Datadog

1. Verify Datadog Agent is running: `datadog-agent status`
2. Check trace agent endpoint: `curl http://localhost:8126/info`
3. Enable debug logging: Add `DD_TRACE_DEBUG=true` to env

### Import errors

Ensure dependencies are installed:

```bash
pip3 install --user ddtrace
npm install -g dd-trace
```

## Related Files

- `scripts/roundtable-mcp-wrapper.py` - Python MCP wrapper with tracing
- `scripts/mcp-wrapper.js` - Node.js MCP wrapper with tracing
- `scripts/setup-mcp-tracing.sh` - Setup script for dependencies
- `docs/MCP_DATADOG_INTEGRATION.md` - Complete documentation
