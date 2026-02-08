'use strict';

/**
 * OpenLineage-Bead Bridge
 *
 * Listens to OpenLineage events and creates corresponding Bead CRs.
 * This bridges Airflow's lineage tracking with Tundra Dome's work system.
 */

const k8s = require('@kubernetes/client-node');
const { Kafka } = require('kafkajs');

const kc = new k8s.KubeConfig();
kc.loadFromCluster();

const customApi = kc.makeApiClient(k8s.CustomObjectsApi);

const NAMESPACE = process.env.NAMESPACE || 'tundra-dome';
const GROUP = 'tundra.dome';
const VERSION = 'v1';

const kafka = new Kafka({
  clientId: 'openlineage-bead-bridge',
  brokers: (process.env.KAFKA_BROKERS || 'kafka-service:9092').split(',')
});

const consumer = kafka.consumer({ groupId: 'openlineage-bead-bridge' });

// Map OpenLineage event types to lanes
function determineLane(event) {
  const job = event.job?.name || '';
  const namespace = event.job?.namespace || '';

  // Critical: production jobs, SLA-bound
  if (namespace.includes('prod') || job.includes('critical') || job.includes('sla')) {
    return 'critical';
  }

  // Experimental: dev, test, feature branches
  if (namespace.includes('dev') || namespace.includes('test') || job.includes('experiment')) {
    return 'experimental';
  }

  // Default: standard lane
  return 'standard';
}

// Create Bead from OpenLineage event
async function createBeadFromLineage(event) {
  const eventType = event.eventType || 'UNKNOWN';
  const jobName = event.job?.name || 'unknown';
  const runId = event.run?.runId || `run-${Date.now()}`;

  // Only create beads for START events (avoid duplicates)
  if (eventType !== 'START') {
    console.log(`[SKIP] Event type ${eventType} for ${jobName}`);
    return;
  }

  const beadName = `ol-${jobName}-${runId}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 63);
  const lane = determineLane(event);

  console.log(`[CREATE] Bead: ${beadName} Lane: ${lane} Job: ${jobName}`);

  const bead = {
    apiVersion: `${GROUP}/${VERSION}`,
    kind: 'Bead',
    metadata: {
      name: beadName,
      namespace: NAMESPACE,
      labels: {
        'tundra.dome/source': 'openlineage',
        'tundra.dome/job': jobName.slice(0, 63),
        'tundra.dome/lane': lane
      }
    },
    spec: {
      lane: lane,
      source: 'openlineage',
      payload: {
        job: event.job,
        run: event.run,
        inputs: event.inputs || [],
        outputs: event.outputs || [],
        eventTime: event.eventTime
      }
    }
  };

  try {
    await customApi.createNamespacedCustomObject(
      GROUP, VERSION, NAMESPACE, 'beads', bead
    );
    console.log(`[CREATED] Bead: ${beadName}`);
  } catch (e) {
    if (e.statusCode === 409) {
      console.log(`[EXISTS] Bead: ${beadName}`);
    } else {
      console.error(`[ERROR] Failed to create bead:`, e.message);
    }
  }
}

// Listen for OpenLineage events
async function listenForEvents() {
  // OpenLineage events might come from multiple sources:
  // 1. Direct Kafka topic from Airflow
  // 2. Datadog webhook
  // 3. OpenLineage API

  const topics = [
    'openlineage-events',
    'airflow-lineage',
    'tundra-openlineage'
  ];

  for (const topic of topics) {
    try {
      await consumer.subscribe({ topic, fromBeginning: false });
      console.log(`[SUBSCRIBE] ${topic}`);
    } catch (e) {
      console.log(`[SKIP] Topic ${topic} not available`);
    }
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log(`[EVENT] ${topic}: ${event.eventType} ${event.job?.name}`);
        await createBeadFromLineage(event);
      } catch (error) {
        console.error('[ERROR] Processing event:', error.message);
      }
    }
  });
}

// HTTP endpoint for OpenLineage webhooks (optional)
async function startWebhookServer() {
  const http = require('http');
  const port = process.env.PORT || 5000;

  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/api/v1/lineage') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const event = JSON.parse(body);
          await createBeadFromLineage(event);
          res.writeHead(200);
          res.end('OK');
        } catch (e) {
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
    } else if (req.url === '/health') {
      res.writeHead(200);
      res.end('OK');
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`[HTTP] Webhook server listening on port ${port}`);
  });
}

// Main
async function main() {
  console.log('='.repeat(60));
  console.log('  OPENLINEAGE-BEAD BRIDGE');
  console.log('  Tundra Dome Lineage Integration');
  console.log('='.repeat(60));
  console.log(`  Namespace: ${NAMESPACE}`);
  console.log(`  Kafka: ${process.env.KAFKA_BROKERS || 'kafka-service:9092'}`);
  console.log('='.repeat(60));

  await consumer.connect();

  // Start both Kafka consumer and HTTP server
  await Promise.all([
    listenForEvents(),
    startWebhookServer()
  ]);
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
