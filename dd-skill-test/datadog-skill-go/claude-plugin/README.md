# Datadog CLI Plugin for Claude Code

A Claude Code plugin that provides comprehensive access to Datadog observability platform operations through natural language commands.

## Overview

This plugin wraps the production-grade Datadog CLI (built in Go, 3ms startup, 22 commands) and makes it accessible through Claude Code skills. It enables AI-assisted observability workflows including health checks, APM analysis, log search, incident management, and more.

## Features

- **Health Checks**: Multi-signal service health analysis
- **Deploy Safety**: Pre-deployment validation with incident checks
- **APM Analysis**: Trace queries, performance metrics, error analysis
- **Log Search**: Flexible log queries with filtering
- **Incident Management**: Create, list, update, and close incidents
- **Metrics Queries**: Timeseries data and system metrics
- **Full CLI Access**: All 22 Datadog CLI commands available

## Installation

### Prerequisites

1. **Datadog CLI Binary**: Built from this repository
   ```bash
   cd /path/to/dd-skill-test-go
   make build
   ```

2. **Datadog Credentials**: API and Application keys from Datadog
   - API Key: https://app.datadoghq.com/organization-settings/api-keys
   - App Key: https://app.datadoghq.com/organization-settings/application-keys

3. **Claude Code**: Latest version installed

### Install Plugin

1. **Copy Plugin to Claude Code Directory**:
   ```bash
   # Create plugins directory if it doesn't exist
   mkdir -p ~/.claude/plugins/user/datadog-cli

   # Copy plugin files
   cp -r claude-plugin/* ~/.claude/plugins/user/datadog-cli/
   ```

2. **Set Environment Variables**:

   Add to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):
   ```bash
   export DD_API_KEY="your_datadog_api_key"
   export DD_APP_KEY="your_datadog_app_key"
   export DD_SITE="datadoghq.com"  # or datadoghq.eu, us3.datadoghq.com, etc.
   export DD_CLI_PATH="/path/to/dd-skill-test-go/bin/dd-darwin-arm64"
   ```

   Or create a `.env` file in the plugin directory:
   ```bash
   cat > ~/.claude/plugins/user/datadog-cli/.env <<EOF
   DD_API_KEY=your_datadog_api_key
   DD_APP_KEY=your_datadog_app_key
   DD_SITE=datadoghq.com
   DD_CLI_PATH=/path/to/dd-skill-test-go/bin/dd-darwin-arm64
   EOF
   ```

3. **Restart Claude Code**:
   ```bash
   # Restart Claude Code to load the plugin
   ```

4. **Verify Installation**:
   In Claude Code, try:
   ```
   "Check the health of my api service using Datadog"
   ```

## Available Skills

### `/datadog health [SERVICE] [--from TIMERANGE]`
Check service health with multi-signal analysis across APM, logs, and error rates.

**Example prompts:**
- "Check the health of the api service"
- "Is payment-service healthy?"
- "Show me health status for checkout service in the last 3 hours"

### `/datadog deploy [SERVICE] [--environment ENV]`
Validate deployment safety before deploying - checks incidents, error spikes, and service health.

**Example prompts:**
- "Is it safe to deploy payment-service to production?"
- "Check if I can deploy the api service"
- "Should I deploy user-service right now?"

### `/datadog apm SERVICE [OPTIONS]`
Query APM traces and analyze performance, errors, and latency.

**Example prompts:**
- "Show me error traces for checkout service in the last hour"
- "What's the p99 latency for api-service?"
- "Find slow traces in payment-service"

### `/datadog logs [QUERY] [OPTIONS]`
Search and retrieve logs with filtering by service, status, and time range.

**Example prompts:**
- "Find all error logs containing 'database timeout' in the last 24 hours"
- "Show me recent error logs for payment-service"
- "Search logs for 'connection refused' in api-service"

### `/datadog incidents ACTION [OPTIONS]`
Manage Datadog incidents - list, create, update, and close.

**Example prompts:**
- "What incidents are currently active for the api service?"
- "Create a SEV-2 incident for high error rate in payment API"
- "List all resolved incidents from the last week"

### `/datadog metrics QUERY [OPTIONS]`
Query Datadog metrics and timeseries data.

**Example prompts:**
- "Show me CPU usage for web servers"
- "What's the request rate for api service?"
- "Query memory usage for host web-1 in the last 4 hours"

### `/datadog COMMAND [ARGS]`
Execute any Datadog CLI command directly (access to all 22 commands).

**Example prompts:**
- "Use Datadog CLI to check api-service health"
- "Run dd apm checkout-service --status error"
- "Execute dd logs command to find database errors"

## Usage Examples

### Pre-Deployment Workflow
```
User: "I'm about to deploy payment-service to production. Is it safe?"

Claude: I'll check the deployment safety for payment-service.
[Uses /datadog deploy payment-service --environment production]
The deploy check shows:
- ✅ No active incidents
- ✅ Error rates within normal range
- ✅ No ongoing deployments
- ⚠️  One warning: Latency p99 slightly elevated (850ms vs 700ms baseline)

It's SAFE to deploy with the caveat that latency is trending upward. You may want to monitor closely during rollout.
```

### Incident Investigation
```
User: "We're seeing high error rates in checkout service. What's going on?"

Claude: Let me investigate the checkout service errors.
[Uses /datadog apm checkout-service --status error --from 1h]
[Uses /datadog logs --service checkout-service --status error --from 1h]

I found:
- Error rate jumped from 0.5% to 8.3% starting 22 minutes ago
- Most common error: "Database connection timeout" (67 occurrences)
- Affected endpoint: POST /api/checkout/complete
- Recent logs show connection pool exhaustion

This appears to be a database connectivity issue. Should I create a SEV-2 incident?
```

### Performance Analysis
```
User: "What's causing slow response times in api-service?"

Claude: I'll analyze the performance metrics for api-service.
[Uses /datadog apm api-service --from 2h]
[Uses /datadog metrics "avg:trace.servlet.request.duration{service:api} by {resource_name}" --from 2h]

Performance analysis:
- Overall p99 latency: 1.2s (up from 600ms baseline)
- Slowest endpoint: GET /api/search (p99: 3.5s)
- Normal endpoints: < 200ms
- No increase in error rates

The issue is isolated to the search endpoint. Recent changes or increased data volume in search index?
```

## Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DD_API_KEY` | Yes | Datadog API key | - |
| `DD_APP_KEY` | Yes | Datadog Application key | - |
| `DD_SITE` | No | Datadog site | `datadoghq.com` |
| `DD_CLI_PATH` | No | Path to CLI binary | Auto-detected |

### Datadog Sites

- US1: `datadoghq.com` (default)
- US3: `us3.datadoghq.com`
- US5: `us5.datadoghq.com`
- EU: `datadoghq.eu`
- AP1: `ap1.datadoghq.com`
- US1-FED: `ddog-gov.com`

## CLI Reference

The plugin wraps all 22 Datadog CLI commands:

**Core Operations:**
- `health` - Service health checks
- `deploy` - Deploy safety validation
- `apm` - APM trace queries
- `logs` - Log search
- `metrics` - Metrics queries

**Management:**
- `incidents` - Incident management
- `monitors` - Monitor management
- `dashboards` - Dashboard operations
- `slos` - SLO management

**Advanced:**
- `synthetics` - Synthetic test management
- `rum` - Real User Monitoring
- `network` - Network Performance Monitoring
- `database` - Database Monitoring
- `security` - Security Monitoring signals
- `workflows` - Workflow execution
- `watchdog` - Anomaly detection alerts
- `services` - Service catalog
- `cost` - Cost tracking
- `llm` - LLM Observability
- `cicd` - CI/CD Visibility
- `context` - Execution context detection
- `version` - CLI version info

## Troubleshooting

### Plugin Not Loading

1. **Check Installation Path**:
   ```bash
   ls -la ~/.claude/plugins/user/datadog-cli/
   ```
   Should show: `.claude-plugin/`, `commands/`, `README.md`

2. **Verify Plugin Metadata**:
   ```bash
   cat ~/.claude/plugins/user/datadog-cli/.claude-plugin/plugin.json
   ```

3. **Restart Claude Code**:
   Quit and relaunch Claude Code completely.

### Authentication Errors

1. **Verify Credentials**:
   ```bash
   echo $DD_API_KEY
   echo $DD_APP_KEY
   ```

2. **Test CLI Directly**:
   ```bash
   $DD_CLI_PATH version
   $DD_CLI_PATH health
   ```

3. **Check Permissions**:
   Ensure API and App keys have required scopes in Datadog.

### Command Not Found

1. **Verify CLI Binary**:
   ```bash
   ls -la $DD_CLI_PATH
   $DD_CLI_PATH version
   ```

2. **Rebuild if Necessary**:
   ```bash
   cd /path/to/dd-skill-test-go
   make build
   ```

### Slow Performance

1. **Check Network Latency**: API calls to Datadog may be slow
2. **Reduce Time Ranges**: Shorter ranges return faster
3. **Limit Results**: Use `--limit` flag to reduce data transfer

## Development

### Adding New Skills

1. Create a new markdown file in `commands/`:
   ```bash
   touch commands/my-skill.md
   ```

2. Add YAML frontmatter:
   ```yaml
   ---
   description: "Brief description"
   argument-hint: "ARGS"
   ---
   ```

3. Add skill documentation and examples

4. Restart Claude Code to load new skill

### Debugging

Enable debug logging:
```bash
export DD_CLI_DEBUG=true
```

View CLI output:
```bash
# The CLI logs to stderr
dd health api-service 2>&1 | tee debug.log
```

## Support

- **Issues**: https://github.com/your-org/dd-skill-test-go/issues
- **Documentation**: See individual skill files in `commands/`
- **Datadog API Docs**: https://docs.datadoghq.com/api/

## License

MIT License - See LICENSE file for details.

## Credits

- Built with Go (3ms startup, 16MB binary)
- Developed using Ralph Loop methodology (20 iterations)
- Integrates with Datadog API v1 and v2
- Designed for Claude Code plugin system

## Version

**CLI Version**: 1.0.0 (20/20 iterations complete)
**Plugin Version**: 1.0.0
**Last Updated**: January 22, 2026

---

For more details on specific commands, see the individual skill files in the `commands/` directory.
