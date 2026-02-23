/**
 * Plugin Search Filters Component
 * Provides filtering and sorting options for plugin marketplace
 */

'use client'

import React from 'react'
import {
  FunnelIcon,
  XMarkIcon,
  StarIcon,
  CheckBadgeIcon,
  TagIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline'

export interface PluginSearchFiltersProps {
  // Current filter values
  query?: string
  category?: string
  tags?: string[]
  featured?: boolean
  verified?: boolean
  minRating?: number
  sortBy?: 'downloads' | 'rating' | 'created' | 'updated'

  // Available options
  categories?: Array<{ id: string; name: string; count: number }>
  availableTags?: string[]

  // Callbacks
  onQueryChange?: (query: string) => void
  onCategoryChange?: (category: string | undefined) => void
  onTagsChange?: (tags: string[]) => void
  onFeaturedChange?: (featured: boolean | undefined) => void
  onVerifiedChange?: (verified: boolean | undefined) => void
  onMinRatingChange?: (rating: number | undefined) => void
  onSortByChange?: (sortBy: 'downloads' | 'rating' | 'created' | 'updated') => void
  onClearFilters?: () => void
}

export function PluginSearchFilters({
  query = '',
  category,
  tags = [],
  featured,
  verified,
  minRating,
  sortBy = 'downloads',
  categories = [],
  availableTags = [],
  onQueryChange,
  onCategoryChange,
  onTagsChange,
  onFeaturedChange,
  onVerifiedChange,
  onMinRatingChange,
  onSortByChange,
  onClearFilters
}: PluginSearchFiltersProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const handleTagToggle = (tag: string) => {
    const newTags = tags.includes(tag)
      ? tags.filter(t => t !== tag)
      : [...tags, tag]
    onTagsChange?.(newTags)
  }

  const hasActiveFilters =
    category ||
    tags.length > 0 ||
    featured !== undefined ||
    verified !== undefined ||
    minRating !== undefined

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-500" />
            <h3 className="font-medium text-gray-900">Filters</h3>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Compact View - Search and Sort */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Search Input */}
          <div>
            <label htmlFor="plugin-search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              id="plugin-search"
              type="text"
              value={query}
              onChange={(e) => onQueryChange?.(e.target.value)}
              placeholder="Search plugins..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Sort By */}
          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => onSortByChange?.(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="downloads">Most Downloads</option>
              <option value="rating">Highest Rated</option>
              <option value="updated">Recently Updated</option>
              <option value="created">Newest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-200 space-y-4">
          {/* Category Filter */}
          {categories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onCategoryChange?.(undefined)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    !category
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange?.(cat.id)}
                    className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      category === cat.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags Filter */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {availableTags.slice(0, 10).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                      tags.includes(tag)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <TagIcon className="h-3.5 w-3.5" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Filters
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onFeaturedChange?.(featured ? undefined : true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  featured
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                <StarIcon className="h-4 w-4" />
                Featured
              </button>
              <button
                onClick={() => onVerifiedChange?.(verified ? undefined : true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  verified
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                <CheckBadgeIcon className="h-4 w-4" />
                Verified
              </button>
            </div>
          </div>

          {/* Minimum Rating Filter */}
          <div>
            <label htmlFor="min-rating" className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Rating
            </label>
            <div className="flex items-center gap-3">
              <input
                id="min-rating"
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={minRating || 1}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  onMinRatingChange?.(value === 1 ? undefined : value)
                }}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex items-center gap-1 min-w-[80px]">
                <StarIcon className="h-4 w-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium text-gray-900">
                  {minRating ? `${minRating.toFixed(1)}+` : 'Any'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
