'use strict';

// Use shared tracer config for proper span naming
const { initTracer } = require('./lib/tracer-config');
initTracer({ service: process.env.DD_SERVICE || 'gastown-bd-producer' });

const { execFileSync } = require('child_process');
const { Kafka } = require('kafkajs');
const fs = require('fs');

// Reduce log noise from kafkajs default partitioner notice
process.env.KAFKAJS_NO_PARTITIONER_WARNING = process.env.KAFKAJS_NO_PARTITIONER_WARNING || '1';

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'tundra-beads-created';
const STATE_PATH = process.env.BD_SYNC_STATE || '/Users/studio/gt/daemon/bd-kafka-producer.state.json';
const BEADS_DIR = process.env.BEADS_DIR || '/Users/studio/gt/.beads';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { last: {} };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state));
}

function fetchReady() {
  const out = execFileSync('bd', ['ready', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, BEADS_DIR }
  });
  return JSON.parse(out);
}

async function run() {
  const state = loadState();
  const ready = fetchReady();

  const kafka = new Kafka({ clientId: 'gastown-bd-producer', brokers: BROKERS });
  const producer = kafka.producer();
  await producer.connect();

  const messages = [];
  for (const issue of ready) {
    const id = issue.id || issue.bead || issue.key;
    if (!id) continue;
    const fingerprint = JSON.stringify(issue);
    if (state.last[id] === fingerprint) continue;
    state.last[id] = fingerprint;
    messages.push({
      value: JSON.stringify({
        event: 'bd.ready',
        ts: new Date().toISOString(),
        issue
      })
    });
  }

  if (messages.length) {
    await producer.send({ topic: TOPIC, messages });
  }

  await producer.disconnect();
  saveState(state);
}

run().catch((err) => {
  console.error('bd-kafka-producer error', err);
  process.exit(1);
});
