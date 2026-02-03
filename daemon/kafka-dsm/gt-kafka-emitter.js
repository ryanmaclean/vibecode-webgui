'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'gastown-kafka-bead-emitter',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const fs = require('fs');
const path = require('path');
const { Kafka } = require('kafkajs');

const EVENTS_PATH = process.env.GT_EVENTS_PATH || '/Users/studio/gt/.events.jsonl';
const STATE_PATH = process.env.GT_EVENTS_STATE || '/Users/studio/gt/daemon/gt-kafka-emitter.state.json';
const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'tundra-beads-created';
const SERVICES = (process.env.EMIT_SERVICES || 'gastown,openclaw')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const RIG_DEFAULT = process.env.EMIT_RIG || 'mbp_m1';
const SCHEMA_NAME = process.env.EMIT_SCHEMA_NAME || '';
const SCHEMA_VERSION = process.env.EMIT_SCHEMA_VERSION || '';
const SCHEMA_STATUS = process.env.EMIT_SCHEMA_STATUS || '';

const beadEvents = new Set(['hook', 'sling', 'done', 'escalation_sent']);

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { offset: 0 };
  }
}

function saveState(offset) {
  fs.writeFileSync(STATE_PATH, JSON.stringify({ offset }));
}

function inferRig(actor, payload) {
  const rig = payload.rig || payload.rig_name;
  if (typeof rig === 'string' && rig) return rig;
  if (actor.includes('/')) return actor.split('/')[0];
  const target = payload.target || '';
  if (typeof target === 'string' && target.includes('/')) return target.split('/')[0];
  return RIG_DEFAULT;
}

function inferRole(actor) {
  if (actor === 'mayor') return 'mayor';
  if (actor === 'deacon') return 'deacon';
  if (actor === 'refinery') return 'refinery';
  if (actor === 'overseer') return 'overseer';
  if (actor.includes('/crew/')) return 'crew';
  if (actor.includes('/witness') || actor.endsWith('/witness')) return 'witness';
  if (actor.includes('/polecats/')) return 'polecat';
  if (actor.includes('/')) return 'polecat';
  return 'unknown';
}

function stageForEvent(evtType) {
  if (evtType === 'hook') return 'hooked';
  if (evtType === 'sling') return 'in_progress';
  if (evtType === 'done') return 'completed';
  if (evtType === 'escalation_sent') return 'escalated';
  return '';
}

async function run() {
  const state = loadState();
  const buf = fs.readFileSync(EVENTS_PATH);
  const offset = state.offset || 0;
  if (offset >= buf.length) return;

  const lines = buf.slice(offset).toString('utf8').split('\n').filter(Boolean);
  const nextOffset = buf.length;
  if (!lines.length) {
    saveState(nextOffset);
    return;
  }

  const kafka = new Kafka({ clientId: 'gastown-bead-emitter', brokers: BROKERS });
  const producer = kafka.producer();
  await producer.connect();

  const messages = [];

  for (const line of lines) {
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    const evtType = evt.type;
    if (!beadEvents.has(evtType)) continue;

    const actor = evt.actor || '';
    const payload = evt.payload || {};
    const rig = inferRig(actor, payload);
    const role = inferRole(actor);
    const stage = stageForEvent(evtType);
    const bead = payload.bead || '';

    for (const service of SERVICES) {
      const value = JSON.stringify({
        ts: evt.ts,
        type: evtType,
        bead,
        actor,
        payload,
        rig,
        role,
        stage,
        service,
        schema_name: SCHEMA_NAME || undefined,
        schema_version: SCHEMA_VERSION || undefined,
        schema_status: SCHEMA_STATUS || undefined
      });
      messages.push({
        value,
        headers: {
          rig,
          role,
          stage,
          service
        }
      });
    }
  }

  if (messages.length) {
    await producer.send({ topic: TOPIC, messages });
  }

  await producer.disconnect();
  saveState(nextOffset);
}

run().catch((err) => {
  console.error('gt-kafka-emitter error', err);
  process.exit(1);
});
