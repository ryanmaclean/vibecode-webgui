/**
 * Index Coverage Dashboard Component
 * Real-time visualization of codebase indexing coverage and status
 */

'use client'

import React, { useState, useEffect, useCallback, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Database, Activity, TrendingUp, Clock, FileCode, CheckCircle } from 'lucide-react'

interface CoverageData {
  projectId: number
  coverage: {
    totalFiles: number
    indexedFiles: number
    unindexedFiles: number
    coveragePercentage: number
    totalChunks: number
  }
  status: {
    isIndexing: boolean
    lastIndexedAt: string | null
  }
}

interface DashboardData {
  status: string
  data: CoverageData
  timestamp: string
}

// Memoized helper functions to avoid recreating on each render
const getCoverageColor = (percentage: number) => {
  if (percentage >= 90) return 'text-green-600'
  if (percentage >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

const getCoverageBarColor = (percentage: number) => {
  if (percentage >= 90) return 'bg-green-500'
  if (percentage >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

const getHealthStatusColor = (percentage: number) => {
  if (percentage >= 90) return 'bg-green-500'
  if (percentage >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}

const formatTimestamp = (timestamp: string | null): string => {
  if (!timestamp) return 'Never'
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`

    return date.toLocaleString()
  } catch {
    return 'Invalid date'
  }
}

function IndexCoverageDashboard({ projectId }: { projectId: number }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Memoized fetch function to prevent recreation
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch(`/api/codebase-index/stats?projectId=${projectId}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const dashboardData = await response.json()
      setData(dashboardData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Auto-refresh effect with proper dependency
  useEffect(() => {
    fetchDashboardData()

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
    // No cleanup needed if autoRefresh is false
    return undefined
  }, [autoRefresh, fetchDashboardData])

  // Memoize auto-refresh handler
  const handleAutoRefreshChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoRefresh(e.target.checked)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading index coverage dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700">Error loading dashboard: {error}</span>
        </div>
        <button
          onClick={fetchDashboardData}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data || !data.data) {
    return (
      <div className="text-center py-8">
        <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No index coverage data available</p>
      </div>
    )
  }

  const { coverage, status } = data.data

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Codebase Index Coverage</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={handleAutoRefreshChange}
              className="mr-2"
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Indexing Status Banner */}
      {status.isIndexing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-blue-500 mr-2 animate-pulse" />
            <span className="text-blue-700 font-medium">Indexing in progress...</span>
          </div>
        </div>
      )}

      {/* Coverage Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Coverage</p>
                <p className={`text-2xl font-bold ${getCoverageColor(coverage.coveragePercentage)}`}>
                  {coverage.coveragePercentage.toFixed(1)}%
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${getHealthStatusColor(coverage.coveragePercentage)}`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Indexed Files</p>
                <p className="text-2xl font-bold">{formatNumber(coverage.indexedFiles)}</p>
                <p className="text-xs text-gray-500">of {formatNumber(coverage.totalFiles)} total</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Chunks</p>
                <p className="text-2xl font-bold">{formatNumber(coverage.totalChunks)}</p>
                <p className="text-xs text-gray-500">Code segments</p>
              </div>
              <FileCode className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Last Indexed</p>
                <p className="text-xl font-bold">{formatTimestamp(status.lastIndexedAt)}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Coverage Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Database className="h-5 w-5 mr-2 text-blue-500" />
              Coverage Details
            </CardTitle>
            <Badge variant={coverage.coveragePercentage >= 90 ? 'secondary' : 'destructive'}>
              {coverage.coveragePercentage >= 90 ? 'Healthy' : coverage.coveragePercentage >= 70 ? 'Warning' : 'Critical'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Indexing Progress</span>
              <span className={`text-sm font-bold ${getCoverageColor(coverage.coveragePercentage)}`}>
                {coverage.coveragePercentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${getCoverageBarColor(coverage.coveragePercentage)}`}
                style={{ width: `${Math.min(coverage.coveragePercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* File Statistics */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div>
              <p className="text-sm text-gray-600">Total Files</p>
              <p className="text-2xl font-bold">{coverage.totalFiles.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Indexed</p>
              <p className="text-2xl font-bold text-green-600">{coverage.indexedFiles.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining</p>
              <p className="text-2xl font-bold text-gray-600">{coverage.unindexedFiles.toLocaleString()}</p>
            </div>
          </div>

          {/* Chunk Statistics */}
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Code Chunks Generated</p>
                <p className="text-lg font-semibold">{coverage.totalChunks.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Avg Chunks per File</p>
                <p className="text-lg font-semibold">
                  {coverage.indexedFiles > 0
                    ? (coverage.totalChunks / coverage.indexedFiles).toFixed(1)
                    : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Status Information */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Activity className={`h-4 w-4 mr-2 ${status.isIndexing ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
                <span className="text-sm text-gray-600">
                  Status: <span className={`font-medium ${status.isIndexing ? 'text-blue-600' : 'text-gray-600'}`}>
                    {status.isIndexing ? 'Indexing' : 'Idle'}
                  </span>
                </span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Last indexed: <span className="font-medium">{formatTimestamp(status.lastIndexedAt)}</span>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coverage Status Alert */}
      {coverage.coveragePercentage < 90 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-yellow-500" />
              Coverage Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 rounded-lg border border-yellow-500 bg-yellow-50">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm mb-1">
                    {coverage.coveragePercentage < 70
                      ? 'Low indexing coverage detected. Consider running a full reindex to improve AI accuracy.'
                      : 'Coverage is below optimal level. A full reindex may improve AI suggestions.'}
                  </p>
                  <p className="text-xs text-gray-600">
                    Action: Use the manual reindex button below to update the codebase index.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  )
}

export default memo(IndexCoverageDashboard)
