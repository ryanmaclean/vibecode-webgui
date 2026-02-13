'use strict';

/**
 * Polecat Operator
 *
 * Watches Polecat CRs and creates corresponding Deployments.
 * This enables the Tundra Dome work distribution system.
 */

const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromCluster();

const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const objectApi = k8s.KubernetesObjectApi.makeApiClient(kc);
const watch = new k8s.Watch(kc);

const NAMESPACE = process.env.NAMESPACE || 'tundra-dome';
const GROUP = 'tundra.dome';
const VERSION = 'v1';
const PLURAL = 'polecats';

// Deployment template for polecats
function createDeploymentSpec(polecat) {
  const name = polecat.metadata.name;
  const spec = polecat.spec;

  const kafkaConsumeTopics = (spec.kafkaTopics?.consume || []).join(',');
  const kafkaProduceTopics = (spec.kafkaTopics?.produce || []).join(',');
  const skills = (spec.skills || []).join(',');
  const lanes = (spec.lanes || []).join(',');

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: `polecat-${name}`,
      namespace: NAMESPACE,
      labels: {
        'app': `polecat-${name}`,
        'tundra.dome/managed-by': 'polecat-operator',
        'tundra.dome/polecat': name,
        'tundra.dome/role': spec.role || 'polecat'
      },
      ownerReferences: [{
        apiVersion: `${GROUP}/${VERSION}`,
        kind: 'Polecat',
        name: polecat.metadata.name,
        uid: polecat.metadata.uid,
        controller: true
      }]
    },
    spec: {
      replicas: spec.replicas || 1,
      selector: {
        matchLabels: {
          'app': `polecat-${name}`,
          'tundra.dome/polecat': name
        }
      },
      template: {
        metadata: {
          labels: {
            'app': `polecat-${name}`,
            'tundra.dome/polecat': name,
            'tundra.dome/role': spec.role || 'polecat'
          },
          annotations: {
            'ad.datadoghq.com/polecat.logs': JSON.stringify([{
              source: 'nodejs',
              service: `polecat-${name}`
            }])
          }
        },
        spec: {
          serviceAccountName: 'tundra-dome-controller',
          initContainers: [{
            name: 'setup',
            image: spec.image || 'node:20-alpine',
            command: ['sh', '-c', `
              cp -rL /code-src/* /app/ 2>/dev/null || true
              cd /app
              ls -la
              if [ -f package.json ]; then
                npm install --production 2>&1 || echo "npm install skipped"
              fi
            `],
            volumeMounts: [
              { name: 'code-src', mountPath: '/code-src', readOnly: true },
              { name: 'app', mountPath: '/app' }
            ]
          }],
          containers: [{
            name: 'polecat',
            image: spec.image || 'node:20-alpine',
            command: ['node', '/app/worker.js'],
            env: [
              { name: 'POLECAT_NAME', value: name },
              { name: 'POLECAT_ROLE', value: spec.role || 'polecat' },
              { name: 'POLECAT_SKILLS', value: skills },
              { name: 'POLECAT_LANES', value: lanes },
              { name: 'KAFKA_BROKERS', value: process.env.KAFKA_BROKERS || 'kafka-service:9092' },
              { name: 'KAFKA_TOPICS_CONSUME', value: kafkaConsumeTopics },
              { name: 'KAFKA_TOPICS_PRODUCE', value: kafkaProduceTopics },
              { name: 'POLECAT_CONCURRENCY', value: String(spec.concurrency || 5) },
              { name: 'POLECAT_HEARTBEAT_INTERVAL', value: spec.heartbeatInterval || '30s' },
              { name: 'DD_SERVICE', value: `polecat-${name}` },
              { name: 'DD_ENV', value: process.env.DD_ENV || 'dev' },
              { name: 'DD_AGENT_HOST', value: 'datadog.datadog.svc.cluster.local' },
              { name: 'DD_LLMOBS_ENABLED', value: 'true' },
              { name: 'DD_LLMOBS_ML_APP', value: 'tundra-dome-polecats' },
              { name: 'OPENROUTER_API_KEY', valueFrom: { secretKeyRef: { name: 'tundra-dome-secrets', key: 'OPENROUTER_API_KEY', optional: true } } },
              { name: 'OLLAMA_HOST', value: 'http://host.docker.internal:11434' },
              { name: 'OLLAMA_MODEL', value: 'mistral:7b' }
            ],
            resources: spec.resources || {
              requests: { cpu: '100m', memory: '256Mi' },
              limits: { cpu: '500m', memory: '512Mi' }
            },
            volumeMounts: [{
              name: 'app',
              mountPath: '/app'
            }]
          }],
          volumes: [
            {
              name: 'code-src',
              configMap: {
                name: 'polecat-worker-code'
              }
            },
            {
              name: 'app',
              emptyDir: {}
            }
          ]
        }
      }
    }
  };
}

// Reconcile a single Polecat
async function reconcilePolecat(polecat) {
  const name = polecat.metadata.name;
  const deploymentName = `polecat-${name}`;

  console.log(`[RECONCILE] Polecat: ${name}`);

  try {
    const deployment = createDeploymentSpec(polecat);

    try {
      // Try to get existing deployment
      await k8sApi.readNamespacedDeployment({ name: deploymentName, namespace: NAMESPACE });
      // Update existing
      await k8sApi.replaceNamespacedDeployment({ name: deploymentName, namespace: NAMESPACE, body: deployment });
      console.log(`[UPDATED] Deployment: ${deploymentName}`);
    } catch (e) {
      const is404 = e.response?.statusCode === 404 || e.statusCode === 404 ||
                    e.code === 404 || (e.body && JSON.parse(e.body)?.code === 404) ||
                    String(e).includes('404');
      if (is404) {
        // Create new
        await k8sApi.createNamespacedDeployment({ namespace: NAMESPACE, body: deployment });
        console.log(`[CREATED] Deployment: ${deploymentName}`);
      } else {
        throw e;
      }
    }

    // Update Polecat status
    await updatePolecatStatus(polecat, 'running');

  } catch (error) {
    console.error(`[ERROR] Failed to reconcile ${name}:`, error.message);
    await updatePolecatStatus(polecat, 'failed', error.message);
  }
}

// Update Polecat CR status using raw HTTP request for proper Content-Type handling
async function updatePolecatStatus(polecat, phase, message) {
  const patch = {
    status: {
      phase: phase,
      message: message || '',
      lastReconciled: new Date().toISOString()
    }
  };

  const cluster = kc.getCurrentCluster();
  const url = new URL(`${cluster.server}/apis/${GROUP}/${VERSION}/namespaces/${NAMESPACE}/${PLURAL}/${polecat.metadata.name}/status`);

  // Read service account token from mounted volume
  const token = require('fs').readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/token', 'utf8');
  const ca = require('fs').readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/ca.crt');

  const body = JSON.stringify(patch);

  try {
    await new Promise((resolve, reject) => {
      const req = require('https').request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'PATCH',
        ca: ca,
        headers: {
          'Content-Type': 'application/merge-patch+json',
          'Authorization': `Bearer ${token}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (e) {
    console.error(`[STATUS] Failed to update status for ${polecat.metadata.name}:`, e.message);
  }
}

// Delete deployment when Polecat is deleted
async function deletePolecat(polecat) {
  const deploymentName = `polecat-${polecat.metadata.name}`;
  console.log(`[DELETE] Polecat: ${polecat.metadata.name}`);

  try {
    await k8sApi.deleteNamespacedDeployment({ name: deploymentName, namespace: NAMESPACE });
    console.log(`[DELETED] Deployment: ${deploymentName}`);
  } catch (e) {
    const is404 = e.response?.statusCode === 404 || e.statusCode === 404 ||
                  e.code === 404 || String(e).includes('404');
    if (!is404) {
      console.error(`[ERROR] Failed to delete ${deploymentName}:`, e.message);
    }
  }
}

// Start watching Polecats
async function startWatch() {
  const path = `/apis/${GROUP}/${VERSION}/namespaces/${NAMESPACE}/${PLURAL}`;

  console.log(`[WATCH] Starting watch on ${path}`);

  const req = await watch.watch(
    path,
    {},
    (type, polecat) => {
      console.log(`[EVENT] ${type}: ${polecat.metadata.name}`);

      switch (type) {
        case 'ADDED':
        case 'MODIFIED':
          reconcilePolecat(polecat);
          break;
        case 'DELETED':
          deletePolecat(polecat);
          break;
      }
    },
    (err) => {
      console.error('[WATCH] Error:', err);
      // Restart watch after error
      setTimeout(startWatch, 5000);
    }
  );

  return req;
}

// Initial reconciliation of existing Polecats
async function initialReconcile() {
  console.log('[INIT] Performing initial reconciliation...');

  try {
    const response = await customApi.listNamespacedCustomObject({
      group: GROUP,
      version: VERSION,
      namespace: NAMESPACE,
      plural: PLURAL
    });

    const polecats = response.items || [];
    console.log(`[INIT] Found ${polecats.length} existing Polecats`);

    for (const polecat of polecats) {
      await reconcilePolecat(polecat);
    }
  } catch (error) {
    console.error('[INIT] Failed to list Polecats:', error.message);
  }
}

// Ensure worker code ConfigMap exists
async function ensureWorkerConfigMap() {
  const workerCode = `
'use strict';

// Initialize ddtrace for LLM Observability BEFORE other imports
const ddTrace = require('dd-trace');
const tracer = ddTrace.init({
  service: process.env.DD_SERVICE || \`polecat-\${process.env.POLECAT_NAME}\`,
  env: process.env.DD_ENV || 'dev'
});

// Access LLMObs from tracer and enable it
const llmobs = ddTrace.llmobs;
llmobs.enable({
  mlApp: 'tundra-dome-polecats'
});

const { Kafka } = require('kafkajs');
const https = require('https');

const kafka = new Kafka({
  clientId: process.env.POLECAT_NAME,
  brokers: (process.env.KAFKA_BROKERS || 'kafka-service:9092').split(',')
});

const consumer = kafka.consumer({
  groupId: \`polecat-\${process.env.POLECAT_NAME}\`,
  sessionTimeout: 60000,       // 60 seconds - higher for resilience
  rebalanceTimeout: 120000,    // 2 minutes for long-running tasks
  heartbeatInterval: 3000      // 3 seconds - standard heartbeat
});
const producer = kafka.producer();

const http = require('http');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OLLAMA_HOST = process.env.OLLAMA_HOST || '';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral:7b';

// Rate limit retry configuration
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 5000;  // 5 seconds base
const RATE_LIMIT_MAX_DELAY_MS = 30000;  // 30 seconds max

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRetryDelay(attempt) {
  const exponential = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, attempt);
  const capped = Math.min(exponential, RATE_LIMIT_MAX_DELAY_MS);
  const jitter = capped * (0.5 + Math.random() * 0.5); // 50-100% of delay
  return Math.round(jitter);
}

// Call host ollama as fallback when OpenRouter rate-limits
async function callOllama(prompt) {
  if (!OLLAMA_HOST) return null;
  const url = new URL(OLLAMA_HOST);
  const body = JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false });
  return new Promise((resolve) => {
    const req = http.request({
      hostname: url.hostname,
      port: url.port || 11434,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ content: parsed.response || '', tokens: { prompt: 0, completion: 0 } });
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// Feature Flag Tracking for Lane-Based Model Routing
const featureFlags = {
  // Lane configuration flags
  'lane.experimental.enabled': true,
  'lane.standard.enabled': true,
  'lane.critical.enabled': true,

  // Model selection flags - ollama primary for all lanes (no rate limits)
  'model.experimental.provider': 'ollama',
  'model.experimental.id': 'mistral:7b',
  'model.standard.provider': 'ollama',
  'model.standard.id': 'mistral:7b',
  'model.critical.provider': 'ollama',
  'model.critical.id': 'mistral:7b',

  // Agent capabilities
  'agent.autonomous_fix.enabled': true,
  'agent.code_review.enabled': true,
  'agent.test_generation.enabled': false
};

function evaluateFeatureFlag(key, defaultValue = null) {
  const value = featureFlags[key] !== undefined ? featureFlags[key] : defaultValue;

  // Track feature flag evaluation for Datadog
  if (process.env.DD_AGENT_HOST) {
    const tags = [
      \`flag:\${key}\`,
      \`value:\${String(value)}\`,
      \`polecat:\${process.env.POLECAT_NAME}\`,
      \`role:\${process.env.POLECAT_ROLE}\`
    ];
    console.log(\`[DD_FEATURE_FLAG] \${tags.join(' ')}\`);
  }

  return value;
}

function getModelForLane(lane) {
  const laneEnabled = evaluateFeatureFlag(\`lane.\${lane}.enabled\`, false);
  if (!laneEnabled) {
    console.log(\`[LANE] \${lane} is disabled, skipping\`);
    return null;
  }

  return {
    provider: evaluateFeatureFlag(\`model.\${lane}.provider\`, 'openrouter'),
    modelId: evaluateFeatureFlag(\`model.\${lane}.id\`, 'meta-llama/llama-3.3-70b-instruct:free')
  };
}

// LLM API call with Datadog LLM Observability instrumentation
async function callLLM(modelConfig, prompt, beadId) {
  // Use llmobs.trace() for proper LLM Observability integration
  return llmobs.trace(
    {
      kind: 'llm',
      name: 'polecat.llm.completion',
      modelName: modelConfig.modelId,
      modelProvider: modelConfig.provider
    },
    async () => {
      if (!OPENROUTER_API_KEY) {
        console.log('[LLM] No OPENROUTER_API_KEY, simulating response');
        llmobs.annotate({
          inputData: [{ role: 'user', content: prompt }],
          outputData: { role: 'assistant', content: 'Simulated response - set OPENROUTER_API_KEY for real calls' },
          metadata: { simulated: true, beadId },
          tags: { 'polecat.name': process.env.POLECAT_NAME, 'bead.id': beadId },
          metrics: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
        });
        await new Promise(r => setTimeout(r, 100));
        return { content: 'Simulated response - set OPENROUTER_API_KEY for real calls', tokens: { prompt: 0, completion: 0 } };
      }

      const requestBody = JSON.stringify({
        model: modelConfig.modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000
      });

      return new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'openrouter.ai',
          path: '/api/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${OPENROUTER_API_KEY}\`,
            'HTTP-Referer': 'https://tundra-dome.local',
            'X-Title': 'Tundra Dome Polecat'
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              if (response.error) {
                llmobs.annotate({
                  inputData: [{ role: 'user', content: prompt }],
                  metadata: { error: response.error.message, beadId },
                  tags: { 'polecat.name': process.env.POLECAT_NAME, 'bead.id': beadId, error: true }
                });
                reject(new Error(response.error.message));
                return;
              }

              const content = response.choices?.[0]?.message?.content || '';
              const usage = response.usage || {};

              // Annotate with LLM Observability data
              llmobs.annotate({
                inputData: [{ role: 'user', content: prompt }],
                outputData: { role: 'assistant', content },
                metadata: {
                  responseModel: response.model || modelConfig.modelId,
                  beadId,
                  maxTokens: 1000
                },
                tags: {
                  'polecat.name': process.env.POLECAT_NAME,
                  'bead.id': beadId
                },
                metrics: {
                  inputTokens: usage.prompt_tokens || 0,
                  outputTokens: usage.completion_tokens || 0,
                  totalTokens: usage.total_tokens || 0
                }
              });

              resolve({
                content,
                tokens: {
                  prompt: usage.prompt_tokens || 0,
                  completion: usage.completion_tokens || 0
                }
              });
            } catch (e) {
              llmobs.annotate({
                inputData: [{ role: 'user', content: prompt }],
                metadata: { parseError: e.message, beadId },
                tags: { 'polecat.name': process.env.POLECAT_NAME, error: true }
              });
              reject(e);
            }
          });
        });

        req.on('error', (e) => {
          llmobs.annotate({
            inputData: [{ role: 'user', content: prompt }],
            metadata: { networkError: e.message, beadId },
            tags: { 'polecat.name': process.env.POLECAT_NAME, error: true }
          });
          reject(e);
        });

        req.write(requestBody);
        req.end();
      });
    }
  );
}

async function processMessage(message) {
  const bead = JSON.parse(message.value.toString());
  // Normalize bead ID: payload uses 'bead' field, not 'id'
  if (!bead.id && bead.bead) bead.id = bead.bead;
  const lane = bead.lane || 'standard';
  console.log(\`[PROCESS] Bead: \${bead.id} Lane: \${lane}\`);

  // Get model configuration for this lane
  const modelConfig = getModelForLane(lane);
  if (!modelConfig) {
    console.log(\`[SKIP] Lane \${lane} disabled for bead \${bead.id}\`);
    return { success: false, reason: 'lane_disabled' };
  }

  console.log(\`[MODEL] Using \${modelConfig.provider}:\${modelConfig.modelId}\`);

  // Check if autonomous fix is enabled
  const autonomousEnabled = evaluateFeatureFlag('agent.autonomous_fix.enabled', false);

  const skills = (process.env.POLECAT_SKILLS || '').split(',');
  console.log(\`[SKILLS] Using: \${skills.join(', ')}\`);

  // Build prompt based on bead type
  let prompt = '';
  let llmResponse = null;

  if (bead.github_event === 'issues' && bead.title) {
    prompt = \`You are an autonomous coding agent. Analyze this GitHub issue and provide a brief plan to fix it.

Issue: \${bead.title}
Repository: \${bead.repo || 'unknown'}
Labels: \${(bead.labels || []).join(', ')}

Provide a concise 2-3 sentence summary of what needs to be done.\`;
  } else if (bead.github_event === 'pull_request' && bead.title) {
    prompt = \`You are an autonomous code reviewer. Analyze this pull request title and provide initial review guidance.

PR: \${bead.title}
Repository: \${bead.repo || 'unknown'}
Base Branch: \${bead.base_branch || 'main'}

Provide a brief 2-3 sentence review focus recommendation.\`;
  } else {
    prompt = \`Process this work item: \${JSON.stringify(bead).slice(0, 500)}\`;
  }

  // Make LLM call if autonomous processing is enabled
  if (autonomousEnabled && prompt) {
    if (modelConfig.provider === 'ollama') {
      // Direct ollama call - no rate limits, no retry needed
      console.log(\`[LLM] Using ollama direct (\${OLLAMA_MODEL}) at \${OLLAMA_HOST}\`);
      try {
        llmResponse = await callOllama(prompt);
        if (llmResponse && llmResponse.content) {
          console.log(\`[LLM] Ollama response: \${llmResponse.content.slice(0, 100)}...\`);
        } else {
          console.error('[LLM] Ollama returned empty response');
          llmResponse = { content: 'Error: Ollama returned empty response', tokens: { prompt: 0, completion: 0 } };
        }
      } catch (error) {
        console.error(\`[LLM] Ollama error: \${error.message}\`);
        // Fallback to OpenRouter if ollama fails
        console.log('[LLM] Ollama failed, trying OpenRouter fallback');
        try {
          llmResponse = await callLLM(modelConfig, prompt, bead.id);
          console.log(\`[LLM] OpenRouter fallback succeeded: \${llmResponse.content.slice(0, 100)}...\`);
        } catch (orError) {
          console.error(\`[LLM] OpenRouter fallback also failed: \${orError.message}\`);
          llmResponse = { content: \`Error: \${error.message}\`, tokens: { prompt: 0, completion: 0 } };
        }
      }
    } else {
      // OpenRouter path with retry + ollama fallback (for critical lane)
      let lastError = null;
      for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            const delay = getRetryDelay(attempt - 1);
            console.log(\`[LLM] Rate limit retry \${attempt}/\${RATE_LIMIT_MAX_RETRIES} after \${delay}ms\`);
            await sleep(delay);
          }
          llmResponse = await callLLM(modelConfig, prompt, bead.id);
          console.log(\`[LLM] Response received: \${llmResponse.content.slice(0, 100)}...\`);
          console.log(\`[LLM] Tokens: prompt=\${llmResponse.tokens.prompt}, completion=\${llmResponse.tokens.completion}\`);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          const isRateLimit = error.message && error.message.toLowerCase().includes('rate limit');
          if (!isRateLimit) {
            console.error(\`[LLM] Non-retryable error: \${error.message}\`);
            break;
          }
          console.warn(\`[LLM] Rate limited (attempt \${attempt + 1}/\${RATE_LIMIT_MAX_RETRIES + 1}): \${error.message}\`);
        }
      }
      // Fallback to host ollama if OpenRouter exhausted retries
      if (lastError && OLLAMA_HOST) {
        console.log(\`[LLM] OpenRouter failed after retries, falling back to ollama at \${OLLAMA_HOST}\`);
        try {
          llmResponse = await callOllama(prompt);
          if (llmResponse && llmResponse.content) {
            console.log(\`[LLM] Ollama fallback succeeded: \${llmResponse.content.slice(0, 100)}...\`);
            lastError = null;
          }
        } catch (ollamaError) {
          console.error(\`[LLM] Ollama fallback also failed: \${ollamaError.message}\`);
        }
      }
      if (lastError) {
        console.error(\`[LLM] All LLM attempts failed: \${lastError.message}\`);
        llmResponse = { content: \`Error: \${lastError.message}\`, tokens: { prompt: 0, completion: 0 } };
      }
    }
  }

  // Emit completion event with feature flag context and LLM response
  const produceTopics = (process.env.KAFKA_TOPICS_PRODUCE || '').split(',').filter(Boolean);
  for (const topic of produceTopics) {
    await producer.send({
      topic,
      messages: [{
        key: bead.id,
        value: JSON.stringify({
          ...bead,
          status: 'completed',
          processedBy: process.env.POLECAT_NAME,
          modelUsed: modelConfig.modelId,
          llmResponse: llmResponse ? {
            content: llmResponse.content.slice(0, 1000),
            tokens: llmResponse.tokens
          } : null,
          featureFlags: {
            autonomousEnabled,
            lane
          }
        })
      }]
    });
  }

  return { success: true };
}

async function main() {
  console.log(\`[START] Polecat \${process.env.POLECAT_NAME} (\${process.env.POLECAT_ROLE})\`);
  console.log(\`[CONFIG] Skills: \${process.env.POLECAT_SKILLS}\`);
  console.log(\`[CONFIG] Lanes: \${process.env.POLECAT_LANES}\`);

  // Log initial feature flag state
  console.log('[FEATURE_FLAGS] Lane routing:', {
    experimental: getModelForLane('experimental'),
    standard: getModelForLane('standard'),
    critical: getModelForLane('critical')
  });

  await consumer.connect();
  await producer.connect();

  const consumeTopics = (process.env.KAFKA_TOPICS_CONSUME || '').split(',').filter(Boolean);

  for (const topic of consumeTopics) {
    await consumer.subscribe({ topic, fromBeginning: false });
    console.log(\`[SUBSCRIBE] \${topic}\`);
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        await processMessage(message);
      } catch (error) {
        console.error(\`[ERROR] Processing failed:\`, error.message);
      }
    }
  });
}

main().catch(console.error);
`;

  const configMap = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: 'polecat-worker-code',
      namespace: NAMESPACE
    },
    data: {
      'worker.js': workerCode,
      'package.json': JSON.stringify({
        name: 'polecat-worker',
        version: '1.0.0',
        dependencies: {
          'kafkajs': '^2.2.4',
          'dd-trace': '^5.82.0'
        }
      }, null, 2)
    }
  };

  try {
    await coreApi.readNamespacedConfigMap({ name: 'polecat-worker-code', namespace: NAMESPACE });
    await coreApi.replaceNamespacedConfigMap({ name: 'polecat-worker-code', namespace: NAMESPACE, body: configMap });
    console.log('[INIT] Updated polecat-worker-code ConfigMap');
  } catch (e) {
    const is404 = e.response?.statusCode === 404 || e.statusCode === 404 ||
                  e.code === 404 || String(e).includes('404');
    if (is404) {
      await coreApi.createNamespacedConfigMap({ namespace: NAMESPACE, body: configMap });
      console.log('[INIT] Created polecat-worker-code ConfigMap');
    } else {
      throw e;
    }
  }
}

// Main
async function main() {
  console.log('='.repeat(60));
  console.log('  POLECAT OPERATOR');
  console.log('  Tundra Dome Work Distribution System');
  console.log('='.repeat(60));
  console.log(`  Namespace: ${NAMESPACE}`);
  console.log(`  Watching: ${GROUP}/${VERSION}/${PLURAL}`);
  console.log('='.repeat(60));

  await ensureWorkerConfigMap();
  await initialReconcile();
  await startWatch();
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
