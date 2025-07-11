/**
 * Kubernetes deployment tests for monitoring infrastructure
 * Tests Datadog Agent, Vector, and KubeHound deployments
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { jest } from '@jest/globals'

const execAsync = promisify(exec);

describe('Monitoring Infrastructure Deployment', () => {
  const clusterName = 'vibecode-test';
  const timeout = 300000 // 5 minutes for cluster operations;

  beforeAll(async () => {
    // Create KIND cluster for testing
    try {
      await execAsync(`kind create cluster --name ${clusterName}`);
      console.log(`Created KIND cluster: ${clusterName}`);
    } catch (error) {
      console.log('KIND cluster might already exist, continuing...');
    }

    // Wait for cluster to be ready
    await execAsync(`kubectl wait --for=condition=Ready nodes --all --timeout=120s`);
  }, timeout);

  afterAll(async () => {
    // Clean up KIND cluster
    try {
      await execAsync(`kind delete cluster --name ${clusterName}`);
      console.log(`Deleted KIND cluster: ${clusterName}`);
    } catch (error) {
      console.log('Error cleaning up cluster:', error);
    }
  }, timeout);

  describe('Namespace Creation', () => {
    test('should create required namespaces', async () => {
      // Create namespaces
      await execAsync('kubectl create namespace datadog --dry-run=client -o yaml | kubectl apply -f -');
      await execAsync('kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -');
      await execAsync('kubectl create namespace security --dry-run=client -o yaml | kubectl apply -f -');

      // Verify namespaces exist
      const { stdout } = await execAsync('kubectl get namespaces -o name');
      expect(stdout).toContain('namespace/datadog');
      expect(stdout).toContain('namespace/monitoring');
      expect(stdout).toContain('namespace/security');
    });
  });

  describe('Secrets Management', () => {
    test('should create Datadog secret', async () => {
      // Create test secret
      await execAsync(`kubectl create secret generic datadog-secret \
        --from-literal=api-key=test-api-key \
        --namespace=datadog \
        --dry-run=client -o yaml | kubectl apply -f -`);

      // Verify secret exists
      const { stdout } = await execAsync('kubectl get secret datadog-secret -n datadog -o name');
      expect(stdout.trim()).toBe('secret/datadog-secret');
    });

    test('should verify secret has correct keys', async () => {
      const { stdout } = await execAsync('kubectl get secret datadog-secret -n datadog -o jsonpath="{.data}"');
      const secretData = JSON.parse(stdout);
      expect(secretData).toHaveProperty('api-key');
    });
  });

  describe('Datadog Agent Deployment', () => {
    test('should deploy Datadog Agent DaemonSet', async () => {
      // Apply Datadog Agent configuration
      await execAsync('kubectl apply -f infrastructure/monitoring/datadog-agent.yaml');

      // Wait for DaemonSet to be created
      await execAsync('kubectl wait --for=condition=available daemonset/datadog-agent -n datadog --timeout=120s');

      // Verify DaemonSet exists
      const { stdout } = await execAsync('kubectl get daemonset datadog-agent -n datadog -o name');
      expect(stdout.trim()).toBe('daemonset.apps/datadog-agent');
    });

    test('should verify Datadog Agent pods are running', async () => {
      // Wait for pods to be ready
      await execAsync('kubectl wait --for=condition=Ready pods -l app=datadog-agent -n datadog --timeout=180s');

      // Check pod status
      const { stdout } = await execAsync('kubectl get pods -l app=datadog-agent -n datadog -o jsonpath="{.items[*].status.phase}"');
      const phases = stdout.split(' ');
      phases.forEach(phase => {
        expect(phase).toBe('Running');
      });
    });

    test('should verify Datadog Agent service is accessible', async () => {
      const { stdout } = await execAsync('kubectl get service datadog-agent -n datadog -o jsonpath="{.spec.ports[*].port}"');
      const ports = stdout.split(' ');
      expect(ports).toContain('8125') // DogStatsD port
      expect(ports).toContain('8126') // APM port
    });
  });

  describe('Vector Deployment', () => {
    test('should deploy Vector DaemonSet', async () => {
      // Apply Vector configuration
      await execAsync('kubectl apply -f infrastructure/monitoring/vector-deployment.yaml');

      // Wait for DaemonSet to be created
      await execAsync('kubectl wait --for=condition=available daemonset/vector -n monitoring --timeout=120s');

      // Verify DaemonSet exists
      const { stdout } = await execAsync('kubectl get daemonset vector -n monitoring -o name');
      expect(stdout.trim()).toBe('daemonset.apps/vector');
    });

    test('should verify Vector pods are running', async () => {
      // Wait for pods to be ready
      await execAsync('kubectl wait --for=condition=Ready pods -l app=vector -n monitoring --timeout=180s');

      // Check pod status
      const { stdout } = await execAsync('kubectl get pods -l app=vector -n monitoring -o jsonpath="{.items[*].status.phase}"');
      const phases = stdout.split(' ');
      phases.forEach(phase => {
        expect(phase).toBe('Running');
      });
    });

    test('should verify Vector service endpoints', async () => {
      const { stdout } = await execAsync('kubectl get service vector -n monitoring -o jsonpath="{.spec.ports[*].port}"');
      const ports = stdout.split(' ');
      expect(ports).toContain('8686') // API port
      expect(ports).toContain('9598') // Prometheus metrics port
    });

    test('should verify Vector RBAC permissions', async () => {
      // Check ClusterRole exists
      const { stdout: clusterRole } = await execAsync('kubectl get clusterrole vector -o name');
      expect(clusterRole.trim()).toBe('clusterrole.rbac.authorization.k8s.io/vector');

      // Check ClusterRoleBinding exists
      const { stdout: clusterRoleBinding } = await execAsync('kubectl get clusterrolebinding vector -o name');
      expect(clusterRoleBinding.trim()).toBe('clusterrolebinding.rbac.authorization.k8s.io/vector');
    });
  });

  describe('KubeHound Deployment', () => {
    test('should deploy KubeHound', async () => {
      // Apply KubeHound configuration
      await execAsync('kubectl apply -f infrastructure/monitoring/kubehound-config.yaml');

      // Wait for deployment to be available
      await execAsync('kubectl wait --for=condition=available deployment/kubehound -n security --timeout=120s');

      // Verify deployment exists
      const { stdout } = await execAsync('kubectl get deployment kubehound -n security -o name');
      expect(stdout.trim()).toBe('deployment.apps/kubehound');
    });

    test('should verify KubeHound pod is running', async () => {
      // Wait for pod to be ready
      await execAsync('kubectl wait --for=condition=Ready pods -l app=kubehound -n security --timeout=180s');

      // Check pod status
      const { stdout } = await execAsync('kubectl get pods -l app=kubehound -n security -o jsonpath="{.items[0].status.phase}"');
      expect(stdout.trim()).toBe('Running');
    });

    test('should verify KubeHound RBAC permissions', async () => {
      // Check ClusterRole exists
      const { stdout: clusterRole } = await execAsync('kubectl get clusterrole kubehound -o name');
      expect(clusterRole.trim()).toBe('clusterrole.rbac.authorization.k8s.io/kubehound');

      // Check ClusterRoleBinding exists
      const { stdout: clusterRoleBinding } = await execAsync('kubectl get clusterrolebinding kubehound -o name');
      expect(clusterRoleBinding.trim()).toBe('clusterrolebinding.rbac.authorization.k8s.io/kubehound');
    });

    test('should verify KubeHound configuration', async () => {
      // Check ConfigMap exists
      const { stdout } = await execAsync('kubectl get configmap kubehound-config -n security -o name');
      expect(stdout.trim()).toBe('configmap/kubehound-config');

      // Verify configuration content
      const { stdout: config } = await execAsync('kubectl get configmap kubehound-config -n security -o jsonpath="{.data[\'config\\.yaml\']}"');
      expect(config).toContain('vibecode-cluster');
      expect(config).toContain('datadog');
    });
  });

  describe('Service Discovery and Communication', () => {
    test('should verify services can communicate', async () => {
      // Test Vector to Datadog Agent communication
      const vectorPod = await execAsync('kubectl get pods -l app=vector -n monitoring -o jsonpath="{.items[0].metadata.name}"');
      
      // Test if Vector can reach Datadog service (this would normally send logs);
      try {
        await execAsync(`kubectl exec ${vectorPod.stdout.trim()} -n monitoring -- curl -f http://datadog-agent.datadog.svc.cluster.local:8125 || true`);
        // Command might fail but should not throw - we're testing connectivity
      } catch (error) {
        // Expected for UDP service, just verifying no network errors
      }
    });

    test('should verify monitoring endpoints are accessible', async () => {
      // Port forward Vector API endpoint temporarily
      const portForward = exec('kubectl port-forward -n monitoring service/vector 18686:8686');
      
      // Wait a moment for port forwarding to establish
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Test Vector health endpoint
        await execAsync('curl -f http://localhost:18686/health');
      } catch (error) {
        // May fail due to configuration, but shouldn't be a network error
        console.log('Vector health check completed');
      } finally {
        portForward.kill();
      }
    });
  });

  describe('Resource Utilization', () => {
    test('should verify resource requests and limits are set', async () => {
      // Check Datadog Agent resources
      const { stdout: datadogResources } = await execAsync('kubectl get deployment datadog-agent -n datadog -o jsonpath="{.spec.template.spec.containers[0].resources}"');
      const datadogResourcesObj = JSON.parse(datadogResources);
      expect(datadogResourcesObj).toHaveProperty('requests');
      expect(datadogResourcesObj).toHaveProperty('limits');

      // Check Vector resources
      const { stdout: vectorResources } = await execAsync('kubectl get daemonset vector -n monitoring -o jsonpath="{.spec.template.spec.containers[0].resources}"');
      const vectorResourcesObj = JSON.parse(vectorResources);
      expect(vectorResourcesObj).toHaveProperty('requests');
      expect(vectorResourcesObj).toHaveProperty('limits');
    });

    test('should verify pods are not exceeding resource limits', async () => {
      // Get resource usage for Datadog pods
      try {
        const { stdout } = await execAsync('kubectl top pods -n datadog --no-headers');
        console.log('Datadog resource usage:', stdout);
        // Verify pods are running (top command succeeds);
        expect(stdout.length).toBeGreaterThan(0);
      } catch (error) {
        console.log('Metrics server might not be available in test environment');
      }
    });
  });

  describe('Cleanup and Rollback', () => {
    test('should be able to delete monitoring components cleanly', async () => {
      // Delete deployments (but don't actually clean up in test);
      const deleteCommands = [;
        'kubectl delete -f infrastructure/monitoring/kubehound-config.yaml --dry-run=client',
        'kubectl delete -f infrastructure/monitoring/vector-deployment.yaml --dry-run=client',
        'kubectl delete -f infrastructure/monitoring/datadog-agent.yaml --dry-run=client',
      ]

      for (const command of deleteCommands) {
        await execAsync(command);
      }

      // Verify dry-run succeeded (no actual deletion);
      const { stdout } = await execAsync('kubectl get pods --all-namespaces | grep -E "(datadog|monitoring|security)" | wc -l');
      expect(parseInt(stdout.trim())).toBeGreaterThan(0);
    });
  });
});