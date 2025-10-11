/**
 * Template configurator component for customizing project templates
 */

'use client'

import React, { useState, useEffect } from 'react'
import { ProjectTemplate, EnvVariable } from '@/lib/templates'
import { GenerateFromTemplateOptions } from '@/lib/templates/generator'
import { 
  CogIcon, 
  InformationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface TemplateConfiguratorProps {
  template: ProjectTemplate
  onConfigurationChange: (options: GenerateFromTemplateOptions) => void
  className?: string
}

export function TemplateConfigurator({ 
  template, 
  onConfigurationChange, 
  className 
}: TemplateConfiguratorProps) {
  const [projectName, setProjectName] = useState('')
  const [customizations, setCustomizations] = useState({
    packageName: '',
    description: template.description,
    author: '',
    license: 'MIT',
    gitRepository: ''
  })
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(template.features.slice())
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copiedEnv, setCopiedEnv] = useState<string | null>(null)

  // Update configuration whenever values change
  useEffect(() => {
    const options: GenerateFromTemplateOptions = {
      projectName: projectName || `my-${template.id}`,
      template: template.id,
      customizations,
      features: selectedFeatures,
      envOverrides
    }
    onConfigurationChange(options)
  }, [projectName, customizations, selectedFeatures, envOverrides, template.id, onConfigurationChange])

  const sanitizeProjectName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleProjectNameChange = (name: string) => {
    setProjectName(name)
    if (!customizations.packageName || customizations.packageName === sanitizeProjectName(projectName)) {
      setCustomizations(prev => ({
        ...prev,
        packageName: sanitizeProjectName(name)
      }))
    }
  }

  const handleFeatureToggle = (feature: string) => {
    setSelectedFeatures(prev => 
      prev.includes(feature)
        ? prev.filter(f => f !== feature)
        : [...prev, feature]
    )
  }

  const handleEnvChange = (envVar: EnvVariable, value: string) => {
    setEnvOverrides(prev => ({
      ...prev,
      [envVar.name]: value
    }))
  }

  const copyEnvExample = (envVar: EnvVariable) => {
    const value = envVar.example || envVar.defaultValue || ''
    navigator.clipboard.writeText(value)
    setCopiedEnv(envVar.name)
    setTimeout(() => setCopiedEnv(null), 2000)
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'beginner': return 'text-green-600 bg-green-100'
      case 'intermediate': return 'text-yellow-600 bg-yellow-100'
      case 'advanced': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'frontend': return '🎨'
      case 'backend': return '⚙️'
      case 'fullstack': return '🌐'
      case 'mobile': return '📱'
      case 'data': return '📊'
      case 'infrastructure': return '🏗️'
      default: return '📦'
    }
  }

  return (
    <div className={className}>
      {/* Template Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-3xl">{getCategoryIcon(template.category)}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-bold text-gray-900">{template.name}</h2>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(template.complexity)}`}>
                {template.complexity}
              </span>
            </div>
            <p className="text-gray-600 mb-3">{template.description}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {template.language.map(lang => (
                <span key={lang} className="px-2 py-1 bg-gray-100 text-xs text-gray-700 rounded">
                  {lang}
                </span>
              ))}
              {template.frameworks.map(framework => (
                <span key={framework} className="px-2 py-1 bg-blue-100 text-xs text-blue-700 rounded">
                  {framework}
                </span>
              ))}
            </div>
            <div className="text-sm text-gray-500">
              Estimated setup time: {template.estimatedSetupTime}
            </div>
          </div>
        </div>

        {/* Support Badges */}
        <div className="flex flex-wrap gap-2">
          {template.dockerSupport && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
              🐳 Docker
            </div>
          )}
          {template.kubernetesSupport && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">
              ☸️ Kubernetes
            </div>
          )}
          {template.testingSetup && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs">
              🧪 Testing
            </div>
          )}
          {template.cicdTemplate && (
            <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full text-xs">
              🚀 CI/CD
            </div>
          )}
          {template.monitoringSetup && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded-full text-xs">
              📊 Monitoring
            </div>
          )}
        </div>
      </div>

      {/* Configuration Form */}
      <div className="space-y-6">
        {/* Basic Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CogIcon className="h-5 w-5" />
            Basic Configuration
          </h3>

          <div className="space-y-4">
            {/* Project Name */}
            <div>
              <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                id="project-name"
                type="text"
                value={projectName}
                onChange={(e) => handleProjectNameChange(e.target.value)}
                placeholder={`my-${template.id}`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="project-name-input"
              />
              {projectName && (
                <p className="text-xs text-gray-500 mt-1">
                  Directory: {sanitizeProjectName(projectName)}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={customizations.description}
                onChange={(e) => setCustomizations(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="description-input"
              />
            </div>
          </div>
        </div>

        {/* Features Selection */}
        {template.features.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {template.features.map(feature => (
                <label key={feature} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(feature)}
                    onChange={() => handleFeatureToggle(feature)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    data-testid={`feature-${feature.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  <span className="ml-2 text-sm text-gray-700">{feature}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Environment Variables */}
        {template.envVars.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <InformationCircleIcon className="h-5 w-5" />
              Environment Variables
            </h3>
            <div className="space-y-4">
              {template.envVars.map(envVar => (
                <div key={envVar.name} className="border-l-4 border-blue-200 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      {envVar.name}
                      {envVar.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {envVar.example && (
                      <button
                        onClick={() => copyEnvExample(envVar)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                        title="Copy example value"
                      >
                        {copiedEnv === envVar.name ? (
                          <CheckCircleIcon className="h-3 w-3 text-green-500" />
                        ) : (
                          <DocumentDuplicateIcon className="h-3 w-3" />
                        )}
                        Example
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={envOverrides[envVar.name] || envVar.defaultValue || ''}
                    onChange={(e) => handleEnvChange(envVar, e.target.value)}
                    placeholder={envVar.example || 'Enter value...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    data-testid={`env-${envVar.name.toLowerCase().replace(/_/g, '-')}`}
                  />
                  <p className="text-xs text-gray-500 mt-1">{envVar.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {showAdvanced ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              Advanced Configuration
            </h3>
            <span className="text-sm text-gray-500">
              {showAdvanced ? 'Hide' : 'Show'} advanced options
            </span>
          </button>

          {showAdvanced && (
            <div className="px-6 pb-6 border-t border-gray-200">
              <div className="space-y-4 pt-4">
                {/* Package Name */}
                <div>
                  <label htmlFor="package-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Package Name
                  </label>
                  <input
                    id="package-name"
                    type="text"
                    value={customizations.packageName}
                    onChange={(e) => setCustomizations(prev => ({ ...prev, packageName: e.target.value }))}
                    placeholder={sanitizeProjectName(projectName || `my-${template.id}`)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    data-testid="package-name-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used in package.json and other configuration files
                  </p>
                </div>

                {/* Author */}
                <div>
                  <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
                    Author
                  </label>
                  <input
                    id="author"
                    type="text"
                    value={customizations.author}
                    onChange={(e) => setCustomizations(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="Your Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    data-testid="author-input"
                  />
                </div>

                {/* License */}
                <div>
                  <label htmlFor="license" className="block text-sm font-medium text-gray-700 mb-1">
                    License
                  </label>
                  <select
                    id="license"
                    value={customizations.license}
                    onChange={(e) => setCustomizations(prev => ({ ...prev, license: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    data-testid="license-select"
                  >
                    <option value="MIT">MIT</option>
                    <option value="Apache-2.0">Apache 2.0</option>
                    <option value="GPL-3.0">GPL 3.0</option>
                    <option value="BSD-3-Clause">BSD 3-Clause</option>
                    <option value="ISC">ISC</option>
                    <option value="UNLICENSED">Unlicensed</option>
                  </select>
                </div>

                {/* Folder Repository */}
                <div>
                  <label htmlFor="git-repo" className="block text-sm font-medium text-gray-700 mb-1">
                    Folder Repository
                  </label>
                  <input
                    id="git-repo"
                    type="url"
                    value={customizations.gitRepository}
                    onChange={(e) => setCustomizations(prev => ({ ...prev, gitRepository: e.target.value }))}
                    placeholder="https://github.com/username/repo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    data-testid="git-repo-input"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Setup Instructions Preview */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Setup Instructions</h3>
          <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-sm overflow-x-auto">
            <div className="space-y-1">
              <div>$ cd {projectName || `my-${template.id}`}</div>
              {template.documentation.setup.map((step, index) => (
                <div key={index}>$ {step}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}