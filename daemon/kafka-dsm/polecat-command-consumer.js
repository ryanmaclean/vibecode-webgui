'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'tundra-polecat-command-consumer',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const fs = require('fs');
const { execFileSync } = require('child_process');
const { Kafka } = require('kafkajs');

// Clamp negative timeouts to avoid Node TimeoutNegativeWarning noise.
const _setTimeout = global.setTimeout;
global.setTimeout = (fn, ms, ...args) => _setTimeout(fn, Math.max(0, Number(ms) || 0), ...args);

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPICS = (process.env.KAFKA_TOPICS || process.env.KAFKA_TOPIC || 'tundra-polecat-commands')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'tundra-polecat-commands';
const OUT_PATH = process.env.POLECAT_COMMAND_LOG || '/Users/studio/gt/logs/polecat-command-consumer.jsonl';
const TD_CMD = process.env.TD_CMD || 'td';
const SESSION_PREFIX = process.env.POLECAT_SESSION_PREFIX || 'polecat';
const DEFAULT_CMD = process.env.POLECAT_SESSION_CMD || '';
const DRY_RUN = (process.env.POLECAT_DRY_RUN || '').toLowerCase() === 'true';

const DD_AGENT_HOST = process.env.DD_AGENT_HOST || '127.0.0.1';
const DD_DOGSTATSD_PORT = Number(process.env.DD_DOGSTATSD_PORT || 8125);
const DD_ENV = process.env.DD_ENV || 'local';
const DD_SERVICE = process.env.DD_SERVICE || 'tundra-polecat-command-consumer';
const DD_TAGS = (process.env.DD_TAGS || '').split(',').map((t) => t.trim()).filter(Boolean);

const WAKE_ACTIONS = new Set(['wake', 'launch', 'start', 'spawn', 'session.start', 'session.wake']);

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

function coalesce(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return '';
}

function targetToId(target) {
  if (!target) return '';
  const raw = String(target);
  const match = raw.match(/polecats\/([^/]+)/i);
  if (match) return match[1];
  const parts = raw.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : raw;
}

function resolveSessionName(evt, payload) {
  const session = coalesce(
    evt.session,
    payload.session,
    evt.session_name,
    payload.session_name,
    evt.name,
    payload.name
  );
  if (session) return String(session);

  const polecatId = coalesce(evt.polecat, payload.polecat, targetToId(evt.target), targetToId(payload.target));
  if (polecatId) return `${SESSION_PREFIX}-${polecatId}`;

  return `${SESSION_PREFIX}-unknown`;
}

function listSessions() {
  try {
    return execFileSync(TD_CMD, ['session', 'list'], { encoding: 'utf8' });
  } catch (err) {
    return '';
  }
}

function sessionExists(name) {
  if (!name) return false;
  const output = listSessions();
  if (!output) return false;
  return output.split(/\r?\n/).some((line) => line.includes(name));
}

function startSession(name, cmdline) {
  if (!name) return false;
  if (DRY_RUN) return true;

  if (sessionExists(name)) {
    return true;
  }

  const args = ['session', 'start', '--name', name];
  if (cmdline) {
    args.push('--cmd', cmdline);
  }
  execFileSync(TD_CMD, args, { stdio: 'ignore' });
  return true;
}

function handleCommand(evt) {
  const payload = typeof evt.payload === 'object' && evt.payload ? evt.payload : {};
  const action = String(
    coalesce(evt.action, payload.action, evt.command, payload.command, evt.type, payload.type)
  ).toLowerCase();
  if (!WAKE_ACTIONS.has(action)) {
    return false;
  }

  const sessionName = resolveSessionName(evt, payload);
  const cmdline = String(coalesce(evt.cmd, payload.cmd, evt.command, payload.command, DEFAULT_CMD));

  startSession(sessionName, cmdline);
  return true;
}

async function run() {
  const kafka = new Kafka({ clientId: 'tundra-polecat-commands', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });

  await consumer.connect();
  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const value = message.value ? message.value.toString('utf8') : '';
      if (!value) return;

      fs.appendFileSync(OUT_PATH, value + '\n');
      let evt;
      try {
        evt = JSON.parse(value);
      } catch {
        sendMetric('tundra.polecat_command.parse_error', 1, [`topic:${topic}`]);
        return;
      }
      evt.topic = topic;

      const handled = handleCommand(evt);
      if (handled) {
        sendMetric('tundra.polecat_command.handled', 1, [`topic:${topic}`]);
      } else {
        sendMetric('tundra.polecat_command.ignored', 1, [`topic:${topic}`]);
      }
    }
  });
}

run().catch((err) => {
  console.error('polecat-command-consumer error', err);
  process.exit(1);
});
