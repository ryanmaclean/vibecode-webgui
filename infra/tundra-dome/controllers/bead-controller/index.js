'use strict';

/**
 * Bead Controller
 *
 * Watches Bead CRs and routes them to appropriate Kafka lanes.
 * Tracks bead lifecycle: pending → processing → complete/failed
 */

const k8s = require('@kubernetes/client-node');
const { Kafka } = require('kafkajs');

const kc = new k8s.KubeConfig();
kc.loadFromCluster();

const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const watch = new k8s.Watch(kc);

const NAMESPACE = process.env.NAMESPACE || 'tundra-dome';
const GROUP = 'tundra.dome';
const VERSION = 'v1';

const kafka = new Kafka({
  clientId: 'bead-controller',
  brokers: (process.env.KAFKA_BROKERS || 'kafka-service:9092').split(',')
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'bead-controller' });

// Lane to Kafka topic mapping
const laneTopics = {
  critical: 'tundra-lane-critical-beads',
  standard: 'tundra-lane-standard-beads',
  experimental: 'tundra-lane-experimental-beads'
};

// Route bead to appropriate lane
async function routeBead(bead) {
  const name = bead.metadata.name;
  const lane = bead.spec?.lane || 'standard';
  const topic = laneTopics[lane] || laneTopics.standard;

  console.log(`[ROUTE] Bead: ${name} -> Lane: ${lane} -> Topic: ${topic}`);

  try {
    await producer.send({
      topic,
      messages: [{
        key: name,
        value: JSON.stringify({
          id: name,
          lane: lane,
          source: bead.spec?.source || 'manual',
          payload: bead.spec?.payload || {},
          metadata: {
            createdAt: bead.metadata.creationTimestamp,
            namespace: NAMESPACE,
            labels: bead.metadata.labels || {}
          }
        })
      }]
    });

    await updateBeadStatus(bead, 'Queued', `Routed to ${topic}`);
    console.log(`[SENT] Bead ${name} to ${topic}`);

  } catch (error) {
    console.error(`[ERROR] Failed to route bead ${name}:`, error.message);
    await updateBeadStatus(bead, 'Failed', error.message);
  }
}

// Update Bead CR status
async function updateBeadStatus(bead, phase, message) {
  try {
    const patch = {
      status: {
        phase: phase,
        message: message || '',
        lastUpdated: new Date().toISOString()
      }
    };

    await customApi.patchNamespacedCustomObjectStatus(
      GROUP, VERSION, NAMESPACE, 'beads',
      bead.metadata.name,
      patch,
      undefined, undefined, undefined,
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );
  } catch (e) {
    console.error(`[STATUS] Failed to update ${bead.metadata.name}:`, e.message);
  }
}

// Process completion events from polecats
async function processCompletionEvents() {
  await consumer.subscribe({ topic: 'tundra-beads-completed', fromBeginning: false });
  await consumer.subscribe({ topic: 'tundra-beads-failed', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        const beadName = data.id;

        console.log(`[COMPLETION] Bead: ${beadName} Status: ${data.status}`);

        // Get the bead CR
        const response = await customApi.getNamespacedCustomObject(
          GROUP, VERSION, NAMESPACE, 'beads', beadName
        );
        const bead = response.body;

        // Update status
        const phase = data.status === 'completed' ? 'Completed' : 'Failed';
        await updateBeadStatus(bead, phase, `Processed by ${data.processedBy}`);

        // Emit metrics to Datadog (via statsd)
        const processingTime = Date.now() - new Date(bead.metadata.creationTimestamp).getTime();
        console.log(`[METRICS] Bead ${beadName} processing_time_ms=${processingTime}`);

      } catch (error) {
        console.error('[COMPLETION] Error processing:', error.message);
      }
    }
  });
}

// Watch Beads
async function watchBeads() {
  const path = `/apis/${GROUP}/${VERSION}/namespaces/${NAMESPACE}/beads`;

  console.log(`[WATCH] Starting watch on ${path}`);

  await watch.watch(
    path,
    {},
    (type, bead) => {
      console.log(`[EVENT] ${type}: ${bead.metadata.name}`);

      if (type === 'ADDED') {
        // Only route new beads that haven't been processed
        const phase = bead.status?.phase;
        if (!phase || phase === 'Pending') {
          routeBead(bead);
        }
      }
    },
    (err) => {
      console.error('[WATCH] Error:', err);
      setTimeout(watchBeads, 5000);
    }
  );
}

// Ensure Kafka topics exist
async function ensureTopics() {
  const admin = kafka.admin();
  await admin.connect();

  const topics = [
    ...Object.values(laneTopics),
    'tundra-beads-completed',
    'tundra-beads-failed',
    'tundra-work-intake'
  ];

  try {
    await admin.createTopics({
      topics: topics.map(topic => ({
        topic,
        numPartitions: 3,
        replicationFactor: 1
      }))
    });
    console.log('[KAFKA] Topics created/verified');
  } catch (e) {
    // Topics may already exist
    console.log('[KAFKA] Topics ready');
  }

  await admin.disconnect();
}

// Process existing pending beads
async function processExistingBeads() {
  console.log('[INIT] Processing existing beads...');

  try {
    const response = await customApi.listNamespacedCustomObject(
      GROUP, VERSION, NAMESPACE, 'beads'
    );

    const beads = response.body.items || [];
    const pendingBeads = beads.filter(b => !b.status?.phase || b.status.phase === 'Pending');

    console.log(`[INIT] Found ${pendingBeads.length} pending beads`);

    for (const bead of pendingBeads) {
      await routeBead(bead);
    }
  } catch (error) {
    console.error('[INIT] Failed to list beads:', error.message);
  }
}

// Main
async function main() {
  console.log('='.repeat(60));
  console.log('  BEAD CONTROLLER');
  console.log('  Tundra Dome Work Routing System');
  console.log('='.repeat(60));
  console.log(`  Namespace: ${NAMESPACE}`);
  console.log(`  Kafka: ${process.env.KAFKA_BROKERS || 'kafka-service:9092'}`);
  console.log('='.repeat(60));

  await producer.connect();
  await consumer.connect();
  await ensureTopics();
  await processExistingBeads();

  // Start watchers
  await Promise.all([
    watchBeads(),
    processCompletionEvents()
  ]);
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
