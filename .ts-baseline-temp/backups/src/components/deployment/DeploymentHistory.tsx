/**
 * Deployment history and management component
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useCloudDeployment, useDeploymentMonitoring } from '@/hooks/useCloudDeployment'
import { CloudProvider, DeploymentResult } from '@/lib/deployment/cloud-automation'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  EyeIcon,
  _TrashIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export function DeploymentHistory() {
  const { deployments, getDeploymentHistory } = useCloudDeployment()
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentResult | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'provider' | 'status'>('date')
  const [filterBy, setFilterBy] = useState<'all' | 'success' | 'failed'>('all')

  const history = getDeploymentHistory()

  const filteredAndSortedHistory = React.useMemo(() => {
    let filtered = history

    // Apply filters
    if (filterBy !== 'all') {
      filtered = filtered.filter(deployment => 
        filterBy === 'success' ? deployment.success : !deployment.success
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.deploymentTime - a.deploymentTime
        case 'provider':
          return a.deploymentId.localeCompare(b.deploymentId) // Using deploymentId as proxy for provider
        case 'status':
          return Number(b.success) - Number(a.success)
        default:
          return 0
      }
    })

    return filtered
  }, [history, sortBy, filterBy])

  const getProviderFromUrl = (url: string): string => {
    if (url.includes('vercel.app')) return 'vercel'
    if (url.includes('netlify.app')) return 'netlify'
    if (url.includes('amazonaws.com')) return 'aws'
    if (url.includes('railway.app')) return 'railway'
    return 'unknown'
  }

  const getProviderColor = (provider: string) => {
    const colors = {
      vercel: 'bg-black text-white',
      netlify: 'bg-teal-500 text-white',
      aws: 'bg-orange-500 text-white',
      railway: 'bg-purple-600 text-white',
      unknown: 'bg-gray-500 text-white'
    }
    return colors[provider as keyof typeof colors] || colors.unknown
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Deployment History</h2>
        <p className="text-gray-600">
          View and manage your cloud deployments
        </p>
      </div>

      {/* Filters and Sorting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by status
            </label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All deployments</option>
              <option value="success">Successful only</option>
              <option value="failed">Failed only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">Date</option>
              <option value="provider">Provider</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {filteredAndSortedHistory.length} deployments
        </div>
      </div>

      {/* Deployment List */}
      {filteredAndSortedHistory.length === 0 ? (
        <div className="text-center py-12">
          <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No deployments yet</h3>
          <p className="text-gray-600">
            Deploy your first project to see it appear here
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredAndSortedHistory.map((deployment) => {
              const provider = getProviderFromUrl(deployment.url)
              return (
                <div key={deployment.deploymentId} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        deployment.success 
                          ? 'bg-green-100' 
                          : 'bg-red-100'
                      }`}>
                        {deployment.success ? (
                          <CheckCircleIcon className="h-6 w-6 text-green-600" />
                        ) : (
                          <XCircleIcon className="h-6 w-6 text-red-600" />
                        )}
                      </div>

                      {/* Deployment Info */}
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {deployment.deploymentId}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getProviderColor(provider)}`}>
                            {provider}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            deployment.success
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {deployment.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>{formatDate(deployment.deploymentTime)}</div>
                          <div className="flex items-center gap-4">
                            <span>Duration: {formatDuration(deployment.deploymentTime)}</span>
                            {deployment.estimatedCost !== undefined && (
                              <span>Cost: ${deployment.estimatedCost}/month</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {deployment.success && (
                        <a
                          href={deployment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View deployment"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </a>
                      )}
                      <button
                        onClick={() => setSelectedDeployment(
                          selectedDeployment?.deploymentId === deployment.deploymentId 
                            ? null 
                            : deployment
                        )}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                        title="View details"
                      >
                        <EyeIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Deployment Details (Expanded) */}
                  {selectedDeployment?.deploymentId === deployment.deploymentId && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Deployment URL */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Deployment URL</h4>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <code className="text-sm flex-1 break-all">{deployment.url}</code>
                              {deployment.success && (
                                <a
                                  href={deployment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Preview URL */}
                        {deployment.previewUrl && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Preview URL</h4>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <code className="text-sm flex-1 break-all">{deployment.previewUrl}</code>
                                <a
                                  href={deployment.previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Build Logs */}
                        {deployment.buildLogs && deployment.buildLogs.length > 0 && (
                          <div className="md:col-span-2">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Build Logs</h4>
                            <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm font-mono overflow-auto max-h-48">
                              {deployment.buildLogs.map((log, index) => (
                                <div key={index} className="py-1">
                                  {log}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Error Details */}
                        {!deployment.success && deployment.error && (
                          <div className="md:col-span-2">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Error Details</h4>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <div className="text-sm text-red-700">{deployment.error}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Individual deployment monitoring component
interface DeploymentMonitorProps {
  deploymentId: string
  provider: CloudProvider
}

export function DeploymentMonitor({ deploymentId, provider }: DeploymentMonitorProps) {
  const { status, isLoading, checkStatus } = useDeploymentMonitoring(deploymentId, provider)

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [checkStatus])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Deployment Status</h3>
        <button
          onClick={checkStatus}
          disabled={isLoading}
          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {status && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              status.status === 'ready' ? 'bg-green-500' :
              status.status === 'building' ? 'bg-yellow-500 animate-pulse' :
              status.status === 'error' ? 'bg-red-500' :
              'bg-gray-500'
            }`} />
            <span className="capitalize font-medium">{status.status}</span>
          </div>

          {status.url && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">URL</div>
              <a
                href={status.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 break-all"
              >
                {status.url}
              </a>
            </div>
          )}

          {status.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm font-medium text-red-800 mb-1">Error</div>
              <div className="text-sm text-red-700">{status.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
