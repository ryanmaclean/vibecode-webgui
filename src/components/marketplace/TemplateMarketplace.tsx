/**
 * Template marketplace browsing and discovery interface
 */

'use client'

import React, { useState, useEffect } from 'react'
import { templateMarketplace, type MarketplaceTemplate, type MarketplaceSearchOptions } from '@/lib/marketplace/template-marketplace'
import { TemplateDeploymentIntegration } from './TemplateDeploymentIntegration'
import {
  MagnifyingGlassIcon,
  StarIcon,
  ArrowDownTrayIcon as DownloadIcon,
  EyeIcon,
  CodeBracketIcon,
  UserIcon,
  TagIcon,
  FunnelIcon,
  SparklesIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

interface TemplateMarketplaceProps {
  onSelectTemplate: (template: MarketplaceTemplate) => void
  selectedCategory?: string
}

export function TemplateMarketplace({ onSelectTemplate, selectedCategory }: TemplateMarketplaceProps) {
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([])
  const [featuredTemplates, setFeaturedTemplates] = useState<MarketplaceTemplate[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchOptions, setSearchOptions] = useState<MarketplaceSearchOptions>({
    category: selectedCategory,
    sortBy: 'popularity',
    limit: 12
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTemplateForDeploy, setSelectedTemplateForDeploy] = useState<MarketplaceTemplate | null>(null)

  useEffect(() => {
    loadTemplates()
    loadCategories()
    loadFeaturedTemplates()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      setSearchOptions(prev => ({ ...prev, category: selectedCategory }))
    }
  }, [selectedCategory])

  useEffect(() => {
    loadTemplates()
  }, [searchOptions])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const result = templateMarketplace.searchTemplates(searchOptions)
      setTemplates(result.templates)
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = () => {
    const cats = templateMarketplace.getCategories()
    setCategories(cats)
  }

  const loadFeaturedTemplates = () => {
    const featured = templateMarketplace.getFeaturedTemplates(6)
    setFeaturedTemplates(featured)
  }

  const handleSearch = (query: string) => {
    setSearchOptions(prev => ({ ...prev, query, offset: 0 }))
  }

  const handleCategoryFilter = (category: string | undefined) => {
    setSearchOptions(prev => ({ ...prev, category, offset: 0 }))
  }

  const handleSortChange = (sortBy: string) => {
<<<<<<< HEAD
<<<<<<< HEAD
    setSearchOptions(prev => ({ ...prev, sortBy: sortBy as MarketplaceSearchOptions['sortBy'], offset: 0 }))
=======
    setSearchOptions(prev => ({ ...prev, sortBy: sortBy as MarketplaceSearchOptions['sortBy'], offset: 0 }))
<<<<<<< HEAD
    setSearchOptions(prev => ({ ...prev, sortBy: sortBy as any, offset: 0 }))
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
  }
=======
    setSearchOptions(prev => ({ ...prev, sortBy: sortBy as MarketplaceSearchOptions['sortBy'], offset: 0 }))  }
>>>>>>> fix/consolidated-dependency-updates

  const handleDownload = async (template: MarketplaceTemplate) => {
    await templateMarketplace.recordDownload(template.marketplaceId)
    onSelectTemplate(template)
  }

  const handleDeploy = (template: MarketplaceTemplate) => {
    setSelectedTemplateForDeploy(template)
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const renderStars = (rating: number, size = 4): React.ReactNode[] => {
    const stars: React.ReactNode[] = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
<<<<<<< HEAD
<<<<<<< HEAD
=======
  const renderStars = (rating: number, size = 4) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup

=======
>>>>>>> fix/consolidated-dependency-updates
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <StarIconSolid key={i} className={`h-${size} w-${size} text-yellow-400`} />
        );
<<<<<<< HEAD
=======
<<<<<<< HEAD
        )
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative">
            <StarIcon className={`h-${size} w-${size} text-gray-300`} />
            <StarIconSolid className={`h-${size} w-${size} text-yellow-400 absolute top-0 left-0`} style={{ clipPath: 'inset(0 50% 0 0)' }} />
          </div>
        );
      } else {
        stars.push(
          <StarIcon key={i} className={`h-${size} w-${size} text-gray-300`} />
        );
      }
    }

    return stars;
<<<<<<< HEAD
=======
<<<<<<< HEAD
        )
      } else {
        stars.push(
          <StarIcon key={i} className={`h-${size} w-${size} text-gray-300`} />
        )
      }
    }

    return stars
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
  }

  const TemplateCard = ({ template }: { template: MarketplaceTemplate }) => (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">{template.name}</h3>
              {template.marketplace.featured && (
                <SparklesIcon className="h-5 w-5 text-yellow-500" title="Featured template" />
              )}
              {template.author.verified && (
                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-gray-600 text-sm line-clamp-2 mb-3">{template.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            {renderStars(template.stats.rating)}
            <span className="ml-1 font-medium">{template.stats.rating.toFixed(1)}</span>
            <span>({template.stats.reviewCount})</span>
          </div>
          <div className="flex items-center gap-1">
            <DownloadIcon className="h-4 w-4" />
            <span>{formatNumber(template.stats.downloads)}</span>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1 mb-4">
          {template.marketplace.category.slice(0, 3).map((category) => (
            <span
              key={category}
              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
            >
              {category}
            </span>
          ))}
          {template.marketplace.category.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
              +{template.marketplace.category.length - 3}
            </span>
          )}
        </div>

        {/* Author */}
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{template.author.name}</span>
          <span className="text-xs text-gray-400">
            {template.marketplace.pricing === 'free' ? 'Free' : `$${template.marketplace.price}`}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => handleDownload(template)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Use Template
          </button>
          <button
            onClick={() => handleDeploy(template)}
            className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
            title="Deploy to FolderHub & Cloud"
          >
            <RocketLaunchIcon className="h-4 w-4" />
          </button>
          <button className="p-2 border border-gray-300 hover:border-gray-400 rounded-md transition-colors">
            <EyeIcon className="h-4 w-4 text-gray-600" />
          </button>
          <button className="p-2 border border-gray-300 hover:border-gray-400 rounded-md transition-colors">
            <StarIcon className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Template Marketplace</h1>
        <p className="text-gray-600">
          Discover and use production-ready templates to accelerate your development
        </p>
      </div>

      {/* Featured Templates */}
      {featuredTemplates.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SparklesIcon className="h-6 w-6 text-yellow-500" />
            Featured Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredTemplates.map((template) => (
              <TemplateCard key={template.marketplaceId} template={template} />
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchOptions.query || ''}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <select
            value={searchOptions.sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="popularity">Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="recent">Recently Added</option>
            <option value="downloads">Most Downloaded</option>
            <option value="alphabetical">A-Z</option>
          </select>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <FunnelIcon className="h-4 w-4" />
            Filters
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={searchOptions.category || ''}
                onChange={(e) => handleCategoryFilter(e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Pricing Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pricing</label>
              <select
                value={searchOptions.pricing || 'all'}
<<<<<<< HEAD
<<<<<<< HEAD
                onChange={(e) => setSearchOptions(prev => ({ ...prev, pricing: e.target.value as 'free' | 'paid' | 'all' | undefined }))}
=======
                onChange={(e) => setSearchOptions(prev => ({ ...prev, pricing: e.target.value as 'free' | 'paid' | 'all' | undefined }))}
<<<<<<< HEAD
                onChange={(e) => setSearchOptions(prev => ({ ...prev, pricing: e.target.value as any }))}
=======
>>>>>>> main
>>>>>>> merge-conflict-cleanup
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
=======
                onChange={(e) => setSearchOptions(prev => ({ ...prev, pricing: e.target.value as 'free' | 'paid' | 'all' | undefined }))}                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
>>>>>>> fix/consolidated-dependency-updates
              >
                <option value="all">All</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Rating</label>
              <select
                value={searchOptions.rating || ''}
                onChange={(e) => setSearchOptions(prev => ({ ...prev, rating: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Templates Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">All Templates</h2>
          <span className="text-gray-500 text-sm">{templates.length} templates</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="flex gap-2 mb-4">
                    <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                  </div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : templates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <TemplateCard key={template.marketplaceId} template={template} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CodeBracketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600">Try adjusting your search or filters to find templates.</p>
          </div>
        )}
      </div>

      {/* Deployment Integration Modal */}
      {selectedTemplateForDeploy && (
        <TemplateDeploymentIntegration
          template={selectedTemplateForDeploy}
          onClose={() => setSelectedTemplateForDeploy(null)}
          onDeploymentComplete={(result) => {
            // Debug log removed
            setSelectedTemplateForDeploy(null)
          }}
        />
      )}
    </div>
  )
}