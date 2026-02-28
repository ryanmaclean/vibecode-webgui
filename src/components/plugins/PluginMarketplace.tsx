/**
 * Plugin Marketplace Component
 * Main component for browsing, searching, and installing plugins
 */

'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { PluginCard, type PluginCardData } from './PluginCard'
import { VSCodeExtensionCard, type VSCodeExtensionData } from './VSCodeExtensionCard'
import { PluginSearchFilters } from './PluginSearchFilters'
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

export interface PluginMarketplaceProps {
  onPluginSelect?: (plugin: PluginCardData) => void
  onPluginInstall?: (plugin: PluginCardData) => Promise<void>
  onPluginUninstall?: (plugin: PluginCardData) => Promise<void>
  selectedPluginId?: number
  installedPluginIds?: number[]
}

interface PluginSearchResult {
  plugins: PluginCardData[]
  total: number
  limit: number
  offset: number
  categories?: Array<{ id: string; name: string; count: number }>
}

export function PluginMarketplace({
  onPluginSelect,
  onPluginInstall,
  onPluginUninstall,
  selectedPluginId,
  installedPluginIds = []
}: PluginMarketplaceProps) {
  // Router and search params
  const searchParams = useSearchParams()
  const router = useRouter()
  const tabFromUrl = searchParams?.get('tab') || 'plugins'

  // Tab State
  const [activeTab, setActiveTab] = useState<'plugins' | 'vscode'>(
    tabFromUrl === 'vscode' ? 'vscode' : 'plugins'
  )

  // Search & Filter State
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [tags, setTags] = useState<string[]>([])
  const [featured, setFeatured] = useState<boolean | undefined>(undefined)
  const [verified, setVerified] = useState<boolean | undefined>(undefined)
  const [minRating, setMinRating] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'created' | 'updated'>('downloads')

  // Data State
  const [plugins, setPlugins] = useState<PluginCardData[]>([])
  const [vscodeExtensions, setVSCodeExtensions] = useState<VSCodeExtensionData[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string; count: number }>>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit] = useState(20)

  // UI State
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installingPluginId, setInstallingPluginId] = useState<number | null>(null)

  /**
   * Sync tab state with URL parameter
   */
  useEffect(() => {
    const tab = searchParams?.get('tab')
    if (tab === 'vscode') {
      setActiveTab('vscode')
    } else {
      setActiveTab('plugins')
    }
  }, [searchParams])

  /**
   * Handle tab change
   */
  const handleTabChange = (tab: 'plugins' | 'vscode') => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('tab', tab)
    router.push(`?${params.toString()}`)
  }

  /**
   * Fetch plugins from marketplace API
   */
  const fetchPlugins = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      if (query) params.append('query', query)
      if (category) params.append('category', category)
      if (tags.length > 0) tags.forEach(tag => params.append('tags', tag))
      if (featured !== undefined) params.append('featured', String(featured))
      if (verified !== undefined) params.append('verified', String(verified))
      if (minRating !== undefined) params.append('minRating', String(minRating))
      params.append('sortBy', sortBy)
      params.append('sortOrder', 'desc')
      params.append('limit', String(limit))
      params.append('offset', String(offset))

      const response = await fetch(`/api/plugins/marketplace?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch plugins: ${response.status}`)
      }

      const data: PluginSearchResult = await response.json()

      setPlugins(data.plugins)
      setTotal(data.total)

      // Update categories and tags from response
      if (data.categories) {
        setCategories(data.categories)
      }

      // Extract unique tags from plugins
      const uniqueTags = new Set<string>()
      data.plugins.forEach(plugin => {
        plugin.tags?.forEach(tag => uniqueTags.add(tag))
      })
      setAvailableTags(Array.from(uniqueTags))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plugins')
    } finally {
      setIsLoading(false)
    }
  }, [query, category, tags, featured, verified, minRating, sortBy, limit, offset])

  /**
   * Load plugins on mount and when filters change
   */
  useEffect(() => {
    fetchPlugins()
  }, [fetchPlugins])

  /**
   * Handle plugin installation
   */
  const handleInstall = async (plugin: PluginCardData) => {
    if (!onPluginInstall) return

    setInstallingPluginId(plugin.id)
    try {
      await onPluginInstall(plugin)
      // Refresh the list to update download counts
      await fetchPlugins()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install plugin')
    } finally {
      setInstallingPluginId(null)
    }
  }

  /**
   * Handle plugin uninstallation
   */
  const handleUninstall = async (plugin: PluginCardData) => {
    if (!onPluginUninstall) return

    setInstallingPluginId(plugin.id)
    try {
      await onPluginUninstall(plugin)
      await fetchPlugins()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall plugin')
    } finally {
      setInstallingPluginId(null)
    }
  }

  /**
   * Handle card click
   */
  const handleCardClick = (plugin: PluginCardData) => {
    onPluginSelect?.(plugin)
  }

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    setQuery('')
    setCategory(undefined)
    setTags([])
    setFeatured(undefined)
    setVerified(undefined)
    setMinRating(undefined)
    setOffset(0)
  }

  /**
   * Handle pagination
   */
  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit))
  }

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit)
    }
  }

  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('plugins')}
            className={`${
              activeTab === 'plugins'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Plugins
          </button>
          <button
            onClick={() => handleTabChange('vscode')}
            className={`${
              activeTab === 'vscode'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            VS Code Extensions
          </button>
        </nav>
      </div>

      {/* Search Filters - Only show for plugins tab */}
      {activeTab === 'plugins' && (
        <PluginSearchFilters
          query={query}
          category={category}
          tags={tags}
          featured={featured}
          verified={verified}
          minRating={minRating}
          sortBy={sortBy}
          categories={categories}
          availableTags={availableTags}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
          onTagsChange={setTags}
          onFeaturedChange={setFeatured}
          onVerifiedChange={setVerified}
          onMinRatingChange={setMinRating}
          onSortByChange={setSortBy}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Plugins Tab Content */}
      {activeTab === 'plugins' && (
        <>
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">Error loading plugins</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
                <button
                  onClick={fetchPlugins}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-gray-600">
                <ArrowPathIcon className="h-6 w-6 animate-spin" />
                <span className="text-lg">Loading plugins...</span>
              </div>
            </div>
          )}

          {/* Results Summary */}
          {!isLoading && !error && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MagnifyingGlassIcon className="h-5 w-5" />
                <span>
                  Found <span className="font-medium text-gray-900">{total}</span> plugin{total !== 1 ? 's' : ''}
                  {query && (
                    <span> matching <span className="font-medium text-gray-900">&quot;{query}&quot;</span></span>
                  )}
                </span>
              </div>

              {/* Pagination Info */}
              {totalPages > 1 && (
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
              )}
            </div>
          )}

          {/* Plugin Grid */}
          {!isLoading && !error && plugins.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  plugin={plugin}
                  onInstall={installedPluginIds.includes(plugin.id) ? handleUninstall : handleInstall}
                  onCardClick={handleCardClick}
                  isInstalled={installedPluginIds.includes(plugin.id)}
                  isInstalling={installingPluginId === plugin.id}
                  selectedPluginId={selectedPluginId}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && plugins.length === 0 && (
            <div className="text-center py-12">
              <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins found</h3>
              <p className="text-gray-600 mb-4">
                {query || category || tags.length > 0
                  ? 'Try adjusting your search filters'
                  : 'Check back later for new plugins'}
              </p>
              {(query || category || tags.length > 0) && (
                <button
                  onClick={handleClearFilters}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {!isLoading && !error && totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-gray-200">
              <button
                onClick={handlePrevPage}
                disabled={offset === 0}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={offset + limit >= total}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* VS Code Extensions Tab Content */}
      {activeTab === 'vscode' && (
        <>
          {/* VS Code Extensions Grid - Mock data for now */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vscodeExtensions.length === 0 && (
              <div className="col-span-full text-center py-12">
                <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No VS Code extensions yet</h3>
                <p className="text-gray-600 mb-4">
                  Check back later for VS Code extensions integration
                </p>
              </div>
            )}
            {vscodeExtensions.map((extension) => (
              <VSCodeExtensionCard
                key={extension.id}
                extension={extension}
                onCardClick={() => {}}
                isInstalled={false}
                isInstalling={false}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
