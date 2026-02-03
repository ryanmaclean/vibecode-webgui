'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'gastown-kafka-consumer-bridge',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const fs = require('fs');
const { execFileSync } = require('child_process');
const { Kafka } = require('kafkajs');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Clamp negative timeouts to avoid Node TimeoutNegativeWarning noise.
const _setTimeout = global.setTimeout;
global.setTimeout = (fn, ms, ...args) => _setTimeout(fn, Math.max(0, Number(ms) || 0), ...args);

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPICS = (process.env.KAFKA_TOPICS || process.env.KAFKA_TOPIC || 'gastown-beads')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'gastown-bridge';
const OUT_PATH = process.env.KAFKA_CONSUME_LOG || '/Users/studio/gt/logs/kafka-gt-consumer.jsonl';
const GT_CMD = process.env.GT_CMD || '/Users/studio/go/bin/gt';
const GT_NUDGE_TARGET = process.env.GT_NUDGE_TARGET || 'mayor';
const GT_BEAD_NUDGE_TARGET = process.env.GT_BEAD_NUDGE_TARGET || 'witness';
const GT_ESCALATE_SOURCE = process.env.GT_ESCALATE_SOURCE || 'kafka:bridge';
const GT_BRIDGE_DRY_RUN = (process.env.GT_BRIDGE_DRY_RUN || '').toLowerCase() === 'true';
const GT_ROUTE_CRITICAL = process.env.GT_ROUTE_CRITICAL || 'mayor';
const GT_ROUTE_STANDARD = process.env.GT_ROUTE_STANDARD || 'deacon';
const GT_ROUTE_EXPERIMENTAL = process.env.GT_ROUTE_EXPERIMENTAL || 'deacon';
const GT_ROUTE_DEFAULT = process.env.GT_ROUTE_DEFAULT || GT_NUDGE_TARGET;
const OPENCLAW_WEBHOOK = process.env.OPENCLAW_WEBHOOK || '';
const OPENCLAW_CMD = process.env.OPENCLAW_CMD || '/opt/homebrew/bin/openclaw';
const OPENCLAW_MESSAGE_TARGET = process.env.OPENCLAW_MESSAGE_TARGET || '';
const DD_AGENT_HOST = process.env.DD_AGENT_HOST || '127.0.0.1';
const DD_DOGSTATSD_PORT = Number(process.env.DD_DOGSTATSD_PORT || 8125);
const DD_ENV = process.env.DD_ENV || 'local';
const DD_SERVICE = process.env.DD_SERVICE || 'gastown-kafka-consumer-bridge';
const DD_TAGS = (process.env.DD_TAGS || '').split(',').map((t) => t.trim()).filter(Boolean);

const beadEvents = new Set(['hook', 'sling', 'done', 'escalation_sent']);

function inferRig(evt, message) {
  if (evt && (evt.rig || evt.r || evt.host || evt.hostname)) {
    return evt.rig || evt.r || evt.host || evt.hostname;
  }
  if (message) {
    const match = / on ([A-Za-z0-9._-]+)/.exec(message);
    if (match) return match[1];
  }
  return '';
}

function rigAwareTarget(target, rig) {
  if (!target) return target;
  const lower = String(target).toLowerCase();
  const rigName = rig && rig !== 'unknown' ? rig : '';
  if (rigName && (lower === 'witness' || lower === 'refinery')) {
    return `${rigName}/${lower}`;
  }
  return target;
}

function execGT(args) {
  if (GT_BRIDGE_DRY_RUN) {
    return;
  }
  try {
    execFileSync(GT_CMD, args, { stdio: 'ignore' });
  } catch (err) {
    // Log and continue so Kafka consumer does not crash on transient nudge failures.
    console.error('gt command failed', { args, error: String(err && err.message ? err.message : err) });
  }
}

function execOpenClawMessage(message) {
  if (!OPENCLAW_MESSAGE_TARGET) return;
  if (GT_BRIDGE_DRY_RUN) return;
  execFileSync(OPENCLAW_CMD, ['message', 'send', '--target', OPENCLAW_MESSAGE_TARGET, '--message', message], { stdio: 'ignore' });
}

function postWebhook(urlString, payload) {
  if (!urlString) return;
  const url = new URL(urlString);
  const data = Buffer.from(JSON.stringify(payload));
  const lib = url.protocol === 'https:' ? https : http;
  const req = lib.request(
    {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    },
    (res) => {
      res.resume();
    }
  );
  req.on('error', () => {});
  req.write(data);
  req.end();
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

function resolveTarget(evt) {
  if (evt.target) return evt.target;
  if (evt.route) return evt.route;
  if (evt.severity && String(evt.severity).toLowerCase() === 'critical') return GT_ROUTE_CRITICAL;
  if (evt.lane) {
    const lane = String(evt.lane).toLowerCase();
    if (lane === 'critical') return GT_ROUTE_CRITICAL;
    if (lane === 'experimental') return GT_ROUTE_EXPERIMENTAL;
    if (lane === 'standard') return GT_ROUTE_STANDARD;
  }
  return GT_ROUTE_DEFAULT;
}

function handleAction(evt) {
  const action = evt.action;
  const rig = inferRig(evt, evt.message || evt.description || '');
  const target = rigAwareTarget(resolveTarget(evt), rig);
  const message = evt.message || evt.description || '';
  if (action === 'nudge') {
    execGT(['nudge', target, '-m', message]);
    execOpenClawMessage(message);
    return true;
  }
  if (action === 'whisper') {
    const whisperMsg = `[whisper] ${message}`.trim();
    execGT(['nudge', target, '-m', whisperMsg]);
    execOpenClawMessage(whisperMsg);
    return true;
  }
  if (action === 'escalate') {
    const severity = evt.severity || 'medium';
    const reason = evt.reason || '';
    const related = evt.related || '';
    const args = ['escalate', message || 'Escalation', '--severity', severity, '--source', GT_ESCALATE_SOURCE];
    if (reason) args.push('--reason', reason);
    if (related) args.push('--related', related);
    execGT(args);
    return true;
  }
  return false;
}

function handleBeadEvent(evt) {
  if (!beadEvents.has(evt.type)) return false;
  const bead = evt.bead || '';
  const stage = evt.stage || evt.type;
  const rig = inferRig(evt, evt.message || '');
  const message = `Bead ${bead} ${stage} on ${rig}`.trim();
  const target = rigAwareTarget(GT_BEAD_NUDGE_TARGET, rig) || GT_ROUTE_DEFAULT;
  execGT(['nudge', target, '-m', message]);
  return true;
}

function handleBdReady(evt) {
  if (evt.event !== 'bd.ready') return false;
  const issue = evt.issue || {};
  const id = issue.id || issue.bead || issue.key || 'unknown';
  const title = issue.title || issue.summary || '';
  const priority = issue.priority || issue.p || '';
  const msg = `BD ready: ${id} ${title} ${priority ? `(P${priority})` : ''}`.trim();
  execGT(['nudge', GT_NUDGE_TARGET, '-m', msg]);
  return true;
}

async function run() {
  const kafka = new Kafka({ clientId: 'gastown-bridge', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const value = message.value ? message.value.toString('utf8') : '';
      if (!value) return;
      let evt;
      try {
        evt = JSON.parse(value);
      } catch {
        fs.appendFileSync(OUT_PATH, value + '\n');
        return;
      }
      evt.topic = topic;
      fs.appendFileSync(OUT_PATH, JSON.stringify(evt) + '\n');
      if (handleAction(evt)) {
        sendMetric('gastown.kafka_consumer.processed', 1);
        return;
      }
      if (handleBdReady(evt)) {
        sendMetric('gastown.kafka_consumer.processed', 1);
        return;
      }
      if (handleBeadEvent(evt)) {
        sendMetric('gastown.kafka_consumer.processed', 1);
        return;
      }
      postWebhook(OPENCLAW_WEBHOOK, evt);
      sendMetric('gastown.kafka_consumer.processed', 1);
    }
  });
}

run().catch((err) => {
  console.error('gt-kafka-consumer error', err);
  process.exit(1);
});
