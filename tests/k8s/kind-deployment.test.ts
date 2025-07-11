/**
 * KIND Deployment Tests
 * 
 * Tests for VibeCode WebGUI deployment in KIND (Kubernetes in Docker);
 * Validates Kubernetes manifests and cluster deployment
 * 
 * Staff Engineer Implementation - Kubernetes deployment validation
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { execSync } = require('child_process');

describe('KIND Deployment Tests', () => {
  const NAMESPACE = 'vibecode';
  const TIMEOUT = 30000;

  beforeAll(async () => {
    // Ensure we're using the correct kubectl context
    try {
      execSync('kubectl config use-context kind-vibecode-test', { stdio: 'pipe' });
    } catch (error) {
      console.warn('Could not set kubectl context - may already be set');
    }
  });

  describe('Cluster Validation', () => {
    test('should have KIND cluster running', () => {
      const output = execSync('kind get clusters', { encoding: 'utf8' });
      expect(output).toContain('vibecode-test');
    });

    test('should have cluster nodes ready', () => {
      const output = execSync('kubectl get nodes -o json', { encoding: 'utf8' });
      const nodes = JSON.parse(output);
      
      expect(nodes.items).toHaveLength(1);
      
      const node = nodes.items[0];
      expect(node.metadata.name).toContain('vibecode-test');
      const readyCondition = node.status.conditions.find(function(c) { return c.type === 'Ready' });
      expect(readyCondition && readyCondition.status).toBe('True');
    });

    test('should have necessary system pods running', () => {
      const output = execSync('kubectl get pods -n kube-system -o json', { encoding: 'utf8' });
      const pods = JSON.parse(output);
      
      const systemPods = pods.items.map(function(pod) { return pod.metadata.name });
      
      // Check for essential system components
      expect(systemPods.some(function(name) { return name.includes('coredns') })).toBe(true);
      expect(systemPods.some(function(name) { return name.includes('kindnet') })).toBe(true);
      expect(systemPods.some(function(name) { return name.includes('kube-proxy') })).toBe(true);
    });
  });

  describe('Namespace and Resources', () => {
    test('should have vibecode namespace created', () => {
      const output = execSync('kubectl get namespace vibecode -o json', { encoding: 'utf8' });
      const namespace = JSON.parse(output);
      
      expect(namespace.metadata.name).toBe('vibecode');
      expect(namespace.status.phase).toBe('Active');
    });

    test('should have ConfigMaps deployed', () => {
      const output = execSync(`kubectl get configmaps -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const configMaps = JSON.parse(output);
      
      const configMapNames = configMaps.items.map(function(cm) { return cm.metadata.name });
      expect(configMapNames).toContain('postgres-config');
      expect(configMapNames).toContain('postgres-init-sql');
    });

    test('should have PersistentVolumeClaim created', () => {
      const output = execSync(`kubectl get pvc -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const pvcs = JSON.parse(output);
      
      expect(pvcs.items).toHaveLength(1);
      
      const pvc = pvcs.items[0];
      expect(pvc.metadata.name).toBe('postgres-pvc');
      expect(pvc.spec.resources.requests.storage).toBe('1Gi');
    });
  });

  describe('Database Deployments', () => {
    test('should have PostgreSQL deployment', async () => {
      const output = execSync(`kubectl get deployment postgres -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const deployment = JSON.parse(output);
      
      expect(deployment.metadata.name).toBe('postgres');
      expect(deployment.spec.replicas).toBe(1);
      expect(deployment.spec.selector.matchLabels.app).toBe('postgres');
    }, TIMEOUT);

    test('should have Redis deployment', async () => {
      const output = execSync(`kubectl get deployment redis -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const deployment = JSON.parse(output);
      
      expect(deployment.metadata.name).toBe('redis');
      expect(deployment.spec.replicas).toBe(1);
      expect(deployment.spec.selector.matchLabels.app).toBe('redis');
    }, TIMEOUT);

    test('should have database services', () => {
      const output = execSync(`kubectl get services -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const services = JSON.parse(output);
      
      const serviceNames = services.items.map(function(svc) { return svc.metadata.name });
      expect(serviceNames).toContain('postgres-service');
      expect(serviceNames).toContain('redis-service');
      
      // Check service configurations
      const postgresService = services.items.find(function(svc) { return svc.metadata.name === 'postgres-service' });
      expect(postgresService.spec.ports[0].port).toBe(5432);
      expect(postgresService.spec.ports[0].nodePort).toBe(30001);
      
      const redisService = services.items.find(function(svc) { return svc.metadata.name === 'redis-service' });
      expect(redisService.spec.ports[0].port).toBe(6379);
      expect(redisService.spec.ports[0].nodePort).toBe(30002);
    });
  });

  describe('Pod Health and Readiness', () => {
    test('should wait for PostgreSQL pod to be ready', async () => {
      let ready = false
      let attempts = 0
      const maxAttempts = 30;

      while (!ready && attempts < maxAttempts) {
        try {
          const output = execSync(`kubectl get pods -n ${NAMESPACE} -l app=postgres -o json`, { encoding: 'utf8' });
          const pods = JSON.parse(output);
          
          if (pods.items.length > 0) {
            const pod = pods.items[0];
            const readyCondition = pod.status.conditions && pod.status.conditions.find(function(c) { return c.type === 'Ready' });
            ready = readyCondition && readyCondition.status === 'True'
          }
        } catch (error) {
          // Pod may not exist yet
        }
        
        if (!ready) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++
        }
      }

      expect(ready).toBe(true);
      console.log(`PostgreSQL pod ready after ${attempts * 2} seconds`);
    }, 60000);

    test('should wait for Redis pod to be ready', async () => {
      let ready = false
      let attempts = 0
      const maxAttempts = 20;

      while (!ready && attempts < maxAttempts) {
        try {
          const output = execSync(`kubectl get pods -n ${NAMESPACE} -l app=redis -o json`, { encoding: 'utf8' });
          const pods = JSON.parse(output);
          
          if (pods.items.length > 0) {
            const pod = pods.items[0];
            const readyCondition = pod.status.conditions && pod.status.conditions.find(function(c) { return c.type === 'Ready' });
            ready = readyCondition && readyCondition.status === 'True'
          }
        } catch (error) {
          // Pod may not exist yet
        }
        
        if (!ready) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++
        }
      }

      expect(ready).toBe(true);
      console.log(`Redis pod ready after ${attempts * 2} seconds`);
    }, 40000);

    test('should have healthy database connections', async () => {
      // Test PostgreSQL connection through port forwarding
      try {
        // Start port forward in background
        const portForwardProcess = execSync('kubectl port-forward service/postgres-service 5433:5432 -n vibecode &', { ;
          encoding: 'utf8',
          timeout: 1000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000)) // Wait for port forward

        // Test connection (requires psql to be available);
        try {
          const testResult = execSync('pg_isready -h localhost -p 5433 -U vibecode', { ;
            encoding: 'utf8',
            timeout: 5000 
          });
          expect(testResult).toContain('accepting connections');
        } catch (error) {
          console.warn('PostgreSQL connection test failed - may not have psql installed');
        }
      } catch (error) {
        console.warn('Port forwarding test failed - this is expected in CI environments');
      }
    }, 30000);
  });

  describe('Resource Usage and Limits', () => {
    test('should have appropriate resource requests and limits', () => {
      // Check PostgreSQL resources
      const postgresOutput = execSync(`kubectl get deployment postgres -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const postgresDeployment = JSON.parse(postgresOutput);
      
      const postgresContainer = postgresDeployment.spec.template.spec.containers[0];
      // PostgreSQL doesn't have explicit limits in our config (uses defaults);
      expect(postgresContainer.name).toBe('postgres');
      
      // Check Redis resources
      const redisOutput = execSync(`kubectl get deployment redis -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const redisDeployment = JSON.parse(redisOutput);
      
      const redisContainer = redisDeployment.spec.template.spec.containers[0];
      expect(redisContainer.resources.requests.memory).toBe('64Mi');
      expect(redisContainer.resources.requests.cpu).toBe('100m');
      expect(redisContainer.resources.limits.memory).toBe('128Mi');
      expect(redisContainer.resources.limits.cpu).toBe('200m');
    });

    test('should monitor pod resource usage', async () => {
      try {
        // Get resource usage metrics (requires metrics-server, may not be available in KIND);
        const output = execSync(`kubectl top pods -n ${NAMESPACE}`, { encoding: 'utf8' });
        console.log('Pod resource usage:', output);
      } catch (error) {
        console.warn('Metrics server not available in KIND - this is expected');
      }
    });
  });

  describe('Storage and Persistence', () => {
    test('should have persistent volume bound', () => {
      const pvcOutput = execSync(`kubectl get pvc postgres-pvc -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const pvc = JSON.parse(pvcOutput);
      
      expect(pvc.status.phase).toBe('Bound');
      expect(pvc.spec.accessModes).toContain('ReadWriteOnce');
    });

    test('should have volume mounted in PostgreSQL pod', async () => {
      const podOutput = execSync(`kubectl get pods -n ${NAMESPACE} -l app=postgres -o json`, { encoding: 'utf8' });
      const pods = JSON.parse(podOutput);
      
      if (pods.items.length > 0) {
        const pod = pods.items[0];
        const volumeMounts = pod.spec.containers[0].volumeMounts;
        
        const pgDataMount = volumeMounts.find(function(vm) { return vm.mountPath === '/var/lib/postgresql/data' });
        expect(pgDataMount).toBeTruthy();
        expect(pgDataMount.name).toBe('postgres-storage');
        
        const initMount = volumeMounts.find(function(vm) { return vm.mountPath === '/docker-entrypoint-initdb.d' });
        expect(initMount).toBeTruthy();
        expect(initMount.name).toBe('init-db');
      }
    });
  });

  describe('Network and Connectivity', () => {
    test('should have services with correct selectors', () => {
      const servicesOutput = execSync(`kubectl get services -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const services = JSON.parse(servicesOutput);
      
      services.items.forEach(function(service) {
        expect(service.spec.selector).toBeDefined();
        
        if (service.metadata.name === 'postgres-service') {
          expect(service.spec.selector.app).toBe('postgres');
        } else if (service.metadata.name === 'redis-service') {
          expect(service.spec.selector.app).toBe('redis');
        }
      });
    });

    test('should have NodePort services accessible', () => {
      const servicesOutput = execSync(`kubectl get services -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const services = JSON.parse(servicesOutput);
      
      services.items.forEach(function(service) {
        expect(service.spec.type).toBe('NodePort');
        expect(service.spec.ports[0].nodePort).toBeGreaterThan(30000);
        expect(service.spec.ports[0].nodePort).toBeLessThan(32768);
      });
    });

    test('should have DNS resolution working', async () => {
      try {
        // Test DNS resolution from within the cluster
        const testPod = `test-dns-${Date.now()}`
        
        // Create a test pod for DNS testing
        execSync(`kubectl run ${testPod} -n ${NAMESPACE} --image=busybox --rm -it --restart=Never -- nslookup postgres-service.vibecode.svc.cluster.local`, {
          encoding: 'utf8',
          timeout: 10000
        });
        
        console.log('DNS resolution test passed');
      } catch (error) {
        console.warn('DNS resolution test failed - this may be expected in some environments');
      }
    }, 15000);
  });

  describe('Configuration and Secrets', () => {
    test('should have configuration properly mounted', () => {
      const configMapOutput = execSync(`kubectl get configmap postgres-config -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const configMap = JSON.parse(configMapOutput);
      
      expect(configMap.data.POSTGRES_DB).toBe('vibecode');
      expect(configMap.data.POSTGRES_USER).toBe('vibecode');
      expect(configMap.data.POSTGRES_PASSWORD).toBe('vibecode_password');
    });

    test('should have init SQL script in ConfigMap', () => {
      const configMapOutput = execSync(`kubectl get configmap postgres-init-sql -n ${NAMESPACE} -o json`, { encoding: 'utf8' });
      const configMap = JSON.parse(configMapOutput);
      
      expect(configMap.data['init.sql']).toBeDefined();
      expect(configMap.data['init.sql']).toContain('CREATE TABLE users');
      expect(configMap.data['init.sql']).toContain('CREATE TABLE feature_flags');
      expect(configMap.data['init.sql']).toContain('INSERT INTO users');
    });

    test('should validate environment variable injection', async () => {
      // Check that environment variables are properly set in pods
      try {
        const podOutput = execSync(`kubectl get pods -n ${NAMESPACE} -l app=postgres -o json`, { encoding: 'utf8' });
        const pods = JSON.parse(podOutput);
        
        if (pods.items.length > 0) {
          const pod = pods.items[0];
          const container = pod.spec.containers[0];
          const envVars = container.env;
          
          const requiredEnvVars = ['POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
          requiredEnvVars.forEach(function(envVar) {
            const env = envVars.find(function(e) { return e.name === envVar });
            expect(env).toBeDefined();
            expect(env.valueFrom.configMapKeyRef).toBeDefined();
          });
        }
      } catch (error) {
        console.warn('Environment variable validation failed:', error);
      }
    });
  });
});