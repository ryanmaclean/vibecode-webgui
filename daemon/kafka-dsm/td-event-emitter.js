'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'tundra-td-event-emitter',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { Kafka } = require('kafkajs');

// Clamp negative timeouts to avoid Node TimeoutNegativeWarning noise.
const _setTimeout = global.setTimeout;
global.setTimeout = (fn, ms, ...args) => _setTimeout(fn, Math.max(0, Number(ms) || 0), ...args);

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPICS = (process.env.KAFKA_TOPICS || 'tundra-beads-created,tundra-beads-in-progress,tundra-beads-completed,tundra-beads-escalated,tundra-beads-failed,tundra-mayor-commands,tundra-deacon-commands,tundra-polecat-commands,tundra-reaper-commands,tundra-witness-commands,tundra-overseer-commands,tundra-audit-actions,tundra-chat-private,tundra-chat-shared,tundra-chat-gossip,tundra-work-intake,tundra-nudges,tundra-whispers,tundra-mail-outbox,tundra-mail-inbox,tundra-schema-dlq,tundra-lane-critical-beads,tundra-lane-standard-beads,tundra-lane-experimental-beads')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'tundra-td-event-emitter';
const OUT_PATH = process.env.TD_EVENT_LOG || '/Users/studio/gt/logs/td-event-emitter.jsonl';

const DD_API_KEY = process.env.DD_API_KEY || '';
const DD_SITE = process.env.DD_SITE || 'datadoghq.com';
const DD_AGENT_HOST = process.env.DD_AGENT_HOST || '127.0.0.1';
const DD_DOGSTATSD_PORT = Number(process.env.DD_DOGSTATSD_PORT || 8125);
const DD_ENV = process.env.DD_ENV || 'local';
const DD_SERVICE = process.env.DD_SERVICE || 'tundra-td-event-emitter';
const DD_TAGS = (process.env.DD_TAGS || '').split(',').map((t) => t.trim()).filter(Boolean);

const OPENLINEAGE_NAMESPACE = process.env.OPENLINEAGE_NAMESPACE || 'tundra';
const OPENLINEAGE_PRODUCER = process.env.OPENLINEAGE_PRODUCER || 'tundra/td-event-emitter';

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

function schemaTags(evt) {
  const tags = [];
  const schema = evt.schema || {};
  const name = evt.schema_name || schema.name;
  const id = evt.schema_id || schema.id;
  const version = evt.schema_version || schema.version;
  if (name) tags.push(`schema_name:${String(name)}`);
  if (id) tags.push(`schema_id:${String(id)}`);
  if (version) tags.push(`schema_version:${String(version)}`);
  if (evt.schema_status) tags.push(`schema_status:${String(evt.schema_status)}`);
  return tags;
}

function emitLogs(payloads) {
  if (!DD_API_KEY) return;
  const url = `https://http-intake.logs.${DD_SITE}/api/v2/logs`;
  const data = Buffer.from(JSON.stringify(payloads));
  const req = https.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': DD_API_KEY,
      'Content-Length': data.length
    }
  }, (res) => res.resume());
  req.on('error', () => {});
  req.write(data);
  req.end();
}

function emitOpenLineage(events) {
  if (!DD_API_KEY || !events.length) return;
  const url = `https://data-obs-intake.${DD_SITE}/api/v1/openlineage`;
  const data = Buffer.from(JSON.stringify(events));
  const req = https.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DD_API_KEY}`,
      'Content-Length': data.length
    }
  }, (res) => res.resume());
  req.on('error', () => {});
  req.write(data);
  req.end();
}

function mapOpenLineage(evt) {
  if (evt.event !== 'bead.lifecycle') return null;
  const bead = evt.bead || evt.id;
  if (!bead) return null;
  const stage = evt.stage || '';
  let eventType = '';
  if (stage === 'hooked' || stage === 'created') eventType = 'START';
  if (stage === 'completed') eventType = 'COMPLETE';
  if (stage === 'failed' || stage === 'escalated') eventType = 'FAIL';
  if (!eventType) return null;
  const runId = crypto.createHash('sha1').update(`${OPENLINEAGE_NAMESPACE}:${bead}`).digest('hex');
  return {
    eventType,
    eventTime: evt.ts || new Date().toISOString(),
    run: { runId },
    job: { namespace: OPENLINEAGE_NAMESPACE, name: String(bead) },
    producer: OPENLINEAGE_PRODUCER
  };
}

async function run() {
  const kafka = new Kafka({ clientId: 'tundra-td-event-emitter', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  setInterval(() => {
    sendMetric('tundra.td_event_emitter.heartbeat', 1);
  }, 60 * 1000);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const value = message.value ? message.value.toString('utf8') : '';
      if (!value) return;
      fs.appendFileSync(OUT_PATH, value + '\n');
      let evt;
      try {
        evt = JSON.parse(value);
      } catch {
        return;
      }
      evt.topic = topic;
      const tags = [`topic:${topic}`, ...schemaTags(evt)];
      sendMetric('tundra.td_event_emitter.processed', 1, tags);

      const logPayload = {
        ddsource: 'tundra-td-event-emitter',
        service: DD_SERVICE,
        host: require('os').hostname(),
        message: evt.message || evt.event || evt.type || 'event',
        event_type: evt.event || evt.type || 'event',
        rig: evt.rig,
        role: evt.role,
        lane: evt.lane,
        stage: evt.stage,
        schema_name: evt.schema_name || (evt.schema && evt.schema.name),
        schema_id: evt.schema_id || (evt.schema && evt.schema.id),
        schema_version: evt.schema_version || (evt.schema && evt.schema.version),
        schema_status: evt.schema_status,
        tags: DD_TAGS.join(',')
      };
      emitLogs([logPayload]);

      const ol = mapOpenLineage(evt);
      if (ol) emitOpenLineage([ol]);
    }
  });
}

run().catch((err) => {
  console.error('td-event-emitter error', err);
  process.exit(1);
});
