'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'gastown-to-tundra-bridge',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const { Kafka } = require('kafkajs');

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const SOURCE_TOPIC = process.env.SOURCE_TOPIC || 'gastown-beads';
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'gastown-to-tundra-bridge';
const DRY_RUN = (process.env.BRIDGE_DRY_RUN || '').toLowerCase() === 'true';

const TD_TOPIC_WORK = process.env.TD_TOPIC_WORK || 'tundra-work-intake';
const TD_TOPIC_CREATED = process.env.TD_TOPIC_CREATED || 'tundra-beads-created';
const TD_LANE_PREFIX = process.env.TD_LANE_PREFIX || 'tundra-lane';
const TD_DEFAULT_LANE = (process.env.TD_DEFAULT_LANE || 'standard').toLowerCase();

async function run() {
  const kafka = new Kafka({ clientId: 'gastown-to-tundra-bridge', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  const producer = kafka.producer();

  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: SOURCE_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const value = message.value ? message.value.toString('utf8') : '';
      if (!value) return;

      let evt;
      try {
        evt = JSON.parse(value);
      } catch {
        return;
      }

      const lane = (evt.lane || evt.payload?.lane || TD_DEFAULT_LANE || 'standard').toLowerCase();
      const laneTopic = `${TD_LANE_PREFIX}-${lane}-beads`;
      const payload = JSON.stringify({
        ...evt,
        source: evt.source || 'gastown-beads',
        bridge: 'gastown-to-tundra'
      });

      if (DRY_RUN) return;

      await producer.send({ topic: TD_TOPIC_WORK, messages: [{ value: payload }] });
      await producer.send({ topic: TD_TOPIC_CREATED, messages: [{ value: payload }] });
      await producer.send({ topic: laneTopic, messages: [{ value: payload }] });
    }
  });
}

run().catch((err) => {
  console.error('gastown-to-tundra-bridge error', err);
  process.exit(1);
});
