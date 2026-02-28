'use strict';

/**
 * Bead Sync Controller
 *
 * Watches Bead CRs and synchronizes them across federated clusters.
 * This enables cross-cluster bead distribution for the Tundra Dome system.
 */

const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromCluster();

const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const watch = new k8s.Watch(kc);

const NAMESPACE = process.env.NAMESPACE || 'tundra-dome';
const GROUP = 'tundra.dome';
const VERSION = 'v1';
const PLURAL = 'beads';
const FEDERATION_LABEL = 'tundra.dome/federated';

// Get remote cluster configs from environment
function getRemoteClusters() {
  const clustersEnv = process.env.REMOTE_CLUSTERS || '';
  if (!clustersEnv) return [];

  return clustersEnv.split(',').map(cluster => {
    const [name, apiServer, token] = cluster.split(':');
    return { name, apiServer, token };
  }).filter(c => c.name && c.apiServer && c.token);
}

// Create API client for remote cluster
function createRemoteApi(cluster) {
  const remoteKc = new k8s.KubeConfig();
  remoteKc.loadFromOptions({
    clusters: [{
      name: cluster.name,
      server: cluster.apiServer,
      skipTLSVerify: true
    }],
    users: [{
      name: 'federation-controller',
      token: cluster.token
    }],
    contexts: [{
      name: cluster.name,
      cluster: cluster.name,
      user: 'federation-controller'
    }],
    currentContext: cluster.name
  });

  return remoteKc.makeApiClient(k8s.CustomObjectsApi);
}

// Sync bead to remote cluster
async function syncBeadToRemote(bead, remoteApi, clusterName) {
  const name = bead.metadata.name;

  // Skip if already synced from remote
  if (bead.metadata.labels?.[`${FEDERATION_LABEL}-from`] === clusterName) {
    return;
  }

  const syncedBead = {
    apiVersion: `${GROUP}/${VERSION}`,
    kind: 'Bead',
    metadata: {
      name: name,
      namespace: NAMESPACE,
      labels: {
        ...bead.metadata.labels,
        [FEDERATION_LABEL]: 'true',
        [`${FEDERATION_LABEL}-from`]: process.env.CLUSTER_NAME || 'primary',
        [`${FEDERATION_LABEL}-timestamp`]: new Date().toISOString()
      },
      annotations: {
        ...bead.metadata.annotations,
        'tundra.dome/federation-source': process.env.CLUSTER_NAME || 'primary'
      }
    },
    spec: bead.spec
  };

  try {
    // Try to get existing bead
    await remoteApi.getNamespacedCustomObject({
      group: GROUP,
      version: VERSION,
      namespace: NAMESPACE,
      plural: PLURAL,
      name: name
    });

    // Update existing
    await remoteApi.replaceNamespacedCustomObject({
      group: GROUP,
      version: VERSION,
      namespace: NAMESPACE,
      plural: PLURAL,
      name: name,
      body: syncedBead
    });

    console.log(`[SYNC] Updated bead ${name} on ${clusterName}`);
  } catch (e) {
    const is404 = e.response?.statusCode === 404 || e.statusCode === 404 ||
                  e.code === 404 || String(e).includes('404');
    if (is404) {
      // Create new
      await remoteApi.createNamespacedCustomObject({
        group: GROUP,
        version: VERSION,
        namespace: NAMESPACE,
        plural: PLURAL,
        body: syncedBead
      });

      console.log(`[SYNC] Created bead ${name} on ${clusterName}`);
    } else {
      throw e;
    }
  }
}

// Reconcile a single Bead
async function reconcileBead(bead) {
  const name = bead.metadata.name;

  // Skip if bead is not marked for federation
  if (bead.metadata.labels?.[FEDERATION_LABEL] !== 'true') {
    return;
  }

  // Skip if this is a synced bead from remote (avoid sync loops)
  if (bead.metadata.labels?.[`${FEDERATION_LABEL}-from`]) {
    return;
  }

  console.log(`[RECONCILE] Bead: ${name}`);

  const remoteClusters = getRemoteClusters();

  if (remoteClusters.length === 0) {
    console.log('[RECONCILE] No remote clusters configured');
    return;
  }

  for (const cluster of remoteClusters) {
    try {
      const remoteApi = createRemoteApi(cluster);
      await syncBeadToRemote(bead, remoteApi, cluster.name);
    } catch (error) {
      console.error(`[ERROR] Failed to sync ${name} to ${cluster.name}:`, error.message);
    }
  }
}

// Delete bead from remote clusters
async function deleteBead(bead) {
  const name = bead.metadata.name;

  // Skip if this is a synced bead from remote
  if (bead.metadata.labels?.[`${FEDERATION_LABEL}-from`]) {
    return;
  }

  console.log(`[DELETE] Bead: ${name}`);

  const remoteClusters = getRemoteClusters();

  for (const cluster of remoteClusters) {
    try {
      const remoteApi = createRemoteApi(cluster);
      await remoteApi.deleteNamespacedCustomObject({
        group: GROUP,
        version: VERSION,
        namespace: NAMESPACE,
        plural: PLURAL,
        name: name
      });

      console.log(`[DELETE] Removed bead ${name} from ${cluster.name}`);
    } catch (e) {
      const is404 = e.response?.statusCode === 404 || e.statusCode === 404 ||
                    e.code === 404 || String(e).includes('404');
      if (!is404) {
        console.error(`[ERROR] Failed to delete ${name} from ${cluster.name}:`, e.message);
      }
    }
  }
}

// Start watching Beads
async function startWatch() {
  const path = `/apis/${GROUP}/${VERSION}/namespaces/${NAMESPACE}/${PLURAL}`;

  console.log(`[WATCH] Starting watch on ${path}`);

  const req = await watch.watch(
    path,
    {},
    (type, bead) => {
      console.log(`[EVENT] ${type}: ${bead.metadata.name}`);

      switch (type) {
        case 'ADDED':
        case 'MODIFIED':
          reconcileBead(bead);
          break;
        case 'DELETED':
          deleteBead(bead);
          break;
      }
    },
    (err) => {
      console.error('[WATCH] Error:', err);
      // Restart watch after error
      setTimeout(startWatch, 5000);
    }
  );

  return req;
}

// Initial reconciliation of existing Beads
async function initialReconcile() {
  console.log('[INIT] Performing initial reconciliation...');

  try {
    const response = await customApi.listNamespacedCustomObject({
      group: GROUP,
      version: VERSION,
      namespace: NAMESPACE,
      plural: PLURAL,
      labelSelector: `${FEDERATION_LABEL}=true`
    });

    const beads = response.items || [];
    console.log(`[INIT] Found ${beads.length} federated Beads`);

    for (const bead of beads) {
      await reconcileBead(bead);
    }
  } catch (error) {
    console.error('[INIT] Failed to list Beads:', error.message);
  }
}

// Main
async function main() {
  console.log('='.repeat(60));
  console.log('  BEAD SYNC CONTROLLER');
  console.log('  Tundra Dome Federation System');
  console.log('='.repeat(60));
  console.log(`  Namespace: ${NAMESPACE}`);
  console.log(`  Watching: ${GROUP}/${VERSION}/${PLURAL}`);
  console.log(`  Cluster: ${process.env.CLUSTER_NAME || 'primary'}`);
  console.log('='.repeat(60));

  const remoteClusters = getRemoteClusters();
  console.log(`  Remote Clusters: ${remoteClusters.map(c => c.name).join(', ') || 'none'}`);
  console.log('='.repeat(60));

  await initialReconcile();
  await startWatch();
}

main().catch((error) => {
  console.error('[FATAL]', error);
  process.exit(1);
});
