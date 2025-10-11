/**
 * Main marketplace page combining browsing and submission
 */

'use client'

import React, { useState } from 'react'
import { TemplateMarketplace } from './TemplateMarketplace'
import { TemplateSubmissionForm } from './TemplateSubmissionForm'
import { type MarketplaceTemplate } from '@/lib/marketplace/template-marketplace'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentPlusIcon,
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

  const handleSelectTemplate = (template: MarketplaceTemplate) => {
    setSelectedTemplate(template)
    onSelectTemplate?.(template)
    
    // If onStartProject is provided, use it; otherwise use onSelectTemplate
    if (onStartProject) {
      onStartProject(template)
    }
  }

  const handleSubmissionComplete = (submissionId: string) => {
    // Show success message and return to browse view
    // Debug log removed
    setView('browse')
  }

  const handleCancelSubmission = () => {
    setView('browse')
  }

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
            onSubmissionComplete={handleSubmissionComplete}
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
          onSelectTemplate={handleSelectTemplate}
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