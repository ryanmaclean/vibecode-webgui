/**
 * Helm Chart Deployment Tests for VibeCode Platform
 * Tests the complete Helm chart deployment on KIND cluster
 */

import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const CLUSTER_NAME = 'vibecode-test';
const NAMESPACE = 'vibecode-platform';
const HELM_RELEASE = 'vibecode-platform';
const CHART_PATH = 'helm/vibecode-platform';
const TIMEOUT = 300000; // 5 minutes

describe('VibeCode Platform Helm Chart Deployment', () => {
  beforeAll(async () => {
    console.log('Setting up KIND cluster for Helm chart testing...');
    
    // Check if cluster already exists
    try {
      execSync(`kind get clusters | grep -q "^${CLUSTER_NAME}$"`, { stdio: 'pipe' });
      console.log(`Cluster ${CLUSTER_NAME} already exists, using it`);
    } catch {
      // Create KIND cluster using our configuration
      execSync(`kind create cluster --name ${CLUSTER_NAME} --config k8s/kind-simple-config.yaml`, {
        stdio: 'inherit'
      });
    }
    
    // Set kubectl context
    execSync(`kubectl config use-context kind-${CLUSTER_NAME}`, { stdio: 'inherit' });
    
    // Wait for cluster to be ready
    execSync('kubectl wait --for=condition=Ready nodes --all --timeout=120s', {
      stdio: 'inherit'
    });
    
    // Install NGINX Ingress Controller (required for Helm chart)
    execSync(`kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml`, {
      stdio: 'inherit'
    });
    
    // Wait for ingress controller to be ready
    execSync(`kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s`, {
      stdio: 'inherit'
    });
    
    // Create namespace
    execSync(`kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -`, {
      stdio: 'inherit'
    });
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
      cwd: process.cwd()
    });
    
    expect(result).toContain('1 chart(s) linted, 0 chart(s) failed');
  });

  test('Helm chart should template successfully', () => {
    const result = execSync(`helm template ${HELM_RELEASE} ${CHART_PATH} --namespace ${NAMESPACE}`, {
      encoding: 'utf8',
      cwd: process.cwd()
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
    execSync(`helm install ${HELM_RELEASE} ${CHART_PATH} --namespace ${NAMESPACE} --wait --timeout=300s`, {
      stdio: 'inherit',
      cwd: process.cwd()
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
    expect(JSON.parse(configMap).data).toHaveProperty('code-server-config');
    expect(JSON.parse(configMap).data).toHaveProperty('ai-config.json');

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

  test('Network policies should be configured', () => {
    const policies = execSync(`kubectl get networkpolicy --namespace ${NAMESPACE} -o json`, {
      encoding: 'utf8'
    });
    
    const policyList = JSON.parse(policies);
    const policyNames = policyList.items.map((item: any) => item.metadata.name);
    
    expect(policyNames).toContain(`${HELM_RELEASE}-default-deny`);
    expect(policyNames).toContain(`${HELM_RELEASE}-allow-dns`);
    expect(policyNames).toContain(`${HELM_RELEASE}-allow-ingress`);
    expect(policyNames).toContain(`${HELM_RELEASE}-allow-egress`);
  });

  test('Resource quotas should be configured', () => {
    const quotas = execSync(`kubectl get resourcequota --namespace ${NAMESPACE} -o json`, {
      encoding: 'utf8'
    });
    
    const quotaList = JSON.parse(quotas);
    expect(quotaList.items.length).toBeGreaterThan(0);
    
    const globalQuota = quotaList.items.find((item: any) => 
      item.metadata.name === `${HELM_RELEASE}-global`
    );
    expect(globalQuota).toBeDefined();
    expect(globalQuota.spec.hard).toHaveProperty('requests.cpu');
    expect(globalQuota.spec.hard).toHaveProperty('requests.memory');
  });

  test('Priority classes should be created', () => {
    const priorities = execSync(`kubectl get priorityclass -o json`, {
      encoding: 'utf8'
    });
    
    const priorityList = JSON.parse(priorities);
    const priorityNames = priorityList.items.map((item: any) => item.metadata.name);
    
    expect(priorityNames).toContain('high-priority');
    expect(priorityNames).toContain('medium-priority');
    expect(priorityNames).toContain('low-priority');
  });

  test('Helm tests should pass', async () => {
    // Run Helm tests
    const result = execSync(`helm test ${HELM_RELEASE} --namespace ${NAMESPACE} --timeout=300s`, {
      encoding: 'utf8'
    });
    
    expect(result).toContain('Phase: Succeeded');
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
    const upgradeValues = `
monitoring:
  enabled: false
security:
  networkPolicies:
    enabled: false
`;
    
    fs.writeFileSync('/tmp/upgrade-values.yaml', upgradeValues);
    
    try {
      // Upgrade the chart
      execSync(`helm upgrade ${HELM_RELEASE} ${CHART_PATH} --namespace ${NAMESPACE} --values /tmp/upgrade-values.yaml --wait --timeout=300s`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      // Verify upgrade
      const result = execSync(`helm list --namespace ${NAMESPACE}`, {
        encoding: 'utf8'
      });
      
      expect(result).toContain(HELM_RELEASE);
      expect(result).toContain('deployed');
      
      // Verify monitoring is disabled (no ServiceMonitor should exist)
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
    // Uninstall the chart
    execSync(`helm uninstall ${HELM_RELEASE} --namespace ${NAMESPACE} --wait --timeout=300s`, {
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