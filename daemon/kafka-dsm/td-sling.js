'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'tundra-td-sling',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const { execFileSync } = require('child_process');
const { Kafka } = require('kafkajs');

// Clamp negative timeouts to avoid Node TimeoutNegativeWarning noise.
const _setTimeout = global.setTimeout;
global.setTimeout = (fn, ms, ...args) => _setTimeout(fn, Math.max(0, Number(ms) || 0), ...args);

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const GT_CMD = process.env.GT_CMD || '/Users/studio/go/bin/gt';
const TD_RIG = process.env.TD_RIG || 'mbp_m1';
const TD_ACTOR = process.env.TD_ACTOR || 'mayor';
const TD_LANE_DEFAULT = process.env.TD_LANE || 'standard';
const TD_DRY_RUN = (process.env.TD_DRY_RUN || '').toLowerCase() === 'true';
const DD_AGENT_HOST = process.env.DD_AGENT_HOST || '127.0.0.1';
const DD_DOGSTATSD_PORT = Number(process.env.DD_DOGSTATSD_PORT || 8125);
const DD_ENV = process.env.DD_ENV || 'local';
const DD_SERVICE = process.env.DD_SERVICE || 'tundra-td-sling';
const DD_TAGS = (process.env.DD_TAGS || '').split(',').map((t) => t.trim()).filter(Boolean);

const TOPIC_LANE_PREFIX = process.env.TD_LANE_PREFIX || 'tundra-lane';
const TOPIC_WORK = process.env.TD_TOPIC_WORK || 'tundra-work-intake';
const TOPIC_AUDIT = process.env.TD_TOPIC_AUDIT || 'tundra-audit-actions';
const TOPIC_IN_PROGRESS = process.env.TD_TOPIC_IN_PROGRESS || 'tundra-beads-in-progress';

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

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { lane: TD_LANE_DEFAULT };
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--lane' && args[i + 1]) {
      out.lane = args[i + 1];
      i += 1;
      continue;
    }
    if (a === '--message' && args[i + 1]) {
      out.message = args[i + 1];
      i += 1;
      continue;
    }
    if (a === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    positional.push(a);
  }
  out.bead = positional[0];
  out.target = positional[1];
  return out;
}

function buildEvent({ bead, target, lane, message }) {
  return {
    ts: new Date().toISOString(),
    event: 'bead.lifecycle',
    type: 'sling',
    stage: 'in_progress',
    bead,
    lane,
    target,
    message: message || '',
    rig: TD_RIG,
    role: TD_ACTOR,
    source: 'td-sling',
    policy: 'superdome'
  };
}

async function emitKafka(evt) {
  const kafka = new Kafka({ clientId: 'tundra-td-sling', brokers: BROKERS });
  const producer = kafka.producer();
  await producer.connect();

  const laneTopic = `${TOPIC_LANE_PREFIX}-${evt.lane}-beads`;
  const payload = JSON.stringify(evt);
  await producer.send({
    topic: TOPIC_WORK,
    messages: [{ value: payload }]
  });
  await producer.send({
    topic: TOPIC_AUDIT,
    messages: [{ value: payload }]
  });
  await producer.send({
    topic: laneTopic,
    messages: [{ value: payload }]
  });
  await producer.send({
    topic: TOPIC_IN_PROGRESS,
    messages: [{ value: payload }]
  });

  await producer.disconnect();
}

function execGT(bead, target, dryRun = TD_DRY_RUN) {
  if (!bead) return;
  if (dryRun) return;
  if (target) {
    execFileSync(GT_CMD, ['sling', bead, target], { stdio: 'ignore' });
    return;
  }
  execFileSync(GT_CMD, ['sling', bead], { stdio: 'ignore' });
}

async function run() {
  const args = parseArgs(process.argv);
  if (!args.bead) {
    console.error('Usage: td sling <bead-id> [target] [--lane <lane>] [--message <msg>] [--dry-run]');
    process.exit(2);
  }
  const lane = (args.lane || TD_LANE_DEFAULT || 'standard').toLowerCase();
  const evt = buildEvent({ bead: args.bead, target: args.target, lane, message: args.message });

  sendMetric('tundra.td_sling.invoked', 1, [`lane:${lane}`]);
  await emitKafka(evt);
  sendMetric('tundra.td_sling.emitted', 1, [`lane:${lane}`]);

  const effectiveDryRun = args.dryRun || TD_DRY_RUN;
  execGT(args.bead, args.target, effectiveDryRun);
}

run().catch((err) => {
  console.error('td-sling error', err);
  process.exit(1);
});
