---
title: Datadog dd-trace & LLM Observability Setup
description: Step-by-step guide for enabling Datadog dd-trace instrumentation and LLM Observability across VibeCode services.
---

# 🧠 Datadog LLM Observability + dd-trace Integration

**Last Updated:** October 8, 2025  
**Audience:** Platform engineers wiring Datadog tracing for OpenAI workloads

---

## 🚀 Installation Overview

You can enable LLM Observability (LLMObs) with or without a Datadog Agent. Choose the path that matches your environment.

---

### Scenario A — No Datadog Agent Running

1. **Install the Node.js tracer:**
   ```bash
   npm install dd-trace
   ```

2. **Start your application in agentless mode:**
   ```bash
DD_SITE=<YOUR_DATADOG_SITE> \
DD_API_KEY=<YOUR_API_KEY> \
DD_LLMOBS_ENABLED=1 \
DD_LLMOBS_AGENTLESS_ENABLED=1 \
DD_LLMOBS_PROJECT=<YOUR_PROJECT_NAME> \
DD_LLMOBS_ML_APP=<LEGACY_VALUE_OPTIONAL> \
  node -r 'dd-trace/init' <your_app>.js
  ```

   > **VibeCode default:** `npm run dev` and `npm run start` already preload `dd-trace` via `src/instrument.cjs`, so set the environment variables above and use those scripts when running this repo locally.

---

### Scenario B — Datadog Agent Available

1. **Launch the Datadog Agent (APM + StatsD enabled).**  
   This project standardizes on the Alpine build:
   ```bash
   docker run -d --name dd-agent \
     --cgroupns host \
     --pid host \
     -v /var/run/docker.sock:/var/run/docker.sock:ro \
     -v /proc/:/host/proc/:ro \
     -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
     -e API_KEY=<YOUR_API_KEY> \
     -e DD_API_KEY=<YOUR_API_KEY> \
     -e DD_DOGSTATSD_NON_LOCAL_TRAFFIC=true \
     -e DD_APM_ENABLED=true \
     datadog/docker-dd-agent:latest-alpine
   ```
   > Including both `API_KEY` and `DD_API_KEY` keeps compatibility with legacy instructions while using the Alpine image everywhere in our stack.

2. **Install the tracer runtime (Node.js example):**
   ```bash
   npm install dd-trace
   ```

3. **Boot the app with tracing enabled:**
   ```bash
   DD_SITE=<YOUR_DATADOG_SITE> \
   DD_API_KEY=<YOUR_API_KEY> \
   DD_LLMOBS_ENABLED=1 \
   DD_LLMOBS_PROJECT=<YOUR_PROJECT_NAME> \
   DD_LLMOBS_ML_APP=<LEGACY_VALUE_OPTIONAL> \
   node -r 'dd-trace/init' <your_app>.js
   ```

4. **Custom agent host/port:**  
   Set `DD_AGENT_HOST`, `DD_TRACE_AGENT_PORT`, and `DD_DOGSTATSD_PORT` if the agent runs off-host.

---

### Scenario C — Serverless (AWS Lambda)

1. **Set environment variables in your function configuration:**
   ```bash
   DD_SITE=<YOUR_DATADOG_SITE>
   DD_API_KEY=<YOUR_API_KEY>
   DD_LLMOBS_ENABLED=1
   DD_LLMOBS_PROJECT=<YOUR_PROJECT_NAME>
   # Optional fallback until all services adopt the new project tag:
   DD_LLMOBS_ML_APP=<LEGACY_VALUE_OPTIONAL>
   ```

2. **Flush spans before exit:**
   ```js
   const llmobs = require('dd-trace').llmobs;
   // or, to initialize explicitly:
    const llmobs = require('dd-trace').init({
     llmobs: { project: '<YOUR_PROJECT_NAME>' },
   }).llmobs;

   exports.handler = async (event, context) => {
     // …
     await llmobs.flush();
     return /* response */;
   };
   ```

---

## 🤖 Automatic OpenAI Tracing

With `dd-trace` initialized, Datadog automatically instruments:

- `client.completions.create()`
- `client.chat.completions.create()`
- `client.embeddings.create()`

No extra code is needed to capture input/output payload metadata, latency, or token counts.

---

## 🛠 Debugging Tips

- Enable verbose tracer logs: `DD_TRACE_DEBUG=1`
- For prettier local logs: `DD_TRACE_BEAUTIFUL_LOGS=1`
- Confirm communication by searching for `openai.request` spans in application output.
- Need even more automation? Explore the [Datadog Actions Catalog](https://docs.datadoghq.com/actions/actions_catalog/) to trigger remediation or alerting workflows directly from LLM telemetry.

---

## 📦 APM Usage Metrics (Python, Node.js, PHP)

1. **Ensure Agent APM + StatsD is active** (reuse the Docker command above).
2. **Install language tracer** (example for Node.js):
   ```bash
   npm install dd-trace
   ```
3. **Start your service with instrumentation:**
   ```bash
   DD_TRACE_DEBUG=1 \
   DD_TRACE_BEAUTIFUL_LOGS=1 \
   DD_SERVICE="my-service" \
   DD_ENV="staging" \
   DD_API_KEY=<DATADOG_API_KEY> \
   NODE_OPTIONS='-r dd-trace/init' \
   node app.js
   ```

4. **Adjust host/port variables** if the agent is not on localhost.

---

## 📝 Log Prompt & Completion Sampling

- Enable logs: `DD_OPENAI_LOGS_ENABLED=1`
- Default sampling: 10% of traced requests include prompt/completion logs.
- Adjust via tracer configuration options (see Datadog docs).
- Remember: log submission still requires a valid `DD_API_KEY`.

---

## ✅ Validation Checklist

- Watch application debug output for payloads labeled `openai.request`.
- In Datadog APM, confirm spans tagged with:
  - `ml.app:<YOUR_ML_APP_NAME>`
  - `service:my-service`
- Verify DogStatsD metrics flow (e.g., `ai.tokens.input`).
- Run internal scripts such as `scripts/validate-llm-observability.ts` to smoke test the integration.

Once everything is flowing, you’ll see full end-to-end OpenAI trace coverage alongside automated actions you configure in the Datadog Actions Catalog.
