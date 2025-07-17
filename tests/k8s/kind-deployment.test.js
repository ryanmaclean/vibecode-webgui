/**
 * Kubernetes deployment tests for KIND cluster
 */
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

describe('KIND Deployment Tests', () => {
  const CLUSTER_NAME = 'vibecode-test'
  const NAMESPACE = 'vibecode-webgui'
  const timeout = 120000 // 2 minutes

  beforeAll(async () => {
    console.log('Setting up KIND cluster for testing...')

    try {
      // Create KIND cluster if it doesn't exist
      await execAsync(`kind get clusters | grep ${CLUSTER_NAME} || kind create cluster --name ${CLUSTER_NAME}`)

      // Set kubectl context
      await execAsync(`kubectl config use-context kind-${CLUSTER_NAME}`)

      console.log('KIND cluster ready for testing')
    } catch (error) {
      console.error('Failed to set up KIND cluster:', error)
      throw error
    }
  }, timeout)

  afterAll(async () => {
    console.log('Cleaning up test cluster...')

    try {
      // Clean up namespace
      await execAsync(`kubectl delete namespace ${NAMESPACE} --ignore-not-found=true`)

      // Optionally delete the cluster (comment out to keep for debugging)
      // await execAsync(`kind delete cluster --name ${CLUSTER_NAME}`)
    } catch (error) {
      console.warn('Cleanup warning:', error.message)
    }
  }, timeout)

  describe('Cluster Health', () => {
    it('should have a healthy cluster', async () => {
      const { stdout } = await execAsync('kubectl get nodes')
      expect(stdout).toContain('Ready')
    })

    it('should have required system pods running', async () => {
      const { stdout } = await execAsync('kubectl get pods -n kube-system')
      expect(stdout).toContain('Running')
    })
  })

  describe('Namespace Creation', () => {
    it('should create namespace successfully', async () => {
      await execAsync(`kubectl apply -f infrastructure/kubernetes/namespace.yaml`)

      const { stdout } = await execAsync(`kubectl get namespace ${NAMESPACE}`)
      expect(stdout).toContain(NAMESPACE)
    })

    it('should have resource quotas applied', async () => {
      const { stdout } = await execAsync(`kubectl get resourcequota -n ${NAMESPACE}`)
      expect(stdout).toContain('vibecode-quota')
    })

    it('should have limit ranges applied', async () => {
      const { stdout } = await execAsync(`kubectl get limitrange -n ${NAMESPACE}`)
      expect(stdout).toContain('vibecode-limits')
    })
  })

  describe('Storage Resources', () => {
    it('should create persistent volume claims', async () => {
      await execAsync(`kubectl apply -f infrastructure/kubernetes/storage.yaml`)

      const { stdout } = await execAsync(`kubectl get pvc -n ${NAMESPACE}`)
      expect(stdout).toContain('workspace-pvc')
      expect(stdout).toContain('config-pvc')
      expect(stdout).toContain('postgres-pvc')
      expect(stdout).toContain('redis-pvc')
    })

    it('should have PVCs bound', async () => {
      // Wait for PVCs to be bound
      await execAsync(`kubectl wait --for=condition=Bound pvc --all -n ${NAMESPACE} --timeout=60s`)

      const { stdout } = await execAsync(`kubectl get pvc -n ${NAMESPACE}`)
      expect(stdout).toContain('Bound')
    }, 70000)
  })

  describe('Application Deployment', () => {
    beforeAll(async () => {
      // Create secrets for testing
      await execAsync(`
        kubectl create secret generic code-server-secrets \\
          --from-literal=password=test123 \\
          --namespace=${NAMESPACE} \\
          --dry-run=client -o yaml | kubectl apply -f -
      `)

      await execAsync(`
        kubectl create secret generic postgres-secrets \\
          --from-literal=POSTGRES_USER=testuser \\
          --from-literal=POSTGRES_PASSWORD=testpass \\
          --from-literal=POSTGRES_DB=testdb \\
          --namespace=${NAMESPACE} \\
          --dry-run=client -o yaml | kubectl apply -f -
      `)

      await execAsync(`
        kubectl create secret generic app-secrets \\
          --from-literal=NEXTAUTH_SECRET=test-secret \\
          --from-literal=DATABASE_URL=postgresql://testuser:testpass@postgres-service:5432/testdb \\
          --from-literal=REDIS_URL=redis://redis-service:6379 \\
          --namespace=${NAMESPACE} \\
          --dry-run=client -o yaml | kubectl apply -f -
      `)
    })

    it('should deploy code-server successfully', async () => {
      await execAsync(`kubectl apply -f infrastructure/kubernetes/code-server-deployment.yaml`)

      // Wait for deployment to be available
      await execAsync(`kubectl wait --for=condition=available deployment/code-server -n ${NAMESPACE} --timeout=120s`)

      const { stdout } = await execAsync(`kubectl get deployment code-server -n ${NAMESPACE}`)
      expect(stdout).toContain('3/3')
    }, timeout)

    it('should have code-server service accessible', async () => {
      const { stdout } = await execAsync(`kubectl get service code-server-service -n ${NAMESPACE}`)
      expect(stdout).toContain('code-server-service')
      expect(stdout).toContain('8080')
    })

    it('should have healthy pods', async () => {
      const { stdout } = await execAsync(`kubectl get pods -n ${NAMESPACE} -l app=code-server`)
      expect(stdout).toContain('Running')

      // Check if all replicas are ready
      const lines = stdout.split('\n').filter(line => line.includes('code-server'))
      lines.forEach(line => {
        expect(line).toMatch(/\d+\/\d+.*Running/)
      })
    })

    it('should pass health checks', async () => {
      // Get pod names
      const { stdout: podList } = await execAsync(`kubectl get pods -n ${NAMESPACE} -l app=code-server -o jsonpath='{.items[0].metadata.name}'`)

      if (podList) {
        // Check readiness probe
        const { stdout: podStatus } = await execAsync(`kubectl get pod ${podList} -n ${NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'`)
        expect(podStatus).toBe('True')
      }
    })
  })

  describe('Resource Constraints', () => {
    it('should respect resource limits', async () => {
      const { stdout } = await execAsync(`kubectl describe deployment code-server -n ${NAMESPACE}`)
      expect(stdout).toContain('Limits:')
      expect(stdout).toContain('cpu:')
      expect(stdout).toContain('memory:')
    })

    it('should have resource requests defined', async () => {
      const { stdout } = await execAsync(`kubectl describe deployment code-server -n ${NAMESPACE}`)
      expect(stdout).toContain('Requests:')
    })
  })

  describe('Security Configuration', () => {
    it('should run with non-root user', async () => {
      const { stdout } = await execAsync(`kubectl get deployment code-server -n ${NAMESPACE} -o yaml`)
      expect(stdout).toContain('runAsNonRoot: true')
      expect(stdout).toContain('runAsUser: 1000')
    })

    it('should have security contexts configured', async () => {
      const { stdout } = await execAsync(`kubectl get deployment code-server -n ${NAMESPACE} -o yaml`)
      expect(stdout).toContain('allowPrivilegeEscalation: false')
      expect(stdout).toContain('capabilities:')
    })

    it('should have service account configured', async () => {
      const { stdout } = await execAsync(`kubectl get serviceaccount code-server-sa -n ${NAMESPACE}`)
      expect(stdout).toContain('code-server-sa')
    })

    it('should have RBAC rules applied', async () => {
      const { stdout: role } = await execAsync(`kubectl get role code-server-role -n ${NAMESPACE}`)
      expect(role).toContain('code-server-role')

      const { stdout: binding } = await execAsync(`kubectl get rolebinding code-server-rolebinding -n ${NAMESPACE}`)
      expect(binding).toContain('code-server-rolebinding')
    })
  })

  describe('Scaling and High Availability', () => {
    it('should support horizontal scaling', async () => {
      // Scale up
      await execAsync(`kubectl scale deployment code-server --replicas=5 -n ${NAMESPACE}`)
      await execAsync(`kubectl wait --for=condition=available deployment/code-server -n ${NAMESPACE} --timeout=60s`)

      let { stdout } = await execAsync(`kubectl get deployment code-server -n ${NAMESPACE}`)
      expect(stdout).toContain('5/5')

      // Scale back down
      await execAsync(`kubectl scale deployment code-server --replicas=3 -n ${NAMESPACE}`)
      await execAsync(`kubectl wait --for=condition=available deployment/code-server -n ${NAMESPACE} --timeout=60s`)

      ({ stdout } = await execAsync(`kubectl get deployment code-server -n ${NAMESPACE}`))
      expect(stdout).toContain('3/3')
    }, timeout)

    it('should have pod anti-affinity configured', async () => {
      const { stdout } = await execAsync(`kubectl get deployment code-server -n ${NAMESPACE} -o yaml`)
      expect(stdout).toContain('podAntiAffinity')
    })
  })

  describe('Network Configuration', () => {
    it('should have service discovery working', async () => {
      // Test service resolution from within cluster
      const { stdout: podName } = await execAsync(`kubectl get pods -n ${NAMESPACE} -l app=code-server -o jsonpath='{.items[0].metadata.name}'`)

      if (podName) {
        const { stdout } = await execAsync(`kubectl exec ${podName} -n ${NAMESPACE} -- nslookup code-server-service`)
        expect(stdout).toContain('code-server-service')
      }
    })

    it('should have correct port configuration', async () => {
      const { stdout } = await execAsync(`kubectl get service code-server-service -n ${NAMESPACE} -o yaml`)
      expect(stdout).toContain('port: 8080')
      expect(stdout).toContain('targetPort: 8080')
    })
  })
})
