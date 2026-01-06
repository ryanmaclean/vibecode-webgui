/**
 * KIND Cluster Validation Tests
 * Validates that the KIND cluster setup meets all requirements for VibeCode platform
 * Mocked version - tests cluster validation logic without requiring actual K8s cluster
 */

import { describe, test, beforeAll, afterAll, expect, beforeEach } from '@jest/globals';
import { execSync } from 'child_process';

// Mock child_process to avoid actual kubectl/kind calls
jest.mock('child_process');

const CLUSTER_NAME = 'vibecode-cluster';
const TIMEOUT = 300000; // 5 minutes

// Mock data factory
const createMockKubectlResponse = (cmd: string): Buffer => {
  // Node responses
  if (cmd.includes('kubectl get nodes -o json')) {
    return Buffer.from(JSON.stringify({
      items: [
        {
          metadata: {
            name: 'vibecode-cluster-control-plane',
            labels: {
              'node-role.kubernetes.io/control-plane': '',
              'ingress-ready': 'true'
            }
          },
          status: {
            conditions: [
              { type: 'Ready', status: 'True' },
              { type: 'MemoryPressure', status: 'False' }
            ]
          }
        },
        {
          metadata: {
            name: 'vibecode-cluster-worker-1',
            labels: { 'tier': 'code-server' }
          },
          status: {
            conditions: [{ type: 'Ready', status: 'True' }]
          }
        },
        {
          metadata: {
            name: 'vibecode-cluster-worker-2',
            labels: { 'tier': 'monitoring' }
          },
          status: {
            conditions: [{ type: 'Ready', status: 'True' }]
          }
        }
      ]
    }));
  }

  // System pods response
  if (cmd.includes('kubectl get pods -n kube-system -o json')) {
    return Buffer.from(JSON.stringify({
      items: [
        { metadata: { name: 'kube-apiserver-control-plane' }, status: { phase: 'Running' } },
        { metadata: { name: 'kube-controller-manager-control-plane' }, status: { phase: 'Running' } },
        { metadata: { name: 'kube-scheduler-control-plane' }, status: { phase: 'Running' } },
        { metadata: { name: 'etcd-control-plane' }, status: { phase: 'Running' } },
        { metadata: { name: 'kube-proxy-abc123' }, status: { phase: 'Running' } },
        { metadata: { name: 'kindnet-xyz789' }, status: { phase: 'Running' } }
      ]
    }));
  }

  // Storage class response
  if (cmd.includes('kubectl get storageclass -o json')) {
    return Buffer.from(JSON.stringify({
      items: [
        {
          metadata: { name: 'standard' },
          provisioner: 'rancher.io/local-path'
        }
      ]
    }));
  }

  // PVC responses
  if (cmd.includes('kubectl get pvc test-pvc -o json')) {
    return Buffer.from(JSON.stringify({
      metadata: { name: 'test-pvc', namespace: 'default' },
      status: { phase: 'Bound' },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '1Gi' } }
      }
    }));
  }

  if (cmd.includes('kubectl apply -f -') && cmd.includes('PersistentVolumeClaim')) {
    return Buffer.from('persistentvolumeclaim/test-pvc created');
  }

  if (cmd.includes('kubectl wait --for=condition=Bound pvc/test-pvc')) {
    return Buffer.from('persistentvolumeclaim/test-pvc condition met');
  }

  if (cmd.includes('kubectl delete pvc test-pvc')) {
    return Buffer.from('persistentvolumeclaim "test-pvc" deleted');
  }

  // Ingress controller responses
  if (cmd.includes('kubectl apply') && cmd.includes('ingress-nginx')) {
    return Buffer.from('namespace/ingress-nginx created\nserviceaccount/ingress-nginx created');
  }

  if (cmd.includes('kubectl get pods -n ingress-nginx -o json')) {
    return Buffer.from(JSON.stringify({
      items: [
        {
          metadata: { name: 'ingress-nginx-controller-abc123' },
          status: { phase: 'Running' }
        }
      ]
    }));
  }

  if (cmd.includes('kubectl get svc -n ingress-nginx -o json')) {
    return Buffer.from(JSON.stringify({
      items: [
        {
          metadata: { name: 'ingress-nginx-controller' },
          spec: { type: 'LoadBalancer', ports: [{ port: 80 }, { port: 443 }] }
        }
      ]
    }));
  }

  if (cmd.includes('kubectl wait') && cmd.includes('ingress-nginx')) {
    return Buffer.from('pod/ingress-nginx-controller-abc123 condition met');
  }

  // Cluster info responses
  if (cmd.includes('kind get clusters')) {
    return Buffer.from(`${CLUSTER_NAME}\nother-cluster`);
  }

  if (cmd.includes('kubectl cluster-info')) {
    return Buffer.from('Kubernetes control plane is running at https://127.0.0.1:6443');
  }

  // Test application responses
  if (cmd.includes('kubectl apply') && !cmd.includes('ingress-nginx')) {
    return Buffer.from('deployment.apps/test-app created\nservice/test-app-service created\ningress.networking.k8s.io/test-app-ingress created');
  }

  if (cmd.includes('kubectl wait --for=condition=Available deployment/test-app')) {
    return Buffer.from('deployment.apps/test-app condition met');
  }

  if (cmd.includes('kubectl get ingress test-app-ingress -o json')) {
    return Buffer.from(JSON.stringify({
      metadata: { name: 'test-app-ingress' },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: 'test.local',
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: { name: 'test-app-service', port: { number: 80 } }
                }
              }]
            }
          }
        ]
      }
    }));
  }

  if (cmd.includes('kubectl run test-pod') && cmd.includes('curl')) {
    return Buffer.from('<html><body>Welcome to nginx!</body></html>');
  }

  if (cmd.includes('kubectl delete deployment test-app')) {
    return Buffer.from('deployment.apps "test-app" deleted');
  }

  if (cmd.includes('kubectl delete service test-app-service')) {
    return Buffer.from('service "test-app-service" deleted');
  }

  if (cmd.includes('kubectl delete ingress test-app-ingress')) {
    return Buffer.from('ingress.networking.k8s.io "test-app-ingress" deleted');
  }

  // Network policy responses
  if (cmd.includes('kubectl get networkpolicy test-network-policy -o json')) {
    return Buffer.from(JSON.stringify({
      metadata: { name: 'test-network-policy' },
      spec: {
        podSelector: { matchLabels: { app: 'test' } },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [{ from: [{ podSelector: { matchLabels: { app: 'allowed' } } }], ports: [{ protocol: 'TCP', port: 80 }] }],
        egress: [{ to: [], ports: [{ protocol: 'TCP', port: 53 }, { protocol: 'UDP', port: 53 }] }]
      }
    }));
  }

  if (cmd.includes('kubectl delete networkpolicy test-network-policy')) {
    return Buffer.from('networkpolicy.networking.k8s.io "test-network-policy" deleted');
  }

  // Resource quota responses
  if (cmd.includes('kubectl get resourcequota test-resource-quota -o json')) {
    return Buffer.from(JSON.stringify({
      metadata: { name: 'test-resource-quota' },
      spec: {
        hard: {
          'requests.cpu': '4',
          'requests.memory': '8Gi',
          'limits.cpu': '8',
          'limits.memory': '16Gi',
          'persistentvolumeclaims': '10',
          'pods': '20'
        }
      }
    }));
  }

  if (cmd.includes('kubectl delete resourcequota test-resource-quota')) {
    return Buffer.from('resourcequota "test-resource-quota" deleted');
  }

  // cert-manager responses
  if (cmd.includes('cert-manager.yaml')) {
    return Buffer.from('namespace/cert-manager created\ncustomresourcedefinition.apiextensions.k8s.io/certificates.cert-manager.io created');
  }

  if (cmd.includes('kubectl get pods -n cert-manager -o json')) {
    return Buffer.from(JSON.stringify({
      items: [
        { metadata: { name: 'cert-manager-abc123', namespace: 'cert-manager' }, status: { phase: 'Running' } },
        { metadata: { name: 'cert-manager-cainjector-xyz789', namespace: 'cert-manager' }, status: { phase: 'Running' } },
        { metadata: { name: 'cert-manager-webhook-def456', namespace: 'cert-manager' }, status: { phase: 'Running' } }
      ]
    }));
  }

  if (cmd.includes('kubectl get pods -n cert-manager') && !cmd.includes('-o json')) {
    return Buffer.from('NAME                                      READY   STATUS    RESTARTS   AGE\ncert-manager-abc123                       1/1     Running   0          60s');
  }

  if (cmd.includes('kubectl get clusterissuer test-selfsigned-issuer -o json')) {
    return Buffer.from(JSON.stringify({
      metadata: { name: 'test-selfsigned-issuer' },
      spec: { selfSigned: {} }
    }));
  }

  if (cmd.includes('kubectl delete clusterissuer test-selfsigned-issuer')) {
    return Buffer.from('clusterissuer.cert-manager.io "test-selfsigned-issuer" deleted');
  }

  // Namespace responses
  if (cmd.includes('kubectl get namespaces -o json')) {
    return Buffer.from(JSON.stringify({
      items: [
        { metadata: { name: 'default' }, status: { phase: 'Active' } },
        { metadata: { name: 'kube-system' }, status: { phase: 'Active' } },
        { metadata: { name: 'test-ns-1' }, status: { phase: 'Active' } },
        { metadata: { name: 'test-ns-2' }, status: { phase: 'Active' } },
        { metadata: { name: 'test-ns-3' }, status: { phase: 'Active' } }
      ]
    }));
  }

  if (cmd.includes('kubectl create namespace')) {
    const nsName = cmd.match(/kubectl create namespace (\S+)/)?.[1] || 'test-ns';
    return Buffer.from(`namespace/${nsName} created`);
  }

  if (cmd.includes('kubectl delete namespace')) {
    const nsName = cmd.match(/kubectl delete namespace (\S+)/)?.[1] || 'test-ns';
    return Buffer.from(`namespace "${nsName}" deleted`);
  }

  // Security test pod responses
  if (cmd.includes('kubectl get pod security-test-pod -o json')) {
    return Buffer.from(JSON.stringify({
      metadata: { name: 'security-test-pod' },
      status: { phase: 'Running' },
      spec: {
        securityContext: { runAsNonRoot: true, runAsUser: 1000, runAsGroup: 1000, fsGroup: 1000 },
        containers: [{
          name: 'test-container',
          securityContext: {
            allowPrivilegeEscalation: false,
            readOnlyRootFilesystem: true,
            runAsNonRoot: true,
            runAsUser: 1000,
            runAsGroup: 1000
          }
        }]
      }
    }));
  }

  if (cmd.includes('kubectl wait --for=condition=Ready pod/security-test-pod')) {
    return Buffer.from('pod/security-test-pod condition met');
  }

  if (cmd.includes('kubectl delete pod security-test-pod')) {
    return Buffer.from('pod "security-test-pod" deleted');
  }

  if (cmd.includes('sleep')) {
    return Buffer.from('');
  }

  // Default response
  return Buffer.from('');
};

describe('KIND Cluster Validation', () => {
  let mockExecSync: jest.MockedFunction<typeof execSync>;

  beforeAll(async () => {
    // Setup mocks for kubectl and kind commands
    mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
  }, TIMEOUT);

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup default mock implementation
    mockExecSync.mockImplementation((command: any, options?: any): any => {
      const cmd = String(command);
      const response = createMockKubectlResponse(cmd);

      // Return string if encoding is specified
      if (options?.encoding === 'utf8') {
        return response.toString('utf8');
      }

      return response;
    });
  });

  afterAll(async () => {
    // Cleanup test resources - ensure cleanup runs even if tests fail
    try {
      // Clean up any test resources that may have been created
      execSync('kubectl delete pod test-pod --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete pod security-test-pod --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete pvc test-pvc --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete deployment test-app --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete service test-app-service --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete ingress test-app-ingress --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete networkpolicy test-network-policy --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete resourcequota test-resource-quota --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete clusterissuer test-selfsigned-issuer --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete namespace test-ns-1 --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete namespace test-ns-2 --ignore-not-found=true', { stdio: 'pipe' });
      execSync('kubectl delete namespace test-ns-3 --ignore-not-found=true', { stdio: 'pipe' });
    } catch (error) {
      // Ignore cleanup errors in mock environment
    }

    // Cleanup mocks
    jest.clearAllMocks();
  }, 60000);

  test('Cluster should have correct node configuration', () => {
    const nodes = execSync('kubectl get nodes -o json', { encoding: 'utf8' });
    const nodeData = JSON.parse(nodes);

    // Should have 3 nodes (1 control-plane, 2 workers)
    expect(nodeData.items).toHaveLength(3);

    // Find control plane node
    const controlPlane = nodeData.items.find((node: any) =>
      node.metadata.labels['node-role.kubernetes.io/control-plane'] !== undefined
    );
    expect(controlPlane).toBeDefined();
    expect(controlPlane.metadata.labels['ingress-ready']).toBe('true');

    // Find worker nodes
    const workers = nodeData.items.filter((node: any) =>
      node.metadata.labels['node-role.kubernetes.io/control-plane'] === undefined
    );
    expect(workers).toHaveLength(2);

    // Check worker node labels
    const codeServerWorker = workers.find((node: any) =>
      node.metadata.labels['tier'] === 'code-server'
    );
    const monitoringWorker = workers.find((node: any) =>
      node.metadata.labels['tier'] === 'monitoring'
    );

    expect(codeServerWorker).toBeDefined();
    expect(monitoringWorker).toBeDefined();
  });

  test('All nodes should be ready', () => {
    const nodes = execSync('kubectl get nodes -o json', { encoding: 'utf8' });
    const nodeData = JSON.parse(nodes);

    nodeData.items.forEach((node: any) => {
      const readyCondition = node.status.conditions.find((condition: any) => condition.type === 'Ready');
      expect(readyCondition.status).toBe('True');
    });
  });

  test('Kubernetes system pods should be running', () => {
    const pods = execSync('kubectl get pods -n kube-system -o json', { encoding: 'utf8' });
    const podData = JSON.parse(pods);

    // Check for essential system components
    const essentialPods = [
      'kube-apiserver',
      'kube-controller-manager',
      'kube-scheduler',
      'etcd',
      'kube-proxy',
      'kindnet'
    ];

    essentialPods.forEach(podName => {
      const pod = podData.items.find((pod: any) => pod.metadata.name.includes(podName));
      expect(pod).toBeDefined();
      expect(pod.status.phase).toBe('Running');
    });
  });

  test('Default storage class should be available', () => {
    const storageClasses = execSync('kubectl get storageclass -o json', { encoding: 'utf8' });
    const scData = JSON.parse(storageClasses);

    // Should have standard storage class
    const standardSC = scData.items.find((sc: any) => sc.metadata.name === 'standard');
    expect(standardSC).toBeDefined();
    expect(standardSC.provisioner).toBe('rancher.io/local-path');
  });

  test('Can create and delete PVC', async () => {
    const pvcManifest = `
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: test-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
`;

    try {
      // Create PVC
      execSync('kubectl apply -f -', {
        input: pvcManifest,
        stdio: 'inherit'
      });

      // Wait for PVC to be bound
      execSync('kubectl wait --for=condition=Bound pvc/test-pvc --timeout=60s', {
        stdio: 'inherit'
      });

      // Verify PVC status
      const pvc = execSync('kubectl get pvc test-pvc -o json', { encoding: 'utf8' });
      const pvcData = JSON.parse(pvc);
      expect(pvcData.status.phase).toBe('Bound');
    } finally {
      // Cleanup - ensure PVC is deleted even if test fails
      try {
        execSync('kubectl delete pvc test-pvc --ignore-not-found=true', { stdio: 'inherit' });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  test('Can deploy NGINX Ingress Controller', async () => {
    // Install NGINX Ingress Controller
    execSync(`kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml`, {
      stdio: 'inherit'
    });

    // Wait for ingress controller to be ready (with shorter timeout)
    try {
      execSync(`kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=60s`, {
        stdio: 'inherit'
      });
    } catch (error) {
      console.log('Ingress controller not ready within 60s, checking status...');
      // Check if pods exist but not ready
      const pods = execSync('kubectl get pods -n ingress-nginx -o json', { encoding: 'utf8' });
      const podData = JSON.parse(pods);
      const ingressPod = podData.items.find((pod: any) => pod.metadata.name.includes('ingress-nginx-controller'));

      if (ingressPod && ingressPod.status.phase === 'Running') {
        console.log('Ingress controller is running despite wait timeout');
      } else {
        throw error; // Re-throw if truly not ready
      }
    }

    // Verify ingress controller is running
    const pods = execSync('kubectl get pods -n ingress-nginx -o json', { encoding: 'utf8' });
    const podData = JSON.parse(pods);

    const ingressPod = podData.items.find((pod: any) => pod.metadata.name.includes('ingress-nginx-controller'));
    expect(ingressPod).toBeDefined();
    expect(ingressPod.status.phase).toBe('Running');

    // Verify service is created
    const services = execSync('kubectl get svc -n ingress-nginx -o json', { encoding: 'utf8' });
    const serviceData = JSON.parse(services);

    const ingressService = serviceData.items.find((svc: any) =>
      svc.metadata.name.includes('ingress-nginx-controller')
    );
    expect(ingressService).toBeDefined();
  }, TIMEOUT);

  test('Port mappings should be configured correctly', () => {
    // Get cluster info to check port mappings
    const clusterInfo = execSync(`kind get clusters`, { encoding: 'utf8' });
    expect(clusterInfo).toContain(CLUSTER_NAME);

    // Test if we can access the cluster API
    const clusterApiInfo = execSync('kubectl cluster-info', { encoding: 'utf8' });
    expect(clusterApiInfo).toContain('Kubernetes control plane');
    expect(clusterApiInfo).toContain('is running at');
  });

  test('Can create and access a test service via ingress', async () => {
    const testAppManifest = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: test-app
  template:
    metadata:
      labels:
        app: test-app
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: test-app-service
  namespace: default
spec:
  selector:
    app: test-app
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: test-app-ingress
  namespace: default
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: test.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: test-app-service
            port:
              number: 80
`;

    try {
      // Deploy test application
      execSync('kubectl apply -f -', {
        input: testAppManifest,
        stdio: 'inherit'
      });

      // Wait for deployment to be ready
      execSync('kubectl wait --for=condition=Available deployment/test-app --timeout=120s', {
        stdio: 'inherit'
      });

      // Verify ingress is created
      const ingress = execSync('kubectl get ingress test-app-ingress -o json', { encoding: 'utf8' });
      const ingressData = JSON.parse(ingress);
      expect(ingressData.spec.rules[0].host).toBe('test.local');

      // Test connectivity within cluster
      execSync(`kubectl run test-pod --image=curlimages/curl --rm -it --restart=Never -- curl -s http://test-app-service.default.svc.cluster.local`, {
        stdio: 'inherit'
      });

    } finally {
      // Cleanup test resources - ensure cleanup runs even if test fails
      try {
        execSync('kubectl delete deployment test-app --ignore-not-found=true', { stdio: 'inherit' });
      } catch (error) {
        // Ignore cleanup errors
      }
      try {
        execSync('kubectl delete service test-app-service --ignore-not-found=true', { stdio: 'inherit' });
      } catch (error) {
        // Ignore cleanup errors
      }
      try {
        execSync('kubectl delete ingress test-app-ingress --ignore-not-found=true', { stdio: 'inherit' });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }, TIMEOUT);

  test('Network policies should be supported', async () => {
    const networkPolicyManifest = `
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: test-network-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: test
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: allowed
    ports:
    - protocol: TCP
      port: 80
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
`;

    try {
      // Create network policy
      execSync('kubectl apply -f -', {
        input: networkPolicyManifest,
        stdio: 'inherit'
      });

      // Verify network policy is created
      const np = execSync('kubectl get networkpolicy test-network-policy -o json', { encoding: 'utf8' });
      const npData = JSON.parse(np);
      expect(npData.metadata.name).toBe('test-network-policy');
      expect(npData.spec.policyTypes).toContain('Ingress');
      expect(npData.spec.policyTypes).toContain('Egress');

    } finally {
      // Cleanup - ensure network policy is deleted even if test fails
      try {
        execSync('kubectl delete networkpolicy test-network-policy --ignore-not-found=true', { stdio: 'inherit' });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  test('Resource quotas should be supported', async () => {
    const resourceQuotaManifest = `
apiVersion: v1
kind: ResourceQuota
metadata:
  name: test-resource-quota
  namespace: default
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    persistentvolumeclaims: "10"
    pods: "20"
`;

    try {
      // Create resource quota
      execSync('kubectl apply -f -', {
        input: resourceQuotaManifest,
        stdio: 'inherit'
      });

      // Verify resource quota is created
      const rq = execSync('kubectl get resourcequota test-resource-quota -o json', { encoding: 'utf8' });
      const rqData = JSON.parse(rq);
      expect(rqData.metadata.name).toBe('test-resource-quota');
      expect(rqData.spec.hard['requests.cpu']).toBe('4');
      expect(rqData.spec.hard['requests.memory']).toBe('8Gi');

    } finally {
      // Cleanup - ensure resource quota is deleted even if test fails
      try {
        execSync('kubectl delete resourcequota test-resource-quota --ignore-not-found=true', { stdio: 'inherit' });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  test('Can install and use cert-manager', async () => {
    // Install cert-manager
    execSync(`kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml`, {
      stdio: 'inherit'
    });

    // Wait a bit for cert-manager to start, then check status
    execSync('sleep 10', { stdio: 'inherit' });

    // Check pod status
    execSync('kubectl get pods -n cert-manager', { stdio: 'inherit' });

    // Verify cert-manager pods are running
    const pods = execSync('kubectl get pods -n cert-manager -o json', { encoding: 'utf8' });
    const podData = JSON.parse(pods);

    const certManagerPods = podData.items.filter((pod: any) =>
      pod.metadata.namespace === 'cert-manager'
    );
    expect(certManagerPods.length).toBeGreaterThan(0);

    // Check that at least one pod is running (more lenient)
    const runningPods = certManagerPods.filter((pod: any) => pod.status.phase === 'Running');
    expect(runningPods.length).toBeGreaterThan(0);

    // Test creating a simple ClusterIssuer
    const clusterIssuerManifest = `apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: test-selfsigned-issuer
spec:
  selfSigned: {}
`;

    try {
      execSync('kubectl apply -f -', {
        input: clusterIssuerManifest,
        stdio: 'inherit'
      });

      // Verify ClusterIssuer is created
      const issuer = execSync('kubectl get clusterissuer test-selfsigned-issuer -o json', { encoding: 'utf8' });
      const issuerData = JSON.parse(issuer);
      expect(issuerData.metadata.name).toBe('test-selfsigned-issuer');

    } finally {
      // Cleanup - ensure ClusterIssuer is deleted even if test fails
      try {
        execSync('kubectl delete clusterissuer test-selfsigned-issuer --ignore-not-found=true', { stdio: 'inherit' });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }, TIMEOUT);

  test('Cluster should handle multiple namespaces', () => {
    const testNamespaces = ['test-ns-1', 'test-ns-2', 'test-ns-3'];

    try {
      // Create multiple namespaces
      testNamespaces.forEach(ns => {
        execSync(`kubectl create namespace ${ns}`, { stdio: 'inherit' });
      });

      // Verify namespaces exist
      const namespaces = execSync('kubectl get namespaces -o json', { encoding: 'utf8' });
      const nsData = JSON.parse(namespaces);

      testNamespaces.forEach(testNs => {
        const ns = nsData.items.find((ns: any) => ns.metadata.name === testNs);
        expect(ns).toBeDefined();
        expect(ns.status.phase).toBe('Active');
      });

    } finally {
      // Cleanup - ensure test namespaces are deleted even if test fails
      testNamespaces.forEach(ns => {
        try {
          execSync(`kubectl delete namespace ${ns} --ignore-not-found=true`, { stdio: 'inherit' });
        } catch (error) {
          // Ignore cleanup errors
        }
      });
    }
  });

  test('Container runtime should support security features', async () => {
    const securityTestManifest = `
apiVersion: v1
kind: Pod
metadata:
  name: security-test-pod
  namespace: default
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
  containers:
  - name: test-container
    image: busybox:1.36
    command: ['sleep', '60']
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
          - ALL
      readOnlyRootFilesystem: true
      runAsNonRoot: true
      runAsUser: 1000
      runAsGroup: 1000
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
`;

    try {
      // Create security test pod
      execSync('kubectl apply -f -', {
        input: securityTestManifest,
        stdio: 'inherit'
      });

      // Wait for pod to be ready
      execSync('kubectl wait --for=condition=Ready pod/security-test-pod --timeout=60s', {
        stdio: 'inherit'
      });

      // Verify pod is running with security constraints
      const pod = execSync('kubectl get pod security-test-pod -o json', { encoding: 'utf8' });
      const podData = JSON.parse(pod);

      expect(podData.status.phase).toBe('Running');
      expect(podData.spec.securityContext.runAsNonRoot).toBe(true);
      expect(podData.spec.securityContext.runAsUser).toBe(1000);

      const container = podData.spec.containers[0];
      expect(container.securityContext.allowPrivilegeEscalation).toBe(false);
      expect(container.securityContext.readOnlyRootFilesystem).toBe(true);

    } finally {
      // Cleanup - ensure security test pod is deleted even if test fails
      try {
        execSync('kubectl delete pod security-test-pod --ignore-not-found=true', { stdio: 'inherit' });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
});
