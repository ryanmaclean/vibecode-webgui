'use strict';

const http = require('http');
const fs = require('fs');
const { Kafka } = require('kafkajs');

const PORT = Number(process.env.GITEA_BRIDGE_PORT || 19080);
const BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'tundra-cicd-events';
const LOG_PATH = process.env.GITEA_BRIDGE_LOG || '/Users/studio/gt/logs/gitea-events.jsonl';

const kafka = new Kafka({ clientId: 'gitea-bridge', brokers: BROKERS });
const producer = kafka.producer();

async function start() {
  await producer.connect();
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }

    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const event = req.headers['x-gitea-event'] || 'unknown';
      const payload = {
        ts: new Date().toISOString(),
        event,
        headers: req.headers,
        body: body ? JSON.parse(body) : {}
      };

      fs.appendFileSync(LOG_PATH, JSON.stringify(payload) + '\n');
      await producer.send({
        topic: TOPIC,
        messages: [{ value: JSON.stringify(payload) }]
      });

      res.writeHead(200);
      res.end('ok');
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`gitea-kafka-bridge listening on ${PORT}`);
  });
}

start().catch((err) => {
  console.error('gitea-kafka-bridge error', err);
  process.exit(1);
});
