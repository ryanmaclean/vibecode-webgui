'use strict';

// Use shared tracer config for proper span naming
const { initTracer } = require('./lib/tracer-config');
initTracer({ service: process.env.DD_SERVICE || 'gastown-kafka-producer' });

const { Kafka } = require('kafkajs');

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'tundra-beads-created';
const MSG_INTERVAL_MS = Number(process.env.MSG_INTERVAL_MS || 5000);

function buildMessage() {
  const now = new Date();
  return {
    event: 'bead.lifecycle',
    bead: `bead-${now.getTime()}`,
    stage: 'hooked',
    ts: now.toISOString()
  };
}

async function run() {
  const kafka = new Kafka({ clientId: 'gastown-producer', brokers: BROKERS });
  const producer = kafka.producer();
  await producer.connect();

  setInterval(async () => {
    const value = JSON.stringify(buildMessage());
    await producer.send({
      topic: TOPIC,
      messages: [{ value }]
    });
  }, MSG_INTERVAL_MS);
}

run().catch((err) => {
  console.error('producer error', err);
  process.exit(1);
});
