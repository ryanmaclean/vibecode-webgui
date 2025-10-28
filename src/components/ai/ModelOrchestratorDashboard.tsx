/**
 * Model orchestrator dashboard for monitoring and managing AI models
 */

'use client'

import React, { useState, useEffect } from 'react'
import { modelOrchestrator, ModelConfig, TaskType, RequestContext } from '@/lib/ai/model-orchestration'
import { 
ChartBarIcon, 
  CogIcon, 
  BoltIcon, 
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
// import { logger } from '@/lib/logger';

interface ModelStats {
  name: string
  requests: number
  tokens: number
  errors: number
  errorRate: number
  successRate: number
  averageLatency: number
  lastUsed: Date
}

export function ModelOrchestratorDashboard() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [modelStats, setModelStats] = useState<Record<string, ModelStats>>({})
  const [selectedTask, setSelectedTask] = useState<TaskType>(TaskType.CODE_GENERATION)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    if (selectedTask) {
      generateRecommendations()
    }
  }, [selectedTask])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      const availableModels = modelOrchestrator.getAvailableModels()
      const stats = modelOrchestrator.getModelStats()
      
      setModels(availableModels)
      setModelStats(stats)
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateRecommendations = () => {
    const context: RequestContext = {
      taskType: selectedTask,
      priority: 'medium',
      expectedTokens: 2000,
      requiresStreaming: false,
      requiresJsonMode: false,
      requiresFunctionCalling: false,
      requiresMultimodal: false
    }

    try {
      const recs = modelOrchestrator.recommendModels(context, 5)
      setRecommendations(recs)
    } catch (error) {
      console.error('Failed to generate recommendations:', error)
      setRecommendations([])
    }
  }

  const handleToggleModel = (modelId: string, enabled: boolean) => {
    modelOrchestrator.toggleModel(modelId, enabled)
    loadDashboardData()
  }

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      'openai': 'bg-green-100 text-green-800',
      'anthropic': 'bg-orange-100 text-orange-800',
      'google': 'bg-blue-100 text-blue-800',
      'meta': 'bg-purple-100 text-purple-800',
      'mistral': 'bg-red-100 text-red-800',
      'cohere': 'bg-yellow-100 text-yellow-800'
    }
    return colors[provider] || 'bg-gray-100 text-gray-800'
  }

  const formatNumber = (num: number, decimals: number = 0) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(decimals) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(decimals) + 'K'
    }
    return num.toFixed(decimals)
  }

  const getTaskDisplayName = (task: TaskType) => {
    return task.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Model Orchestrator</h2>
        <p className="text-gray-600">
          Monitor AI model performance and manage intelligent routing
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BoltIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Models</p>
              <p className="text-2xl font-bold text-gray-900">
                {models.filter(m => m.enabled).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(Object.values(modelStats).reduce((sum, stat) => sum + stat.requests, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ClockIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Latency</p>
              <p className="text-2xl font-bold text-gray-900">
                {Object.values(modelStats).length > 0 
                  ? Math.round(Object.values(modelStats).reduce((sum, stat) => sum + stat.averageLatency, 0) / Object.values(modelStats).length)
                  : 0}ms
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ExclamationTriangleIcon className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {Object.values(modelStats).length > 0 
                  ? (Object.values(modelStats).reduce((sum, stat) => sum + stat.errorRate, 0) / Object.values(modelStats).length * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Model Recommendations */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Model Recommendations</h3>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value as TaskType)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Object.values(TaskType).map(task => (
              <option key={task} value={task}>
                {getTaskDisplayName(task)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {recommendations.slice(0, 3).map((rec, index) => (
            <div 
              key={rec.primaryModel.id}
              className={`p-4 rounded-lg border-2 ${
                index === 0 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {index === 0 && <div className="text-green-600 font-bold">#1 Recommended</div>}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(rec.primaryModel.provider)}`}>
                    {rec.primaryModel.provider}
                  </span>
                  <span className="font-medium text-gray-900">{rec.primaryModel.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Confidence: {(rec.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="text-sm text-gray-600">
                      Est. Cost: ${rec.estimatedCost.toFixed(4)}
                    </span>
                    <span className="text-sm text-gray-600">
                      Est. Latency: {rec.estimatedLatency.toFixed(0)}ms
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{rec.reasoning}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Model List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Available Models</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capabilities
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {models.map((model) => {
                const stats = modelStats[model.id]
                return (
                  <tr key={model.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {model.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(model.provider)}`}>
                              {model.provider}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Code: {model.capabilities.codeGeneration}/10</div>
                          <div>Reasoning: {model.capabilities.reasoning}/10</div>
                          <div>Creativity: {model.capabilities.creativity}/10</div>
                          <div>Speed: {model.capabilities.speed} req/min</div>
                        </div>
                      </div>
                      <div className="mt-1 flex gap-1">
                        {model.capabilities.multimodal && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Multimodal
                          </span>
                        )}
                        {model.capabilities.functionCalling && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                            Functions
                          </span>
                        )}
                        {model.capabilities.streaming && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                            Streaming
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stats ? (
                        <div>
                          <div>Requests: {formatNumber(stats.requests)}</div>
                          <div>Success: {(stats.successRate * 100).toFixed(1)}%</div>
                          <div>Latency: {stats.averageLatency.toFixed(0)}ms</div>
                        </div>
                      ) : (
                        <div className="text-gray-500">No data</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {model.enabled ? (
                          <>
                            <CheckCircleIcon className="h-5 w-5 text-green-500" />
                            <span className="ml-2 text-sm text-green-800">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="h-5 w-5 text-red-500" />
                            <span className="ml-2 text-sm text-red-800">Disabled</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleToggleModel(model.id, !model.enabled)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          model.enabled
                            ? 'bg-red-100 text-red-800 hover:bg-red-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {model.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(modelStats).map(([modelId, stats]) => {
            const model = models.find(m => m.id === modelId)
            if (!model) return null
            
            return (
              <div key={modelId} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{model.name}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${getProviderColor(model.provider)}`}>
                    {model.provider}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Requests:</span>
                    <span>{formatNumber(stats.requests)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tokens:</span>
                    <span>{formatNumber(stats.tokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate:</span>
                    <span className={stats.successRate > 0.95 ? 'text-green-600' : stats.successRate > 0.9 ? 'text-yellow-600' : 'text-red-600'}>
                      {(stats.successRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Latency:</span>
                    <span>{stats.averageLatency.toFixed(0)}ms</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex">
          <InformationCircleIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              How Model Orchestration Works
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• <strong>Intelligent Routing:</strong> Automatically selects the best model based on task type, requirements, and performance</p>
              <p>• <strong>Capability Matching:</strong> Ensures models meet specific requirements like JSON mode, function calling, or multimodal support</p>
              <p>• <strong>Cost Optimization:</strong> Balances performance with cost based on priority and budget constraints</p>
              <p>• <strong>Fallback Strategy:</strong> Provides backup models if the primary selection fails</p>
              <p>• <strong>Real-time Monitoring:</strong> Tracks performance metrics and adapts recommendations based on actual usage</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}