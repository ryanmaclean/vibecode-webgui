# Datadog LLM Observability: Empty Graphs Fix

## The Problem

Your Datadog LLM Observability dashboard shows empty graphs - no metrics data is appearing even though the app is running and making LLM API calls.

## The Root Cause

**DD_LLMOBS_ENABLED was not set to true in .env.local**

When this variable is not set:
1. The `dd-trace` library initializes but LLM Observability is disabled
2. OpenAI and LangChain plugins are not configured
3. LLM calls are traced but not tagged as "LLM Observability" data
4. Datadog doesn't route them to the LLM Observability product
5. Dashboard queries don't find any metrics

## The Solution (Already Applied)

### Step 1: Update .env.local ✅ DONE

```bash
DD_LLMOBS_ENABLED=true
DD_LLMOBS_AGENTLESS_ENABLED=true
DD_LLMOBS_ML_APP=vibecode-ai
```

**Status**: Updated in `/Users/ryan.maclean/vibecode-webgui/.env.local`

### Step 2: Rebuild the App

The instrumentation is loaded at build time:

```bash
# Clean build
npm run build

# Or with fresh dependencies
rm -rf .next
npm run build
```

### Step 3: Restart with Datadog Enabled

```bash
# Kill any existing process
kill $(lsof -ti:3000)

# Restart
npm run dev
```

Watch for this log message:
```
✅ Datadog LLM Observability enabled for OpenAI and LangChain
```

If you don't see it, the configuration isn't loaded.

### Step 4: Generate LLM Observability Metrics

```bash
# Run the automated test (generates 5+ metrics)
npx ts-node scripts/test-datadog-llm-observability.ts

# Or manually trigger LLM calls in the app
```

### Step 5: Wait for Dashboard Update

- **0-30 seconds**: Spans appear in APM Traces
- **30 seconds - 2 minutes**: Metrics are being aggregated by Datadog
- **2-5 minutes**: Dashboard graphs should show data

### Step 6: Verify in Datadog

#### Check APM Traces (immediate)
```
https://app.datadoghq.com/apm/services
Service: vibecode-ai (or vibecode-webgui-openai)
Look for: spans tagged with llm.operation, llm.model, llm.provider
```

#### Check LLM Observability (2-5 min delay)
```
https://app.datadoghq.com/llm/
Should show:
- Requests (llm.requests.total)
- Tokens (llm.tokens.prompt, llm.tokens.completion)
- Latency (llm.response.latency_ms)
- Cost (llm.cost.total)
```

## Quick Verification Checklist

```bash
# 1. Check .env.local has the flag
grep "DD_LLMOBS_ENABLED=true" .env.local && echo "✅ DD_LLMOBS_ENABLED set"

# 2. Check app is running
curl -s http://localhost:3000 > /dev/null && echo "✅ App running"

# 3. Make an LLM call and generate metrics
npx ts-node scripts/test-datadog-llm-observability.ts

# 4. Check logs for the success message
npm run dev 2>&1 | grep "Datadog LLM Observability enabled"
```

## If Graphs Are Still Empty After 5 Minutes

### Debug Step 1: Check Configuration

```bash
# Verify environment in running app
npm run dev 2>&1 | grep -i "llmobs\|datadog"

# Should show:
# ✅ Datadog LLM Observability enabled for OpenAI and LangChain
```

### Debug Step 2: Verify API Key

```bash
# Check API key is set
echo $DD_API_KEY
# Should output: 0e4c744e925521aeb1f97486ac8e3884

# Verify it's valid
curl -H "DD-API-KEY: $DD_API_KEY" \
  https://api.datadoghq.com/api/v1/validate
# Should return: {"valid": true}
```

### Debug Step 3: Check Traces Exist

1. Go to https://app.datadoghq.com/apm/services
2. Look for service: `vibecode-ai`
3. If NOT there:
   - LLM calls aren't being traced at all
   - Check the app didn't fail to start
   - Check OpenAI API key is valid
4. If traces ARE there:
   - Metrics should appear in 2-5 minutes
   - Wait a bit longer and refresh

### Debug Step 4: Check Datadog Receiver

```bash
# Verify Datadog is receiving data
curl -H "DD-API-KEY: $DD_API_KEY" \
  "https://api.datadoghq.com/api/v1/series?query=llm.requests.total"

# Should show recent timestamps if data is being received
```

### Debug Step 5: Rebuild Everything

```bash
# Clean rebuild
rm -rf node_modules .next
npm ci
npm run build

# Restart
npm run dev
```

## Configuration Files Modified

### .env.local (Updated)
Added these lines:
```
DD_LLMOBS_ENABLED=true
DD_LLMOBS_AGENTLESS_ENABLED=true
DD_LLMOBS_ML_APP=vibecode-ai
DD_SITE=datadoghq.com
DD_ENV=development
DD_SERVICE=vibecode-webgui
DD_VERSION=1.5.0
```

### src/instrument.ts (No changes needed)
Already configured to:
- Parse `DD_LLMOBS_ENABLED` correctly
- Enable LLM observability when set
- Configure OpenAI and LangChain plugins
- Set proper tags for traces

### src/lib/datadog-llm.ts (Fixed)
Fixed boolean flag parsing to correctly handle:
- `DD_LLMOBS_ENABLED=true` (string "true")
- `DD_LLMOBS_ENABLED=1` (string "1")
- `DD_LLMOBS_ENABLED=false` (string "false")

Previous code had inverted logic: `process.env.DD_LLMOBS_ENABLED === '1' || false`
This would always be false if not explicitly '1'.

Fixed code: `parseFlag(process.env.DD_LLMOBS_ENABLED, true)`
This correctly parses both 'true' and '1' as enabled.

## Expected Behavior After Fix

### Immediately (upon restart)
```
✅ Datadog LLM Observability enabled for OpenAI and LangChain {
  mlApp: 'vibecode-ai',
  agentless: true
}
```

### 0-30 seconds (APM Traces)
Traces appear at: https://app.datadoghq.com/apm/services
- Service: `vibecode-ai`
- Operation: `openai.chat.completions` (auto-instrumented)
- Tags: `llm.operation`, `llm.model`, `llm.provider`

### 2-5 minutes (LLM Observability Dashboard)
Dashboard shows at: https://app.datadoghq.com/llm/
- Non-zero request counts
- Token usage totals
- Latency measurements
- Cost calculations

## Test Results

The test script `scripts/test-datadog-llm-observability.ts` will:

1. Validate all environment variables are set
2. Run LLMTracer tests
3. Track token usage
4. Create Datadog spans
5. Flush metrics to Datadog

Expected output:
```
🧪 Running: Validate Environment
✅ PASS: Validate Environment

🧪 Running: LLMTracer Basic Test
✅ PASS: LLMTracer Basic Test

... (more tests)

📊 Results: 5 passed, 0 failed (2500ms total)

📝 Next Steps:
   1. Go to https://app.datadoghq.com/llm/
   2. Check metrics appear in 2-5 minutes
```

## Support Resources

- **Datadog LLM Observability**: https://docs.datadoghq.com/llm_observability/
- **APM Traces**: https://docs.datadoghq.com/tracing/
- **Custom Metrics**: https://docs.datadoghq.com/metrics/
- **This Guide**: `/Users/ryan.maclean/vibecode-webgui/DATADOG-LLM-OBSERVABILITY-SETUP.md`

## Summary

| Issue | Before Fix | After Fix |
|-------|-----------|-----------|
| DD_LLMOBS_ENABLED | Not set | ✅ Set to true |
| LLM Observability | Disabled | ✅ Enabled |
| Traces in APM | Maybe | ✅ Definitely |
| Graphs in Dashboard | Empty | ✅ Should populate |
| Time to fix | - | ~5 minutes |

The fix is **already applied to .env.local**. Just rebuild, restart, and wait 2-5 minutes!
