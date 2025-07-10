/**
 * KIND Integration Tests
 * 
 * Integration tests for VibeCode WebGUI running in KIND cluster
 * Tests the complete application stack in Kubernetes environment
 * 
 * Staff Engineer Implementation - End-to-end Kubernetes validation
 */

const { describe, test, expect, beforeAll } = require('@jest/globals')
const { execSync } = require('child_process')

describe('KIND Integration Tests', () => {
  const NAMESPACE = 'vibecode'
  
  beforeAll(async () => {
    // Wait for databases to be fully ready before testing
    console.log('Waiting for database pods to be ready...')
    await waitForPodsReady(['postgres', 'redis'], NAMESPACE, 60000)
  })

  describe('Database Integration', () => {
    test('should connect to PostgreSQL through Kubernetes service', async () => {
      try {
        // Use kubectl exec to test database connection from within the cluster
        const podName = await getPodName('postgres', NAMESPACE)
        
        // Test basic connection
        const connectionTest = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- psql -U vibecode -d vibecode -c "SELECT 1 as health_check;"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(connectionTest).toContain('health_check')
        expect(connectionTest).toContain('1')
      } catch (error) {
        console.error('PostgreSQL connection test failed:', error)
        throw error
      }
    }, 30000)

    test('should have database schema initialized', async () => {
      try {
        const podName = await getPodName('postgres', NAMESPACE)
        
        // Check that tables were created by init script
        const tablesResult = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- psql -U vibecode -d vibecode -c "\\dt"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(tablesResult).toContain('users')
        expect(tablesResult).toContain('projects')
        expect(tablesResult).toContain('feature_flags')
        
        // Check that test data was inserted
        const usersResult = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- psql -U vibecode -d vibecode -c "SELECT email FROM users;"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(usersResult).toContain('admin@vibecode.dev')
        expect(usersResult).toContain('test@vibecode.dev')
      } catch (error) {
        console.error('Database schema test failed:', error)
        throw error
      }
    }, 30000)

    test('should connect to Redis through Kubernetes service', async () => {
      try {
        const podName = await getPodName('redis', NAMESPACE)
        
        // Test Redis connection and basic operations
        const pingResult = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- redis-cli ping`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(pingResult.trim()).toBe('PONG')
        
        // Test set/get operations
        execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- redis-cli set test_key "kind_integration_test"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        const getValue = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- redis-cli get test_key`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(getValue.trim()).toBe('kind_integration_test')
      } catch (error) {
        console.error('Redis connection test failed:', error)
        throw error
      }
    }, 30000)
  })

  describe('Service Discovery and Networking', () => {
    test('should resolve service DNS names within cluster', async () => {
      try {
        // Create a temporary pod to test DNS resolution
        const testPodName = `dns-test-${Date.now()}`
        
        execSync(
          `kubectl run ${testPodName} -n ${NAMESPACE} --image=busybox --restart=Never -- sleep 300`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        // Wait for pod to be ready
        await waitForPodsReady([testPodName], NAMESPACE, 30000)
        
        // Test DNS resolution for services
        const postgresLookup = execSync(
          `kubectl exec -n ${NAMESPACE} ${testPodName} -- nslookup postgres-service.vibecode.svc.cluster.local`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(postgresLookup).toContain('postgres-service.vibecode.svc.cluster.local')
        
        const redisLookup = execSync(
          `kubectl exec -n ${NAMESPACE} ${testPodName} -- nslookup redis-service.vibecode.svc.cluster.local`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(redisLookup).toContain('redis-service.vibecode.svc.cluster.local')
        
        // Cleanup test pod
        execSync(`kubectl delete pod ${testPodName} -n ${NAMESPACE}`, { encoding: 'utf8' })
      } catch (error) {
        console.error('DNS resolution test failed:', error)
        throw error
      }
    }, 45000)

    test('should have working inter-service communication', async () => {
      try {
        // Test that services can communicate on their internal ports
        const testPodName = `network-test-${Date.now()}`
        
        execSync(
          `kubectl run ${testPodName} -n ${NAMESPACE} --image=busybox --restart=Never -- sleep 300`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        await waitForPodsReady([testPodName], NAMESPACE, 30000)
        
        // Test PostgreSQL connectivity
        const pgTest = execSync(
          `kubectl exec -n ${NAMESPACE} ${testPodName} -- nc -z postgres-service 5432`,
          { encoding: 'utf8', timeout: 10000 }
        )
        // nc returns empty output on success
        
        // Test Redis connectivity
        const redisTest = execSync(
          `kubectl exec -n ${NAMESPACE} ${testPodName} -- nc -z redis-service 6379`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        // Cleanup
        execSync(`kubectl delete pod ${testPodName} -n ${NAMESPACE}`, { encoding: 'utf8' })
      } catch (error) {
        console.error('Inter-service communication test failed:', error)
        throw error
      }
    }, 45000)
  })

  describe('Storage and Persistence', () => {
    test('should persist data across pod restarts', async () => {
      try {
        const originalPodName = await getPodName('postgres', NAMESPACE)
        
        // Insert test data
        execSync(
          `kubectl exec -n ${NAMESPACE} ${originalPodName} -- psql -U vibecode -d vibecode -c "INSERT INTO users (email, name, provider, provider_id) VALUES ('persistence-test@vibecode.dev', 'Persistence Test', 'email', 'persistence-test');"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        // Restart the PostgreSQL pod by deleting it (deployment will recreate)
        execSync(`kubectl delete pod ${originalPodName} -n ${NAMESPACE}`, { encoding: 'utf8' })
        
        // Wait for new pod to be ready
        await waitForPodsReady(['postgres'], NAMESPACE, 60000)
        
        const newPodName = await getPodName('postgres', NAMESPACE)
        
        // Verify data persisted
        const persistenceTest = execSync(
          `kubectl exec -n ${NAMESPACE} ${newPodName} -- psql -U vibecode -d vibecode -c "SELECT email FROM users WHERE email = 'persistence-test@vibecode.dev';"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(persistenceTest).toContain('persistence-test@vibecode.dev')
        
        // Cleanup test data
        execSync(
          `kubectl exec -n ${NAMESPACE} ${newPodName} -- psql -U vibecode -d vibecode -c "DELETE FROM users WHERE email = 'persistence-test@vibecode.dev';"`,
          { encoding: 'utf8', timeout: 10000 }
        )
      } catch (error) {
        console.error('Data persistence test failed:', error)
        throw error
      }
    }, 90000)

    test('should have correct volume mounts and permissions', async () => {
      try {
        const podName = await getPodName('postgres', NAMESPACE)
        
        // Check that data directory is mounted and writable
        const mountTest = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- ls -la /var/lib/postgresql/data`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(mountTest).toContain('postgres')
        
        // Check init script directory
        const initTest = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- ls -la /docker-entrypoint-initdb.d`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(initTest).toContain('init.sql')
      } catch (error) {
        console.error('Volume mount test failed:', error)
        throw error
      }
    }, 30000)
  })

  describe('Health Checks and Monitoring', () => {
    test('should have working readiness probes', async () => {
      const podsOutput = execSync(`kubectl get pods -n ${NAMESPACE} -o json`, { encoding: 'utf8' })
      const pods = JSON.parse(podsOutput)
      
      pods.items.forEach(function(pod) {
        const readyCondition = pod.status.conditions && pod.status.conditions.find(function(c) { return c.type === 'Ready' })
        expect(readyCondition && readyCondition.status).toBe('True')
        
        // Check that containers are ready
        if (pod.status.containerStatuses) {
          pod.status.containerStatuses.forEach(function(status) {
            expect(status.ready).toBe(true)
          })
        }
      })
    })

    test('should have working liveness probes', async () => {
      const podsOutput = execSync(`kubectl get pods -n ${NAMESPACE} -o json`, { encoding: 'utf8' })
      const pods = JSON.parse(podsOutput)
      
      pods.items.forEach(function(pod) {
        if (pod.status.containerStatuses) {
          pod.status.containerStatuses.forEach(function(status) {
            expect(status.restartCount).toBeLessThan(3) // Allow some restarts during startup
          })
        }
      })
    })

    test('should monitor resource usage within limits', async () => {
      try {
        // Check current resource usage (if metrics server is available)
        const metricsOutput = execSync(`kubectl top pods -n ${NAMESPACE}`, { encoding: 'utf8' })
        console.log('Resource usage in KIND cluster:', metricsOutput)
      } catch (error) {
        console.warn('Metrics server not available - this is expected in KIND')
      }
      
      // Check that pods are not being evicted due to resource pressure
      const eventsOutput = execSync(`kubectl get events -n ${NAMESPACE} --field-selector type=Warning`, { encoding: 'utf8' })
      expect(eventsOutput).not.toContain('Evicted')
      expect(eventsOutput).not.toContain('OOMKilled')
    })
  })

  describe('Feature Flag Integration', () => {
    test('should have feature flags properly initialized in database', async () => {
      try {
        const podName = await getPodName('postgres', NAMESPACE)
        
        const flagsResult = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- psql -U vibecode -d vibecode -c "SELECT key, name, enabled FROM feature_flags;"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(flagsResult).toContain('kind_testing')
        expect(flagsResult).toContain('monitoring_enhanced')
        
        // Test specific flag values
        const kindTestingFlag = execSync(
          `kubectl exec -n ${NAMESPACE} ${podName} -- psql -U vibecode -d vibecode -c "SELECT enabled, rollout_percentage FROM feature_flags WHERE key = 'kind_testing';"`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(kindTestingFlag).toContain('t') // true in PostgreSQL
        expect(kindTestingFlag).toContain('100')
      } catch (error) {
        console.error('Feature flags test failed:', error)
        throw error
      }
    }, 30000)
  })

  describe('Scaling and Load Testing', () => {
    test('should support horizontal scaling', async () => {
      try {
        // Scale Redis deployment to 2 replicas
        execSync(`kubectl scale deployment redis --replicas=2 -n ${NAMESPACE}`, { encoding: 'utf8' })
        
        // Wait for scale operation to complete
        await waitForDeploymentReady('redis', NAMESPACE, 30000)
        
        // Verify we have 2 Redis pods
        const podsOutput = execSync(`kubectl get pods -n ${NAMESPACE} -l app=redis -o json`, { encoding: 'utf8' })
        const pods = JSON.parse(podsOutput)
        expect(pods.items).toHaveLength(2)
        
        // Scale back down
        execSync(`kubectl scale deployment redis --replicas=1 -n ${NAMESPACE}`, { encoding: 'utf8' })
        await waitForDeploymentReady('redis', NAMESPACE, 30000)
      } catch (error) {
        console.error('Scaling test failed:', error)
        throw error
      }
    }, 60000)

    test('should handle pod failures gracefully', async () => {
      try {
        const originalPodName = await getPodName('redis', NAMESPACE)
        
        // Delete Redis pod to simulate failure
        execSync(`kubectl delete pod ${originalPodName} -n ${NAMESPACE}`, { encoding: 'utf8' })
        
        // Wait for replacement pod to be ready
        await waitForPodsReady(['redis'], NAMESPACE, 30000)
        
        const newPodName = await getPodName('redis', NAMESPACE)
        expect(newPodName).not.toBe(originalPodName)
        
        // Verify Redis is still functional
        const pingResult = execSync(
          `kubectl exec -n ${NAMESPACE} ${newPodName} -- redis-cli ping`,
          { encoding: 'utf8', timeout: 10000 }
        )
        
        expect(pingResult.trim()).toBe('PONG')
      } catch (error) {
        console.error('Pod failure test failed:', error)
        throw error
      }
    }, 45000)
  })
})

// Helper functions
async function getPodName(appLabel, namespace) {
  const output = execSync(`kubectl get pods -n ${namespace} -l app=${appLabel} -o jsonpath='{.items[0].metadata.name}'`, { encoding: 'utf8' })
  return output.trim()
}

async function waitForPodsReady(appLabels, namespace, timeoutMs) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    let allReady = true
    
    for (const appLabel of appLabels) {
      try {
        const output = execSync(`kubectl get pods -n ${namespace} -l app=${appLabel} -o json`, { encoding: 'utf8' })
        const pods = JSON.parse(output)
        
        if (pods.items.length === 0) {
          allReady = false
          break
        }
        
        for (const pod of pods.items) {
          const readyCondition = pod.status.conditions && pod.status.conditions.find(function(c) { return c.type === 'Ready' })
          if (!readyCondition || readyCondition.status !== 'True') {
            allReady = false
            break
          }
        }
        
        if (!allReady) break
      } catch (error) {
        allReady = false
        break
      }
    }
    
    if (allReady) {
      return
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  throw new Error(`Pods not ready within ${timeoutMs}ms timeout`)
}

async function waitForDeploymentReady(deploymentName, namespace, timeoutMs) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const output = execSync(`kubectl get deployment ${deploymentName} -n ${namespace} -o json`, { encoding: 'utf8' })
      const deployment = JSON.parse(output)
      
      const replicas = deployment.spec.replicas
      const readyReplicas = deployment.status.readyReplicas || 0
      
      if (readyReplicas === replicas) {
        return
      }
    } catch (error) {
      // Deployment may not exist yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  throw new Error(`Deployment ${deploymentName} not ready within ${timeoutMs}ms timeout`)
}