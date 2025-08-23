/**
 * AI CLI Tools Management Panel
 * Provides interface for installing and managing AI coding CLI tools
 */

'use client'

import React, { useState, useEffect } from 'react'
import {
  Download,
  Trash2,
  Settings,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Code,
  Bot,
  GitBranch,
  Sparkles
} from 'lucide-react'

interface AICLITool {
  id: string
  name: string
  description: string
  license: string
  version: string
  models: string[]
  installed: boolean
  installation?: {
    id: string
    status: 'installing' | 'installed' | 'error'
    installedAt?: string
    configuration?: any
  }
}

interface AICLIToolsPanelProps {
  workspaceId?: string
  className?: string
}

export default function AICLIToolsPanel({
  workspaceId,
  className = ''
}: AICLIToolsPanelProps) {
  const [tools, setTools] = useState<AICLITool[]>([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  // Load available tools
  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/ai-cli-tools/install')
      if (!response.ok) {
        throw new Error('Failed to load tools')
      }

      const data = await response.json()
      setTools(data.tools || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools')
    } finally {
      setLoading(false)
    }
  }

  const installTool = async (toolId: string) => {
    try {
      setInstalling(toolId)
      setError(null)

      const response = await fetch('/api/ai-cli-tools/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toolId,
          options: {
            workspaceId,
            configuration: {}
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Installation failed')
      }

      // Reload tools to get updated status
      await loadTools()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed')
    } finally {
      setInstalling(null)
    }
  }

  const uninstallTool = async (toolId: string) => {
    try {
      setError(null)

      const response = await fetch(`/api/ai-cli-tools/uninstall`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ toolId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Uninstallation failed')
      }

      // Reload tools to get updated status
      await loadTools()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uninstallation failed')
    }
  }

  const getToolIcon = (toolId: string) => {
    switch (toolId) {
      case 'gemini-cli':
        return <Bot className="h-5 w-5 text-blue-500" />
      case 'opencode':
        return <Code className="h-5 w-5 text-green-500" />
      case 'codex-cli':
        return <Sparkles className="h-5 w-5 text-purple-500" />
      case 'aider':
        return <GitBranch className="h-5 w-5 text-orange-500" />
      default:
        return <Code className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusIcon = (tool: AICLITool) => {
    if (installing === tool.id) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    }

    if (tool.installation?.status === 'error') {
      return <XCircle className="h-4 w-4 text-red-500" />
    }

    if (tool.installed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }

    return <AlertCircle className="h-4 w-4 text-yellow-500" />
  }

  const getStatusText = (tool: AICLITool) => {
    if (installing === tool.id) {
      return 'Installing...'
    }

    if (tool.installation?.status === 'error') {
      return 'Installation failed'
    }

    if (tool.installed) {
      return 'Installed'
    }

    return 'Not installed'
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading AI CLI tools...</span>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">AI CLI Tools</h2>
            <p className="text-sm text-gray-600">
              Install and manage AI coding assistants
            </p>
          </div>
          <button
            onClick={loadTools}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh tools"
          >
            <Loader2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center">
            <XCircle className="h-4 w-4 text-red-500 mr-2" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Tools List */}
      <div className="divide-y divide-gray-200">
        {tools.map((tool) => (
          <div key={tool.id} className="px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                {getToolIcon(tool.id)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {tool.name}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {tool.license}
                    </span>
                    <span className="text-xs text-gray-500">
                      v{tool.version}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mt-1">
                    {tool.description}
                  </p>
                  
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(tool)}
                      <span className="text-xs text-gray-600">
                        {getStatusText(tool)}
                      </span>
                    </div>
                    
                    {tool.installed && tool.installation?.installedAt && (
                      <span className="text-xs text-gray-500">
                        Installed {new Date(tool.installation.installedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  {/* Models */}
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">Models: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tool.models.map((model) => (
                        <span
                          key={model}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                {tool.installed ? (
                  <>
                    <button
                      onClick={() => setSelectedTool(tool.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Configure"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => uninstallTool(tool.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Uninstall"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => installTool(tool.id)}
                    disabled={installing === tool.id}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {installing === tool.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Download className="h-3 w-3 mr-1" />
                    )}
                    Install
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {tools.length === 0 && !loading && (
        <div className="px-6 py-8 text-center">
          <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            No AI CLI tools available
          </h3>
          <p className="text-sm text-gray-600">
            AI CLI tools will appear here when they become available.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {tools.filter(t => t.installed).length} of {tools.length} tools installed
          </span>
          <a
            href="/docs/ai-cli-tools"
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            Documentation
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </div>
      </div>
    </div>
  )
} 