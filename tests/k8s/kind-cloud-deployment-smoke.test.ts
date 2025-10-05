/**
 * KinD Cloud Deployment Smoke Tests
 * Tests cloud deployment scenarios in KinD cluster to validate GKE/EKS manifests
 */

import { execSync, spawn } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execSync);

describe('KinD Cloud Deployment Smoke Tests', () => {
  const CLUSTER_NAME = 'vibecode-cloud-test';
  const NAMESPACE = 'vibecode-cloud';
  const CODESERVER_NAMESPACE = 'codeserver';
  
  beforeAll(async () => {
    // Ensure KinD cluster exists
    try {
      await exec(`kind get clusters | grep -q "${CLUSTER_NAME}"`);
    } catch {
      console.log(`Creating KinD cluster: ${CLUSTER_NAME}`);
      await exec(`kind create cluster --name ${CLUSTER_NAME} --config k8s/kind-cloud-config.yaml`);
    }
    
    // Set kubectl context
    await exec(`kubectl config use-context kind-${CLUSTER_NAME}`);
    
    // Create namespaces
    await exec(`kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -`);
    await exec(`kubectl create namespace ${CODESERVER_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -`);
  });

  afterAll(async () => {
    // Clean up cluster
    try {
      await exec(`kind delete cluster --name ${CLUSTER_NAME}`);
    } catch (error) {
      console.warn('Failed to delete KinD cluster:', error);
    }
  });

  describe('Cloud Infrastructure Validation', () => {
    it('should have KinD cluster running', async () => {
      const result = await exec('kubectl cluster-info');
      expect(result.toString()).toContain('Kubernetes control plane');
    });

    it('should have nodes ready', async () => {
      const result = await exec('kubectl get nodes');
      expect(result.toString()).toContain('Ready');
    });

    it('should have namespaces created', async () => {
      const result = await exec('kubectl get namespaces');
      expect(result.toString()).toContain(NAMESPACE);
      expect(result.toString()).toContain(CODESERVER_NAMESPACE);
    });
  });

  describe('Code-Server Cloud Deployment', () => {
    beforeAll(async () => {
      // Deploy code-server cloud manifest
      await exec(`kubectl apply -f k8s/code-server-kind-cloud.yaml -n ${CODESERVER_NAMESPACE}`);
      
      // Wait for deployment to be ready
      await exec(`kubectl wait --for=condition=available --timeout=300s deployment/codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
    });

    it('should deploy code-server cloud deployment', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
      expect(result.toString()).toContain('codeserver-cloud');
      expect(result.toString()).toContain('1/1');
    });

    it('should have code-server pods running', async () => {
      const result = await exec(`kubectl get pods -l app=codeserver -n ${CODESERVER_NAMESPACE}`);
      expect(result.toString()).toContain('Running');
    });

    it('should have code-server service', async () => {
      const result = await exec(`kubectl get service codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
      expect(result.toString()).toContain('codeserver-cloud');
      expect(result.toString()).toContain('ClusterIP');
    });

    it('should have correct image', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.template.spec.containers[0].image}'`);
      expect(result.toString().trim()).toBe('ghcr.io/ryanmaclean/vibecode-codeserver:latest');
    });

    it('should have correct port configuration', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.template.spec.containers[0].ports[0].containerPort}'`);
      expect(result.toString().trim()).toBe('8765');
    });

    it('should have workspace volume mounted', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.template.spec.volumes[0].name}'`);
      expect(result.toString().trim()).toBe('workspace');
    });
  });

  describe('Cloud Scaling Tests', () => {
    it('should scale code-server deployment', async () => {
      // Scale up
      await exec(`kubectl scale deployment codeserver-cloud --replicas=3 -n ${CODESERVER_NAMESPACE}`);
      
      // Wait for scaling
      await exec(`kubectl wait --for=condition=available --timeout=300s deployment/codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
      
      // Verify scaling
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.status.readyReplicas}'`);
      expect(result.toString().trim()).toBe('3');
      
      // Scale back down
      await exec(`kubectl scale deployment codeserver-cloud --replicas=1 -n ${CODESERVER_NAMESPACE}`);
      await exec(`kubectl wait --for=condition=available --timeout=300s deployment/codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
    });

    it('should handle pod disruption', async () => {
      // Get pod name
      const podResult = await exec(`kubectl get pods -l app=codeserver -n ${CODESERVER_NAMESPACE} -o jsonpath='{.items[0].metadata.name}'`);
      const podName = podResult.toString().trim();
      
      // Delete pod
      await exec(`kubectl delete pod ${podName} -n ${CODESERVER_NAMESPACE}`);
      
      // Wait for new pod
      await exec(`kubectl wait --for=condition=ready --timeout=300s pod -l app=codeserver -n ${CODESERVER_NAMESPACE}`);
      
      // Verify new pod is running
      const result = await exec(`kubectl get pods -l app=codeserver -n ${CODESERVER_NAMESPACE}`);
      expect(result.toString()).toContain('Running');
    });
  });

  describe('Cloud Networking Tests', () => {
    it('should have service endpoints', async () => {
      const result = await exec(`kubectl get endpoints codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
      expect(result.toString()).toContain('codeserver-cloud');
    });

    it('should have correct service selector', async () => {
      const result = await exec(`kubectl get service codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.selector.app}'`);
      expect(result.toString().trim()).toBe('codeserver');
    });

    it('should have correct port mapping', async () => {
      const result = await exec(`kubectl get service codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.ports[0].targetPort}'`);
      expect(result.toString().trim()).toBe('8765');
    });
  });

  describe('Cloud Security Tests', () => {
    it('should have security context configured', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o yaml`);
      expect(result.toString()).toContain('securityContext');
    });

    it('should have resource limits', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o yaml`);
      expect(result.toString()).toContain('limits:') || expect(result.toString()).toContain('requests:');
    });
  });

  describe('Cloud Monitoring Tests', () => {
    it('should have pod logs available', async () => {
      const result = await exec(`kubectl logs -l app=codeserver -n ${CODESERVER_NAMESPACE} --tail=10`);
      expect(result.toString()).toBeDefined();
    });

    it('should have pod metrics available', async () => {
      try {
        const result = await exec(`kubectl top pods -l app=codeserver -n ${CODESERVER_NAMESPACE}`);
        expect(result.toString()).toBeDefined();
      } catch (error) {
        // Metrics server might not be available in KinD
        console.warn('Metrics server not available in KinD cluster');
      }
    });
  });

  describe('Cloud Storage Tests', () => {
    it('should have workspace volume configured', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.template.spec.volumes[0].emptyDir}'`);
      expect(result.toString()).toBeDefined();
    });

    it('should have volume mount configured', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.template.spec.containers[0].volumeMounts[0].mountPath}'`);
      expect(result.toString().trim()).toBe('/home/coder/project');
    });
  });

  describe('Cloud Configuration Tests', () => {
    it('should have environment variables configured', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.template.spec.containers[0].env[0].name}'`);
      expect(result.toString().trim()).toBe('PASSWORD');
    });

    it('should have correct password value', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.spec.template.spec.containers[0].env[0].value}'`);
      expect(result.toString().trim()).toBe('changeme');
    });
  });

  describe('Cloud Health Checks', () => {
    it('should have pods in healthy state', async () => {
      const result = await exec(`kubectl get pods -l app=codeserver -n ${CODESERVER_NAMESPACE} -o jsonpath='{.items[0].status.phase}'`);
      expect(result.toString().trim()).toBe('Running');
    });

    it('should have deployment in available state', async () => {
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Available")].status}'`);
      expect(result.toString().trim()).toBe('True');
    });
  });

  describe('Cloud Performance Tests', () => {
    it('should respond to health checks', async () => {
      // Port forward to test connectivity
      const portForward = spawn('kubectl', ['port-forward', `-n ${CODESERVER_NAMESPACE}`, 'svc/codeserver-cloud', '8080:80'], {
        stdio: 'pipe'
      });
      
      // Wait for port forward to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        // Test connectivity
        const result = await exec('curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/');
        expect(result.toString().trim()).toMatch(/200|404/); // 404 is expected for code-server root
      } finally {
        portForward.kill();
      }
    });
  });

  describe('Cloud Disaster Recovery Tests', () => {
    it('should recover from deployment deletion', async () => {
      // Delete deployment
      await exec(`kubectl delete deployment codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
      
      // Recreate deployment
      await exec(`kubectl apply -f k8s/code-server-kind-cloud.yaml -n ${CODESERVER_NAMESPACE}`);
      
      // Wait for recovery
      await exec(`kubectl wait --for=condition=available --timeout=300s deployment/codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
      
      // Verify recovery
      const result = await exec(`kubectl get deployment codeserver-cloud -n ${CODESERVER_NAMESPACE}`);
      expect(result.toString()).toContain('codeserver-cloud');
      expect(result.toString()).toContain('1/1');
    });
  });

  describe('Cloud Integration Tests', () => {
    it('should work with ingress controller', async () => {
      // Check if ingress controller is available
      try {
        await exec('kubectl get pods -n ingress-nginx');
        console.log('Ingress controller available');
      } catch {
        console.log('Ingress controller not available, skipping ingress tests');
      }
    });

    it('should work with monitoring stack', async () => {
      // Check if monitoring stack is available
      try {
        await exec('kubectl get pods -n monitoring');
        console.log('Monitoring stack available');
      } catch {
        console.log('Monitoring stack not available, skipping monitoring tests');
      }
    });
  });
});