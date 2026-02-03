# Datadog MCP Server

Model Context Protocol server that wraps the Datadog CLI, making Datadog observability accessible to AI coding agents like Cursor, Claude Desktop, and GitHub Copilot.

## Features

**5 Core Tools** (Phase 1):
- `datadog_health` - Smart health checks with multi-signal analysis
- `datadog_deploy` - Deploy safety validation
- `datadog_apm` - APM trace analytics
- `datadog_logs` - Log search and retrieval
- `datadog_incidents` - Incident management

**Coming Soon** (17 additional tools):
- Metrics, monitors, dashboards, synthetics, workflows
- Security signals, RUM, network monitoring
- LLM observability, cost tracking
- And more...

## Installation

### Prerequisites

1. **Datadog CLI**: Ensure the Datadog CLI binary is built
   ```bash
   cd .. && go build -o bin/dd-darwin-arm64 cmd/main.go
   ```

2. **Node.js**: Version 18 or higher
   ```bash
   node --version  # Should be >= 18.0.0
   ```

3. **Datadog Credentials**: Set environment variables
   ```bash
   export DD_API_KEY="your_api_key"
   export DD_APP_KEY="your_app_key"
   export DD_SITE="datadoghq.com"  # or .eu, .us3, .us5
   ```

### Build MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### Test Server

```bash
npm run dev
# Server should start and show:
# Datadog MCP Server running on stdio
# CLI binary: /path/to/dd-darwin-arm64
# Tools available: 5
```

## Configuration

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "datadog": {
      "command": "node",
      "args": [
        "/absolute/path/to/dd-skill-test-go/mcp-server/dist/index.js"
      ],
      "env": {
        "DD_API_KEY": "your_api_key",
        "DD_APP_KEY": "your_app_key",
        "DD_SITE": "datadoghq.com"
      }
    }
  }
}
```

**Restart Claude Desktop** to load the server.

### Cursor

Add to your Cursor settings (Preferences → MCP → Add Server):

```json
{
  "name": "datadog",
  "command": "node",
  "args": [
    "/absolute/path/to/dd-skill-test-go/mcp-server/dist/index.js"
  ],
  "env": {
    "DD_API_KEY": "your_api_key",
    "DD_APP_KEY": "your_app_key",
    "DD_SITE": "datadoghq.com"
  }
}
```

### OpenAI Codex CLI

Configure in `~/.codex/config.json`:

```json
{
  "mcp_servers": [
    {
      "name": "datadog",
      "command": "node",
      "args": [
        "/absolute/path/to/dd-skill-test-go/mcp-server/dist/index.js"
      ],
      "env": {
        "DD_API_KEY": "your_api_key",
        "DD_APP_KEY": "your_app_key",
        "DD_SITE": "datadoghq.com"
      }
    }
  ]
}
```

## Usage Examples

### In Claude Desktop

**Check service health:**
```
Check the health of the api service in the last 6 hours
```

**Validate deployment safety:**
```
Is it safe to deploy the payment-service to production right now?
```

**Query APM traces:**
```
Show me error traces for the checkout service in the last hour
```

**Search logs:**
```
Find all error logs containing "database timeout" in the last 24 hours
```

**List active incidents:**
```
What incidents are currently active for the api service?
```

### In Cursor

**Pre-commit health check:**
```
Before I merge this PR, check if the auth service is healthy
```

**Troubleshoot deployment:**
```
The deployment failed - check recent error logs and incidents for user-service
```

**Performance investigation:**
```
Analyze APM traces for the api service - are there any slow endpoints?
```

## Tool Reference

### datadog_health

Check service health with multi-signal analysis.

**Parameters:**
- `service` (optional): Service name (auto-detects from git context)
- `from` (optional): Time range (default: "1h")

**Example:**
```typescript
{
  "service": "api",
  "from": "6h"
}
```

### datadog_deploy

Validate deployment safety.

**Parameters:**
- `service` (optional): Service name (auto-detects from git context)
- `environment` (optional): Environment to check

**Example:**
```typescript
{
  "service": "payment-service",
  "environment": "production"
}
```

### datadog_apm

Query APM trace analytics.

**Parameters:**
- `service` (required): Service name
- `from` (optional): Time range (default: "1h")
- `status` (optional): "error", "ok", or "all"
- `resource` (optional): Filter by resource name

**Example:**
```typescript
{
  "service": "api",
  "from": "24h",
  "status": "error"
}
```

### datadog_logs

Search and retrieve logs.

**Parameters:**
- `query` (optional): Search query
- `service` (optional): Service name
- `from` (optional): Time range (default: "1h")
- `status` (optional): "error", "warn", "info", "debug"
- `limit` (optional): Max results (default: 100)

**Example:**
```typescript
{
  "query": "database timeout",
  "status": "error",
  "from": "24h",
  "limit": 50
}
```

### datadog_incidents

Manage Datadog incidents.

**Parameters:**
- `action` (required): "list", "create", "update", or "close"
- For list: `status`, `service`
- For create: `title`, `severity`, `service`
- For update/close: `incident_id`, `new_status`

**Examples:**
```typescript
// List active incidents
{
  "action": "list",
  "status": "active",
  "service": "api"
}

// Create incident
{
  "action": "create",
  "title": "High error rate in payment API",
  "severity": "SEV-2",
  "service": "payment-api"
}

// Update incident
{
  "action": "update",
  "incident_id": "abc123",
  "new_status": "stable"
}
```

## Troubleshooting

### Server not starting

**Check Node.js version:**
```bash
node --version  # Should be >= 18.0.0
```

**Verify CLI binary exists:**
```bash
ls -lh ../bin/dd-darwin-arm64
```

**Check environment variables:**
```bash
echo $DD_API_KEY  # Should be set
echo $DD_APP_KEY  # Should be set
```

### Tools not appearing in client

**Restart your MCP client** (Claude Desktop, Cursor, etc.)

**Check MCP server logs:**
- Claude Desktop: `~/Library/Logs/Claude/mcp*.log`
- Cursor: Check Cursor's developer console

**Verify configuration path:**
- Ensure absolute path to `dist/index.js` is correct
- Ensure environment variables are set in config

### CLI execution errors

**Test CLI directly:**
```bash
../bin/dd-darwin-arm64 health --service api --json
```

**Check Datadog credentials:**
```bash
../bin/dd-darwin-arm64 context  # Should show connection status
```

**Verify binary permissions:**
```bash
chmod +x ../bin/dd-darwin-arm64
```

## Development

### Watch mode (auto-rebuild)

```bash
npm run watch
```

### Testing with MCP Inspector

```bash
npm run inspector
# Then use MCP Inspector to test tools interactively
```

### Adding new tools

1. Add tool definition to `TOOLS` array in `src/index.ts`
2. Update `buildCliArgs()` if special argument handling needed
3. Rebuild: `npm run build`
4. Restart MCP client to load new tool

## Architecture

```
┌─────────────────────────────────────┐
│   MCP Client (Cursor/Claude/etc)    │
│   - Natural language prompts        │
│   - Tool selection                  │
└──────────────┬──────────────────────┘
               │ MCP Protocol (stdio)
┌──────────────▼──────────────────────┐
│      MCP Server (Node.js/TS)         │
│  - 5 tool definitions                │
│  - Parameter validation              │
│  - Response formatting               │
└──────────────┬──────────────────────┘
               │ Subprocess exec
┌──────────────▼──────────────────────┐
│    Datadog CLI Binary (Go)           │
│  - 22 commands                       │
│  - JSON output                       │
│  - 3ms startup                       │
└──────────────┬──────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────┐
│         Datadog API                  │
└──────────────────────────────────────┘
```

## Roadmap

### Phase 1 (Current) ✅
- 5 core tools: health, deploy, apm, logs, incidents
- Basic MCP server implementation
- Claude Desktop + Cursor support

### Phase 2 (Next)
- Add 17 remaining tools (all 22 commands)
- Metrics, monitors, dashboards
- Security, RUM, network monitoring
- LLM observability, cost tracking

### Phase 3 (Future)
- Response caching for performance
- Connection pooling
- Error recovery and retry logic
- Comprehensive test suite
- npm package publication

## License

MIT - See LICENSE file

## Contributing

Contributions welcome! Please:
1. Follow TypeScript best practices
2. Add tool definitions to `TOOLS` array
3. Update README with examples
4. Test with at least one MCP client

## Support

- **Issues**: https://github.com/yourusername/dd-skill-test-go/issues
- **Documentation**: See main project README
- **MCP Protocol**: https://modelcontextprotocol.io

---

**Created**: January 22, 2026
**Status**: Phase 1 Prototype (5 tools)
**Next**: Expand to all 22 tools
