import assert from 'node:assert/strict';

// Capture dd-trace configuration so we can assert agentless settings
// without contacting the actual Datadog intake.
const tracer = require('dd-trace');
const initCalls: any[] = [];
const useCalls: Array<{ plugin: string; config: Record<string, unknown> | undefined }> = [];

const originalInit = tracer.init?.bind(tracer) ?? (() => tracer);
const originalUse = tracer.use?.bind(tracer);

tracer.init = (config: any) => {
  initCalls.push(config);
  return tracer;
};

tracer.use = (plugin: string, config?: Record<string, unknown>) => {
  useCalls.push({ plugin, config });
  return tracer;
};

const envToForce: Record<string, string> = {
  DD_API_KEY: process.env.DD_API_KEY ?? 'test-agentless-api-key',
  DD_SITE: process.env.DD_SITE ?? 'datadoghq.com',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CI: 'false',
  GITHUB_ACTIONS: 'false',
  DOCKER_BUILD: 'false',
  SKIP_MONITORING: 'false',
  DD_ENABLED: process.env.DD_ENABLED ?? 'true'
};

const previousEnv = new Map<string, string | undefined>();
for (const [key, value] of Object.entries(envToForce)) {
  previousEnv.set(key, process.env[key]);
  process.env[key] = value;
}

async function main() {
  try {
    await import('./src/instrument');

    assert.equal(initCalls.length, 1, 'Expected dd-trace.init to run exactly once');
    const config = initCalls[0];

    const site = envToForce.DD_SITE;
    const expectedTraceUrl = `https://api.${site}/api/v2/traces`;

    assert.equal(config.traceUrl, expectedTraceUrl, 'Agentless trace URL should target Datadog intake');
    assert.equal(
      config.exporterOptions?.url,
      expectedTraceUrl,
      'Exporter must send traces to Datadog agentless endpoint'
    );
    assert.equal(
      config.exporterOptions?.headers?.['DD-API-KEY'],
      envToForce.DD_API_KEY,
      'Exporter must propagate the DD-API-KEY header in agentless mode'
    );
    assert.equal(config.tags?.['agentless.enabled'], 'true', 'Agentless tag should be true when API key present');
    assert.equal(config.site, site, 'Datadog site should propagate into tracer config');

    assert.ok(config.llmobs?.enabled, 'LLM Observability should be enabled automatically');
    assert.ok(config.llmobs?.agentlessEnabled, 'LLM Observability should inherit agentless transport');

    const openaiPlugin = useCalls.find((call) => call.plugin === 'openai');
    assert.ok(openaiPlugin, 'OpenAI plugin should be enabled for Datadog spans');
    assert.ok(openaiPlugin?.config?.service, 'OpenAI plugin should include service override');
    assert.ok(openaiPlugin?.config?.mlApp, 'OpenAI plugin should include mlApp tag');

    console.log('✅ Agentless tracing configuration verified successfully.');
  } catch (error) {
    console.error('❌ Agentless tracing verification failed.');
    throw error;
  } finally {
    for (const [key, value] of previousEnv.entries()) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    tracer.init = originalInit;
    if (originalUse) {
      tracer.use = originalUse;
    }
  }
}

main().catch(() => {
  process.exitCode = 1;
});
