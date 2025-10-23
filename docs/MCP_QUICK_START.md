# MCP with Datadog Tracing - Quick Start

Get your MCP servers running with full Datadog observability in 3 steps.

## Prerequisites

- Datadog Agent running locally (port 8126)
- Python 3.13+ and Node.js installed
- Windsurf/Cascade IDE

## Setup

### 1. Install Dependencies

```bash
cd ~/vibecode-webgui
./scripts/setup-mcp-tracing.sh
```

This installs:

- `ddtrace` (Python)
- `dd-trace` (Node.js)

### 2. Configure MCP Servers

Copy the reference config:

```bash
cp config/mcp_config.json ~/.codeium/windsurf/mcp_config.json
```

Or manually update `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "/bin/bash",
      "args": [
        "-lc",
        "cd \"${CLI_MCP_WORKING_DIR:-$HOME/vibecode-webgui}\" && node scripts/mcp-wrapper.js puppeteer @modelcontextprotocol/server-puppeteer"
      ],
      "env": {
        "DD_AGENT_HOST": "localhost",
        "DD_TRACE_AGENT_PORT": "8126",
        "DD_ENV": "development",
        "DD_VERSION": "1.0.0"
      }
    },
    "sequential-thinking": {
      "command": "/bin/bash",
      "args": [
        "-lc",
        "cd \"${CLI_MCP_WORKING_DIR:-$HOME/vibecode-webgui}\" && node scripts/mcp-wrapper.js sequential-thinking @modelcontextprotocol/server-sequential-thinking"
      ],
      "env": {
        "DD_AGENT_HOST": "localhost",
        "DD_TRACE_AGENT_PORT": "8126",
        "DD_ENV": "development",
        "DD_VERSION": "1.0.0"
      }
    },
    "roundtable-ai": {
      "command": "/bin/bash",
      "args": [
        "-lc",
        "cd \"${CLI_MCP_WORKING_DIR:-$HOME/vibecode-webgui}\" && \"${PYTHON_CMD:-python3.13}\" scripts/roundtable-mcp-wrapper.py"
      ],
      "env": {
        "CLI_MCP_SUBAGENTS": "codex,cursor,gemini",
        "DD_AGENT_HOST": "localhost",
        "DD_TRACE_AGENT_PORT": "8126",
        "DD_ENV": "development",
        "DD_VERSION": "1.0.0",
        "PYTHON_CMD": "/opt/homebrew/opt/python@3.13/bin/python3.13"
      }
    },
    "zen": {
      "command": "npx",
      "args": [
        "-y",
        "@beehiveinnovations/zen-mcp-server"
      ],
      "env": {
        "DD_AGENT_HOST": "localhost",
        "DD_TRACE_AGENT_PORT": "8126",
        "DD_ENV": "development"
      }
    }
  }
}
```

### 3. Restart Windsurf

Quit and restart Windsurf/Cascade to load the new configuration.

## Verification

### Check Server Startup

Look for this message in Windsurf's output/logs:

```text
Datadog tracing enabled for <service> MCP server
```

### View Traces in Datadog

1. Open Datadog UI → **APM** → **Traces**
2. Filter by service: `mcp-*`
3. You should see traces for:
   - `mcp-puppeteer`
   - `mcp-sequential-thinking`
   - `mcp-roundtable-ai`
   - `mcp-zen`

### Test Trace Agent

```bash
curl http://localhost:8126/info
```

Should return JSON with agent info.

## Troubleshooting

### "Read-only file system" Error

The wrapper scripts fix this automatically. If you still see it:

1. Verify wrapper script paths in config
2. Ensure `~/vibecode-webgui` directory exists
3. Check script permissions: `chmod +x scripts/*.py scripts/*.js`

### No Traces Appearing

1. **Check Agent**:

   ```bash
   datadog-agent status
   ```

2. **Enable Debug Mode**: Add to env in config:

   ```json
   "DD_TRACE_DEBUG": "true"
   ```

3. **Check Connectivity**:

   ```bash
   telnet localhost 8126
   ```

### Import Errors

Reinstall dependencies:

```bash
pip3 install --user --force-reinstall ddtrace
npm install -g dd-trace
```

## What You Get

### Metrics

- Request rate and throughput
- Error rate and count
- Latency (P50, P95, P99)
- Runtime metrics (CPU, memory, event loop)

### Traces

- Full request/response traces
- Distributed tracing across services
- Error stack traces
- Performance bottleneck identification

### Dashboards

Create custom dashboards in Datadog with:

- MCP server health overview
- Performance trends
- Error rate alerts
- Latency SLOs

## Next Steps

- [Full Documentation](MCP_DATADOG_INTEGRATION.md)
- [Configuration Reference](../config/README.md)
- [Adding New Servers](MCP_DATADOG_INTEGRATION.md#adding-new-mcp-servers)

## Support

- **Datadog Docs**: <https://docs.datadoghq.com/tracing/>
- **MCP Spec**: <https://modelcontextprotocol.io/>
- **Issues**: <https://github.com/ryanmaclean/vibecode-webgui/issues>
