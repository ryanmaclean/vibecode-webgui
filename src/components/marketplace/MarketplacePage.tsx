/**
 * Main marketplace page combining browsing and submission
 */

'use client'

import React, { useState, useCallback } from 'react'
import { TemplateMarketplace } from './TemplateMarketplace'
import { TemplateSubmissionForm } from './TemplateSubmissionForm'
import { type MarketplaceTemplate } from '@/lib/marketplace/template-marketplace'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'

interface MarketplacePageProps {
  onSelectTemplate?: (template: MarketplaceTemplate) => void
  onStartProject?: (template: MarketplaceTemplate) => void
  selectedCategory?: string
}

export function MarketplacePage({ 
  onSelectTemplate, 
  onStartProject,
  selectedCategory 
}: MarketplacePageProps) {
  const [view, setView] = useState<'browse' | 'submit'>('browse')
  const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplate | null>(null)

  const handleSelectTemplate = (template: MarketplaceTemplate | Record<string, unknown>) => {
    const marketplaceTemplate = template as MarketplaceTemplate
    setSelectedTemplate(marketplaceTemplate)
    onSelectTemplate?.(marketplaceTemplate)

    // If onStartProject is provided, use it; otherwise use onSelectTemplate
    if (onStartProject) {
      onStartProject(marketplaceTemplate)
    }
  }

  const handleSubmissionComplete = (submissionId: string) => {
    // Show success message and return to browse view
    console.info('Template submitted successfully:', submissionId)
    setView('browse')
  }

  const handleCancelSubmission = () => {
    setView('browse')
  }

  /**
   * Submit template to the backend API
   */
  const submitTemplateToAPI = useCallback(async (data: Parameters<typeof handleSubmissionComplete>[0] extends string ? any : any) => {
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        description: data.description,
        category: data.category,
        language: data.language,
        framework: data.framework,
        complexity: data.complexity,
        tags: data.tags,
        dependencies: data.dependencies,
        scripts: data.scripts,
        envVars: data.envVars,
        documentation: data.documentation,
        features: {
          dockerSupport: data.dockerSupport,
          kubernetesSupport: data.kubernetesSupport,
          cicdTemplate: data.cicdTemplate,
          testingSetup: data.testingSetup,
          monitoringSetup: data.monitoringSetup
        }
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `Failed to submit template: ${response.status}`)
    }

    const result = await response.json()
    handleSubmissionComplete(result.id || result.templateId || 'new-submission')
  }, [])

  if (view === 'submit') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={() => setView('browse')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                Back to Marketplace
              </button>
            </div>
          </div>
        </div>

        <div className="py-8">
          <TemplateSubmissionForm
            onSubmit={submitTemplateToAPI}
            onCancel={handleCancelSubmission}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <MagnifyingGlassIcon className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Template Marketplace</h1>
                <p className="text-sm text-gray-500">Discover and share development templates</p>
              </div>
            </div>
            
            <button
              onClick={() => setView('submit')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Submit Template
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TemplateMarketplace
          onTemplateSelect={(template) => handleSelectTemplate(template as unknown as MarketplaceTemplate)}
          selectedTemplateId={selectedTemplate?.id}
          selectedCategory={selectedCategory}
        />
      </div>

      {/* Selected Template Info (if needed) */}
      {selectedTemplate && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-medium text-gray-900">{selectedTemplate.name}</h4>
              <p className="text-sm text-gray-600">Selected for project generation</p>
            </div>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onStartProject?.(selectedTemplate)}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Start Project
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
