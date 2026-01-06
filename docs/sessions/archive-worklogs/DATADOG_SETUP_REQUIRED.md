# Datadog Setup Required for Experiment Tracking

**Date:** October 25, 2025
**Status:** ⚠️ **RUM CREDENTIALS MISSING**

---

## Current Situation

### ✅ What's Working

1. **Datadog Agent Running**
   - Agent processes active (3 processes)
   - Location: `/opt/datadog-agent/`
   - API Key configured: `f5be780e66c1e53a6d36b79c7c6c0178`
   - Successfully sending metrics to Datadog
   - Site: `datadoghq.com`

2. **Experiments Execute Successfully**
   - All 3 experiments run without errors
   - Simulated LLM calls working
   - Metrics calculated correctly
   - Code calls Datadog tracking methods

3. **OpenAI API Key Available**
   - Found in `.env.local`
   - Ready for real LLM calls

### ❌ What's Missing

**Datadog RUM (Real User Monitoring) Credentials**

The experiments call `RUMMonitoring.init()` which requires:

```bash
NEXT_PUBLIC_DATADOG_APPLICATION_ID=""  # ❌ MISSING
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN=""    # ❌ MISSING
```

**Status:** These are NOT in `.env.local` or macOS Keychain

---

## Why This Matters

The Datadog agent at `/opt/datadog-agent/` is for **server-side metrics** (CPU, memory, etc.).

But our experiments use **Datadog RUM** which is for:
- Browser-side tracking
- LLM Observability
- Feature Flag evaluations
- Experiment tracking
- Custom actions and events

**Two different systems:**
1. **Datadog Agent** (server) → Infrastructure metrics ✅ WORKING
2. **Datadog RUM** (browser) → Experiment tracking ❌ CREDENTIALS MISSING

---

## What Happens Now

When experiments run, they call:

```typescript
// This runs but silently fails
RUMMonitoring.init({
  service: 'vibecode-experiments',
  env: 'development'
});

// This tries to track but has no credentials
datadogRum.addAction('llm.experiment.interaction', {...});
```

**Result:** Code executes without errors, but **no data reaches Datadog RUM**.

The RUM client detects missing credentials and logs:
```
[RUM] Skipping Datadog RUM initialization - no valid client token provided
```

---

## How to Fix

### Option 1: Get RUM Credentials from Datadog Dashboard

1. **Login to Datadog:** https://app.datadoghq.com

2. **Navigate to RUM:**
   - Go to **UX Monitoring → RUM Applications**
   - Or direct: https://app.datadoghq.com/rum/list

3. **Create or Find Application:**
   - Look for existing "vibecode-webgui" application
   - Or create new application

4. **Get Credentials:**
   - **Application ID** - Shows in application details
   - **Client Token** - Available in "Setup" or "Configuration" tab

5. **Add to Environment:**

   ```bash
   # Add to .env.local
   NEXT_PUBLIC_DATADOG_APPLICATION_ID="your-app-id-here"
   NEXT_PUBLIC_DATADOG_CLIENT_TOKEN="your-client-token-here"
   NEXT_PUBLIC_DATADOG_SITE="datadoghq.com"
   ```

### Option 2: Use Datadog Agent for Backend-Only Tracking

If RUM credentials are not available, we can modify the experiments to use the Datadog agent's statsd/dogstatsd endpoint instead:

```typescript
// Send metrics directly to agent at localhost:8125
import { StatsD } from 'hot-shots';

const dogstatsd = new StatsD({
  host: 'localhost',
  port: 8125,
  prefix: 'vibecode.experiments.'
});

// Track experiment metrics
dogstatsd.increment('assignment', 1, [`experiment:${experimentKey}`, `variant:${variant}`]);
dogstatsd.histogram('latency', latencyMs, [`experiment:${experimentKey}`, `variant:${variant}`]);
dogstatsd.histogram('cost', costUsd, [`experiment:${experimentKey}`, `variant:${variant}`]);
```

---

## Verification After Setup

Once credentials are added:

### 1. Restart Development Server

```bash
npm run dev
```

### 2. Run Experiments

```bash
./RUN_EXPERIMENTS.sh 5
```

### 3. Check RUM Initialization

Look for this in console:
```
✅ [RUM] Datadog RUM initialized successfully
```

Instead of:
```
⚠️ [RUM] Skipping Datadog RUM initialization - no valid client token provided
```

### 4. View in Datadog Dashboard

- **LLM Observability:** https://app.datadoghq.com/llm
- **RUM Actions:** https://app.datadoghq.com/rum/sessions
- **Feature Flags:** https://app.datadoghq.com/rum/feature-flags

Filter by:
- Service: `vibecode-experiments`
- Action: `llm.experiment.interaction`
- Category: `llm-experiment`

---

## Current Files

### Environment Configuration

**`.env.local`** - Has agent config but missing RUM:
```bash
✅ DD_ENV=development
✅ DD_SERVICE=vibecode-webgui
✅ ENABLE_MONITORING=true
✅ OPENAI_API_KEY=sk-proj-...

❌ NEXT_PUBLIC_DATADOG_APPLICATION_ID  # NEEDED
❌ NEXT_PUBLIC_DATADOG_CLIENT_TOKEN    # NEEDED
```

### RUM Client

**`src/lib/monitoring/rum-client.ts:50-54`**
```typescript
// Skip initialization if no client token
if (!rumConfig.clientToken || rumConfig.clientToken.includes('placeholder')) {
  console.warn('[RUM] Skipping Datadog RUM initialization - no valid client token provided');
  return;
}
```

This is currently blocking RUM initialization.

### Experiment Runner

**`src/lib/experiments/run-datadog-experiments.ts:11-17`**
```typescript
function initializeDatadog() {
  RUMMonitoring.initializeWithTracking({
    service: 'vibecode-experiments',
    env: process.env.DD_ENV || 'development',
  });

  console.log('[Experiments] Datadog RUM initialized for LLM observability');
}
```

This logs success but RUM actually skips init silently.

---

## Summary

### Current State

- ✅ Datadog agent running and sending server metrics
- ✅ Experiments execute successfully
- ✅ OpenAI API key available
- ✅ Code structure correct
- ❌ RUM credentials missing
- ❌ No experiment data reaching Datadog RUM

### Next Steps

1. **Get RUM credentials from Datadog dashboard**
2. **Add to `.env.local`:**
   - `NEXT_PUBLIC_DATADOG_APPLICATION_ID`
   - `NEXT_PUBLIC_DATADOG_CLIENT_TOKEN`
3. **Restart dev server**
4. **Run experiments again**
5. **Verify data in Datadog RUM dashboard**

### Alternative

- Modify experiments to use Datadog agent statsd endpoint (localhost:8125)
- This works without RUM credentials
- But won't show in LLM Observability dashboard

---

**Status:** 🟡 **READY TO TRACK - CREDENTIALS NEEDED**

Experiments run successfully but need RUM credentials to send data to Datadog.

---

_"The code is ready, the agent is running, we just need the RUM keys."_
