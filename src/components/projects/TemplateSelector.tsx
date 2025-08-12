/**
 * Template selector component for project scaffolding
 */

'use client'

import React, { useState, useMemo } from 'react'
import { PROJECT_TEMPLATES, ProjectTemplate, getTemplatesByCategory, searchTemplates } from '@/lib/templates'
import { ChevronDownIcon, MagnifyingGlassIcon, ClockIcon, CodeBracketIcon, CpuChipIcon } from '@heroicons/react/24/outline'

interface TemplateSelectorProps {
  onSelectTemplate: (template: ProjectTemplate) => void
  selectedTemplate?: ProjectTemplate
  className?: string
}

export function TemplateSelector({ onSelectTemplate, selectedTemplate, className }: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedComplexity, setSelectedComplexity] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const categories = useMemo(() => [
    'all',
    ...Array.from(new Set(PROJECT_TEMPLATES.map(t => t.category)))
  ], [])

  const complexityLevels = ['all', 'beginner', 'intermediate', 'advanced']

  const filteredTemplates = useMemo(() => {
    let templates = PROJECT_TEMPLATES

    // Filter by search query
    if (searchQuery.trim()) {
      templates = searchTemplates(searchQuery)
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      templates = templates.filter(t => t.category === selectedCategory)
    }

    // Filter by complexity
    if (selectedComplexity !== 'all') {
      templates = templates.filter(t => t.complexity === selectedComplexity)
    }

    return templates
  }, [searchQuery, selectedCategory, selectedComplexity])

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
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose a Template</h2>
        <p className="text-gray-600">
          Start with a production-ready template to accelerate your development
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            data-testid="template-search"
          />
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="category-filter"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Complexity Filter */}
          <div className="relative">
            <select
              value={selectedComplexity}
              onChange={(e) => setSelectedComplexity(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="complexity-filter"
            >
              {complexityLevels.map(level => (
                <option key={level} value={level}>
                  {level === 'all' ? 'All Levels' : level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* View Mode Toggle */}
          <div className="ml-auto flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md text-sm ${
                viewMode === 'grid' 
                  ? 'bg-white shadow text-gray-900' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="grid-view-button"
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded-md text-sm ${
                viewMode === 'list' 
                  ? 'bg-white shadow text-gray-900' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="list-view-button"
            >
              List
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          Showing {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Templates Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isSelected={selectedTemplate?.id === template.id}
              onClick={() => onSelectTemplate(template)}
              getCategoryIcon={getCategoryIcon}
              getComplexityColor={getComplexityColor}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map(template => (
            <TemplateListItem
              key={template.id}
              template={template}
              isSelected={selectedTemplate?.id === template.id}
              onClick={() => onSelectTemplate(template)}
              getCategoryIcon={getCategoryIcon}
              getComplexityColor={getComplexityColor}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search criteria or browse all available templates
          </p>
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('all')
              setSelectedComplexity('all')
            }}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}

interface TemplateCardProps {
  template: ProjectTemplate
  isSelected: boolean
  onClick: () => void
  getCategoryIcon: (category: string) => string
  getComplexityColor: (complexity: string) => string
}

function TemplateCard({ 
  template, 
  isSelected, 
  onClick, 
  getCategoryIcon, 
  getComplexityColor 
}: TemplateCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer border-2 rounded-lg p-6 transition-all duration-200 hover:shadow-lg
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
      data-testid={`template-${template.id}`}
    >
      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="text-2xl">{getCategoryIcon(template.category)}</div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(template.complexity)}`}>
          {template.complexity}
        </span>
      </div>

      {/* Template Info */}
      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
        {template.name}
      </h3>
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        {template.description}
      </p>

      {/* Languages & Frameworks */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-1 mb-2">
          {template.language.slice(0, 3).map(lang => (
            <span key={lang} className="px-2 py-1 bg-gray-100 text-xs text-gray-700 rounded">
              {lang}
            </span>
          ))}
          {template.language.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-xs text-gray-700 rounded">
              +{template.language.length - 3}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {template.frameworks.slice(0, 2).map(framework => (
            <span key={framework} className="px-2 py-1 bg-blue-100 text-xs text-blue-700 rounded">
              {framework}
            </span>
          ))}
          {template.frameworks.length > 2 && (
            <span className="px-2 py-1 bg-blue-100 text-xs text-blue-700 rounded">
              +{template.frameworks.length - 2}
            </span>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <ClockIcon className="h-3 w-3" />
            {template.estimatedSetupTime}
          </div>
          <div className="flex items-center gap-1">
            <CodeBracketIcon className="h-3 w-3" />
            {template.features.length} features
          </div>
        </div>
        {(template.dockerSupport || template.kubernetesSupport) && (
          <div className="flex items-center gap-1">
            <CpuChipIcon className="h-3 w-3" />
            <span>DevOps</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface TemplateListItemProps {
  template: ProjectTemplate
  isSelected: boolean
  onClick: () => void
  getCategoryIcon: (category: string) => string
  getComplexityColor: (complexity: string) => string
}

function TemplateListItem({ 
  template, 
  isSelected, 
  onClick, 
  getCategoryIcon, 
  getComplexityColor 
}: TemplateListItemProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer border-2 rounded-lg p-4 transition-all duration-200 hover:shadow-md
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-sm' 
          : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
      data-testid={`template-${template.id}`}
    >
      <div className="flex items-center gap-4">
        {/* Icon & Info */}
        <div className="flex items-center gap-3 flex-1">
          <div className="text-2xl">{getCategoryIcon(template.category)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getComplexityColor(template.complexity)}`}>
                {template.complexity}
              </span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-1">{template.description}</p>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="hidden md:flex items-center gap-2">
          {template.language.slice(0, 2).map(lang => (
            <span key={lang} className="px-2 py-1 bg-gray-100 text-xs text-gray-700 rounded">
              {lang}
            </span>
          ))}
          {template.frameworks.slice(0, 2).map(framework => (
            <span key={framework} className="px-2 py-1 bg-blue-100 text-xs text-blue-700 rounded">
              {framework}
            </span>
          ))}
        </div>

        {/* Setup Time */}
        <div className="hidden sm:flex items-center gap-1 text-sm text-gray-500">
          <ClockIcon className="h-4 w-4" />
          {template.estimatedSetupTime}
        </div>

        {/* Selected Indicator */}
        {isSelected && (
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}