#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Fetches the list of currently working OpenRouter free-tier models,
 * verifies they can serve a trivial chat completion, and writes the
 * resulting list to disk and (optionally) a Kubernetes ConfigMap.
 */

const { writeFile, mkdir } = require('node:fs/promises');
const { dirname } = require('node:path');
const process = require('node:process');

const DEFAULT_PROMPT = 'Reply with a single sentence describing what VibeCode does.';
const DEFAULT_MAX_MODELS = Number(process.env.MAX_FREE_MODELS || 10);
const MIN_WORKING_MODELS = Number(process.env.MIN_WORKING_MODELS || 3);
const OUTPUT_JSON_PATH = process.env.OUTPUT_JSON_PATH || 'runtime/free-llm-models.json';
const OUTPUT_TEXT_PATH = process.env.OUTPUT_TEXT_PATH || 'runtime/free-llm-models.txt';
const TEST_TIMEOUT_MS = Number(process.env.OPENROUTER_TEST_TIMEOUT_MS || 15000);
const SLEEP_MS = Number(process.env.OPENROUTER_TEST_SLEEP_MS || 500);
const ENABLE_CONFIGMAP_SYNC = /^true$/i.test(process.env.ENABLE_CONFIGMAP_SYNC || 'true');
const CONFIGMAP_NAME = process.env.CONFIGMAP_NAME || 'free-llm-models';
const CONFIGMAP_KEY_JSON = process.env.CONFIGMAP_KEY_JSON || 'models.json';
const CONFIGMAP_KEY_TEXT = process.env.CONFIGMAP_KEY_TEXT || 'models.txt';
const K8S_NAMESPACE = process.env.K8S_NAMESPACE || process.env.POD_NAMESPACE || 'default';
const DD_API_KEY = process.env.DD_API_KEY;
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';
const METRIC_NAMESPACE = process.env.DATADOG_METRIC_NAMESPACE || 'openrouter.free_models';
const METRIC_TAGS = (process.env.DATADOG_METRIC_TAGS || '').split(',').map((tag) => tag.trim()).filter(Boolean);
const DISABLE_DATADOG_METRICS = /^true$/i.test(process.env.DISABLE_DATADOG_METRICS || 'false');
const DEFAULT_ENV_TAG = process.env.DD_ENV ? `env:${process.env.DD_ENV}` : null;
const DEFAULT_SERVICE_TAG = 'service:vibecode-openrouter-free-model-updater';

function log(message, ...args) {
  console.log(`[openrouter-free-model-updater] ${message}`, ...args);
}

function warn(message, ...args) {
  console.warn(`[openrouter-free-model-updater] ${message}`, ...args);
}

function error(message, ...args) {
  console.error(`[openrouter-free-model-updater] ${message}`, ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeTagValue(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_:\-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 200);
}

function buildMetricTags(extraTags = []) {
  const tags = new Set();
  if (DEFAULT_ENV_TAG) tags.add(DEFAULT_ENV_TAG);
  tags.add(DEFAULT_SERVICE_TAG);
  for (const tag of METRIC_TAGS) {
    tags.add(tag);
  }
  for (const tag of extraTags) {
    if (tag) tags.add(tag);
  }
  return Array.from(tags);
}

async function sendDatadogMetrics(series) {
  if (DISABLE_DATADOG_METRICS || !DD_API_KEY) {
    if (!DD_API_KEY) {
      log('Skipping Datadog metrics (DD_API_KEY not set).');
    }
    return;
  }

  const url = `https://api.${DD_SITE}/api/v2/series`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': DD_API_KEY
      },
      body: JSON.stringify({ series })
    });

    if (!response.ok) {
      const text = await response.text();
      warn(`Datadog metrics submission failed (${response.status} ${response.statusText}): ${text}`);
    } else {
      log('Datadog metrics submitted successfully.');
    }
  } catch (err) {
    warn('Error submitting Datadog metrics:', err);
  }
}

async function emitSuccessMetrics(summary) {
  const timestamp = Math.floor(Date.now() / 1000);
  const tags = buildMetricTags([
    `models:${summary.workingCount}`,
    `tested:${summary.candidateCount}`
  ]);

  const series = [
    {
      metric: `${METRIC_NAMESPACE}.success` ,
      type: 'count',
      points: [{ timestamp, value: 1 }],
      tags
    },
    {
      metric: `${METRIC_NAMESPACE}.working_models`,
      type: 'gauge',
      points: [{ timestamp, value: summary.workingCount }],
      tags
    },
    {
      metric: `${METRIC_NAMESPACE}.tested_candidates`,
      type: 'gauge',
      points: [{ timestamp, value: summary.candidateCount }],
      tags
    },
    {
      metric: `${METRIC_NAMESPACE}.duration_ms`,
      type: 'gauge',
      points: [{ timestamp, value: summary.durationMs }],
      tags
    }
  ];

  await sendDatadogMetrics(series);
}

async function emitFailureMetrics(err, durationMs) {
  const timestamp = Math.floor(Date.now() / 1000);
  const errorTag = sanitizeTagValue((err?.message || 'unknown').slice(0, 120));
  const tags = buildMetricTags([`error:${errorTag}`]);

  const series = [
    {
      metric: `${METRIC_NAMESPACE}.failure`,
      type: 'count',
      points: [{ timestamp, value: 1 }],
      tags
    },
    {
      metric: `${METRIC_NAMESPACE}.duration_ms`,
      type: 'gauge',
      points: [{ timestamp, value: durationMs }],
      tags
    }
  ];

  await sendDatadogMetrics(series);
}

function buildHeaders() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER;
  }
  if (process.env.OPENROUTER_APP_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_APP_TITLE;
  }
  return headers;
}

async function fetchFreeCandidates(headers) {
  const endpoint = 'https://openrouter.ai/api/v1/models';
  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch model catalogue (${response.status} ${response.statusText}): ${text}`);
  }
  const payload = await response.json();
  const candidates = (payload.data || [])
    .filter((model) => typeof model?.id === 'string' && model.id.endsWith(':free'))
    .map((model) => ({
      id: model.id,
      pricing: model.pricing || {},
      context_length: model.context_length,
      availability: model.availability || 'unknown'
    }))
    .filter((model) => {
      const promptCost = Number(model.pricing?.prompt ?? 0);
      const completionCost = Number(model.pricing?.completion ?? 0);
      return promptCost === 0 && completionCost === 0;
    });

  log(`Discovered ${candidates.length} free-tier candidates from OpenRouter.`);
  return candidates.slice(0, Math.max(DEFAULT_MAX_MODELS, MIN_WORKING_MODELS + 2));
}

async function verifyModel(modelId, headers, prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: 'You are a concise assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 64,
        temperature: 0.2
      })
    });

    const raw = await response.text();
    if (!response.ok) {
      warn(`Model ${modelId} returned non-OK status ${response.status}: ${raw}`);
      return { ok: false, status: response.status, body: raw };
    }

    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (err) {
      warn(`Model ${modelId} produced invalid JSON: ${err}`);
      return { ok: false, error: String(err) };
    }

    if (payload?.error) {
      warn(`Model ${modelId} reported error: ${JSON.stringify(payload.error)}`);
      return { ok: false, error: JSON.stringify(payload.error) };
    }

    log(`Model ${modelId} passed verification.`);
    return { ok: true, payload };
  } catch (err) {
    if (err?.name === 'AbortError') {
      warn(`Model ${modelId} timed out after ${TEST_TIMEOUT_MS}ms.`);
      return { ok: false, error: 'timeout' };
    }
    warn(`Model ${modelId} verification failed: ${err}`);
    return { ok: false, error: String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

async function writeFileIfConfigured(path, contents) {
  if (!path) return null;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
  return path;
}

async function syncConfigMap(payload) {
  if (!ENABLE_CONFIGMAP_SYNC) {
    log('ConfigMap sync disabled; skipping Kubernetes API call.');
    return;
  }

  if (!process.env.KUBERNETES_SERVICE_HOST) {
    log('Not running inside a Kubernetes cluster; skipping ConfigMap sync.');
    return;
  }

  let clientModule;
  try {
    clientModule = require('@kubernetes/client-node');
  } catch (err) {
    warn('Unable to load @kubernetes/client-node; skipping ConfigMap sync.', err);
    return;
  }

  const { KubeConfig, CoreV1Api, HttpError } = clientModule;
  const kc = new KubeConfig();
  kc.loadFromCluster();
  const api = kc.makeApiClient(CoreV1Api);

  const textBlob = payload.models.join('\n');
  const data = {
    [CONFIGMAP_KEY_JSON]: JSON.stringify(payload, null, 2),
    [CONFIGMAP_KEY_TEXT]: textBlob
  };

  try {
    await api.patchNamespacedConfigMap(
      CONFIGMAP_NAME,
      K8S_NAMESPACE,
      { data },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );
    log(`Patched ConfigMap ${CONFIGMAP_NAME} in namespace ${K8S_NAMESPACE}.`);
  } catch (err) {
    if (err instanceof HttpError && err.body?.code === 404) {
      await api.createNamespacedConfigMap(K8S_NAMESPACE, {
        metadata: { name: CONFIGMAP_NAME },
        data
      });
      log(`Created ConfigMap ${CONFIGMAP_NAME} in namespace ${K8S_NAMESPACE}.`);
    } else {
      warn(`Failed to update ConfigMap ${CONFIGMAP_NAME}: ${err}`);
      throw err;
    }
  }
}

async function main() {
  const startedAt = Date.now();
  const headers = buildHeaders();
  if (!headers) {
    log('OPENROUTER_API_KEY not set; skipping update.');
    return { skipped: true, durationMs: Date.now() - startedAt };
  }

  const prompt = process.env.OPENROUTER_TEST_PROMPT || DEFAULT_PROMPT;
  const candidates = await fetchFreeCandidates(headers);

  const working = [];
  for (const candidate of candidates) {
    if (working.length >= DEFAULT_MAX_MODELS) break;
    const result = await verifyModel(candidate.id, headers, prompt);
    if (result.ok) {
      working.push({
        id: candidate.id,
        context_length: candidate.context_length,
        availability: candidate.availability,
        verifiedAt: new Date().toISOString()
      });
    }
    await sleep(SLEEP_MS);
  }

  if (working.length < MIN_WORKING_MODELS) {
    throw new Error(`Insufficient working free models (wanted >= ${MIN_WORKING_MODELS}, found ${working.length}).`);
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    models: working.map((entry) => entry.id),
    metadata: {
      minWorkingModels: MIN_WORKING_MODELS,
      maxCandidates: DEFAULT_MAX_MODELS,
      tested: candidates.length,
      passed: working
    }
  };

  const textList = `${payload.models.join('\n')}\n`;

  const jsonPath = await writeFileIfConfigured(OUTPUT_JSON_PATH, JSON.stringify(payload, null, 2));
  if (jsonPath) {
    log(`Wrote JSON payload to ${jsonPath}.`);
  }
  const textPath = await writeFileIfConfigured(OUTPUT_TEXT_PATH, textList);
  if (textPath) {
    log(`Wrote text model list to ${textPath}.`);
  }

  try {
    await syncConfigMap(payload);
  } catch (err) {
    throw new Error(`ConfigMap sync failed: ${err.message || err}`);
  }

  const durationMs = Date.now() - startedAt;
  log(`Completed update with ${payload.models.length} working models in ${durationMs}ms.`);

  return {
    payload,
    durationMs,
    candidateCount: candidates.length,
    workingCount: payload.models.length
  };
}

const RUN_STARTED_AT = Date.now();

main()
  .then(async (result) => {
    if (!result || result.skipped) {
      return;
    }

    await emitSuccessMetrics({
      workingCount: result.workingCount,
      candidateCount: result.candidateCount,
      durationMs: result.durationMs
    });
  })
  .catch(async (err) => {
    const durationMs = Date.now() - RUN_STARTED_AT;
    await emitFailureMetrics(err, durationMs);
    error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  });
