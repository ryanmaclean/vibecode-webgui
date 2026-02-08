'use strict';

/**
 * Bead Federation Controller
 *
 * Syncs beads across Tundra Dome clusters.
 * - Watches local beads and publishes to sync topic
 * - Consumes sync requests from other clusters
 * - Creates/updates beads based on routing rules
 */

const k8s = require('@kubernetes/client-node');
const { Kafka } = require('kafkajs');

const CLUSTER_NAME = process.env.CLUSTER_NAME || 'unknown';
const NAMESPACE = process.env.NAMESPACE || 'tundra-dome';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka-service:9092').split(',');
const SYNC_INTERVAL = Number(process.env.SYNC_INTERVAL || 5000);

// Topics for federation
const SYNC_REQUEST_TOPIC = process.env.SYNC_REQUEST_TOPIC || 'tundra-beads-sync-request';
const SYNC_COMPLETE_TOPIC = process.env.SYNC_COMPLETE_TOPIC || 'tundra-beads-sync-complete';
const HEARTBEAT_TOPIC = process.env.HEARTBEAT_TOPIC || 'tundra-cluster-heartbeat';

// Kubernetes client setup
const kc = new k8s.KubeConfig();
kc.loadFromCluster();

const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const GROUP = 'tundra.dome';
const VERSION = 'v1';
const BEADS_PLURAL = 'beads';

// Kafka setup
const kafka = new Kafka({
  clientId: `bead-federation-${CLUSTER_NAME}`,
  brokers: KAFKA_BROKERS,
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: `bead-federation-${CLUSTER_NAME}` });

// Track known beads to avoid duplicate processing
const knownBeads = new Map();

/**
 * Get all beads in the local cluster
 */
async function getLocalBeads() {
  try {
    const response = await customApi.listNamespacedCustomObject(
      GROUP, VERSION, NAMESPACE, BEADS_PLURAL
    );
    return response.body.items || [];
  } catch (err) {
    console.error('[ERROR] Failed to list local beads:', err.message);
    return [];
  }
}

/**
 * Create or update a bead from a sync request
 */
async function syncBead(beadData) {
  const beadName = beadData.metadata.name;

  try {
    // Check if bead exists
    try {
      await customApi.getNamespacedCustomObject(
        GROUP, VERSION, NAMESPACE, BEADS_PLURAL, beadName
      );

      // Bead exists - check if we should update
      const localVersion = knownBeads.get(beadName);
      const remoteVersion = beadData.metadata.resourceVersion;

      if (localVersion === remoteVersion) {
        console.log(`[SKIP] Bead ${beadName} already synced`);
        return false;
      }

      // Update existing bead
      const patch = {
        metadata: {
          labels: {
            ...beadData.metadata.labels,
            'tundra.dome/synced-from': beadData.sourceCluster,
            'tundra.dome/synced-at': new Date().toISOString(),
          },
          annotations: {
            ...beadData.metadata.annotations,
            'tundra.dome/original-cluster': beadData.sourceCluster,
          },
        },
        spec: beadData.spec,
      };

      await customApi.patchNamespacedCustomObject(
        GROUP, VERSION, NAMESPACE, BEADS_PLURAL,
        beadName, patch,
        undefined, undefined, undefined,
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      );

      console.log(`[SYNC] Updated bead ${beadName} from ${beadData.sourceCluster}`);
      knownBeads.set(beadName, remoteVersion);
      return true;

    } catch (err) {
      if (err.statusCode === 404) {
        // Bead doesn't exist - create it
        const newBead = {
          apiVersion: `${GROUP}/${VERSION}`,
          kind: 'Bead',
          metadata: {
            name: beadName,
            namespace: NAMESPACE,
            labels: {
              ...beadData.metadata.labels,
              'tundra.dome/synced-from': beadData.sourceCluster,
              'tundra.dome/synced-at': new Date().toISOString(),
            },
            annotations: {
              ...beadData.metadata.annotations,
              'tundra.dome/original-cluster': beadData.sourceCluster,
            },
          },
          spec: beadData.spec,
        };

        await customApi.createNamespacedCustomObject(
          GROUP, VERSION, NAMESPACE, BEADS_PLURAL, newBead
        );

        console.log(`[SYNC] Created bead ${beadName} from ${beadData.sourceCluster}`);
        knownBeads.set(beadName, beadData.metadata.resourceVersion);
        return true;
      }
      throw err;
    }

  } catch (err) {
    console.error(`[ERROR] Failed to sync bead ${beadName}:`, err.message);
    return false;
  }
}

/**
 * Publish local beads to sync topic
 */
async function publishLocalBeads() {
  const beads = await getLocalBeads();

  if (beads.length === 0) {
    return;
  }

  const messages = beads.map(bead => {
    // Don't re-publish beads that were synced from other clusters
    if (bead.metadata.labels?.['tundra.dome/synced-from']) {
      return null;
    }

    return {
      key: bead.metadata.name,
      value: JSON.stringify({
        event: 'bead.sync_request',
        sourceCluster: CLUSTER_NAME,
        metadata: bead.metadata,
        spec: bead.spec,
        status: bead.status,
        timestamp: new Date().toISOString(),
      }),
    };
  }).filter(Boolean);

  if (messages.length > 0) {
    await producer.send({
      topic: SYNC_REQUEST_TOPIC,
      messages,
    });
    console.log(`[PUBLISH] Published ${messages.length} beads to sync topic`);
  }
}

/**
 * Consume sync requests from other clusters
 */
async function startSyncConsumer() {
  await consumer.subscribe({
    topic: SYNC_REQUEST_TOPIC,
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const data = JSON.parse(message.value.toString());

        // Skip our own messages
        if (data.sourceCluster === CLUSTER_NAME) {
          return;
        }

        console.log(`[RECEIVE] Sync request from ${data.sourceCluster}: ${data.metadata.name}`);

        // Check routing rules to see if we should accept this bead
        if (shouldAcceptBead(data)) {
          const synced = await syncBead(data);

          if (synced) {
            // Publish sync completion
            await producer.send({
              topic: SYNC_COMPLETE_TOPIC,
              messages: [{
                key: data.metadata.name,
                value: JSON.stringify({
                  event: 'bead.sync_complete',
                  beadName: data.metadata.name,
                  sourceCluster: data.sourceCluster,
                  targetCluster: CLUSTER_NAME,
                  timestamp: new Date().toISOString(),
                }),
              }],
            });
          }
        }

      } catch (err) {
        console.error('[ERROR] Failed to process sync message:', err.message);
      }
    },
  });

  console.log('[CONSUMER] Sync consumer started');
}

/**
 * Check if this cluster should accept a bead based on routing rules
 */
function shouldAcceptBead(beadData) {
  // TODO: Implement routing rules from registry
  // For now, accept all beads (primary cluster behavior)

  const labels = beadData.metadata.labels || {};
  const spec = beadData.spec || {};

  // Example routing logic:
  // - Metrics beads go to gastown
  // - AI beads go to vibecode-local
  // - Everything else goes to tundra-dome

  if (CLUSTER_NAME === 'gastown') {
    return labels.type === 'metrics' || labels.workload === 'observability';
  }

  if (CLUSTER_NAME === 'vibecode-local') {
    return labels.type === 'ai-code' || labels.workload === 'ai';
  }

  // Primary cluster accepts unrouted beads
  if (CLUSTER_NAME === 'tundra-dome') {
    return !labels.type || !['metrics', 'ai-code'].includes(labels.type);
  }

  return false;
}

/**
 * Send heartbeat to let other clusters know we're alive
 */
async function sendHeartbeat() {
  const beads = await getLocalBeads();

  await producer.send({
    topic: HEARTBEAT_TOPIC,
    messages: [{
      key: CLUSTER_NAME,
      value: JSON.stringify({
        event: 'cluster.heartbeat',
        cluster: CLUSTER_NAME,
        timestamp: new Date().toISOString(),
        stats: {
          beadCount: beads.length,
          syncedBeadCount: beads.filter(b => b.metadata.labels?.['tundra.dome/synced-from']).length,
        },
      }),
    }],
  });
}

/**
 * Watch for local bead changes
 */
async function watchLocalBeads() {
  console.log('[WATCH] Starting local bead watch...');

  try {
    const watch = new k8s.Watch(kc);

    await watch.watch(
      `/apis/${GROUP}/${VERSION}/namespaces/${NAMESPACE}/${BEADS_PLURAL}`,
      {},
      async (type, bead) => {
        // Skip synced beads to avoid loops
        if (bead.metadata.labels?.['tundra.dome/synced-from']) {
          return;
        }

        console.log(`[WATCH] Bead ${type}: ${bead.metadata.name}`);

        if (type === 'ADDED' || type === 'MODIFIED') {
          // Publish this bead for sync
          await producer.send({
            topic: SYNC_REQUEST_TOPIC,
            messages: [{
              key: bead.metadata.name,
              value: JSON.stringify({
                event: 'bead.sync_request',
                sourceCluster: CLUSTER_NAME,
                metadata: bead.metadata,
                spec: bead.spec,
                status: bead.status,
                timestamp: new Date().toISOString(),
              }),
            }],
          });
        }
      },
      (err) => {
        console.error('[WATCH] Error:', err);
        // Restart watch after error
        setTimeout(watchLocalBeads, 5000);
      }
    );

  } catch (err) {
    console.error('[WATCH] Failed to start watch:', err.message);
    setTimeout(watchLocalBeads, 5000);
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('Bead Federation Controller starting...');
  console.log(`  Cluster: ${CLUSTER_NAME}`);
  console.log(`  Namespace: ${NAMESPACE}`);
  console.log(`  Kafka: ${KAFKA_BROKERS.join(', ')}`);
  console.log(`  Sync interval: ${SYNC_INTERVAL}ms`);

  // Connect to Kafka
  await producer.connect();
  await consumer.connect();
  console.log('[KAFKA] Connected');

  // Start sync consumer
  await startSyncConsumer();

  // Start watching local beads
  watchLocalBeads();

  // Periodic sync and heartbeat
  setInterval(async () => {
    await publishLocalBeads();
    await sendHeartbeat();
  }, SYNC_INTERVAL);

  // Initial sync
  await publishLocalBeads();
  await sendHeartbeat();

  console.log('Bead Federation Controller running!');
}

main().catch((err) => {
  console.error('Bead Federation Controller failed:', err);
  process.exit(1);
});
