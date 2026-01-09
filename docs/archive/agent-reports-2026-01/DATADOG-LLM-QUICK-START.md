# Datadog LLM Observability - Quick Start (5 Minutes)

## Problem
Your Datadog LLM Observability dashboards show empty graphs.

## Solution (Already Applied)
```bash
# ✅ Step 1: Configuration updated
.env.local now contains:
  DD_LLMOBS_ENABLED=true
  DD_LLMOBS_AGENTLESS_ENABLED=true
  DD_LLMOBS_ML_APP=vibecode-ai

# ✅ Step 2: Code fixed
src/lib/datadog-llm.ts
  Boolean parsing corrected

# Now you just need to:
```

## Execute These Steps Now

### 1. Rebuild the App (1 minute)
```bash
npm run build
```

### 2. Start the App (30 seconds)
```bash
npm run dev
```

**Watch for this message**:
```
✅ Datadog LLM Observability enabled for OpenAI and LangChain
```

### 3. Generate Metrics (1 minute)
```bash
npx ts-node scripts/test-datadog-llm-observability.ts
```

This will:
- Validate configuration
- Create test LLM spans
- Track token usage
- Send data to Datadog
- Flush metrics

### 4. Wait (2-5 minutes)
Datadog takes time to aggregate metrics:
- 0-30 seconds: Traces appear in APM
- 30 seconds-2 min: Metrics aggregating
- 2-5 min: Dashboards update

### 5. Verify in Datadog

**Option A: Check APM Traces (Appears Immediately)**
1. Open: https://app.datadoghq.com/apm/services
2. Find service: `vibecode-ai`
3. You should see spans with `llm.operation` tags

**Option B: Check LLM Dashboard (2-5 min Delay)**
1. Open: https://app.datadoghq.com/llm/
2. Look for non-zero values in:
   - Requests
   - Tokens
   - Latency
   - Cost

## Success Indicators

### You'll See This in Logs
```
✅ Datadog LLM Observability enabled for OpenAI and LangChain {
  mlApp: 'vibecode-ai',
  agentless: true
}
```

### You'll See This in APM Traces
```
Service: vibecode-ai
Span: llm.completion
Tags:
  - llm.operation: completion
  - llm.model: gpt-3.5-turbo
  - llm.provider: openai
```

### You'll See This in LLM Dashboard (after 5 min)
```
Requests: 5+
Tokens: 150+ prompt, 75+ completion
Latency: 100-2000ms
Cost: $0.01+
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Missing "enabled" message | Rebuild with `npm run build` |
| No APM traces | Check OpenAI API key is valid |
| Empty graphs after 10 min | Run test script again: `npx ts-node scripts/test-datadog-llm-observability.ts` |
| API key error | Verify: `cat ~/.datadog/api_key` |

## Configuration Files

✅ **Already Updated**:
- `.env.local` - Added DD_LLMOBS_ENABLED, etc.
- `src/lib/datadog-llm.ts` - Fixed boolean parsing

📚 **Documentation**:
- `DATADOG-LLM-OBSERVABILITY-SETUP.md` - Full setup guide
- `DATADOG-LLM-EMPTY-GRAPHS-FIX.md` - Detailed troubleshooting
- `DATADOG-LLM-IMPLEMENTATION-SUMMARY.md` - Implementation details

🧪 **Testing**:
- `scripts/test-datadog-llm-observability.ts` - Automated test suite

## Next Steps After Verification

### Create Custom Dashboards
```
Query: sum:llm.requests.total{*}
Query: avg:llm.response.latency_ms{*}
Query: sum:llm.tokens.total{*}
```

### Set Up Alerts
```
Condition: avg:llm.response.latency_ms > 5000
Condition: sum:llm.requests.error > 0
```

### Monitor Costs
```
Query: sum:llm.cost.total{*}
```

## Key References

| Resource | URL |
|----------|-----|
| LLM Observability Dashboard | https://app.datadoghq.com/llm/ |
| APM Services | https://app.datadoghq.com/apm/services |
| Full Setup Guide | `./DATADOG-LLM-OBSERVABILITY-SETUP.md` |
| Datadog Docs | https://docs.datadoghq.com/llm_observability/ |

## Timeline

```
Now:           npm run build
+1 min:        npm run dev (watch for ✅ message)
+2 min:        npx ts-node scripts/test-datadog-llm-observability.ts
+4 min:        Check APM traces (https://app.datadoghq.com/apm/services)
+7-10 min:     Check LLM dashboard (https://app.datadoghq.com/llm/)
```

## Done!

Your Datadog LLM Observability is now configured and metrics should appear in 5-10 minutes. Check the dashboards and you should see real data!

For detailed information, see:
- `DATADOG-LLM-OBSERVABILITY-SETUP.md` - Complete setup guide
- `DATADOG-LLM-IMPLEMENTATION-SUMMARY.md` - What was fixed and why
