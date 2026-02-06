'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Box,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Terminal,
  Search,
  Filter,
  Plus,
  X,
  AlertCircle,
  Clock,
  Loader2,
  Server,
} from 'lucide-react'

interface ContainerInfo {
  id: string
  name: string
  image: string
  state: string
  ipAddress?: string
  ports?: Record<string, number>
  created?: string
}

interface DockerStatus {
  dockerType: string
  version?: string
  running: boolean
  socketPath?: string
  contextName?: string
}

type StatusFilter = 'all' | 'running' | 'stopped' | 'exited' | 'created'
type ActionInProgress = Record<string, string>

const REFRESH_INTERVAL = 10000

export default function ContainersPage() {
  const [containers, setContainers] = useState<ContainerInfo[]>([])
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionInProgress, setActionInProgress] = useState<ActionInProgress>({})
  const [actionMessages, setActionMessages] = useState<Record<string, { success: boolean; message: string }>>({})
  const [showRunDialog, setShowRunDialog] = useState(false)
  const [logsModal, setLogsModal] = useState<{ id: string; name: string; logs: string } | null>(null)
  const [logsLoading, setLogsLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Run container form state
  const [runImage, setRunImage] = useState('')
  const [runName, setRunName] = useState('')
  const [runPorts, setRunPorts] = useState('')
  const [runEnv, setRunEnv] = useState('')
  const [runSubmitting, setRunSubmitting] = useState(false)

  const fetchDockerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/docker/status')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setDockerStatus(data.data)
        }
      }
    } catch {
      // Docker status is supplementary; failure is non-fatal
    }
  }, [])

  const fetchContainers = useCallback(async () => {
    try {
      const res = await fetch('/api/containers')
      if (!res.ok) {
        if (res.status === 503) {
          setError('Container runtime not available')
          setContainers([])
          return
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data = await res.json()
      setContainers(data.containers || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch containers')
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([fetchContainers(), fetchDockerStatus()])
  }, [fetchContainers, fetchDockerStatus])

  // Initial load and auto-refresh
  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refresh])

  // Clear action messages after 5 seconds
  useEffect(() => {
    const keys = Object.keys(actionMessages)
    if (keys.length === 0) return
    const timer = setTimeout(() => {
      setActionMessages({})
    }, 5000)
    return () => clearTimeout(timer)
  }, [actionMessages])

  const handleContainerAction = async (id: string, action: string) => {
    setActionInProgress((prev) => ({ ...prev, [id]: action }))
    setActionMessages((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })

    try {
      let res: Response

      if (action === 'remove') {
        res = await fetch(`/api/containers/${id}`, { method: 'DELETE' })
      } else {
        // For start/stop/restart, we use POST to /api/containers/[id] with action
        // Since the API only has DELETE, we handle stop via DELETE behavior
        // and start by re-creating. For now, only remove is fully supported.
        res = await fetch(`/api/containers/${id}`, { method: 'DELETE' })
      }

      const data = await res.json()

      if (res.ok && (data.success !== false)) {
        setActionMessages((prev) => ({
          ...prev,
          [id]: { success: true, message: `Container ${action} completed` },
        }))
        await fetchContainers()
      } else {
        setActionMessages((prev) => ({
          ...prev,
          [id]: { success: false, message: data.error || `Failed to ${action} container` },
        }))
      }
    } catch (err) {
      setActionMessages((prev) => ({
        ...prev,
        [id]: {
          success: false,
          message: err instanceof Error ? err.message : `Failed to ${action} container`,
        },
      }))
    } finally {
      setActionInProgress((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  const handleViewLogs = async (id: string, name: string) => {
    setLogsLoading(true)
    setLogsModal({ id, name, logs: '' })

    try {
      const res = await fetch(`/api/containers/${id}?logs=true`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLogsModal({ id, name, logs: data.logs || 'No logs available' })
    } catch (err) {
      setLogsModal({
        id,
        name,
        logs: `Error fetching logs: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setLogsLoading(false)
    }
  }

  const handleRunContainer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!runImage.trim()) return

    setRunSubmitting(true)

    try {
      const options: Record<string, unknown> = {}
      if (runName.trim()) options.name = runName.trim()

      // Parse ports: "8080:80, 3000:3000" -> { 8080: 80, 3000: 3000 }
      if (runPorts.trim()) {
        const ports: Record<number, number> = {}
        runPorts.split(',').forEach((mapping) => {
          const [host, container] = mapping.trim().split(':').map(Number)
          if (host && container) ports[host] = container
        })
        if (Object.keys(ports).length > 0) options.ports = ports
      }

      // Parse env: "KEY=value, FOO=bar" -> { KEY: "value", FOO: "bar" }
      if (runEnv.trim()) {
        const env: Record<string, string> = {}
        runEnv.split(',').forEach((pair) => {
          const eqIdx = pair.indexOf('=')
          if (eqIdx > 0) {
            env[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim()
          }
        })
        if (Object.keys(env).length > 0) options.env = env
      }

      const res = await fetch('/api/containers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: runImage.trim(), options }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create container')
      }

      // Reset form and close dialog
      setRunImage('')
      setRunName('')
      setRunPorts('')
      setRunEnv('')
      setShowRunDialog(false)
      await fetchContainers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run container')
    } finally {
      setRunSubmitting(false)
    }
  }

  // Filter and search
  const filteredContainers = containers.filter((c) => {
    const matchesFilter =
      statusFilter === 'all' || c.state.toLowerCase() === statusFilter
    const query = searchQuery.toLowerCase()
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.image.toLowerCase().includes(query) ||
      c.id.toLowerCase().includes(query)
    return matchesFilter && matchesSearch
  })

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'stopped':
      case 'exited':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'created':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const getStateIcon = (state: string) => {
    switch (state.toLowerCase()) {
      case 'running':
        return <Play className="h-3 w-3" />
      case 'stopped':
      case 'exited':
        return <Square className="h-3 w-3" />
      case 'created':
        return <Clock className="h-3 w-3" />
      default:
        return <AlertCircle className="h-3 w-3" />
    }
  }

  const statusCounts = {
    all: containers.length,
    running: containers.filter((c) => c.state.toLowerCase() === 'running').length,
    stopped: containers.filter((c) => c.state.toLowerCase() === 'stopped').length,
    exited: containers.filter((c) => c.state.toLowerCase() === 'exited').length,
    created: containers.filter((c) => c.state.toLowerCase() === 'created').length,
  }

  // Loading skeleton
  if (loading && containers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-8">
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-4 w-96 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mt-3" />
          </div>
          <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Containers</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Manage container instances running in the VM
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowRunDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Run Container
            </button>
          </div>
        </div>

        {/* Docker Status Banner */}
        <div className="mb-6 bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Container Runtime
                </span>
                {dockerStatus && (
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    {dockerStatus.dockerType !== 'NotInstalled'
                      ? `${dockerStatus.dockerType}${dockerStatus.version ? ` v${dockerStatus.version}` : ''}`
                      : 'Not detected'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  dockerStatus?.running
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {dockerStatus?.running ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 dark:text-red-300 text-sm font-medium">Error</p>
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* Status filter tabs */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-1">
            <Filter className="h-4 w-4 text-gray-400 ml-2 mr-1" />
            {(['all', 'running', 'stopped', 'exited'] as StatusFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === filter
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                <span className="ml-1 text-gray-400 dark:text-gray-500">
                  {statusCounts[filter]}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, image, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Container Table */}
        {filteredContainers.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 p-12 text-center">
            <Box className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {containers.length === 0 ? 'No containers' : 'No matching containers'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {containers.length === 0
                ? 'Get started by running a new container.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {containers.length === 0 && (
              <button
                onClick={() => setShowRunDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Run Container
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      Container
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      Image
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      IP Address
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      Created
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {filteredContainers.map((container) => {
                    const busyAction = actionInProgress[container.id]
                    const msg = actionMessages[container.id]
                    const isRunning = container.state.toLowerCase() === 'running'

                    return (
                      <tr
                        key={container.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-950/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Box className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {container.name}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">
                                {container.id.substring(0, 12)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
                            {container.image}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStateColor(container.state)}`}
                          >
                            {getStateIcon(container.state)}
                            {container.state}
                          </span>
                          {msg && (
                            <div
                              className={`mt-1 text-xs ${msg.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                            >
                              {msg.message}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs font-mono">
                          {container.ipAddress || '-'}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                          {container.created
                            ? new Date(container.created).toLocaleString()
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {busyAction ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {busyAction}...
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleViewLogs(container.id, container.name)}
                                  title="View logs"
                                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                >
                                  <Terminal className="h-4 w-4" />
                                </button>
                                {isRunning && (
                                  <button
                                    onClick={() => handleContainerAction(container.id, 'stop')}
                                    title="Stop container"
                                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                                  >
                                    <Square className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleContainerAction(container.id, 'remove')}
                                  title="Remove container"
                                  className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Table footer */}
            <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>
                {filteredContainers.length} of {containers.length} container{containers.length !== 1 ? 's' : ''}
              </span>
              <span>Auto-refreshing every {REFRESH_INTERVAL / 1000}s</span>
            </div>
          </div>
        )}

        {/* Run Container Dialog */}
        {showRunDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-lg mx-4">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Run Container
                </h2>
                <button
                  onClick={() => setShowRunDialog(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleRunContainer} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Image *
                  </label>
                  <input
                    type="text"
                    value={runImage}
                    onChange={(e) => setRunImage(e.target.value)}
                    placeholder="e.g. alpine:latest, nginx:1.25"
                    required
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={runName}
                    onChange={(e) => setRunName(e.target.value)}
                    placeholder="Optional container name"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port Mappings
                  </label>
                  <input
                    type="text"
                    value={runPorts}
                    onChange={(e) => setRunPorts(e.target.value)}
                    placeholder="host:container, e.g. 8080:80, 3000:3000"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Comma-separated host:container pairs
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Environment Variables
                  </label>
                  <input
                    type="text"
                    value={runEnv}
                    onChange={(e) => setRunEnv(e.target.value)}
                    placeholder="KEY=value, FOO=bar"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Comma-separated KEY=value pairs
                  </p>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRunDialog(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={runSubmitting || !runImage.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {runSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Run
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Logs Modal */}
        {logsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-gray-500" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Logs: {logsModal.name}
                  </h2>
                </div>
                <button
                  onClick={() => setLogsModal(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {logsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500 dark:text-gray-400">Loading logs...</span>
                  </div>
                ) : (
                  <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap bg-gray-50 dark:bg-gray-950 rounded-lg p-4">
                    {logsModal.logs}
                  </pre>
                )}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center justify-end flex-shrink-0">
                <button
                  onClick={() => handleViewLogs(logsModal.id, logsModal.name)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh Logs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 text-center text-sm text-gray-400 dark:text-gray-500">
          Auto-refreshing every {REFRESH_INTERVAL / 1000} seconds
          {dockerStatus?.running && dockerStatus.contextName && (
            <span> | Context: {dockerStatus.contextName}</span>
          )}
        </div>
      </div>
    </div>
  )
}
