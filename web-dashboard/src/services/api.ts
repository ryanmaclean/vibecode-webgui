import axios from 'axios'
import type { 
  AIModel, 
  SystemStatus, 
  Usage, 
  Workspace, 
  User, 
  ClusterMetrics,
  ModelRecommendation,
  ModelSelectionCriteria,
  ChatCompletionRequest,
  ApiError
} from '../types'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  const apiKey = localStorage.getItem('api_key')
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else if (apiKey) {
    config.headers['X-API-Key'] = apiKey
  }
  
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('api_key')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// AI Gateway APIs
export const aiApi = {
  // Models
  getModels: async (): Promise<{ models: AIModel[]; count: number }> => {
    const { data } = await api.get('/models')
    return data
  },

  getModel: async (modelId: string): Promise<AIModel> => {
    const { data } = await api.get(`/models/${modelId}`)
    return data
  },

  getModelRecommendations: async (criteria: ModelSelectionCriteria): Promise<{
    recommendations: ModelRecommendation[]
    criteria: ModelSelectionCriteria
    count: number
  }> => {
    const { data } = await api.post('/models/recommend', criteria)
    return data
  },

  refreshModels: async (): Promise<{ success: boolean; modelCount: number }> => {
    const { data } = await api.post('/models/refresh')
    return data
  },

  // Chat completions
  chatCompletion: async (request: ChatCompletionRequest) => {
    const { data } = await api.post('/chat/completions', request)
    return data
  },

  // Usage and analytics
  getUsage: async (params?: {
    start_date?: string
    end_date?: string
    user_id?: string
    model?: string
    groupby?: string
  }): Promise<Usage[]> => {
    const { data } = await api.get('/usage', { params })
    return data
  },

  getCosts: async (params?: {
    start_date?: string
    end_date?: string
    user_id?: string
    breakdown?: string
  }) => {
    const { data } = await api.get('/usage/costs', { params })
    return data
  },

  // Service status
  getStatus: async (): Promise<SystemStatus> => {
    const { data } = await api.get('/status')
    return data
  },

  // Clear cache
  clearCache: async (pattern?: string): Promise<{ success: boolean; clearedKeys: number }> => {
    const { data } = await api.delete('/cache', { params: pattern ? { pattern } : {} })
    return data
  },
}

// Kubernetes APIs (mock data for now - would connect to actual K8s API)
export const k8sApi = {
  getClusterMetrics: async (): Promise<ClusterMetrics> => {
    // Mock data - in production this would call actual K8s APIs
    return {
      nodes: [
        {
          name: 'vibecode-cluster-control-plane',
          status: 'Ready',
          roles: ['control-plane'],
          age: '2h',
          version: 'v1.33.1',
          cpu: { used: 45, total: 100 },
          memory: { used: 1.2, total: 4.0 },
          pods: { used: 12, total: 110 }
        },
        {
          name: 'vibecode-cluster-worker',
          status: 'Ready',
          roles: ['worker'],
          age: '2h',
          version: 'v1.33.1',
          cpu: { used: 60, total: 100 },
          memory: { used: 2.1, total: 4.0 },
          pods: { used: 18, total: 110 }
        },
        {
          name: 'vibecode-cluster-worker2',
          status: 'Ready',
          roles: ['worker'],
          age: '2h',
          version: 'v1.33.1',
          cpu: { used: 30, total: 100 },
          memory: { used: 0.8, total: 4.0 },
          pods: { used: 8, total: 110 }
        },
        {
          name: 'vibecode-cluster-worker3',
          status: 'Ready',
          roles: ['worker'],
          age: '2h',
          version: 'v1.33.1',
          cpu: { used: 25, total: 100 },
          memory: { used: 0.6, total: 4.0 },
          pods: { used: 5, total: 110 }
        }
      ],
      pods: {
        total: 43,
        running: 40,
        pending: 2,
        failed: 1
      },
      namespaces: [
        { name: 'default', status: 'Active', age: '2h' },
        { name: 'kube-system', status: 'Active', age: '2h' },
        { name: 'vibecode-auth', status: 'Active', age: '2h' },
        { name: 'vibecode-storage', status: 'Active', age: '2h' },
        { name: 'ingress-nginx', status: 'Active', age: '2h' },
        { name: 'cert-manager', status: 'Active', age: '2h' }
      ],
      resources: {
        cpuUsage: 40,
        memoryUsage: 35,
        storageUsage: 25
      }
    }
  },

  getWorkspaces: async (): Promise<Workspace[]> => {
    // Mock data - would query actual pods with label selectors
    return [
      {
        id: 'ws-admin-001',
        name: 'admin-workspace',
        userId: 'admin',
        userEmail: 'admin@vibecode.dev',
        status: 'running',
        image: 'codercom/code-server:4.101.2',
        resources: { cpu: '2', memory: '4Gi', storage: '10Gi' },
        url: 'https://admin.localhost:8090',
        createdAt: '2025-07-11T01:00:00Z',
        lastAccessed: '2025-07-11T02:30:00Z',
        namespace: 'default'
      },
      {
        id: 'ws-dev-001',
        name: 'developer-workspace',
        userId: 'developer',
        userEmail: 'dev@vibecode.dev',
        status: 'running',
        image: 'codercom/code-server:4.101.2',
        resources: { cpu: '1', memory: '2Gi', storage: '5Gi' },
        url: 'https://dev.localhost:8090',
        createdAt: '2025-07-11T01:15:00Z',
        lastAccessed: '2025-07-11T02:15:00Z',
        namespace: 'default'
      }
    ]
  },

  createWorkspace: async (params: {
    username: string
    email: string
    cpu?: string
    memory?: string
    storage?: string
    groups?: string[]
  }): Promise<{ success: boolean; workspace: Workspace }> => {
    // Mock response - would actually call provisioning script
    const workspace: Workspace = {
      id: `ws-${params.username}-${Date.now()}`,
      name: `${params.username}-workspace`,
      userId: params.username,
      userEmail: params.email,
      status: 'pending',
      image: 'codercom/code-server:4.101.2',
      resources: {
        cpu: params.cpu || '1',
        memory: params.memory || '2Gi',
        storage: params.storage || '5Gi'
      },
      url: `https://${params.username}.localhost:8090`,
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      namespace: 'default'
    }
    
    return { success: true, workspace }
  },

  deleteWorkspace: async (workspaceId: string): Promise<{ success: boolean }> => {
    // Mock response - would actually delete K8s resources
    return { success: true }
  },

  getUsers: async (): Promise<User[]> => {
    // Mock data - would query Authelia or K8s secrets
    return [
      {
        id: 'admin',
        username: 'admin',
        email: 'admin@vibecode.dev',
        role: 'admin',
        groups: ['admins', 'users'],
        createdAt: '2025-07-11T00:00:00Z',
        lastActive: '2025-07-11T02:30:00Z',
        status: 'active'
      },
      {
        id: 'developer',
        username: 'developer',
        email: 'dev@vibecode.dev',
        role: 'developer',
        groups: ['users', 'developers'],
        createdAt: '2025-07-11T00:00:00Z',
        lastActive: '2025-07-11T02:15:00Z',
        status: 'active'
      },
      {
        id: 'user',
        username: 'user',
        email: 'user@vibecode.dev',
        role: 'user',
        groups: ['users'],
        createdAt: '2025-07-11T00:00:00Z',
        lastActive: '2025-07-11T01:45:00Z',
        status: 'active'
      }
    ]
  }
}

// Health check APIs
export const healthApi = {
  getHealth: async () => {
    const { data } = await axios.get('/health')
    return data
  },

  getDetailedHealth: async () => {
    const { data } = await axios.get('/health/detailed')
    return data
  }
}

// Metrics APIs
export const metricsApi = {
  getMetrics: async () => {
    const { data } = await axios.get('/metrics')
    return data
  },

  getPerformanceMetrics: async () => {
    const { data } = await axios.get('/metrics/performance')
    return data
  },

  getUsageMetrics: async (days: number = 7) => {
    const { data } = await axios.get(`/metrics/usage?days=${days}`)
    return data
  },

  getCostMetrics: async (days: number = 7) => {
    const { data } = await axios.get(`/metrics/costs?days=${days}`)
    return data
  }
}

export default api