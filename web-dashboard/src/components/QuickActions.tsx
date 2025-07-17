import { useState } from 'react'
import { Plus, RefreshCw, Settings, Terminal, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { k8sApi, aiApi } from '../services/api'

export function QuickActions() {
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const queryClient = useQueryClient()

  const refreshModelsMutation = useMutation({
    mutationFn: aiApi.refreshModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
    }
  })

  const clearCacheMutation = useMutation({
    mutationFn: () => aiApi.clearCache(),
    onSuccess: () => {
      // Could show a success toast here
    }
  })

  const actions = [
    {
      name: 'Create Workspace',
      description: 'Provision a new development workspace',
      icon: Plus,
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
      action: () => setIsCreatingWorkspace(true)
    },
    {
      name: 'Refresh Models',
      description: 'Update available AI model registry',
      icon: RefreshCw,
      color: 'text-green-600 bg-green-50 hover:bg-green-100',
      action: () => refreshModelsMutation.mutate(),
      loading: refreshModelsMutation.isPending
    },
    {
      name: 'Clear Cache',
      description: 'Clear AI response cache',
      icon: Trash2,
      color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
      action: () => clearCacheMutation.mutate(),
      loading: clearCacheMutation.isPending
    },
    {
      name: 'Cluster Shell',
      description: 'Open kubectl terminal access',
      icon: Terminal,
      color: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
      action: () => {
        // In a real implementation, this would open a web terminal
        window.open('/terminal', '_blank')
      }
    },
    {
      name: 'System Settings',
      description: 'Configure platform settings',
      icon: Settings,
      color: 'text-gray-600 bg-gray-50 hover:bg-gray-100',
      action: () => {
        // Navigate to settings
        window.location.href = '/settings'
      }
    }
  ]

  return (
    <div className="card p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
      <div className="space-y-3">
        {actions.map((action) => (
          <button
            key={action.name}
            onClick={action.action}
            disabled={action.loading}
            className="w-full flex items-center gap-x-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors text-left"
          >
            <div className={`p-2 rounded-lg transition-colors ${action.color}`}>
              <action.icon className={`h-5 w-5 ${action.loading ? 'animate-spin' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{action.name}</p>
              <p className="text-sm text-gray-500 truncate">{action.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Create Workspace Modal */}
      {isCreatingWorkspace && (
        <CreateWorkspaceModal
          onClose={() => setIsCreatingWorkspace(false)}
        />
      )}
    </div>
  )
}

function CreateWorkspaceModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    cpu: '1',
    memory: '2Gi',
    storage: '5Gi'
  })

  const queryClient = useQueryClient()

  const createWorkspaceMutation = useMutation({
    mutationFn: k8sApi.createWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      onClose()
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createWorkspaceMutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-25" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create Workspace</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="input"
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">CPU</label>
                <select
                  value={formData.cpu}
                  onChange={(e) => setFormData(prev => ({ ...prev, cpu: e.target.value }))}
                  className="input"
                >
                  <option value="0.5">0.5</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="4">4</option>
                </select>
              </div>
              <div>
                <label className="label">Memory</label>
                <select
                  value={formData.memory}
                  onChange={(e) => setFormData(prev => ({ ...prev, memory: e.target.value }))}
                  className="input"
                >
                  <option value="1Gi">1Gi</option>
                  <option value="2Gi">2Gi</option>
                  <option value="4Gi">4Gi</option>
                  <option value="8Gi">8Gi</option>
                </select>
              </div>
              <div>
                <label className="label">Storage</label>
                <select
                  value={formData.storage}
                  onChange={(e) => setFormData(prev => ({ ...prev, storage: e.target.value }))}
                  className="input"
                >
                  <option value="5Gi">5Gi</option>
                  <option value="10Gi">10Gi</option>
                  <option value="20Gi">20Gi</option>
                  <option value="50Gi">50Gi</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createWorkspaceMutation.isPending}
                className="btn-primary flex-1"
              >
                {createWorkspaceMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
