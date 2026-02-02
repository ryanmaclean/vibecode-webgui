/**
 * Cloud deployment modal for deploying generated projects
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useCloudDeployment, useProviderComparison } from '@/hooks/useCloudDeployment'
import { CloudProvider, DeploymentConfig, DEPLOYMENT_PRESETS } from '@/lib/deployment/cloud-automation'
import type { GeneratedProject } from '@/lib/templates/generator'
import {
  XMarkIcon,
  CloudIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
  CogIcon,
  BoltIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

interface CloudDeploymentModalProps {
  isOpen: boolean
  onClose: () => void
  generatedProject: GeneratedProject
  onSuccess: (deploymentUrl: string) => void
}

export function CloudDeploymentModal({
  isOpen,
  onClose,
  generatedProject,
  onSuccess
}: CloudDeploymentModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null)
  const [deploymentConfig, setDeploymentConfig] = useState<Partial<DeploymentConfig>>({
    projectName: generatedProject.name,
    environment: 'production',
    region: 'us-east-1',
    environmentVariables: {},
    autoScale: true
  })
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('react-app')

  const {
    deployProject,
    getProviderRecommendations,
    isDeploying,
    currentDeployment,
    error,
    clearError
  } = useCloudDeployment({
    onDeploymentComplete: (result) => {
      if (result.success) {
        onSuccess(result.url)
      }
    }
  })

  const { getProviderComparison } = useProviderComparison()
  const [recommendations, setRecommendations] = useState<Array<{
    provider: CloudProvider
    reasoning: string
    estimatedCost: number
  }>>([])

  useEffect(() => {
    if (isOpen) {
      const recs = getProviderRecommendations(generatedProject)
      setRecommendations(recs)
      
      // Auto-select the top recommendation
      if (recs.length > 0) {
        setSelectedProvider(recs[0].provider)
      }
    }
  }, [isOpen, generatedProject, getProviderRecommendations])

  useEffect(() => {
    // Apply deployment preset
    if (selectedPreset && DEPLOYMENT_PRESETS[selectedPreset]) {
      setDeploymentConfig(prev => ({
        ...prev,
        ...DEPLOYMENT_PRESETS[selectedPreset]
      }))
    }
  }, [selectedPreset])

  const handleDeploy = async () => {
    if (!selectedProvider) return

    const config: DeploymentConfig = {
      provider: selectedProvider,
      projectName: deploymentConfig.projectName || generatedProject.name,
      environment: deploymentConfig.environment || 'production',
      region: deploymentConfig.region,
      environmentVariables: deploymentConfig.environmentVariables,
      customDomain: deploymentConfig.customDomain,
      autoScale: deploymentConfig.autoScale,
      buildCommand: deploymentConfig.buildCommand,
      outputDirectory: deploymentConfig.outputDirectory,
      nodeVersion: deploymentConfig.nodeVersion
    }

    await deployProject(generatedProject, config)
  }

  const getProviderIcon = (provider: CloudProvider) => {
    const icons = {
      [CloudProvider.VERCEL]: '▲',
      [CloudProvider.NETLIFY]: '◆',
      [CloudProvider.AWS]: '☁',
      [CloudProvider.AZURE]: '◊',
      [CloudProvider.GCP]: '◯',
      [CloudProvider.DIGITALOCEAN]: '🌊',
      [CloudProvider.RAILWAY]: '🚂',
      [CloudProvider.RENDER]: '🎨'
    }
    return icons[provider] || '☁'
  }

  const getProviderColor = (provider: CloudProvider) => {
    const colors = {
      [CloudProvider.VERCEL]: 'bg-black text-white',
      [CloudProvider.NETLIFY]: 'bg-teal-500 text-white',
      [CloudProvider.AWS]: 'bg-orange-500 text-white',
      [CloudProvider.AZURE]: 'bg-blue-600 text-white',
      [CloudProvider.GCP]: 'bg-blue-400 text-white',
      [CloudProvider.DIGITALOCEAN]: 'bg-blue-500 text-white',
      [CloudProvider.RAILWAY]: 'bg-purple-600 text-white',
      [CloudProvider.RENDER]: 'bg-green-500 text-white'
    }
    return colors[provider] || 'bg-gray-500 text-white'
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deploy-modal-title"
    >
      <div className="bg-white rounded-lg w-full max-w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <CloudIcon className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="deploy-modal-title" className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Deploy to Cloud</h2>
              <p className="text-sm text-gray-600 truncate">Deploy &quot;{generatedProject.name}&quot; to your preferred cloud provider</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 sm:p-2 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6">
          {/* Success State */}
          {currentDeployment?.success && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Deployment Successful!</h3>
              <p className="text-gray-600 mb-4">Your project has been deployed to {selectedProvider}</p>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600 mb-2">Deployment URL:</div>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-3 py-1 rounded border text-sm flex-1">
                    {currentDeployment.url}
                  </code>
                  <a
                    href={currentDeployment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-600">Deployment Time</div>
                  <div className="font-medium">{(currentDeployment.deploymentTime / 1000).toFixed(1)}s</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-600">Estimated Cost</div>
                  <div className="font-medium">${currentDeployment.estimatedCost || 0}/month</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                Done
              </button>
            </div>
          )}

          {/* Configuration State */}
          {!currentDeployment?.success && (
            <div className="space-y-6">
              {/* Provider Recommendations */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recommended Providers</h3>
                <div className="grid gap-3">
                  {recommendations.slice(0, 3).map((rec, index) => (
                    <div
                      key={rec.provider}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedProvider === rec.provider
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProvider(rec.provider)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${getProviderColor(rec.provider)}`}>
                          {getProviderIcon(rec.provider)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{rec.provider}</span>
                            {index === 0 && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{rec.reasoning}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">${rec.estimatedCost}/month</div>
                          <div className="text-xs text-gray-500">estimated</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Basic Configuration */}
              {selectedProvider && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Deployment Configuration</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deployment Preset
                      </label>
                      <select
                        value={selectedPreset}
                        onChange={(e) => setSelectedPreset(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="static-site">Static Site</option>
                        <option value="react-app">React Application</option>
                        <option value="nextjs-app">Next.js Application</option>
                        <option value="node-api">Node.js API</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Project Name
                      </label>
                      <input
                        type="text"
                        value={deploymentConfig.projectName || ''}
                        onChange={(e) => setDeploymentConfig(prev => ({ ...prev, projectName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="my-awesome-project"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Environment
                      </label>
                      <select
                        value={deploymentConfig.environment || 'production'}
                        onChange={(e) => setDeploymentConfig(prev => ({ ...prev, environment: e.target.value as DeploymentConfig['environment'] }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="development">Development</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                      </select>
                    </div>

                    {/* Advanced Options Toggle */}
                    <button
                      onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                    >
                      <CogIcon className="h-4 w-4" />
                      {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
                    </button>

                    {/* Advanced Options */}
                    {showAdvancedOptions && (
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Build Command
                            </label>
                            <input
                              type="text"
                              value={deploymentConfig.buildCommand || ''}
                              onChange={(e) => setDeploymentConfig(prev => ({ ...prev, buildCommand: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="npm run build"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Output Directory
                            </label>
                            <input
                              type="text"
                              value={deploymentConfig.outputDirectory || ''}
                              onChange={(e) => setDeploymentConfig(prev => ({ ...prev, outputDirectory: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="dist"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Custom Domain (optional)
                          </label>
                          <input
                            type="text"
                            value={deploymentConfig.customDomain || ''}
                            onChange={(e) => setDeploymentConfig(prev => ({ ...prev, customDomain: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="my-app.com"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Auto Scaling</label>
                            <p className="text-xs text-gray-500">Automatically scale based on traffic</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={deploymentConfig.autoScale || false}
                            onChange={(e) => setDeploymentConfig(prev => ({ ...prev, autoScale: e.target.checked }))}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-red-800">Deployment Error</h4>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Deploy Button */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Ready to deploy to{' '}
                  {selectedProvider && (
                    <span className="font-medium capitalize">{selectedProvider}</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    disabled={isDeploying}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeploy}
                    disabled={!selectedProvider || isDeploying}
                    className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
                      !selectedProvider || isDeploying
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isDeploying ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <BoltIcon className="h-4 w-4" />
                        Deploy Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}