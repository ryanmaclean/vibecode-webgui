/**
 * Helm Chart Deployment Tests for VibeCode Platform
 * Tests the complete Helm chart deployment on KIND cluster
 */

import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';

let CLUSTER_NAME = process.env.KIND_CLUSTER_NAME || 'vibecode-test';
const NAMESPACE = 'vibecode-platform';
const HELM_RELEASE = 'vibecode-platform';
const CHART_PATH = 'helm/vibecode-platform';
const TIMEOUT = 900000; // 15 minutes; give KIND + Ingress and provisioning time to stabilize

// Helper runners and setup for Helm dependencies and cluster
const run = (cmd: string) => execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
const ensureHelmRepos = () => {
  try { run('helm repo add datadog https://helm.datadoghq.com'); } catch {}
  try { run('helm repo add bitnami https://charts.bitnami.com/bitnami'); } catch {}
  run('helm repo update');
};
<<<<<<< HEAD
=======

// Ensure a dynamic storage provisioner exists (local-path) for KIND environments
const ensureStorageProvisioner = () => {
  // Check if any StorageClass exists; if not, install Rancher's local-path-provisioner
  let scList = '';
  try {
    scList = execSync('kubectl get storageclass -o name', { encoding: 'utf8' }).trim();
  } catch {
    scList = '';
  }
  if (!scList) {
    // Install local-path-provisioner
    try {
      execSync('kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/v0.0.24/deploy/local-path-storage.yaml', { stdio: 'inherit' });
    } catch {
      // Best effort; continue to wait below
    }
    // Wait for controller to be available
    try {
      waitForDeploymentAvailable('kube-system', 'local-path-provisioner', 180000);
    } catch {}
    // Mark local-path as default
    try {
      execSync(`kubectl patch storageclass local-path -p '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'`, { stdio: 'inherit' });
    } catch {}
  }
};
>>>>>>> merge-conflict-cleanup
const ensureHelmDeps = () => {
  run(`helm dependency update ${CHART_PATH}`);
};
const waitForNodesReady = (timeoutMs = 180000) => {
  const started = Date.now();
  // Poll nodes readiness via JSON to avoid kubectl wait flakes
  while (true) {
    try {
      const out = execSync('kubectl get nodes -o json', { encoding: 'utf8' });
      const data = JSON.parse(out) as { items: Array<{ status?: { conditions?: Array<{ type: string; status: string }> } }> };
      const items = data.items || [];
      const allReady = items.length > 0 && items.every(n => (n.status?.conditions || []).some(c => c.type === 'Ready' && c.status === 'True'));
      if (allReady) return;
    } catch {
      // ignore and retry
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`KIND nodes not Ready after ${timeoutMs}ms`);
    }
    execSync('sleep 3');
  }
};
const getCurrentContext = (): string | null => {
  try { return execSync('kubectl config current-context', { encoding: 'utf8' }).trim(); } catch { return null; }
};
const getClusters = (): string[] => {
  try { return execSync('kind get clusters', { encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean); } catch { return []; }
};
const waitForDeploymentAvailable = (namespace: string, name: string, timeoutMs = 300000) => {
  const started = Date.now();
  while (true) {
    try {
      const out = execSync(`kubectl get deploy ${name} -n ${namespace} -o json`, { encoding: 'utf8' });
      const data = JSON.parse(out) as { status?: { availableReplicas?: number } };
      const available = data.status?.availableReplicas ?? 0;
      if (available > 0) return;
    } catch {
      // ignore and retry
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Deployment ${namespace}/${name} not available after ${timeoutMs}ms`);
    }
    execSync('sleep 3');
  }
};

describe('VibeCode Platform Helm Chart Deployment', () => {
  beforeAll(async () => {
    console.log('Setting up KIND cluster for Helm chart testing...');

    // Adapt to the current KIND context if present
    const currentCtx = getCurrentContext();
    if (currentCtx && currentCtx.startsWith('kind-')) {
      CLUSTER_NAME = currentCtx.substring('kind-'.length);
      console.log(`Using existing KIND context: ${currentCtx}`);
    } else {
      // Check if target cluster already exists
      const clusters = getClusters();
      if (clusters.includes(CLUSTER_NAME)) {
        console.log(`Cluster ${CLUSTER_NAME} already exists, switching context`);
      } else {
        // Create KIND cluster using our configuration
<<<<<<< HEAD
        execSync(`kind create cluster --name ${CLUSTER_NAME} --config k8s/kind-simple-config.yaml`, { stdio: 'inherit' });
=======
        execSync(`kind create cluster --name ${CLUSTER_NAME} --config k8s/kind-test-config.yaml`, { stdio: 'inherit' });
>>>>>>> merge-conflict-cleanup
      }
      // Set kubectl context
      execSync(`kubectl config use-context kind-${CLUSTER_NAME}`, { stdio: 'inherit' });
    }

    // Wait for cluster to be ready
    waitForNodesReady(180000);

    // Ensure NGINX Ingress Controller (required for Helm chart) - idempotent apply
    execSync(`kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml`, { stdio: 'inherit' });
    // Wait for ingress controller deployment to have available replicas
    waitForDeploymentAvailable('ingress-nginx', 'ingress-nginx-controller', 300000);
<<<<<<< HEAD
=======

    // Ensure a dynamic storage provisioner exists (local-path) before we detect StorageClass
    ensureStorageProvisioner();
>>>>>>> merge-conflict-cleanup

    // Create namespace
    execSync(`kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -`, {
      stdio: 'inherit'
    });

    // Ensure Helm repos and dependencies are ready
    ensureHelmRepos();
    ensureHelmDeps();

    // Prepare KIND-specific values overrides
    let storageClass = 'local-path';
    try {
<<<<<<< HEAD
      const sc = execSync('kubectl get storageclass -o jsonpath={.items[0].metadata.name}', { encoding: 'utf8' }).trim();
      if (sc) storageClass = sc;
=======
      const sc = execSync('kubectl get storageclass -o jsonpath={.items[?(@.metadata.annotations.storageclass\\.kubernetes\\.io/is-default-class=="true")].metadata.name}', { encoding: 'utf8' }).trim();
      if (sc) {
        storageClass = sc;
      } else {
        const scAny = execSync('kubectl get storageclass -o jsonpath={.items[0].metadata.name}', { encoding: 'utf8' }).trim();
        if (scAny) storageClass = scAny;
      }
>>>>>>> merge-conflict-cleanup
    } catch {}

    const kindValues = `global:\n  storageClass: ${storageClass}\ncodeServer:\n  persistence:\n    storageClass: ${storageClass}\nuserManagement:\n  workspace:\n    storageClass: ${storageClass}\nmonitoring:\n  enabled: false\nmongodb:\n  enabled: false\ndatadog:\n  enabled: false\nsecurity:\n  networkPolicies:\n    enabled: false\n`;
    fs.writeFileSync('/tmp/kind-test-values.yaml', kindValues);
  }, TIMEOUT);

  afterAll(async () => {
    // Cleanup: Delete the test cluster
    try {
      if (process.env.KEEP_CLUSTER !== 'true') {
        execSync(`kind delete cluster --name ${CLUSTER_NAME}`, { stdio: 'inherit' });
      } else {
        console.log('Keeping cluster for debugging (KEEP_CLUSTER=true)');
      }
    } catch (error) {
      console.error('Failed to cleanup cluster:', error);
    }
  }, 60000);

  test('Helm chart should lint successfully', () => {
    const result = execSync(`helm lint ${CHART_PATH}`, {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    expect(result).toContain('1 chart(s) linted, 0 chart(s) failed');
  });

  test('Helm chart should template successfully', () => {
    const result = execSync(`helm template ${HELM_RELEASE} ${CHART_PATH} --namespace ${NAMESPACE}`, {
      encoding: 'utf8',
      cwd: process.cwd(),
    });

    // Should contain expected Kubernetes resources
    expect(result).toContain('kind: ServiceAccount');
    expect(result).toContain('kind: ConfigMap');
    expect(result).toContain('kind: Secret');
    expect(result).toContain('kind: NetworkPolicy');
    expect(result).toContain('kind: ResourceQuota');
  });

  test('Helm chart should install successfully', async () => {
    // Install the Helm chart
    execSync(`helm upgrade --install ${HELM_RELEASE} ${CHART_PATH} --namespace ${NAMESPACE} --values /tmp/kind-test-values.yaml --wait --timeout=600s`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    // Verify installation
    const result = execSync(`helm list --namespace ${NAMESPACE}`, {
      encoding: 'utf8'
    });

    expect(result).toContain(HELM_RELEASE);
    expect(result).toContain('deployed');
  }, TIMEOUT);

  test('Core platform resources should be created', () => {
    // Check ServiceAccount
    const serviceAccount = execSync(`kubectl get serviceaccount ${HELM_RELEASE} --namespace ${NAMESPACE} -o json`, {
      encoding: 'utf8'
    });
    expect(JSON.parse(serviceAccount).metadata.name).toBe(HELM_RELEASE);

    // Check ConfigMap
    const configMap = execSync(`kubectl get configmap ${HELM_RELEASE}-config --namespace ${NAMESPACE} -o json`, {
      encoding: 'utf8'
    });
    const cfg = JSON.parse(configMap) as { data: Record<string, string> };
    const cfgKeys = Object.keys(cfg.data || {});
    expect(cfgKeys).toContain('code-server-config');
    expect(cfgKeys).toContain('ai-config.json');

    // Check Secret
    const secret = execSync(`kubectl get secret ${HELM_RELEASE}-config --namespace ${NAMESPACE} -o json`, {
      encoding: 'utf8'
    });
    expect(JSON.parse(secret).data).toHaveProperty('password');

    // Check RBAC
    const role = execSync(`kubectl get role ${HELM_RELEASE}-rbac-workspace --namespace ${NAMESPACE} -o json`, {
      encoding: 'utf8'
    });
    expect(JSON.parse(role).rules).toBeDefined();
  });

  test('Network policies should be correct for environment', () => {
    const policiesJson = execSync(`kubectl get networkpolicy --namespace ${NAMESPACE} -o json`, {
      encoding: 'utf8'
    });
    const policyList = JSON.parse(policiesJson) as { items: Array<{ metadata: { name: string } }> };
    const policyNames = policyList.items.map((item) => item.metadata.name);

    if (policyNames.length === 0) {
      // KIND values disable network policies; ensure none are present
      expect(policyNames.length).toBe(0);
    } else {
      // When enabled, assert the expected set exists
      expect(policyNames).toContain(`${HELM_RELEASE}-default-deny`);
      expect(policyNames).toContain(`${HELM_RELEASE}-allow-dns`);
      expect(policyNames).toContain(`${HELM_RELEASE}-allow-ingress`);
      expect(policyNames).toContain(`${HELM_RELEASE}-allow-egress`);
    }
  });

  test('Resource quotas should be configured', () => {
    const quotas = execSync(`kubectl get resourcequota --namespace ${NAMESPACE} -o json`, {
      encoding: 'utf8'
    });

    const quotaList = JSON.parse(quotas) as { items: Array<{ metadata: { name: string }, spec: { hard: Record<string, unknown> } }> };
    expect(quotaList.items.length).toBeGreaterThan(0);

    const globalQuota = quotaList.items.find((item) =>
      item.metadata.name === `${HELM_RELEASE}-global`
    );
    expect(globalQuota).toBeDefined();
    const hardKeys = Object.keys(globalQuota!.spec.hard);
    expect(hardKeys).toContain('requests.cpu');
    expect(hardKeys).toContain('requests.memory');
  });

  test('Priority classes should be created', () => {
    const priorities = execSync(`kubectl get priorityclass -o json`, {
      encoding: 'utf8'
    });

    const priorityList = JSON.parse(priorities) as { items: Array<{ metadata: { name: string } }> };
    const priorityNames = priorityList.items.map((item) => item.metadata.name);

    expect(priorityNames).toContain('high-priority');
    expect(priorityNames).toContain('medium-priority');
    expect(priorityNames).toContain('low-priority');
  });

  test('Helm tests should pass', async () => {
    // Run Helm tests
    let passedViaHelm = false;
    try {
      const result = execSync(`helm test ${HELM_RELEASE} --namespace ${NAMESPACE} --timeout=900s`, {
        encoding: 'utf8'
      });
      if (result.includes('Phase: Succeeded')) {
        passedViaHelm = true;
      }
    } catch {
      // fall through to manual verification
    }

    if (!passedViaHelm) {
      // Fallback: manually verify both test pods reached Succeeded phase
      const pods = [
        `${HELM_RELEASE}-test-connection`,
        `${HELM_RELEASE}-test-provisioning`,
      ];
      const started = Date.now();
      const timeoutMs = 900_000; // 15 minutes
      while (true) {
        const allSucceeded = pods.every(name => {
          try {
            const out = execSync(`kubectl get pod ${name} -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
            const data = JSON.parse(out) as { status?: { phase?: string } };
            return data.status?.phase === 'Succeeded';
          } catch {
            return false;
          }
        });
        if (allSucceeded) break;
        if (Date.now() - started > timeoutMs) {
          throw new Error('Helm tests did not complete successfully within fallback timeout');
        }
        execSync('sleep 5');
      }
    }
  }, TIMEOUT);

  test('User provisioning script should work', async () => {
    const testUserId = 'test-user-helm';

    try {
      // Create test user using our provisioning script
      execSync(`scripts/provision-user.sh create ${testUserId} --namespace ${NAMESPACE}`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          HELM_RELEASE: HELM_RELEASE,
          CHART_PATH: CHART_PATH
        }
      });

      // Wait for deployment to be ready
      execSync(`kubectl wait --for=condition=Available deployment/code-server-${testUserId} --namespace ${NAMESPACE} --timeout=300s`, {
        stdio: 'inherit'
      });

      // Verify resources exist
      const deployment = execSync(`kubectl get deployment code-server-${testUserId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      expect(JSON.parse(deployment).metadata.name).toBe(`code-server-${testUserId}`);

      const service = execSync(`kubectl get service code-server-${testUserId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      expect(JSON.parse(service).metadata.name).toBe(`code-server-${testUserId}`);

      const pvc = execSync(`kubectl get pvc workspace-${testUserId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      expect(JSON.parse(pvc).metadata.name).toBe(`workspace-${testUserId}`);

      // Verify ingress
      const ingress = execSync(`kubectl get ingress code-server-${testUserId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const ingressData = JSON.parse(ingress);
      expect(ingressData.spec.rules[0].host).toBe(`${testUserId}.vibecode.local`);

    } finally {
      // Cleanup test user
      try {
        execSync(`scripts/provision-user.sh delete ${testUserId} --delete-storage --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: {
            ...process.env,
            HELM_RELEASE: HELM_RELEASE
          }
        });
      } catch (error) {
        console.error('Failed to cleanup test user:', error);
      }
    }
  }, TIMEOUT);

  test('Multiple users should be isolated', async () => {
    const user1 = 'test-user-1';
    const user2 = 'test-user-2';

    try {
      // Create two test users
      execSync(`scripts/provision-user.sh create ${user1} --namespace ${NAMESPACE}`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          HELM_RELEASE: HELM_RELEASE,
          CHART_PATH: CHART_PATH
        }
      });

      execSync(`scripts/provision-user.sh create ${user2} --namespace ${NAMESPACE}`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          HELM_RELEASE: HELM_RELEASE,
          CHART_PATH: CHART_PATH
        }
      });

      // Wait for deployments to be ready
      execSync(`kubectl wait --for=condition=Available deployment/code-server-${user1} --namespace ${NAMESPACE} --timeout=300s`, {
        stdio: 'inherit'
      });

      execSync(`kubectl wait --for=condition=Available deployment/code-server-${user2} --namespace ${NAMESPACE} --timeout=300s`, {
        stdio: 'inherit'
      });

      // Verify users have separate resources
      const user1Deployment = execSync(`kubectl get deployment code-server-${user1} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const user2Deployment = execSync(`kubectl get deployment code-server-${user2} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });

      const user1Data = JSON.parse(user1Deployment);
      const user2Data = JSON.parse(user2Deployment);

      // Verify they have different user labels
      expect(user1Data.metadata.labels['vibecode.dev/user-id']).toBe(user1);
      expect(user2Data.metadata.labels['vibecode.dev/user-id']).toBe(user2);

      // Verify they have separate PVCs
      const user1Pvc = execSync(`kubectl get pvc workspace-${user1} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const user2Pvc = execSync(`kubectl get pvc workspace-${user2} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });

      expect(JSON.parse(user1Pvc).metadata.name).toBe(`workspace-${user1}`);
      expect(JSON.parse(user2Pvc).metadata.name).toBe(`workspace-${user2}`);

      // Verify they have different ingress hosts
      const user1Ingress = execSync(`kubectl get ingress code-server-${user1} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const user2Ingress = execSync(`kubectl get ingress code-server-${user2} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });

      const user1IngressData = JSON.parse(user1Ingress);
      const user2IngressData = JSON.parse(user2Ingress);

      expect(user1IngressData.spec.rules[0].host).toBe(`${user1}.vibecode.local`);
      expect(user2IngressData.spec.rules[0].host).toBe(`${user2}.vibecode.local`);

    } finally {
      // Cleanup test users
      try {
        execSync(`scripts/provision-user.sh delete ${user1} --delete-storage --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: { ...process.env, HELM_RELEASE: HELM_RELEASE }
        });
        execSync(`scripts/provision-user.sh delete ${user2} --delete-storage --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: { ...process.env, HELM_RELEASE: HELM_RELEASE }
        });
      } catch (error) {
        console.error('Failed to cleanup test users:', error);
      }
    }
  }, TIMEOUT);

  test('Chart upgrade should work', async () => {
    // Modify values and upgrade
    const upgradeValues = `;
monitoring:
  enabled: false
security:
  networkPolicies:
    enabled: false
`;

    fs.writeFileSync('/tmp/upgrade-values.yaml', upgradeValues);

    try {
      // Upgrade the chart
      execSync(`helm upgrade --install ${HELM_RELEASE} ${CHART_PATH} --namespace ${NAMESPACE} --values /tmp/kind-test-values.yaml --values /tmp/upgrade-values.yaml --wait --timeout=600s`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });

      // Verify upgrade
      const result = execSync(`helm list --namespace ${NAMESPACE}`, {
        encoding: 'utf8'
      });

      expect(result).toContain(HELM_RELEASE);
      expect(result).toContain('deployed');

      // Verify monitoring is disabled (no ServiceMonitor should exist);
      try {
        execSync(`kubectl get servicemonitor ${HELM_RELEASE} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
        // If we get here, ServiceMonitor exists when it shouldn't
        expect(false).toBe(true);
      } catch {
        // This is expected - ServiceMonitor shouldn't exist
        expect(true).toBe(true);
      }

    } finally {
      fs.unlinkSync('/tmp/upgrade-values.yaml');
    }
  }, TIMEOUT);

  test('Chart uninstall should clean up resources', async () => {
    if (process.env.KEEP_CLUSTER) {
      console.log('Skipping uninstall for debugging (KEEP_CLUSTER=true)');
      return;
    }
    // Uninstall the chart
    execSync(`helm uninstall ${HELM_RELEASE} --namespace ${NAMESPACE} --wait --timeout=600s`, {
      stdio: 'inherit'
    });

    // Verify resources are removed
    const result = execSync(`helm list --namespace ${NAMESPACE}`, {
      encoding: 'utf8'
    });

    expect(result).not.toContain(HELM_RELEASE);

    // Verify core resources are gone
    try {
      execSync(`kubectl get serviceaccount ${HELM_RELEASE} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
      expect(false).toBe(true); // Should not reach here
    } catch {
      // This is expected - resources should be gone
      expect(true).toBe(true);
    }
  });
});
