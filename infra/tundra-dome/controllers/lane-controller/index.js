'use strict';

/**
 * Lane Controller
 * Manages Lane CRs - enforces quotas, handles escalation, updates status
 */

const k8s = require('@kubernetes/client-node');
const { Kafka } = require('kafkajs');

const NAMESPACE = process.env.NAMESPACE || 'tundra-dome';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka-service:9092').split(',');
const RECONCILE_INTERVAL = Number(process.env.RECONCILE_INTERVAL || 30000);

// Kubernetes client setup
const kc = new k8s.KubeConfig();
kc.loadFromCluster();

const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const GROUP = 'tundra.dome';
const VERSION = 'v1';
const LANES_PLURAL = 'lanes';
const BEADS_PLURAL = 'beads';

// Kafka setup
const kafka = new Kafka({
  clientId: 'lane-controller',
  brokers: KAFKA_BROKERS,
});
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'lane-controller' });

// Lane state tracking
const laneState = new Map();

/**
 * Get all Lanes in namespace
 */
async function getLanes() {
  try {
    const response = await customApi.listNamespacedCustomObject(
      GROUP, VERSION, NAMESPACE, LANES_PLURAL
    );
    return response.body.items || [];
  } catch (err) {
    console.error('[ERROR] Failed to list Lanes:', err.message);
    return [];
  }
}

/**
 * Get beads in a specific lane
 */
async function getBeadsInLane(laneName) {
  try {
    const response = await customApi.listNamespacedCustomObject(
      GROUP, VERSION, NAMESPACE, BEADS_PLURAL,
      undefined, undefined, undefined, undefined,
      `tundra.dome/lane=${laneName}`
    );
    return response.body.items || [];
  } catch (err) {
    console.error(`[ERROR] Failed to list beads in lane ${laneName}:`, err.message);
    return [];
  }
}

/**
 * Update Lane status
 */
async function updateLaneStatus(lane, status) {
  try {
    const patch = {
      status: {
        ...status,
        lastUpdated: new Date().toISOString(),
      }
    };

    await customApi.patchNamespacedCustomObjectStatus(
      GROUP, VERSION, NAMESPACE, LANES_PLURAL,
      lane.metadata.name,
      patch,
      undefined, undefined, undefined,
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );
  } catch (err) {
    console.error(`[ERROR] Failed to update Lane status for ${lane.metadata.name}:`, err.message);
  }
}

/**
 * Check if a bead should be escalated based on age
 */
function shouldEscalate(bead, lane) {
  if (!lane.spec.escalation || !lane.spec.escalation.afterMinutes) {
    return false;
  }

  const createdAt = new Date(bead.metadata.creationTimestamp);
  const ageMinutes = (Date.now() - createdAt.getTime()) / 60000;

  return ageMinutes > lane.spec.escalation.afterMinutes;
}

/**
 * Escalate a bead to a higher priority lane
 */
async function escalateBead(bead, fromLane, toLane) {
  console.log(`[ESCALATE] Bead ${bead.metadata.name} from ${fromLane} to ${toLane}`);

  try {
    // Update bead's lane label
    const patch = {
      metadata: {
        labels: {
          ...bead.metadata.labels,
          'tundra.dome/lane': toLane,
          'tundra.dome/escalated-from': fromLane,
        },
        annotations: {
          ...bead.metadata.annotations,
          'tundra.dome/escalated-at': new Date().toISOString(),
        }
      },
      spec: {
        ...bead.spec,
        lane: toLane,
      }
    };

    await customApi.patchNamespacedCustomObject(
      GROUP, VERSION, NAMESPACE, BEADS_PLURAL,
      bead.metadata.name,
      patch,
      undefined, undefined, undefined,
      { headers: { 'Content-Type': 'application/merge-patch+json' } }
    );

    // Publish escalation event to Kafka
    await producer.send({
      topic: 'tundra-beads-escalated',
      messages: [{
        key: bead.metadata.name,
        value: JSON.stringify({
          event: 'bead.escalated',
          bead: bead.metadata.name,
          fromLane: fromLane,
          toLane: toLane,
          timestamp: new Date().toISOString(),
        })
      }]
    });

    // Also publish to the new lane's topic
    await producer.send({
      topic: `tundra-lane-${toLane}-beads`,
      messages: [{
        key: bead.metadata.name,
        value: JSON.stringify({
          ...bead.spec,
          lane: toLane,
          escalatedFrom: fromLane,
        })
      }]
    });

  } catch (err) {
    console.error(`[ERROR] Failed to escalate bead ${bead.metadata.name}:`, err.message);
  }
}

/**
 * Reconcile a single Lane
 */
async function reconcileLane(lane) {
  const laneName = lane.metadata.name;
  const spec = lane.spec || {};
  const quotas = spec.quotas || {};

  console.log(`[RECONCILE] Lane: ${laneName}`);

  // Get beads in this lane
  const beads = await getBeadsInLane(laneName);

  // Count beads by status
  const statusCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  const staleBeads = [];

  for (const bead of beads) {
    const status = bead.status?.phase || 'pending';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Check for escalation
    if (status === 'pending' && shouldEscalate(bead, lane)) {
      staleBeads.push(bead);
    }
  }

  // Handle escalations
  const escalateTo = spec.escalation?.toLane;
  if (escalateTo && staleBeads.length > 0) {
    console.log(`[ESCALATE] ${staleBeads.length} stale beads from ${laneName} to ${escalateTo}`);
    for (const bead of staleBeads) {
      await escalateBead(bead, laneName, escalateTo);
    }
  }

  // Check quota violations
  const maxConcurrent = quotas.maxConcurrent || Infinity;
  const currentConcurrent = statusCounts.pending + statusCounts.processing;
  const quotaViolation = currentConcurrent > maxConcurrent;

  if (quotaViolation) {
    console.log(`[QUOTA] Lane ${laneName} over quota: ${currentConcurrent}/${maxConcurrent}`);

    // Notify mayor of quota violation
    await producer.send({
      topic: 'tundra-mayor-commands',
      messages: [{
        key: `quota-${laneName}`,
        value: JSON.stringify({
          event: 'lane.quota_exceeded',
          lane: laneName,
          current: currentConcurrent,
          max: maxConcurrent,
          timestamp: new Date().toISOString(),
        })
      }]
    });
  }

  // Update Lane status
  await updateLaneStatus(lane, {
    phase: quotaViolation ? 'OverQuota' : 'Healthy',
    beadCounts: statusCounts,
    totalBeads: beads.length,
    currentConcurrent,
    quotaViolation,
    escalationsPending: staleBeads.length,
  });

  // Track state
  laneState.set(laneName, {
    lastReconcile: Date.now(),
    beadCounts: statusCounts,
    quotaViolation,
  });
}

/**
 * Main reconciliation loop
 */
async function reconcileLoop() {
  console.log('[RECONCILE] Starting reconciliation cycle...');

  const lanes = await getLanes();
  console.log(`[RECONCILE] Found ${lanes.length} lanes`);

  for (const lane of lanes) {
    await reconcileLane(lane);
  }

  console.log('[RECONCILE] Cycle complete');
}

/**
 * Watch for Lane changes
 */
async function watchLanes() {
  console.log('[WATCH] Starting Lane watch...');

  try {
    const watch = new k8s.Watch(kc);

    await watch.watch(
      `/apis/${GROUP}/${VERSION}/namespaces/${NAMESPACE}/${LANES_PLURAL}`,
      {},
      (type, lane) => {
        console.log(`[WATCH] Lane ${type}: ${lane.metadata.name}`);
        if (type === 'ADDED' || type === 'MODIFIED') {
          reconcileLane(lane).catch(console.error);
        }
      },
      (err) => {
        console.error('[WATCH] Error:', err);
        // Restart watch after error
        setTimeout(watchLanes, 5000);
      }
    );
  } catch (err) {
    console.error('[WATCH] Failed to start watch:', err.message);
    setTimeout(watchLanes, 5000);
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('Lane Controller starting...');
  console.log(`  Namespace: ${NAMESPACE}`);
  console.log(`  Kafka: ${KAFKA_BROKERS.join(', ')}`);
  console.log(`  Reconcile interval: ${RECONCILE_INTERVAL}ms`);

  // Connect to Kafka
  await producer.connect();
  console.log('[KAFKA] Producer connected');

  // Start watching Lanes
  watchLanes();

  // Start reconciliation loop
  setInterval(reconcileLoop, RECONCILE_INTERVAL);

  // Initial reconcile
  await reconcileLoop();

  console.log('Lane Controller running!');
}

main().catch((err) => {
  console.error('Lane Controller failed:', err);
  process.exit(1);
});
