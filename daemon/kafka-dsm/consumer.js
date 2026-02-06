'use strict';

require('dd-trace').init({
  service: process.env.DD_SERVICE || 'gastown-kafka-consumer',
  env: process.env.DD_ENV || 'local',
  version: process.env.DD_VERSION || '0.1.0',
  logInjection: true
});

const { Kafka } = require('kafkajs');

const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'tundra-beads-created';
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'gastown-consumer';

async function run() {
  const kafka = new Kafka({ clientId: 'gastown-consumer', brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: GROUP_ID });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const value = message.value ? message.value.toString('utf8') : '';
      try {
        JSON.parse(value);
      } catch (err) {
        console.error('consumer parse error', err);
      }
    }
  });
}

run().catch((err) => {
  console.error('consumer error', err);
  process.exit(1);
});
