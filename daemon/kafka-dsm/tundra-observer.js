'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'tundra-observer',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const { Kafka } = require('kafkajs');

// Clamp negative timeouts to avoid Node TimeoutNegativeWarning noise.
const _setTimeout = global.setTimeout;
global.setTimeout = (fn, ms, ...args) => _setTimeout(fn, Math.max(0, Number(ms) || 0), ...args);

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPICS = (process.env.OBSERVER_TOPICS || '').split(',').map((t) => t.trim()).filter(Boolean);
const GROUP_ID = process.env.OBSERVER_GROUP_ID || 'tundra-observer';
const OUT_PATH = process.env.OBSERVER_LOG || '/Users/studio/gt/logs/tundra-observer.jsonl';
const RULES_PATH = process.env.OBSERVER_RULES || '/Users/studio/gt/settings/observer-rules.json';
const DD_CFG = process.env.OBSERVER_DD_CONFIG || '/Users/studio/gt/settings/observer-dd-metrics.json';
const SCHEMA_QUARANTINE_TOPIC = process.env.OBSERVER_SCHEMA_QUARANTINE_TOPIC || 'tundra-beads-failed';
const DD_API_KEY = process.env.DD_API_KEY || '';
const DD_APP_KEY = process.env.DD_APP_KEY || '';
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';
const DD_AGENT_HOST = process.env.DD_AGENT_HOST || '127.0.0.1';
const DD_DOGSTATSD_PORT = Number(process.env.DD_DOGSTATSD_PORT || 8125);
const DD_ENV = process.env.DD_ENV || 'local';
const DD_SERVICE = process.env.DD_SERVICE || 'tundra-observer';
const DD_TAGS = (process.env.DD_TAGS || '').split(',').map((t) => t.trim()).filter(Boolean);

function loadJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

const rules = loadJson(RULES_PATH, { topics: [], allow_event_types: [], redact: { max_len: 280, hash_private_body: true, strip_code: true } });
const ddConfig = loadJson(DD_CFG, { interval_sec: 120, queries: [] });

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function stripCode(text) {
  if (!text) return text;
  return text.replace(/```[\s\S]*?```/g, '[code]').replace(/`[^`]*`/g, '[code]');
}

function redactText(text) {
  if (!text) return '';
  let output = String(text);
  if (rules.redact && rules.redact.strip_code) {
    output = stripCode(output);
  }
  output = output.replace(/(sk-[a-zA-Z0-9]{20,})/g, '[redacted]');
  output = output.replace(/(ghp_[a-zA-Z0-9]{20,})/g, '[redacted]');
  const maxLen = rules.redact && rules.redact.max_len ? rules.redact.max_len : 280;
  if (output.length > maxLen) output = output.slice(0, maxLen) + '…';
  return output;
}

function summarize(evt) {
  const summary = {
    ts: evt.ts || new Date().toISOString(),
    type: evt.type || evt.event || 'unknown',
    lane: evt.lane,
    severity: evt.severity,
    bead: evt.bead,
    issue: evt.issue && (evt.issue.id || evt.issue.number),
    role: evt.role,
    rig: evt.rig,
    source: evt.source,
    schema_name: evt.schema_name || (evt.schema && evt.schema.name),
    schema_id: evt.schema_id || (evt.schema && evt.schema.id),
    schema_version: evt.schema_version || (evt.schema && evt.schema.version),
    schema_status: evt.schema_status
  };

  const body = evt.body || evt.message || evt.description || '';
  const isPrivate = evt.type === 'private' || evt.visibility === 'private' || evt.topic === 'tundra-chat-private';
  if (isPrivate && rules.redact && rules.redact.hash_private_body) {
    summary.body_hash = hashText(String(body));
  } else if (body) {
    summary.body = redactText(body);
  }

  return summary;
}

function isSchemaError(evt) {
  if (evt.schema_error === true) return true;
  if (evt.schema_status && String(evt.schema_status).toLowerCase() === 'error') return true;
  const type = String(evt.type || evt.event || '').toLowerCase();
  if (type === 'schema_error' || type === 'schema.invalid') return true;
  return false;
}

async function quarantineSchema(evt, producer) {
  const payload = {
    ts: new Date().toISOString(),
    type: 'schema_quarantine',
    lane: evt.lane || 'critical',
    severity: evt.severity || 'high',
    bead: evt.bead,
    rig: evt.rig,
    role: evt.role,
    schema_name: evt.schema_name || (evt.schema && evt.schema.name),
    schema_id: evt.schema_id || (evt.schema && evt.schema.id),
    schema_version: evt.schema_version || (evt.schema && evt.schema.version),
    message: evt.message || evt.description || 'Schema error detected',
    original_event: evt.event || evt.type
  };
  await producer.send({ topic: SCHEMA_QUARANTINE_TOPIC, messages: [{ value: JSON.stringify(payload) }] });
  sendMetric('tundra.observer.schema_quarantine', 1, [`topic:${SCHEMA_QUARANTINE_TOPIC}`]);
}

function shouldProcess(evt) {
  if (rules.allow_event_types && rules.allow_event_types.length) {
    const type = evt.type || evt.event || '';
    if (!rules.allow_event_types.includes(type)) return false;
  }
  return true;
}

function writeLog(entry) {
  fs.appendFileSync(OUT_PATH, JSON.stringify(entry) + '\n');
}

function metricLine(name, value, tags) {
  const tagStr = tags && tags.length ? `|#${tags.join(',')}` : '';
  return `${name}:${value}|c${tagStr}`;
}

function sendMetric(name, value, extraTags = []) {
  try {
    const dgram = require('dgram');
    const client = dgram.createSocket('udp4');
    const tags = [`env:${DD_ENV}`, `service:${DD_SERVICE}`, ...DD_TAGS, ...extraTags];
    const line = metricLine(name, value, tags);
    client.send(Buffer.from(line), DD_DOGSTATSD_PORT, DD_AGENT_HOST, () => client.close());
  } catch {
    // ignore metric errors
  }
}

function ddQuery(query, fromMs, toMs) {
  if (!DD_API_KEY || !DD_APP_KEY) return Promise.resolve(null);
  const params = new URLSearchParams({ from: String(Math.floor(fromMs / 1000)), to: String(Math.floor(toMs / 1000)), query });
  const url = `https://api.${DD_SITE}/api/v1/query?${params.toString()}`;
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'DD-API-KEY': DD_API_KEY,
        'DD-APPLICATION-KEY': DD_APP_KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const payload = JSON.parse(data);
          resolve(payload);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function evaluateResult(result) {
  if (!result || !result.series || !result.series.length) return null;
  const points = result.series[0].pointlist || [];
  if (!points.length) return null;
  const last = points[points.length - 1][1];
  return typeof last === 'number' ? last : null;
}

async function runDdLoop(producer) {
  if (!ddConfig.queries || !ddConfig.queries.length) return;
  const interval = Math.max(30, ddConfig.interval_sec || 120);
  setInterval(async () => {
    const now = Date.now();
    for (const q of ddConfig.queries) {
      const result = await ddQuery(q.query, now - 15 * 60 * 1000, now);
      const value = evaluateResult(result);
      if (value === null) continue;
      let triggered = false;
      if (q.op === '>' && value > q.threshold) triggered = true;
      if (q.op === '>=' && value >= q.threshold) triggered = true;
      if (q.op === '<' && value < q.threshold) triggered = true;
      if (q.op === '<=' && value <= q.threshold) triggered = true;
      if (!triggered) continue;

      const payload = {
        ts: new Date().toISOString(),
        type: 'action',
        action: q.action || 'nudge',
        target: q.target,
        severity: q.severity,
        lane: q.lane,
        message: q.message || `${q.name} threshold triggered (${value})`,
        metric: q.name,
        value
      };

      const topic = q.topic || 'tundra-deacon-commands';
      await producer.send({ topic, messages: [{ value: JSON.stringify(payload) }] });
      writeLog({ observer: 'dd-loop', payload });
      sendMetric('tundra.observer.dd_triggered', 1, [`metric:${q.name}`]);
    }
  }, interval * 1000);
}

async function run() {
  const kafka = new Kafka({ clientId: 'tundra-observer', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  const producer = kafka.producer();
  await consumer.connect();
  await producer.connect();

  const topics = TOPICS.length ? TOPICS : (rules.topics || []);
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await runDdLoop(producer);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const value = message.value ? message.value.toString('utf8') : '';
      if (!value) return;
      let evt;
      try {
        evt = JSON.parse(value);
      } catch {
        return;
      }
      evt.topic = topic;
      if (!shouldProcess(evt)) return;
      if (isSchemaError(evt)) {
        await quarantineSchema(evt, producer);
      }
      const summary = summarize(evt);
      writeLog(summary);
      sendMetric('tundra.observer.processed', 1, [`topic:${topic}`]);
    }
  });
}

run().catch((err) => {
  console.error('tundra-observer error', err);
  process.exit(1);
});
