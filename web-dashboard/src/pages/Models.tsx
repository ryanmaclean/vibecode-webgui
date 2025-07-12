import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  RefreshCw, 
  Search, 
  Filter, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Bot,
  Zap
} from 'lucide-react'
import { aiApi } from '../services/api'
import type { AIModel } from '../types'

export function Models() {
  const [searchTerm, setSearchTerm] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'performance' | 'cost'>('name')
  const queryClient = useQueryClient()

  const { data: modelsData, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: aiApi.getModels
  })

  const refreshModelsMutation = useMutation({
    mutationFn: aiApi.refreshModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] })
    }
  })

  const models = modelsData?.models || []
  const providers = [...new Set(models.map(m => m.provider))].sort()

  const filteredAndSortedModels = models
    .filter(model => {
      const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           model.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesProvider = providerFilter === 'all' || model.provider === providerFilter
      return matchesSearch && matchesProvider
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'performance':
          return (b.performance?.successRate || 0) - (a.performance?.successRate || 0)
        case 'cost':
          return (a.pricing.prompt + a.pricing.completion) - (b.pricing.prompt + b.pricing.completion)
        default:
          return a.name.localeCompare(b.name)
      }
    })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Models</h1>
          <p className="mt-2 text-sm text-gray-700">
            Available AI models and their performance metrics.
          </p>
        </div>
        <button 
          onClick={() => refreshModelsMutation.mutate()}
          disabled={refreshModelsMutation.isPending}
          className="btn-primary"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshModelsMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Models
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center">
            <Bot className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Models</p>
              <p className="text-2xl font-semibold text-gray-900">{models.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Healthy</p>
              <p className="text-2xl font-semibold text-gray-900">
                {models.filter(m => m.isHealthy !== false).length}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <Zap className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Providers</p>
              <p className="text-2xl font-semibold text-gray-900">{providers.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Avg Success Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {(models.reduce((acc, m) => acc + (m.performance?.successRate || 1), 0) / models.length * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search models..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="all">All Providers</option>
            {providers.map(provider => (
              <option key={provider} value={provider}>{provider}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="input w-auto"
          >
            <option value="name">Sort by Name</option>
            <option value="performance">Sort by Performance</option>
            <option value="cost">Sort by Cost</option>
          </select>
        </div>
      </div>

      {/* Models Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Context Length
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pricing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                filteredAndSortedModels.map((model) => (
                  <ModelRow key={model.id} model={model} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredAndSortedModels.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Bot className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No models found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}
    </div>
  )
}

function ModelRow({ model }: { model: AIModel }) {
  const avgCost = (model.pricing.prompt + model.pricing.completion) / 2
  const performance = model.performance
  const isHealthy = model.isHealthy !== false

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-gray-900">{model.name}</div>
          <div className="text-sm text-gray-500 font-mono">{model.id}</div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {model.provider}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {model.context_length.toLocaleString()} tokens
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center text-sm text-gray-900">
          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
          ${avgCost.toFixed(6)}/1K
        </div>
        <div className="text-xs text-gray-500">
          ${model.pricing.prompt.toFixed(6)} / ${model.pricing.completion.toFixed(6)}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {performance ? (
          <div>
            <div className="flex items-center text-sm text-gray-900">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              {(performance.successRate * 100).toFixed(1)}%
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <Clock className="h-3 w-3 mr-1" />
              {performance.averageLatency.toFixed(0)}ms
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-400">No data</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {isHealthy ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Healthy
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Unhealthy
          </span>
        )}
      </td>
    </tr>
  )
}