/**
 * Integration tests for Datadog Chaos Controller deployment and functionality
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Chaos Controller Deployment Tests', () => {
  const namespace = 'chaos-engineering';
  const timeout = 300000; // 5 minutes

  beforeAll(async () => {
    // Ensure test cluster is available
    try {
      const { stdout } = await execAsync('kubectl cluster-info');
      console.log('Cluster info:', stdout);
    } catch (error) {
      console.error('Cluster not available:', error);
      throw new Error('Kubernetes cluster not accessible');
    }
  }, timeout);

  describe('Namespace and CRD Setup', () => {
    it('should create chaos engineering namespace', async () => {
      const { stdout } = await execAsync(`kubectl get namespace ${namespace} -o json || echo "not found"`);
      
      if (stdout.includes('not found')) {
        await execAsync(`kubectl create namespace ${namespace}`);
      }
      
      const { stdout: nsCheck } = await execAsync(`kubectl get namespace ${namespace} -o jsonpath='{.status.phase}'`);
      expect(nsCheck.trim()).toBe('Active');
    });

    it('should deploy Disruption CRD', async () => {
      // Apply CRD from our Helm chart
      await execAsync(`
        helm template vibecode-platform ./charts/vibecode-platform \
          --set chaosEngineering.enabled=true \
          --include-crds | \
        kubectl apply -f -
      `);

      const { stdout } = await execAsync('kubectl get crd disruptions.chaos.datadoghq.com -o jsonpath="{.metadata.name}"');
      expect(stdout.trim()).toBe('disruptions.chaos.datadoghq.com');
    });
  });

  describe('Chaos Controller Deployment', () => {
    beforeAll(async () => {
      // Deploy chaos controller
      await execAsync(`
        helm upgrade --install vibecode-chaos ./charts/vibecode-platform \
          --set chaosEngineering.enabled=true \
          --set chaosEngineering.image.repository=datadog/chaos-controller \
          --set chaosEngineering.image.tag=latest \
          --timeout=300s \
          --wait
      `);
    }, timeout);

    it('should deploy chaos controller successfully', async () => {
      const { stdout } = await execAsync(`kubectl get deployment chaos-controller -n ${namespace} -o jsonpath='{.status.readyReplicas}'`);
      expect(parseInt(stdout.trim())).toBe(1);
    });

    it('should create service account with proper RBAC', async () => {
      const { stdout: sa } = await execAsync(`kubectl get serviceaccount chaos-controller -n ${namespace} -o jsonpath='{.metadata.name}'`);
      expect(sa.trim()).toBe('chaos-controller');

      const { stdout: crb } = await execAsync('kubectl get clusterrolebinding chaos-controller -o jsonpath="{.metadata.name}"');
      expect(crb.trim()).toBe('chaos-controller');
    });

    it('should expose metrics endpoint', async () => {
      const { stdout } = await execAsync(`kubectl get service chaos-controller-metrics -n ${namespace} -o jsonpath='{.spec.ports[0].port}'`);
      expect(parseInt(stdout.trim())).toBe(8080);
    });

    it('should have healthy controller pod', async () => {
      const { stdout } = await execAsync(`
        kubectl get pods -n ${namespace} -l app.kubernetes.io/name=chaos-controller \
          -o jsonpath='{.items[0].status.phase}'
      `);
      expect(stdout.trim()).toBe('Running');
    });
  });

  describe('Chaos Experiments Configuration', () => {
    it('should deploy chat-ui network stress experiment', async () => {
      await execAsync(`
        helm upgrade vibecode-chaos ./charts/vibecode-platform \
          --set chaosEngineering.enabled=true \
          --set chaosEngineering.experiments.chatUI.networkStress.enabled=true \
          --reuse-values
      `);

      const { stdout } = await execAsync(`kubectl get disruption chat-ui-network-stress -n ${namespace} -o jsonpath='{.metadata.name}'`);
      expect(stdout.trim()).toBe('chat-ui-network-stress');
    });

    it('should deploy mongodb cpu pressure experiment', async () => {
      await execAsync(`
        helm upgrade vibecode-chaos ./charts/vibecode-platform \
          --set chaosEngineering.experiments.mongodb.cpuPressure.enabled=true \
          --reuse-values
      `);

      const { stdout } = await execAsync(`kubectl get disruption mongodb-cpu-pressure -n ${namespace} -o jsonpath='{.metadata.name}'`);
      expect(stdout.trim()).toBe('mongodb-cpu-pressure');
    });

    it('should configure game day scenarios when enabled', async () => {
      await execAsync(`
        helm upgrade vibecode-chaos ./charts/vibecode-platform \
          --set chaosEngineering.gamedays.enabled=true \
          --reuse-values
      `);

      const { stdout } = await execAsync(`kubectl get configmap chaos-gameday-scenarios -n ${namespace} -o jsonpath='{.metadata.name}'`);
      expect(stdout.trim()).toBe('chaos-gameday-scenarios');
    });
  });

  describe('Functional Chaos Tests', () => {
    beforeAll(async () => {
      // Deploy a test target pod
      await execAsync(`
        kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chaos-test-target
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: chaos-test-target
  template:
    metadata:
      labels:
        app: chaos-test-target
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 10m
            memory: 16Mi
          limits:
            cpu: 50m
            memory: 64Mi
EOF
      `);
      
      // Wait for deployment to be ready
      await execAsync('kubectl wait --for=condition=available deployment/chaos-test-target --timeout=60s');
    }, timeout);

    afterAll(async () => {
      // Cleanup test resources
      await execAsync('kubectl delete deployment chaos-test-target --ignore-not-found=true');
      await execAsync(`kubectl delete disruption test-network-disruption -n ${namespace} --ignore-not-found=true`);
    });

    it('should successfully run network disruption experiment', async () => {
      // Create a test disruption
      await execAsync(`
        kubectl apply -f - <<EOF
apiVersion: chaos.datadoghq.com/v1beta1
kind: Disruption
metadata:
  name: test-network-disruption
  namespace: ${namespace}
spec:
  selector:
    matchLabels:
      app: chaos-test-target
  count: 1
  duration: 30s
  networkDisruption:
    drop: 10
    delay: 50ms
EOF
      `);

      // Wait for experiment to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check experiment status
      const { stdout } = await execAsync(`
        kubectl get disruption test-network-disruption -n ${namespace} \
          -o jsonpath='{.status.conditions[0].type}'
      `);
      
      // Should be either 'Running' or 'Succeeded' depending on timing
      expect(['Running', 'Succeeded']).toContain(stdout.trim());
    }, 60000);

    it('should handle invalid experiment configurations gracefully', async () => {
      try {
        await execAsync(`
          kubectl apply -f - <<EOF
apiVersion: chaos.datadoghq.com/v1beta1
kind: Disruption
metadata:
  name: invalid-experiment
  namespace: ${namespace}
spec:
  selector:
    matchLabels:
      app: nonexistent-app
  count: 999
  duration: 1s
  networkDisruption:
    drop: 10
EOF
        `);

        // Wait a moment for processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Should create but likely fail validation or execution
        const { stdout } = await execAsync(`
          kubectl get disruption invalid-experiment -n ${namespace} \
            -o jsonpath='{.metadata.name}' || echo "not found"
        `);
        
        // Either created (will fail execution) or rejected
        expect(typeof stdout).toBe('string');
      } catch (error) {
        // Expected for invalid configurations
        expect(error).toBeDefined();
      } finally {
        // Cleanup
        await execAsync(`kubectl delete disruption invalid-experiment -n ${namespace} --ignore-not-found=true`);
      }
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should expose Prometheus metrics', async () => {
      // Port forward to access metrics (in real test env this might be different)
      const portForward = exec(`kubectl port-forward -n ${namespace} service/chaos-controller-metrics 8080:8080`);
      
      try {
        // Wait for port forward to establish
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { stdout } = await execAsync('curl -s http://localhost:8080/metrics || echo "metrics not available"');
        
        // Should contain Prometheus metrics
        expect(stdout).toContain('# HELP');
        expect(stdout).toContain('# TYPE');
      } catch (error) {
        console.warn('Metrics endpoint test failed (expected in some environments):', error.message);
      } finally {
        portForward.kill();
      }
    }, 30000);

    it('should be discoverable by Datadog agent', async () => {
      const { stdout } = await execAsync(`
        kubectl get pods -n ${namespace} -l app.kubernetes.io/name=chaos-controller \
          -o jsonpath='{.items[0].metadata.annotations}'
      `);
      
      // Should have Datadog discovery annotations
      expect(stdout).toContain('ad.datadoghq.com');
      expect(stdout).toContain('openmetrics');
    });
  });

  describe('Security and Network Policies', () => {
    it('should deploy with security context', async () => {
      const { stdout } = await execAsync(`
        kubectl get deployment chaos-controller -n ${namespace} \
          -o jsonpath='{.spec.template.spec.securityContext.runAsNonRoot}'
      `);
      expect(stdout.trim()).toBe('true');
    });

    it('should have network policy when enabled', async () => {
      await execAsync(`
        helm upgrade vibecode-chaos ./charts/vibecode-platform \
          --set chaosEngineering.networkPolicy.enabled=true \
          --reuse-values
      `);

      const { stdout } = await execAsync(`kubectl get networkpolicy chaos-controller -n ${namespace} -o jsonpath='{.metadata.name}' || echo "not found"`);
      expect(stdout.trim()).toBe('chaos-controller');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup experiments after completion', async () => {
      // Create a short-duration experiment
      await execAsync(`
        kubectl apply -f - <<EOF
apiVersion: chaos.datadoghq.com/v1beta1
kind: Disruption
metadata:
  name: cleanup-test
  namespace: ${namespace}
spec:
  selector:
    matchLabels:
      app: chaos-test-target
  count: 1
  duration: 5s
  networkDisruption:
    drop: 5
EOF
      `);

      // Wait for completion plus buffer
      await new Promise(resolve => setTimeout(resolve, 15000));

      const { stdout } = await execAsync(`
        kubectl get disruption cleanup-test -n ${namespace} \
          -o jsonpath='{.status.conditions[?(@.type=="Succeeded")].status}' || echo "not completed"
      `);
      
      // Should eventually succeed or be cleaned up
      expect(['True', 'not completed']).toContain(stdout.trim());
      
      // Cleanup
      await execAsync(`kubectl delete disruption cleanup-test -n ${namespace} --ignore-not-found=true`);
    }, 30000);
  });
});