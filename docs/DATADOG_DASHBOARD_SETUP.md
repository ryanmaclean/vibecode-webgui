# Datadog LLM Experiments Dashboard Setup Guide

## Overview

This guide walks you through setting up the complete Datadog dashboard for monitoring LLM experiments in VibeCode.

## Prerequisites

- [x] Datadog account with access to Dashboards
- [x] Datadog API key configured
- [x] Datadog agent running and sending metrics
- [x] Experiments running and sending data (see `RUN_EXPERIMENTS.sh`)

## Dashboard Features

The LLM Experiments Dashboard provides:

### High-Level Metrics
- **Total Experiment Assignments**: Count of users assigned to each variant
- **Total LLM Interactions**: Number of LLM API calls across all experiments
- **Average Cost per Request**: Overall cost efficiency
- **Average Quality Score**: Overall quality across all models

### Experiment 1: Speech Transcription (GPT-4 vs GPT-4.1)
- **Latency by Variant**: Compare response times between GPT-4 and GPT-4.1
- **Cost by Variant**: Compare costs to identify the most cost-effective model

### Experiment 2: Chatbot Performance (Lazy Load vs Preload)
- **Total Latency**: End-to-end response time comparison
- **Cold Start Time**: Lazy load initialization penalty visualization

### Experiment 3: Multi-Model Selection (GPT-4, Claude, Gemini, Llama)
- **Quality Scores**: Compare model quality across variants
- **Cost Comparison**: Identify the best value-for-quality ratio

### Additional Insights
- **Assignment Distribution**: Sunburst chart showing experiment and variant distribution
- **Top Models by Usage**: Ranking of most-used models
- **Token Usage**: Track token consumption by experiment
- **Guardrail Violations**: Alert on quality/cost threshold breaches
- **Error Rate**: Monitor experiment reliability

## Quick Setup (Recommended)

### Method 1: Import Dashboard JSON

1. **Download the Dashboard JSON**
   ```bash
   # File is located at the repository root
   cat datadog-llm-experiments-dashboard.json
   ```

2. **Import to Datadog**
   - Go to [Datadog Dashboards](https://app.datadoghq.com/dashboard/lists)
   - Click **"New Dashboard"** → **"Import Dashboard JSON"**
   - Paste the contents of `datadog-llm-experiments-dashboard.json`
   - Click **"Save"**

3. **Verify Dashboard**
   - The dashboard should now appear in your dashboard list
   - All widgets should load (some may show "No data" until experiments run)

### Method 2: Use Datadog API

```bash
# Set your Datadog credentials
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"

# Import the dashboard
curl -X POST "https://api.datadoghq.com/api/v1/dashboard" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d @datadog-llm-experiments-dashboard.json
```

## Manual Setup (Step-by-Step)

If you prefer to create the dashboard manually or customize it:

### Step 1: Create New Dashboard

1. Go to [Datadog Dashboards](https://app.datadoghq.com/dashboard/lists)
2. Click **"New Dashboard"**
3. Name it: **"VibeCode LLM Experiments - A/B Testing Dashboard"**
4. Choose **"New Ordered Dashboard"**

### Step 2: Add Template Variables

Click **"Add Template Variable"** and add these:

| Variable | Default | Prefix |
|----------|---------|--------|
| `experiment` | `*` | `experiment` |
| `variant` | `*` | `variant` |
| `env` | `development` | `env` |

### Step 3: Add Widgets

#### Overview Section

**Widget 1: Total Assignments**
- Type: **Query Value**
- Metric: `sum:vibecode.experiments.assignments{*}.as_count()`
- Title: "Experiment Assignments by Variant"

**Widget 2: Total Interactions**
- Type: **Query Value**
- Metric: `sum:vibecode.experiments.llm.interactions{*}.as_count()`
- Title: "Total LLM Interactions"

**Widget 3: Average Cost**
- Type: **Query Value**
- Metric: `avg:vibecode.experiments.llm.cost.usd{*}`
- Title: "Average Cost per Request"
- Custom Unit: `$`
- Precision: 6

**Widget 4: Average Quality**
- Type: **Query Value**
- Metric: `avg:vibecode.experiments.llm.quality.score{*}`
- Title: "Average Quality Score"
- Precision: 3

#### Experiment 1: Speech Transcription

**Widget 5: Latency by Variant**
- Type: **Timeseries**
- Metric: `avg:vibecode.experiments.llm.latency_ms{experiment:speech_transcription_model} by {variant}`
- Title: "Experiment 1: Speech Transcription - Latency by Variant"
- Y-axis Label: "Latency (ms)"

**Widget 6: Cost by Variant**
- Type: **Timeseries**
- Metric: `avg:vibecode.experiments.llm.cost.usd{experiment:speech_transcription_model} by {variant}`
- Title: "Experiment 1: Speech Transcription - Cost by Variant"
- Y-axis Label: "Cost (USD)"

#### Experiment 2: Chatbot Performance

**Widget 7: Total Latency**
- Type: **Timeseries**
- Metric: `avg:vibecode.experiments.llm.latency_ms{experiment:chatbot_initialization_strategy} by {variant}`
- Title: "Experiment 2: Chatbot Performance - Total Latency"
- Markers: Add horizontal line at 2000ms for target latency

**Widget 8: Cold Start Time**
- Type: **Timeseries (Bars)**
- Metric: `avg:vibecode.experiments.metrics.cold_start_ms{experiment:chatbot_initialization_strategy,variant:lazy_load}`
- Title: "Experiment 2: Cold Start Time (Lazy Load)"

#### Experiment 3: Multi-Model Selection

**Widget 9: Quality Scores**
- Type: **Timeseries**
- Metric: `avg:vibecode.experiments.llm.quality.score{experiment:multi_model_selection} by {variant}`
- Title: "Experiment 3: Multi-Model Quality Scores"
- Markers: Add horizontal line at 0.85 for quality threshold

**Widget 10: Cost Comparison**
- Type: **Timeseries**
- Metric: `avg:vibecode.experiments.llm.cost.usd{experiment:multi_model_selection} by {variant}`
- Title: "Experiment 3: Multi-Model Cost Comparison"

#### Additional Insights

**Widget 11: Assignment Distribution**
- Type: **Sunburst**
- Metric: `sum:vibecode.experiments.assignments{*} by {experiment,variant}.as_count()`
- Title: "Assignment Distribution by Experiment"

**Widget 12: Top Models**
- Type: **Top List**
- Metric: `top(sum:vibecode.experiments.llm.interactions{*} by {model}.as_count(), 10, 'sum', 'desc')`
- Title: "Top Models by Usage"

**Widget 13: Token Usage**
- Type: **Timeseries (Bars)**
- Metric: `sum:vibecode.experiments.llm.tokens.total{*} by {experiment}`
- Title: "Token Usage by Experiment"

**Widget 14: Guardrail Violations**
- Type: **Query Value**
- Metric: `sum:vibecode.experiments.guardrail_violations{*}.as_count()`
- Title: "Guardrail Violations"
- Conditional Formatting:
  - If > 0: Red background
  - If <= 0: Green background

**Widget 15: Error Rate**
- Type: **Timeseries (Bars)**
- Metric: `sum:vibecode.experiments.errors{*} by {experiment}.as_count()`
- Title: "Error Rate by Experiment"

### Step 4: Save Dashboard

Click **"Save"** in the top right corner.

## Verifying Metrics

### Check Metrics are Flowing

1. Go to [Metrics Summary](https://app.datadoghq.com/metric/summary)
2. Search for: `vibecode.experiments`
3. You should see all metrics listed:
   - `vibecode.experiments.assignments`
   - `vibecode.experiments.llm.latency_ms`
   - `vibecode.experiments.llm.ttft_ms`
   - `vibecode.experiments.llm.tokens.total`
   - `vibecode.experiments.llm.cost.usd`
   - `vibecode.experiments.llm.quality.score`
   - `vibecode.experiments.conversions.*`
   - `vibecode.experiments.metrics.*`
   - `vibecode.experiments.errors`
   - `vibecode.experiments.guardrail_violations`

### Run Sample Experiments

If metrics are not showing:

```bash
# Run experiments for 10 users
./RUN_EXPERIMENTS.sh 10

# Or use the script directly
npx tsx scripts/test-datadog-experiments.ts 10
```

This will generate approximately 160 metrics (16 metrics per user × 10 users).

### Check Datadog Agent

Verify the agent is running and receiving metrics:

```bash
# Check agent status
sudo systemctl status datadog-agent

# Check DogStatsD is listening
sudo netstat -tulpn | grep 8125

# Send test metric
echo "test.metric:1|c" | nc -u -w1 localhost 8125

# View agent logs
sudo tail -f /var/log/datadog/agent.log
```

## Using the Dashboard

### Filter by Experiment

Use the template variable dropdown to filter:
- **All Experiments**: Select `experiment:*`
- **Speech Transcription**: Select `experiment:speech_transcription_model`
- **Chatbot Performance**: Select `experiment:chatbot_initialization_strategy`
- **Multi-Model**: Select `experiment:multi_model_selection`

### Filter by Variant

- **All Variants**: Select `variant:*`
- **Specific Variant**: Select `variant:gpt4`, `variant:claude`, etc.

### Time Range

Adjust the time range in the top right:
- **Past 1 Hour**: See recent experiment results
- **Past 24 Hours**: Daily trends
- **Past 7 Days**: Weekly analysis

## Example Queries

### Compare GPT-4 vs GPT-4.1 Latency

```
avg:vibecode.experiments.llm.latency_ms{experiment:speech_transcription_model} by {variant}
```

**Expected Output:**
- `variant:gpt4` → ~1400ms
- `variant:gpt41` → ~1650ms

**Winner:** GPT-4 (20% faster)

### Show Cold Start Impact

```
avg:vibecode.experiments.metrics.cold_start_ms{experiment:chatbot_initialization_strategy,variant:lazy_load}
```

**Expected Output:** ~3000ms penalty for lazy load

### Cost by Model

```
avg:vibecode.experiments.llm.cost.usd{experiment:multi_model_selection} by {variant}
```

**Expected Output:**
- `variant:llama` → $0.000062 (cheapest)
- `variant:gemini` → $0.000294
- `variant:gpt4` → $0.00041
- `variant:claude` → $0.00063 (most expensive)

### Quality Score Comparison

```
avg:vibecode.experiments.llm.quality.score{experiment:multi_model_selection} by {variant}
```

**Expected Output:** All models ~0.85-0.90 (similar quality)

**Winner:** Llama (85% cheaper with same quality)

## Alerting (Optional)

Set up alerts for experiment guardrails:

### Alert 1: Quality Degradation

```
avg(last_5m):avg:vibecode.experiments.llm.quality.score{experiment:speech_transcription_model,variant:gpt4} < 0.8
```

**Alert:** Quality score below threshold

### Alert 2: Cost Spike

```
avg(last_15m):avg:vibecode.experiments.llm.cost.usd{*} > 0.001
```

**Alert:** Costs exceeding budget

### Alert 3: Guardrail Violation

```
sum(last_1h):sum:vibecode.experiments.guardrail_violations{*}.as_count() > 0
```

**Alert:** Any guardrail violation detected

## Troubleshooting

### Dashboard shows "No data"

**Possible causes:**
1. Experiments haven't run yet
   - **Solution:** Run `./RUN_EXPERIMENTS.sh 10`

2. Datadog agent not running
   - **Solution:** `sudo systemctl start datadog-agent`

3. Wrong API key
   - **Solution:** Check `.env.local` has correct `DD_API_KEY`

4. Metrics delayed
   - **Solution:** Wait 30-60 seconds for metrics to propagate

### Metrics appearing but not in widgets

**Possible causes:**
1. Incorrect metric name in query
   - **Solution:** Go to Metrics Summary and verify exact metric names

2. Wrong tags
   - **Solution:** Check tags match what's being sent (e.g., `experiment:speech_transcription_model`)

3. Time range too narrow
   - **Solution:** Expand time range to "Past 1 Hour" or wider

### Data looks incorrect

**Possible causes:**
1. Using simulated data (not real LLM calls)
   - **Solution:** This is expected during testing. Replace `simulateLLMCall` with real API calls.

2. Aggregation method wrong
   - **Solution:** Use `avg` for latency/cost, `sum` for counts

## Next Steps

After dashboard is set up:

1. **Run Production Experiments**
   - Replace simulated LLM calls with real OpenRouter API
   - Integrate with actual RAG chatbot
   - Track real user interactions

2. **Analyze Results**
   - Let experiments run for 7 days
   - Achieve statistical significance (p < 0.05)
   - Calculate confidence intervals

3. **Make Decisions**
   - Roll out winning variants (GPT-4, Preload, Llama)
   - Deprecate losing variants (GPT-4.1, Lazy Load, Claude)
   - Document ROI and cost savings

4. **Continuous Optimization**
   - Create new experiments for other features
   - Track seasonal trends
   - Monitor for quality regressions

## Resources

- **Datadog Dashboards**: https://app.datadoghq.com/dashboard/lists
- **Metrics Explorer**: https://app.datadoghq.com/metric/explorer
- **Metrics Summary**: https://app.datadoghq.com/metric/summary
- **LLM Observability**: https://app.datadoghq.com/llm
- **Dashboard JSON**: `datadog-llm-experiments-dashboard.json`
- **Experiment Code**: `src/lib/experiments/run-datadog-experiments.ts`
- **Tracking Code**: `src/lib/experiments/datadog-agent-tracking.ts`

## Support

For issues or questions:
- Check logs: `sudo tail -f /var/log/datadog/agent.log`
- Verify metrics: https://app.datadoghq.com/metric/summary
- Review code: `src/lib/experiments/`
- Documentation: `EXPERIMENTS_DATADOG_VERIFIED.md`

---

**Status:** 🟢 **Dashboard Ready for Deployment**

Import the JSON and start tracking your LLM experiments!
