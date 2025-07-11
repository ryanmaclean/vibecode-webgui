/**
 * User Provisioning Integration Tests
 * Tests the complete user provisioning workflow including Helm chart and scripts
 */

import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';

const CLUSTER_NAME = 'vibecode-provisioning-test';
const NAMESPACE = 'vibecode-platform';
const HELM_RELEASE = 'vibecode-platform';
const CHART_PATH = 'helm/vibecode-platform';
const TIMEOUT = 600000; // 10 minutes

describe('User Provisioning Integration Tests', () => {
  beforeAll(async () => {
    console.log('Setting up integration test environment...');
    
    // Create KIND cluster
    try {
      execSync(`kind get clusters | grep -q "^${CLUSTER_NAME}$"`, { stdio: 'pipe' });
      console.log(`Cluster ${CLUSTER_NAME} already exists, using it`);
    } catch {
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
    
    // Install NGINX Ingress Controller
    execSync(`kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml`, {
      stdio: 'inherit'
    });
    
    // Wait for ingress controller
    execSync(`kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s`, {
      stdio: 'inherit'
    });
    
    // Create namespace
    execSync(`kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -`, {
      stdio: 'inherit'
    });
    
    // Install Helm chart
    execSync(`helm install ${HELM_RELEASE} ${CHART_PATH} --namespace ${NAMESPACE} --wait --timeout=300s`, {
      stdio: 'inherit',
      cwd: process.cwd()
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
  }, 120000);

  test('Provisioning script should create complete user workspace', async () => {
    const userId = 'integration-test-user';
    
    try {
      // Create user using provisioning script
      const output = execSync(`scripts/provision-user.sh create ${userId} --namespace ${NAMESPACE}`, {
        encoding: 'utf8',
        env: {
          ...process.env,
          HELM_RELEASE: HELM_RELEASE,
          CHART_PATH: CHART_PATH
        }
      });
      
      // Verify output contains expected information
      expect(output).toContain('Successfully provisioned workspace');
      expect(output).toContain(`user: ${userId}`);
      expect(output).toContain(`http://${userId}.vibecode.local`);
      expect(output).toContain('Password:');
      
      // Wait for deployment to be ready
      execSync(`kubectl wait --for=condition=Available deployment/code-server-${userId} --namespace ${NAMESPACE} --timeout=300s`, {
        stdio: 'inherit'
      });
      
      // Verify all expected resources exist
      
      // 1. Deployment
      const deployment = execSync(`kubectl get deployment code-server-${userId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const deploymentData = JSON.parse(deployment);
      expect(deploymentData.metadata.name).toBe(`code-server-${userId}`);
      expect(deploymentData.metadata.labels['vibecode.dev/user-id']).toBe(userId);
      expect(deploymentData.status.readyReplicas).toBe(1);
      
      // 2. Service
      const service = execSync(`kubectl get service code-server-${userId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const serviceData = JSON.parse(service);
      expect(serviceData.metadata.name).toBe(`code-server-${userId}`);
      expect(serviceData.spec.selector['vibecode.dev/user-id']).toBe(userId);
      
      // 3. PVC
      const pvc = execSync(`kubectl get pvc workspace-${userId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const pvcData = JSON.parse(pvc);
      expect(pvcData.metadata.name).toBe(`workspace-${userId}`);
      expect(pvcData.status.phase).toBe('Bound');
      
      // 4. Secret
      const secret = execSync(`kubectl get secret code-server-${userId}-config --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const secretData = JSON.parse(secret);
      expect(secretData.metadata.name).toBe(`code-server-${userId}-config`);
      expect(secretData.data.password).toBeDefined();
      
      // 5. Ingress
      const ingress = execSync(`kubectl get ingress code-server-${userId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const ingressData = JSON.parse(ingress);
      expect(ingressData.metadata.name).toBe(`code-server-${userId}`);
      expect(ingressData.spec.rules[0].host).toBe(`${userId}.vibecode.local`);
      
      // 6. Pod should be running
      const pods = execSync(`kubectl get pods -l vibecode.dev/user-id=${userId} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const podData = JSON.parse(pods);
      expect(podData.items.length).toBe(1);
      expect(podData.items[0].status.phase).toBe('Running');
      
      // 7. Verify security context is applied
      const podSpec = podData.items[0].spec;
      expect(podSpec.securityContext.runAsNonRoot).toBe(true);
      expect(podSpec.securityContext.runAsUser).toBe(1000);
      expect(podSpec.containers[0].securityContext.allowPrivilegeEscalation).toBe(false);
      
    } finally {
      // Cleanup user
      try {
        execSync(`scripts/provision-user.sh delete ${userId} --delete-storage --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: {
            ...process.env,
            HELM_RELEASE: HELM_RELEASE
          }
        });
      } catch (error) {
        console.error('Failed to cleanup user:', error);
      }
    }
  }, TIMEOUT);

  test('Multiple users should be isolated from each other', async () => {
    const user1 = 'isolation-test-user-1';
    const user2 = 'isolation-test-user-2';
    
    try {
      // Create two users
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
      
      // Wait for both deployments to be ready
      execSync(`kubectl wait --for=condition=Available deployment/code-server-${user1} --namespace ${NAMESPACE} --timeout=300s`, {
        stdio: 'inherit'
      });
      execSync(`kubectl wait --for=condition=Available deployment/code-server-${user2} --namespace ${NAMESPACE} --timeout=300s`, {
        stdio: 'inherit'
      });
      
      // Test isolation
      
      // 1. Different PVCs
      const pvc1 = execSync(`kubectl get pvc workspace-${user1} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const pvc2 = execSync(`kubectl get pvc workspace-${user2} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      
      const pvc1Data = JSON.parse(pvc1);
      const pvc2Data = JSON.parse(pvc2);
      expect(pvc1Data.metadata.name).toBe(`workspace-${user1}`);
      expect(pvc2Data.metadata.name).toBe(`workspace-${user2}`);
      expect(pvc1Data.spec.volumeName).not.toBe(pvc2Data.spec.volumeName);
      
      // 2. Different secrets
      const secret1 = execSync(`kubectl get secret code-server-${user1}-config --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const secret2 = execSync(`kubectl get secret code-server-${user2}-config --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      
      const secret1Data = JSON.parse(secret1);
      const secret2Data = JSON.parse(secret2);
      expect(secret1Data.data.password).not.toBe(secret2Data.data.password);
      
      // 3. Different ingress hosts
      const ingress1 = execSync(`kubectl get ingress code-server-${user1} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      const ingress2 = execSync(`kubectl get ingress code-server-${user2} --namespace ${NAMESPACE} -o json`, {
        encoding: 'utf8'
      });
      
      const ingress1Data = JSON.parse(ingress1);
      const ingress2Data = JSON.parse(ingress2);
      expect(ingress1Data.spec.rules[0].host).toBe(`${user1}.vibecode.local`);
      expect(ingress2Data.spec.rules[0].host).toBe(`${user2}.vibecode.local`);
      
      // 4. Network connectivity test - users should not be able to access each other directly
      const networkTestPod = `
apiVersion: v1
kind: Pod
metadata:
  name: network-test-pod
  namespace: ${NAMESPACE}
  labels:
    vibecode.dev/user-id: network-tester
spec:
  containers:
  - name: test
    image: curlimages/curl:latest
    command: ['sleep', '300']
`;
      
      execSync('kubectl apply -f -', {
        input: networkTestPod,
        stdio: 'inherit'
      });
      
      execSync('kubectl wait --for=condition=Ready pod/network-test-pod --namespace ${NAMESPACE} --timeout=60s', {
        stdio: 'inherit'
      });
      
      // Test that users can access their own services but not each other's
      // (This would require proper network policies to be fully tested)
      
    } finally {
      // Cleanup users and test pod
      try {
        execSync(`scripts/provision-user.sh delete ${user1} --delete-storage --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: { ...process.env, HELM_RELEASE: HELM_RELEASE }
        });
        execSync(`scripts/provision-user.sh delete ${user2} --delete-storage --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: { ...process.env, HELM_RELEASE: HELM_RELEASE }
        });
        execSync(`kubectl delete pod network-test-pod --namespace ${NAMESPACE} --ignore-not-found=true`, {
          stdio: 'inherit'
        });
      } catch (error) {
        console.error('Failed to cleanup test resources:', error);
      }
    }
  }, TIMEOUT);

  test('User deletion should clean up all resources', async () => {
    const userId = 'deletion-test-user';
    
    // Create user
    execSync(`scripts/provision-user.sh create ${userId} --namespace ${NAMESPACE}`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        HELM_RELEASE: HELM_RELEASE,
        CHART_PATH: CHART_PATH
      }
    });
    
    // Wait for deployment to be ready
    execSync(`kubectl wait --for=condition=Available deployment/code-server-${userId} --namespace ${NAMESPACE} --timeout=300s`, {
      stdio: 'inherit'
    });
    
    // Verify resources exist
    expect(() => {
      execSync(`kubectl get deployment code-server-${userId} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
    }).not.toThrow();
    
    expect(() => {
      execSync(`kubectl get service code-server-${userId} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
    }).not.toThrow();
    
    expect(() => {
      execSync(`kubectl get pvc workspace-${userId} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
    }).not.toThrow();
    
    // Delete user with storage
    execSync(`scripts/provision-user.sh delete ${userId} --delete-storage --namespace ${NAMESPACE}`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        HELM_RELEASE: HELM_RELEASE
      }
    });
    
    // Verify all resources are deleted
    expect(() => {
      execSync(`kubectl get deployment code-server-${userId} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
    }).toThrow();
    
    expect(() => {
      execSync(`kubectl get service code-server-${userId} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
    }).toThrow();
    
    expect(() => {
      execSync(`kubectl get ingress code-server-${userId} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
    }).toThrow();
    
    expect(() => {
      execSync(`kubectl get secret code-server-${userId}-config --namespace ${NAMESPACE}`, { stdio: 'pipe' });
    }).toThrow();
    
    expect(() => {
      execSync(`kubectl get pvc workspace-${userId} --namespace ${NAMESPACE}`, { stdio: 'pipe' });
    }).toThrow();
  });

  test('User listing should show active users', async () => {
    const users = ['list-test-user-1', 'list-test-user-2', 'list-test-user-3'];
    
    try {
      // Create multiple users
      for (const user of users) {
        execSync(`scripts/provision-user.sh create ${user} --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: {
            ...process.env,
            HELM_RELEASE: HELM_RELEASE,
            CHART_PATH: CHART_PATH
          }
        });
      }
      
      // Wait for all deployments
      for (const user of users) {
        execSync(`kubectl wait --for=condition=Available deployment/code-server-${user} --namespace ${NAMESPACE} --timeout=300s`, {
          stdio: 'inherit'
        });
      }
      
      // List users
      const output = execSync(`scripts/provision-user.sh list --namespace ${NAMESPACE}`, {
        encoding: 'utf8',
        env: {
          ...process.env,
          HELM_RELEASE: HELM_RELEASE
        }
      });
      
      // Verify all users are listed
      users.forEach(user => {
        expect(output).toContain(user);
      });
      
      expect(output).toContain('Active user workspaces');
      
    } finally {
      // Cleanup all test users
      for (const user of users) {
        try {
          execSync(`scripts/provision-user.sh delete ${user} --delete-storage --namespace ${NAMESPACE}`, {
            stdio: 'inherit',
            env: { ...process.env, HELM_RELEASE: HELM_RELEASE }
          });
        } catch (error) {
          console.error(`Failed to cleanup user ${user}:`, error);
        }
      }
    }
  }, TIMEOUT);

  test('User status should show detailed information', async () => {
    const userId = 'status-test-user';
    
    try {
      // Create user
      execSync(`scripts/provision-user.sh create ${userId} --namespace ${NAMESPACE}`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          HELM_RELEASE: HELM_RELEASE,
          CHART_PATH: CHART_PATH
        }
      });
      
      // Wait for deployment to be ready
      execSync(`kubectl wait --for=condition=Available deployment/code-server-${userId} --namespace ${NAMESPACE} --timeout=300s`, {
        stdio: 'inherit'
      });
      
      // Get user status
      const output = execSync(`scripts/provision-user.sh status ${userId} --namespace ${NAMESPACE}`, {
        encoding: 'utf8',
        env: {
          ...process.env,
          HELM_RELEASE: HELM_RELEASE
        }
      });
      
      // Verify status output contains expected information
      expect(output).toContain('Deployment status:');
      expect(output).toContain('Pod status:');
      expect(output).toContain('Service status:');
      expect(output).toContain('Ingress status:');
      expect(output).toContain(`code-server-${userId}`);
      
    } finally {
      // Cleanup
      try {
        execSync(`scripts/provision-user.sh delete ${userId} --delete-storage --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: { ...process.env, HELM_RELEASE: HELM_RELEASE }
        });
      } catch (error) {
        console.error('Failed to cleanup user:', error);
      }
    }
  });

  test('Invalid user IDs should be rejected', () => {
    const invalidUserIds = [
      '', // empty
      'a', // too short
      'ab', // too short
      'a'.repeat(64), // too long
      '-invalid', // starts with hyphen
      'invalid-', // ends with hyphen
      'invalid_user', // contains underscore
      'Invalid-User', // contains uppercase
      'invalid.user', // contains dot
      'invalid user', // contains space
      'invalid@user', // contains special character
    ];
    
    invalidUserIds.forEach(userId => {
      expect(() => {
        execSync(`scripts/provision-user.sh create "${userId}" --namespace ${NAMESPACE}`, {
          stdio: 'pipe',
          env: {
            ...process.env,
            HELM_RELEASE: HELM_RELEASE,
            CHART_PATH: CHART_PATH
          }
        });
      }).toThrow();
    });
  });

  test('Duplicate user creation should be prevented', async () => {
    const userId = 'duplicate-test-user';
    
    try {
      // Create user first time
      execSync(`scripts/provision-user.sh create ${userId} --namespace ${NAMESPACE}`, {
        stdio: 'inherit',
        env: {
          ...process.env,
          HELM_RELEASE: HELM_RELEASE,
          CHART_PATH: CHART_PATH
        }
      });
      
      // Wait for deployment
      execSync(`kubectl wait --for=condition=Available deployment/code-server-${userId} --namespace ${NAMESPACE} --timeout=300s`, {
        stdio: 'inherit'
      });
      
      // Try to create same user again - should fail
      expect(() => {
        execSync(`scripts/provision-user.sh create ${userId} --namespace ${NAMESPACE}`, {
          stdio: 'pipe',
          env: {
            ...process.env,
            HELM_RELEASE: HELM_RELEASE,
            CHART_PATH: CHART_PATH
          }
        });
      }).toThrow();
      
    } finally {
      // Cleanup
      try {
        execSync(`scripts/provision-user.sh delete ${userId} --delete-storage --namespace ${NAMESPACE}`, {
          stdio: 'inherit',
          env: { ...process.env, HELM_RELEASE: HELM_RELEASE }
        });
      } catch (error) {
        console.error('Failed to cleanup user:', error);
      }
    }
  });

  test('Script should handle missing kubectl/helm gracefully', () => {
    // Test with PATH that doesn't include kubectl
    const originalPath = process.env.PATH;
    
    try {
      // Set PATH to exclude kubectl
      const modifiedEnv = {
        ...process.env,
        PATH: '/usr/bin:/bin' // Minimal PATH without kubectl/helm
      };
      
      expect(() => {
        execSync(`scripts/provision-user.sh create test-user --namespace ${NAMESPACE}`, {
          stdio: 'pipe',
          env: modifiedEnv
        });
      }).toThrow();
      
    } finally {
      // Restore original PATH
      process.env.PATH = originalPath;
    }
  });
});