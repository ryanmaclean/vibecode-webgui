export interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'user' | 'developer'
  groups: string[]
  createdAt: string
  lastActive: string
  status: 'active' | 'inactive' | 'suspended'
}

export interface Workspace {
  id: string
  name: string
  userId: string
  userEmail: string
  status: 'running' | 'stopped' | 'pending' | 'error'
  image: string
  resources: {
    cpu: string
    memory: string
    storage: string
  }
  url: string
  createdAt: string
  lastAccessed: string
  namespace: string
}

export interface AIModel {
  id: string
  name: string
  provider: string
  pricing: {
    prompt: number
    completion: number
  }
  context_length: number
  architecture: {
    modality: string
    tokenizer: string
    instruct_type?: string
  }
  performance?: {
    averageLatency: number
    successRate: number
    totalRequests: number
    lastUpdated: string
  }
  isHealthy?: boolean
}

export interface Usage {
  date: string
  requests: number
  tokens: number
  cost: number
}

export interface SystemStatus {
  status: 'operational' | 'degraded' | 'outage'
  services: {
    redis: 'connected' | 'disconnected'
    openrouter: 'connected' | 'disconnected'
    modelRegistry: 'loaded' | 'empty'
    kubernetes: 'healthy' | 'unhealthy'
    authelia: 'healthy' | 'unhealthy'
  }
  metrics: {
    modelCount: number
    lastModelUpdate: string | null
    uptime: number
    memoryUsage: {
      rss: number
      heapUsed: number
      heapTotal: number
      external: number
    }
    nodeVersion: string
  }
  timestamp: string
}

export interface ClusterNode {
  name: string
  status: 'Ready' | 'NotReady'
  roles: string[]
  age: string
  version: string
  cpu: {
    used: number
    total: number
  }
  memory: {
    used: number
    total: number
  }
  pods: {
    used: number
    total: number
  }
}

export interface ClusterMetrics {
  nodes: ClusterNode[]
  pods: {
    total: number
    running: number
    pending: number
    failed: number
  }
  namespaces: {
    name: string
    status: string
    age: string
  }[]
  resources: {
    cpuUsage: number
    memoryUsage: number
    storageUsage: number
  }
}

export interface ModelRecommendation {
  model: string
  reason: string
  confidence: number
  costEfficiency: number
  performanceScore: number
}

export interface ApiError {
  error: string
  code: string
  requestId?: string
  timestamp: string
  details?: any
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  max_tokens?: number
  temperature?: number
  stream?: boolean
}

export interface ModelSelectionCriteria {
  task: 'chat' | 'code' | 'analysis' | 'creative' | 'general'
  maxCost?: number
  minPerformance?: number
  preferredProviders?: string[]
  excludeModels?: string[]
  requireFeatures?: string[]
}
