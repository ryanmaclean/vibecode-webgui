'use client'

import { useState, useMemo } from 'react'
import { allBuiltInTemplates } from '@/lib/ai/prompts/templates/index'
import { PromptCategory } from '@/types/prompts'
import type { PromptTemplate } from '@/types/prompts'

const CATEGORY_META: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  [PromptCategory.CODE_REVIEW]: { label: 'Code Review', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  [PromptCategory.EXPLAIN]: { label: 'Explain Code', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  [PromptCategory.REFACTOR]: { label: 'Refactor', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  [PromptCategory.TEST]: { label: 'Generate Tests', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  [PromptCategory.DOCUMENT]: { label: 'Documentation', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
}

const CATEGORIES = [
  { value: 'all', label: 'All Templates' },
  { value: PromptCategory.CODE_REVIEW, label: 'Code Review' },
  { value: PromptCategory.EXPLAIN, label: 'Explain Code' },
  { value: PromptCategory.REFACTOR, label: 'Refactor' },
  { value: PromptCategory.TEST, label: 'Generate Tests' },
  { value: PromptCategory.DOCUMENT, label: 'Documentation' },
]

function CategoryIcon({ path, className }: { path: string; className?: string }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

function TemplateCard({ template, isExpanded, onToggle }: {
  template: PromptTemplate
  isExpanded: boolean
  onToggle: () => void
}) {
  const meta = CATEGORY_META[template.category] || { label: template.category, color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200', icon: '' }
  const requiredVars = template.variables.filter(v => v.required).length
  const optionalVars = template.variables.length - requiredVars

  return (
    <div className={`bg-white rounded-lg shadow border transition-all ${isExpanded ? 'ring-2 ring-blue-300' : 'hover:shadow-md'}`}>
      <button
        onClick={onToggle}
        className="w-full text-left p-5 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${meta.bgColor} ${meta.color}`}>
                {meta.icon && <CategoryIcon path={meta.icon} className="w-3 h-3" />}
                {meta.label}
              </span>
              <span className="text-xs text-gray-400">v{template.version}</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 truncate">{template.name}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {template.variables.length} var{template.variables.length !== 1 ? 's' : ''}
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {template.recommendedModels[0]?.split('/').pop() || 'any model'}
          </span>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500">{template.maxTokens.toLocaleString()} max tokens</span>
          {template.temperature !== undefined && (
            <>
              <span className="text-xs text-gray-400">|</span>
              <span className="text-xs text-gray-500">temp {template.temperature}</span>
            </>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t px-5 pb-5 space-y-4">
          {/* Recommended Models */}
          <div className="pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recommended Models</h4>
            <div className="flex flex-wrap gap-1.5">
              {template.recommendedModels.map(model => (
                <span key={model} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono">
                  {model}
                </span>
              ))}
            </div>
          </div>

          {/* Variables */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Variables ({requiredVars} required{optionalVars > 0 ? `, ${optionalVars} optional` : ''})
            </h4>
            <div className="grid gap-2">
              {template.variables.map(v => (
                <div key={v.name} className="flex items-start gap-3 p-2.5 bg-gray-50 rounded-md">
                  <code className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                    {`{{${v.name}}}`}
                  </code>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{v.description}</span>
                      {v.required && (
                        <span className="text-xs text-red-500 font-medium">required</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>type: {v.type}</span>
                      {v.defaultValue && <span>default: {v.defaultValue}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Prompt Preview */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">System Prompt</h4>
            <pre className="p-3 bg-gray-900 text-gray-100 rounded-md text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
              {template.systemPrompt}
            </pre>
          </div>

          {/* User Prompt Template */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">User Prompt Template</h4>
            <pre className="p-3 bg-gray-800 text-green-300 rounded-md text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
              {template.userPromptTemplate}
            </pre>
          </div>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tags</h4>
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2">
            <a
              href={`/chat?template=${template.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Use Template
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PromptsLibraryPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredTemplates = useMemo(() => {
    let results: PromptTemplate[] = allBuiltInTemplates

    if (activeCategory !== 'all') {
      results = results.filter(t => t.category === activeCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      results = results.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.toLowerCase().includes(q)) ||
          t.id.toLowerCase().includes(q)
      )
    }

    return results
  }, [activeCategory, searchQuery])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allBuiltInTemplates.length }
    for (const t of allBuiltInTemplates) {
      counts[t.category] = (counts[t.category] || 0) + 1
    }
    return counts
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Prompt Library</h1>
          <p className="mt-2 text-gray-600">
            {allBuiltInTemplates.length} reusable prompt templates for AI-powered code assistance across {Object.keys(CATEGORY_META).length} categories
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-lg">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search templates by name, description, or tag..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-1 overflow-x-auto pb-px">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeCategory === cat.value
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {cat.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  activeCategory === cat.value ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {categoryCounts[cat.value] || 0}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-gray-500">
          Showing {filteredTemplates.length} of {allBuiltInTemplates.length} templates
          {searchQuery && <span className="ml-1">matching &quot;{searchQuery}&quot;</span>}
        </div>

        {/* Template Cards */}
        {filteredTemplates.length > 0 ? (
          <div className="grid gap-4">
            {filteredTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                isExpanded={expandedId === template.id}
                onToggle={() => setExpandedId(expandedId === template.id ? null : template.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg shadow border">
            <svg className="mx-auto w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No templates found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search or category filter.</p>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('all') }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
