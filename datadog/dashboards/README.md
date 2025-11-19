# Datadog Dashboards for VibeCode

This directory contains Datadog dashboard definitions for monitoring VibeCode's AI cost tracking and code quality features.

## Dashboards

### 1. AI Cost & Token Usage (`ai-cost-monitoring.json`)

**Purpose**: Monitor AI token usage, costs, and budget tracking across all providers.

**Key Metrics**:
- `vibecode.ai.cost.total_usd` - Total cost in USD
- `vibecode.ai.tokens.prompt` - Prompt tokens used
- `vibecode.ai.tokens.completion` - Completion tokens used
- `vibecode.ai.tokens.total` - Total tokens used
- `vibecode.ai.requests` - Number of AI requests

**Widgets**:
- Total AI Cost (Last 24h)
- Total Tokens (Last 24h)
- AI Requests count
- Average cost per request
- Cost over time by provider
- Token usage by provider
- Cost by model (top 10)
- Requests by operation type
- Cost distribution
- Prompt vs completion tokens
- Cost efficiency (tokens per dollar)

**Tags**:
- `provider` - AI provider (openai, anthropic, google, openrouter)
- `model` - Model name
- `operation` - Operation type (embedding, completion, chat)
- `workspace` - Workspace ID

### 2. Code Quality & Complexity (`code-quality-monitoring.json`)

**Purpose**: Monitor code complexity metrics, pattern detection, and code quality trends.

**Key Metrics**:
- `vibecode.code.complexity.score` - Overall complexity score (0-100)
- `vibecode.code.complexity.cyclomatic` - Cyclomatic complexity
- `vibecode.code.complexity.cognitive` - Cognitive complexity
- `vibecode.code.complexity.nesting` - Max nesting depth
- `vibecode.code.patterns.total` - Number of patterns detected
- `vibecode.code.warnings.total` - Number of warnings
- `vibecode.code.analysis.count` - Number of analyses performed
- `vibecode.code.analysis.duration_ms` - Analysis duration

**Widgets**:
- Average complexity score
- Code analyses count
- Average analysis duration
- Percentage of code with warnings
- Complexity score over time (with thresholds)
- Complexity distribution
- Complexity breakdown (cyclomatic, cognitive, nesting)
- Code by complexity level
- Pattern detection over time
- Warnings over time
- Analysis performance (p95)

**Tags**:
- `complexity` - Complexity level (simple, moderate, complex, very-complex)
- `has_warnings` - Whether code has warnings (true/false)

## Installation

### Using Datadog API

```bash
# Set your Datadog API and APP keys
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"
export DD_SITE="datadoghq.com"  # or your Datadog site

# Import AI Cost dashboard
curl -X POST "https://api.${DD_SITE}/api/v1/dashboard" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d @ai-cost-monitoring.json

# Import Code Quality dashboard
curl -X POST "https://api.${DD_SITE}/api/v1/dashboard" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d @code-quality-monitoring.json
```

### Using Terraform

```hcl
resource "datadog_dashboard_json" "ai_cost_monitoring" {
  dashboard = file("${path.module}/dashboards/ai-cost-monitoring.json")
}

resource "datadog_dashboard_json" "code_quality_monitoring" {
  dashboard = file("${path.module}/dashboards/code-quality-monitoring.json")
}
```

### Manual Import

1. Go to Datadog UI → Dashboards → New Dashboard
2. Click on the gear icon → Import dashboard JSON
3. Paste the contents of the JSON file
4. Click "Import"

## Metrics Reference

### AI Cost Metrics

| Metric | Type | Description | Tags |
|--------|------|-------------|------|
| `vibecode.ai.cost.prompt_usd` | gauge | Cost of prompt tokens in USD | provider, model, operation, workspace |
| `vibecode.ai.cost.completion_usd` | gauge | Cost of completion tokens in USD | provider, model, operation, workspace |
| `vibecode.ai.cost.total_usd` | gauge | Total cost in USD | provider, model, operation, workspace |
| `vibecode.ai.tokens.prompt` | gauge | Number of prompt tokens | provider, model, operation, workspace |
| `vibecode.ai.tokens.completion` | gauge | Number of completion tokens | provider, model, operation, workspace |
| `vibecode.ai.tokens.total` | gauge | Total number of tokens | provider, model, operation, workspace |
| `vibecode.ai.requests` | count | Number of AI requests | provider, model, operation, workspace |

### Code Quality Metrics

| Metric | Type | Description | Tags |
|--------|------|-------------|------|
| `vibecode.code.complexity.score` | gauge | Overall complexity score (0-100) | complexity, has_warnings |
| `vibecode.code.complexity.cyclomatic` | gauge | Cyclomatic complexity | complexity, has_warnings |
| `vibecode.code.complexity.cognitive` | gauge | Cognitive complexity | complexity, has_warnings |
| `vibecode.code.complexity.nesting` | gauge | Maximum nesting depth | complexity, has_warnings |
| `vibecode.code.patterns.total` | gauge | Number of patterns detected | complexity, has_warnings |
| `vibecode.code.warnings.total` | gauge | Number of warnings | complexity, has_warnings |
| `vibecode.code.analysis.count` | count | Number of analyses performed | complexity, has_warnings |
| `vibecode.code.analysis.duration_ms` | histogram | Analysis duration in milliseconds | complexity, has_warnings |

## Alerts & Monitors

### Recommended Monitors

#### High AI Cost Alert
```json
{
  "name": "High AI Cost - Daily Budget Exceeded",
  "type": "metric alert",
  "query": "sum(last_1d):sum:vibecode.ai.cost.total_usd{*} > 50",
  "message": "Daily AI cost has exceeded $50. Current: {{value}}",
  "tags": ["team:platform", "service:vibecode"],
  "priority": 2
}
```

#### Code Complexity Alert
```json
{
  "name": "High Code Complexity Detected",
  "type": "metric alert",
  "query": "avg(last_1h):avg:vibecode.code.complexity.score{*} > 70",
  "message": "Average code complexity is high ({{value}}/100). Review recent code changes.",
  "tags": ["team:engineering", "service:vibecode"],
  "priority": 3
}
```

#### Token Usage Spike
```json
{
  "name": "Unusual Token Usage Spike",
  "type": "anomaly",
  "query": "avg(last_4h):anomalies(sum:vibecode.ai.tokens.total{*}, 'agile', 2) > 0",
  "message": "Unusual spike in token usage detected. Investigate potential issues.",
  "tags": ["team:platform", "service:vibecode"],
  "priority": 2
}
```

## Usage in VS Code Extension

The VS Code extension automatically sends metrics to Datadog when:

1. **Token tracking is enabled** - Every AI request sends cost and token metrics
2. **Code analysis is performed** - Every code explanation sends complexity metrics

### Viewing Dashboards from VS Code

Add commands to `package.json`:

```json
{
  "command": "workspace-rag.openCostDashboard",
  "title": "Open AI Cost Dashboard (Datadog)",
  "category": "RAG"
},
{
  "command": "workspace-rag.openQualityDashboard",
  "title": "Open Code Quality Dashboard (Datadog)",
  "category": "RAG"
}
```

Implementation opens Datadog dashboard URLs:

```typescript
vscode.commands.registerCommand('workspace-rag.openCostDashboard', () => {
  const dashboardUrl = 'https://app.datadoghq.com/dashboard/your-dashboard-id';
  vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
});
```

## Customization

### Adding Custom Widgets

1. Edit the JSON file
2. Add a new widget object to the `widgets` array
3. Update the layout coordinates
4. Re-import the dashboard

### Adding Template Variables

Template variables allow filtering dashboards by specific dimensions:

```json
{
  "template_variables": [
    {
      "name": "environment",
      "default": "production",
      "prefix": "env"
    }
  ]
}
```

## Troubleshooting

### Metrics Not Appearing

1. **Check Datadog Agent**: Ensure the Datadog agent is running
   ```bash
   datadog-agent status
   ```

2. **Check DogStatsD**: Verify DogStatsD is enabled
   ```bash
   datadog-agent config | grep dogstatsd
   ```

3. **Check Metrics in Metrics Explorer**: Search for `vibecode.*` in Datadog Metrics Explorer

4. **Verify dd-trace Integration**: Check that `dd-trace` is properly initialized
   ```typescript
   const tracer = require('dd-trace').init();
   ```

### Dashboard Not Loading

1. **Check JSON Syntax**: Validate JSON with `jq`
   ```bash
   jq . ai-cost-monitoring.json
   ```

2. **Check API Permissions**: Ensure API and APP keys have dashboard permissions

3. **Check Datadog Site**: Verify you're using the correct Datadog site (datadoghq.com, datadoghq.eu, etc.)

## Best Practices

1. **Use Template Variables**: Filter dashboards by environment, team, or service
2. **Set Up Alerts**: Create monitors for budget overruns and quality issues
3. **Regular Review**: Review dashboards weekly to identify trends
4. **Customize for Your Needs**: Adjust thresholds and widgets based on your requirements
5. **Share with Team**: Use Datadog's sharing features to collaborate

## Related Documentation

- [Datadog Dashboard API](https://docs.datadoghq.com/api/latest/dashboards/)
- [Datadog Metrics](https://docs.datadoghq.com/metrics/)
- [DogStatsD](https://docs.datadoghq.com/developers/dogstatsd/)
- [dd-trace Node.js](https://docs.datadoghq.com/tracing/setup_overview/setup/nodejs/)

---

**Last Updated**: November 18, 2025  
**Maintained By**: VibeCode Platform Team
