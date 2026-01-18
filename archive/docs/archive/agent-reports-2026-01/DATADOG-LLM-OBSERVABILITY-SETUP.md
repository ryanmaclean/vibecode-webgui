# Datadog LLM Observability Setup Guide

This guide explains how to set up and verify Datadog LLM Observability so metrics actually appear in your dashboards instead of showing empty graphs.

## Reference

- Official Datadog LLM Observability Docs: https://docs.datadoghq.com/llm_observability/evaluations/external_evaluations/?site=us
- Datadog LLM Observability Home: https://app.datadoghq.com/llm/
- APM Traces: https://app.datadoghq.com/apm/services

## Quick Start (5 minutes)

### 1. Add DD_LLMOBS_ENABLED to .env.local

The critical issue: **DD_LLMOBS_ENABLED was not set**, so the instrumentation was disabled by default.

```bash
# Add these to ~/.vibecode-webgui/.env.local:
DD_LLMOBS_ENABLED=true
DD_LLMOBS_AGENTLESS_ENABLED=true
DD_LLMOBS_ML_APP=vibecode-ai
DD_SITE=datadoghq.com
DD_ENV=development
DD_SERVICE=vibecode-webgui
```

**Already done in this setup!** Check your `.env.local` file has these lines.

### 2. Verify DD_API_KEY Exists

The script looks for your API key in `~/.datadog/api_key`:

```bash
# Check if it exists:
cat ~/.datadog/api_key

# If missing, create it:
mkdir -p ~/.datadog
echo "YOUR_DATADOG_API_KEY" > ~/.datadog/api_key
chmod 600 ~/.datadog/api_key
```

Your API key is already set up in `.env.local`.

### 3. Start the App with Datadog Enabled

```bash
# Build (required for instrumentation to work)
npm run build

# Start in development mode
npm run dev
```

You should see this in the logs:
```
✅ Datadog LLM Observability enabled for OpenAI and LangChain
```

### 4. Make Test LLM API Calls

#### Option A: Run the automated test script (Recommended)

```bash
# Install ts-node if needed
npm install --save-dev ts-node

# Run the test
npx ts-node scripts/test-datadog-llm-observability.ts
```

This will:
- Validate your environment configuration
- Make a real OpenAI API call with tracing
- Generate test LLM spans
- Track token usage metrics
- Flush all data to Datadog

#### Option B: Use the app directly

1. Navigate to http://localhost:3000/onboarding (or any page that calls OpenAI)
2. Trigger an AI feature that calls OpenAI, Anthropic Claude, or any LLM
3. Make multiple requests to generate more data

#### Option C: Use curl to test code completion

```bash
curl -X POST http://localhost:3000/api/code-completion \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a hello world function",
    "model": "gpt-3.5-turbo",
    "temperature": 0.7
  }'
```

### 5. Wait for Metrics to Appear

**Important:** Datadog metrics take **2-5 minutes** to appear in dashboards after being sent.

Timeline:
- 0-30 seconds: Spans appear in APM Traces
- 30 seconds-2 minutes: Metrics are being aggregated
- 2-5 minutes: Dashboards should show data

### 6. Verify Graphs Are NOT Empty

#### Check APM Traces (appears immediately)

1. Go to https://app.datadoghq.com/apm/services
2. Filter by service: `vibecode-ai` or `vibecode-webgui-openai`
3. You should see spans with:
   - `llm.completion`
   - `llm.operation: workflow` or `task`
   - Tags: `llm.model`, `llm.provider`, `llm.request.model`

#### Check LLM Observability Dashboard (2-5 min delay)

1. Go to https://app.datadoghq.com/llm/
2. Look for these metrics:
   - **Requests**: `llm.requests.total`
   - **Tokens**: `llm.tokens.prompt`, `llm.tokens.completion`
   - **Latency**: `llm.response.latency_ms`
   - **Costs**: `llm.cost.total`

#### Check Custom Dashboards

Create a dashboard to visualize:

```
- Query: sum:llm.requests.total{*} (should increase with each call)
- Query: avg:llm.response.latency_ms{*} (should show ~100-2000ms for API calls)
- Query: sum:llm.tokens.total{*} (total tokens used)
```

## Configuration Details

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DD_LLMOBS_ENABLED` | `false` | **Required** - Enable LLM Observability tracing |
| `DD_LLMOBS_AGENTLESS_ENABLED` | `true` | Enable agentless mode (sends data directly to Datadog) |
| `DD_LLMOBS_ML_APP` | `vibecode-ai` | Name of your LLM app in Datadog |
| `DD_API_KEY` | (required) | Your Datadog API key |
| `DD_SITE` | `datadoghq.com` | Datadog site (use `datadoghq.eu` for EU) |
| `DD_ENV` | `development` | Environment (development, staging, production) |
| `DD_SERVICE` | `vibecode-webgui` | Service name |
| `DD_VERSION` | `1.5.0` | App version for better tracking |

### How It Works

1. **Instrumentation** (`src/instrument.ts`):
   - Initializes `dd-trace` with LLM observability enabled
   - Configures OpenAI and LangChain plugins
   - Sets up automatic tracing for LLM calls

2. **LLM Tracer** (`src/lib/monitoring/llm-tracer.ts`):
   - `LLMTracer.traceLLMCall()` - Wraps LLM calls with comprehensive tracing
   - Captures: model, provider, tokens, latency, cost, errors
   - Tags spans with Datadog LLM Observability standard tags

3. **LLM Observability Class** (`src/lib/datadog-llm.ts`):
   - Singleton managing LLM observability configuration
   - Creates workflow and task spans
   - Annotates spans with metadata

4. **Automatic Instrumentation**:
   - OpenAI library calls are automatically traced
   - LangChain operations are automatically traced
   - No code changes needed for basic tracing

## Troubleshooting

### Problem: Graphs are empty

**Cause 1: DD_LLMOBS_ENABLED not set**
```bash
# Check your .env.local:
grep DD_LLMOBS_ENABLED .env.local

# Should output:
# DD_LLMOBS_ENABLED=true

# Fix: Add it and restart
npm run dev
```

**Cause 2: Not making LLM API calls**
```bash
# Run the test script to generate traffic:
npx ts-node scripts/test-datadog-llm-observability.ts

# Or trigger your app's AI features
```

**Cause 3: Waiting too long (< 2 minutes)**
- Metrics take 2-5 minutes to appear in dashboards
- Traces appear in APM immediately (< 30 seconds)
- Check APM first, then wait for dashboard metrics

**Cause 4: Wrong Datadog site**
```bash
# Check:
grep DD_SITE .env.local

# Should be:
# DD_SITE=datadoghq.com (US)
# OR
# DD_SITE=datadoghq.eu (EU)
```

**Cause 5: API key missing or invalid**
```bash
# Check if key file exists:
cat ~/.datadog/api_key

# Check if key is in environment:
echo $DD_API_KEY

# Test connectivity:
curl -H "DD-API-KEY: $DD_API_KEY" \
  https://api.datadoghq.com/api/v1/validate
```

### Problem: No traces in APM

1. Check `dd-trace` is initialized:
   ```
   grep "Datadog LLM Observability enabled" logs/
   ```

2. Verify service name in APM:
   - Service should be: `vibecode-webgui-openai` or `vibecode-ai`
   - NOT just `vibecode-webgui`

3. Check for errors during initialization:
   ```bash
   npm run dev 2>&1 | grep -i "error\|warn\|datadog"
   ```

### Problem: Spans show but no metrics

Metrics require:
1. **Actual API calls** with usage data (tokens, latency)
2. **Waiting 2-5 minutes** for aggregation
3. **Multiple calls** to generate meaningful metrics

### Problem: Can't find API key

Create one in Datadog:
1. Go to https://app.datadoghq.com/account/settings#api_keys
2. Create a new API key
3. Save to `~/.datadog/api_key`:
   ```bash
   mkdir -p ~/.datadog
   echo "YOUR_NEW_KEY" > ~/.datadog/api_key
   chmod 600 ~/.datadog/api_key
   ```

## Verification Checklist

- [ ] `.env.local` contains `DD_LLMOBS_ENABLED=true`
- [ ] `~/.datadog/api_key` contains your Datadog API key
- [ ] App starts with "✅ Datadog LLM Observability enabled" message
- [ ] Ran test script or made LLM API calls
- [ ] Waited 2-5 minutes
- [ ] Check APM traces at https://app.datadoghq.com/apm/services
- [ ] Check LLM Observability at https://app.datadoghq.com/llm/
- [ ] Metrics show non-zero values

## Next Steps

### 1. Create Custom Dashboard

```javascript
// In Datadog UI:
Dashboard > New Dashboard > Add Widget

// Query examples:
sum:llm.requests.total{env:development}
avg:llm.response.latency_ms{service:vibecode-ai}
sum:llm.tokens.total{*}
```

### 2. Set Up Alerts

```javascript
// Alert when latency is high:
avg:llm.response.latency_ms{*} > 5000

// Alert when error rate is high:
sum:llm.requests.error{*} / sum:llm.requests.total{*} > 0.1
```

### 3. Track Costs

```javascript
// Monitor LLM spending:
sum:llm.cost.total{*}
```

### 4. Analyze Traces

- Filter by provider: `llm.request.provider:openai`
- Filter by model: `llm.request.model:gpt-3.5-turbo`
- Filter by user: `user.id:*`
- Sort by latency to find slow calls

## Code Examples

### Wrap LLM Calls

```typescript
import { LLMTracer } from '@/lib/monitoring/llm-tracer';

const result = await LLMTracer.traceLLMCall(
  'my-operation',
  {
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    userId: 'user-123',
  },
  async () => {
    return await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  }
);
```

### Track Custom Metrics

```typescript
import { LLMTracer } from '@/lib/monitoring/llm-tracer';

LLMTracer.trackTokenUsage(
  'openai',
  'gpt-3.5-turbo',
  100,    // prompt tokens
  50,     // completion tokens
  0.05    // cost
);
```

### Create Spans

```typescript
import { LLMTracer } from '@/lib/monitoring/llm-tracer';

const span = LLMTracer.createAISpan('my-operation', {
  'llm.model': 'gpt-3.5-turbo',
  'user.id': 'user-123',
});

try {
  // Do work
} finally {
  span.finish();
}
```

## Support

- Datadog Docs: https://docs.datadoghq.com/llm_observability/
- GitHub Issues: https://github.com/vibecode/vibecode-webgui/issues
- Slack: #datadog-integration

## See Also

- [LLM Observability API Reference](https://docs.datadoghq.com/api/latest/llm-observability/)
- [APM Setup for Node.js](https://docs.datadoghq.com/tracing/trace_collection/library_config/nodejs/)
- [Custom Metrics with StatsD](https://docs.datadoghq.com/developers/dogstatsd/)
