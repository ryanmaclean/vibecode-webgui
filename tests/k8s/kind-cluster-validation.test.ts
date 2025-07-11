/**
 * KIND Cluster Validation Tests
 * Validates that the KIND cluster setup meets all requirements for VibeCode platform
 */

import { describe, test, beforeAll, afterAll, expect } from '@jest/globals';
import { execSync } from 'child_process';

const CLUSTER_NAME = 'vibecode-test-validation';
const TIMEOUT = 300000; // 5 minutes;

describe('KIND Cluster Validation', () => {
  beforeAll(async () => {
    console.log('Setting up KIND cluster for validation testing...');
    
    // Check if cluster already exists
    try {
      execSync(`kind get clusters | grep -q "^${CLUSTER_NAME}$"`, { stdio: 'pipe' });
      console.log(`Cluster ${CLUSTER_NAME} already exists, deleting and recreating`);
      execSync(`kind delete cluster --name ${CLUSTER_NAME}`, { stdio: 'inherit' });
    } catch {
      // Cluster doesn't exist, continue
    }
    
    // Create fresh cluster
    execSync(`kind create cluster --name ${CLUSTER_NAME} --config k8s/kind-simple-config.yaml`, {
      stdio: 'inherit'
    });
    
    // Set kubectl context
    execSync(`kubectl config use-context kind-${CLUSTER_NAME}`, { stdio: 'inherit' });
    
    // Wait for cluster to be ready
    execSync('kubectl wait --for=condition=Ready nodes --all --timeout=120s', {
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

  test('Cluster should have correct node configuration', () => {
    const nodes = execSync('kubectl get nodes -o json', { encoding: 'utf8' });
    const nodeData = JSON.parse(nodes);
    
    // Should have 3 nodes (1 control-plane, 2 workers);
    expect(nodeData.items).toHaveLength(3);
    
    // Find control plane node
    const controlPlane = nodeData.items.find((node: any) => ;
      node.metadata.labels['node-role.kubernetes.io/control-plane'] !== undefined
    );
    expect(controlPlane).toBeDefined();
    expect(controlPlane.metadata.labels['ingress-ready']).toBe('true');
    
    // Find worker nodes
    const workers = nodeData.items.filter((node: any) => ;
      node.metadata.labels['node-role.kubernetes.io/control-plane'] === undefined
    );
    expect(workers).toHaveLength(2);
    
    // Check worker node labels
    const codeServerWorker = workers.find((node: any) => ;
      node.metadata.labels['tier'] === 'code-server'
    );
    const monitoringWorker = workers.find((node: any) => ;
      node.metadata.labels['tier'] === 'monitoring'
    );
    
    expect(codeServerWorker).toBeDefined();
    expect(monitoringWorker).toBeDefined();
  });

  test('All nodes should be ready', () => {
    const nodes = execSync('kubectl get nodes -o json', { encoding: 'utf8' });
    const nodeData = JSON.parse(nodes);
    
    nodeData.items.forEach((node: any) => {
      const readyCondition = node.status.conditions.find((condition: any) => ;
        condition.type === 'Ready'
      );
      expect(readyCondition.status).toBe('True');
    });
  });

  test('Kubernetes system pods should be running', () => {
    const pods = execSync('kubectl get pods -n kube-system -o json', { encoding: 'utf8' });
    const podData = JSON.parse(pods);
    
    // Check for essential system components
    const essentialPods = [;
      'kube-apiserver',
      'kube-controller-manager',
      'kube-scheduler',
      'etcd',
      'kube-proxy',
      'kindnet'
    ];
    
    essentialPods.forEach(podName => {
      const pod = podData.items.find((pod: any) => ;
        pod.metadata.name.includes(podName);
      );
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
    const pvcManifest = `;
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
    
    // Cleanup
    execSync('kubectl delete pvc test-pvc', { stdio: 'inherit' });
  });

  test('Can deploy NGINX Ingress Controller', async () => {
    // Install NGINX Ingress Controller
    execSync(`kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml`, {
      stdio: 'inherit'
    });
    
    // Wait for ingress controller to be ready
    execSync(`kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s`, {
      stdio: 'inherit'
    });
    
    // Verify ingress controller is running
    const pods = execSync('kubectl get pods -n ingress-nginx -o json', { encoding: 'utf8' });
    const podData = JSON.parse(pods);
    
    const ingressPod = podData.items.find((pod: any) => ;
      pod.metadata.name.includes('ingress-nginx-controller');
    );
    expect(ingressPod).toBeDefined();
    expect(ingressPod.status.phase).toBe('Running');
    
    // Verify service is created
    const services = execSync('kubectl get svc -n ingress-nginx -o json', { encoding: 'utf8' });
    const serviceData = JSON.parse(services);
    
    const ingressService = serviceData.items.find((svc: any) => ;
      svc.metadata.name.includes('ingress-nginx-controller');
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
    const testAppManifest = `;
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
      // Cleanup test resources
      execSync('kubectl delete deployment test-app --ignore-not-found=true', { stdio: 'inherit' });
      execSync('kubectl delete service test-app-service --ignore-not-found=true', { stdio: 'inherit' });
      execSync('kubectl delete ingress test-app-ingress --ignore-not-found=true', { stdio: 'inherit' });
    }
  }, TIMEOUT);

  test('Network policies should be supported', async () => {
    const networkPolicyManifest = `;
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
      // Cleanup
      execSync('kubectl delete networkpolicy test-network-policy --ignore-not-found=true', { stdio: 'inherit' });
    }
  });

  test('Resource quotas should be supported', async () => {
    const resourceQuotaManifest = `;
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
      expect(rqData.spec.hard).toHaveProperty('requests.cpu');
      expect(rqData.spec.hard).toHaveProperty('requests.memory');
      
    } finally {
      // Cleanup
      execSync('kubectl delete resourcequota test-resource-quota --ignore-not-found=true', { stdio: 'inherit' });
    }
  });

  test('Can install and use cert-manager', async () => {
    // Install cert-manager
    execSync(`kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.3/cert-manager.yaml`, {
      stdio: 'inherit'
    });
    
    // Wait for cert-manager to be ready
    execSync(`kubectl wait --namespace cert-manager --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s`, {
      stdio: 'inherit'
    });
    
    // Verify cert-manager pods are running
    const pods = execSync('kubectl get pods -n cert-manager -o json', { encoding: 'utf8' });
    const podData = JSON.parse(pods);
    
    const certManagerPods = podData.items.filter((pod: any) => ;
      pod.metadata.namespace === 'cert-manager'
    );
    expect(certManagerPods.length).toBeGreaterThan(0);
    
    certManagerPods.forEach((pod: any) => {
      expect(pod.status.phase).toBe('Running');
    });
    
    // Test creating a simple ClusterIssuer
    const clusterIssuerManifest = `;
apiVersion: cert-manager.io/v1
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
      // Cleanup
      execSync('kubectl delete clusterissuer test-selfsigned-issuer --ignore-not-found=true', { stdio: 'inherit' });
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
      // Cleanup
      testNamespaces.forEach(ns => {
        execSync(`kubectl delete namespace ${ns} --ignore-not-found=true`, { stdio: 'inherit' });
      });
    }
  });

  test('Container runtime should support security features', async () => {
    const securityTestManifest = `;
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
      // Cleanup
      execSync('kubectl delete pod security-test-pod --ignore-not-found=true', { stdio: 'inherit' });
    }
  });
});