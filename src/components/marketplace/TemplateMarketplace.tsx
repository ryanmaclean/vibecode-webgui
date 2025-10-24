/**
 * Template Marketplace Component
 * Browse, filter, and select project templates from the marketplace
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  StarIcon as StarIconOutline,
  StarIcon as StarIconSolid,
  ClockIcon,
  UserIcon,
  TagIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolidFilled } from '@heroicons/react/24/solid';

interface Template {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  language: string;
  framework: string;
  stars: number;
  downloads: number;
  tags: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  pricing: 'free' | 'paid';
  previewImage?: string;
  lastUpdated: string;
  featured: boolean;
}

interface MarketplaceSearchOptions {
  query?: string;
  category?: string;
  language?: string;
  framework?: string;
  complexity?: string;
  pricing?: 'free' | 'paid' | 'all';
  sortBy?: 'relevance' | 'stars' | 'downloads' | 'updated' | 'name';
  tags?: string[];
  offset?: number;
  limit?: number;
}

interface TemplateMarketplaceProps {
  onTemplateSelect?: (template: Template) => void;
  onTemplatePreview?: (template: Template) => void;
  selectedTemplateId?: string;
  selectedCategory?: string;
  className?: string;
}

export function TemplateMarketplace({
  onTemplateSelect,
  onTemplatePreview,
  selectedTemplateId,
  selectedCategory,
  className = ''
}: TemplateMarketplaceProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOptions, setSearchOptions] = useState<MarketplaceSearchOptions>({
    sortBy: 'relevance',
    pricing: 'all',
    limit: 20,
    offset: 0
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load templates from API
  useEffect(() => {
    loadTemplates();
  }, [searchOptions]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      // This would integrate with your template marketplace API
      // For now, using mock data
      const mockTemplates: Template[] = [
        {
          id: 'react-ts-vite',
          name: 'React TypeScript Vite',
          description: 'Modern React application with TypeScript and Vite build system',
          author: 'VibeCode Team',
          category: 'web',
          language: 'typescript',
          framework: 'react',
          stars: 4.8,
          downloads: 15420,
          tags: ['react', 'typescript', 'vite', 'modern'],
          complexity: 'intermediate',
          pricing: 'free',
          lastUpdated: '2024-01-15',
          featured: true
        },
        {
          id: 'nextjs-fullstack',
          name: 'Next.js Full Stack',
          description: 'Complete full-stack application with Next.js, API routes, and database',
          author: 'Community',
          category: 'web',
          language: 'typescript',
          framework: 'nextjs',
          stars: 4.6,
          downloads: 8930,
          tags: ['nextjs', 'fullstack', 'api', 'database'],
          complexity: 'advanced',
          pricing: 'free',
          lastUpdated: '2024-01-10',
          featured: false
        }
      ];

      // Apply search filters
      let filteredTemplates = mockTemplates;

      if (searchOptions.query) {
        const query = searchOptions.query.toLowerCase();
        filteredTemplates = filteredTemplates.filter(template =>
          template.name.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }

      const categoryFilter = searchOptions.category || selectedCategory || undefined
      if (categoryFilter) {
        filteredTemplates = filteredTemplates.filter(template =>
          template.category === categoryFilter
        );
      }

      if (searchOptions.language) {
        filteredTemplates = filteredTemplates.filter(template =>
          template.language === searchOptions.language
        );
      }

      if (searchOptions.pricing && searchOptions.pricing !== 'all') {
        filteredTemplates = filteredTemplates.filter(template =>
          template.pricing === searchOptions.pricing
        );
      }

      // Apply sorting
      filteredTemplates.sort((a, b) => {
        switch (searchOptions.sortBy) {
          case 'stars':
            return b.stars - a.stars;
          case 'downloads':
            return b.downloads - a.downloads;
          case 'updated':
            return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
          case 'name':
            return a.name.localeCompare(b.name);
          default:
            return b.featured ? 1 : -1; // Featured templates first
        }
      });

      setTemplates(filteredTemplates);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (sortBy: string) => {
    setSearchOptions(prev => ({
      ...prev,
      sortBy: sortBy as MarketplaceSearchOptions['sortBy'],
      offset: 0
    }));
  };

  const handleFilterChange = (key: keyof MarketplaceSearchOptions, value: any) => {
    setSearchOptions(prev => ({
      ...prev,
      [key]: value,
      offset: 0
    }));
  };

  const clearFilters = () => {
    setSearchOptions({
      sortBy: 'relevance',
      pricing: 'all',
      limit: 20,
      offset: 0
    });
  };

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'sm') => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6'
    };

    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <StarIconSolidFilled key={i} className={`${sizeClasses[size]} text-yellow-400`} />
      );
    }

    // Half star (if needed)
    if (hasHalfStar) {
      stars.push(
        <div key="half" className={`relative ${sizeClasses[size]}`}>
          <StarIconOutline className="text-yellow-400" />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <StarIconSolidFilled className="text-yellow-400" />
          </div>
        </div>
      );
    }

    // Empty stars
    const remainingStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(
        <StarIconOutline key={`empty-${i}`} className={`${sizeClasses[size]} text-gray-300`} />
      );
    }

    return stars;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const availableCategories = useMemo(() => {
    const categories = [...new Set(templates.map(t => t.category))];
    return categories.sort();
  }, [templates]);

  const availableLanguages = useMemo(() => {
    const languages = [...new Set(templates.map(t => t.language))];
    return languages.sort();
  }, [templates]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-red-600 mb-4">
          <XMarkIcon className="h-12 w-12 mx-auto mb-2" />
          <p>Error loading templates: {error}</p>
        </div>
        <button
          onClick={loadTemplates}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Template Marketplace</h2>
          <p className="text-gray-600 mt-1">Discover and use project templates</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {templates.length} template{templates.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {/* Search Bar */}
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchOptions.query || ''}
              onChange={(e) => handleFilterChange('query', e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-3 py-2 rounded-md border ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={searchOptions.category || ''}
                  onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {availableCategories.map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={searchOptions.language || ''}
                  onChange={(e) => handleFilterChange('language', e.target.value || undefined)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Languages</option>
                  {availableLanguages.map(language => (
                    <option key={language} value={language}>
                      {language.charAt(0).toUpperCase() + language.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pricing Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pricing
                </label>
                <select
                  value={searchOptions.pricing || 'all'}
                  onChange={(e) => handleFilterChange('pricing', e.target.value as 'free' | 'paid' | 'all')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {/* Sort Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={searchOptions.sortBy || 'relevance'}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="relevance">Relevance</option>
                  <option value="stars">Most Stars</option>
                  <option value="downloads">Most Downloads</option>
                  <option value="updated">Recently Updated</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>

            {/* Active Filters */}
            {(searchOptions.query || searchOptions.category || searchOptions.language || searchOptions.pricing !== 'all') && (
              <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">Active filters:</span>
                {searchOptions.query && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                    Query: {searchOptions.query}
                    <button
                      onClick={() => handleFilterChange('query', undefined)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {searchOptions.category && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                    Category: {searchOptions.category}
                    <button
                      onClick={() => handleFilterChange('category', undefined)}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {searchOptions.language && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                    Language: {searchOptions.language}
                    <button
                      onClick={() => handleFilterChange('language', undefined)}
                      className="ml-1 text-purple-600 hover:text-purple-800"
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`bg-white rounded-lg border ${
              selectedTemplateId === template.id
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300'
            } overflow-hidden hover:shadow-md transition-all cursor-pointer`}
            onClick={() => onTemplateSelect?.(template)}
          >
            {/* Template Preview Image */}
            <div className="aspect-video bg-gray-100 relative">
              {template.previewImage ? (
                <img
                  src={template.previewImage}
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-lg mx-auto mb-2 flex items-center justify-center">
                      <span className="text-white font-bold text-xl">
                        {template.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">No preview</p>
                  </div>
                </div>
              )}

              {/* Featured Badge */}
              {template.featured && (
                <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                  Featured
                </div>
              )}

              {/* Pricing Badge */}
              <div className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full font-medium ${
                template.pricing === 'free'
                  ? 'bg-green-500 text-white'
                  : 'bg-purple-500 text-white'
              }`}>
                {template.pricing === 'free' ? 'Free' : 'Paid'}
              </div>
            </div>

            {/* Template Info */}
            <div className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {template.description}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                <div className="flex items-center">
                  {renderStars(template.stars)}
                  <span className="ml-1">{template.stars}</span>
                </div>
                <div className="flex items-center">
                  <UserIcon className="h-4 w-4 mr-1" />
                  {formatNumber(template.downloads)}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1 mb-3">
                {template.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700"
                  >
                    <TagIcon className="h-3 w-3 mr-1" />
                    {tag}
                  </span>
                ))}
                {template.tags.length > 3 && (
                  <span className="text-xs text-gray-500">+{template.tags.length - 3} more</span>
                )}
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{template.author}</span>
                <div className="flex items-center">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  {new Date(template.lastUpdated).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {templates.length === 0 && !loading && (
        <div className="text-center py-12">
          <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-4">
            Try adjusting your search criteria or browse all templates.
          </p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Show All Templates
          </button>
        </div>
      )}
    </div>
  );
}
