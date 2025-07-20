/**
 * API Client Library
 * Centralized API functions for frontend components
 */

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        return {
          success: false,
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      }
    }
  }

  // Console/Terminal API
  async createTerminalSession(workspaceId: string) {
    return this.request('/api/terminal/session', {
      method: 'POST',
      body: JSON.stringify({ workspaceId }),
    })
  }

  async getTerminalSession(sessionId: string) {
    return this.request(`/api/terminal/session/${sessionId}`)
  }

  // Health Check
  async getHealth() {
    return this.request('/api/health')
  }

  // Workspace API
  async createWorkspace(data: { name: string; description?: string }) {
    return this.request('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getWorkspaces() {
    return this.request('/api/workspaces')
  }

  async getWorkspace(id: string) {
    return this.request(`/api/workspaces/${id}`)
  }

  // File API
  async uploadFile(workspaceId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('workspaceId', workspaceId)

    return this.request('/api/files', {
      method: 'POST',
      body: formData,
      headers: {}, // Don't set Content-Type for FormData
    })
  }

  async getFiles(workspaceId: string) {
    return this.request(`/api/files?workspaceId=${workspaceId}`)
  }

  // AI API
  async generateProject(data: {
    prompt: string
    projectName?: string
    language?: string
    framework?: string
    features?: string[]
  }) {
    return this.request('/api/ai/generate-project', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async vectorSearch(data: {
    query: string
    workspaceId?: string
    fileIds?: number[]
    limit?: number
    threshold?: number
  }) {
    return this.request('/api/ai/search', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Monitoring API
  async getMetrics() {
    return this.request('/api/monitoring/metrics')
  }

  async getAlerts() {
    return this.request('/api/monitoring/alerts')
  }
}

// Export singleton instance
export const api = new ApiClient()
export default api