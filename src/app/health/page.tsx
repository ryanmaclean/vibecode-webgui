/**
 * Service Health Monitoring Page
 *
 * Displays real-time health status for the 5-service VM stack:
 * - SSH (Dropbear)
 * - PostgreSQL
 * - Valkey/Redis
 * - OpenVSCode
 * - Docker
 *
 * Features:
 * - Auto-refresh via polling (every 5 seconds)
 * - Per-service health cards with status, latency, last checked
 * - Restart button per service (calls POST /api/services/restart/[name])
 * - Overall health summary header
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { AggregatedHealthResponse, ServiceHealthResult, ServiceName } from '@/types/health'

const POLL_INTERVAL_MS = 5000

const SERVICE_DISPLAY: Record<ServiceName, { label: string; description: string }> = {
  ssh: { label: 'SSH (Dropbear)', description: 'Secure shell access on port 2222' },
  postgresql: { label: 'PostgreSQL', description: 'Primary database on port 5432' },
  valkey: { label: 'Valkey', description: 'In-memory cache on port 6379' },
  openvscode: { label: 'OpenVSCode', description: 'Browser IDE on port 3000' },
  docker: { label: 'Docker', description: 'Container runtime on port 2375' },
}

type RestartingState = Record<string, boolean>

export default function HealthPage() {
  const [healthData, setHealthData] = useState<AggregatedHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restarting, setRestarting] = useState<RestartingState>({})
  const [restartMessages, setRestartMessages] = useState<Record<string, { success: boolean; message: string }>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health/services')
      if (!res.ok && res.status !== 207 && res.status !== 503) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setHealthData(data as AggregatedHealthResponse)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    intervalRef.current = setInterval(fetchHealth, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchHealth])

  const handleRestart = async (serviceName: ServiceName) => {
    setRestarting((prev) => ({ ...prev, [serviceName]: true }))
    setRestartMessages((prev) => {
      const next = { ...prev }
      delete next[serviceName]
      return next
    })

    try {
      const res = await fetch(`/api/services/restart/${serviceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verifyHealth: true }),
      })
      const data = await res.json()

      if (data.success) {
        setRestartMessages((prev) => ({
          ...prev,
          [serviceName]: { success: true, message: 'Restart completed successfully' },
        }))
        // Refresh health data after restart
        fetchHealth()
      } else {
        setRestartMessages((prev) => ({
          ...prev,
          [serviceName]: { success: false, message: data.error || 'Restart failed' },
        }))
      }
    } catch (err) {
      setRestartMessages((prev) => ({
        ...prev,
        [serviceName]: {
          success: false,
          message: err instanceof Error ? err.message : 'Restart request failed',
        },
      }))
    } finally {
      setRestarting((prev) => ({ ...prev, [serviceName]: false }))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'degraded':
        return 'text-yellow-600'
      case 'unhealthy':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800'
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800'
      case 'unhealthy':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'unhealthy':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const formatLatency = (ms: number) => {
    if (ms < 1) return '<1ms'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso)
      return date.toLocaleTimeString()
    } catch {
      return 'Unknown'
    }
  }

  if (loading && !healthData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading health status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Service Health</h1>
          <p className="mt-2 text-gray-600">
            Real-time health monitoring for VM stack services
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">
              Failed to fetch health data: {error}
            </p>
          </div>
        )}

        {/* Overall Health Summary */}
        {healthData && (
          <div data-testid="health-summary" className="mb-8 bg-white rounded-lg shadow border p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`h-4 w-4 rounded-full ${getStatusDot(healthData.status)}`}></div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Overall Status</h2>
                  <span className={`text-lg font-bold ${getStatusColor(healthData.status)}`}>
                    {healthData.status.charAt(0).toUpperCase() + healthData.status.slice(1)}
                  </span>
                </div>
              </div>
              <div className="flex gap-6 text-sm text-gray-600">
                <div>
                  <span className="font-medium text-green-600">{healthData.summary.healthy}</span> Healthy
                </div>
                <div>
                  <span className="font-medium text-red-600">{healthData.summary.unhealthy}</span> Unhealthy
                </div>
                <div>
                  <span className="font-medium text-gray-500">{healthData.summary.unknown}</span> Unknown
                </div>
                <div className="text-gray-400">
                  Check time: {formatLatency(healthData.totalCheckTimeMs)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Service Health Cards */}
        {healthData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {healthData.services.map((service: ServiceHealthResult) => {
              const display = SERVICE_DISPLAY[service.name] || {
                label: service.name,
                description: '',
              }
              const isRestarting = restarting[service.name] || false
              const restartMsg = restartMessages[service.name]

              return (
                <div
                  key={service.name}
                  data-testid={`service-card-${service.name}`}
                  className="bg-white rounded-lg shadow border p-6 flex flex-col"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{display.label}</h3>
                      <p className="text-sm text-gray-500">{display.description}</p>
                    </div>
                    <span
                      data-testid={`status-badge-${service.name}`}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBg(service.status)}`}
                    >
                      <span className={`mr-1.5 h-2 w-2 rounded-full ${getStatusDot(service.status)}`}></span>
                      {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                    </span>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-2 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Latency</span>
                      <span className="font-medium text-gray-900">
                        {formatLatency(service.latencyMs)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Last Checked</span>
                      <span className="font-medium text-gray-900">
                        {formatTime(service.lastChecked)}
                      </span>
                    </div>
                    {service.error && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
                        {service.error}
                      </div>
                    )}
                  </div>

                  {/* Restart Message */}
                  {restartMsg && (
                    <div
                      className={`mt-3 p-2 rounded text-xs ${
                        restartMsg.success
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {restartMsg.message}
                    </div>
                  )}

                  {/* Restart Button */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      data-testid={`restart-btn-${service.name}`}
                      onClick={() => handleRestart(service.name)}
                      disabled={isRestarting}
                      className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isRestarting
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      {isRestarting ? 'Restarting...' : 'Restart Service'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer info */}
        {healthData && (
          <div className="mt-8 text-center text-sm text-gray-400">
            Auto-refreshing every {POLL_INTERVAL_MS / 1000} seconds |{' '}
            Last update: {formatTime(healthData.timestamp)}
          </div>
        )}
      </div>
    </div>
  )
}
