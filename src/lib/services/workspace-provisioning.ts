/**
 * Workspace Provisioning Service
 * Dynamic workspace creation on AKS for generated projects
 */

import { z } from 'zod'
import * as k8s from '@kubernetes/client-node'

const WorkspaceRequestSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  framework: z.string(),
  userId: z.string(),
  files: z.record(z.string()), // file path -> content
  dependencies: z.array(z.string()).default([]),
  environment: z.record(z.string()).default({})
})

const WorkspaceStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'creating', 'ready', 'error', 'terminating']),
  url: z.string().optional(),
  endpoints: z.object({
    ide: z.string().optional(),
    preview: z.string().optional(),
    terminal: z.string().optional()
  }).default({}),
  resources: z.object({
    namespace: z.string(),
    deployment: z.string(),
    service: z.string(),
    ingress: z.string().optional(),
    pvc: z.string().optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  expiresAt: z.date().optional()
})

export type WorkspaceRequest = z.infer<typeof WorkspaceRequestSchema>
export type WorkspaceStatus = z.infer<typeof WorkspaceStatusSchema>

export class WorkspaceProvisioningService {
  private k8sApi: k8s.CoreV1Api
  private k8sAppsApi: k8s.AppsV1Api
  private k8sNetworkingApi: k8s.NetworkingV1Api
  private namespace: string

  constructor(kubeconfig?: string) {
    const kc = new k8s.KubeConfig()
    
    if (kubeconfig) {
      kc.loadFromString(kubeconfig)
    } else if (process.env.KUBECONFIG) {
      kc.loadFromFile(process.env.KUBECONFIG)
    } else {
      // Try in-cluster config first, then default config
      try {
        kc.loadFromCluster()
      } catch {
        kc.loadFromDefault()
      }
    }

    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api)
    this.k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api)
    this.k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api)
    this.namespace = process.env.WORKSPACE_NAMESPACE || 'vibecode-workspaces'
  }

  /**
   * Create a new development workspace for a generated project
   */
  async createWorkspace(request: WorkspaceRequest): Promise<WorkspaceStatus> {
    const validatedRequest = WorkspaceRequestSchema.parse(request)
    
    console.log(`🚀 Creating workspace for project: ${validatedRequest.projectName}`)

    try {
      // Generate unique workspace ID
      const workspaceId = `ws-${validatedRequest.projectId}-${Date.now()}`
      const workspaceName = `workspace-${workspaceId}`

      // Ensure workspace namespace exists
      await this.ensureNamespace()

      // Create ConfigMap with project files
      await this.createProjectConfigMap(workspaceId, validatedRequest)

      // Create PVC for persistent storage
      await this.createPersistentVolume(workspaceId)

      // Create workspace deployment
      await this.createWorkspaceDeployment(workspaceId, validatedRequest)

      // Create service
      await this.createWorkspaceService(workspaceId)

      // Create ingress
      const ingressHost = await this.createWorkspaceIngress(workspaceId)

      // Wait for deployment to be ready
      await this.waitForWorkspaceReady(workspaceName)

      const workspace: WorkspaceStatus = {
        id: workspaceId,
        status: 'ready',
        url: `https://${ingressHost}`,
        endpoints: {
          ide: `https://${ingressHost}`,
          preview: `https://${ingressHost}/preview`,
          terminal: `https://${ingressHost}/terminal`
        },
        resources: {
          namespace: this.namespace,
          deployment: workspaceName,
          service: `${workspaceName}-service`,
          ingress: `${workspaceName}-ingress`,
          pvc: `${workspaceName}-storage`
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }

      console.log(`✅ Workspace created successfully: ${workspaceId}`)
      return workspace

    } catch (error) {
      console.error('❌ Workspace creation failed:', error)
      throw new Error(`Workspace creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get workspace status
   */
  async getWorkspaceStatus(workspaceId: string): Promise<WorkspaceStatus | null> {
    try {
      const workspaceName = `workspace-${workspaceId}`
      
      // Get deployment status
      const deployment = await this.k8sAppsApi.readNamespacedDeployment({
        name: workspaceName,
        namespace: this.namespace
      })

      const status = deployment.body.status?.readyReplicas === 1 ? 'ready' : 'creating'
      
      // Get ingress for URL
      let url = ''
      try {
        const ingress = await this.k8sNetworkingApi.readNamespacedIngress({
          name: `${workspaceName}-ingress`,
          namespace: this.namespace
        })
        const host = ingress.body.spec?.rules?.[0]?.host
        if (host) {
          url = `https://${host}`
        }
      } catch {
        // Ingress might not exist yet
      }

      return {
        id: workspaceId,
        status,
        url,
        endpoints: {
          ide: url,
          preview: `${url}/preview`,
          terminal: `${url}/terminal`
        },
        resources: {
          namespace: this.namespace,
          deployment: workspaceName,
          service: `${workspaceName}-service`,
          ingress: `${workspaceName}-ingress`,
          pvc: `${workspaceName}-storage`
        },
        createdAt: new Date(deployment.body.metadata?.creationTimestamp || ''),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }

    } catch (error) {
      console.error('❌ Failed to get workspace status:', error)
      return null
    }
  }

  /**
   * Delete a workspace and all its resources
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting workspace: ${workspaceId}`)
      
      const workspaceName = `workspace-${workspaceId}`

      // Delete ingress
      try {
        await this.k8sNetworkingApi.deleteNamespacedIngress({
          name: `${workspaceName}-ingress`,
          namespace: this.namespace
        })
      } catch (error) {
        console.warn('Failed to delete ingress:', error)
      }

      // Delete service
      try {
        await this.k8sApi.deleteNamespacedService({
          name: `${workspaceName}-service`,
          namespace: this.namespace
        })
      } catch (error) {
        console.warn('Failed to delete service:', error)
      }

      // Delete deployment
      try {
        await this.k8sAppsApi.deleteNamespacedDeployment({
          name: workspaceName,
          namespace: this.namespace
        })
      } catch (error) {
        console.warn('Failed to delete deployment:', error)
      }

      // Delete PVC
      try {
        await this.k8sApi.deleteNamespacedPersistentVolumeClaim({
          name: `${workspaceName}-storage`,
          namespace: this.namespace
        })
      } catch (error) {
        console.warn('Failed to delete PVC:', error)
      }

      // Delete ConfigMap
      try {
        await this.k8sApi.deleteNamespacedConfigMap({
          name: `${workspaceName}-files`,
          namespace: this.namespace
        })
      } catch (error) {
        console.warn('Failed to delete ConfigMap:', error)
      }

      console.log(`✅ Workspace deleted: ${workspaceId}`)

    } catch (error) {
      console.error('❌ Failed to delete workspace:', error)
      throw new Error(`Workspace deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * List all workspaces
   */
  async listWorkspaces(): Promise<WorkspaceStatus[]> {
    try {
      const deployments = await this.k8sAppsApi.listNamespacedDeployment({
        namespace: this.namespace,
        labelSelector: 'app=vibecode-workspace'
      })

      const workspaces: WorkspaceStatus[] = []

      for (const deployment of deployments.body.items) {
        const name = deployment.metadata?.name
        if (name?.startsWith('workspace-ws-')) {
          const workspaceId = name.replace('workspace-', '')
          const status = await this.getWorkspaceStatus(workspaceId)
          if (status) {
            workspaces.push(status)
          }
        }
      }

      return workspaces

    } catch (error) {
      console.error('❌ Failed to list workspaces:', error)
      return []
    }
  }

  private async ensureNamespace(): Promise<void> {
    try {
      await this.k8sApi.readNamespace({ name: this.namespace })
    } catch {
      // Namespace doesn't exist, create it
      await this.k8sApi.createNamespace({
        body: {
          metadata: {
            name: this.namespace,
            labels: {
              'app': 'vibecode',
              'component': 'workspaces'
            }
          }
        }
      })
      console.log(`✅ Created namespace: ${this.namespace}`)
    }
  }

  private async createProjectConfigMap(workspaceId: string, request: WorkspaceRequest): Promise<void> {
    const workspaceName = `workspace-${workspaceId}`
    
    await this.k8sApi.createNamespacedConfigMap({
      namespace: this.namespace,
      body: {
        metadata: {
          name: `${workspaceName}-files`,
          labels: {
            app: 'vibecode-workspace',
            workspace: workspaceId
          }
        },
        data: request.files
      }
    })
  }

  private async createPersistentVolume(workspaceId: string): Promise<void> {
    const workspaceName = `workspace-${workspaceId}`
    
    await this.k8sApi.createNamespacedPersistentVolumeClaim({
      namespace: this.namespace,
      body: {
        metadata: {
          name: `${workspaceName}-storage`,
          labels: {
            app: 'vibecode-workspace',
            workspace: workspaceId
          }
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: {
            requests: {
              storage: '10Gi'
            }
          },
          storageClassName: 'managed-csi'
        }
      }
    })
  }

  private async createWorkspaceDeployment(workspaceId: string, request: WorkspaceRequest): Promise<void> {
    const workspaceName = `workspace-${workspaceId}`
    
    await this.k8sAppsApi.createNamespacedDeployment({
      namespace: this.namespace,
      body: {
        metadata: {
          name: workspaceName,
          labels: {
            app: 'vibecode-workspace',
            workspace: workspaceId,
            framework: request.framework
          }
        },
        spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'vibecode-workspace',
            workspace: workspaceId
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'vibecode-workspace',
              workspace: workspaceId,
              framework: request.framework
            }
          },
          spec: {
            containers: [{
              name: 'code-server',
              image: 'codercom/code-server:latest',
              ports: [{
                containerPort: 8080,
                name: 'http'
              }],
              env: [
                { name: 'PASSWORD', value: 'vibecode' },
                { name: 'WORKSPACE_NAME', value: request.projectName },
                { name: 'PROJECT_FRAMEWORK', value: request.framework }
              ],
              volumeMounts: [
                {
                  name: 'workspace-storage',
                  mountPath: '/home/coder/project'
                },
                {
                  name: 'project-files',
                  mountPath: '/home/coder/project-template'
                }
              ],
              resources: {
                requests: {
                  cpu: '500m',
                  memory: '1Gi'
                },
                limits: {
                  cpu: '2000m',
                  memory: '4Gi'
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/healthz',
                  port: 8080
                },
                initialDelaySeconds: 30,
                periodSeconds: 30
              },
              readinessProbe: {
                httpGet: {
                  path: '/healthz',
                  port: 8080
                },
                initialDelaySeconds: 10,
                periodSeconds: 10
              }
            }],
            volumes: [
              {
                name: 'workspace-storage',
                persistentVolumeClaim: {
                  claimName: `${workspaceName}-storage`
                }
              },
              {
                name: 'project-files',
                configMap: {
                  name: `${workspaceName}-files`
                }
              }
            ]
          }
        }
      }
    })
  }

  private async createWorkspaceService(workspaceId: string): Promise<void> {
    const workspaceName = `workspace-${workspaceId}`
    
    await this.k8sApi.createNamespacedService({
      namespace: this.namespace,
      body: {
        metadata: {
          name: `${workspaceName}-service`,
          labels: {
            app: 'vibecode-workspace',
            workspace: workspaceId
          }
        },
        spec: {
        selector: {
          app: 'vibecode-workspace',
          workspace: workspaceId
        },
        ports: [{
          port: 80,
          targetPort: 8080,
          name: 'http'
        }],
        type: 'ClusterIP'
      }
    })
  }

  private async createWorkspaceIngress(workspaceId: string): Promise<string> {
    const workspaceName = `workspace-${workspaceId}`
    const host = `${workspaceId}.workspaces.vibecode.dev`
    
    await this.k8sNetworkingApi.createNamespacedIngress({
      namespace: this.namespace,
      body: {
        metadata: {
          name: `${workspaceName}-ingress`,
          labels: {
            app: 'vibecode-workspace',
            workspace: workspaceId
          },
          annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod'
        }
      },
      spec: {
        tls: [{
          hosts: [host],
          secretName: `${workspaceName}-tls`
        }],
        rules: [{
          host,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: `${workspaceName}-service`,
                  port: {
                    number: 80
                  }
                }
              }
            }]
          }
        }]
      }
    })

    return host
  }

  private async waitForWorkspaceReady(workspaceName: string, timeoutMs = 300000): Promise<void> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const deployment = await this.k8sAppsApi.readNamespacedDeployment({
          name: workspaceName,
          namespace: this.namespace
        })

        if (deployment.body.status?.readyReplicas === 1) {
          return
        }

        await new Promise(resolve => setTimeout(resolve, 5000))
      } catch (error) {
        console.warn('Waiting for deployment to be ready:', error)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }

    throw new Error(`Workspace deployment timed out after ${timeoutMs}ms`)
  }
}
