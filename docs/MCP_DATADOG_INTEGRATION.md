# MCP Server Datadog Integration

This document describes how to run Model Context Protocol (MCP) servers with Datadog tracing for observability.

## Overview

All MCP servers in VibeCode are wrapped with Datadog tracing to provide:

- **Performance monitoring**: Track execution time and throughput
- **Error tracking**: Capture exceptions and failures
- **Resource usage**: Monitor CPU, memory, and I/O
- **Distributed tracing**: Correlate MCP calls with application traces

## Architecture

### Wrapper Scripts

1. **Python MCP Servers** (`scripts/roundtable-mcp-wrapper.py`)
   - Initializes `ddtrace` before importing the server
   - Patches logging, requests, and subprocess modules
   - Sets service name to `mcp-roundtable-ai`
   - Fixes log file path to writable location

2. **Node.js MCP Servers** (`scripts/mcp-wrapper.js`)
   - Universal wrapper for any Node.js MCP package
   - Initializes `dd-trace` with runtime metrics
   - Accepts service name and package as arguments
   - Wraps main execution in a trace span

## Configuration

### MCP Config (`~/.codeium/windsurf/mcp_config.json`)

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
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DD_AGENT_HOST` | Datadog Agent hostname | `localhost` |
| `DD_TRACE_AGENT_PORT` | Datadog Agent trace port | `8126` |
| `DD_ENV` | Environment name | `development` |
| `DD_VERSION` | Service version | `1.0.0` |

## Service Names

Each MCP server has a unique service name in Datadog:

- **puppeteer**: `mcp-puppeteer`
- **sequential-thinking**: `mcp-sequential-thinking`
- **roundtable-ai**: `mcp-roundtable-ai`

## Metrics & Traces

### Available Metrics

1. **Request Rate**: `trace.mcp.<service>.request.rate`
2. **Error Rate**: `trace.mcp.<service>.error.rate`
3. **Latency**: `trace.mcp.<service>.request.duration`
4. **Runtime Metrics**:
   - `runtime.nodejs.cpu.user`
   - `runtime.nodejs.mem.heap_used`
   - `runtime.nodejs.event_loop.latency`

### Trace Operations

- `mcp.puppeteer.main` - Puppeteer server lifecycle
- `mcp.sequential-thinking.main` - Sequential thinking operations
- `mcp.roundtable.main` - Roundtable AI orchestration

### Sequential Thinking API (Next.js)

- **Log Payload**: The `/api/ai/sequential-thinking` route emits structured JSON to stdout with keys `ddsource`, `service`, `event`, `timestamp`, and contextual metadata (prompt length, processing time, error details).
- **Events**:
  - `thinking_request` – prompt accepted
  - `thinking_response` – MCP success (includes `processing_time_ms`)
  - `thinking_error` – validation failure or fallback invocation
- **Dashboards**: See `docs/datadog/sequential-thinking-dashboard.json` for starter widgets (request rate, error ratio, fallback percentage, p95 latency).
- **Alert Ideas**:
  - Error rate > 10% over 5 minutes
  - Fallback rate > 25% over 5 minutes
  - p95 processing time > 5 seconds

## Prerequisites

### Python Dependencies

```bash
pip install ddtrace
```

### Node.js Dependencies

```bash
npm install dd-trace
```

Or install globally:

```bash
npm install -g dd-trace
```

## Verification

### 1. Check Datadog Agent

```bash
# Verify agent is running
datadog-agent status

# Check trace agent
curl http://localhost:8126/info
```

### 2. Test MCP Server

Restart Windsurf/Cascade and check stderr output for:

```text
Datadog tracing enabled for <service> MCP server
```

### 3. View Traces in Datadog

1. Navigate to **APM > Traces** in Datadog UI
2. Filter by service: `mcp-*`
3. View trace flamegraphs and metrics

## Tracing External AI CLIs

Several MCP flows shell out to AI CLIs (Codex, Claude Code, Gemini, Just-Every/Code, etc.). Instrumenting those binaries is highly dependent on the runtime each CLI uses. The table below captures the current state based on hands-on testing:

| CLI | Runtime | Recommended launch command | Current status |
| --- | --- | --- | --- |
| OpenAI Codex CLI (`codex`) | Mach-O native binary | `~/Library/Python/3.13/bin/ddtrace-run codex …` *(no effect)* | **Not yet traceable** – the vendored binary does not expose hooks for Datadog’s Python tracer |
| Claude Code CLI (`claude`) | Mach-O native binary | `~/Library/Python/3.13/bin/ddtrace-run claude …` *(no effect)* | **Not yet traceable** – behaves like Codex CLI |
| Google Gemini CLI (`gemini`) | Node.js ESM script | `NODE_OPTIONS='--require dd-trace/register' node /usr/local/bin/gemini …` | **Fails today** – `dd-trace` conflicts with the CLI’s ESM loader (`ERR_INVALID_RETURN_PROPERTY_VALUE`) |
| Just-Every/Code (`just-every-code`) | Node.js CLI | `DD_TRACE_ENABLED=true NODE_OPTIONS='--require dd-trace/register' node ⟨path⟩/just-every-code …` | **Pending verification** – requires a local install of the CLI and a Node version compatible with `dd-trace` |

### Wrapper checklist

- ✅ Every CLI wrapper should export `DD_LLMOBS_PROJECT=vibecode-code-server-ai-cli` (keep `DD_LLMOBS_ML_APP` only if older services still expect it).
- ✅ Set `DD_AGENT_HOST`, `DD_TRACE_AGENT_PORT`, and the appropriate OpenRouter endpoint before invoking the underlying CLI.
- 🔄 Record latency/token usage in a Datadog Experiment once real API calls run through the wrapper.

> ℹ️ Only Python-based tooling (for example, Roundtable’s sub-agents) successfully emit spans with `ddtrace-run`. The other CLIs listed above either provide compiled binaries or use Node loaders that do not yet cooperate with Datadog’s dynamic instrumentation.

### Wrapper checklist

- ✅ Every CLI wrapper should export `DD_LLMOBS_PROJECT=vibecode-code-server-ai-cli` (keep `DD_LLMOBS_ML_APP` only if older services still expect it).
- ✅ Set `DD_AGENT_HOST`, `DD_TRACE_AGENT_PORT`, and the appropriate OpenRouter endpoint before invoking the underlying CLI.
- 🔄 Record latency/token usage in a Datadog Experiment once real API calls run through the wrapper.

### Recommended next steps

1. Track upstream requests with each CLI vendor to expose Datadog-compatible hooks (environment variables, OTLP export, or plugin support).
2. For Node-based CLIs, pin a Node version that `dd-trace` supports and retest once `dd-trace` adds ESM loader compatibility.
3. If you control the CLI, compile it with Datadog’s native tracers (Go, Rust, etc.) instead of relying on runtime patching.

Until those items land, rely on the MCP wrappers’ spans (e.g., `mcp-sequential-thinking`, `mcp-puppeteer`, `mcp-roundtable-ai`) to monitor downstream activity, and tag their requests with CLI metadata for correlation.

## Troubleshooting

### No Traces Appearing

1. **Check Agent Connection**:

   ```bash
   telnet localhost 8126
   ```

2. **Enable Debug Logging**:
   - Python: Add `DD_TRACE_DEBUG=true` to env
   - Node.js: Add `DD_TRACE_DEBUG=true` to env

3. **Check Wrapper Output**:
   - Look for "Datadog tracing enabled" message
   - Check for import errors

### Log File Errors (roundtable-ai)

The wrapper changes working directory to `~/vibecode-webgui` to ensure log files are written to a writable location. If you see "Read-only file system" errors, verify:

1. The wrapper script path is correct
2. The home directory path is accessible
3. The `vibecode-webgui` directory exists

### Performance Impact

Datadog tracing adds minimal overhead (~1-2% CPU, ~10MB memory). To disable:

1. Remove wrapper scripts from MCP config
2. Use original commands (e.g., `npx -y @modelcontextprotocol/server-puppeteer`)

## Adding New MCP Servers

### Node.js Server

```json
{
  "new-server": {
    "command": "node",
    "args": [
      "/Users/ryan.maclean/vibecode-webgui/scripts/mcp-wrapper.js",
      "new-server",
      "@vendor/mcp-server-package"
    ],
    "env": {
      "DD_AGENT_HOST": "localhost",
      "DD_TRACE_AGENT_PORT": "8126",
      "DD_ENV": "development"
    }
  }
}
```

### Python Server

Create a new wrapper script following `roundtable-mcp-wrapper.py` pattern:

```python
#!/usr/bin/env python3
import os
import ddtrace
from ddtrace import tracer, patch

# Set environment variables for Datadog Agent
os.environ.setdefault('DD_AGENT_HOST', 'localhost')
os.environ.setdefault('DD_TRACE_AGENT_PORT', '8126')

# Patch libraries and configure service
patch(logging=True, requests=True, subprocess=True)
ddtrace.config.service = 'mcp-new-server'
ddtrace.config.env = os.getenv('DD_ENV', 'development')
ddtrace.config.version = os.getenv('DD_VERSION', '1.0.0')

from new_server_package import main

if __name__ == "__main__":
    with tracer.trace("mcp.new-server.main", service="mcp-new-server"):
        main()
```

## Best Practices

1. **Use Consistent Service Names**: Prefix all MCP services with `mcp-`
2. **Set Environment Tags**: Use `DD_ENV` to distinguish dev/staging/prod
3. **Monitor Error Rates**: Set up alerts for MCP server failures
4. **Track Latency**: Monitor P95/P99 latency for performance regressions
5. **Correlate with App Traces**: Use distributed tracing to connect MCP calls to user actions

## Related Documentation

- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [dd-trace-js](https://github.com/DataDog/dd-trace-js)
- [ddtrace Python](https://ddtrace.readthedocs.io/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
