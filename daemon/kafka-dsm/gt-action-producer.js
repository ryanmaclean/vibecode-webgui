'use strict';

// Use shared tracer config for proper span naming
const { initTracer } = require('./lib/tracer-config');
initTracer({ service: process.env.DD_SERVICE || 'gastown-action-producer' });

const { Kafka } = require('kafkajs');

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'tundra-beads-created';
const TARGET = process.env.GT_ACTION_TARGET || 'mayor';
const MESSAGE = process.env.GT_ACTION_MESSAGE || 'Tundra Dome: action ping';
const ACTION = process.env.GT_ACTION || 'nudge';

async function run() {
  const kafka = new Kafka({ clientId: 'gastown-action-producer', brokers: BROKERS });
  const producer = kafka.producer();
  await producer.connect();
  await producer.send({
    topic: TOPIC,
    messages: [{
      value: JSON.stringify({
        action: ACTION,
        target: TARGET,
        message: MESSAGE,
        ts: new Date().toISOString()
      })
    }]
  });
  await producer.disconnect();
}

run().catch((err) => {
  console.error('gt-action-producer error', err);
  process.exit(1);
});
