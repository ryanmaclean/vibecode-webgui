/**
 * ModelSwitcherPanel Component
 *
 * Quick access dropdown panel for switching between AI models.
 * Displays current model, favorites, recent models, and searchable model list
 * with visual indicators for latency and cost.
 */

'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Star,
  Clock,
  DollarSign,
  Zap,
  Check,
  ExternalLink,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { ModelCapability } from '@/lib/services/intelligent-model-selection';

// ============================================================================
// Types
// ============================================================================

interface ModelSwitcherPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Currently selected model ID */
  selectedModelId?: string;
  /** Callback when model is selected */
  onModelSelect: (modelId: string) => void;
  /** Available models */
  models: ModelCapability[];
  /** Favorite model IDs */
  favoriteModelIds?: string[];
  /** Recent model IDs */
  recentModelIds?: string[];
  /** Search query */
  searchQuery: string;
  /** Callback to update search query */
  onSearchChange: (query: string) => void;
  /** Callback to toggle favorite */
  onFavoriteToggle?: (modelId: string) => void;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatPrice = (costTier: string): { label: string; color: string } => {
  const tiers: Record<string, { label: string; color: string }> = {
    free: { label: 'Free', color: 'bg-green-100 text-green-700' },
    low: { label: 'Low', color: 'bg-blue-100 text-blue-700' },
    medium: { label: 'Med', color: 'bg-yellow-100 text-yellow-700' },
    high: { label: 'High', color: 'bg-red-100 text-red-700' },
  };
  return tiers[costTier] || { label: 'N/A', color: 'bg-gray-100 text-gray-700' };
};

const formatSpeed = (speedTier: string): { label: string; color: string } => {
  const tiers: Record<string, { label: string; color: string }> = {
    slow: { label: 'Slow', color: 'bg-red-100 text-red-600' },
    medium: { label: 'Med', color: 'bg-yellow-100 text-yellow-600' },
    fast: { label: 'Fast', color: 'bg-green-100 text-green-600' },
  };
  return tiers[speedTier] || { label: 'N/A', color: 'bg-gray-100 text-gray-600' };
};

const getQualityBadge = (qualityTier: string): { label: string; color: string } => {
  const tiers: Record<string, { label: string; color: string }> = {
    basic: { label: 'Basic', color: 'bg-gray-100 text-gray-700' },
    good: { label: 'Good', color: 'bg-blue-100 text-blue-700' },
    excellent: { label: 'Excellent', color: 'bg-purple-100 text-purple-700' },
  };
  return tiers[qualityTier] || { label: 'N/A', color: 'bg-gray-100 text-gray-700' };
};

const formatContextSize = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return tokens.toString();
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ModelItemProps {
  model: ModelCapability;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onFavoriteToggle?: () => void;
}

const ModelItem: React.FC<ModelItemProps> = ({
  model,
  isSelected,
  isFavorite,
  onSelect,
  onFavoriteToggle,
}) => {
  const priceInfo = formatPrice(model.costTier);
  const speedInfo = formatSpeed(model.speedTier);
  const qualityInfo = getQualityBadge(model.qualityTier);

  return (
    <button
      onClick={onSelect}
      className={`w-full px-3 py-2.5 rounded-lg transition-colors text-left ${
        isSelected
          ? 'bg-primary/10 border border-primary/20'
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium text-sm truncate ${isSelected ? 'text-primary' : ''}`}>
              {model.name}
            </span>
            {isSelected && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <Badge className={`text-xs px-1.5 py-0 ${qualityInfo.color}`}>
              {qualityInfo.label}
            </Badge>
            <Badge className={`text-xs px-1.5 py-0 ${speedInfo.color}`}>
              <Zap className="h-3 w-3 mr-0.5" />
              {speedInfo.label}
            </Badge>
            <Badge className={`text-xs px-1.5 py-0 ${priceInfo.color}`}>
              <DollarSign className="h-3 w-3 mr-0.5" />
              {priceInfo.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{formatContextSize(model.contextLength)} ctx</span>
            {model.strengths.length > 0 && (
              <>
                <span>•</span>
                <span className="truncate">{model.strengths.slice(0, 2).join(', ')}</span>
              </>
            )}
          </div>
        </div>

        {onFavoriteToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle();
            }}
            className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`h-4 w-4 ${
                isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
              }`}
            />
          </button>
        )}
      </div>
    </button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ModelSwitcherPanel: React.FC<ModelSwitcherPanelProps> = ({
  isOpen,
  onClose,
  selectedModelId,
  onModelSelect,
  models,
  favoriteModelIds = [],
  recentModelIds = [],
  searchQuery,
  onSearchChange,
  onFavoriteToggle,
  className = '',
}) => {
  // Get current, favorite, and recent models
  const currentModel = useMemo(
    () => models.find((m) => m.id === selectedModelId),
    [models, selectedModelId]
  );

  const favoriteModels = useMemo(
    () => models.filter((m) => favoriteModelIds.includes(m.id)),
    [models, favoriteModelIds]
  );

  const recentModels = useMemo(() => {
    return recentModelIds
      .map((id) => models.find((m) => m.id === id))
      .filter((m): m is ModelCapability => m !== undefined && m.id !== selectedModelId);
  }, [models, recentModelIds, selectedModelId]);

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) {
      return models;
    }

    const query = searchQuery.toLowerCase();
    return models.filter(
      (model) =>
        model.name.toLowerCase().includes(query) ||
        model.id.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query) ||
        model.strengths.some((s) => s.toLowerCase().includes(query))
    );
  }, [models, searchQuery]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <Card
        className={`fixed top-16 right-4 z-50 w-96 max-h-[calc(100vh-5rem)] shadow-xl ${className}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Switch Model
            </CardTitle>
            <Link
              href="/ai/models"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View All
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Current Model */}
          {currentModel && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 uppercase">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Current Model
                </div>
                <ModelItem
                  model={currentModel}
                  isSelected={true}
                  isFavorite={favoriteModelIds.includes(currentModel.id)}
                  onSelect={() => {}}
                  onFavoriteToggle={
                    onFavoriteToggle ? () => onFavoriteToggle(currentModel.id) : undefined
                  }
                />
              </div>
              <Separator />
            </>
          )}

          {/* Favorites */}
          {favoriteModels.length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 uppercase">
                  <Star className="h-3.5 w-3.5" />
                  Favorites
                </div>
                <div className="space-y-1">
                  {favoriteModels.map((model) => (
                    <ModelItem
                      key={model.id}
                      model={model}
                      isSelected={model.id === selectedModelId}
                      isFavorite={true}
                      onSelect={() => {
                        onModelSelect(model.id);
                        onClose();
                      }}
                      onFavoriteToggle={
                        onFavoriteToggle ? () => onFavoriteToggle(model.id) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Recent Models */}
          {recentModels.length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 uppercase">
                  <Clock className="h-3.5 w-3.5" />
                  Recent
                </div>
                <div className="space-y-1">
                  {recentModels.slice(0, 3).map((model) => (
                    <ModelItem
                      key={model.id}
                      model={model}
                      isSelected={model.id === selectedModelId}
                      isFavorite={favoriteModelIds.includes(model.id)}
                      onSelect={() => {
                        onModelSelect(model.id);
                        onClose();
                      }}
                      onFavoriteToggle={
                        onFavoriteToggle ? () => onFavoriteToggle(model.id) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* All Models */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500 uppercase">
              All Models ({filteredModels.length})
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-1 pr-3">
                {filteredModels.length > 0 ? (
                  filteredModels.map((model) => (
                    <ModelItem
                      key={model.id}
                      model={model}
                      isSelected={model.id === selectedModelId}
                      isFavorite={favoriteModelIds.includes(model.id)}
                      onSelect={() => {
                        onModelSelect(model.id);
                        onClose();
                      }}
                      onFavoriteToggle={
                        onFavoriteToggle ? () => onFavoriteToggle(model.id) : undefined
                      }
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No models found matching &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
