import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Play, 
  Square, 
  Trash2, 
  ExternalLink,
  Cpu,
  HardDrive,
  Clock
} from 'lucide-react'
import { k8sApi } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import type { Workspace } from '../types'

export function Workspaces() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: k8sApi.getWorkspaces,
    refetchInterval: 30000
  })

  const deleteWorkspaceMutation = useMutation({
    mutationFn: k8sApi.deleteWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    }
  })

  const filteredWorkspaces = workspaces?.filter(workspace => {
    const matchesSearch = workspace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workspace.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || workspace.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: Workspace['status']) => {
    const statusConfig = {
      running: 'badge-success',
      stopped: 'badge-error',
      pending: 'badge-warning',
      error: 'badge-error'
    }
    return statusConfig[status]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage development workspaces across your cluster.
          </p>
        </div>
        <button className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Workspace
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search workspaces..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="pending">Pending</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Workspaces Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkspaces?.map((workspace) => (
            <WorkspaceCard 
              key={workspace.id} 
              workspace={workspace}
              onDelete={() => deleteWorkspaceMutation.mutate(workspace.id)}
            />
          ))}
        </div>
      )}

      {filteredWorkspaces?.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-4h-2M9 5h6" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No workspaces found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Get started by creating a new workspace.'
            }
          </p>
        </div>
      )}
    </div>
  )
}

function WorkspaceCard({ 
  workspace, 
  onDelete 
}: { 
  workspace: Workspace
  onDelete: () => void 
}) {
  const [showActions, setShowActions] = useState(false)

  const getStatusBadge = (status: Workspace['status']) => {
    const statusConfig = {
      running: 'badge-success',
      stopped: 'badge-error',
      pending: 'badge-warning',
      error: 'badge-error'
    }
    return statusConfig[status]
  }

  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">{workspace.name}</h3>
          <p className="text-sm text-gray-500">{workspace.userEmail}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${getStatusBadge(workspace.status)}`}>
            {workspace.status}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1 rounded-md hover:bg-gray-100"
            >
              <MoreVertical className="h-4 w-4 text-gray-400" />
            </button>
            {showActions && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <div className="py-1">
                  {workspace.status === 'running' && (
                    <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </button>
                  )}
                  {workspace.status === 'stopped' && (
                    <button className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </button>
                  )}
                  <a 
                    href={workspace.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open
                  </a>
                  <button 
                    onClick={onDelete}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resource Info */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{workspace.resources.cpu} CPU</span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{workspace.resources.memory}</span>
        </div>
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{workspace.resources.storage}</span>
        </div>
      </div>

      {/* Timestamps */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Created {formatDistanceToNow(new Date(workspace.createdAt), { addSuffix: true })}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last accessed {formatDistanceToNow(new Date(workspace.lastAccessed), { addSuffix: true })}
        </div>
      </div>
    </div>
  )
}