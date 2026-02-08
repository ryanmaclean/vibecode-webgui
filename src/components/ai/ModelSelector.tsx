/**
 * ModelSelector Component
 *
 * Searchable dropdown for selecting AI models with filters,
 * grouping by provider, and quick filter presets.
 */

'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  Star,
  Clock,
  Filter,
  Code,
  DollarSign,
  Zap,
  Maximize,
  Eye,
  Gift,
  Check,
  Sparkles,
} from 'lucide-react';
import type {
  ModelProfile,
  ModelFilterOptions,
  QuickFilterPreset,
  QualityTier,
  SpeedTier,
  DEFAULT_QUICK_FILTERS,
} from '@/types/model-comparison';

// ============================================================================
// Types
// ============================================================================

interface ModelSelectorProps {
  /** Currently selected model ID */
  selectedModelId?: string;
  /** Callback when model is selected */
  onModelSelect: (model: ModelProfile) => void;
  /** Available models to choose from */
  models: ModelProfile[];
  /** Recent model IDs (persisted in localStorage) */
  recentModelIds?: string[];
  /** Favorite model IDs (persisted in localStorage) */
  favoriteModelIds?: string[];
  /** Callback to update favorites */
  onFavoriteToggle?: (modelId: string) => void;
  /** Quick filter presets */
  quickFilters?: QuickFilterPreset[];
  /** Custom placeholder text */
  placeholder?: string;
  /** Custom class name */
  className?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Label for accessibility */
  label?: string;
  /** Show expanded details */
  showDetails?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_QUICK_FILTER_PRESETS: QuickFilterPreset[] = [
  {
    id: 'best-for-coding',
    label: 'Best for Coding',
    description: 'Top models for code generation and debugging',
    filters: {
      capabilities: ['coding', 'debugging'],
      minQualityTier: 'excellent',
    },
    icon: 'code',
  },
  {
    id: 'best-value',
    label: 'Best Value',
    description: 'Great quality at affordable prices',
    filters: {
      maxInputCost: 0.005,
      maxOutputCost: 0.015,
      minQualityTier: 'good',
    },
    icon: 'dollar',
  },
  {
    id: 'fastest',
    label: 'Fastest',
    description: 'Models optimized for speed',
    filters: {
      minSpeedTier: 'fast',
    },
    icon: 'zap',
  },
  {
    id: 'largest-context',
    label: 'Largest Context',
    description: 'Models with 100K+ context windows',
    filters: {
      minContextSize: 100000,
    },
    icon: 'maximize',
  },
  {
    id: 'vision-enabled',
    label: 'Vision',
    description: 'Models that can understand images',
    filters: {
      requiresVision: true,
    },
    icon: 'eye',
  },
  {
    id: 'free-tier',
    label: 'Free Models',
    description: 'No-cost AI models',
    filters: {
      maxInputCost: 0,
      maxOutputCost: 0,
    },
    icon: 'gift',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

const getFilterIcon = (iconName?: string): React.ReactNode => {
  const icons: Record<string, React.ReactNode> = {
    code: <Code className="h-3.5 w-3.5" />,
    dollar: <DollarSign className="h-3.5 w-3.5" />,
    zap: <Zap className="h-3.5 w-3.5" />,
    maximize: <Maximize className="h-3.5 w-3.5" />,
    eye: <Eye className="h-3.5 w-3.5" />,
    gift: <Gift className="h-3.5 w-3.5" />,
  };
  return icons[iconName || ''] || <Sparkles className="h-3.5 w-3.5" />;
};

const formatPrice = (price: number): string => {
  if (price === 0) return 'Free';
  if (price < 0.001) return `$${(price * 1000).toFixed(2)}/M`;
  return `$${price.toFixed(4)}/1K`;
};

const formatContext = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return tokens.toString();
};

const getQualityColor = (tier: QualityTier): string => {
  const colors: Record<QualityTier, string> = {
    basic: 'bg-gray-100 text-gray-600',
    good: 'bg-blue-100 text-blue-700',
    excellent: 'bg-green-100 text-green-700',
    state_of_art: 'bg-purple-100 text-purple-700',
  };
  return colors[tier];
};

const getSpeedBadge = (tier: SpeedTier): string => {
  const badges: Record<SpeedTier, string> = {
    slow: 'bg-red-100 text-red-600',
    medium: 'bg-yellow-100 text-yellow-700',
    fast: 'bg-green-100 text-green-700',
    very_fast: 'bg-emerald-100 text-emerald-700',
  };
  return badges[tier];
};

const applyFilters = (models: ModelProfile[], filters: ModelFilterOptions): ModelProfile[] => {
  return models.filter(model => {
    // Provider filter
    if (filters.providers && filters.providers.length > 0) {
      const modelProvider = model.id.split('/')[0];
      if (!filters.providers.includes(modelProvider) && !filters.providers.includes(model.provider.id)) {
        return false;
      }
    }

    // Quality tier filter
    if (filters.minQualityTier) {
      const tierOrder: Record<QualityTier, number> = { basic: 0, good: 1, excellent: 2, state_of_art: 3 };
      if (tierOrder[model.qualityTier] < tierOrder[filters.minQualityTier]) {
        return false;
      }
    }

    // Price filters
    if (filters.maxInputCost !== undefined && model.pricing.inputPer1K > filters.maxInputCost) {
      return false;
    }
    if (filters.maxOutputCost !== undefined && model.pricing.outputPer1K > filters.maxOutputCost) {
      return false;
    }

    // Context size filter
    if (filters.minContextSize && model.limits.contextWindow < filters.minContextSize) {
      return false;
    }

    // Speed tier filter
    if (filters.minSpeedTier) {
      const speedOrder: Record<SpeedTier, number> = { slow: 0, medium: 1, fast: 2, very_fast: 3 };
      if (speedOrder[model.performance.speedTier] < speedOrder[filters.minSpeedTier]) {
        return false;
      }
    }

    // Vision filter
    if (filters.requiresVision && model.capabilities.vision <= 0) {
      return false;
    }

    // Function calling filter
    if (filters.requiresFunctionCalling && !model.capabilities.function_calling) {
      return false;
    }

    // Capability filters
    if (filters.capabilities && filters.capabilities.length > 0) {
      const hasAllCapabilities = filters.capabilities.every(cap => {
        const capValue = model.capabilities[cap as keyof typeof model.capabilities];
        return typeof capValue === 'boolean' ? capValue : (capValue as number) >= 70;
      });
      if (!hasAllCapabilities) return false;
    }

    return true;
  });
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ModelListItemProps {
  model: ModelProfile;
  isSelected: boolean;
  isFavorite: boolean;
  isRecent: boolean;
  onSelect: () => void;
  onFavoriteToggle?: () => void;
  showDetails?: boolean;
}

const ModelListItem: React.FC<ModelListItemProps> = ({
  model,
  isSelected,
  isFavorite,
  isRecent,
  onSelect,
  onFavoriteToggle,
  showDetails = false,
}) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 ${
        isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{model.name}</span>
            {isSelected && <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{model.provider.name}</div>

          {showDetails && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge className={`text-xs ${getQualityColor(model.qualityTier)}`}>
                {model.qualityTier.replace('_', ' ')}
              </Badge>
              <Badge className={`text-xs ${getSpeedBadge(model.performance.speedTier)}`}>
                {model.performance.speedTier.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {formatContext(model.limits.contextWindow)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {formatPrice(model.pricing.inputPer1K)}
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          {isRecent && (
            <span title="Recently used"><Clock className="h-3.5 w-3.5 text-gray-400" /></span>
          )}
          {onFavoriteToggle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavoriteToggle();
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
              />
            </button>
          )}
        </div>
      </div>
    </button>
  );
};

interface ProviderGroupProps {
  provider: string;
  models: ModelProfile[];
  selectedModelId?: string;
  favoriteIds: string[];
  recentIds: string[];
  onModelSelect: (model: ModelProfile) => void;
  onFavoriteToggle?: (modelId: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  showDetails?: boolean;
}

const ProviderGroup: React.FC<ProviderGroupProps> = ({
  provider,
  models,
  selectedModelId,
  favoriteIds,
  recentIds,
  onModelSelect,
  onFavoriteToggle,
  isExpanded,
  onToggle,
  showDetails,
}) => {
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">{provider}</span>
          <Badge variant="secondary" className="text-xs">
            {models.length}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="bg-gray-50/50">
          {models.map(model => (
            <ModelListItem
              key={model.id}
              model={model}
              isSelected={selectedModelId === model.id}
              isFavorite={favoriteIds.includes(model.id)}
              isRecent={recentIds.includes(model.id)}
              onSelect={() => onModelSelect(model)}
              onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(model.id) : undefined}
              showDetails={showDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModelId,
  onModelSelect,
  models,
  recentModelIds = [],
  favoriteModelIds = [],
  onFavoriteToggle,
  quickFilters = DEFAULT_QUICK_FILTER_PRESETS,
  placeholder = 'Select a model...',
  className = '',
  disabled = false,
  label = 'AI Model',
  showDetails = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<ModelFilterOptions>({});
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected model
  const selectedModel = useMemo(() => {
    return models.find(m => m.id === selectedModelId);
  }, [models, selectedModelId]);

  // Filter and search models
  const filteredModels = useMemo(() => {
    let result = models;

    // Apply filters
    if (Object.keys(activeFilters).length > 0) {
      result = applyFilters(result, activeFilters);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query) ||
        m.tags.some(t => t.toLowerCase().includes(query)) ||
        m.provider.name.toLowerCase().includes(query)
      );
    }

    return result;
  }, [models, activeFilters, searchQuery]);

  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelProfile[]> = {};

    // Add favorites first
    const favorites = filteredModels.filter(m => favoriteModelIds.includes(m.id));
    if (favorites.length > 0) {
      groups['Favorites'] = favorites;
    }

    // Add recent
    const recents = filteredModels.filter(m =>
      recentModelIds.includes(m.id) && !favoriteModelIds.includes(m.id)
    );
    if (recents.length > 0) {
      groups['Recent'] = recents;
    }

    // Group rest by provider
    filteredModels.forEach(model => {
      if (favoriteModelIds.includes(model.id)) return; // Skip favorites
      if (recentModelIds.includes(model.id)) return; // Skip recents

      const providerName = model.provider.name;
      if (!groups[providerName]) {
        groups[providerName] = [];
      }
      groups[providerName].push(model);
    });

    return groups;
  }, [filteredModels, favoriteModelIds, recentModelIds]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleQuickFilter = useCallback((filterId: string) => {
    if (activeQuickFilter === filterId) {
      // Deactivate filter
      setActiveQuickFilter(null);
      setActiveFilters({});
    } else {
      // Activate filter
      const filter = quickFilters.find(f => f.id === filterId);
      if (filter) {
        setActiveQuickFilter(filterId);
        setActiveFilters(filter.filters);
      }
    }
  }, [activeQuickFilter, quickFilters]);

  const handleModelSelect = useCallback((model: ModelProfile) => {
    onModelSelect(model);
    setIsOpen(false);
    setSearchQuery('');
  }, [onModelSelect]);

  const toggleProvider = useCallback((provider: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
    setActiveQuickFilter(null);
    setSearchQuery('');
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <Label className="text-sm font-medium text-gray-700 mb-1.5 block">
          {label}
        </Label>
      )}

      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between p-3 border rounded-lg transition-colors ${
          disabled
            ? 'bg-gray-100 cursor-not-allowed opacity-60'
            : 'bg-white hover:border-gray-400 cursor-pointer'
        } ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedModel ? (
            <>
              <span className="font-medium text-gray-900 truncate">{selectedModel.name}</span>
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {selectedModel.provider.name}
              </Badge>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <Card className="absolute z-50 w-full mt-1 shadow-lg border">
          <CardContent className="p-0">
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                  >
                    <X className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Filters */}
            <div className="p-2 border-b flex flex-wrap gap-1.5">
              {quickFilters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => handleQuickFilter(filter.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
                    activeQuickFilter === filter.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={filter.description}
                >
                  {getFilterIcon(filter.icon)}
                  {filter.label}
                </button>
              ))}
              {(activeQuickFilter || Object.keys(activeFilters).length > 0) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-full"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>

            {/* Model Count */}
            <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
              <span>{filteredModels.length} models</span>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
              >
                <Filter className="h-3 w-3" />
                More filters
              </button>
            </div>

            {/* Advanced Filters Panel */}
            {showFilters && (
              <div className="p-3 border-b bg-gray-50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Min Quality</Label>
                    <select
                      className="w-full mt-1 text-sm border rounded p-1.5"
                      value={activeFilters.minQualityTier || ''}
                      onChange={(e) => setActiveFilters({
                        ...activeFilters,
                        minQualityTier: e.target.value as QualityTier || undefined
                      })}
                    >
                      <option value="">Any</option>
                      <option value="good">Good+</option>
                      <option value="excellent">Excellent+</option>
                      <option value="state_of_art">State of Art</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Min Speed</Label>
                    <select
                      className="w-full mt-1 text-sm border rounded p-1.5"
                      value={activeFilters.minSpeedTier || ''}
                      onChange={(e) => setActiveFilters({
                        ...activeFilters,
                        minSpeedTier: e.target.value as SpeedTier || undefined
                      })}
                    >
                      <option value="">Any</option>
                      <option value="medium">Medium+</option>
                      <option value="fast">Fast+</option>
                      <option value="very_fast">Very Fast</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={activeFilters.requiresVision || false}
                      onCheckedChange={(checked) => setActiveFilters({
                        ...activeFilters,
                        requiresVision: checked as boolean || undefined
                      })}
                    />
                    Vision
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={activeFilters.requiresFunctionCalling || false}
                      onCheckedChange={(checked) => setActiveFilters({
                        ...activeFilters,
                        requiresFunctionCalling: checked as boolean || undefined
                      })}
                    />
                    Function Calling
                  </label>
                </div>
              </div>
            )}

            {/* Model List */}
            <ScrollArea className="max-h-80">
              {filteredModels.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No models found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              ) : (
                Object.entries(groupedModels).map(([provider, providerModels]) => (
                  <ProviderGroup
                    key={provider}
                    provider={provider}
                    models={providerModels}
                    selectedModelId={selectedModelId}
                    favoriteIds={favoriteModelIds}
                    recentIds={recentModelIds}
                    onModelSelect={handleModelSelect}
                    onFavoriteToggle={onFavoriteToggle}
                    isExpanded={expandedProviders.has(provider) || provider === 'Favorites' || provider === 'Recent'}
                    onToggle={() => toggleProvider(provider)}
                    showDetails={showDetails}
                  />
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModelSelector;
